/**
 * WebLLM Engine (Browser)
 *
 * Runs LLM inference in the browser via WebGPU using @mlc-ai/web-llm.
 * Tool calling is handled via system prompt injection (not WebLLM's
 * built-in tools parameter) to avoid their model allowlist restrictions.
 */

import type {
  AIEngine,
  AIEngineStatus,
  AIChatMessage,
  AIToolDefinition,
  AIToolCall,
  AIStreamCallbacks,
} from "./types"
import { getModelById } from "./models"
import { executeTool } from "./tools"

// Lazy import — web-llm is a large dependency
let webllm: typeof import("@mlc-ai/web-llm") | null = null

async function getWebLLM() {
  if (!webllm) {
    webllm = await import("@mlc-ai/web-llm")
  }
  return webllm
}

const MAX_TOOL_ROUNDS = 5

export class WebGPUEngine implements AIEngine {
  private engine: import("@mlc-ai/web-llm").MLCEngineInterface | null = null
  private status: AIEngineStatus = { state: "idle" }
  private loadedModelId: string | null = null
  private abortController: AbortController | null = null

  getStatus(): AIEngineStatus {
    return this.status
  }

  getLoadedModel(): string | null {
    return this.loadedModelId
  }

  async loadModel(
    modelId: string,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    const model = getModelById(modelId)
    if (!model?.webllmId) {
      throw new Error(`Model ${modelId} has no WebLLM ID`)
    }

    // If same model is already loaded, skip
    if (this.loadedModelId === modelId && this.engine) return

    // Unload previous model
    if (this.engine) {
      await this.unloadModel()
    }

    const wl = await getWebLLM()

    // Check if model is cached to show the right status
    let cached = false
    try {
      cached = await wl.hasModelInCache(model.webllmId)
    } catch { /* ignore */ }

    this.status = cached
      ? { state: "loading", modelId }
      : { state: "downloading", progress: 0, modelId }

    this.engine = await wl.CreateMLCEngine(model.webllmId, {
      initProgressCallback: (report) => {
        const progress = report.progress ?? 0
        if (cached || report.text?.includes("Loading")) {
          this.status = { state: "loading", modelId }
        } else {
          this.status = { state: "downloading", progress, modelId }
          onProgress?.(progress)
        }
      },
    })

    this.loadedModelId = modelId
    this.status = { state: "ready", modelId }
  }

  async unloadModel(): Promise<void> {
    if (this.engine) {
      await this.engine.unload()
      this.engine = null
    }
    this.loadedModelId = null
    this.status = { state: "idle" }
  }

  async chat(
    messages: AIChatMessage[],
    tools?: AIToolDefinition[],
    callbacks?: AIStreamCallbacks,
  ): Promise<AIChatMessage> {
    if (!this.engine) {
      throw new Error("No model loaded. Call loadModel() first.")
    }

    this.status = { state: "generating" }
    this.abortController = new AbortController()
    callbacks?.onStatus?.(this.status)

    try {
      return await this.chatWithToolLoop(messages, tools, callbacks)
    } finally {
      this.status = {
        state: "ready",
        modelId: this.loadedModelId!,
      }
      callbacks?.onStatus?.(this.status)
      this.abortController = null
    }
  }

  private async chatWithToolLoop(
    messages: AIChatMessage[],
    tools?: AIToolDefinition[],
    callbacks?: AIStreamCallbacks,
  ): Promise<AIChatMessage> {
    // Build messages with tool definitions injected into system prompt
    const openaiMessages = buildMessagesWithTools(messages, tools)
    let rounds = 0

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++

      let fullContent = ""
      const chunks = await this.engine!.chat.completions.create({
        messages: openaiMessages,
        // Do NOT pass tools/tool_choice — we handle tool calling via system prompt
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      })

      for await (const chunk of chunks) {
        if (this.abortController?.signal.aborted) {
          throw new Error("Generation aborted")
        }
        const delta = chunk.choices[0]?.delta
        if (delta?.content) {
          fullContent += delta.content
          callbacks?.onToken?.(delta.content)
        }
      }

      // If no tools provided, return text response directly
      if (!tools || tools.length === 0) {
        return { role: "assistant", content: fullContent }
      }

      // Try to parse tool calls from the model's output
      const toolCalls = parseToolCalls(fullContent)

      if (toolCalls.length === 0) {
        return { role: "assistant", content: cleanToolResponse(fullContent) }
      }

      // Execute tool calls and feed results back
      openaiMessages.push({
        role: "assistant" as const,
        content: fullContent,
      })

      for (const tc of toolCalls) {
        callbacks?.onToolCall?.(tc)
        const result = await executeTool(tc)
        openaiMessages.push({
          role: "user" as const,
          content: `Tool "${tc.function.name}" returned: ${result}`,
        })
      }

      // Reset fullContent for next round
      fullContent = ""
    }

    return { role: "assistant", content: "I've completed the requested actions." }
  }

  abort(): void {
    this.abortController?.abort()
  }
}

// ── Message Building ────────────────────────────────────────────────────────

type OpenAIMessage = { role: "system" | "user" | "assistant"; content: string }

function buildMessagesWithTools(
  messages: AIChatMessage[],
  tools?: AIToolDefinition[],
): OpenAIMessage[] {
  const result: OpenAIMessage[] = []

  // Find system message and inject tool definitions
  const systemMsg = messages.find((m) => m.role === "system")
  const toolInstructions = tools && tools.length > 0
    ? `\n\nYou have access to the following tools. To use a tool, respond with a JSON object in this exact format:\n{"tool": "tool_name", "arguments": {"param": "value"}}\n\nAvailable tools:\n${tools.map((t) => `- ${t.function.name}: ${t.function.description}\n  Parameters: ${JSON.stringify(t.function.parameters.properties)}`).join("\n")}\n\nIf you need to use a tool, respond ONLY with the JSON object, nothing else. If you don't need a tool, respond normally in plain text.`
    : ""

  if (systemMsg || toolInstructions) {
    result.push({
      role: "system",
      content: (systemMsg?.content ?? "") + toolInstructions,
    })
  }

  // Add conversation messages (skip the system message we already handled)
  for (const msg of messages) {
    if (msg.role === "system") continue
    if (msg.role === "tool") {
      result.push({ role: "user", content: `Tool result: ${msg.content}` })
    } else {
      result.push({ role: msg.role as "user" | "assistant", content: msg.content })
    }
  }

  return result
}

// ── Tool Call Parsing ───────────────────────────────────────────────────────

function parseToolCalls(text: string): AIToolCall[] {
  const calls: AIToolCall[] = []

  // Find JSON objects by matching balanced braces
  const jsonObjects = extractJsonObjects(text)

  for (const jsonStr of jsonObjects) {
    try {
      const parsed = JSON.parse(jsonStr)
      if (parsed.tool && typeof parsed.tool === "string") {
        calls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          function: {
            name: parsed.tool,
            arguments: JSON.stringify(parsed.arguments ?? {}),
          },
        })
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  return calls
}

/** Extract top-level JSON objects from text by matching balanced braces */
function extractJsonObjects(text: string): string[] {
  const results: string[] = []
  let depth = 0
  let start = -1

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i
      depth++
    } else if (text[i] === "}") {
      depth--
      if (depth === 0 && start >= 0) {
        results.push(text.slice(start, i + 1))
        start = -1
      }
    }
  }

  return results
}

function cleanToolResponse(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed.tool) {
        return `I tried to use the "${parsed.tool}" tool but encountered an issue.`
      }
    } catch {
      // Not valid JSON
    }
  }
  return text
}

// ── Cache Management ────────────────────────────────────────────────────────

/** Check if a model is already downloaded in browser cache */
export async function isModelCached(webllmId: string): Promise<boolean> {
  const wl = await getWebLLM()
  try {
    return await wl.hasModelInCache(webllmId)
  } catch {
    return false
  }
}

/** Delete a model from browser cache */
export async function deleteModelFromCache(webllmId: string): Promise<void> {
  const wl = await getWebLLM()
  await wl.deleteModelAllInfoInCache(webllmId)
}

/** Estimate total cache storage used by models */
export async function getCacheSize(): Promise<number> {
  if (!("caches" in globalThis)) return 0
  try {
    const scopes = ["webllm/model", "webllm/config", "webllm/wasm"]
    let total = 0
    for (const scope of scopes) {
      const cache = await caches.open(scope)
      const keys = await cache.keys()
      for (const req of keys) {
        const res = await cache.match(req)
        if (res) {
          const blob = await res.clone().blob()
          total += blob.size
        }
      }
    }
    return total
  } catch {
    return 0
  }
}

/** Delete ALL cached model data. Cleans up partial downloads too. */
export async function clearAllCache(): Promise<void> {
  if (!("caches" in globalThis)) return
  const scopes = ["webllm/model", "webllm/config", "webllm/wasm"]
  for (const scope of scopes) {
    await caches.delete(scope)
  }
}

/** Check if WebGPU is available in this browser */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator
}
