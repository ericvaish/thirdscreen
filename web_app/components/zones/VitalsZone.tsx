"use client"

import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { useRegisterZoneActions, type ZoneAction } from "@/lib/zone-actions"
import { useDataFetch } from "@/lib/use-data-fetch"
import { format, addDays, isToday, parseISO } from "date-fns"
import { Flame, Droplets, Heart, Pill, Plus, Minus, Trash2, X, Check, Settings, ChevronLeft, ChevronRight } from "lucide-react"
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
import { Calendar } from "@/components/ui/calendar"
import type { FoodItem, MedicineItem } from "@/lib/types"
import { useDashboard } from "@/components/dashboard/DashboardContext"
import { ZoneDragHandle } from "@/components/dashboard/ZoneDragHandle"
import { ZoneLabel } from "@/components/dashboard/ZoneLabel"
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
  const [settingsOpen, setSettingsOpen] = useState(false)

  const zoneActions = useMemo<ZoneAction[]>(
    () => [
      {
        id: "settings",
        label: "Vitals settings…",
        icon: <Settings className="size-3.5" />,
        onSelect: () => setSettingsOpen(true),
      },
    ],
    [],
  )
  useRegisterZoneActions("vitals", zoneActions)

  const [calorieGoal, setCalorieGoal] = useState(DEFAULT_CALORIE_GOAL)
  const [waterUnit, setWaterUnit] = useState<"cups" | "ml">("cups")
  const [waterGoalMl, setWaterGoalMl] = useState(DEFAULT_WATER_GOAL)
  const [medicines, setMedicines] = useState<MedicineItem[]>([])
  const [doseLogs, setDoseLogs] = useState<Map<string, Set<string>>>(new Map())
  const [dayOfWeek, setDayOfWeek] = useState(-1)
  const [medDate, setMedDate] = useState("")

  const { data: foodItems = [], refetch: refetchCalories } = useDataFetch(
    () => listFoodItems(today) as Promise<FoodItem[]>,
    [today],
    { skip: !today }
  )

  const { data: waterMl = 0, setData: setWaterMl, refetch: refetchWater } = useDataFetch(
    async () => {
      const data = await getWater(today) as { intake: number; goal: number }
      return data?.intake ?? (data as any)?.ml ?? 0
    },
    [today],
    { skip: !today }
  )

  const fetchMedicines = useCallback(async () => {
    if (!medDate) return
    try {
      const meds = await listMedicines() as MedicineItem[]
      setMedicines(meds.filter((m) => m.active))

      const logs = new Map<string, Set<string>>()
      await Promise.all(
        meds
          .filter((m) => m.active)
          .map(async (med) => {
            const doses = await listDoses(med.id, medDate) as { timeId: string }[]
            logs.set(med.id, new Set(doses.map((d) => d.timeId)))
          })
      )
      setDoseLogs(logs)
    } catch {}
  }, [medDate])

  useEffect(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd")
    setToday(todayStr)
    setMedDate(todayStr)
    setDayOfWeek(new Date().getDay())
    // Load water preferences
    const storedUnit = localStorage.getItem("water-unit")
    if (storedUnit === "ml" || storedUnit === "cups") setWaterUnit(storedUnit)
    const storedGoal = localStorage.getItem("water-goal-ml")
    if (storedGoal) setWaterGoalMl(Number(storedGoal))
    const storedCalGoal = localStorage.getItem("calorie-goal")
    if (storedCalGoal) setCalorieGoal(Number(storedCalGoal))
  }, [])

  useEffect(() => {
    if (!medDate) return
    fetchMedicines()
  }, [medDate, fetchMedicines])

  // Auto-refresh when a new day starts (visibility change or periodic check)
  useEffect(() => {
    const checkDayRollover = () => {
      const nowStr = format(new Date(), "yyyy-MM-dd")
      if (nowStr !== today) {
        setToday(nowStr)
        setMedDate(nowStr)
        setDayOfWeek(new Date().getDay())
      }
    }
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkDayRollover()
    }
    document.addEventListener("visibilitychange", handleVisibility)
    const interval = setInterval(checkDayRollover, 30_000)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      clearInterval(interval)
    }
  }, [today])

  const totalCalories = foodItems.reduce((sum, f) => sum + f.calories, 0)
  const waterCups = Math.round(waterMl / 250)
  const waterGoalCups = Math.round(waterGoalMl / 250)
  const waterDisplay = waterUnit === "cups" ? waterCups : waterMl
  const waterGoalDisplay = waterUnit === "cups" ? waterGoalCups : waterGoalMl
  const waterUnitLabel = waterUnit === "cups" ? "cups" : "ml"
  const waterIncrement = waterUnit === "cups" ? 250 : 100 // 1 cup or 100ml
  const medDateObj = medDate ? parseISO(medDate) : new Date()
  const medDayOfWeek = medDateObj.getDay()
  const medIsToday = medDate ? isToday(medDateObj) : true

  const todayMeds = medicines.filter((m) => {
    if (m.repeatPattern === "daily") return true
    if (m.repeatPattern === "every_other_day") {
      const start = new Date(m.createdAt)
      start.setHours(0, 0, 0, 0)
      const target = new Date(medDateObj)
      target.setHours(0, 0, 0, 0)
      const diffDays = Math.round((target.getTime() - start.getTime()) / 86400000)
      return diffDays % 2 === 0
    }
    return m.activeDays.includes(medDayOfWeek)
  })

  const addFood = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    const name = form.get("name") as string
    const calories = Number(form.get("calories"))
    if (!name || !calories) return
    try {
      await createFoodItem({ cardId: CARD_ID_CALORIES, name, calories, date: today })
      refetchCalories()
      mascotTrigger("food")
      formEl.reset()
    } catch (err) {
      console.error("Failed to log food:", err)
      toast.error("Failed to log food")
    }
  }

  const removeLastFood = async () => {
    if (foodItems.length === 0) return
    const last = foodItems[foodItems.length - 1]
    try {
      await deleteFoodItem(last.id)
      refetchCalories()
    } catch {
      toast.error("Failed to remove food item")
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
      await toggleDoseApi({ medicineId, timeId, date: medDate })
      mascotTrigger("medicine")
    } catch {
      fetchMedicines()
    }
  }

  const addMedicine = async (data: {
    name: string
    dosage: string
    times: { hour: number; minute: number; id: string }[]
    repeatPattern: "daily" | "every_other_day" | "custom"
    activeDays: number[]
  }) => {
    try {
      await createMedicine({
        cardId: CARD_ID_MEDICINES,
        name: data.name,
        dosage: data.dosage || undefined,
        times: data.times,
        repeatPattern: data.repeatPattern,
        activeDays: data.repeatPattern === "daily" ? [0, 1, 2, 3, 4, 5, 6] : data.activeDays,
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
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Heart className="size-4" style={{ color: "var(--zone-vitals-accent)" }} />
              Vitals settings
            </DialogTitle>
          </DialogHeader>
            <div className="space-y-4">
              {/* Calorie settings */}
              <div>
                <p className="mb-2 font-mono text-xs font-medium uppercase tracking-wider" style={{ color: "var(--vital-calories)" }}>
                  Calories
                </p>
                <Label className="text-xs text-muted-foreground">Daily goal (cal)</Label>
                <div className="mt-1 flex items-center gap-1">
                  <button
                    onClick={() => {
                      const val = Math.max(50, calorieGoal - 50)
                      setCalorieGoal(val)
                      localStorage.setItem("calorie-goal", String(val))
                    }}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/25 bg-muted/15 text-muted-foreground/60 transition-colors hover:border-border/40 hover:bg-muted/30 hover:text-foreground active:scale-95"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <Input
                    type="number"
                    className="text-center"
                    value={calorieGoal}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      if (isNaN(val) || val <= 0) return
                      setCalorieGoal(val)
                      localStorage.setItem("calorie-goal", String(val))
                    }}
                  />
                  <button
                    onClick={() => {
                      const val = calorieGoal + 50
                      setCalorieGoal(val)
                      localStorage.setItem("calorie-goal", String(val))
                    }}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/25 bg-muted/15 text-muted-foreground/60 transition-colors hover:border-border/40 hover:bg-muted/30 hover:text-foreground active:scale-95"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>

              <div className="border-t border-border/10" />

              {/* Water settings */}
              <div>
                <p className="mb-2 font-mono text-xs font-medium uppercase tracking-wider" style={{ color: "var(--vital-water)" }}>
                  Water
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
              </div>

              <div className="border-t border-border/10" />

              {/* Medicines settings */}
              <div>
                <p className="mb-2 font-mono text-xs font-medium uppercase tracking-wider" style={{ color: "var(--vital-meds)" }}>
                  Medications
                </p>
                <AddMedicineDialog onAdd={addMedicine} />
              </div>
            </div>
        </DialogContent>
      </Dialog>

      <div className="min-h-0 flex-1 overflow-hidden">
        <VitalsRings
          calories={Math.round(totalCalories)}
          calorieGoal={calorieGoal}
          waterMl={waterMl}
          waterGoalMl={waterGoalMl}
          medsTaken={todayMeds.reduce(
            (sum, m) => sum + m.times.filter((t) => doseLogs.get(m.id)?.has(t.id)).length,
            0,
          )}
          medsTotal={todayMeds.reduce((sum, m) => sum + m.times.length, 0)}
          onAddFood={addFood}
          onRemoveLastFood={removeLastFood}
          foodItems={foodItems}
          onDeleteFood={async (id) => { await deleteFoodItem(id); refetchCalories() }}
          waterIncrement={waterIncrement}
          waterUnitLabel={waterUnitLabel}
          waterDisplay={waterDisplay}
          waterGoalDisplay={waterGoalDisplay}
          onAdjustWater={adjustWater}
          medicines={todayMeds}
          doseLogs={doseLogs}
          onToggleDose={toggleDose}
          onAddMedicine={addMedicine}
          medDate={medDate}
          medDateObj={medDateObj}
          medIsToday={medIsToday}
          onMedDateChange={setMedDate}
          onDeleteMedicine={deleteMedicine}
        />
      </div>

      {/* (legacy three-column layout removed — replaced by the ring view above) */}
      <div className="hidden">
       <div className="grid h-full grid-cols-1 gap-1 overflow-y-auto p-1 @[420px]:grid-cols-3 @[420px]:gap-2 @[420px]:overflow-hidden">
        {/* Calories - inline +/- buttons with settings popover */}
        <div className="w-full min-w-0 rounded-lg px-3 py-2 @[420px]:flex @[420px]:flex-col @[420px]:justify-center">
          <div className="flex flex-wrap items-center justify-between gap-y-1.5">
            <div className="flex items-center gap-1.5">
              <span style={{ color: "var(--vital-calories)" }} className="opacity-80">
                <Flame className="size-3.5" />
              </span>
              <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Calories
              </span>
              <div className="flex items-baseline gap-1 ml-1">
                <span
                  className="font-[family-name:var(--font-display)] text-lg font-bold tabular-nums"
                  style={{ color: "var(--vital-calories)" }}
                >
                  {Math.round(totalCalories).toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground/50">
                  / {calorieGoal.toLocaleString()} cal
                </span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={removeLastFood}
                disabled={foodItems.length === 0}
                className="flex size-9 items-center justify-center rounded-lg border border-border/25 bg-muted/15 text-muted-foreground/60 transition-colors hover:border-border/40 hover:bg-muted/30 hover:text-foreground active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
              >
                <Minus className="size-3.5" />
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex size-9 items-center justify-center rounded-lg border border-border/25 bg-muted/15 text-muted-foreground/60 transition-colors hover:border-border/40 hover:bg-muted/30 hover:text-foreground active:scale-95">
                    <Plus className="size-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="left" className="w-60">
                  <p className="mb-3 font-mono text-xs font-medium uppercase tracking-wider" style={{ color: "var(--vital-calories)" }}>
                    Log Food
                  </p>
                  <form onSubmit={addFood} className="grid gap-2">
                    <Input name="name" placeholder="Food name" className="h-9 text-xs" />
                    <div className="flex gap-2">
                      <Input name="calories" type="number" placeholder="kcal" className="h-9 text-xs" />
                      <Button type="submit" size="sm" className="h-9 shrink-0">
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  </form>
                  {foodItems.length > 0 && (
                    <div className="mt-3 max-h-32 space-y-1 overflow-auto border-t border-border/10 pt-2">
                      {foodItems.map((f) => (
                        <div key={f.id} className="group flex items-center justify-between text-xs">
                          <span className="truncate text-muted-foreground">{f.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 font-mono text-foreground">{f.calories}</span>
                            <button
                              onClick={() => { deleteFoodItem(f.id).then(() => refetchCalories()) }}
                              className="hover-reveal text-muted-foreground/30 hover:text-destructive"
                            >
                              <Trash2 className="size-2.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border/30">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min((totalCalories / Math.max(calorieGoal, 1)) * 100, 100)}%`,
                background: "var(--vital-calories)",
                boxShadow: "0 0 8px var(--vital-calories)",
              }}
            />
          </div>
        </div>

        {/* Water - inline +/- buttons with settings popover */}
        <div className="w-full min-w-0 rounded-lg px-3 py-2 @[420px]:flex @[420px]:flex-col @[420px]:justify-center">
          <div className="flex flex-wrap items-center justify-between gap-y-1.5">
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
            <div className="ml-auto flex items-center gap-1">
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
        <div className="min-w-0 px-3 py-2 @[420px]:flex @[420px]:min-h-0 @[420px]:flex-col @[420px]:overflow-hidden">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Pill className="size-3.5 text-[var(--vital-meds)]" />
              <span className="font-[family-name:var(--font-display)] text-xs font-semibold tracking-tight text-[var(--vital-meds)]">
                Medications
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              {/* Date navigation */}
              <button
                onClick={() => setMedDate(format(addDays(medDateObj, -1), "yyyy-MM-dd"))}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "rounded-md px-2 py-1 font-mono text-xs transition-colors hover:bg-muted/40",
                      medIsToday
                        ? "text-[var(--vital-meds)]"
                        : "text-muted-foreground"
                    )}
                  >
                    {medIsToday ? "Today" : format(medDateObj, "MMM d")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar
                    mode="single"
                    selected={medDateObj}
                    onSelect={(date) => {
                      if (date) setMedDate(format(date, "yyyy-MM-dd"))
                    }}
                    disabled={{ after: new Date() }}
                  />
                </PopoverContent>
              </Popover>
              <button
                onClick={() => setMedDate(format(addDays(medDateObj, 1), "yyyy-MM-dd"))}
                disabled={medIsToday}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 disabled:opacity-30"
              >
                <ChevronRight className="size-3.5" />
              </button>
              <AddMedicineDialog onAdd={addMedicine} compact />
            </div>
          </div>

          {todayMeds.length === 0 ? (
            <p className="py-1 text-xs text-muted-foreground/50">
              No medications scheduled
            </p>
          ) : (
            <div className="space-y-1 @[420px]:min-h-0 @[420px]:flex-1 @[420px]:overflow-y-auto">
              {todayMeds
                .flatMap((med) => med.times.map((t) => ({ med, t })))
                .sort((a, b) => a.t.hour * 60 + a.t.minute - (b.t.hour * 60 + b.t.minute))
                .map(({ med, t }) => {
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
                          "flex size-4 shrink-0 items-center justify-center rounded border-2 transition-all",
                          taken ? "ts-inner-glass border-transparent" : "border-current/50",
                        )}
                      >
                        {taken && <Check className="size-2.5" />}
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
                })}
            </div>
          )}
        </div>
       </div>
      </div>
    </div>
  )
}

// ── Vitals Rings (Apple-Watch-style triple concentric ring) ─────────────────

interface VitalsRingsProps {
  calories: number
  calorieGoal: number
  waterMl: number
  waterGoalMl: number
  medsTaken: number
  medsTotal: number
  onAddFood: (e: React.FormEvent<HTMLFormElement>) => void
  onRemoveLastFood: () => void
  foodItems: FoodItem[]
  onDeleteFood: (id: string) => Promise<void>
  waterIncrement: number
  waterUnitLabel: string
  waterDisplay: number
  waterGoalDisplay: number
  onAdjustWater: (delta: number) => void
  medicines: MedicineItem[]
  doseLogs: Map<string, Set<string>>
  onToggleDose: (medId: string, timeId: string) => void
  onAddMedicine: Parameters<typeof AddMedicineDialog>[0]["onAdd"]
  medDate: string
  medDateObj: Date
  medIsToday: boolean
  onMedDateChange: (date: string) => void
  onDeleteMedicine: (id: string) => void
}

function VitalsRings({
  calories,
  calorieGoal,
  waterMl,
  waterGoalMl,
  medsTaken,
  medsTotal,
  onAddFood,
  onRemoveLastFood,
  foodItems,
  onDeleteFood,
  waterIncrement,
  waterUnitLabel,
  waterDisplay,
  waterGoalDisplay,
  onAdjustWater,
  medicines,
  doseLogs,
  onToggleDose,
  onAddMedicine,
  medDateObj,
  medIsToday,
  onMedDateChange,
  onDeleteMedicine,
}: VitalsRingsProps) {
  const calPct = calories / Math.max(calorieGoal, 1)
  const waterPct = waterMl / Math.max(waterGoalMl, 1)
  const medsPct = medsTotal > 0 ? medsTaken / medsTotal : 0

  return (
    <div className="flex h-full w-full items-center justify-center gap-2 px-5 py-4">
      {/* Concentric rings — outer: calories, middle: water, inner: meds */}
      <ConcentricRings
        size={200}
        rings={[
          { color: "var(--vital-calories)", colorEnd: "var(--vital-calories-2)", pct: calPct, track: 22 },
          { color: "var(--vital-water)", colorEnd: "var(--vital-water-2)", pct: waterPct, track: 22 },
          { color: "var(--vital-meds)", colorEnd: "var(--vital-meds-2)", pct: medsPct, track: 22 },
        ]}
        innerGap={6}
      />

      {/* Single readout column — all three vitals stacked, no nested cards. */}
      <div className="flex flex-col gap-3">
        {/* Calories */}
        <div className="flex items-center gap-3">
          <Flame className="size-4 shrink-0" style={{ color: "var(--vital-calories)" }} />
          <div className="flex shrink-0 flex-col leading-tight">
            <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground/60">Calories</span>
            <span
              className="font-mono text-xs tabular-nums"
              style={{ whiteSpace: "nowrap" }}
            >
              <span className="font-bold" style={{ color: "var(--vital-calories)" }}>{calories}</span>
              <span className="text-muted-foreground/50">{`/${calorieGoal}`}</span>
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {/* Spacer to keep + button aligned with Water's + (which is the second of two) */}
            <span className="block size-7" aria-hidden />
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted/30 hover:text-foreground">
                  <Plus className="size-3" />
                </button>
              </PopoverTrigger>
          <PopoverContent side="left" className="w-60">
            <p className="mb-3 font-mono text-xs font-medium uppercase tracking-wider" style={{ color: "var(--vital-calories)" }}>
              Log Food
            </p>
            <form onSubmit={onAddFood} className="grid gap-2">
              <Input name="name" placeholder="Food name" className="h-9 text-xs" />
              <div className="flex gap-2">
                <Input name="calories" type="number" placeholder="kcal" className="h-9 text-xs" />
                <Button type="submit" size="sm" className="h-9 shrink-0">
                  <Plus className="size-3" />
                </Button>
              </div>
            </form>
            {foodItems.length > 0 && (
              <div className="mt-3 max-h-32 space-y-1 overflow-auto border-t border-border/10 pt-2">
                {foodItems.map((f) => (
                  <div key={f.id} className="flex items-center justify-between text-xs">
                    <span className="truncate text-muted-foreground">{f.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 font-mono text-foreground">{f.calories}</span>
                      <button
                        onClick={() => onDeleteFood(f.id)}
                        className="text-muted-foreground/40 transition-colors hover:text-destructive"
                        aria-label="Delete food entry"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
          </div>
        </div>

        {/* Water — direct +/- buttons (no popover needed) */}
        <div className="flex items-center gap-3">
          <Droplets className="size-4 shrink-0" style={{ color: "var(--vital-water)" }} />
          <div className="flex shrink-0 flex-col leading-tight">
            <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground/60">Water</span>
            <span
              className="font-mono text-xs tabular-nums"
              style={{ whiteSpace: "nowrap" }}
            >
              <span className="font-bold" style={{ color: "var(--vital-water)" }}>{waterDisplay}</span>
              <span className="text-muted-foreground/50">{`/${waterGoalDisplay} ${waterUnitLabel}`}</span>
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => onAdjustWater(-waterIncrement)}
              disabled={waterMl <= 0}
              className="flex size-7 items-center justify-center rounded-md bg-transparent text-muted-foreground/60 transition-colors hover:bg-muted/30 hover:text-foreground disabled:opacity-30"
            >
              <Minus className="size-3" />
            </button>
            <button
              onClick={() => onAdjustWater(waterIncrement)}
              className="flex size-7 items-center justify-center rounded-md bg-transparent text-muted-foreground/60 transition-colors hover:bg-muted/30 hover:text-foreground"
            >
              <Plus className="size-3" />
            </button>
          </div>
        </div>

        {/* Medications */}
        <div className="flex items-center gap-3">
          <Pill className="size-4 shrink-0" style={{ color: "var(--vital-meds)" }} />
          <div className="flex shrink-0 flex-col leading-tight">
            <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground/60">Meds</span>
            <span
              className="font-mono text-xs tabular-nums"
              style={{ whiteSpace: "nowrap" }}
            >
              <span className="font-bold" style={{ color: "var(--vital-meds)" }}>{medsTaken}</span>
              <span className="text-muted-foreground/50">{`/${medsTotal}`}</span>
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <span className="block size-7" aria-hidden />
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted/30 hover:text-foreground">
                  <Plus className="size-3" />
                </button>
              </PopoverTrigger>
          <PopoverContent side="left" className="w-72">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-xs font-medium uppercase tracking-wider" style={{ color: "var(--vital-meds)" }}>
                Medications
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => onMedDateChange(format(addDays(medDateObj, -1), "yyyy-MM-dd"))}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <span className="px-2 font-mono text-xs text-muted-foreground">
                  {medIsToday ? "Today" : format(medDateObj, "MMM d")}
                </span>
                <button
                  onClick={() => onMedDateChange(format(addDays(medDateObj, 1), "yyyy-MM-dd"))}
                  disabled={medIsToday}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 disabled:opacity-30"
                >
                  <ChevronRight className="size-3.5" />
                </button>
                <AddMedicineDialog onAdd={onAddMedicine} compact />
              </div>
            </div>
            {medicines.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground/50">
                No medications scheduled
              </p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-auto">
                {medicines
                  .flatMap((med) => med.times.map((t) => ({ med, t })))
                  .sort((a, b) => a.t.hour * 60 + a.t.minute - (b.t.hour * 60 + b.t.minute))
                  .map(({ med, t }) => {
                    const taken = doseLogs.get(med.id)?.has(t.id) ?? false
                    const timeStr = `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`
                    return (
                      <div key={`${med.id}-${t.id}`} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/30">
                        <button
                          onClick={() => onToggleDose(med.id, t.id)}
                          className="flex flex-1 items-center gap-2 text-left"
                        >
                          <div
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded border-2 transition-all",
                              taken ? "ts-inner-glass border-transparent" : "border-current/50",
                            )}
                          >
                            {taken && <Check className="size-2.5" />}
                          </div>
                          <span className={cn("flex-1 text-xs", taken && "text-muted-foreground line-through")}>
                            {med.name}
                            {med.dosage && <span className="ml-1 text-muted-foreground/50">{med.dosage}</span>}
                          </span>
                          <span className={cn("font-mono text-xs", taken ? "text-muted-foreground/40" : "text-muted-foreground")}>
                            {timeStr}
                          </span>
                        </button>
                        <button
                          onClick={() => onDeleteMedicine(med.id)}
                          className="hover-reveal text-muted-foreground/30 hover:text-destructive"
                        >
                          <Trash2 className="size-2.5" />
                        </button>
                      </div>
                    )
                  })}
              </div>
            )}
          </PopoverContent>
        </Popover>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ConcentricRingsProps {
  size: number
  rings: { color: string; colorEnd?: string; pct: number; track: number }[]
  /** Extra spacing applied between consecutive rings (in addition to track). */
  innerGap?: number
}

function ConcentricRings({ size, rings, innerGap = 2 }: ConcentricRingsProps) {
  const cx = size / 2
  const cy = size / 2
  const reactId = useId()
  // useId values can include characters (":") that aren't valid in SVG id refs
  // via url(#…); strip them. Stable across SSR/client so no hydration mismatch.
  const gradId = `vr-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`
  const outerCapInset = rings[0]?.track ? rings[0].track / 2 : 0
  return (
    <svg
      width={size}
      height={size}
      className="-rotate-90 shrink-0"
      style={{ overflow: "visible" }}
    >
      <defs>
        {rings.map((ring, i) => (
          <linearGradient key={i} id={`${gradId}-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={ring.color} />
            <stop offset="100%" stopColor={ring.colorEnd ?? ring.color} />
          </linearGradient>
        ))}
      </defs>
      {rings.map((ring, i) => {
        const offset = i === 0
          ? outerCapInset
          : outerCapInset + rings.slice(0, i).reduce((s, r) => s + r.track + innerGap, 0)
        const r = (size - ring.track) / 2 - offset
        if (r <= 0) return null
        const c = 2 * Math.PI * r
        const stroke = `url(#${gradId}-${i})`
        const totalPct = ring.pct
        const overshoot = totalPct > 1
        // Visible-arc fraction: the part drawn from the top.
        // For overshoot, that's (pct − 1) % 1 which gives where on the next
        // lap the leading edge sits. The base lap is drawn separately.
        const visiblePct = overshoot ? ((totalPct - 1) % 1) : totalPct
        const dash = c * visiblePct
        const tipAngle = visiblePct * Math.PI * 2
        const tipX = cx + r * Math.cos(tipAngle)
        const tipY = cy + r * Math.sin(tipAngle)
        const showTipIndicator = totalPct > 0.001 && (overshoot || totalPct < 0.999)
        return (
          <g key={i}>
            {/* Track */}
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={ring.color}
              strokeOpacity={0.15}
              strokeWidth={ring.track}
            />
            {/* Full base lap (only when overshooting) */}
            {overshoot && (
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={stroke}
                strokeWidth={ring.track}
              />
            )}
            {/* Leading-cap shadow — filled circle at the tip with a drop
                shadow. The 2nd-lap arc drawn on top covers the trailing
                half of the shadow, leaving only the "underneath" shadow
                visible at the leading edge so the cap reads as layered on
                top of the 1st lap. */}
            {overshoot && dash > 0.01 && (
              <circle
                cx={tipX}
                cy={tipY}
                r={ring.track / 2}
                fill={ring.color}
                style={{
                  filter: `drop-shadow(0 ${ring.track * 0.18}px ${ring.track * 0.35}px rgba(0,0,0,0.55))`,
                  transition: "cx 0.6s ease, cy 0.6s ease",
                }}
              />
            )}
            {/* Progress arc — for non-overshoot this is the only arc; for
                overshoot it sits on top of the full base lap, covering the
                trailing part of the cap shadow. */}
            {dash > 0.01 && (
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={stroke}
                strokeWidth={ring.track}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${c}`}
                style={{ transition: "stroke-dasharray 0.6s ease" }}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Add Medicine Dialog ─────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function AddMedicineDialog({
  onAdd,
  compact = false,
}: {
  onAdd: (data: {
    name: string
    dosage: string
    times: { hour: number; minute: number; id: string }[]
    repeatPattern: "daily" | "every_other_day" | "custom"
    activeDays: number[]
  }) => Promise<void>
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [dosage, setDosage] = useState("")
  const [times, setTimes] = useState<{ hour: number; minute: number; id: string }[]>([
    { hour: 8, minute: 0, id: "default-time-0" },
  ])
  const [repeatPattern, setRepeatPattern] = useState<"daily" | "every_other_day" | "custom">("daily")
  const [activeDays, setActiveDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])

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

  const toggleDay = (day: number) => {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || times.length === 0) return
    await onAdd({ name: name.trim(), dosage: dosage.trim(), times, repeatPattern, activeDays })
    setOpen(false)
    setName("")
    setDosage("")
    setTimes([{ hour: 8, minute: 0, id: crypto.randomUUID() }])
    setRepeatPattern("daily")
    setActiveDays([0, 1, 2, 3, 4, 5, 6])
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? (
          <button className="flex size-11 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-muted/20 hover:text-muted-foreground">
            <Plus className="size-4" />
          </button>
        ) : (
          <Button variant="outline" size="sm" className="w-full text-xs">
            <Plus className="size-3" />
            Add Medicine
          </Button>
        )}
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
          <div className="grid gap-2">
            <Label>Frequency</Label>
            <div className="flex gap-1.5">
              {(
                [
                  { value: "daily", label: "Daily" },
                  { value: "every_other_day", label: "Every Other Day" },
                  { value: "custom", label: "Custom" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRepeatPattern(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    repeatPattern === opt.value
                      ? "bg-rose-500/15 text-rose-400"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {repeatPattern === "custom" && (
              <div className="flex gap-1">
                {DAY_LABELS.map((label, i) => {
                  const active = activeDays.includes(i)
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`flex size-9 items-center justify-center rounded-lg text-xs font-medium transition-all ${
                        active
                          ? "bg-rose-500/15 text-rose-400"
                          : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <Button type="submit">Save Medicine</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
