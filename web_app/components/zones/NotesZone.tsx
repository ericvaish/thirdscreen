"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { NoteItem } from "@/lib/types"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { useRegisterZoneActions, type ZoneAction } from "@/lib/zone-actions"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { ZoneLabel } from "@/components/dashboard/ZoneLabel"
import {
  listNotes,
  createNote,
  updateNote as updateNoteApi,
  deleteNote as deleteNoteApi,
  listLinks,
  createLink,
  deleteLink as deleteLinkApi,
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem("notes-view-mode") as NotesView | null
    if (stored === "list" || stored === "grid") setViewMode(stored)
  }, [])

  // ── Actions ─────────────────────────────────────────────────────────────

  const addNote = async (initialContent = "") => {
    try {
      const created = (await createNote({
        cardId: CARD_ID,
        content: initialContent,
      })) as NoteItem
      setNotes((prev) => [created, ...(prev ?? [])])
      if (initialContent === "") {
        setSelectedId(created.id)
        setEditContent("")
      }
      return created
    } catch {
      toast.error("Failed to create note")
    }
  }

  // Quick-add input at the bottom — auto-routes to addLink if the text is a URL.
  const [quickInput, setQuickInput] = useState("")
  const isLikelyUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim())
  const submitQuickInput = async () => {
    const value = quickInput.trim()
    if (!value) return
    setQuickInput("")
    if (isLikelyUrl(value)) {
      try {
        await createLink({ cardId: CARD_ID, url: value })
        refetchLinks()
      } catch {
        toast.error("Failed to save link")
      }
    } else {
      await addNote(value)
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

  // Opens the confirmation dialog. Actual deletion happens in confirmDelete.
  const deleteNote = (id: string) => {
    setPendingDeleteId(id)
  }

  const confirmDelete = async () => {
    const id = pendingDeleteId
    if (!id) return
    setPendingDeleteId(null)
    setNotes((prev) => (prev ?? []).filter((n) => n.id !== id))
    if (selectedId === id) setSelectedId(null)
    try {
      await deleteNoteApi(id)
    } catch {
      refetchNotes()
    }
  }

  const pendingDeleteNote = pendingDeleteId
    ? (notes ?? []).find((n) => n.id === pendingDeleteId) ?? null
    : null
  const pendingDeletePreview = (() => {
    if (!pendingDeleteNote) return ""
    const text = (pendingDeleteNote.content ?? "").trim()
    if (!text) return "(empty note)"
    return text.length > 80 ? text.slice(0, 80) + "…" : text
  })()


  const deleteLink = async (id: string) => {
    setLinks((prev) => prev?.filter((l) => l.id !== id))
    try {
      await deleteLinkApi(id)
    } catch {
      toast.error("Failed to delete link")
      refetchLinks()
    }
  }

  const handleViewChange = useCallback((mode: NotesView) => {
    setViewMode(mode)
    localStorage.setItem("notes-view-mode", mode)
  }, [])

  // Register the right-click context-menu actions for this zone.
  const zoneActions = useMemo<ZoneAction[]>(
    () => [
      {
        id: "add",
        label: "Add note",
        icon: <Plus className="size-3.5" />,
        onSelect: () => { addNote() },
      },
      {
        id: "view",
        label: "View",
        icon: <LayoutList className="size-3.5" />,
        options: [
          {
            id: "list",
            label: "List",
            active: viewMode === "list",
            onSelect: () => handleViewChange("list"),
          },
          {
            id: "grid",
            label: "Cards",
            active: viewMode === "grid",
            onSelect: () => handleViewChange("grid"),
          },
        ],
      },
    ],
    // addNote is stable enough; viewMode triggers rebuild for active state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewMode, handleViewChange],
  )
  useRegisterZoneActions("notes", zoneActions)

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
            <button
              onClick={() => setSelectedId(null)}
              className="ts-inner-glass flex size-9 items-center justify-center rounded-full opacity-80 transition-colors hover:opacity-100"
              title="Back to notes"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="font-[family-name:var(--font-display)] text-xs font-bold tracking-tight">
              {selectedNote.content?.split("\n")[0]?.slice(0, 30) ||
                "Untitled"}
            </span>
          </div>
          <div className="flex items-center">
            <button
              onClick={() => togglePin(selectedNote)}
              className="flex size-11 items-center justify-center rounded-full opacity-50 transition-colors hover:opacity-100"
            >
              {selectedNote.pinned ? (
                <Pin className="size-3.5" />
              ) : (
                <PinOff className="size-3.5" />
              )}
            </button>
            <button
              onClick={() => deleteNote(selectedNote.id)}
              className="flex size-11 items-center justify-center rounded-full opacity-50 transition-colors hover:text-destructive hover:opacity-100"
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
      {/* Content — scrolls under the floating quick-add bar. The pill is
          translucent (ts-inner-glass) so list items remain partially
          visible through it. scroll-padding-bottom keeps the user able
          to scroll the last row above the pill when there's more content
          than fits, without adding always-on visible padding. */}
      <div
        className="ts-always-scrollbar min-h-0 flex-1 overflow-y-auto"
        style={{ scrollPaddingBottom: "64px" }}
      >
        {sorted.length === 0 && links.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted-foreground/40">No notes yet</p>
          </div>
        ) : viewMode === "list" ? (
          /* ── List view ──────────────────────────────────────────── */
          <div className="divide-y divide-border/10 pt-1 pb-14">
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
                className="group mx-1 flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-1 py-1 transition-colors"
              >
                <div className="flex flex-1 items-center">
                  <p
                    className={cn(
                      "line-clamp-1 text-xs",
                      !note.content && "text-muted-foreground/40 italic",
                    )}
                  >
                    {note.content || "Empty note"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePin(note) }}
                    className="flex size-11 items-center justify-center rounded-full opacity-50 transition-colors hover:opacity-100"
                  >
                    {note.pinned ? (
                      <Pin className="size-2.5" />
                    ) : (
                      <PinOff className="size-2.5" />
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNote(note.id) }}
                    className="flex size-11 items-center justify-center rounded-full opacity-50 transition-colors hover:text-destructive hover:opacity-100"
                  >
                    <Trash2 className="size-2.5" />
                  </button>
                </div>
              </div>
            ))}

            {/* Links */}
            {links.length > 0 &&
              links.map((link) => (
                <div
                  key={link.id}
                  className="group mx-1 flex min-h-11 items-center gap-1 rounded-lg px-1 text-xs transition-colors"
                >
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5"
                  >
                    <LinkIcon className="size-3 shrink-0 opacity-50" />
                    <span className="min-w-0 flex-1 truncate">
                      {link.title || new URL(link.url).hostname}
                    </span>
                    <ExternalLink className="size-2.5 shrink-0 opacity-50" />
                  </a>
                  <button
                    onClick={() => deleteLink(link.id)}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full opacity-50 transition-colors hover:text-destructive hover:opacity-100"
                    title="Delete link"
                  >
                    <Trash2 className="size-2.5" />
                  </button>
                </div>
              ))}
          </div>
        ) : (
          /* ── Grid/card view ─────────────────────────────────────── */
          <div className="grid grid-cols-2 gap-2 p-3 pb-14">
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
                  "ts-inner-glass group relative flex cursor-pointer flex-col rounded-2xl p-3 text-left transition-all",
                  note.pinned && "ring-1 ring-current/30",
                )}
              >
                {/* Pin indicator */}
                {note.pinned && (
                  <Pin className="absolute top-2 right-2 size-2.5 opacity-60" />
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

      {/* Quick add — floats over the list at the bottom. Items scroll
          UNDER it. No backdrop fade; the input pill's own glass is the
          only visual separation. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end px-3 pb-2">
        <div className="pointer-events-auto flex w-full items-center gap-2">
          <div className="ts-inner-glass flex h-10 min-w-0 flex-1 items-center rounded-full px-4">
            <Input
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  submitQuickInput()
                }
              }}
              placeholder="Add a note or paste a link…"
              className="h-full rounded-none border-none bg-transparent px-0 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
          <button
            onClick={submitQuickInput}
            disabled={!quickInput.trim()}
            className="ts-inner-glass flex size-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40"
            title={isLikelyUrl(quickInput) ? "Save link" : "Add note"}
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this note?</DialogTitle>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {pendingDeletePreview && (
            <div className="rounded-md border border-border/30 bg-muted/30 px-3 py-2 text-xs italic text-muted-foreground">
              {pendingDeletePreview}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPendingDeleteId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmDelete}
              autoFocus
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
