// AI Engine - Local model runner for Third Screen
export type {
  AIEngine,
  AIEngineStatus,
  AIEngineType,
  AIChatMessage,
  AIToolCall,
  AIToolDefinition,
  AIStreamCallbacks,
  AIModelInfo,
  AIConversation,
} from "./types"

export { AI_MODELS, getModelsForEngine, getModelById, DEFAULT_MODEL_ID } from "./models"
export { AI_TOOLS, SYSTEM_PROMPT, executeTool } from "./tools"
export { getAIEngine, isAIAvailable, getEngineType } from "./engine"
export { useAIChat } from "./use-ai-chat"
export type { UseAIChatReturn } from "./use-ai-chat"
