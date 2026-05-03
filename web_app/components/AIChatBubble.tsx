"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAIChat } from "@/lib/ai/use-ai-chat"
import { useMascot } from "@/lib/mascot"
import {
  MessageSquare,
  Send,
  X,
  Loader2,
  Trash2,
  Square,
  Download,
  Settings2,
  ArrowLeft,
  HardDrive,
  Trash,
  Check,
  ChevronDown,
} from "lucide-react"
import type { AIChatMessage } from "@/lib/ai/types"
import { AI_MODELS, DEFAULT_MODEL_ID, getModelById } from "@/lib/ai/models"
import type { AIModelInfo } from "@/lib/ai/types"

const BUBBLE_SIZE = 56
const CORNER_INSET = { x: 16, bottom: 48, top: 72 }

type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left"

const CORNER_POSITIONS: Record<Corner, { top?: string; bottom?: string; left?: string; right?: string }> = {
  "bottom-right": { bottom: `${CORNER_INSET.bottom}px`, right: `${CORNER_INSET.x}px` },
  "bottom-left": { bottom: `${CORNER_INSET.bottom}px`, left: `${CORNER_INSET.x}px` },
  "top-right": { top: `${CORNER_INSET.top}px`, right: `${CORNER_INSET.x}px` },
  "top-left": { top: `${CORNER_INSET.top}px`, left: `${CORNER_INSET.x}px` },
}

function getStoredCorner(): Corner {
  if (typeof window === "undefined") return "bottom-right"
  const stored = localStorage.getItem("ai-chat-corner")
  if (stored && stored in CORNER_POSITIONS) return stored as Corner
  return "bottom-right"
}

function nearestCorner(x: number, y: number): Corner {
  const cx = x + BUBBLE_SIZE / 2
  const cy = y + BUBBLE_SIZE / 2
  const midX = window.innerWidth / 2
  const midY = window.innerHeight / 2
  if (cy >= midY && cx >= midX) return "bottom-right"
  if (cy >= midY) return "bottom-left"
  if (cx >= midX) return "top-right"
  return "top-left"
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0)} ${sizes[i]}`
}

function getStoredModelId(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL_ID
  return localStorage.getItem("ai-selected-model") || DEFAULT_MODEL_ID
}

// ── Quality Dots ─────────────────────────────────────────────────────────────

function QualityDots({ label, value }: { label: string; value: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-muted-foreground/40">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`size-1.5 rounded-full ${
              i < value
                ? value >= 4
                  ? "bg-emerald-400/80"
                  : value >= 3
                    ? "bg-amber-400/80"
                    : "bg-rose-400/80"
                : "bg-muted-foreground/15"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

// ── Model Manager View ──────────────────────────────────────────────────────

function ModelManager({
  onBack,
  onClose,
  onModelSelect,
  activeModelId,
}: {
  onBack: () => void
  onClose: () => void
  onModelSelect: (modelId: string) => void
  activeModelId: string | null
}) {
  const [cacheStatus, setCacheStatus] = useState<Record<string, boolean>>({})
  const [totalCacheSize, setTotalCacheSize] = useState<number | null>(null)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({})
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})
  const engineRef = useRef<import("@/lib/ai/types").AIEngine | null>(null)

  // Only show models with webllmId (browser-compatible)
  const browserModels = AI_MODELS.filter((m) => !!m.webllmId)

  // Check cache status for all models on mount
  useEffect(() => {
    let cancelled = false
    async function checkCache() {
      const { isModelCached, getCacheSize } = await import("@/lib/ai/engine-web")
      const statuses: Record<string, boolean> = {}
      for (const model of browserModels) {
        if (model.webllmId) {
          statuses[model.id] = await isModelCached(model.webllmId)
        }
      }
      if (!cancelled) setCacheStatus(statuses)
      const size = await getCacheSize()
      if (!cancelled) setTotalCacheSize(size)
    }
    checkCache()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll cache size while any download is active
  const isAnyDownloading = Object.values(loading).some(Boolean)
  useEffect(() => {
    if (!isAnyDownloading) return
    let cancelled = false
    const interval = setInterval(async () => {
      const { getCacheSize } = await import("@/lib/ai/engine-web")
      const size = await getCacheSize()
      if (!cancelled) setTotalCacheSize(size)
    }, 2000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [isAnyDownloading])

  const handleDownload = useCallback(async (model: AIModelInfo) => {
    if (!model.webllmId) return
    setLoading((prev) => ({ ...prev, [model.id]: true }))
    setDownloadProgress((prev) => ({ ...prev, [model.id]: 0 }))
    try {
      const { getAIEngine } = await import("@/lib/ai/engine")
      if (!engineRef.current) {
        engineRef.current = await getAIEngine()
      }
      await engineRef.current.loadModel(model.id, (progress) => {
        setDownloadProgress((prev) => ({ ...prev, [model.id]: progress }))
      })
      setCacheStatus((prev) => ({ ...prev, [model.id]: true }))
      // Refresh cache size
      const { getCacheSize } = await import("@/lib/ai/engine-web")
      setTotalCacheSize(await getCacheSize())
    } catch (err) {
      console.error("Failed to download model:", err)
    } finally {
      setLoading((prev) => ({ ...prev, [model.id]: false }))
      setDownloadProgress((prev) => ({ ...prev, [model.id]: 0 }))
    }
  }, [])

  const handleDelete = useCallback(async (model: AIModelInfo) => {
    if (!model.webllmId) return
    setDeleting((prev) => ({ ...prev, [model.id]: true }))
    try {
      // If this model is currently loaded, unload it first
      if (engineRef.current && engineRef.current.getLoadedModel() === model.id) {
        await engineRef.current.unloadModel()
      }
      const { deleteModelFromCache, getCacheSize } = await import("@/lib/ai/engine-web")
      await deleteModelFromCache(model.webllmId)
      setCacheStatus((prev) => ({ ...prev, [model.id]: false }))
      setTotalCacheSize(await getCacheSize())
    } catch (err) {
      console.error("Failed to delete model:", err)
    } finally {
      setDeleting((prev) => ({ ...prev, [model.id]: false }))
    }
  }, [])

  const sizeLabels: Record<string, { label: string; color: string }> = {
    small: { label: "Small", color: "text-emerald-400" },
    medium: { label: "Medium", color: "text-amber-400" },
    large: { label: "Large", color: "text-rose-400" },
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/20 px-4 py-3">
        <button
          onClick={onBack}
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span className="flex-1 font-[family-name:var(--font-display)] text-sm font-semibold tracking-tight">
          Model Manager
        </span>
        <button
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-muted/30 hover:text-muted-foreground"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Storage info */}
      <div className="shrink-0 border-b border-border/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
            <HardDrive className="size-3.5" />
            <span>
              {totalCacheSize !== null
                ? `${formatBytes(totalCacheSize)} used in local storage`
                : "Calculating storage..."}
            </span>
          </div>
          {totalCacheSize !== null && totalCacheSize > 0 && (
            <button
              onClick={async () => {
                const { clearAllCache, getCacheSize } = await import("@/lib/ai/engine-web")
                await clearAllCache()
                setCacheStatus({})
                setTotalCacheSize(await getCacheSize())
              }}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash className="size-3" />
              Clear all
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground/40">
          Models are stored locally on your device. They are private to this browser and origin. A different browser or device requires a separate download.
        </p>
      </div>

      {/* Model list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {browserModels.map((model) => {
          const cached = cacheStatus[model.id] ?? false
          const isLoading = loading[model.id] ?? false
          const isDeleting = deleting[model.id] ?? false
          const progress = downloadProgress[model.id] ?? 0
          const isActive = activeModelId === model.id
          const sizeInfo = sizeLabels[model.size]

          return (
            <div
              key={model.id}
              className={`border-b border-border/10 px-4 py-3 transition-colors ${
                isActive ? "bg-primary/5" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {model.name}
                    </span>
                    {isActive && (
                      <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">
                        Active
                      </span>
                    )}
                    {model.badge && !isActive && (
                      <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                        model.badge === "Recommended"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : model.badge === "Great for tools"
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-muted/30 text-muted-foreground/60"
                      }`}>
                        {model.badge}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className={sizeInfo?.color}>{sizeInfo?.label}</span>
                    <span className="text-muted-foreground/30">|</span>
                    <span className="font-[family-name:var(--font-mono)] text-muted-foreground/50">
                      {model.params}
                    </span>
                    <span className="text-muted-foreground/30">|</span>
                    <span className="text-muted-foreground/50">
                      ~{model.ramRequired} GB RAM
                    </span>
                  </div>
                  {/* Quality indicators */}
                  <div className="mt-1.5 flex items-center gap-3 text-xs">
                    <QualityDots label="Tools" value={model.toolQuality} />
                    <QualityDots label="Chat" value={model.chatQuality} />
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {cached && !isActive && (
                    <button
                      onClick={() => onModelSelect(model.id)}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                      title="Use this model"
                    >
                      <Check className="size-3" />
                      Use
                    </button>
                  )}
                  {cached ? (
                    <button
                      onClick={() => handleDelete(model)}
                      disabled={isDeleting}
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      title="Delete from cache"
                    >
                      {isDeleting ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash className="size-3.5" />
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDownload(model)}
                      disabled={isLoading}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-muted/20 px-2.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-muted/40 disabled:opacity-50"
                      title="Download model"
                    >
                      {isLoading ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Download className="size-3" />
                      )}
                      {isLoading ? `${Math.round(progress * 100)}%` : "Download"}
                    </button>
                  )}
                </div>
              </div>

              {/* Download progress bar */}
              {isLoading && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted/20">
                  <div
                    className="h-full rounded-full bg-primary/50 transition-all duration-300"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Model Selector Dropdown ─────────────────────────────────────────────────

function ModelSelector({
  selectedModelId,
  onSelect,
}: {
  selectedModelId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [cacheStatus, setCacheStatus] = useState<Record<string, boolean>>({})
  const ref = useRef<HTMLDivElement>(null)

  const browserModels = AI_MODELS.filter((m) => !!m.webllmId)
  const selectedModel = getModelById(selectedModelId)

  // Check which models are cached when dropdown opens
  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function check() {
      const { isModelCached } = await import("@/lib/ai/engine-web")
      const statuses: Record<string, boolean> = {}
      for (const model of browserModels) {
        if (model.webllmId) {
          statuses[model.id] = await isModelCached(model.webllmId)
        }
      }
      if (!cancelled) setCacheStatus(statuses)
    }
    check()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 items-center gap-1 rounded-lg bg-muted/20 px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        title="Select model"
      >
        <span className="max-w-[80px] truncate font-[family-name:var(--font-mono)]">
          {selectedModel?.name ?? selectedModelId}
        </span>
        <ChevronDown className="size-3 opacity-50" />
      </button>

      {open && (
        <div className="ts-pill-glass absolute bottom-full left-0 z-10 mb-1.5 w-52 rounded-xl p-1.5 shadow-xl">
          {browserModels.map((model) => {
            const cached = cacheStatus[model.id] ?? false
            const isSelected = model.id === selectedModelId

            return (
              <button
                key={model.id}
                onClick={() => {
                  onSelect(model.id)
                  setOpen(false)
                }}
                disabled={!cached}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors ${
                  isSelected
                    ? "bg-primary/10 font-medium text-foreground"
                    : cached
                      ? "text-foreground/70 hover:bg-muted/30"
                      : "cursor-not-allowed text-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isSelected && <Check className="size-3 text-primary" />}
                  <span className={isSelected ? "" : "ml-5"}>{model.name}</span>
                </div>
                <span className="font-[family-name:var(--font-mono)] text-muted-foreground/40">
                  {model.params}
                </span>
              </button>
            )
          })}
          <div className="mt-0.5 border-t border-border/20 pt-1">
            <p className="px-2.5 py-1 text-xs text-muted-foreground/30">
              Only downloaded models can be selected
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Model Not Loaded Prompt ──────────────────────────────────────────────────

function ModelNotLoadedPrompt({
  selectedModelId,
  onLoad,
  onOpenManager,
}: {
  selectedModelId: string
  onLoad: (modelId: string) => Promise<void>
  onOpenManager: () => void
}) {
  const [isCached, setIsCached] = useState<boolean | null>(null)
  const autoLoadTriggered = useRef(false)
  const model = getModelById(selectedModelId)

  useEffect(() => {
    let cancelled = false
    if (!model?.webllmId) { setIsCached(false); return }
    import("@/lib/ai/engine-web").then(async ({ isModelCached }) => {
      const cached = await isModelCached(model.webllmId!)
      if (!cancelled) setIsCached(cached)
    })
    return () => { cancelled = true }
  }, [model])

  // Auto-load if model is cached — no manual step needed
  useEffect(() => {
    if (isCached && !autoLoadTriggered.current) {
      autoLoadTriggered.current = true
      onLoad(selectedModelId)
    }
  }, [isCached, selectedModelId, onLoad])

  const modelName = model?.name ?? selectedModelId

  // If cached, don't show anything — auto-load was triggered,
  // the downloading/loading state will show progress
  if (isCached || isCached === null) return null

  // Only show prompt for first-time download
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
        <Download className="size-5 text-primary/60" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground/80">
          Download AI Model
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground/50">
          A language model (~{model?.ramRequired ?? 4} GB) will be downloaded and run locally in your browser. No data leaves your device.
        </p>
      </div>
      <button
        onClick={() => onLoad(selectedModelId)}
        className="mt-1 flex items-center gap-2 rounded-xl bg-primary/15 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/25"
      >
        <Download className="size-3.5" />
        Download {modelName}
      </button>
      <button
        onClick={onOpenManager}
        className="text-xs text-muted-foreground/40 transition-colors hover:text-muted-foreground/60"
      >
        Or choose a different model
      </button>
    </div>
  )
}

// ── Chat Popover ─────────────────────────────────────────────────────────────

function ChatPopover({
  open,
  onClose,
  anchorCorner,
  triggerSize = BUBBLE_SIZE,
}: {
  open: boolean
  onClose: () => void
  anchorCorner: Corner
  /** Width of the trigger element (bubble or mascot) so the popover positions beside it */
  triggerSize?: number
}) {
  const [selectedModelId, setSelectedModelId] = useState(getStoredModelId)
  const {
    messages,
    status,
    isLoading,
    isModelLoaded,
    loadProgress,
    currentModelId,
    send,
    loadModel,
    abort,
    clearMessages,
  } = useAIChat({ modelId: selectedModelId })
  const [input, setInput] = useState("")
  const [showModelManager, setShowModelManager] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isDownloading = status.state === "downloading" || status.state === "loading"

  // Persist model selection and auto-load if cached
  const handleModelSelect = useCallback((modelId: string) => {
    setSelectedModelId(modelId)
    localStorage.setItem("ai-selected-model", modelId)
    setShowModelManager(false)
    // Auto-load the model into GPU (it's already cached)
    loadModel(modelId)
  }, [loadModel])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (open && isModelLoaded && !showModelManager) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, isModelLoaded, showModelManager])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading || !isModelLoaded) return
    setInput("")
    await send(text)
  }, [input, isLoading, isModelLoaded, send])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  if (!open) return null

  // Position the popover based on which corner the bubble is in
  const isBottom = anchorCorner.startsWith("bottom")
  const isRight = anchorCorner.endsWith("right")

  // Position beside the trigger (mascot or bubble), not overlapping it
  const horizontalOffset = CORNER_INSET.x + triggerSize + 12
  const popoverStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 55,
    width: "min(400px, calc(100vw - 32px))",
    height: "min(520px, calc(100dvh - 160px))",
    ...(isBottom
      ? { bottom: `${CORNER_INSET.bottom}px` }
      : { top: `${CORNER_INSET.top}px` }),
    ...(isRight
      ? { right: `${horizontalOffset}px` }
      : { left: `${horizontalOffset}px` }),
  }

  // Model manager view
  if (showModelManager) {
    return (
      <div
        style={popoverStyle}
        className="ts-pill-glass flex flex-col overflow-hidden rounded-2xl shadow-2xl"
      >
        <ModelManager
          onBack={() => setShowModelManager(false)}
          onClose={onClose}
          onModelSelect={handleModelSelect}
          activeModelId={currentModelId}
        />
      </div>
    )
  }

  return (
    <div
      style={popoverStyle}
      className="ts-pill-glass flex flex-col overflow-hidden rounded-2xl shadow-2xl"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquare className="size-3.5 text-primary" />
          </div>
          <span className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-tight">
            AI Assistant
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowModelManager(true)}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            title="Model manager"
          >
            <Settings2 className="size-3.5" />
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
              title="Clear chat"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            title="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {/* Model not loaded -- show download/load prompt */}
        {!isModelLoaded && !isDownloading && messages.length === 0 && (
          <ModelNotLoadedPrompt
            selectedModelId={selectedModelId}
            onLoad={loadModel}
            onOpenManager={() => setShowModelManager(true)}
          />
        )}

        {/* Loading or downloading model */}
        {isDownloading && messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="size-8 animate-spin text-primary/40" />
            <p className="text-sm text-muted-foreground/60">Loading model...</p>
          </div>
        )}

        {/* Ready empty state */}
        {isModelLoaded && messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
              <MessageSquare className="size-5 text-primary/60" />
            </div>
            <p className="text-sm text-muted-foreground/70">
              Ask me anything about your dashboard
            </p>
            <p className="text-xs text-muted-foreground/40">
              I can manage tasks, notes, events, and more
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {/* Inline status during conversation */}
        {status.state === "generating" && messages.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <Loader2 className="size-3 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input -- only show when model is loaded */}
      {isModelLoaded && (
        <div className="shrink-0 border-t border-border/20 p-3">
          <div className="flex items-end gap-2 rounded-xl bg-muted/20 px-3 py-2">
            <ModelSelector
              selectedModelId={selectedModelId}
              onSelect={handleModelSelect}
            />
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="max-h-24 min-h-[28px] flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            {isLoading ? (
              <button
                onClick={abort}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
                title="Stop generating"
              >
                <Square className="size-3" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:opacity-30 disabled:hover:bg-primary/10"
                title="Send"
              >
                <Send className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Chat Message ─────────────────────────────────────────────────────────────

function ChatMessage({ message }: { message: AIChatMessage }) {
  if (message.role === "system" || message.role === "tool") return null

  const isUser = message.role === "user"

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary/15 text-foreground"
            : "bg-muted/30 text-foreground"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.toolCalls.map((tc) => (
              <span
                key={tc.id}
                className="inline-block rounded-md bg-primary/10 px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs text-primary/70"
              >
                {tc.function.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Standalone Floating Bubble (when mascot is OFF) ──────────────────────────

export function AIChatBubble() {
  const { enabled: mascotEnabled } = useMascot()
  const [chatOpen, setChatOpen] = useState(false)
  const [corner, setCorner] = useState<Corner>("bottom-right")
  const [dragging, setDragging] = useState(false)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; elX: number; elY: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const didDragRef = useRef(false)

  useEffect(() => {
    setCorner(getStoredCorner())
  }, [])

  // If mascot is enabled, it handles the chat trigger -- hide the standalone bubble
  if (mascotEnabled) return <ChatPopover open={chatOpen} onClose={() => setChatOpen(false)} anchorCorner={corner} />

  const onPointerDown = (e: React.PointerEvent) => {
    const el = wrapperRef.current
    if (!el) return
    e.preventDefault()
    el.setPointerCapture(e.pointerId)
    const rect = el.getBoundingClientRect()
    dragStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, elX: rect.left, elY: rect.top }
    setDragPos({ x: rect.left, y: rect.top })
    setDragging(true)
    didDragRef.current = false
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const start = dragStartRef.current
    if (!start || !dragging) return
    const dx = e.clientX - start.pointerX
    const dy = e.clientY - start.pointerY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true
    setDragPos({
      x: Math.max(0, Math.min(window.innerWidth - BUBBLE_SIZE, start.elX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - BUBBLE_SIZE, start.elY + dy)),
    })
  }

  const onPointerUp = () => {
    if (dragging && dragPos) {
      const newCorner = nearestCorner(dragPos.x, dragPos.y)
      setCorner(newCorner)
      localStorage.setItem("ai-chat-corner", newCorner)
    }
    if (!didDragRef.current) {
      setChatOpen((prev) => !prev)
    }
    setDragging(false)
    setDragPos(null)
    dragStartRef.current = null
  }

  const positionStyle: React.CSSProperties = dragging && dragPos
    ? { top: dragPos.y, left: dragPos.x, right: "auto", bottom: "auto", transition: "none" }
    : { ...CORNER_POSITIONS[corner], transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }

  return (
    <>
      <div
        ref={wrapperRef}
        className="fixed z-50 cursor-grab select-none active:cursor-grabbing"
        style={positionStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <button
          className={`group flex items-center justify-center rounded-full border border-border/20 shadow-xl backdrop-blur-xl transition-all duration-200 ${
            chatOpen
              ? "bg-primary/20 text-primary shadow-primary/10"
              : "bg-card/90 text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-2xl"
          }`}
          style={{ width: BUBBLE_SIZE, height: BUBBLE_SIZE }}
        >
          <MessageSquare className="size-5 transition-transform duration-200 group-hover:scale-110" />
        </button>
      </div>

      <ChatPopover open={chatOpen} onClose={() => setChatOpen(false)} anchorCorner={corner} />
    </>
  )
}

// ── Export for MascotOverlay integration ──────────────────────────────────────

export { ChatPopover }
