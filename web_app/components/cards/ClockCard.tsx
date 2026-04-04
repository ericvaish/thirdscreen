"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, ChevronDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type DisplayStyle = "digital" | "minimal" | "status-board";

interface ClockCardProps {
  cardId: string;
}

function getStorageKey(cardId: string, key: string) {
  return `clock-card-${cardId}-${key}`;
}

function formatDate(date: Date): string {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function DigitBox({ char }: { char: string }) {
  return (
    <span className="inline-flex h-[1.4em] min-w-[1em] items-center justify-center rounded-md bg-background/60 px-2 font-mono text-inherit leading-none shadow-inner ring-1 ring-border">
      {char}
    </span>
  );
}

export default function ClockCard({ cardId }: ClockCardProps) {
  const [now, setNow] = useState<Date | null>(null);
  const [is24Hour, setIs24Hour] = useState(false);
  const [showSeconds, setShowSeconds] = useState(true);
  const [style, setStyle] = useState<DisplayStyle>("digital");
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const [tick, setTick] = useState(false);

  useEffect(() => {
    try {
      const stored24 = localStorage.getItem(getStorageKey(cardId, "is24Hour"));
      if (stored24 !== null) setIs24Hour(stored24 === "true");
      const storedSec = localStorage.getItem(
        getStorageKey(cardId, "showSeconds")
      );
      if (storedSec !== null) setShowSeconds(storedSec === "true");
      const storedStyle = localStorage.getItem(
        getStorageKey(cardId, "style")
      ) as DisplayStyle | null;
      if (storedStyle) setStyle(storedStyle);
    } catch {}
    setNow(new Date());
  }, [cardId]);

  const toggle24Hour = useCallback(() => {
    setIs24Hour((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(getStorageKey(cardId, "is24Hour"), String(next));
      } catch {}
      return next;
    });
  }, [cardId]);

  const toggleSeconds = useCallback(() => {
    setShowSeconds((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(
          getStorageKey(cardId, "showSeconds"),
          String(next)
        );
      } catch {}
      return next;
    });
  }, [cardId]);

  const changeStyle = useCallback(
    (s: DisplayStyle) => {
      setStyle(s);
      setStyleDropdownOpen(false);
      try {
        localStorage.setItem(getStorageKey(cardId, "style"), s);
      } catch {}
    },
    [cardId]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setTick((t) => !t);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!now) return null;

  const hours24 = now.getHours();
  const hours12 = hours24 % 12 || 12;
  const displayHours = is24Hour ? hours24 : hours12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const ampm = hours24 >= 12 ? "PM" : "AM";

  const hStr = String(displayHours).padStart(2, "0");
  const mStr = String(minutes).padStart(2, "0");
  const sStr = String(seconds).padStart(2, "0");

  const styleLabels: Record<DisplayStyle, string> = {
    digital: "Digital",
    minimal: "Minimal",
    "status-board": "Status Board",
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
      {/* Time display */}
      <div className="flex flex-col items-center gap-1">
        {style === "digital" && (
          <div className="flex items-baseline gap-0.5 font-mono text-5xl font-bold tracking-tight text-foreground md:text-6xl">
            <span className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">{hStr}</span>
            <span
              className={`text-cyan-400 transition-opacity duration-300 ${tick ? "opacity-100" : "opacity-20"}`}
            >
              :
            </span>
            <span className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">{mStr}</span>
            {showSeconds && (
              <>
                <span
                  className={`text-cyan-400 transition-opacity duration-300 ${tick ? "opacity-100" : "opacity-20"}`}
                >
                  :
                </span>
                <span className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">{sStr}</span>
              </>
            )}
            {!is24Hour && (
              <span className="ml-2 text-lg font-medium text-muted-foreground">
                {ampm}
              </span>
            )}
          </div>
        )}

        {style === "minimal" && (
          <div className="flex items-baseline gap-1 text-5xl font-extralight tracking-widest text-foreground/80 md:text-6xl">
            <span>{hStr}</span>
            <span className="text-muted-foreground/40">:</span>
            <span>{mStr}</span>
            {showSeconds && (
              <>
                <span className="text-muted-foreground/40">:</span>
                <span className="text-3xl text-muted-foreground md:text-4xl">
                  {sStr}
                </span>
              </>
            )}
            {!is24Hour && (
              <span className="ml-2 text-base font-light tracking-normal text-muted-foreground/40">
                {ampm}
              </span>
            )}
          </div>
        )}

        {style === "status-board" && (
          <div className="flex items-baseline gap-1.5 font-mono text-5xl font-bold text-cyan-400 md:text-6xl">
            <DigitBox char={hStr[0]} />
            <DigitBox char={hStr[1]} />
            <span
              className={`px-0.5 transition-opacity duration-300 ${tick ? "opacity-100" : "opacity-20"}`}
            >
              :
            </span>
            <DigitBox char={mStr[0]} />
            <DigitBox char={mStr[1]} />
            {showSeconds && (
              <>
                <span
                  className={`px-0.5 transition-opacity duration-300 ${tick ? "opacity-100" : "opacity-20"}`}
                >
                  :
                </span>
                <DigitBox char={sStr[0]} />
                <DigitBox char={sStr[1]} />
              </>
            )}
            {!is24Hour && (
              <span className="ml-2 text-lg font-medium text-cyan-400/50">
                {ampm}
              </span>
            )}
          </div>
        )}

        {/* Date */}
        <p
          className={`mt-1 text-sm ${
            style === "status-board" ? "text-cyan-300/40" : "text-muted-foreground/50"
          }`}
        >
          {formatDate(now)}
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="xs"
          onClick={toggle24Hour}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          <Clock className="mr-1 size-3" />
          {is24Hour ? "24h" : "12h"}
        </Button>

        <Button
          variant="ghost"
          size="xs"
          onClick={toggleSeconds}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showSeconds ? (
            <Eye className="mr-1 size-3" />
          ) : (
            <EyeOff className="mr-1 size-3" />
          )}
          sec
        </Button>

        {/* Style dropdown */}
        <div className="relative">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setStyleDropdownOpen((o) => !o)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {styleLabels[style]}
            <ChevronDown className="ml-1 size-3" />
          </Button>
          {styleDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setStyleDropdownOpen(false)}
              />
              <div className="absolute top-full right-0 z-50 mt-1 min-w-[120px] overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-xl">
                {(
                  Object.entries(styleLabels) as [DisplayStyle, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => changeStyle(key)}
                    className={`w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent ${
                      style === key ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
