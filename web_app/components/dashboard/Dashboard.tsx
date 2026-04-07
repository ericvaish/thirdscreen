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
  Download,
  Upload,
  HardDrive,
  X,
  ZoomIn,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTheme } from "next-themes"
import { animatedSetTheme } from "@/components/ui/animated-theme-toggler"
import { useAuth, UserButton, SignInButton } from "@clerk/nextjs"
import {
  getSettings,
  listDashboards,
  createDashboard as dlCreateDashboard,
  updateDashboard as dlUpdateDashboard,
  deleteDashboard as dlDeleteDashboard,
  getActiveDashboardId,
  setActiveDashboardId,
} from "@/lib/data-layer"
import { toast } from "sonner"
import { ThemeCustomizer } from "./ThemeCustomizer"
import { useScale } from "@/components/scale-provider"
import { MascotProvider } from "@/lib/mascot"
import { MascotOverlay } from "@/components/MascotOverlay"
import { AIChatBubble } from "@/components/AIChatBubble"
import { NotificationBell } from "@/components/NotificationBell"
import { CountdownTimerProvider } from "@/lib/countdown-timer"
import {
  GRID_COLS,
  DEFAULT_DASHBOARD_LAYOUT,
  isValidLayout,
  createDefaultDashboardConfig,
  ensureAllZones,
  DASHBOARD_LIMITS,
  type DashboardLayout,
  type DashboardConfig,
  type ZoneId,
} from "@/lib/grid-layout"

type View = "dashboard" | "privacy" | "terms"

const THEME_OPTIONS = [
  { label: "Dark", value: "dark", icon: Moon },
  { label: "Light", value: "light", icon: Sun },
  { label: "System", value: "system", icon: Monitor },
] as const

// ── Theme Picker ──────────────────────────────────────────────────────────

function ThemePicker({
  theme,
  setTheme,
  mounted,
}: {
  theme: string | undefined
  setTheme: (v: string) => void
  mounted: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", handleClick)
    return () => document.removeEventListener("pointerdown", handleClick)
  }, [open])

  if (!mounted) return null

  const current = (theme ?? "system") as "dark" | "light" | "system"
  const CurrentIcon =
    THEME_OPTIONS.find((o) => o.value === current)?.icon ?? Monitor

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:text-foreground"
        title="Theme"
      >
        <CurrentIcon className="size-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-36 rounded-lg border border-border/30 bg-background/95 p-1.5 shadow-xl backdrop-blur-xl">
          {THEME_OPTIONS.map(({ label, value, icon: Icon }) => (
            <button
              key={value}
              onClick={(e) => {
                animatedSetTheme(setTheme, value, e.currentTarget)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors ${
                current === value
                  ? "bg-primary/10 font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Scale Picker ───────────────────────────────────────────────────────────

function ScalePicker({
  scale,
  setScale,
  presets,
}: {
  scale: number
  setScale: (v: number) => void
  presets: readonly { label: string; value: number }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", handleClick)
    return () => document.removeEventListener("pointerdown", handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:text-foreground"
        title="Display scale"
      >
        <ZoomIn className="size-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-40 rounded-lg border border-border/30 bg-background/95 p-1.5 shadow-xl backdrop-blur-xl">
          {presets.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => {
                setScale(value)
                setOpen(false)
              }}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-xs transition-colors ${
                scale === value
                  ? "bg-primary/10 font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              }`}
            >
              <span>{label}</span>
              <span className="font-mono text-xs text-muted-foreground/50">{value}px</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export function Dashboard() {
  const [view, setView] = useState<View>("dashboard")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { scale, setScale, presets } = useScale()
  // Orientation-aware layouts: portrait and landscape each get their own saved layout
  type Orientation = "portrait" | "landscape"
  const [orientation, setOrientation] = useState<Orientation>(
    typeof window !== "undefined" && window.innerHeight > window.innerWidth
      ? "portrait"
      : "landscape",
  )
  // ── Multi-dashboard state ──────────────────────────────────────────────
  const [dashboardConfigs, setDashboardConfigs] = useState<DashboardConfig[]>([])
  const [activeDashboardId, setActiveDashboardIdState] = useState<string>("")

  const activeDashboard = dashboardConfigs.find((d) => d.id === activeDashboardId) ?? dashboardConfigs[0]
  const layout = ensureAllZones(
    activeDashboard
      ? orientation === "portrait" ? activeDashboard.layoutPortrait : activeDashboard.layoutLandscape
      : DEFAULT_DASHBOARD_LAYOUT
  )
  const hiddenZones = activeDashboard?.hiddenZones ?? []

  const setLayout = useCallback((newLayout: DashboardLayout) => {
    setDashboardConfigs((prev) =>
      prev.map((d) =>
        d.id === activeDashboardId
          ? {
              ...d,
              ...(orientation === "portrait"
                ? { layoutPortrait: newLayout }
                : { layoutLandscape: newLayout }),
            }
          : d
      )
    )
  }, [activeDashboardId, orientation])

  const [minSizes, setMinSizes] = useState<MinSizes>({})
  const [editMode, setEditMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)

  const handleUploadLayout = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        // Support both { orientation, layout } and raw layout objects
        const uploadedLayout = parsed.layout ?? parsed
        if (!isValidLayout(uploadedLayout)) {
          toast.error("Invalid layout file")
          return
        }
        setLayout(uploadedLayout)
        toast.success("Layout loaded — click Save to persist")
      } catch {
        toast.error("Failed to parse layout file")
      }
      // Reset so the same file can be re-uploaded
      if (uploadRef.current) uploadRef.current.value = ""
    }
    reader.readAsText(file)
  }, [setLayout])
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

  // Load dashboards on mount
  useEffect(() => {
    listDashboards().then((configs) => {
      if (configs.length === 0) {
        const def = createDefaultDashboardConfig(crypto.randomUUID())
        setDashboardConfigs([def])
        setActiveDashboardIdState(def.id)
        setActiveDashboardId(def.id)
      } else {
        setDashboardConfigs(configs)
        const savedId = getActiveDashboardId()
        const validId = configs.find((d) => d.id === savedId)?.id ?? configs[0].id
        setActiveDashboardIdState(validId)
      }
    }).catch((err) => {
      console.error("[Dashboards] Failed to load:", err)
      const def = createDefaultDashboardConfig(crypto.randomUUID())
      setDashboardConfigs([def])
      setActiveDashboardIdState(def.id)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveLayoutToServer = useCallback(async (l: DashboardLayout) => {
    if (!activeDashboard) return
    const data = orientation === "portrait"
      ? { layoutPortrait: l }
      : { layoutLandscape: l }
    try {
      await dlUpdateDashboard(activeDashboard.id, data)
      toast.success("Layout saved")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      console.error("[Layout] Save failed:", msg)
      toast.error(`Failed to save layout: ${msg}`)
    }
  }, [orientation, activeDashboard])

  // ── Dashboard CRUD handlers ──────────────────────────────────────────────

  const switchDashboard = useCallback((id: string) => {
    setActiveDashboardIdState(id)
    setActiveDashboardId(id)
  }, [])

  const handleCreateDashboard = useCallback(async (name: string) => {
    try {
      const config = await dlCreateDashboard(name)
      setDashboardConfigs((prev) => [...prev, config])
      switchDashboard(config.id)
      toast.success(`Created "${name}"`)
    } catch {
      toast.error("Failed to create dashboard")
    }
  }, [switchDashboard])

  const handleRenameDashboard = useCallback(async (id: string, name: string) => {
    setDashboardConfigs((prev) => prev.map((d) => d.id === id ? { ...d, name } : d))
    try {
      await dlUpdateDashboard(id, { name })
    } catch {
      toast.error("Failed to rename dashboard")
    }
  }, [])

  const handleDeleteDashboard = useCallback(async (id: string) => {
    if (dashboardConfigs.length <= 1) {
      toast.error("Cannot delete the last dashboard")
      return
    }
    const name = dashboardConfigs.find((d) => d.id === id)?.name
    const remaining = dashboardConfigs.filter((d) => d.id !== id)
    setDashboardConfigs(remaining)
    if (activeDashboardId === id) {
      switchDashboard(remaining[0].id)
    }
    try {
      await dlDeleteDashboard(id)
      toast.success(`Deleted "${name}"`)
    } catch {
      toast.error("Failed to delete dashboard")
    }
  }, [dashboardConfigs, activeDashboardId, switchDashboard])

  const canCreateMore = dashboardConfigs.length < DASHBOARD_LIMITS.pro

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
    <CountdownTimerProvider>
    <MascotProvider>
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Local storage notice for anonymous users */}
      {mounted && authLoaded && !isSignedIn && <LocalStorageNotice />}

      {/* Header */}
      <header className="relative z-[100] h-14 shrink-0 border-b border-border/20 bg-background/80 backdrop-blur-xl">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {view !== "dashboard" ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setView("dashboard")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <h1 className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight">
                  {view === "privacy" && "Privacy Policy"}
                  {view === "terms" && "Terms of Service"}
                </h1>
              </>
            ) : (
              <a href="/" className="flex items-center gap-2">
                <img
                  src="/logo.png"
                  alt="Third Screen"
                  className="size-5 rounded dark:invert"
                />
                <h1 className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight">
                  Third Screen
                </h1>
              </a>
            )}
          </div>
          <div className="flex items-center gap-1">
            {view === "dashboard" && (
              <>
                <NotificationBell />
                <ThemePicker theme={theme} setTheme={setTheme} mounted={mounted} />
                {/* Display scale picker */}
                <ScalePicker scale={scale} setScale={setScale} presets={presets} />
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
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        const data = JSON.stringify({ orientation, layout }, null, 2)
                        const blob = new Blob([data], { type: "application/json" })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement("a")
                        a.href = url
                        a.download = `layout-${orientation}.json`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                      className="text-muted-foreground hover:text-primary"
                      title="Download layout as JSON"
                    >
                      <Download className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => uploadRef.current?.click()}
                      className="text-muted-foreground hover:text-primary"
                      title="Upload layout from JSON"
                    >
                      <Upload className="size-4" />
                    </Button>
                    <input
                      ref={uploadRef}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleUploadLayout}
                    />
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
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className={settingsOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
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
      <DashboardContext value={{
        editMode,
        layout,
        onLayoutChange: handleLayoutChange,
        activeDashboardId,
        dashboards: dashboardConfigs,
        hiddenZones,
        switchDashboard,
        createDashboard: handleCreateDashboard,
        renameDashboard: handleRenameDashboard,
        deleteDashboard: handleDeleteDashboard,
        canCreateMore,
      }}>
        {view === "dashboard" ? (
          <GridDashboard
            editMode={editMode}
            layout={layout}
            onLayoutChange={handleLayoutChange}
            minSizes={minSizes}
            onMinSizesChange={handleMinSizesChange}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            {view === "privacy" && <PrivacyContent />}
            {view === "terms" && <TermsContent />}
          </div>
        )}

        {/* Settings dialog */}
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="flex flex-col overflow-hidden p-0 top-[calc(50%+1.75rem)] translate-y-[-50%]" style={{ maxWidth: "min(1060px, 92vw)", width: "min(1060px, 92vw)", height: "min(820px, calc(100vh - 3rem))" }}>
            <DialogHeader className="shrink-0 border-b border-border/20 px-6 py-4">
              <DialogTitle className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight">
                Settings
              </DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-hidden">
              <SettingsView />
            </div>
          </DialogContent>
        </Dialog>
        <div className="relative z-50 h-11 shrink-0 overflow-visible">
          <StatusBar />
        </div>
      </DashboardContext>
    </div>
    <MascotOverlay />
    <AIChatBubble />
    </MascotProvider>
    </CountdownTimerProvider>
  )
}

// ── Privacy & Terms content (rendered inside Dashboard shell) ──────────────

function PrivacyContent() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <p className="text-xs text-muted-foreground mb-8">Last updated: April 2, 2026</p>
      <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">1. What Third Screen Is</h2>
          <p>Third Screen is a personal dashboard web application that displays your schedule, tasks, notes, health data, and music in a single glanceable view. It is operated by Eric Vaish and available at thirdscr.com.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">2. Data Storage</h2>
          <p>Third Screen is local-first. Your data (tasks, notes, calendar events, calorie logs, medicine schedules, habits) is stored locally on your device by default using your browser&apos;s localStorage. No account is required to use the core features.</p>
          <p className="mt-3">When you sign in and use the hosted version, your data is stored on our servers in a SQLite database, isolated by your authenticated user ID. No other user can access your data.</p>
          <p className="mt-3">When you connect external services, authentication tokens are stored securely and scoped to your user account. We do not store your passwords.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">3. Third-Party Services</h2>
          <p>Third Screen integrates with the following services when you choose to connect them:</p>
          <ul className="list-disc list-inside mt-3 space-y-2">
            <li><strong className="text-foreground">Google Calendar</strong> - We request access to your calendar events to display them on your timeline. We use Google OAuth 2.0 with PKCE. Supports multiple accounts.</li>
            <li><strong className="text-foreground">Gmail</strong> - We request access to read your unread count and message previews. Only metadata is displayed; we do not store email content.</li>
            <li><strong className="text-foreground">Google Chat</strong> - We request access to display recent messages from your spaces.</li>
            <li><strong className="text-foreground">Spotify</strong> - We request access to your playback state to display currently playing music and control playback. We use Spotify OAuth with PKCE.</li>
            <li><strong className="text-foreground">LRCLib</strong> - We fetch song lyrics from LRCLib (lrclib.net), an open-source lyrics database. Only the song title, artist, and album name are sent in the request.</li>
            <li><strong className="text-foreground">Clerk</strong> - We use Clerk for user authentication. Clerk handles your account data (email, profile) according to their privacy policy.</li>
            <li><strong className="text-foreground">Paddle</strong> - We use Paddle as our payment processor (Merchant of Record) for paid subscriptions. Paddle collects and processes your billing information according to their privacy policy. We do not directly store your payment card details.</li>
          </ul>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">4. Cookies and Local Storage</h2>
          <p>Third Screen uses browser localStorage to store your dashboard data, UI preferences (theme, layout), and authentication tokens for connected services. We do not use tracking cookies. Clerk may set cookies for session management.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">5. Data We Do Not Collect</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>We do not sell or share your data with third parties for advertising or marketing purposes</li>
            <li>We do not serve advertisements</li>
            <li>We do not use analytics or behavioral tracking</li>
            <li>We do not collect data from minors under 13</li>
          </ul>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">6. Data Retention</h2>
          <p>Locally stored data persists until you clear your browser storage. Server-side data for signed-in users is retained as long as your account is active. If you delete your account, all associated server-side data is permanently deleted. OAuth tokens for disconnected services are deleted immediately upon disconnection.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc list-inside mt-3 space-y-2">
            <li><strong className="text-foreground">Access</strong> your data at any time through the application</li>
            <li><strong className="text-foreground">Export</strong> your data from the application</li>
            <li><strong className="text-foreground">Delete</strong> your data and account at any time</li>
            <li><strong className="text-foreground">Disconnect</strong> any third-party service integration at any time</li>
            <li><strong className="text-foreground">Withdraw consent</strong> for data processing by deleting your account</li>
          </ul>
          <p className="mt-3">If you are in the EU/EEA, you may also exercise rights under the GDPR including the right to rectification, restriction of processing, and lodging a complaint with a supervisory authority.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">8. Data Security</h2>
          <p>We use HTTPS for all data transmission. OAuth tokens are stored server-side with user-scoped access controls. Authentication is handled by Clerk with industry-standard security practices. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">9. Open Source</h2>
          <p>Third Screen is open source under the MIT license. You can inspect the complete source code at <a href="https://github.com/ericvaish/thirdscreen" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">github.com/ericvaish/thirdscreen</a> to verify exactly what the application does with your data.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">10. Changes to This Policy</h2>
          <p>We may update this privacy policy from time to time. Material changes will be communicated via the Service or email. The &ldquo;Last updated&rdquo; date at the top reflects the most recent revision.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">11. Contact</h2>
          <p>If you have questions about this privacy policy, you can reach us at <a href="mailto:hi@ericvaish.com" className="text-primary hover:underline">hi@ericvaish.com</a>.</p>
        </section>
      </div>
    </div>
  )
}

function TermsContent() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <p className="text-xs text-muted-foreground mb-8">Last updated: April 2, 2026</p>
      <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">1. Acceptance of Terms</h2>
          <p>By accessing or using Third Screen (&ldquo;the Service&rdquo;), operated by Eric Vaish (&ldquo;we&rdquo;, &ldquo;us&rdquo;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">2. Description of Service</h2>
          <p>Third Screen is a personal dashboard web application that displays your schedule, tasks, notes, health data, and music in a single view. The Service is available as a hosted web application at thirdscr.com and as open-source software you may self-host.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">3. Accounts</h2>
          <p>You may use basic features without an account. Certain features (cloud sync, integrations) require signing in via our authentication provider (Clerk). You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">4. Subscriptions and Billing</h2>
          <p>Third Screen offers both free and paid subscription tiers. Paid subscriptions are billed through our payment processor, Paddle.com. By subscribing to a paid plan, you agree to pay the applicable fees.</p>
          <ul className="list-disc list-inside mt-3 space-y-2">
            <li>Subscriptions renew automatically at the end of each billing period unless cancelled before the renewal date.</li>
            <li>You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of the current billing period.</li>
            <li>Paddle acts as the Merchant of Record for all payments. Your billing relationship for payment processing is with Paddle, and their terms apply to payment transactions.</li>
          </ul>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">5. Refund Policy</h2>
          <p>If you are unsatisfied with a paid subscription, you may request a refund within 14 days of your initial purchase or most recent renewal. Refund requests can be made by contacting us at the email below. Refunds are processed through Paddle.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">6. Your Data</h2>
          <p>You own your data. Third Screen stores data locally on your device by default. When you connect external services (Google Calendar, Spotify, Gmail), you authorize Third Screen to access your data on those services according to the permissions you grant. You can disconnect any service and delete your data at any time.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">7. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc list-inside mt-3 space-y-2">
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to the Service or its systems</li>
            <li>Interfere with or disrupt the integrity of the Service</li>
            <li>Use the Service to transmit harmful code or malware</li>
            <li>Abuse API rate limits or scrape content from the Service</li>
          </ul>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">8. Third-Party Services</h2>
          <p>Third Screen integrates with third-party services including Google (Calendar, Gmail, Chat), Spotify, Clerk, LRCLib, and Paddle. Your use of those services is governed by their respective terms and privacy policies. We are not responsible for the availability, accuracy, or conduct of third-party services.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">9. Account Termination</h2>
          <p>You may delete your account at any time. We reserve the right to suspend or terminate accounts that violate these terms. Upon termination, your server-side data will be deleted. Locally stored data on your device is unaffected.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">10. No Warranty</h2>
          <p>The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranty of any kind, express or implied. We do not guarantee that the Service will be uninterrupted, error-free, or that defects will be corrected.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">11. Limitation of Liability</h2>
          <p>To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including loss of data, profits, or business opportunities.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">12. Governing Law</h2>
          <p>These terms are governed by and construed in accordance with the laws of the United States. Any disputes shall be resolved in the courts of competent jurisdiction.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">13. Changes to Terms</h2>
          <p>We may update these terms from time to time. Material changes will be communicated via the Service or email. Continued use after changes constitutes acceptance of the updated terms.</p>
        </section>
        <section>
          <h2 className="font-semibold text-lg mb-3 text-foreground">14. Contact</h2>
          <p>Questions about these terms can be directed to <a href="mailto:hi@ericvaish.com" className="text-primary hover:underline">hi@ericvaish.com</a>.</p>
        </section>
      </div>
    </div>
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
