"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Plus,
  Clock,
  Timer,
  CheckSquare,
  StickyNote,
  Calendar,
  Flame,
  Pill,
} from "lucide-react"
import {
  CARD_TYPE_LABELS,
  DEFAULT_CARD_SIZES,
  type CardType,
  type CreateCardPayload,
} from "@/lib/types"
import { useState } from "react"
import { toast } from "sonner"

const CARD_TYPE_ICONS: Record<CardType, React.ComponentType<{ className?: string }>> = {
  clock: Clock,
  timer: Timer,
  todo: CheckSquare,
  notes: StickyNote,
  schedule: Calendar,
  calories: Flame,
  medicines: Pill,
}

const CARD_TYPE_DESCRIPTIONS: Record<CardType, string> = {
  clock: "Display the current time and date",
  timer: "Countdown and stopwatch",
  todo: "Track tasks and to-dos",
  notes: "Quick notes and links",
  schedule: "View your day at a glance",
  calories: "Track food and water intake",
  medicines: "Medication reminders",
}

const CARD_TYPE_COLORS: Record<CardType, string> = {
  clock: "text-cyan-400 bg-cyan-500/10",
  timer: "text-emerald-400 bg-emerald-500/10",
  todo: "text-amber-400 bg-amber-500/10",
  notes: "text-violet-400 bg-violet-500/10",
  schedule: "text-blue-400 bg-blue-500/10",
  calories: "text-orange-400 bg-orange-500/10",
  medicines: "text-rose-400 bg-rose-500/10",
}

interface AddCardDialogProps {
  onCardAdded: () => void
}

export function AddCardDialog({ onCardAdded }: AddCardDialogProps) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState<CardType | null>(null)

  async function handleAdd(type: CardType) {
    setAdding(type)
    try {
      const defaults = DEFAULT_CARD_SIZES[type]
      const payload: CreateCardPayload = {
        type,
        title: CARD_TYPE_LABELS[type],
        w: defaults.w,
        h: defaults.h,
      }

      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error("Failed to create card")

      toast.success(`${CARD_TYPE_LABELS[type]} card added`)
      setOpen(false)
      onCardAdded()
    } catch {
      toast.error("Failed to add card")
    } finally {
      setAdding(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-primary/20 text-primary hover:bg-primary/10">
          <Plus className="size-3.5" data-icon="inline-start" />
          Add Card
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-popover sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-display)]">Add a Card</DialogTitle>
          <DialogDescription>
            Choose a card type to add to your dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-1.5 py-2">
          {(Object.keys(CARD_TYPE_LABELS) as CardType[]).map((type) => {
            const Icon = CARD_TYPE_ICONS[type]
            const isLoading = adding === type
            const colorClasses = CARD_TYPE_COLORS[type]
            return (
              <button
                key={type}
                onClick={() => handleAdd(type)}
                disabled={adding !== null}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-all hover:bg-muted/30 disabled:opacity-50"
              >
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${colorClasses}`}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{CARD_TYPE_LABELS[type]}</div>
                  <div className="text-xs text-muted-foreground/60">
                    {CARD_TYPE_DESCRIPTIONS[type]}
                  </div>
                </div>
                {isLoading && (
                  <div className="size-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                )}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
