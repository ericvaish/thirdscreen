"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { flushSync } from "react-dom"

import { cn } from "@/lib/utils"

/**
 * Animate a theme change with a circular clip-path view transition expanding
 * from the given element. Falls back to instant switch if View Transitions API
 * is not supported.
 */
export function animatedSetTheme(
  setTheme: (theme: string) => void,
  newTheme: string,
  origin: HTMLElement | { x: number; y: number },
  duration = 400
) {
  let x: number, y: number
  if (origin instanceof HTMLElement) {
    const rect = origin.getBoundingClientRect()
    x = rect.left + rect.width / 2
    y = rect.top + rect.height / 2
  } else {
    x = origin.x
    y = origin.y
  }

  const vw = window.visualViewport?.width ?? window.innerWidth
  const vh = window.visualViewport?.height ?? window.innerHeight
  const maxRadius = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y))

  const apply = () => setTheme(newTheme)

  if (typeof document.startViewTransition !== "function") {
    apply()
    return
  }

  const transition = document.startViewTransition(() => {
    flushSync(apply)
  })

  const ready = transition?.ready
  if (ready && typeof ready.then === "function") {
    ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        }
      )
    })
  }
}

// ── Toggle button component ──────────────────────────────────────────────

interface AnimatedThemeTogglerProps
  extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number
}

export function AnimatedThemeToggler({
  className,
  duration = 400,
  ...props
}: AnimatedThemeTogglerProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === "dark"

  const toggleTheme = useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    animatedSetTheme(setTheme, isDark ? "light" : "dark", button, duration)
  }, [isDark, duration, setTheme])

  if (!mounted) return <div className="size-9" />

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={toggleTheme}
      className={cn(
        "flex size-9 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-neutral-600 dark:text-white/40 dark:hover:text-white/70",
        className
      )}
      title="Toggle theme"
      {...props}
    >
      {isDark ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
