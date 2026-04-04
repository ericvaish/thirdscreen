"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Pin,
  PinOff,
  Plus,
  Trash2,
  ExternalLink,
  Link as LinkIcon,
  LayoutList,
  LayoutGrid,
  ArrowLeft,
  StickyNote,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { NoteItem } from "@/lib/types"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { ZoneLabel } from "@/components/dashboard/ZoneLabel"
import {
  listNotes,
  createNote,
  updateNote as updateNoteApi,
  deleteNote as deleteNoteApi,
  listLinks,
  createLink,
} from "@/lib/data-layer"
import { useDataFetch } from "@/lib/use-data-fetch"

interface LinkItem {
  id: string
  cardId: string
  url: string
  title: string | null
  pinned: boolean
  createdAt: string
}

const CARD_ID = "notes-1"

type NotesView = "list" | "grid"

export function NotesZone() {
  const { editMode } = useDashboard()
  const { data: notes = [], setData: setNotes, refetch: refetchNotes } = useDataFetch(
    () => listNotes() as Promise<NoteItem[]>,
    []
  )
  const { data: links = [], setData: setLinks, refetch: refetchLinks } = useDataFetch(
    () => listLinks() as Promise<LinkItem[]>,
    []
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [viewMode, setViewMode] = useState<NotesView>("list")
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem("notes-view-mode") as NotesView | null
    if (stored === "list" || stored === "grid") setViewMode(stored)
  }, [])

  // ── Actions ─────────────────────────────────────────────────────────────

  const addNote = async () => {
    try {
      const created = (await createNote({
        cardId: CARD_ID,
        content: "",
      })) as NoteItem
      setNotes((prev) => [created, ...(prev ?? [])])
      setSelectedId(created.id)
      setEditContent("")
    } catch {
      toast.error("Failed to create note")
    }
  }

  const saveNote = useCallback(async (id: string, content: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateNoteApi({ id, content })
        setNotes((prev) =>
          (prev ?? []).map((n) => (n.id === id ? { ...n, content } : n)),
        )
      } catch {}
    }, 400)
  }, [])

  const togglePin = async (note: NoteItem) => {
    setNotes((prev) =>
      (prev ?? []).map((n) =>
        n.id === note.id ? { ...n, pinned: !n.pinned } : n,
      ),
    )
    try {
      await updateNoteApi({ id: note.id, pinned: !note.pinned })
    } catch {
      refetchNotes()
    }
  }

  const deleteNote = async (id: string) => {
    setNotes((prev) => (prev ?? []).filter((n) => n.id !== id))
    if (selectedId === id) setSelectedId(null)
    try {
      await deleteNoteApi(id)
    } catch {
      refetchNotes()
    }
  }

  const addLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    const url = form.get("url") as string
    if (!url) return

    try {
      await createLink({ cardId: CARD_ID, url })
      refetchLinks()
      formEl.reset()
    } catch {
      toast.error("Failed to save link")
    }
  }

  const handleViewChange = (mode: NotesView) => {
    setViewMode(mode)
    localStorage.setItem("notes-view-mode", mode)
  }

  // Sort: pinned first, then by date
  const sorted = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return (
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  })

  const selectedNote = selectedId
    ? notes.find((n) => n.id === selectedId) ?? null
    : null

  // If a note is selected, show the editor view
  if (selectedNote) {
    return (
      <div className="zone-surface zone-notes flex h-full flex-col">
        {/* Editor header */}
        <div
          className={`flex shrink-0 items-center justify-between px-3 py-1.5 ${editMode ? "zone-drag-handle" : ""}`}
        >
          <div className="flex items-center gap-1.5">
            <ZoneDragHandle />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setSelectedId(null)}
              className="text-muted-foreground/50 hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <span
              className="font-[family-name:var(--font-display)] text-xs font-bold tracking-tight"
              style={{ color: "var(--zone-notes-accent)" }}
            >
              {selectedNote.content?.split("\n")[0]?.slice(0, 30) ||
                "Untitled"}
            </span>
          </div>
          <div className="flex items-center">
            <button
              onClick={() => togglePin(selectedNote)}
              className="flex size-11 items-center justify-center text-muted-foreground/30 transition-colors hover:text-primary"
            >
              {selectedNote.pinned ? (
                <Pin className="size-3.5 text-primary" />
              ) : (
                <PinOff className="size-3.5" />
              )}
            </button>
            <button
              onClick={() => deleteNote(selectedNote.id)}
              className="flex size-11 items-center justify-center text-muted-foreground/30 transition-colors hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="min-h-0 flex-1 px-4 pb-2">
          <Textarea
            autoFocus
            value={editContent}
            onChange={(e) => {
              setEditContent(e.target.value)
              saveNote(selectedNote.id, e.target.value)
            }}
            className="h-full min-h-full resize-none rounded-none border-none bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
            placeholder="Write something..."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="zone-surface zone-notes flex h-full flex-col">
      {/* Header */}
      <div
        className={`flex shrink-0 items-center justify-between px-3 py-1.5 ${editMode ? "zone-drag-handle" : ""}`}
      >
        <div className="flex items-center gap-2">
          <ZoneDragHandle />
          <ZoneLabel accentVar="--zone-notes-accent" icon={<StickyNote className="size-4" />}>
            Notes
          </ZoneLabel>
        </div>
        <div className="flex items-center gap-0.5">
          {/* View toggle */}
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon-xs"
            onClick={() => handleViewChange("list")}
            className={
              viewMode === "list"
                ? "text-foreground"
                : "text-muted-foreground/30"
            }
            title="List view"
          >
            <LayoutList className="size-3.5" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon-xs"
            onClick={() => handleViewChange("grid")}
            className={
              viewMode === "grid"
                ? "text-foreground"
                : "text-muted-foreground/30"
            }
            title="Card view"
          >
            <LayoutGrid className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={addNote}
            className="text-muted-foreground/50 hover:text-foreground"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sorted.length === 0 && links.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground/40">No notes yet</p>
          </div>
        ) : viewMode === "list" ? (
          /* ── List view ──────────────────────────────────────────── */
          <div className="divide-y divide-border/10">
            {sorted.map((note) => (
              <div
                key={note.id}
                className="group flex items-center gap-1 px-4 py-1 transition-colors hover:bg-foreground/[0.02]"
              >
                <button
                  className="min-h-11 flex-1 cursor-pointer text-left flex items-center"
                  onClick={() => {
                    setSelectedId(note.id)
                    setEditContent(note.content)
                  }}
                >
                  <p
                    className={cn(
                      "line-clamp-1 text-xs",
                      !note.content && "text-muted-foreground/40 italic",
                    )}
                  >
                    {note.content || "Empty note"}
                  </p>
                </button>
                <div className="flex shrink-0 items-center">
                  <button
                    onClick={() => togglePin(note)}
                    className="flex size-11 items-center justify-center text-muted-foreground/30 transition-colors hover:text-primary"
                  >
                    {note.pinned ? (
                      <Pin className="size-2.5 text-primary" />
                    ) : (
                      <PinOff className="size-2.5 text-muted-foreground/30" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="flex size-11 items-center justify-center text-muted-foreground/30 transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-2.5" />
                  </button>
                </div>
              </div>
            ))}

            {/* Links */}
            {links.length > 0 &&
              links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-h-11 items-center gap-2 px-4 py-1.5 text-xs transition-colors hover:bg-foreground/[0.02]"
                >
                  <LinkIcon className="size-3 shrink-0 text-muted-foreground/40" />
                  <span className="min-w-0 flex-1 truncate">
                    {link.title || new URL(link.url).hostname}
                  </span>
                  <ExternalLink className="size-2.5 shrink-0 text-muted-foreground/30 group-hover:text-primary" />
                </a>
              ))}
          </div>
        ) : (
          /* ── Grid/card view ─────────────────────────────────────── */
          <div className="grid grid-cols-2 gap-2 p-3">
            {sorted.map((note) => (
              <div
                key={note.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedId(note.id)
                  setEditContent(note.content)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setSelectedId(note.id)
                    setEditContent(note.content)
                  }
                }}
                className={cn(
                  "group relative flex cursor-pointer flex-col rounded-lg border p-3 text-left transition-all hover:border-border/40 hover:bg-foreground/[0.02]",
                  note.pinned
                    ? "border-primary/20 bg-primary/[0.03]"
                    : "border-border/15",
                )}
              >
                {/* Pin indicator */}
                {note.pinned && (
                  <Pin className="absolute top-2 right-2 size-2.5 text-primary/50" />
                )}
                {/* Title -- first line */}
                <p className="line-clamp-1 text-[0.6875rem] font-semibold text-foreground/80">
                  {note.content?.split("\n")[0] || "Untitled"}
                </p>
                {/* Preview -- remaining lines */}
                <p className="mt-1 line-clamp-3 text-[0.625rem] leading-relaxed text-muted-foreground/50">
                  {note.content?.split("\n").slice(1).join("\n") ||
                    "No content"}
                </p>
                {/* Footer */}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="font-mono text-[0.5rem] text-muted-foreground/30">
                    {new Date(note.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNote(note.id)
                    }}
                    className="flex size-11 items-center justify-center text-muted-foreground/20 transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add link - pinned to bottom */}
      <form
        onSubmit={addLink}
        className="shrink-0 border-t border-border/20 px-3 py-1.5"
      >
        <div className="flex items-center gap-2">
          <LinkIcon className="size-3 shrink-0 text-muted-foreground/40" />
          <Input
            name="url"
            placeholder="Paste a link..."
            className="h-11 rounded-none border-none bg-transparent px-0 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
      </form>
    </div>
  )
}
