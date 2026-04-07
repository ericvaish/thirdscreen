"use client"

import { useRef, useState } from "react"
import { Check, Circle, ListChecks, Plus, Trash2, SquareKanban, ExternalLink, CircleDot, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { TodoItem } from "@/lib/types"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { ZoneLabel } from "@/components/dashboard/ZoneLabel"
import { listTodos, createTodo, updateTodo as updateTodoApi, deleteTodo as deleteTodoApi } from "@/lib/data-layer"
import { useMascot } from "@/lib/mascot"
import { useDataFetch } from "@/lib/use-data-fetch"
import type { JiraIssue } from "@/lib/jira/service"

const CARD_ID = "todo-1"

export function TasksZone() {
  const { editMode } = useDashboard()
  const { trigger: mascotTrigger } = useMascot()
  const { data: todos = [], setData: setTodos, refetch: refetchTodos } = useDataFetch(
    () => listTodos() as Promise<TodoItem[]>,
    []
  )
  const { data: jiraIssues = [] } = useDataFetch(
    async () => {
      try {
        const res = await fetch("/api/jira?action=issues")
        if (!res.ok) return []
        return (await res.json()) as JiraIssue[]
      } catch { return [] }
    },
    []
  )
  const [newTitle, setNewTitle] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const addTodo = async () => {
    const title = newTitle.trim()
    if (!title) return

    setNewTitle("")
    try {
      await createTodo({ cardId: CARD_ID, title })
      refetchTodos()
    } catch {
      toast.error("Failed to add task")
    }
  }

  const toggleTodo = async (todo: TodoItem) => {
    // Optimistic
    setTodos((prev) =>
      (prev ?? []).map((t) =>
        t.id === todo.id ? { ...t, completed: !t.completed } : t
      )
    )
    try {
      await updateTodoApi({ id: todo.id, completed: !todo.completed })
      if (!todo.completed) mascotTrigger("task_done")
    } catch {
      setTodos((prev) =>
        (prev ?? []).map((t) =>
          t.id === todo.id ? { ...t, completed: todo.completed } : t
        )
      )
    }
  }

  const deleteTodo = async (id: string) => {
    setTodos((prev) => (prev ?? []).filter((t) => t.id !== id))
    try {
      await deleteTodoApi(id)
    } catch {
      refetchTodos()
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
          <ZoneLabel accentVar="--zone-tasks-accent" icon={<ListChecks className="size-4" />}>
            Tasks
          </ZoneLabel>
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
            {jiraIssues.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 px-4 py-1.5">
                  <SquareKanban className="size-3 text-blue-500/60" />
                  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground/40">
                    Jira ({jiraIssues.filter((i) => i.statusCategory !== "done").length})
                  </span>
                </div>
                {jiraIssues
                  .filter((i) => i.statusCategory !== "done")
                  .map((issue) => (
                    <JiraIssueRow key={issue.id} issue={issue} />
                  ))}
              </>
            )}
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
    <div className="group flex min-h-11 items-center gap-2.5 px-4 py-0 transition-colors hover:bg-foreground/[0.03]">
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

function JiraIssueRow({ issue }: { issue: JiraIssue }) {
  return (
    <div className="group flex min-h-11 items-center gap-2.5 px-4 py-0 transition-colors hover:bg-foreground/[0.03]">
      <div className="flex size-11 shrink-0 items-center justify-center">
        {issue.statusCategory === "in_progress" ? (
          <CircleDot className="size-4 text-blue-500/70" />
        ) : (
          <Circle className="size-4 text-muted-foreground/30" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-xs">{issue.summary}</span>
        <span className="ml-1.5 font-mono text-xs text-muted-foreground/40">{issue.key}</span>
      </div>
      <a
        href={issue.htmlLink}
        target="_blank"
        rel="noopener noreferrer"
        className="flex size-11 shrink-0 items-center justify-center hover-reveal"
      >
        <ExternalLink className="size-3 text-muted-foreground/30 hover:text-foreground" />
      </a>
    </div>
  )
}
