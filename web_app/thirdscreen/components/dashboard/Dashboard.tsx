"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { StatusBar } from "@/components/zones/StatusBar"
import { SettingsView } from "./SettingsView"
import { GridDashboard, type MinSizes } from "./GridDashboard"
import { DashboardContext } from "./DashboardContext"
import { Button } from "@/components/ui/button"
import {
  Settings,
  ArrowLeft,
  Grid3x3,
  Sun,
  Moon,
  Monitor,
  Maximize,
  Minimize,
  RotateCcw,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useAuth, UserButton, SignInButton } from "@clerk/nextjs"
import { getSettings, setSetting } from "@/lib/data-layer"
import { toast } from "sonner"
import { ThemeCustomizer } from "./ThemeCustomizer"
import {
  DEFAULT_DASHBOARD_LAYOUT,
  migrateLayout,
  type DashboardLayout,
} from "@/lib/grid-layout"

type View = "dashboard" | "settings"

const THEME_CYCLE = ["dark", "light", "system"] as const
const THEME_ICON = { dark: Moon, light: Sun, system: Monitor }

// ── Dashboard ───────────────────────────────────────────────────────────────

export function Dashboard() {
  const [view, setView] = useState<View>("dashboard")
  const { theme, setTheme } = useTheme()
  // Orientation-aware layouts: portrait and landscape each get their own saved layout
  type Orientation = "portrait" | "landscape"
  const [orientation, setOrientation] = useState<Orientation>(
    typeof window !== "undefined" && window.innerHeight > window.innerWidth
      ? "portrait"
      : "landscape",
  )
  const [portraitLayout, setPortraitLayout] = useState<DashboardLayout>(DEFAULT_DASHBOARD_LAYOUT)
  const [landscapeLayout, setLandscapeLayout] = useState<DashboardLayout>(DEFAULT_DASHBOARD_LAYOUT)

  // Active layout is derived from current orientation
  const layout = orientation === "portrait" ? portraitLayout : landscapeLayout
  const setLayout = orientation === "portrait" ? setPortraitLayout : setLandscapeLayout

  const [minSizes, setMinSizes] = useState<MinSizes>({})
  const [editMode, setEditMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { isSignedIn, isLoaded: authLoaded } = useAuth()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const minSizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setMounted(true), [])

  // Detect orientation changes
  useEffect(() => {
    const update = () => {
      const newOrientation: Orientation =
        window.innerHeight > window.innerWidth ? "portrait" : "landscape"
      setOrientation(newOrientation)
    }
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }, [])

  // Load saved layouts for both orientations
  const layoutLoadedRef = useRef(false)
  useEffect(() => {
    const loadSettings = (s: Record<string, unknown>) => {
      // Load landscape layout
      if (s.dashboardLayoutLandscape) {
        setLandscapeLayout(migrateLayout(s.dashboardLayoutLandscape))
      } else if (s.dashboardLayout) {
        // Migrate old single layout to landscape
        setLandscapeLayout(migrateLayout(s.dashboardLayout))
      }
      // Load portrait layout
      if (s.dashboardLayoutPortrait) {
        setPortraitLayout(migrateLayout(s.dashboardLayoutPortrait))
      }
      if (s.zoneMinSizes && typeof s.zoneMinSizes === "object") {
        setMinSizes(s.zoneMinSizes as MinSizes)
      }
      layoutLoadedRef.current = true
    }

    fetch("/api/settings", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`API ${res.status}`)
        return res.json()
      })
      .then((s) => loadSettings(s as Record<string, unknown>))
      .catch(() => {
        getSettings()
          .then((s) => loadSettings(s as Record<string, unknown>))
          .catch(() => {})
          .finally(() => { layoutLoadedRef.current = true })
      })
  }, [])

  const orientationRef = useRef(orientation)
  orientationRef.current = orientation

  const persistLayout = useCallback((l: DashboardLayout) => {
    if (!layoutLoadedRef.current) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      const key = orientationRef.current === "portrait"
        ? "dashboardLayoutPortrait"
        : "dashboardLayoutLandscape"
      try {
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value: l }),
        })
        if (!res.ok) {
          const resBody = await res.text()
          throw new Error(`Save failed: ${res.status} ${resBody}`)
        }
      } catch (err) {
        console.error("[Layout] save error:", err)
        toast.error(`Layout save failed: ${err instanceof Error ? err.message : "Unknown error"}`)
      }
      setSetting(key, l).catch(() => {})
    }, 300)
  }, [])

  const handleLayoutChange = useCallback(
    (newLayout: DashboardLayout) => {
      setLayout(newLayout)
      persistLayout(newLayout)
    },
    [persistLayout],
  )

  const handleMinSizesChange = useCallback(
    (newMinSizes: MinSizes) => {
      setMinSizes(newMinSizes)
      if (!layoutLoadedRef.current) return
      if (minSizeTimeoutRef.current) clearTimeout(minSizeTimeoutRef.current)
      minSizeTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: "zoneMinSizes", value: newMinSizes }),
          })
          if (!res.ok) throw new Error(`${res.status}`)
          console.log("[Layout] Min sizes saved to D1")
        } catch (err) {
          console.error("[Layout] Min sizes save error:", err)
          toast.error("Failed to save zone min sizes")
        }
        setSetting("zoneMinSizes", newMinSizes).catch(() => {})
      }, 300)
    },
    [],
  )

  const resetLayout = useCallback(() => {
    layoutLoadedRef.current = true // ensure save goes through
    setLayout(DEFAULT_DASHBOARD_LAYOUT)
    setMinSizes({})
    persistLayout(DEFAULT_DASHBOARD_LAYOUT)
    // Also clear min sizes in D1
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "zoneMinSizes", value: {} }),
    }).catch(() => {})
    toast.success("Layout reset to default")
  }, [persistLayout])

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="h-14 shrink-0 bg-background/80 backdrop-blur-xl">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {view !== "dashboard" ? (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setView("dashboard")}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
              </Button>
            ) : (
              <img
                src="/logo.png"
                alt="Third Screen"
                className="size-5 rounded dark:invert"
              />
            )}
            <h1 className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight">
              {view === "dashboard" ? "Third Screen" : "Settings"}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {view === "dashboard" && (
              <>
                {mounted &&
                  (() => {
                    const current = (theme ?? "system") as keyof typeof THEME_ICON
                    const ThemeIcon = THEME_ICON[current] ?? Monitor
                    const nextTheme =
                      THEME_CYCLE[
                        (THEME_CYCLE.indexOf(
                          current as (typeof THEME_CYCLE)[number],
                        ) +
                          1) %
                          THEME_CYCLE.length
                      ]
                    return (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setTheme(nextTheme)}
                        className="text-muted-foreground hover:text-foreground"
                        title={`Theme: ${current}`}
                      >
                        <ThemeIcon className="size-4" />
                      </Button>
                    )
                  })()}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={toggleFullscreen}
                  className="text-muted-foreground hover:text-foreground"
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize className="size-4" />
                  ) : (
                    <Maximize className="size-4" />
                  )}
                </Button>
                {editMode && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={resetLayout}
                    className="text-muted-foreground hover:text-foreground"
                    title="Reset layout"
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                )}
                <Button
                  variant={editMode ? "secondary" : "ghost"}
                  size="icon-xs"
                  onClick={() => setEditMode(!editMode)}
                  className={
                    editMode
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }
                  title="Edit layout"
                >
                  <Grid3x3 className="size-4" />
                </Button>
                <ThemeCustomizer />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setView("settings")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Settings className="size-4" />
                </Button>
              </>
            )}
            {mounted &&
              authLoaded &&
              (isSignedIn ? (
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "size-9",
                    },
                  }}
                />
              ) : (
                <SignInButton mode="modal">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Sign in
                  </Button>
                </SignInButton>
              ))}
          </div>
        </div>
      </header>

      {/* Content */}
      {view === "dashboard" ? (
        <DashboardContext value={{ editMode }}>
          <GridDashboard
            editMode={editMode}
            layout={layout}
            onLayoutChange={handleLayoutChange}
            minSizes={minSizes}
            onMinSizesChange={handleMinSizesChange}
          />
          <div className="h-9 shrink-0">
            <StatusBar />
          </div>
        </DashboardContext>
      ) : (
        <SettingsView />
      )}
    </div>
  )
}
