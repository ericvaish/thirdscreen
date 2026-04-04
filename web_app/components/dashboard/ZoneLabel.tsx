"use client"

import { useEffect, useState } from "react"

/**
 * Zone header label that switches between a colored vertical line
 * and a colored icon based on the theme setting (data-zone-label on :root).
 *
 * Usage:
 *   <ZoneLabel accentVar="--zone-tasks-accent" icon={<ListChecks className="size-4" />}>
 *     Tasks
 *   </ZoneLabel>
 */
export function ZoneLabel({
  accentVar,
  icon,
  children,
}: {
  /** CSS custom property name for the zone accent, e.g. "--zone-tasks-accent" */
  accentVar: string
  /** Icon element to show in "icon" mode */
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const [style, setStyle] = useState<"line" | "icon">("line")

  useEffect(() => {
    function read() {
      const val = document.documentElement.getAttribute("data-zone-label")
      setStyle((val === "icon" ? "icon" : "line") as "line" | "icon")
    }
    read()

    // Watch for changes (theme customizer sets this attribute)
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-zone-label"],
    })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex items-center gap-1.5">
      {style === "line" ? (
        <div
          className="h-5 w-[3px] rounded-full"
          style={{ background: `var(${accentVar})` }}
        />
      ) : (
        <div style={{ color: `var(${accentVar})` }}>
          {icon}
        </div>
      )}
      <span
        className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight"
        style={{ color: `var(${accentVar})` }}
      >
        {children}
      </span>
    </div>
  )
}
