// Card types available in the dashboard
export const CARD_TYPES = [
  "clock",
  "timer",
  "todo",
  "notes",
  "schedule",
  "calories",
  "medicines",
] as const

export type CardType = (typeof CARD_TYPES)[number]

// Card data as returned from the API / stored in DB
export interface CardData {
  id: string
  type: CardType
  title: string | null
  x: number
  y: number
  w: number
  h: number
  visible: boolean
  settings: Record<string, unknown> | null
  createdAt: string
}

// Payload sent when creating a card
export interface CreateCardPayload {
  type: CardType
  title?: string
  x?: number
  y?: number
  w?: number
  h?: number
  visible?: boolean
  settings?: Record<string, unknown>
}

// Payload sent when updating layout positions
export interface LayoutPosition {
  id: string
  x: number
  y: number
  w: number
  h: number
}

// Default sizes for each card type
export const DEFAULT_CARD_SIZES: Record<CardType, { w: number; h: number }> = {
  clock: { w: 3, h: 3 },
  timer: { w: 3, h: 3 },
  todo: { w: 4, h: 5 },
  notes: { w: 4, h: 5 },
  schedule: { w: 5, h: 5 },
  calories: { w: 4, h: 4 },
  medicines: { w: 4, h: 4 },
}

// Human-readable labels for card types
export const CARD_TYPE_LABELS: Record<CardType, string> = {
  clock: "Clock",
  timer: "Timer",
  todo: "To-Do List",
  notes: "Notes",
  schedule: "Schedule",
  calories: "Calories",
  medicines: "Medicines",
}

// ---- Per-card data models ----

export interface TodoItem {
  id: string
  cardId: string
  title: string
  completed: boolean
  scheduledDate: string | null
  scheduledTime: string | null
  duration: number | null
  sortOrder: number
  createdAt: string
}

export interface NoteItem {
  id: string
  cardId: string
  content: string
  pinned: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface MedicineItem {
  id: string
  cardId: string
  name: string
  dosage: string | null
  times: { hour: number; minute: number; id: string }[]
  repeatPattern: "daily" | "every_other_day" | "weekly" | "custom"
  activeDays: number[]
  active: boolean
  createdAt: string
}

export interface FoodItem {
  id: string
  cardId: string
  name: string
  calories: number
  date: string
  createdAt: string
}

export interface RssFeed {
  id: string
  url: string
  title: string | null
  siteUrl: string | null
  lastFetchedAt: string | null
  createdAt: string
}

export interface RssArticle {
  id: string
  feedId: string
  guid: string
  title: string
  link: string | null
  pubDate: string | null
  summary: string | null
  createdAt: string
}

export interface ScheduleEvent {
  id: string
  cardId: string
  title: string
  startTime: string
  endTime: string
  allDay: boolean
  color: string | null
  location: string | null
  description: string | null
  date: string
  createdAt: string
}
