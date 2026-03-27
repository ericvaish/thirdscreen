"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  CheckSquare,
  Plus,
  X,
  Calendar as CalendarIcon,
  Clock,
  ListChecks,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import type { TodoItem } from "@/lib/types"

interface TodoCardProps {
  cardId: string
}

export function TodoCard({ cardId }: TodoCardProps) {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [newTitle, setNewTitle] = useState("")
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch(`/api/todos?cardId=${cardId}`)
      if (res.ok) {
        const data: TodoItem[] = await res.json()
        setTodos(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [cardId])

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  const sortedTodos = [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return a.sortOrder - b.sortOrder
  })

  const addTodo = async () => {
    const title = newTitle.trim()
    if (!title) return

    setNewTitle("")

    const tempId = `temp-${Date.now()}`
    const tempTodo: TodoItem = {
      id: tempId,
      cardId,
      title,
      completed: false,
      scheduledDate: null,
      scheduledTime: null,
      duration: null,
      sortOrder: todos.length,
      createdAt: new Date().toISOString(),
    }
    setTodos((prev) => [...prev, tempTodo])

    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, title }),
      })
      if (res.ok) {
        const created: TodoItem = await res.json()
        setTodos((prev) => prev.map((t) => (t.id === tempId ? created : t)))
      } else {
        setTodos((prev) => prev.filter((t) => t.id !== tempId))
      }
    } catch {
      setTodos((prev) => prev.filter((t) => t.id !== tempId))
    }

    inputRef.current?.focus()
  }

  const toggleTodo = async (id: string, completed: boolean) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed } : t))
    )

    try {
      const res = await fetch("/api/todos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, completed }),
      })
      if (!res.ok) {
        setTodos((prev) =>
          prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t))
        )
      }
    } catch {
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t))
      )
    }
  }

  const deleteTodo = async (id: string) => {
    const previous = todos
    setTodos((prev) => prev.filter((t) => t.id !== id))

    try {
      const res = await fetch(`/api/todos?id=${id}`, { method: "DELETE" })
      if (!res.ok) {
        setTodos(previous)
      }
    } catch {
      setTodos(previous)
    }
  }

  const updateTodoField = async (
    id: string,
    field: "scheduledDate" | "duration",
    value: string | number | null
  ) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    )

    try {
      await fetch("/api/todos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: value }),
      })
    } catch {
      // silently fail, local state already updated
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-muted-foreground">
        <span className="text-xs animate-pulse">Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Add todo input */}
      <div className="flex items-center gap-1.5 border-b border-border/40 px-3 py-2">
        <Input
          ref={inputRef}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTodo()
          }}
          placeholder="Add a task..."
          className="h-7 border-none bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
        />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={addTodo}
          disabled={!newTitle.trim()}
          className="shrink-0 text-muted-foreground hover:text-amber-400"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {/* Todo list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sortedTodos.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
            <ListChecks className="size-8 opacity-20" />
            <span className="text-xs text-muted-foreground/40">No tasks yet</span>
          </div>
        ) : (
          <ul className="divide-y divide-border/20">
            {sortedTodos.map((todo) => (
              <li
                key={todo.id}
                className="group relative transition-colors hover:bg-muted/20"
              >
                <div className="flex items-start gap-2.5 px-3 py-2">
                  <Checkbox
                    checked={todo.completed}
                    onCheckedChange={(checked) =>
                      toggleTodo(todo.id, checked === true)
                    }
                    className="mt-0.5 shrink-0"
                  />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() =>
                      setExpandedId(expandedId === todo.id ? null : todo.id)
                    }
                  >
                    <span
                      className={`block text-sm leading-snug transition-all ${
                        todo.completed
                          ? "text-muted-foreground/40 line-through"
                          : "text-foreground"
                      }`}
                    >
                      {todo.title}
                    </span>
                    {(todo.scheduledDate || todo.duration) && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {todo.scheduledDate && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-400/70">
                            <CalendarIcon className="size-2.5" />
                            {todo.scheduledDate}
                          </span>
                        )}
                        {todo.duration && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-1.5 py-0.5 font-mono text-[10px] text-blue-400/70">
                            <Clock className="size-2.5" />
                            {todo.duration}m
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => deleteTodo(todo.id)}
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive"
                  >
                    <X className="size-3" />
                  </Button>
                </div>

                {expandedId === todo.id && (
                  <div className="flex items-center gap-2 border-t border-border/20 bg-muted/20 px-3 py-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <CalendarIcon className="size-3" />
                      <input
                        type="date"
                        value={todo.scheduledDate ?? ""}
                        onChange={(e) =>
                          updateTodoField(
                            todo.id,
                            "scheduledDate",
                            e.target.value || null
                          )
                        }
                        className="h-5 rounded border border-border/50 bg-transparent px-1 text-[10px] text-foreground"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Clock className="size-3" />
                      <input
                        type="number"
                        min={0}
                        placeholder="min"
                        value={todo.duration ?? ""}
                        onChange={(e) =>
                          updateTodoField(
                            todo.id,
                            "duration",
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        className="h-5 w-14 rounded border border-border/50 bg-transparent px-1 text-[10px] text-foreground"
                      />
                    </label>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
