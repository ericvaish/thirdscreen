"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  Clock,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, addDays, subDays, isToday, parseISO } from "date-fns";
import type { ScheduleEvent } from "@/lib/types";

interface ScheduleCardProps {
  cardId: string;
}

const PRESET_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#ec4899",
];

const HOUR_HEIGHT = 60;
const START_HOUR = 6;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;

interface EventFormData {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  color: string;
  location: string;
  description: string;
  allDay: boolean;
}

const defaultFormData = (date: string): EventFormData => ({
  title: "",
  date,
  startTime: "09:00",
  endTime: "10:00",
  color: PRESET_COLORS[0],
  location: "",
  description: "",
  allDay: false,
});

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToOffset(minutes: number): number {
  return ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

function formatTimeRange(start: string, end: string): string {
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  };
  return `${fmt(start)} - ${fmt(end)}`;
}

function layoutColumns(events: ScheduleEvent[]): Map<string, { col: number; totalCols: number }> {
  const result = new Map<string, { col: number; totalCols: number }>();
  if (events.length === 0) return result;

  const sorted = [...events].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  const clusters: ScheduleEvent[][] = [];
  let current: ScheduleEvent[] = [sorted[0]];
  let clusterEnd = timeToMinutes(sorted[0].endTime);

  for (let i = 1; i < sorted.length; i++) {
    const evStart = timeToMinutes(sorted[i].startTime);
    if (evStart < clusterEnd) {
      current.push(sorted[i]);
      clusterEnd = Math.max(clusterEnd, timeToMinutes(sorted[i].endTime));
    } else {
      clusters.push(current);
      current = [sorted[i]];
      clusterEnd = timeToMinutes(sorted[i].endTime);
    }
  }
  clusters.push(current);

  for (const cluster of clusters) {
    const columns: ScheduleEvent[][] = [];
    for (const ev of cluster) {
      const evStart = timeToMinutes(ev.startTime);
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const lastInCol = columns[c][columns[c].length - 1];
        if (timeToMinutes(lastInCol.endTime) <= evStart) {
          columns[c].push(ev);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([ev]);
      }
    }
    const totalCols = columns.length;
    columns.forEach((col, colIdx) => {
      col.forEach((ev) => {
        result.set(ev.id, { col: colIdx, totalCols });
      });
    });
  }

  return result;
}

export default function ScheduleCard({ cardId }: ScheduleCardProps) {
  const [selectedDate, setSelectedDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [formData, setFormData] = useState<EventFormData>(
    defaultFormData(selectedDate)
  );
  const [detailEvent, setDetailEvent] = useState<ScheduleEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/schedule?cardId=${cardId}&date=${selectedDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [cardId, selectedDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (isToday(parseISO(selectedDate)) && currentTimeRef.current) {
      currentTimeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    } else if (timelineRef.current) {
      const offset = (8 - START_HOUR) * HOUR_HEIGHT;
      timelineRef.current.scrollTop = offset;
    }
  }, [selectedDate, events]);

  const goToPrev = () =>
    setSelectedDate((d) => format(subDays(parseISO(d), 1), "yyyy-MM-dd"));
  const goToToday = () => setSelectedDate(format(new Date(), "yyyy-MM-dd"));
  const goToNext = () =>
    setSelectedDate((d) => format(addDays(parseISO(d), 1), "yyyy-MM-dd"));

  const allDayEvents = useMemo(
    () => events.filter((e) => e.allDay),
    [events]
  );
  const timedEvents = useMemo(
    () => events.filter((e) => !e.allDay),
    [events]
  );
  const columnLayout = useMemo(
    () => layoutColumns(timedEvents),
    [timedEvents]
  );

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const showCurrentTime =
    isToday(parseISO(selectedDate)) &&
    currentMinutes >= START_HOUR * 60 &&
    currentMinutes <= END_HOUR * 60;
  const currentTimeTop = minutesToOffset(currentMinutes);

  const openAddDialog = () => {
    setEditingEvent(null);
    setFormData(defaultFormData(selectedDate));
    setDialogOpen(true);
  };

  const openEditDialog = (ev: ScheduleEvent) => {
    setEditingEvent(ev);
    setFormData({
      title: ev.title,
      date: ev.date,
      startTime: ev.startTime,
      endTime: ev.endTime,
      color: ev.color ?? PRESET_COLORS[0],
      location: ev.location ?? "",
      description: ev.description ?? "",
      allDay: ev.allDay,
    });
    setDetailOpen(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) return;
    const payload = {
      cardId,
      title: formData.title.trim(),
      startTime: formData.allDay ? "00:00" : formData.startTime,
      endTime: formData.allDay ? "23:59" : formData.endTime,
      date: formData.date,
      color: formData.color,
      location: formData.location.trim() || null,
      description: formData.description.trim() || null,
      allDay: formData.allDay,
    };

    try {
      if (editingEvent) {
        await fetch("/api/schedule", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingEvent.id, ...payload }),
        });
      } else {
        await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setDialogOpen(false);
      fetchEvents();
    } catch {
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/schedule?id=${id}`, { method: "DELETE" });
      setDetailOpen(false);
      fetchEvents();
    } catch {
    }
  };

  const dateLabel = (() => {
    const d = parseISO(selectedDate);
    if (isToday(d)) return "Today";
    return format(d, "EEE, MMM d");
  })();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={goToPrev}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={goToToday}
            className="text-xs font-medium text-foreground/80 hover:text-foreground"
          >
            <CalendarDays className="mr-1 size-3 text-blue-400" />
            {dateLabel}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={goToNext}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={openAddDialog}
          className="text-muted-foreground hover:text-blue-400"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="flex flex-col gap-1 border-b border-border/40 px-3 py-1.5">
          <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
            All Day
          </span>
          {allDayEvents.map((ev) => (
            <button
              key={ev.id}
              onClick={() => {
                setDetailEvent(ev);
                setDetailOpen(true);
              }}
              className="rounded-md px-2 py-1 text-left text-xs font-medium text-foreground transition-colors hover:brightness-110"
              style={{ backgroundColor: (ev.color ?? PRESET_COLORS[0]) + "20" }}
            >
              <span
                className="mr-1.5 inline-block size-2 rounded-full"
                style={{ backgroundColor: ev.color ?? PRESET_COLORS[0] }}
              />
              {ev.title}
            </button>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div ref={timelineRef} className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <span className="text-xs text-muted-foreground/40 animate-pulse">Loading...</span>
          </div>
        ) : (
          <div
            className="relative ml-12"
            style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
          >
            {/* Hour lines */}
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
              const hour = START_HOUR + i;
              const h12 = hour % 12 || 12;
              const ampm = hour >= 12 ? "PM" : "AM";
              return (
                <div
                  key={hour}
                  className="absolute right-0 left-0"
                  style={{ top: i * HOUR_HEIGHT }}
                >
                  <div className="absolute -left-12 -top-[7px] w-10 text-right font-mono text-[10px] text-muted-foreground/30">
                    {h12} {ampm}
                  </div>
                  <div className="h-px bg-border/30" />
                </div>
              );
            })}

            {/* Events */}
            {timedEvents.map((ev) => {
              const startMin = timeToMinutes(ev.startTime);
              const endMin = timeToMinutes(ev.endTime);
              const top = minutesToOffset(Math.max(startMin, START_HOUR * 60));
              const bottom = minutesToOffset(
                Math.min(endMin, END_HOUR * 60)
              );
              const height = Math.max(bottom - top, 20);
              const layout = columnLayout.get(ev.id) ?? {
                col: 0,
                totalCols: 1,
              };
              const widthPercent = 100 / layout.totalCols;
              const leftPercent = layout.col * widthPercent;
              const eventColor = ev.color ?? PRESET_COLORS[0];

              return (
                <Popover
                  key={ev.id}
                  open={detailOpen && detailEvent?.id === ev.id}
                  onOpenChange={(open) => {
                    if (!open) {
                      setDetailOpen(false);
                      setDetailEvent(null);
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      onClick={() => {
                        setDetailEvent(ev);
                        setDetailOpen(true);
                      }}
                      className="absolute mr-1 cursor-pointer overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left transition-all hover:brightness-125"
                      style={{
                        top,
                        height,
                        left: `calc(${leftPercent}% + 2px)`,
                        width: `calc(${widthPercent}% - 6px)`,
                        borderColor: eventColor,
                        backgroundColor: eventColor + "18",
                      }}
                    >
                      <div className="truncate text-xs font-medium text-foreground/90">
                        {ev.title}
                      </div>
                      {height > 30 && (
                        <div className="truncate font-mono text-[10px] text-muted-foreground/50">
                          {formatTimeRange(ev.startTime, ev.endTime)}
                        </div>
                      )}
                      {height > 46 && ev.location && (
                        <div className="flex items-center gap-0.5 truncate text-[10px] text-muted-foreground/40">
                          <MapPin className="size-2.5 shrink-0" />
                          {ev.location}
                        </div>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-64 border-border bg-popover"
                    align="start"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  ev.color ?? PRESET_COLORS[0],
                              }}
                            />
                            <span className="text-sm font-medium text-foreground">
                              {ev.title}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-1 font-mono text-xs text-muted-foreground">
                            <Clock className="size-3" />
                            {formatTimeRange(ev.startTime, ev.endTime)}
                          </div>
                          {ev.location && (
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="size-3" />
                              {ev.location}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => openEditDialog(ev)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleDelete(ev.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                      {ev.description && (
                        <p className="text-xs text-muted-foreground/60 leading-relaxed">
                          {ev.description}
                        </p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })}

            {/* Current time indicator */}
            {showCurrentTime && (
              <div
                ref={currentTimeRef}
                className="pointer-events-none absolute right-0 -left-12 z-10"
                style={{ top: currentTimeTop }}
              >
                <div className="relative flex items-center">
                  <div className="size-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
                  <div className="h-px flex-1 bg-red-500/60" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-border bg-popover sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? "Edit Event" : "Add Event"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="schedule-title" className="text-xs text-muted-foreground">
                Title
              </Label>
              <Input
                id="schedule-title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Event title"
                className="mt-1"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="schedule-allday"
                checked={formData.allDay}
                onCheckedChange={(checked) =>
                  setFormData((f) => ({ ...f, allDay: !!checked }))
                }
                size="sm"
              />
              <Label
                htmlFor="schedule-allday"
                className="text-xs text-muted-foreground"
              >
                All day
              </Label>
            </div>

            <div>
              <Label htmlFor="schedule-date" className="text-xs text-muted-foreground">
                Date
              </Label>
              <Input
                id="schedule-date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, date: e.target.value }))
                }
                className="mt-1"
              />
            </div>

            {!formData.allDay && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label
                    htmlFor="schedule-start"
                    className="text-xs text-muted-foreground"
                  >
                    Start
                  </Label>
                  <Input
                    id="schedule-start"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        startTime: e.target.value,
                      }))
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="schedule-end"
                    className="text-xs text-muted-foreground"
                  >
                    End
                  </Label>
                  <Input
                    id="schedule-end"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, endTime: e.target.value }))
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground">Color</Label>
              <div className="mt-1 flex gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormData((f) => ({ ...f, color: c }))}
                    className="size-6 rounded-full transition-all hover:scale-110"
                    style={{
                      backgroundColor: c,
                      outline:
                        formData.color === c
                          ? "2px solid var(--foreground)"
                          : "2px solid transparent",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label
                htmlFor="schedule-location"
                className="text-xs text-muted-foreground"
              >
                Location (optional)
              </Label>
              <Input
                id="schedule-location"
                value={formData.location}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, location: e.target.value }))
                }
                placeholder="Add location"
                className="mt-1"
              />
            </div>

            <div>
              <Label
                htmlFor="schedule-desc"
                className="text-xs text-muted-foreground"
              >
                Description (optional)
              </Label>
              <Textarea
                id="schedule-desc"
                value={formData.description}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                placeholder="Add description"
                className="mt-1 min-h-12"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!formData.title.trim()}>
              {editingEvent ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
