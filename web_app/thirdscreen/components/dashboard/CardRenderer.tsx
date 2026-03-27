"use client"

import type { CardData } from "@/lib/types"
import ClockCard from "@/components/cards/ClockCard"
import TimerCard from "@/components/cards/TimerCard"
import { TodoCard } from "@/components/cards/TodoCard"
import { NotesCard } from "@/components/cards/NotesCard"
import ScheduleCard from "@/components/cards/ScheduleCard"
import CalorieCard from "@/components/cards/CalorieCard"
import MedicineCard from "@/components/cards/MedicineCard"

interface CardRendererProps {
  card: CardData
}

export function CardRenderer({ card }: CardRendererProps) {
  switch (card.type) {
    case "clock":
      return <ClockCard cardId={card.id} />
    case "timer":
      return <TimerCard cardId={card.id} />
    case "todo":
      return <TodoCard cardId={card.id} />
    case "notes":
      return <NotesCard cardId={card.id} />
    case "schedule":
      return <ScheduleCard cardId={card.id} />
    case "calories":
      return <CalorieCard cardId={card.id} />
    case "medicines":
      return <MedicineCard cardId={card.id} />
    default:
      return (
        <div className="flex h-full items-center justify-center p-4 text-muted-foreground">
          <span className="text-xs">Unknown card type</span>
        </div>
      )
  }
}
