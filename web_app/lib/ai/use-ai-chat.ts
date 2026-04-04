/**
 * React hook for AI chat
 *
 * Provides a simple interface for components to chat with the local AI model.
 * Handles model loading, streaming, tool calling, and conversation state.
 */

"use client"

import { useState, useCallback, useRef } from "react"
import type { AIChatMessage, AIEngineStatus, AIToolCall } from "./types"
import { AI_TOOLS, SYSTEM_PROMPT } from "./tools"
import { DEFAULT_MODEL_ID, getModelById } from "./models"

export interface UseAIChatOptions {
  modelId?: string
  systemPrompt?: string
}

export interface UseAIChatReturn {
  messages: AIChatMessage[]
  status: AIEngineStatus
  isLoading: boolean
  isModelLoaded: boolean
  loadProgress: number
  currentModelId: string | null
  send: (message: string) => Promise<void>
  loadModel: (modelId?: string) => Promise<void>
  unloadModel: () => Promise<void>
  abort: () => void
  clearMessages: () => void
}

export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const { modelId = DEFAULT_MODEL_ID, systemPrompt = SYSTEM_PROMPT } = options

  const [messages, setMessages] = useState<AIChatMessage[]>([])
  const [status, setStatus] = useState<AIEngineStatus>({ state: "idle" })
  const [loadProgress, setLoadProgress] = useState(0)
  const [currentModelId, setCurrentModelId] = useState<string | null>(null)
  const engineRef = useRef<import("./types").AIEngine | null>(null)
  const streamedContentRef = useRef("")

  const isLoading = status.state === "generating" || status.state === "downloading" || status.state === "loading"
  const isModelLoaded = status.state === "ready"

  const getEngine = useCallback(async () => {
    if (!engineRef.current) {
      const { getAIEngine } = await import("./engine")
      engineRef.current = await getAIEngine()
    }
    return engineRef.current
  }, [])

  const loadModel = useCallback(
    async (id?: string) => {
      const engine = await getEngine()
      const targetId = id || modelId
      setStatus({ state: "downloading", progress: 0, modelId: targetId })
      setLoadProgress(0)

      await engine.loadModel(targetId, (progress) => {
        setLoadProgress(progress)
      })

      setCurrentModelId(targetId)
      setStatus({ state: "ready", modelId: targetId })
    },
    [getEngine, modelId],
  )

  const unloadModel = useCallback(async () => {
    const engine = await getEngine()
    await engine.unloadModel()
    setCurrentModelId(null)
    setStatus({ state: "idle" })
  }, [getEngine])

  const send = useCallback(
    async (message: string) => {
      const engine = await getEngine()

      // Require model to be loaded before sending
      if (!engine.getLoadedModel()) {
        throw new Error("No model loaded. Please download a model first.")
      }

      // Add user message
      const userMsg: AIChatMessage = { role: "user", content: message }
      setMessages((prev) => [...prev, userMsg])

      // Only pass tools if the model supports them
      const loadedModelId = engine.getLoadedModel()
      const modelInfo = loadedModelId ? getModelById(loadedModelId) : null
      const tools = modelInfo?.supportsTools ? AI_TOOLS : undefined

      // Include system prompt and full conversation history
      const fullMessages: AIChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...messages,
        userMsg,
      ]

      // Add a placeholder assistant message for streaming
      streamedContentRef.current = ""
      const placeholderMsg: AIChatMessage = { role: "assistant", content: "" }
      setMessages((prev) => [...prev, placeholderMsg])

      try {
        const result = await engine.chat(fullMessages, tools, {
          onToken(token) {
            streamedContentRef.current += token
            setMessages((prev) => {
              const updated = [...prev]
              updated[updated.length - 1] = {
                role: "assistant",
                content: streamedContentRef.current,
              }
              return updated
            })
          },
          onToolCall(toolCall: AIToolCall) {
            // Could show tool calls in UI if desired
            console.log("[AI] Tool call:", toolCall.function.name)
          },
          onStatus(newStatus) {
            setStatus(newStatus)
          },
        })

        // Replace placeholder with final result
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = result
          return updated
        })
      } catch (err) {
        // Remove placeholder on error
        setMessages((prev) => {
          const updated = [...prev]
          // Replace last message with error
          updated[updated.length - 1] = {
            role: "assistant",
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          }
          return updated
        })
      }
    },
    [getEngine, loadModel, messages, systemPrompt],
  )

  const abort = useCallback(() => {
    engineRef.current?.abort()
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return {
    messages,
    status,
    isLoading,
    isModelLoaded,
    loadProgress,
    currentModelId,
    send,
    loadModel,
    unloadModel,
    abort,
    clearMessages,
  }
}
