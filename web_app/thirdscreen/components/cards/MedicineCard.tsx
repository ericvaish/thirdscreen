"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Pill,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MedicineItem } from "@/lib/types";

interface MedicineCardProps {
  cardId: string;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortDay(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildWeek(center: Date): Date[] {
  const dates: Date[] = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(center);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatTime(hour: number, minute: number): string {
  const h12 = hour % 12 || 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${h12}:${pad2(minute)} ${ampm}`;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface MedicineFormState {
  name: string;
  dosage: string;
  times: { hour: number; minute: number; id: string }[];
  repeatPattern: "daily" | "weekly" | "custom";
  activeDays: number[];
}

function emptyForm(): MedicineFormState {
  return {
    name: "",
    dosage: "",
    times: [{ hour: 8, minute: 0, id: crypto.randomUUID() }],
    repeatPattern: "daily",
    activeDays: [0, 1, 2, 3, 4, 5, 6],
  };
}

function formFromMedicine(med: MedicineItem): MedicineFormState {
  return {
    name: med.name,
    dosage: med.dosage ?? "",
    times: med.times.map((t) => ({ ...t })),
    repeatPattern: med.repeatPattern,
    activeDays: [...med.activeDays],
  };
}

export default function MedicineCard({ cardId }: MedicineCardProps) {
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const week = useMemo(() => buildWeek(today), [today]);
  const dateKey = formatDateKey(selectedDate);
  const dayOfWeek = selectedDate.getDay();

  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [doses, setDoses] = useState<Record<string, boolean>>({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MedicineFormState>(emptyForm());

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchMedicines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/medicines?cardId=${encodeURIComponent(cardId)}`
      );
      if (res.ok) {
        const data: MedicineItem[] = await res.json();
        setMedicines(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  const activeMedicines = useMemo(
    () =>
      medicines.filter((med) => {
        if (!med.active) return false;
        if (med.repeatPattern === "daily") return true;
        return med.activeDays.includes(dayOfWeek);
      }),
    [medicines, dayOfWeek]
  );

  const fetchDoses = useCallback(async () => {
    const newDoses: Record<string, boolean> = {};
    await Promise.all(
      activeMedicines.map(async (med) => {
        try {
          const res = await fetch(
            `/api/medicines/doses?medicineId=${encodeURIComponent(med.id)}&date=${dateKey}`
          );
          if (res.ok) {
            const data: { medicineId: string; timeId: string; taken: boolean }[] =
              await res.json();
            for (const d of data) {
              newDoses[`${d.medicineId}-${d.timeId}`] = d.taken;
            }
          }
        } catch {}
      })
    );
    setDoses(newDoses);
  }, [activeMedicines, dateKey]);

  useEffect(() => {
    if (activeMedicines.length > 0) {
      fetchDoses();
    } else {
      setDoses({});
    }
  }, [activeMedicines, fetchDoses]);

  const toggleDose = async (medicineId: string, timeId: string) => {
    const key = `${medicineId}-${timeId}`;
    const newVal = !doses[key];
    setDoses((prev) => ({ ...prev, [key]: newVal }));
    try {
      await fetch("/api/medicines/doses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicineId, timeId, date: dateKey }),
      });
    } catch {}
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (med: MedicineItem) => {
    setEditingId(med.id);
    setForm(formFromMedicine(med));
    setDialogOpen(true);
  };

  const saveMedicine = async () => {
    const name = form.name.trim();
    if (!name || form.times.length === 0) return;

    const payload = {
      cardId,
      name,
      dosage: form.dosage.trim() || null,
      times: form.times,
      repeatPattern: form.repeatPattern,
      activeDays: form.repeatPattern === "daily" ? [0, 1, 2, 3, 4, 5, 6] : form.activeDays,
    };

    try {
      if (editingId) {
        const res = await fetch("/api/medicines", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
        if (res.ok) {
          setDialogOpen(false);
          fetchMedicines();
        }
      } else {
        const res = await fetch("/api/medicines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setDialogOpen(false);
          fetchMedicines();
        }
      }
    } catch {}
  };

  const deleteMedicine = async (id: string) => {
    try {
      const res = await fetch(
        `/api/medicines?id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setMedicines((prev) => prev.filter((m) => m.id !== id));
        setDeleteConfirmId(null);
      }
    } catch {}
  };

  const addTime = () => {
    setForm((prev) => ({
      ...prev,
      times: [...prev.times, { hour: 8, minute: 0, id: crypto.randomUUID() }],
    }));
  };

  const removeTime = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      times: prev.times.filter((_, i) => i !== idx),
    }));
  };

  const updateTime = (idx: number, field: "hour" | "minute", val: number) => {
    setForm((prev) => ({
      ...prev,
      times: prev.times.map((t, i) => (i === idx ? { ...t, [field]: val } : t)),
    }));
  };

  const toggleDay = (day: number) => {
    setForm((prev) => {
      const has = prev.activeDays.includes(day);
      return {
        ...prev,
        activeDays: has
          ? prev.activeDays.filter((d) => d !== day)
          : [...prev.activeDays, day].sort(),
      };
    });
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      {/* Week strip */}
      <div className="flex items-center justify-between gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() - 1);
            setSelectedDate(d);
          }}
        >
          <ChevronLeft className="size-3" />
        </Button>
        <div className="flex gap-1">
          {week.map((d) => {
            const active = isSameDay(d, selectedDate);
            const isDayToday = isSameDay(d, today);
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDate(d)}
                className={`flex flex-col items-center rounded-lg px-1.5 py-1 text-[10px] leading-tight transition-all ${
                  active
                    ? "bg-rose-500/15 text-rose-400 shadow-sm"
                    : isDayToday
                      ? "text-rose-400/60"
                      : "text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <span className="font-medium">{shortDay(d)}</span>
                <span className="font-mono text-[11px]">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() + 1);
            setSelectedDate(d);
          }}
        >
          <ChevronRight className="size-3" />
        </Button>
      </div>

      {/* Header + add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Pill className="size-3.5 text-rose-400" />
          Medicines
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-xs" onClick={openAdd}>
              <Plus className="size-3" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto border-border bg-popover">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Medicine" : "Add Medicine"}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <Input
                placeholder="Medicine name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />

              <Input
                placeholder="Dosage (e.g. 500mg)"
                value={form.dosage}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, dosage: e.target.value }))
                }
              />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Times
                  </span>
                  <Button variant="ghost" size="xs" onClick={addTime}>
                    <Plus className="mr-1 size-3" />
                    Add time
                  </Button>
                </div>
                {form.times.map((t, idx) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <Input
                      className="h-7 w-16 font-mono text-xs"
                      type="number"
                      min={0}
                      max={23}
                      value={t.hour}
                      onChange={(e) =>
                        updateTime(idx, "hour", Number(e.target.value))
                      }
                    />
                    <span className="text-xs text-muted-foreground">:</span>
                    <Input
                      className="h-7 w-16 font-mono text-xs"
                      type="number"
                      min={0}
                      max={59}
                      value={t.minute}
                      onChange={(e) =>
                        updateTime(idx, "minute", Number(e.target.value))
                      }
                    />
                    {form.times.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeTime(idx)}
                      >
                        <X className="size-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Repeat
                </span>
                <Select
                  value={form.repeatPattern}
                  onValueChange={(val: "daily" | "weekly" | "custom") =>
                    setForm((prev) => ({ ...prev, repeatPattern: val }))
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="custom">Custom days</SelectItem>
                  </SelectContent>
                </Select>

                {form.repeatPattern !== "daily" && (
                  <div className="flex gap-1">
                    {DAY_LABELS.map((label, i) => {
                      const active = form.activeDays.includes(i);
                      return (
                        <button
                          key={label}
                          onClick={() => toggleDay(i)}
                          className={`flex size-7 items-center justify-center rounded-lg font-mono text-[10px] font-medium transition-all ${
                            active
                              ? "bg-rose-500/15 text-rose-400"
                              : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                          }`}
                        >
                          {label[0]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveMedicine}>
                {editingId ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Medicine list */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {loading && activeMedicines.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground animate-pulse">
            Loading...
          </p>
        )}
        {!loading && activeMedicines.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground/40">
            No medicines scheduled for this day
          </p>
        )}

        {activeMedicines.map((med) => (
          <div
            key={med.id}
            className="rounded-xl bg-muted/20 p-3 ring-1 ring-border/50"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  {med.name}
                </span>
                {med.dosage && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {med.dosage}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => openEdit(med)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="size-3" />
                </Button>
                {deleteConfirmId === med.id ? (
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="destructive"
                      size="xs"
                      onClick={() => deleteMedicine(med.id)}
                      className="text-[10px]"
                    >
                      Delete
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setDeleteConfirmId(null)}
                      className="text-[10px]"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setDeleteConfirmId(med.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              {med.times.map((t) => {
                const doseKey = `${med.id}-${t.id}`;
                const taken = !!doses[doseKey];
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleDose(med.id, t.id)}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 font-mono text-xs transition-all ${
                      taken
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    <Checkbox
                      checked={taken}
                      onCheckedChange={() => toggleDose(med.id, t.id)}
                      className="size-3.5"
                    />
                    <span className={taken ? "line-through opacity-60" : ""}>
                      {formatTime(t.hour, t.minute)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
