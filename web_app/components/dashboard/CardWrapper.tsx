"use client"

import { GripVertical, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const CARD_TYPE_STYLES: Record<
  string,
  { border: string; dot: string; glow: string }
> = {
  clock: {
    border: "border-t-cyan-500/40",
    dot: "bg-cyan-400",
    glow: "glow-cyan",
  },
  timer: {
    border: "border-t-emerald-500/40",
    dot: "bg-emerald-400",
    glow: "glow-emerald",
  },
  todo: {
    border: "border-t-amber-500/40",
    dot: "bg-amber-400",
    glow: "glow-amber",
  },
  notes: {
    border: "border-t-violet-500/40",
    dot: "bg-violet-400",
    glow: "glow-violet",
  },
  schedule: {
    border: "border-t-blue-500/40",
    dot: "bg-blue-400",
    glow: "glow-blue",
  },
  calories: {
    border: "border-t-orange-500/40",
    dot: "bg-orange-400",
    glow: "glow-orange",
  },
  medicines: {
    border: "border-t-rose-500/40",
    dot: "bg-rose-400",
    glow: "glow-rose",
  },
}

const DEFAULT_STYLE = {
  border: "border-t-primary/40",
  dot: "bg-primary",
  glow: "",
}

interface CardWrapperProps {
  title: string
  cardType: string
  isEditMode: boolean
  onRemove?: () => void
  children: React.ReactNode
}

export function CardWrapper({
  title,
  cardType,
  isEditMode,
  onRemove,
  children,
}: CardWrapperProps) {
  const typeStyle = CARD_TYPE_STYLES[cardType] ?? DEFAULT_STYLE

  return (
    <div
      className={cn(
        "glass-card flex h-full flex-col overflow-hidden rounded-xl border-t-2 shadow-sm transition-all duration-300",
        typeStyle.border,
        !isEditMode && "hover:-translate-y-0.5 hover:shadow-lg",
        !isEditMode && typeStyle.glow.replace("glow-", "hover:glow-"),
        isEditMode && "ring-1 ring-primary/20 hover:ring-primary/40"
      )}
    >
      {/* Card header */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 border-b border-border/40 px-3 py-2",
          isEditMode && "drag-handle cursor-grab active:cursor-grabbing"
        )}
      >
        {isEditMode && (
          <GripVertical className="size-3.5 shrink-0 text-muted-foreground/40" />
        )}
        <span className={cn("size-1.5 shrink-0 rounded-full", typeStyle.dot)} />
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {isEditMode && onRemove && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-muted-foreground/50 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <Trash2 className="size-3" />
          </Button>
        )}
      </div>

      {/* Card body */}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  )
}
