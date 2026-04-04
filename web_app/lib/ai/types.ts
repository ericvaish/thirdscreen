/**
 * AI Engine Types
 *
 * Shared types for the local AI model runner.
 * Used by both wllama (browser WASM) and node-llama-cpp (Electron).
 */

// ── Chat Messages ────────────────────────────────────────────────────────────

export interface AIChatMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  /** Present when role === "assistant" and the model wants to call tools */
  toolCalls?: AIToolCall[]
  /** Present when role === "tool" — the ID of the tool call this responds to */
  toolCallId?: string
}

export interface AIToolCall {
  id: string
  function: {
    name: string
    arguments: string // JSON string
  }
}

// ── Tool Definitions ─────────────────────────────────────────────────────────

export interface AIToolParameter {
  type: string
  description?: string
  enum?: string[]
  items?: AIToolParameter
}

export interface AIToolDefinition {
  type: "function"
  function: {
    name: string
    description: string
    parameters: {
      type: "object"
      properties: Record<string, AIToolParameter>
      required?: string[]
    }
  }
}

// ── Model Configuration ──────────────────────────────────────────────────────

export type AIEngineType = "webgpu" | "node-llama-cpp"

export interface AIModelInfo {
  id: string
  name: string
  /** Size category for UI display */
  size: "small" | "medium" | "large"
  /** Approximate parameter count (e.g. "3B", "8B", "70B") */
  params: string
  /** Approximate RAM/VRAM needed in GB */
  ramRequired: number
  /** MLC-compiled model ID for WebLLM (browser WebGPU) */
  webllmId?: string
  /** HuggingFace URI for node-llama-cpp in Electron (e.g. "hf:user/repo:file") */
  ggufId?: string
  /** Whether this model supports tool/function calling */
  supportsTools: boolean
  /** How well the model handles tool/function calling (1-5) */
  toolQuality: 1 | 2 | 3 | 4 | 5
  /** How well the model handles general chat (1-5) */
  chatQuality: 1 | 2 | 3 | 4 | 5
  /** Short capability tag shown in UI */
  badge?: string
}

// ── Engine Interface ─────────────────────────────────────────────────────────

export type AIEngineStatus =
  | { state: "idle" }
  | { state: "downloading"; progress: number; modelId: string }
  | { state: "loading"; modelId: string }
  | { state: "ready"; modelId: string }
  | { state: "generating" }
  | { state: "error"; error: string }

export interface AIStreamCallbacks {
  onToken?: (token: string) => void
  onToolCall?: (toolCall: AIToolCall) => void
  onStatus?: (status: AIEngineStatus) => void
}

/**
 * Unified AI engine interface implemented by both wllama and node-llama-cpp.
 */
export interface AIEngine {
  /** Current engine status */
  getStatus(): AIEngineStatus

  /** Load a model by its AIModelInfo.id */
  loadModel(modelId: string, onProgress?: (progress: number) => void): Promise<void>

  /** Unload the current model and free memory */
  unloadModel(): Promise<void>

  /** Get the currently loaded model ID, or null */
  getLoadedModel(): string | null

  /**
   * Run a chat completion with optional tool calling.
   * Returns the final assistant message (after any tool call round-trips).
   */
  chat(
    messages: AIChatMessage[],
    tools?: AIToolDefinition[],
    callbacks?: AIStreamCallbacks,
  ): Promise<AIChatMessage>

  /** Abort any in-progress generation */
  abort(): void
}

// ── Conversation (for UI state) ──────────────────────────────────────────────

export interface AIConversation {
  id: string
  messages: AIChatMessage[]
  modelId: string
  createdAt: string
  updatedAt: string
}
