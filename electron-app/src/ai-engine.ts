/**
 * AI Engine for Electron (node-llama-cpp)
 *
 * Runs LLM inference natively via Metal GPU on macOS (Apple Silicon).
 * Loaded in the Electron main process and exposed to the renderer via IPC.
 */

import path from "path"
import { app } from "electron"
import type { IpcMainInvokeEvent } from "electron"

// Types mirrored from web_app/thirdscreen/lib/ai/types.ts
// (We duplicate the minimal set needed to avoid cross-project imports)

interface AIChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  toolCalls?: AIToolCall[]
  toolCallId?: string
}

interface AIToolCall {
  id: string
  function: { name: string; arguments: string }
}

interface AIToolDefinition {
  type: "function"
  function: {
    name: string
    description: string
    parameters: {
      type: "object"
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

// ── Model directory ──────────────────────────────────────────────────────────

function getModelsDir(): string {
  return path.join(app.getPath("userData"), "models")
}

// ── Engine singleton ─────────────────────────────────────────────────────────

let llamaInstance: Awaited<ReturnType<typeof import("node-llama-cpp").getLlama>> | null = null
let loadedModel: Awaited<ReturnType<Awaited<ReturnType<typeof import("node-llama-cpp").getLlama>>["loadModel"]>> | null = null
let loadedContext: Awaited<ReturnType<NonNullable<typeof loadedModel>["createContext"]>> | null = null
let currentModelId: string | null = null
let aborted = false

// Known GGUF URIs by model ID (mirrors models.ts)
const GGUF_MODELS: Record<string, string> = {
  "llama-3.2-3b": "hf:bartowski/Llama-3.2-3B-Instruct-GGUF:Q4_K_M",
  "phi-3.5-mini": "hf:bartowski/Phi-3.5-mini-instruct-GGUF:Q4_K_M",
  "qwen2.5-3b": "hf:Qwen/Qwen2.5-3B-Instruct-GGUF:qwen2.5-3b-instruct-q4_k_m.gguf",
  "llama-3.1-8b": "hf:bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M",
  "qwen2.5-7b": "hf:Qwen/Qwen2.5-7B-Instruct-GGUF:qwen2.5-7b-instruct-q4_k_m.gguf",
  "mistral-7b": "hf:bartowski/Mistral-7B-Instruct-v0.3-GGUF:Q4_K_M",
  "hermes-3-8b": "hf:bartowski/Hermes-3-Llama-3.1-8B-GGUF:Q4_K_M",
  "llama-3.1-70b": "hf:bartowski/Meta-Llama-3.1-70B-Instruct-GGUF:Q4_K_M",
  "qwen2.5-72b": "hf:Qwen/Qwen2.5-72B-Instruct-GGUF:qwen2.5-72b-instruct-q4_k_m.gguf",
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

export function registerAIHandlers(ipcMain: Electron.IpcMain, sendToRenderer: (channel: string, data: unknown) => void) {
  // Load a model (downloads if needed)
  ipcMain.handle("ai:load-model", async (_event: IpcMainInvokeEvent, modelId: string) => {
    const ggufUri = GGUF_MODELS[modelId]
    if (!ggufUri) throw new Error(`Unknown model: ${modelId}`)

    // Unload previous
    if (loadedContext) {
      loadedContext = null
    }
    if (loadedModel) {
      await loadedModel.dispose?.()
      loadedModel = null
    }

    // Initialize llama (auto-detects Metal/CUDA)
    const { getLlama, resolveModelFile } = await import("node-llama-cpp")

    if (!llamaInstance) {
      llamaInstance = await getLlama()
    }

    const modelsDir = getModelsDir()

    // Download/resolve model (sends progress back)
    sendToRenderer("ai:progress", { state: "downloading", modelId, progress: 0 })

    const modelPath = await resolveModelFile(ggufUri, modelsDir, {
      onProgress: (status) => {
        const progress = ("totalSize" in status && "downloadedSize" in status)
          ? (status as { downloadedSize: number; totalSize: number }).downloadedSize / (status as { downloadedSize: number; totalSize: number }).totalSize
          : 0
        sendToRenderer("ai:progress", { state: "downloading", modelId, progress })
      },
    })

    sendToRenderer("ai:progress", { state: "loading", modelId })

    // Load model
    loadedModel = await llamaInstance.loadModel({ modelPath })
    loadedContext = await loadedModel.createContext()
    currentModelId = modelId

    sendToRenderer("ai:progress", { state: "ready", modelId })
    return { success: true, modelId }
  })

  // Unload current model
  ipcMain.handle("ai:unload-model", async () => {
    if (loadedContext) {
      loadedContext = null
    }
    if (loadedModel) {
      await loadedModel.dispose?.()
      loadedModel = null
    }
    currentModelId = null
    sendToRenderer("ai:progress", { state: "idle" })
    return { success: true }
  })

  // Get current status
  ipcMain.handle("ai:status", () => {
    if (!currentModelId) return { state: "idle" }
    return { state: "ready", modelId: currentModelId }
  })

  // Get loaded model
  ipcMain.handle("ai:loaded-model", () => currentModelId)

  // Chat with tool calling
  ipcMain.handle(
    "ai:chat",
    async (
      _event: IpcMainInvokeEvent,
      data: {
        messages: AIChatMessage[]
        tools?: AIToolDefinition[]
      },
    ) => {
      if (!loadedModel || !loadedContext) {
        throw new Error("No model loaded")
      }

      aborted = false
      sendToRenderer("ai:progress", { state: "generating" })

      const { LlamaChatSession, defineChatSessionFunction } = await import("node-llama-cpp")

      try {
        const session = new LlamaChatSession({
          contextSequence: loadedContext.getSequence(),
        })

        // Build system prompt from messages
        const systemMsgs = data.messages.filter((m) => m.role === "system")
        const userMsgs = data.messages.filter((m) => m.role === "user")
        const lastUserMsg = userMsgs[userMsgs.length - 1]?.content || ""

        // Set system prompt if present
        if (systemMsgs.length > 0) {
          session.setChatHistory([
            { type: "system", text: systemMsgs.map((m) => m.content).join("\n") },
          ])
        }

        // Convert tool definitions to node-llama-cpp functions
        // node-llama-cpp handles the tool call loop internally
        const functions: Record<string, ReturnType<typeof defineChatSessionFunction>> = {}

        if (data.tools) {
          for (const tool of data.tools) {
            const toolDef = tool.function
            functions[toolDef.name] = defineChatSessionFunction({
              description: toolDef.description,
              params: toolDef.parameters as {
                type: "object"
                properties: Record<string, unknown>
              },
              async handler(params: Record<string, unknown>) {
                // Send tool call event to renderer
                const toolCallEvent: AIToolCall = {
                  id: `call_${Date.now()}`,
                  function: {
                    name: toolDef.name,
                    arguments: JSON.stringify(params),
                  },
                }
                sendToRenderer("ai:tool-call", toolCallEvent)

                // Execute via IPC back to renderer (which has the data layer)
                // The renderer will call executeTool and return the result
                return new Promise<string>((resolve) => {
                  const responseChannel = `ai:tool-result:${toolCallEvent.id}`
                  ipcMain.once(responseChannel, (_evt: Electron.IpcMainEvent, result: string) => {
                    resolve(result)
                  })
                  sendToRenderer("ai:execute-tool", {
                    id: toolCallEvent.id,
                    responseChannel,
                    toolCall: toolCallEvent,
                  })
                })
              },
            })
          }
        }

        // Stream the response
        let fullResponse = ""
        const response = await session.prompt(lastUserMsg, {
          functions: Object.keys(functions).length > 0 ? functions : undefined,
          onTextChunk(chunk: string) {
            if (aborted) return
            fullResponse += chunk
            sendToRenderer("ai:token", chunk)
          },
        })

        session.dispose()

        sendToRenderer("ai:progress", { state: "ready", modelId: currentModelId })
        return { role: "assistant", content: response || fullResponse } as AIChatMessage
      } catch (err) {
        sendToRenderer("ai:progress", { state: "ready", modelId: currentModelId })
        throw err
      }
    },
  )

  // Abort generation
  ipcMain.handle("ai:abort", () => {
    aborted = true
    return { success: true }
  })

  // List downloaded models
  ipcMain.handle("ai:list-downloaded", async () => {
    const fs = await import("fs")
    const modelsDir = getModelsDir()
    if (!fs.existsSync(modelsDir)) return []
    const files = fs.readdirSync(modelsDir).filter((f: string) => f.endsWith(".gguf"))
    return files.map((f: string) => ({
      filename: f,
      path: path.join(modelsDir, f),
      sizeBytes: fs.statSync(path.join(modelsDir, f)).size,
    }))
  })
}
