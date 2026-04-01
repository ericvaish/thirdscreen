"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Circle, Plus, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { TodoItem } from "@/lib/types"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { listTodos, createTodo, updateTodo as updateTodoApi, deleteTodo as deleteTodoApi } from "@/lib/data-layer"
import { useMascot } from "@/lib/mascot"

const CARD_ID = "todo-1"

export function TasksZone() {
  const { editMode } = useDashboard()
  const { trigger: mascotTrigger } = useMascot()
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [newTitle, setNewTitle] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchTodos = useCallback(async () => {
    try {
      const data = await listTodos() as TodoItem[]
      setTodos(data)
    } catch {}
  }, [])

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  const addTodo = async () => {
    const title = newTitle.trim()
    if (!title) return

    setNewTitle("")
    try {
      await createTodo({ cardId: CARD_ID, title })
      fetchTodos()
    } catch {
      toast.error("Failed to add task")
    }
  }

  const toggleTodo = async (todo: TodoItem) => {
    // Optimistic
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id ? { ...t, completed: !t.completed } : t
      )
    )
    try {
      await updateTodoApi({ id: todo.id, completed: !todo.completed })
      if (!todo.completed) mascotTrigger("task_done")
    } catch {
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todo.id ? { ...t, completed: todo.completed } : t
        )
      )
    }
  }

  const deleteTodo = async (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id))
    try {
      await deleteTodoApi(id)
    } catch {
      fetchTodos()
    }
  }

  // Sort: active first, then by sortOrder
  const sorted = [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return a.sortOrder - b.sortOrder
  })

  const active = sorted.filter((t) => !t.completed)
  const completed = sorted.filter((t) => t.completed)

  return (
    <div className="zone-surface zone-tasks flex h-full flex-col">
      {/* Header */}
      <div className={`flex shrink-0 items-center justify-between px-4 py-1.5 ${editMode ? "zone-drag-handle" : ""}`}>
        <div className="flex items-center gap-1.5">
          <ZoneDragHandle />
          <div className="h-5 w-[3px] rounded-full" style={{ background: "var(--zone-tasks-accent)" }} />
          <span className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight" style={{ color: "var(--zone-tasks-accent)" }}>
            Tasks
          </span>
          {active.length > 0 && (
            <span className="rounded-full bg-[var(--zone-tasks-accent)]/15 px-1.5 py-0.5 font-mono text-xs font-bold text-[var(--zone-tasks-accent)]">
              {active.length}
            </span>
          )}
        </div>
      </div>

      {/* Add task */}
      <div className="shrink-0 border-b border-border/20 px-3 py-2">
        <div className="flex items-center gap-2">
          <Plus className="size-3 shrink-0 text-muted-foreground/40" />
          <Input
            ref={inputRef}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTodo()}
            placeholder="Add a task..."
            className="h-11 rounded-none border-none bg-transparent px-0 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
      </div>

      {/* Task list - only this scrolls */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground/40">No tasks yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {active.map((todo) => (
              <TaskRow
                key={todo.id}
                todo={todo}
                onToggle={toggleTodo}
                onDelete={deleteTodo}
              />
            ))}
            {completed.length > 0 && (
              <>
                <div className="px-4 py-1.5">
                  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground/40">
                    Completed ({completed.length})
                  </span>
                </div>
                {completed.map((todo) => (
                  <TaskRow
                    key={todo.id}
                    todo={todo}
                    onToggle={toggleTodo}
                    onDelete={deleteTodo}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskRow({
  todo,
  onToggle,
  onDelete,
}: {
  todo: TodoItem
  onToggle: (t: TodoItem) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="group flex min-h-11 items-center gap-2.5 px-4 py-2 transition-colors hover:bg-foreground/[0.03]">
      <button
        onClick={() => onToggle(todo)}
        className="flex size-11 shrink-0 items-center justify-center transition-all"
      >
        {todo.completed ? (
          <div className="flex size-4 items-center justify-center rounded" style={{ background: "var(--zone-tasks-accent)" }}>
            <Check className="size-2.5 text-white" />
          </div>
        ) : (
          <div className="size-4 rounded border border-[var(--zone-tasks-accent)]/60" />
        )}
      </button>
      <span
        className={cn(
          "min-w-0 flex-1 text-xs",
          todo.completed && "text-muted-foreground/40 line-through"
        )}
      >
        {todo.title}
      </span>
      {todo.scheduledDate && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground/40">
          {todo.scheduledDate}
        </span>
      )}
      <button
        onClick={() => onDelete(todo.id)}
        className="flex size-11 shrink-0 items-center justify-center"
      >
        <Trash2 className="size-3 text-muted-foreground/30 hover:text-destructive" />
      </button>
    </div>
  )
}
