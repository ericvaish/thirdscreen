"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Flag, Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type TabMode = "timer" | "stopwatch" | "alarm";

interface TimerCardProps {
  cardId: string;
}

function pad2(n: number) {
  return String(Math.floor(n)).padStart(2, "0");
}

function formatMs(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h, m, s };
}

function formatStopwatch(ms: number) {
  const totalMs = Math.max(0, ms);
  const mins = Math.floor(totalMs / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const centis = Math.floor((totalMs % 1000) / 10);
  return `${pad2(mins)}:${pad2(secs)}.${pad2(centis)}`;
}

function ProgressRing({
  progress,
  size = 160,
  strokeWidth = 4,
  children,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  children: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-emerald-400 transition-all duration-200"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

function TimeInput({
  value,
  onChange,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  max: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value) || 0;
          onChange(Math.min(max, Math.max(0, v)));
        }}
        className="w-14 rounded-lg border border-border bg-background/60 px-1 py-1.5 text-center font-mono text-lg text-foreground outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
      />
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
        {label}
      </span>
    </div>
  );
}

function TimerMode() {
  const [inputH, setInputH] = useState(0);
  const [inputM, setInputM] = useState(5);
  const [inputS, setInputS] = useState(0);
  const [totalMs, setTotalMs] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(() => {
    const ms =
      remainingMs > 0
        ? remainingMs
        : (inputH * 3600 + inputM * 60 + inputS) * 1000;
    if (ms <= 0) return;
    if (remainingMs <= 0) setTotalMs(ms);
    setRemainingMs(ms);
    setFinished(false);
    endTimeRef.current = Date.now() + ms;
    setRunning(true);
    cleanup();
    intervalRef.current = setInterval(() => {
      const left = endTimeRef.current - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        setRunning(false);
        setFinished(true);
        cleanup();
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          osc.type = "sine";
          gain.gain.value = 0.3;
          osc.start();
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
          osc.stop(ctx.currentTime + 1.5);
        } catch {}
        try {
          if (Notification.permission === "granted") {
            new Notification("Timer Complete", {
              body: "Your countdown timer has finished!",
            });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
          }
        } catch {}
      } else {
        setRemainingMs(left);
      }
    }, 50);
  }, [inputH, inputM, inputS, remainingMs, cleanup]);

  const pause = useCallback(() => {
    setRunning(false);
    cleanup();
  }, [cleanup]);

  const reset = useCallback(() => {
    setRunning(false);
    setFinished(false);
    setRemainingMs(0);
    setTotalMs(0);
    cleanup();
  }, [cleanup]);

  const { h, m, s } = formatMs(remainingMs);
  const progress = totalMs > 0 ? remainingMs / totalMs : 0;
  const isIdle = !running && remainingMs === 0 && !finished;

  return (
    <div className="flex flex-col items-center gap-3">
      {isIdle ? (
        <div className="flex items-center gap-2">
          <TimeInput value={inputH} onChange={setInputH} max={99} label="hrs" />
          <span className="mt-[-16px] font-mono text-lg text-muted-foreground/30">:</span>
          <TimeInput
            value={inputM}
            onChange={setInputM}
            max={59}
            label="min"
          />
          <span className="mt-[-16px] font-mono text-lg text-muted-foreground/30">:</span>
          <TimeInput
            value={inputS}
            onChange={setInputS}
            max={59}
            label="sec"
          />
        </div>
      ) : (
        <ProgressRing progress={progress}>
          <span
            className={`font-mono text-3xl font-bold ${finished ? "animate-pulse text-red-400" : "text-foreground"}`}
          >
            {pad2(h)}:{pad2(m)}:{pad2(s)}
          </span>
        </ProgressRing>
      )}

      <div className="flex gap-2">
        {!running ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={start}
            className="text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
          >
            <Play className="mr-1 size-3.5" />
            {remainingMs > 0 ? "Resume" : "Start"}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={pause}
            className="text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
          >
            <Pause className="mr-1 size-3.5" />
            Pause
          </Button>
        )}
        {(remainingMs > 0 || finished) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="mr-1 size-3.5" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}

function StopwatchMode() {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const accumulatedRef = useRef(0);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(() => {
    startTimeRef.current = Date.now();
    setRunning(true);
    cleanup();
    intervalRef.current = setInterval(() => {
      setElapsedMs(accumulatedRef.current + (Date.now() - startTimeRef.current));
    }, 30);
  }, [cleanup]);

  const pause = useCallback(() => {
    accumulatedRef.current += Date.now() - startTimeRef.current;
    setRunning(false);
    cleanup();
  }, [cleanup]);

  const reset = useCallback(() => {
    setRunning(false);
    setElapsedMs(0);
    setLaps([]);
    accumulatedRef.current = 0;
    cleanup();
  }, [cleanup]);

  const lap = useCallback(() => {
    setLaps((prev) => [elapsedMs, ...prev]);
  }, [elapsedMs]);

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="font-mono text-4xl font-bold tracking-tight text-foreground">
        {formatStopwatch(elapsedMs)}
      </span>

      <div className="flex gap-2">
        {!running ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={start}
            className="text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
          >
            <Play className="mr-1 size-3.5" />
            {elapsedMs > 0 ? "Resume" : "Start"}
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={pause}
              className="text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
            >
              <Pause className="mr-1 size-3.5" />
              Pause
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={lap}
              className="text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
            >
              <Flag className="mr-1 size-3.5" />
              Lap
            </Button>
          </>
        )}
        {elapsedMs > 0 && !running && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="mr-1 size-3.5" />
            Reset
          </Button>
        )}
      </div>

      {laps.length > 0 && (
        <div className="mt-1 max-h-28 w-full overflow-y-auto">
          <div className="space-y-0.5">
            {laps.map((lapMs, i) => (
              <div
                key={i}
                className="flex justify-between rounded px-3 py-0.5 text-xs transition-colors hover:bg-muted/30"
              >
                <span className="text-muted-foreground/50">Lap {laps.length - i}</span>
                <span className="font-mono text-muted-foreground">
                  {formatStopwatch(lapMs)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AlarmMode() {
  const [alarmH, setAlarmH] = useState(8);
  const [alarmM, setAlarmM] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!enabled || !now) return;
    const cleanup = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    cleanup();
    firedRef.current = false;
    intervalRef.current = setInterval(() => {
      const current = new Date();
      if (
        current.getHours() === alarmH &&
        current.getMinutes() === alarmM &&
        current.getSeconds() === 0 &&
        !firedRef.current
      ) {
        firedRef.current = true;
        try {
          const ctx = new AudioContext();
          for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = "sine";
            gain.gain.value = 0.3;
            osc.start(ctx.currentTime + i * 0.6);
            gain.gain.exponentialRampToValueAtTime(
              0.001,
              ctx.currentTime + i * 0.6 + 0.4
            );
            osc.stop(ctx.currentTime + i * 0.6 + 0.4);
          }
        } catch {}
        try {
          if (Notification.permission === "granted") {
            new Notification("Alarm", {
              body: `It's ${pad2(alarmH)}:${pad2(alarmM)}!`,
            });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
          }
        } catch {}
        setEnabled(false);
      }
    }, 500);
    return cleanup;
  }, [enabled, alarmH, alarmM, now]);

  let remainingText = "";
  if (enabled && now) {
    const alarmToday = new Date(now);
    alarmToday.setHours(alarmH, alarmM, 0, 0);
    let diff = alarmToday.getTime() - now.getTime();
    if (diff <= 0) diff += 24 * 60 * 60 * 1000;
    const { h, m, s } = formatMs(diff);
    remainingText = `${h}h ${pad2(m)}m ${pad2(s)}s remaining`;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <TimeInput value={alarmH} onChange={setAlarmH} max={23} label="hour" />
        <span className="mt-[-16px] font-mono text-lg text-muted-foreground/30">:</span>
        <TimeInput
          value={alarmM}
          onChange={setAlarmM}
          max={59}
          label="min"
        />
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setEnabled((e) => !e);
          firedRef.current = false;
          try {
            if (Notification.permission === "default") {
              Notification.requestPermission();
            }
          } catch {}
        }}
        className={
          enabled
            ? "text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
            : "text-muted-foreground hover:text-foreground"
        }
      >
        {enabled ? (
          <Bell className="mr-1 size-3.5" />
        ) : (
          <BellOff className="mr-1 size-3.5" />
        )}
        {enabled ? "Alarm On" : "Set Alarm"}
      </Button>

      {enabled && remainingText && (
        <p className="text-xs text-muted-foreground/50">{remainingText}</p>
      )}
    </div>
  );
}

const tabs: { key: TabMode; label: string }[] = [
  { key: "timer", label: "Timer" },
  { key: "stopwatch", label: "Stopwatch" },
  { key: "alarm", label: "Alarm" },
];

export default function TimerCard({ cardId: _cardId }: TimerCardProps) {
  const [activeTab, setActiveTab] = useState<TabMode>("timer");

  return (
    <div className="flex h-full flex-col p-3">
      {/* Tab bar */}
      <div className="mb-3 flex rounded-lg bg-muted/30 p-0.5">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 rounded-md px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider transition-all ${
              activeTab === key
                ? "bg-emerald-500/15 text-emerald-400 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center">
        {activeTab === "timer" && <TimerMode />}
        {activeTab === "stopwatch" && <StopwatchMode />}
        {activeTab === "alarm" && <AlarmMode />}
      </div>
    </div>
  );
}
