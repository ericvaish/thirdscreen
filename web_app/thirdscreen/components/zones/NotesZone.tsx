"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Pin,
  PinOff,
  Plus,
  Trash2,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { NoteItem } from "@/lib/types"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { listNotes, createNote, updateNote as updateNoteApi, deleteNote as deleteNoteApi, listLinks, createLink, deleteLink as deleteLinkApi } from "@/lib/data-layer"

interface LinkItem {
  id: string
  cardId: string
  url: string
  title: string | null
  pinned: boolean
  createdAt: string
}

const CARD_ID = "notes-1"

export function NotesZone() {
  const { editMode } = useDashboard()
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [links, setLinks] = useState<LinkItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch ─────────────────────────────────────────────────────────────

  const fetchNotes = useCallback(async () => {
    try {
      const data = await listNotes() as NoteItem[]
      setNotes(data)
    } catch {}
  }, [])

  const fetchLinks = useCallback(async () => {
    try {
      const data = await listLinks() as LinkItem[]
      setLinks(data)
    } catch {}
  }, [])

  useEffect(() => {
    fetchNotes()
    fetchLinks()
  }, [fetchNotes, fetchLinks])

  // ── Actions ─────────────────────────────────────────────────────────────

  const addNote = async () => {
    try {
      const created = await createNote({ cardId: CARD_ID, content: "" }) as NoteItem
      setNotes((prev) => [created, ...prev])
      setEditingId(created.id)
      setEditContent("")
    } catch {
      toast.error("Failed to create note")
    }
  }

  const saveNote = useCallback(
    async (id: string, content: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await updateNoteApi({ id, content })
          setNotes((prev) =>
            prev.map((n) => (n.id === id ? { ...n, content } : n))
          )
        } catch {}
      }, 400)
    },
    []
  )

  const togglePin = async (note: NoteItem) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n))
    )
    try {
      await updateNoteApi({ id: note.id, pinned: !note.pinned })
    } catch {
      fetchNotes()
    }
  }

  const deleteNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    setEditingId(null)
    try {
      await deleteNoteApi(id)
    } catch {
      fetchNotes()
    }
  }

  const addLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const url = form.get("url") as string
    if (!url) return

    try {
      await createLink({ cardId: CARD_ID, url })
      fetchLinks()
      e.currentTarget.reset()
    } catch {
      toast.error("Failed to save link")
    }
  }

  // Sort: pinned first, then by date
  const sorted = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return (
    <div className="zone-surface zone-notes flex h-full flex-col">
      {/* Header */}
      <div className={`flex shrink-0 items-center justify-between px-4 py-1.5 ${editMode ? "zone-drag-handle" : ""}`}>
        <div className="flex items-center gap-2">
          <ZoneDragHandle />
          <div className="h-4 w-[3px] rounded-full" style={{ background: "var(--zone-notes-accent)" }} />
          <span className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight" style={{ color: "var(--zone-notes-accent)" }}>
            Notes
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={addNote}
          className="text-muted-foreground/50 hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {/* Scrollable content - only this div scrolls */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sorted.length === 0 && links.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground/40">No notes yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {sorted.map((note) => (
              <div
                key={note.id}
                className="group px-4 py-2 transition-colors hover:bg-foreground/[0.02]"
              >
                <div className="flex items-center gap-1">
                  {editingId === note.id ? (
                    <Textarea
                      autoFocus
                      value={editContent}
                      onChange={(e) => {
                        setEditContent(e.target.value)
                        saveNote(note.id, e.target.value)
                      }}
                      onBlur={() => setEditingId(null)}
                      className="min-h-[40px] flex-1 resize-none rounded-none border-none bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
                      placeholder="Write something..."
                    />
                  ) : (
                    <div
                      className="min-h-11 flex-1 cursor-pointer flex items-center"
                      onClick={() => {
                        setEditingId(note.id)
                        setEditContent(note.content)
                      }}
                    >
                      <p
                        className={cn(
                          "line-clamp-1 text-xs",
                          !note.content && "text-muted-foreground/40 italic"
                        )}
                      >
                        {note.content || "Empty note"}
                      </p>
                    </div>
                  )}
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
                      className="flex size-11 items-center justify-center"
                    >
                      <Trash2 className="size-2.5 text-muted-foreground/30 hover:text-destructive" />
                    </button>
                  </div>
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
        )}
      </div>

      {/* Add link - pinned to bottom, never scrolls */}
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
