"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { StatusBar } from "@/components/zones/StatusBar"
import { NotificationBanner } from "@/components/zones/NotificationBanner"
import { SettingsView } from "./SettingsView"
import { GridDashboard } from "./GridDashboard"
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
  const [layout, setLayout] = useState<DashboardLayout>(
    DEFAULT_DASHBOARD_LAYOUT,
  )
  const [editMode, setEditMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { isSignedIn, isLoaded: authLoaded } = useAuth()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setMounted(true), [])

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

  // Load saved layout (with migration from old format)
  useEffect(() => {
    getSettings()
      .then((s) => {
        const settings = s as Record<string, unknown>
        if (settings.dashboardLayout) {
          const migrated = migrateLayout(settings.dashboardLayout)
          setLayout(migrated)
        }
      })
      .catch(() => {})
  }, [])

  const persistLayout = useCallback((l: DashboardLayout) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      setSetting("dashboardLayout", l).catch(() => {})
    }, 300)
  }, [])

  const handleLayoutChange = useCallback(
    (newLayout: DashboardLayout) => {
      setLayout(newLayout)
      persistLayout(newLayout)
    },
    [persistLayout],
  )

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_DASHBOARD_LAYOUT)
    persistLayout(DEFAULT_DASHBOARD_LAYOUT)
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

      {/* Notification banner */}
      {view === "dashboard" && <NotificationBanner />}

      {/* Content */}
      {view === "dashboard" ? (
        <DashboardContext value={{ editMode }}>
          <GridDashboard
            editMode={editMode}
            layout={layout}
            onLayoutChange={handleLayoutChange}
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
