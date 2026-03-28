"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { Flame, Droplets, Pill, Plus, Minus, Trash2, X, Check, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { FoodItem, MedicineItem } from "@/lib/types"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { listFoodItems, createFoodItem, deleteFoodItem, getWater, upsertWater, listMedicines, createMedicine, deleteMedicine as deleteMedicineApi, listDoses, toggleDose as toggleDoseApi } from "@/lib/data-layer"
import { useMascot } from "@/lib/mascot"

// ── Progress Meter ──────────────────────────────────────────────────────────

interface MeterProps {
  value: number
  max: number
  color: string
  label: string
  unit: string
  icon: React.ReactNode
  children?: React.ReactNode
}

function Meter({ value, max, color, label, unit, icon, children }: MeterProps) {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100)
  const overGoal = value > max

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="group w-full min-h-11 rounded-lg px-3 py-2 text-left transition-colors hover:bg-foreground/[0.03]">
          {/* Top row: icon + label + value */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span style={{ color }} className="opacity-80">{icon}</span>
              <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className="font-[family-name:var(--font-display)] text-lg font-bold tabular-nums"
                style={{ color }}
              >
                {value.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground/50">
                / {max.toLocaleString()} {unit}
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border/30">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${pct}%`,
                background: color,
                boxShadow: `0 0 8px ${color}`,
                opacity: overGoal ? 0.8 : 1,
              }}
            />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" className="w-60">
        <p
          className="mb-3 font-mono text-xs font-medium uppercase tracking-wider"
          style={{ color }}
        >
          {label}
        </p>
        {children}
      </PopoverContent>
    </Popover>
  )
}

// ── Vitals Zone ─────────────────────────────────────────────────────────────

const DEFAULT_CALORIE_GOAL = 2000
const DEFAULT_WATER_GOAL = 2000
const CARD_ID_CALORIES = "calories-1"
const CARD_ID_MEDICINES = "medicines-1"

export function VitalsZone() {
  const { editMode } = useDashboard()
  const { trigger: mascotTrigger } = useMascot()
  const [today, setToday] = useState("")

  const [foodItems, setFoodItems] = useState<FoodItem[]>([])
  const [calorieGoal] = useState(DEFAULT_CALORIE_GOAL)
  const [waterMl, setWaterMl] = useState(0)
  const [waterUnit, setWaterUnit] = useState<"cups" | "ml">("cups")
  const [waterGoalMl, setWaterGoalMl] = useState(DEFAULT_WATER_GOAL)
  const [medicines, setMedicines] = useState<MedicineItem[]>([])
  const [doseLogs, setDoseLogs] = useState<Map<string, Set<string>>>(new Map())
  const [dayOfWeek, setDayOfWeek] = useState(-1)

  const fetchCalories = useCallback(async () => {
    try {
      const data = await listFoodItems(today) as FoodItem[]
      setFoodItems(data)
    } catch {}
  }, [today])

  const fetchWater = useCallback(async () => {
    try {
      const data = await getWater(today) as { intake: number; goal: number }
      setWaterMl(data?.intake ?? (data as any)?.ml ?? 0)
    } catch {}
  }, [today])

  const fetchMedicines = useCallback(async () => {
    try {
      const meds = await listMedicines() as MedicineItem[]
      setMedicines(meds.filter((m) => m.active))

      const logs = new Map<string, Set<string>>()
      await Promise.all(
        meds
          .filter((m) => m.active)
          .map(async (med) => {
            const doses = await listDoses(med.id, today) as { timeId: string }[]
            logs.set(med.id, new Set(doses.map((d) => d.timeId)))
          })
      )
      setDoseLogs(logs)
    } catch {}
  }, [today])

  useEffect(() => {
    setToday(format(new Date(), "yyyy-MM-dd"))
    setDayOfWeek(new Date().getDay())
    // Load water preferences
    const storedUnit = localStorage.getItem("water-unit")
    if (storedUnit === "ml" || storedUnit === "cups") setWaterUnit(storedUnit)
    const storedGoal = localStorage.getItem("water-goal-ml")
    if (storedGoal) setWaterGoalMl(Number(storedGoal))
  }, [])

  useEffect(() => {
    if (!today) return
    fetchCalories()
    fetchWater()
    fetchMedicines()
  }, [today, fetchCalories, fetchWater, fetchMedicines])

  const totalCalories = foodItems.reduce((sum, f) => sum + f.calories, 0)
  const waterCups = Math.round(waterMl / 250)
  const waterGoalCups = Math.round(waterGoalMl / 250)
  const waterDisplay = waterUnit === "cups" ? waterCups : waterMl
  const waterGoalDisplay = waterUnit === "cups" ? waterGoalCups : waterGoalMl
  const waterUnitLabel = waterUnit === "cups" ? "cups" : "ml"
  const waterIncrement = waterUnit === "cups" ? 250 : 100 // 1 cup or 100ml
  const todayMeds = medicines.filter((m) => m.activeDays.includes(dayOfWeek))

  const addFood = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const name = form.get("name") as string
    const calories = Number(form.get("calories"))
    if (!name || !calories) return
    try {
      await createFoodItem({ cardId: CARD_ID_CALORIES, name, calories, date: today })
      fetchCalories()
      mascotTrigger("food")
      e.currentTarget.reset()
    } catch {
      toast.error("Failed to log food")
    }
  }

  const adjustWater = async (delta: number) => {
    const newMl = Math.max(0, waterMl + delta)
    setWaterMl(newMl)
    try {
      await upsertWater({ cardId: CARD_ID_CALORIES, date: today, intake: newMl })
      if (delta > 0) mascotTrigger("water")
    } catch {
      setWaterMl(waterMl)
    }
  }

  const toggleDose = async (medicineId: string, timeId: string) => {
    setDoseLogs((prev) => {
      const next = new Map(prev)
      const set = new Set(next.get(medicineId) ?? [])
      if (set.has(timeId)) {
        set.delete(timeId)
      } else {
        set.add(timeId)
      }
      next.set(medicineId, set)
      return next
    })
    try {
      await toggleDoseApi({ medicineId, timeId, date: today })
      mascotTrigger("medicine")
    } catch {
      fetchMedicines()
    }
  }

  const addMedicine = async (data: {
    name: string
    dosage: string
    times: { hour: number; minute: number; id: string }[]
  }) => {
    try {
      await createMedicine({
        cardId: CARD_ID_MEDICINES,
        name: data.name,
        dosage: data.dosage || undefined,
        times: data.times,
        repeatPattern: "daily",
        activeDays: [0, 1, 2, 3, 4, 5, 6],
      })
      fetchMedicines()
      toast.success("Medicine added")
    } catch {
      toast.error("Failed to add medicine")
    }
  }

  const deleteMedicine = async (id: string) => {
    try {
      await deleteMedicineApi(id)
      fetchMedicines()
    } catch {
      toast.error("Failed to delete medicine")
    }
  }

  return (
    <div className="zone-surface zone-vitals flex h-full flex-col">
      <div className={`shrink-0 px-4 py-1.5 ${editMode ? "zone-drag-handle" : ""}`}>
        <div className="flex items-center gap-2">
          <ZoneDragHandle />
          <div className="h-4 w-[3px] rounded-full" style={{ background: "var(--zone-vitals-accent)" }} />
          <span className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight" style={{ color: "var(--zone-vitals-accent)" }}>
            Vitals
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Calories meter */}
        <Meter
          value={Math.round(totalCalories)}
          max={calorieGoal}
          color="var(--vital-calories)"
          label="Calories"
          unit="cal"
          icon={<Flame className="size-3.5" />}
        >
          <form onSubmit={addFood} className="grid gap-2">
            <Input name="name" placeholder="Food name" className="h-8 text-xs" />
            <div className="flex gap-2">
              <Input name="calories" type="number" placeholder="kcal" className="h-8 text-xs" />
              <Button type="submit" size="sm" className="h-8 shrink-0">
                <Plus className="size-3" />
              </Button>
            </div>
          </form>
          {foodItems.length > 0 && (
            <div className="mt-2 max-h-32 space-y-1 overflow-auto">
              {foodItems.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-muted-foreground">{f.name}</span>
                  <span className="shrink-0 font-mono text-foreground">{f.calories}</span>
                </div>
              ))}
            </div>
          )}
        </Meter>

        {/* Water - inline +/- buttons with settings popover */}
        <div className="w-full rounded-lg px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span style={{ color: "var(--vital-water)" }} className="opacity-80">
                <Droplets className="size-3.5" />
              </span>
              <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Water
              </span>
              <div className="flex items-baseline gap-1 ml-1">
                <span
                  className="font-[family-name:var(--font-display)] text-lg font-bold tabular-nums"
                  style={{ color: "var(--vital-water)" }}
                >
                  {waterDisplay}
                </span>
                <span className="text-xs text-muted-foreground/50">
                  / {waterGoalDisplay} {waterUnitLabel}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => adjustWater(-waterIncrement)}
                disabled={waterMl <= 0}
                className="flex size-9 items-center justify-center rounded-lg border border-border/25 bg-muted/15 text-muted-foreground/60 transition-colors hover:border-border/40 hover:bg-muted/30 hover:text-foreground active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
              >
                <Minus className="size-3.5" />
              </button>
              <button
                onClick={() => adjustWater(waterIncrement)}
                className="flex size-9 items-center justify-center rounded-lg border border-border/25 bg-muted/15 text-muted-foreground/60 transition-colors hover:border-border/40 hover:bg-muted/30 hover:text-foreground active:scale-95"
              >
                <Plus className="size-3.5" />
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex size-9 items-center justify-center rounded-lg border border-border/25 bg-muted/15 text-muted-foreground/40 transition-colors hover:border-border/40 hover:bg-muted/30 hover:text-foreground active:scale-95">
                    <Settings className="size-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="left" className="w-56">
                  <p className="mb-3 font-mono text-xs font-medium uppercase tracking-wider" style={{ color: "var(--vital-water)" }}>
                    Water Settings
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Display unit</Label>
                      <div className="mt-1 flex gap-1">
                        <Button
                          variant={waterUnit === "cups" ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setWaterUnit("cups")
                            localStorage.setItem("water-unit", "cups")
                          }}
                        >
                          Cups
                        </Button>
                        <Button
                          variant={waterUnit === "ml" ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setWaterUnit("ml")
                            localStorage.setItem("water-unit", "ml")
                          }}
                        >
                          ML
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Daily goal ({waterUnit === "cups" ? "cups" : "ml"})
                      </Label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={waterUnit === "cups" ? waterGoalCups : waterGoalMl}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          if (isNaN(val) || val <= 0) return
                          const mlVal = waterUnit === "cups" ? val * 250 : val
                          setWaterGoalMl(mlVal)
                          localStorage.setItem("water-goal-ml", String(mlVal))
                        }}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border/30">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min((waterMl / Math.max(waterGoalMl, 1)) * 100, 100)}%`,
                background: "var(--vital-water)",
                boxShadow: "0 0 8px var(--vital-water)",
              }}
            />
          </div>
        </div>

        {/* Medicines - checkbox list */}
        <div className="px-3 py-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Pill className="size-3.5 text-[var(--vital-meds)]" />
              <span className="font-[family-name:var(--font-display)] text-xs font-semibold tracking-tight text-[var(--vital-meds)]">
                Medications
              </span>
            </div>
            <AddMedicineDialog onAdd={addMedicine} />
          </div>

          {todayMeds.length === 0 ? (
            <p className="py-1 text-xs text-muted-foreground/50">
              No medications scheduled
            </p>
          ) : (
            <div className="space-y-1">
              {todayMeds.map((med) =>
                med.times.map((t) => {
                  const taken = doseLogs.get(med.id)?.has(t.id) ?? false
                  const timeStr = `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`
                  return (
                    <button
                      key={`${med.id}-${t.id}`}
                      onClick={() => toggleDose(med.id, t.id)}
                      className="group flex w-full min-h-11 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <div
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border transition-all",
                          taken
                            ? "border-[var(--vital-meds)] bg-[var(--vital-meds)]"
                            : "border-border group-hover:border-muted-foreground/50"
                        )}
                      >
                        {taken && <Check className="size-2.5 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "text-xs",
                            taken && "text-muted-foreground line-through"
                          )}
                        >
                          {med.name}
                        </span>
                        {med.dosage && (
                          <span className="ml-1 text-xs text-muted-foreground/50">
                            {med.dosage}
                          </span>
                        )}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-xs",
                          taken ? "text-muted-foreground/40" : "text-muted-foreground"
                        )}
                      >
                        {timeStr}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteMedicine(med.id)
                        }}
                        className="flex size-11 shrink-0 items-center justify-center"
                      >
                        <Trash2 className="size-2.5 text-muted-foreground/30 hover:text-destructive" />
                      </button>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Add Medicine Dialog ─────────────────────────────────────────────────────

function AddMedicineDialog({
  onAdd,
}: {
  onAdd: (data: {
    name: string
    dosage: string
    times: { hour: number; minute: number; id: string }[]
  }) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [dosage, setDosage] = useState("")
  const [times, setTimes] = useState<{ hour: number; minute: number; id: string }[]>([
    { hour: 8, minute: 0, id: "default-time-0" },
  ])

  const addTime = () => {
    setTimes((prev) => [...prev, { hour: 12, minute: 0, id: crypto.randomUUID() }])
  }

  const removeTime = (id: string) => {
    setTimes((prev) => prev.filter((t) => t.id !== id))
  }

  const updateTime = (id: string, field: "hour" | "minute", value: number) => {
    setTimes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || times.length === 0) return
    await onAdd({ name: name.trim(), dosage: dosage.trim(), times })
    setOpen(false)
    setName("")
    setDosage("")
    setTimes([{ hour: 8, minute: 0, id: crypto.randomUUID() }])
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-xs" className="text-muted-foreground/50 hover:text-foreground">
          <Plus className="size-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Medicine</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="med-name">Name</Label>
            <Input id="med-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vitamin D" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="med-dosage">Dosage (optional)</Label>
            <Input id="med-dosage" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="e.g. 1000 IU" />
          </div>
          <div className="grid gap-2">
            <Label>Times</Label>
            <div className="space-y-2">
              {times.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={`${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number)
                      updateTime(t.id, "hour", h)
                      updateTime(t.id, "minute", m)
                    }}
                    className="flex-1"
                  />
                  {times.length > 1 && (
                    <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeTime(t.id)}>
                      <X className="size-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={addTime} className="w-full text-xs text-muted-foreground">
                <Plus className="size-3" />
                Add another time
              </Button>
            </div>
          </div>
          <Button type="submit">Save Medicine</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
