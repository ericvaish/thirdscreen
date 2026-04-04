import type { IntegrationDef, ZoneType } from "./types"

export const INTEGRATION_REGISTRY: IntegrationDef[] = [
  // ── Timeline zone · Calendar sources ────────────────────────────────────
  {
    id: "local-calendar",
    name: "Local Calendar",
    description: "Built-in schedule and events",
    icon: "CalendarDays",
    zone: "timeline",
    category: "Calendar",
    builtIn: true,
    defaultEnabled: true,
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Sync events from Google Calendar",
    icon: "CalendarDays",
    zone: "timeline",
    category: "Calendar",
    builtIn: false,
    defaultEnabled: false,
    implemented: true,
  },
  {
    id: "outlook-calendar",
    name: "Outlook Calendar",
    description: "Sync events from Microsoft Outlook",
    icon: "CalendarDays",
    zone: "timeline",
    category: "Calendar",
    builtIn: false,
    defaultEnabled: false,
  },
  {
    id: "apple-calendar",
    name: "Apple Calendar",
    description: "Sync events from iCloud Calendar",
    icon: "CalendarDays",
    zone: "timeline",
    category: "Calendar",
    builtIn: false,
    defaultEnabled: false,
  },

  // ── Vitals zone · Health sources ────────────────────────────────────────
  {
    id: "local-calories",
    name: "Calorie Tracker",
    description: "Track daily food intake and calories",
    icon: "Flame",
    zone: "vitals",
    category: "Health",
    builtIn: true,
    defaultEnabled: true,
  },
  {
    id: "local-water",
    name: "Water Tracker",
    description: "Track daily water intake",
    icon: "Droplets",
    zone: "vitals",
    category: "Health",
    builtIn: true,
    defaultEnabled: true,
  },
  {
    id: "local-medicines",
    name: "Medicine Tracker",
    description: "Track medication doses and reminders",
    icon: "Pill",
    zone: "vitals",
    category: "Health",
    builtIn: true,
    defaultEnabled: true,
  },

  // ── Tasks zone · Productivity sources ───────────────────────────────────
  {
    id: "local-todos",
    name: "Tasks",
    description: "Built-in to-do list",
    icon: "ListChecks",
    zone: "tasks",
    category: "Productivity",
    builtIn: true,
    defaultEnabled: true,
  },
  {
    id: "apple-reminders",
    name: "Apple Reminders",
    description: "Sync tasks from Apple Reminders",
    icon: "Bell",
    zone: "tasks",
    category: "Productivity",
    builtIn: false,
    defaultEnabled: false,
  },
  {
    id: "github-issues",
    name: "GitHub Issues",
    description: "Sync assigned issues from GitHub",
    icon: "Github",
    zone: "tasks",
    category: "Productivity",
    builtIn: false,
    defaultEnabled: false,
  },

  // ── Notes zone ──────────────────────────────────────────────────────────
  {
    id: "local-notes",
    name: "Quick Notes",
    description: "Built-in note taking and bookmarks",
    icon: "StickyNote",
    zone: "notes",
    category: "Notes",
    builtIn: true,
    defaultEnabled: true,
  },

  // ── Status zone · Communication ──────────────────────────────────────────
  {
    id: "gmail",
    name: "Gmail",
    description: "Unread email notifications from Gmail",
    icon: "Mail",
    zone: "status",
    category: "Communication",
    builtIn: false,
    defaultEnabled: false,
    implemented: true,
  },
  {
    id: "google-chat",
    name: "Google Chat",
    description: "New message notifications from Google Chat",
    icon: "MessageSquare",
    zone: "status",
    category: "Communication",
    builtIn: false,
    defaultEnabled: false,
    implemented: true,
  },

  // ── Status zone · Utilities & media ─────────────────────────────────────
  {
    id: "local-clock",
    name: "Clock",
    description: "Current time and date display",
    icon: "Clock",
    zone: "status",
    category: "Utilities",
    builtIn: true,
    defaultEnabled: true,
  },
  {
    id: "local-timer",
    name: "Timer",
    description: "Countdown timer and stopwatch",
    icon: "Timer",
    zone: "status",
    category: "Utilities",
    builtIn: true,
    defaultEnabled: true,
  },
  {
    id: "weather",
    name: "Weather",
    description: "Current conditions, temperature, and forecast",
    icon: "CloudSun",
    zone: "status",
    category: "Utilities",
    builtIn: true,
    defaultEnabled: true,
  },
  {
    id: "pomodoro",
    name: "Pomodoro",
    description: "Focus timer with work/break cycles",
    icon: "CircleDot",
    zone: "status",
    category: "Utilities",
    builtIn: true,
    defaultEnabled: true,
  },
  {
    id: "air-quality",
    name: "Air Quality",
    description: "AQI index and pollutant levels for your area",
    icon: "Wind",
    zone: "status",
    category: "Utilities",
    builtIn: true,
    defaultEnabled: true,
  },
  {
    id: "spotify",
    name: "Spotify",
    description: "Now playing from Spotify",
    icon: "Music",
    zone: "status",
    category: "Media",
    builtIn: false,
    defaultEnabled: false,
    implemented: true,
  },
  {
    id: "apple-music",
    name: "Apple Music",
    description: "Now playing from Apple Music",
    icon: "Music",
    zone: "status",
    category: "Media",
    builtIn: false,
    defaultEnabled: false,
  },

  // ── Smart Home zone · Device control ──────���─────────────────────────────
  {
    id: "home-assistant",
    name: "Home Assistant",
    description: "Control lights, switches, and devices via Home Assistant",
    icon: "Home",
    zone: "smarthome",
    category: "Smart Home",
    builtIn: false,
    defaultEnabled: false,
    implemented: true,
  },
]

export function getIntegrationsByZone(zone: ZoneType): IntegrationDef[] {
  return INTEGRATION_REGISTRY.filter((i) => i.zone === zone)
}

export function getIntegrationById(id: string): IntegrationDef | undefined {
  return INTEGRATION_REGISTRY.find((i) => i.id === id)
}

export function getIntegrationsByCategory(): Map<string, IntegrationDef[]> {
  const map = new Map<string, IntegrationDef[]>()
  for (const integration of INTEGRATION_REGISTRY) {
    const list = map.get(integration.category) ?? []
    list.push(integration)
    map.set(integration.category, list)
  }
  return map
}
