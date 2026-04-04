"use client"

import { useState } from "react"
import { format } from "date-fns"
import {
  Check,
  X,
  Clock,
  MapPin,
  FileText,
  Video,
  ExternalLink,
  Users,
  Pencil,
  Trash2,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { TimelineEvent } from "./timeline-utils"
import { formatTime12, extractMeetingLink, RESPONSE_ICONS } from "./timeline-utils"

export function EventDetailDialog({
  event,
  open,
  onOpenChange,
  onDelete,
  onUpdate,
  onRefresh,
  date,
}: {
  event: TimelineEvent
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, data: { title?: string; startTime?: string; endTime?: string }) => void
  onRefresh?: () => void
  date: Date
}) {
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(event.title)
  const [editStart, setEditStart] = useState(event.startTime)
  const [editEnd, setEditEnd] = useState(event.endTime)
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null)
  const [descExpanded, setDescExpanded] = useState(false)

  const isEditable = event.source === "local"

  // Determine current user's RSVP status from attendees
  const userAttendee = event.source === "google" && event.attendees && event.accountEmail
    ? event.attendees.find((a) => a.email.toLowerCase() === event.accountEmail!.toLowerCase())
    : null
  const currentRsvp = userAttendee?.status ?? "needsAction"

  const handleRsvp = async (status: "accepted" | "declined" | "tentative") => {
    if (!event.accountEmail || event.source !== "google") return
    // Extract accountId and googleEventId from composite id: "gcal-{accountId}-{googleEventId}"
    const parts = event.id.split("-")
    if (parts.length < 3 || parts[0] !== "gcal") return
    const accountId = parts[1]
    const googleEventId = parts.slice(2).join("-")

    setRsvpLoading(status)
    try {
      const res = await fetch("/api/google-calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rsvp", accountId, googleEventId, status }),
      })
      if (res.ok) {
        onRefresh?.()
      }
    } catch {
      // silently fail
    } finally {
      setRsvpLoading(null)
    }
  }

  const startMin = parseInt(event.startTime.split(":")[0]) * 60 + parseInt(event.startTime.split(":")[1])
  const endMin = parseInt(event.endTime.split(":")[0]) * 60 + parseInt(event.endTime.split(":")[1])
  const durationMin = endMin - startMin

  const handleSave = () => {
    onUpdate(event.id, { title: editTitle, startTime: editStart, endTime: editEnd })
    setEditing(false)
  }

  const handleDelete = () => {
    onDelete(event.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden lg:max-w-xl">
        {/* Color header bar */}
        <div
          className="h-2 w-full"
          style={{ backgroundColor: event.color ?? "var(--zone-timeline-accent)" }}
        />

        <div className="space-y-4 px-5 pb-5 pt-3">
          {/* Title */}
          {editing ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-lg font-bold"
              autoFocus
            />
          ) : (
            <DialogHeader className="p-0">
              <DialogTitle className="text-lg font-bold leading-snug">
                {event.title}
              </DialogTitle>
            </DialogHeader>
          )}

          {/* Time */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/30">
              <Clock className="size-4 text-muted-foreground/60" />
            </div>
            {editing ? (
              <div className="flex items-center gap-2">
                <Input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="w-28" />
                <span className="text-muted-foreground">to</span>
                <Input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="w-28" />
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium">
                  {event.allDay
                    ? "All day"
                    : `${formatTime12(startMin)} - ${formatTime12(endMin)}`}
                </p>
                <p className="text-xs text-muted-foreground/50">
                  {format(date, "EEEE, MMMM d")}
                  {!event.allDay && durationMin > 0 && (
                    <span className="ml-1.5">
                      · {durationMin >= 60
                        ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? ` ${durationMin % 60}m` : ""}`
                        : `${durationMin}m`}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Meeting link */}
          {(() => {
            const meetLink = event.meetingLink ?? extractMeetingLink(event.description)
            if (!meetLink) return null
            return (
              <a
                href={meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2.5 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
              >
                <Video className="size-4 shrink-0" />
                <span className="flex-1 truncate">Join meeting</span>
                <ExternalLink className="size-3 shrink-0 opacity-50" />
              </a>
            )
          })()}

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/30">
                <MapPin className="size-4 text-muted-foreground/60" />
              </div>
              <p className="text-sm">{event.location}</p>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/30">
                <FileText className="size-4 text-muted-foreground/60" />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={`whitespace-pre-wrap break-words text-sm text-muted-foreground/80 leading-relaxed ${
                    descExpanded ? "max-h-48 overflow-y-auto" : "line-clamp-3"
                  }`}
                >
                  {event.description}
                </div>
                {event.description.length > 150 && (
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="mt-1 text-xs text-muted-foreground/50 hover:text-muted-foreground"
                  >
                    {descExpanded ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Organizer */}
          {event.organizer && (
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/30">
                <User className="size-4 text-muted-foreground/60" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground/50">Organizer</p>
                <p className="text-sm">{event.organizer}</p>
              </div>
            </div>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/30">
                <Users className="size-4 text-muted-foreground/60" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs text-muted-foreground/50">
                  {event.attendees.length} attendee{event.attendees.length !== 1 ? "s" : ""}
                </p>
                <div className="space-y-0.5">
                  {event.attendees.map((a) => {
                    const resp = RESPONSE_ICONS[a.status] ?? RESPONSE_ICONS.needsAction
                    const StatusIcon = resp.icon
                    return (
                      <div key={a.email} className="flex items-center gap-2 py-0.5">
                        <StatusIcon className={`size-3 shrink-0 ${resp.color}`} />
                        <span className="truncate text-sm">
                          {a.name ?? a.email}
                        </span>
                        {a.name && (
                          <span className="truncate text-xs text-muted-foreground/40">
                            {a.email}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Source badge + Google Calendar link */}
          <div className="flex items-center gap-2 pt-1">
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {event.source}
            </span>
            {event.accountEmail && (
              <span className="text-xs text-muted-foreground/40">
                {event.accountEmail}
              </span>
            )}
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-muted-foreground/40 hover:text-foreground/60"
              >
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 border-t border-border/20 pt-3">
            {isEditable && !editing && (
              <>
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={() => {
                    setEditTitle(event.title)
                    setEditStart(event.startTime)
                    setEditEnd(event.endTime)
                    setEditing(true)
                  }}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-1.5"
                  onClick={handleDelete}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </>
            )}
            {isEditable && editing && (
              <>
                <Button className="flex-1 gap-1.5" onClick={handleSave}>
                  <Check className="size-3.5" />
                  Save
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </>
            )}
            {!isEditable && event.source === "google" && event.attendees && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground/50">RSVP</p>
                <div className="flex gap-2">
                  <Button
                    variant={currentRsvp === "accepted" ? "default" : "outline"}
                    className="flex-1 gap-1.5"
                    size="sm"
                    disabled={rsvpLoading !== null}
                    onClick={() => handleRsvp("accepted")}
                  >
                    <Check className="size-3.5" />
                    {rsvpLoading === "accepted" ? "..." : "Accept"}
                  </Button>
                  <Button
                    variant={currentRsvp === "tentative" ? "default" : "outline"}
                    className="flex-1 gap-1.5"
                    size="sm"
                    disabled={rsvpLoading !== null}
                    onClick={() => handleRsvp("tentative")}
                  >
                    <Clock className="size-3.5" />
                    {rsvpLoading === "tentative" ? "..." : "Maybe"}
                  </Button>
                  <Button
                    variant={currentRsvp === "declined" ? "destructive" : "outline"}
                    className="flex-1 gap-1.5"
                    size="sm"
                    disabled={rsvpLoading !== null}
                    onClick={() => handleRsvp("declined")}
                  >
                    <X className="size-3.5" />
                    {rsvpLoading === "declined" ? "..." : "Decline"}
                  </Button>
                </div>
              </div>
            )}
            {!isEditable && !(event.source === "google" && event.attendees) && (
              <p className="text-xs text-muted-foreground/40">
                This event is from Google Calendar and can only be edited there.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
