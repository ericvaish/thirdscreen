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
  Save,
  HardDrive,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTheme } from "next-themes"
import { useAuth, UserButton, SignInButton } from "@clerk/nextjs"
import { getSettings } from "@/lib/data-layer"
import { toast } from "sonner"
import { ThemeCustomizer } from "./ThemeCustomizer"
import { MascotProvider } from "@/lib/mascot"
import { MascotOverlay } from "@/components/MascotOverlay"
import {
  GRID_COLS,
  DEFAULT_DASHBOARD_LAYOUT,
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

  // Load BOTH portrait and landscape layouts from D1 on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => {
        if (!res.ok) throw new Error(`API ${res.status}`)
        return res.json()
      })
      .then((s: Record<string, unknown>) => {
        if (s.dashboardLayoutLandscape) {
          setLandscapeLayout(s.dashboardLayoutLandscape as unknown as DashboardLayout)
        }
        if (s.dashboardLayoutPortrait) {
          setPortraitLayout(s.dashboardLayoutPortrait as unknown as DashboardLayout)
        }
      })
      .catch((err) => {
        console.error("[Layout] Failed to load from D1:", err)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only on mount

  const saveLayoutToServer = useCallback(async (l: DashboardLayout) => {
    const key = orientation === "portrait"
      ? "dashboardLayoutPortrait"
      : "dashboardLayoutLandscape"
    try {
      // Save
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: l }),
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Save failed (${res.status}): ${body}`)
      }

      // Verify by reading it back
      const verifyRes = await fetch("/api/settings")
      if (!verifyRes.ok) throw new Error(`Verify read failed (${verifyRes.status})`)
      const saved = await verifyRes.json() as Record<string, unknown>
      const savedLayout = JSON.stringify(saved[key])
      const expected = JSON.stringify(l)
      if (savedLayout !== expected) {
        console.error("[Layout] Verification mismatch!\nExpected:", expected, "\nGot:", savedLayout)
        throw new Error("Verification failed: saved data doesn't match")
      }

      toast.success("Layout saved and verified")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      console.error("[Layout] D1 save failed:", msg)
      toast.error(`Failed to save layout: ${msg}`)
    }
  }, [orientation])

  const handleLayoutChange = useCallback(
    (newLayout: DashboardLayout) => {
      setLayout(newLayout)
    },
    [setLayout],
  )

  const handleMinSizesChange = useCallback(
    (newMinSizes: MinSizes) => {
      setMinSizes(newMinSizes)
    },
    [],
  )

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_DASHBOARD_LAYOUT)
    setMinSizes({})
    toast.success("Layout reset to default")
  }, [setLayout])

  return (
    <MascotProvider>
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Local storage notice for anonymous users */}
      {mounted && authLoaded && !isSignedIn && <LocalStorageNotice />}

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
                {editMode ? (
                  <div className="flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={resetLayout}
                      className="text-muted-foreground hover:text-foreground"
                      title="Reset to default layout"
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => saveLayoutToServer(layout)}
                      className="text-muted-foreground hover:text-primary"
                      title="Save layout"
                    >
                      <Save className="size-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon-xs"
                      onClick={() => setEditMode(false)}
                      className="text-primary"
                      title="Done editing"
                    >
                      <Grid3x3 className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setEditMode(true)}
                    className="text-muted-foreground hover:text-foreground"
                    title="Edit layout"
                  >
                    <Grid3x3 className="size-4" />
                  </Button>
                )}
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
        <DashboardContext value={{ editMode, layout, onLayoutChange: handleLayoutChange }}>
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
    <MascotOverlay />
    </MascotProvider>
  )
}

// ── One-time local storage notice for anonymous users ───────────────────────

const LS_NOTICE_KEY = "ts_local_storage_notice_dismissed"

function LocalStorageNotice() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(LS_NOTICE_KEY)) {
      setShow(true)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(LS_NOTICE_KEY, "1")
    setShow(false)
  }

  if (!show) return null

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open) dismiss() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <HardDrive className="size-4 text-primary" />
            </div>
            <DialogTitle className="text-sm font-bold">Your data is stored locally</DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-3 text-xs text-muted-foreground">
          <p>
            Your dashboard, tasks, notes, and settings are saved in this browser's local storage. They'll persist across sessions, but will be lost if you clear your browser data or switch to a different browser or device.
          </p>
          <p>
            To keep your data safe and synced across devices,{" "}
            <SignInButton mode="modal">
              <button className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80">sign in</button>
            </SignInButton>{" "}
            to save everything to the cloud.
          </p>
        </div>
        <Button onClick={dismiss} className="w-full">
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  )
}
