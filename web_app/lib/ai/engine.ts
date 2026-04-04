/**
 * Unified AI Engine
 *
 * Auto-detects the runtime environment and creates the appropriate engine:
 * - Electron: Uses node-llama-cpp via IPC (Metal GPU)
 * - Browser: Uses wllama (llama.cpp WASM)
 *
 * This follows the same pattern as data-layer.ts.
 */

import type {
  AIEngine,
  AIEngineStatus,
  AIChatMessage,
  AIToolDefinition,
  AIToolCall,
  AIStreamCallbacks,
} from "./types"
import { isElectron } from "../data-layer"

// ── Electron API type (augmented with AI methods) ────────────────────────────

type AIEventHandler = (event: unknown, data: unknown) => void

interface ElectronAPIWithAI {
  invoke: (channel: string, data?: unknown) => Promise<unknown>
  onAIProgress?: (handler: AIEventHandler) => void
  offAIProgress?: (handler: AIEventHandler) => void
  onAIToken?: (handler: AIEventHandler) => void
  offAIToken?: (handler: AIEventHandler) => void
  onAIToolCall?: (handler: AIEventHandler) => void
  offAIToolCall?: (handler: AIEventHandler) => void
}

function getElectronAI(): ElectronAPIWithAI {
  return window.electronAPI as unknown as ElectronAPIWithAI
}

// ── Electron IPC Engine ──────────────────────────────────────────────────────

class ElectronAIEngine implements AIEngine {
  private status: AIEngineStatus = { state: "idle" }
  private loadedModelId: string | null = null

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
    const api = getElectronAI()
    this.status = { state: "downloading", progress: 0, modelId }

    const progressHandler: AIEventHandler = (_event, raw) => {
      const data = raw as { state: string; modelId: string; progress?: number }
      if (data.state === "downloading") {
        this.status = { state: "downloading", progress: data.progress ?? 0, modelId }
        onProgress?.(data.progress ?? 0)
      } else if (data.state === "loading") {
        this.status = { state: "loading", modelId }
      } else if (data.state === "ready") {
        this.status = { state: "ready", modelId }
        this.loadedModelId = modelId
      }
    }

    api.onAIProgress?.(progressHandler)

    try {
      await api.invoke("ai:load-model", modelId)
      this.loadedModelId = modelId
      this.status = { state: "ready", modelId }
    } finally {
      api.offAIProgress?.(progressHandler)
    }
  }

  async unloadModel(): Promise<void> {
    await getElectronAI().invoke("ai:unload-model")
    this.loadedModelId = null
    this.status = { state: "idle" }
  }

  async chat(
    messages: AIChatMessage[],
    tools?: AIToolDefinition[],
    callbacks?: AIStreamCallbacks,
  ): Promise<AIChatMessage> {
    const api = getElectronAI()
    this.status = { state: "generating" }
    callbacks?.onStatus?.(this.status)

    const tokenHandler: AIEventHandler = (_event, token) => {
      callbacks?.onToken?.(token as string)
    }
    const toolCallHandler: AIEventHandler = (_event, toolCall) => {
      callbacks?.onToolCall?.(toolCall as AIToolCall)
    }

    api.onAIToken?.(tokenHandler)
    api.onAIToolCall?.(toolCallHandler)

    try {
      const result = await api.invoke("ai:chat", { messages, tools }) as AIChatMessage
      return result
    } finally {
      api.offAIToken?.(tokenHandler)
      api.offAIToolCall?.(toolCallHandler)
      this.status = this.loadedModelId
        ? { state: "ready", modelId: this.loadedModelId }
        : { state: "idle" }
      callbacks?.onStatus?.(this.status)
    }
  }

  abort(): void {
    getElectronAI().invoke("ai:abort")
  }
}

// ── Engine Factory ───────────────────────────────────────────────────────────

let engineInstance: AIEngine | null = null

/**
 * Get the AI engine for the current environment.
 * Returns a singleton instance.
 */
export async function getAIEngine(): Promise<AIEngine> {
  if (engineInstance) return engineInstance

  if (isElectron) {
    engineInstance = new ElectronAIEngine()
  } else {
    const { WebGPUEngine, isWebGPUAvailable } = await import("./engine-web")
    if (!isWebGPUAvailable()) {
      throw new Error(
        "WebGPU is not available in this browser. " +
          "Try Chrome 113+, Edge 113+, or Safari 18+.",
      )
    }
    engineInstance = new WebGPUEngine()
  }

  return engineInstance
}

/** Check if AI is available in the current environment. */
export function isAIAvailable(): boolean {
  if (isElectron) return true
  if (typeof navigator !== "undefined" && "gpu" in navigator) return true
  return false
}

/** Get the engine type for the current environment. */
export function getEngineType(): "node-llama-cpp" | "webgpu" | "unavailable" {
  if (isElectron) return "node-llama-cpp"
  if (typeof navigator !== "undefined" && "gpu" in navigator) return "webgpu"
  return "unavailable"
}
