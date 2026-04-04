/**
 * AI Model Registry
 *
 * Browser uses WebLLM (WebGPU acceleration) with prompt-based tool calling.
 * Electron uses node-llama-cpp (Metal GPU on Mac).
 * All models support tool calling since we handle it via system prompt.
 */

import type { AIModelInfo } from "./types"

export const AI_MODELS: AIModelInfo[] = [
  // ── Small (fast, low RAM) ───────────────────────────────────────────────
  {
    id: "qwen2.5-3b",
    name: "Qwen 2.5 3B",
    size: "small",
    params: "3B",
    ramRequired: 4,
    webllmId: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    ggufId: "hf:Qwen/Qwen2.5-3B-Instruct-GGUF:qwen2.5-3b-instruct-q4_k_m.gguf",
    supportsTools: true,
    toolQuality: 3,
    chatQuality: 3,
    badge: "Best small model",
  },
  {
    id: "llama-3.2-3b",
    name: "Llama 3.2 3B",
    size: "small",
    params: "3B",
    ramRequired: 4,
    webllmId: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    ggufId: "hf:bartowski/Llama-3.2-3B-Instruct-GGUF:Q4_K_M",
    supportsTools: true,
    toolQuality: 2,
    chatQuality: 3,
  },
  {
    id: "phi-3.5-mini",
    name: "Phi 3.5 Mini",
    size: "small",
    params: "3.8B",
    ramRequired: 4,
    webllmId: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    ggufId: "hf:bartowski/Phi-3.5-mini-instruct-GGUF:Q4_K_M",
    supportsTools: true,
    toolQuality: 2,
    chatQuality: 3,
  },

  // ── Medium (balanced) ──────────────────────────────────────────────────
  {
    id: "qwen2.5-7b",
    name: "Qwen 2.5 7B",
    size: "medium",
    params: "7B",
    ramRequired: 6,
    webllmId: "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    ggufId: "hf:Qwen/Qwen2.5-7B-Instruct-GGUF:qwen2.5-7b-instruct-q4_k_m.gguf",
    supportsTools: true,
    toolQuality: 5,
    chatQuality: 4,
    badge: "Recommended",
  },
  {
    id: "llama-3.1-8b",
    name: "Llama 3.1 8B",
    size: "medium",
    params: "8B",
    ramRequired: 6,
    webllmId: "Llama-3.1-8B-Instruct-q4f16_1-MLC",
    ggufId: "hf:bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M",
    supportsTools: true,
    toolQuality: 3,
    chatQuality: 4,
  },
  {
    id: "mistral-7b",
    name: "Mistral 7B",
    size: "medium",
    params: "7B",
    ramRequired: 6,
    webllmId: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
    ggufId: "hf:bartowski/Mistral-7B-Instruct-v0.3-GGUF:Q4_K_M",
    supportsTools: true,
    toolQuality: 3,
    chatQuality: 4,
  },
]

/** Get models available for a specific engine */
export function getModelsForEngine(engine: "webgpu" | "node-llama-cpp"): AIModelInfo[] {
  return AI_MODELS.filter((m) =>
    engine === "webgpu" ? !!m.webllmId : !!m.ggufId,
  )
}

/** Look up a model by its ID */
export function getModelById(id: string): AIModelInfo | undefined {
  return AI_MODELS.find((m) => m.id === id)
}

/** Default model — Qwen 2.5 7B has the best tool calling for its size */
export const DEFAULT_MODEL_ID = "qwen2.5-7b"
