/**
 * AI Tool Definitions
 *
 * Tools that allow the AI model to interact with the Third Screen dashboard.
 * Each tool maps to an existing data layer function.
 *
 * Both wllama and node-llama-cpp use these definitions (in slightly different
 * formats), so we define them once here and adapt per engine.
 */

import type { AIToolDefinition, AIToolCall } from "./types"
import * as dl from "../data-layer"
import { startTimerGlobal } from "../countdown-timer"

// ── Tool Definitions (OpenAI-compatible format) ──────────────────────────────

export const AI_TOOLS: AIToolDefinition[] = [
  // ── Todos ────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "list_todos",
      description:
        "List all tasks/todos on the dashboard. Returns an array of todo items with their completion status.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_todo",
      description:
        "Create a new task/todo item on the dashboard.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The task title/description",
          },
          scheduledDate: {
            type: "string",
            description:
              "Optional date to schedule the task (YYYY-MM-DD format)",
          },
          scheduledTime: {
            type: "string",
            description: "Optional time to schedule the task (HH:MM format)",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_todo",
      description:
        "Mark a todo item as completed by its ID.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The todo item ID" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_todo",
      description: "Delete a todo item by its ID.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The todo item ID" },
        },
        required: ["id"],
      },
    },
  },

  // ── Notes ────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "list_notes",
      description:
        "List all notes on the dashboard. Returns note content and metadata.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Create a new note on the dashboard.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "The note content/text",
          },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_note",
      description: "Delete a note by its ID.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The note ID" },
        },
        required: ["id"],
      },
    },
  },

  // ── Schedule ─────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "list_schedule",
      description:
        "List all scheduled events for a given date. Returns events with times, titles, and locations.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description:
              "The date to list events for (YYYY-MM-DD format). Defaults to today.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event",
      description:
        "Create a new calendar event / schedule entry.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event title" },
          date: {
            type: "string",
            description: "Event date (YYYY-MM-DD)",
          },
          startTime: {
            type: "string",
            description: "Start time (HH:MM format, 24hr)",
          },
          endTime: {
            type: "string",
            description: "End time (HH:MM format, 24hr)",
          },
          location: {
            type: "string",
            description: "Optional event location",
          },
          description: {
            type: "string",
            description: "Optional event description",
          },
          allDay: {
            type: "string",
            description: "Whether this is an all-day event (true/false)",
            enum: ["true", "false"],
          },
        },
        required: ["title", "date", "startTime", "endTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_event",
      description: "Delete a scheduled event by its ID.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The event ID" },
        },
        required: ["id"],
      },
    },
  },

  // ── Calories / Food ──────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "list_food",
      description:
        "List all food items logged for a given date with calorie counts.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description:
              "The date to list food for (YYYY-MM-DD). Defaults to today.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_food",
      description: "Log a food item with its calorie count.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Food name" },
          calories: {
            type: "string",
            description: "Calorie count (number)",
          },
        },
        required: ["name", "calories"],
      },
    },
  },

  // ── Water ────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_water",
      description:
        "Get the current water intake for today in milliliters.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_water",
      description:
        "Set the water intake for today. Pass the total amount in milliliters.",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "string",
            description: "Total water intake in milliliters (number)",
          },
        },
        required: ["amount"],
      },
    },
  },

  // ── Medicines ────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "list_medicines",
      description:
        "List all medicines with their dosages and schedules.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_medicine",
      description: "Add a new medicine to track.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Medicine name" },
          dosage: {
            type: "string",
            description: "Dosage info (e.g. '500mg', '1 tablet')",
          },
          times: {
            type: "string",
            description:
              'JSON array of time objects, e.g. [{"hour":8,"minute":0,"id":"morning"}]',
          },
        },
        required: ["name"],
      },
    },
  },

  // ── Habits ───────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "list_habits",
      description: "List all habits and their completion status for today.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_habit",
      description:
        "Toggle a habit's completion status for today.",
      parameters: {
        type: "object",
        properties: {
          habitId: { type: "string", description: "The habit ID" },
        },
        required: ["habitId"],
      },
    },
  },

  // ── Timer ────────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "start_timer",
      description:
        "Start a countdown timer. When it finishes, a notification will be shown. Use this when the user asks to set a timer, reminder, or countdown.",
      parameters: {
        type: "object",
        properties: {
          minutes: {
            type: "string",
            description: "Duration in minutes (number). For example, '5' for 5 minutes.",
          },
          label: {
            type: "string",
            description: "Optional label for the timer (e.g. 'Tea', 'Break').",
          },
        },
        required: ["minutes"],
      },
    },
  },

  // ── Dashboard Info ───────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_today",
      description:
        "Get today's date and current time. Use this to answer time-related questions.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
]

// ── Tool Execution ───────────────────────────────────────────────────────────

/**
 * Execute a tool call by dispatching to the appropriate data layer function.
 * Returns a JSON string result.
 */
export async function executeTool(toolCall: AIToolCall): Promise<string> {
  const { name, arguments: argsStr } = toolCall.function
  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(argsStr)
  } catch {
    return JSON.stringify({ error: `Invalid JSON arguments: ${argsStr}` })
  }

  const today = new Date().toISOString().split("T")[0]

  try {
    switch (name) {
      // Todos
      case "list_todos": {
        const todos = await dl.listTodos()
        return JSON.stringify(todos)
      }
      case "create_todo": {
        // Find any existing todo card to attach to, or use a default cardId
        const cardId = await getDefaultCardId("todo")
        const result = await dl.createTodo({
          cardId,
          title: args.title as string,
          scheduledDate: (args.scheduledDate as string) || undefined,
          scheduledTime: (args.scheduledTime as string) || undefined,
        })
        return JSON.stringify(result)
      }
      case "complete_todo": {
        const result = await dl.updateTodo({
          id: args.id as string,
          completed: true,
        })
        return JSON.stringify(result)
      }
      case "delete_todo": {
        await dl.deleteTodo(args.id as string)
        return JSON.stringify({ success: true })
      }

      // Notes
      case "list_notes": {
        const notes = await dl.listNotes()
        return JSON.stringify(notes)
      }
      case "create_note": {
        const cardId = await getDefaultCardId("notes")
        const result = await dl.createNote({
          cardId,
          content: args.content as string,
        })
        return JSON.stringify(result)
      }
      case "delete_note": {
        await dl.deleteNote(args.id as string)
        return JSON.stringify({ success: true })
      }

      // Schedule
      case "list_schedule": {
        const date = (args.date as string) || today
        const events = await dl.listScheduleEvents(date)
        return JSON.stringify(events)
      }
      case "create_event": {
        const cardId = await getDefaultCardId("schedule")
        const result = await dl.createScheduleEvent({
          cardId,
          title: args.title as string,
          date: args.date as string,
          startTime: args.startTime as string,
          endTime: args.endTime as string,
          location: (args.location as string) || undefined,
          description: (args.description as string) || undefined,
          allDay: args.allDay === "true",
        })
        return JSON.stringify(result)
      }
      case "delete_event": {
        await dl.deleteScheduleEvent(args.id as string)
        return JSON.stringify({ success: true })
      }

      // Food / Calories
      case "list_food": {
        const date = (args.date as string) || today
        const items = await dl.listFoodItems(date)
        return JSON.stringify(items)
      }
      case "log_food": {
        const cardId = await getDefaultCardId("calories")
        const result = await dl.createFoodItem({
          cardId,
          name: args.name as string,
          calories: parseInt(args.calories as string, 10) || 0,
          date: today,
        })
        return JSON.stringify(result)
      }

      // Water
      case "get_water": {
        const water = await dl.getWater(today)
        return JSON.stringify(water)
      }
      case "log_water": {
        const cardId = await getDefaultCardId("calories")
        const result = await dl.upsertWater({
          cardId,
          date: today,
          intake: parseInt(args.amount as string, 10) || 0,
        })
        return JSON.stringify(result)
      }

      // Medicines
      case "list_medicines": {
        const meds = await dl.listMedicines()
        return JSON.stringify(meds)
      }
      case "create_medicine": {
        const cardId = await getDefaultCardId("medicines")
        let times: { hour: number; minute: number; id: string }[] = []
        if (args.times) {
          try {
            times = JSON.parse(args.times as string)
          } catch {
            times = [{ hour: 8, minute: 0, id: "default" }]
          }
        }
        const result = await dl.createMedicine({
          cardId,
          name: args.name as string,
          dosage: (args.dosage as string) || undefined,
          times,
        })
        return JSON.stringify(result)
      }

      // Habits
      case "list_habits": {
        const data = await dl.listHabits(today, today)
        return JSON.stringify(data)
      }
      case "toggle_habit": {
        const result = await dl.toggleHabitLog(
          args.habitId as string,
          today,
        )
        return JSON.stringify(result)
      }

      // Timer
      case "start_timer": {
        const minutes = parseInt(args.minutes as string, 10)
        if (isNaN(minutes) || minutes <= 0) {
          return JSON.stringify({ error: "Invalid duration. Please specify a positive number of minutes." })
        }
        const label = (args.label as string) || `${minutes} min timer`
        const seconds = minutes * 60

        const started = startTimerGlobal(seconds, label)
        if (!started) {
          return JSON.stringify({ error: "Timer widget is not available. Please enable the Countdown Timer widget in the status bar." })
        }

        const endTime = new Date(Date.now() + seconds * 1000).toLocaleTimeString()
        return JSON.stringify({
          success: true,
          duration: `${minutes} minute${minutes > 1 ? "s" : ""}`,
          label,
          endsAt: endTime,
        })
      }

      // Dashboard info
      case "get_today": {
        return JSON.stringify({
          date: today,
          time: new Date().toLocaleTimeString(),
          dayOfWeek: new Date().toLocaleDateString("en-US", {
            weekday: "long",
          }),
        })
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err) {
    return JSON.stringify({
      error: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
    })
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get a default card ID for a given card type.
 * The AI needs a cardId to create items. We find the first card of the matching type.
 */
async function getDefaultCardId(
  type: "todo" | "notes" | "schedule" | "calories" | "medicines",
): Promise<string> {
  // Try to get from localStorage or settings
  const key = `ts_default_card_${type}`
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem(key)
    if (cached) return cached
  }

  // Fallback: use a well-known default card ID convention
  // The data layer and local-store use "default-{type}" pattern
  return `default-${type}`
}

// ── System Prompt ────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are the Third Screen AI assistant, embedded in a personal dashboard app. You help the user manage their day by interacting with their dashboard data.

You have access to tools that let you:
- View and manage tasks/todos
- Read and create notes
- View and create calendar events
- Log food and water intake
- View and add medicines
- View and toggle habits
- Start countdown timers

When the user asks you to do something on their dashboard, use the appropriate tool. When they ask a question about their data, fetch it first using the relevant list/get tool, then answer based on the results.

Be concise and helpful. This is a glanceable dashboard -- the user wants quick answers, not essays. When you create or modify something, confirm what you did in one short sentence.

Always use get_today to check the current date/time when the user asks about "today", "now", or relative dates.`
