"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  StickyNote,
  Plus,
  X,
  Pin,
  PinOff,
  Search,
  Link as LinkIcon,
  ArrowLeft,
  ExternalLink,
  Globe,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type { NoteItem } from "@/lib/types"

interface NotesCardProps {
  cardId: string
}

interface LinkItem {
  id: string
  cardId: string
  url: string
  title: string
  pinned: boolean
  createdAt: string
}

type TabKey = "notes" | "links"

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "")
  } catch {
    return url
  }
}

function getNoteTitle(content: string): string {
  const firstLine = content.split("\n")[0]?.trim()
  return firstLine || "Untitled"
}

export function NotesCard({ cardId }: NotesCardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("notes")

  const [notes, setNotes] = useState<NoteItem[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [notesLoading, setNotesLoading] = useState(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [links, setLinks] = useState<LinkItem[]>([])
  const [newUrl, setNewUrl] = useState("")
  const [newLinkTitle, setNewLinkTitle] = useState("")
  const [linksLoading, setLinksLoading] = useState(true)

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes?cardId=${cardId}`)
      if (res.ok) {
        const data: NoteItem[] = await res.json()
        setNotes(data)
      }
    } catch {
    } finally {
      setNotesLoading(false)
    }
  }, [cardId])

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes/links?cardId=${cardId}`)
      if (res.ok) {
        const data: LinkItem[] = await res.json()
        setLinks(data)
      }
    } catch {
    } finally {
      setLinksLoading(false)
    }
  }, [cardId])

  useEffect(() => {
    fetchNotes()
    fetchLinks()
  }, [fetchNotes, fetchLinks])

  const sortedNotes = [...notes]
    .filter((n) =>
      searchQuery
        ? n.content.toLowerCase().includes(searchQuery.toLowerCase())
        : true
    )
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return a.sortOrder - b.sortOrder
    })

  const sortedLinks = [...links].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null

  const createNote = async () => {
    const tempId = `temp-${Date.now()}`
    const tempNote: NoteItem = {
      id: tempId,
      cardId,
      content: "",
      pinned: false,
      sortOrder: notes.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setNotes((prev) => [...prev, tempNote])
    setSelectedNoteId(tempId)

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, content: "" }),
      })
      if (res.ok) {
        const created: NoteItem = await res.json()
        setNotes((prev) => prev.map((n) => (n.id === tempId ? created : n)))
        setSelectedNoteId(created.id)
      } else {
        setNotes((prev) => prev.filter((n) => n.id !== tempId))
        setSelectedNoteId(null)
      }
    } catch {
      setNotes((prev) => prev.filter((n) => n.id !== tempId))
      setSelectedNoteId(null)
    }
  }

  const updateNoteContent = (id: string, content: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)))

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch("/api/notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, content }),
        })
      } catch {
      }
    }, 500)
  }

  const deleteNote = async (id: string) => {
    const previous = notes
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (selectedNoteId === id) setSelectedNoteId(null)

    try {
      const res = await fetch(`/api/notes?id=${id}`, { method: "DELETE" })
      if (!res.ok) setNotes(previous)
    } catch {
      setNotes(previous)
    }
  }

  const togglePinNote = async (id: string, pinned: boolean) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned } : n)))

    try {
      await fetch("/api/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, pinned }),
      })
    } catch {
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, pinned: !pinned } : n))
      )
    }
  }

  const addLink = async () => {
    const url = newUrl.trim()
    if (!url) return

    const title = newLinkTitle.trim() || getHostname(url)
    setNewUrl("")
    setNewLinkTitle("")

    const tempId = `temp-${Date.now()}`
    const tempLink: LinkItem = {
      id: tempId,
      cardId,
      url,
      title,
      pinned: false,
      createdAt: new Date().toISOString(),
    }
    setLinks((prev) => [...prev, tempLink])

    try {
      const res = await fetch("/api/notes/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, url, title }),
      })
      if (res.ok) {
        const created: LinkItem = await res.json()
        setLinks((prev) => prev.map((l) => (l.id === tempId ? created : l)))
      } else {
        setLinks((prev) => prev.filter((l) => l.id !== tempId))
      }
    } catch {
      setLinks((prev) => prev.filter((l) => l.id !== tempId))
    }
  }

  const deleteLink = async (id: string) => {
    const previous = links
    setLinks((prev) => prev.filter((l) => l.id !== id))

    try {
      const res = await fetch(`/api/notes/links?id=${id}`, {
        method: "DELETE",
      })
      if (!res.ok) setLinks(previous)
    } catch {
      setLinks(previous)
    }
  }

  const togglePinLink = async (id: string, pinned: boolean) => {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, pinned } : l)))

    try {
      await fetch("/api/notes/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, pinned }),
      })
    } catch {
      setLinks((prev) =>
        prev.map((l) => (l.id === id ? { ...l, pinned: !pinned } : l))
      )
    }
  }

  const tabButton = (tab: TabKey, label: string) => (
    <button
      type="button"
      onClick={() => {
        setActiveTab(tab)
        setSelectedNoteId(null)
      }}
      className={`flex-1 rounded-md px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider transition-all ${
        activeTab === tab
          ? "bg-violet-500/15 text-violet-400 shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex shrink-0 gap-0.5 border-b border-border/40 bg-muted/20 px-2 py-1.5">
        {tabButton("notes", "Notes")}
        {tabButton("links", "Links")}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "notes" ? (
          <NotesTab
            notes={sortedNotes}
            selectedNote={selectedNote}
            searchQuery={searchQuery}
            loading={notesLoading}
            onSearch={setSearchQuery}
            onSelect={setSelectedNoteId}
            onCreate={createNote}
            onUpdateContent={updateNoteContent}
            onDelete={deleteNote}
            onTogglePin={togglePinNote}
          />
        ) : (
          <LinksTab
            links={sortedLinks}
            loading={linksLoading}
            newUrl={newUrl}
            newTitle={newLinkTitle}
            onUrlChange={setNewUrl}
            onTitleChange={setNewLinkTitle}
            onAdd={addLink}
            onDelete={deleteLink}
            onTogglePin={togglePinLink}
          />
        )}
      </div>
    </div>
  )
}

interface NotesTabProps {
  notes: NoteItem[]
  selectedNote: NoteItem | null
  searchQuery: string
  loading: boolean
  onSearch: (q: string) => void
  onSelect: (id: string | null) => void
  onCreate: () => void
  onUpdateContent: (id: string, content: string) => void
  onDelete: (id: string) => void
  onTogglePin: (id: string, pinned: boolean) => void
}

function NotesTab({
  notes,
  selectedNote,
  searchQuery,
  loading,
  onSearch,
  onSelect,
  onCreate,
  onUpdateContent,
  onDelete,
  onTogglePin,
}: NotesTabProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground animate-pulse">
        Loading...
      </div>
    )
  }

  if (selectedNote) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-1 border-b border-border/30 px-2 py-1.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onSelect(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
          </Button>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {getNoteTitle(selectedNote.content)}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onTogglePin(selectedNote.id, !selectedNote.pinned)}
            className="text-muted-foreground hover:text-violet-400"
          >
            {selectedNote.pinned ? (
              <PinOff className="size-3" />
            ) : (
              <Pin className="size-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onDelete(selectedNote.id)}
            className="text-muted-foreground/50 hover:text-destructive"
          >
            <X className="size-3" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 p-2">
          <Textarea
            value={selectedNote.content}
            onChange={(e) =>
              onUpdateContent(selectedNote.id, e.target.value)
            }
            placeholder="Start writing..."
            className="h-full min-h-full resize-none rounded-none border-none bg-transparent text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border/30 px-2 py-1.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/40" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search notes..."
            className="h-11 rounded-none border-none bg-transparent pl-6 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onCreate}
          className="shrink-0 text-muted-foreground hover:text-violet-400"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
            <StickyNote className="size-8 opacity-20" />
            <span className="text-xs text-muted-foreground/40">
              {searchQuery ? "No matching notes" : "No notes yet"}
            </span>
          </div>
        ) : (
          <ul className="divide-y divide-border/20">
            {notes.map((note) => (
              <li key={note.id} className="group">
                <button
                  type="button"
                  onClick={() => onSelect(note.id)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/20"
                >
                  {note.pinned && (
                    <Pin className="mt-0.5 size-2.5 shrink-0 text-violet-400/60" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                      {getNoteTitle(note.content)}
                    </span>
                    {note.content.split("\n").length > 1 && (
                      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground/50">
                        {note.content.split("\n").slice(1).join(" ").trim().slice(0, 60)}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(note.id)
                    }}
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive"
                  >
                    <X className="size-3" />
                  </Button>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

interface LinksTabProps {
  links: LinkItem[]
  loading: boolean
  newUrl: string
  newTitle: string
  onUrlChange: (v: string) => void
  onTitleChange: (v: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  onTogglePin: (id: string, pinned: boolean) => void
}

function LinksTab({
  links,
  loading,
  newUrl,
  newTitle,
  onUrlChange,
  onTitleChange,
  onAdd,
  onDelete,
  onTogglePin,
}: LinksTabProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground animate-pulse">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-border/30 px-2 py-2">
        <div className="flex items-center gap-1.5">
          <Input
            value={newUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAdd()
            }}
            placeholder="https://..."
            className="h-6 flex-1 text-xs"
          />
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onAdd}
            disabled={!newUrl.trim()}
            className="shrink-0 text-muted-foreground hover:text-violet-400"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        {newUrl.trim() && (
          <Input
            value={newTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAdd()
            }}
            placeholder="Title (optional)"
            className="h-6 text-xs"
          />
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {links.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
            <LinkIcon className="size-8 opacity-20" />
            <span className="text-xs text-muted-foreground/40">No links saved</span>
          </div>
        ) : (
          <ul className="divide-y divide-border/20">
            {links.map((link) => (
              <li key={link.id} className="group">
                <div className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/20">
                  {link.pinned && (
                    <Pin className="size-2.5 shrink-0 text-violet-400/60" />
                  )}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 transition-colors hover:text-primary"
                  >
                    <span className="block truncate text-sm text-foreground">
                      {link.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/50">
                      <Globe className="size-2.5" />
                      {getHostname(link.url)}
                      <ExternalLink className="size-2" />
                    </span>
                  </a>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onTogglePin(link.id, !link.pinned)}
                      className="text-muted-foreground hover:text-violet-400"
                    >
                      {link.pinned ? (
                        <PinOff className="size-3" />
                      ) : (
                        <Pin className="size-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onDelete(link.id)}
                      className="text-muted-foreground/50 hover:text-destructive"
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
