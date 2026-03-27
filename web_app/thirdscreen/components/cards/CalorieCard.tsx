"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Minus,
  Trash2,
  Flame,
  GlassWater,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { FoodItem } from "@/lib/types";

interface CalorieCardProps {
  cardId: string;
}

function storageKey(cardId: string, key: string) {
  return `calorie-card-${cardId}-${key}`;
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

interface WaterData {
  intake: number;
  goal: number;
}

export default function CalorieCard({ cardId }: CalorieCardProps) {
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const week = useMemo(() => buildWeek(today), [today]);

  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("2000");

  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loadingFoods, setLoadingFoods] = useState(false);

  const [foodName, setFoodName] = useState("");
  const [foodCals, setFoodCals] = useState("");

  const [water, setWater] = useState<WaterData>({ intake: 0, goal: 2000 });

  const dateKey = formatDateKey(selectedDate);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey(cardId, "calorieGoal"));
      if (stored) {
        const val = Number(stored);
        if (!isNaN(val) && val > 0) {
          setCalorieGoal(val);
          setGoalInput(String(val));
        }
      }
    } catch {}
  }, [cardId]);

  const fetchFoods = useCallback(async () => {
    setLoadingFoods(true);
    try {
      const res = await fetch(
        `/api/calories?cardId=${encodeURIComponent(cardId)}&date=${dateKey}`
      );
      if (res.ok) {
        const data: FoodItem[] = await res.json();
        setFoods(data);
      }
    } catch {
    } finally {
      setLoadingFoods(false);
    }
  }, [cardId, dateKey]);

  useEffect(() => {
    fetchFoods();
  }, [fetchFoods]);

  const fetchWater = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/calories/water?cardId=${encodeURIComponent(cardId)}&date=${dateKey}`
      );
      if (res.ok) {
        const data = await res.json();
        setWater({
          intake: data.intake ?? 0,
          goal: data.goal ?? 2000,
        });
      }
    } catch {}
  }, [cardId, dateKey]);

  useEffect(() => {
    fetchWater();
  }, [fetchWater]);

  const addFood = async () => {
    const name = foodName.trim();
    const cals = Number(foodCals);
    if (!name || isNaN(cals) || cals <= 0) return;

    try {
      const res = await fetch("/api/calories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, name, calories: cals, date: dateKey }),
      });
      if (res.ok) {
        setFoodName("");
        setFoodCals("");
        fetchFoods();
      }
    } catch {}
  };

  const deleteFood = async (id: string) => {
    try {
      const res = await fetch(`/api/calories?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFoods((prev) => prev.filter((f) => f.id !== id));
      }
    } catch {}
  };

  const updateWater = async (delta: number) => {
    const newIntake = Math.max(0, water.intake + delta);
    setWater((prev) => ({ ...prev, intake: newIntake }));
    try {
      await fetch("/api/calories/water", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, date: dateKey, intake: newIntake }),
      });
    } catch {}
  };

  const saveGoal = () => {
    const val = Number(goalInput);
    if (!isNaN(val) && val > 0) {
      setCalorieGoal(val);
      try {
        localStorage.setItem(storageKey(cardId, "calorieGoal"), String(val));
      } catch {}
    }
    setEditingGoal(false);
  };

  const consumed = foods.reduce((sum, f) => sum + f.calories, 0);
  const remaining = calorieGoal - consumed;
  const progressPct = Math.min(100, (consumed / calorieGoal) * 100);
  const isOver = remaining < 0;

  const waterGlasses = 8;
  const filledGlasses = Math.min(
    waterGlasses,
    Math.round((water.intake / water.goal) * waterGlasses)
  );

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
                    ? "bg-orange-500/15 text-orange-400 shadow-sm"
                    : isDayToday
                      ? "text-orange-400/60"
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

      {/* Calorie summary */}
      <div className="rounded-xl bg-muted/20 p-3 ring-1 ring-border/50">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Flame className="size-3.5 text-orange-400" />
            Calories
          </div>
          {editingGoal ? (
            <div className="flex items-center gap-1">
              <Input
                className="h-5 w-16 px-1 text-xs"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveGoal();
                  if (e.key === "Escape") setEditingGoal(false);
                }}
                autoFocus
              />
              <Button variant="ghost" size="icon-xs" onClick={saveGoal}>
                <Plus className="size-3" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => {
                setGoalInput(String(calorieGoal));
                setEditingGoal(true);
              }}
              className="font-mono text-xs text-muted-foreground hover:text-foreground"
            >
              Goal: {calorieGoal}
            </button>
          )}
        </div>

        <Progress value={progressPct} className="mb-2 h-1.5" />

        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-muted-foreground">
            {consumed} / {calorieGoal} kcal
          </span>
          <span
            className={`font-medium ${isOver ? "text-red-400" : "text-emerald-400"}`}
          >
            {isOver
              ? `${Math.abs(remaining)} over`
              : `${remaining} remaining`}
          </span>
        </div>
      </div>

      {/* Water section */}
      <div className="rounded-xl bg-muted/20 p-3 ring-1 ring-border/50">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <GlassWater className="size-3.5 text-blue-400" />
            Water
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {water.intake}ml / {water.goal}ml
          </span>
        </div>

        <div className="mb-2 flex gap-1">
          {Array.from({ length: waterGlasses }).map((_, i) => (
            <GlassWater
              key={i}
              className={`size-4 transition-all duration-200 ${
                i < filledGlasses ? "text-blue-400" : "text-muted-foreground/20"
              }`}
            />
          ))}
        </div>

        <div className="flex gap-1">
          <Button
            variant="outline"
            size="xs"
            onClick={() => updateWater(250)}
            className="text-xs"
          >
            <Plus className="mr-0.5 size-3" />
            250ml
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => updateWater(500)}
            className="text-xs"
          >
            <Plus className="mr-0.5 size-3" />
            500ml
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => updateWater(-250)}
            className="text-xs"
          >
            <Minus className="mr-0.5 size-3" />
            250ml
          </Button>
        </div>
      </div>

      {/* Add food */}
      <div className="flex gap-1.5">
        <Input
          className="h-7 flex-1 text-xs"
          placeholder="Food name"
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addFood();
          }}
        />
        <Input
          className="h-7 w-16 font-mono text-xs"
          placeholder="kcal"
          type="number"
          value={foodCals}
          onChange={(e) => setFoodCals(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addFood();
          }}
        />
        <Button variant="default" size="xs" onClick={addFood}>
          <Plus className="size-3" />
        </Button>
      </div>

      {/* Food list */}
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {loadingFoods && foods.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground animate-pulse">
            Loading...
          </p>
        )}
        {!loadingFoods && foods.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground/40">
            No food logged for this day
          </p>
        )}
        {foods.map((item) => (
          <div
            key={item.id}
            className="group flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/20"
          >
            <span className="truncate text-xs text-foreground">
              {item.name}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {item.calories} kcal
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100"
                onClick={() => deleteFood(item.id)}
              >
                <Trash2 className="size-3 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
