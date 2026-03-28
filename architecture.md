# Third Screen -- Architecture Reference

A glanceable personal dashboard. The user sees everything they need for the day -- schedule, tasks, notes, health vitals -- in a single viewport. This is a passive display dashboard, not an interactive CRUD app.

Originally a native macOS SwiftUI app, now web-first with an Electron desktop wrapper planned.

---

## Project Map

| Surface | Directory | Status |
|---------|-----------|--------|
| **Web app** | `web_app/thirdscreen/` | Active primary codebase |
| **Electron app** | `electron-app/` | Scaffolded, IPC + DB layer built |
| **Swift macOS app** | `iphone_app/`, `thirdscreen.xcodeproj/` | Abandoned |
| **Marketing site** | `web_app/thirdscreen/app/page.tsx` | Merged into web app (`/`, `/privacy`, `/terms`) |

---

## Web App Architecture

### Stack

- **Framework:** Next.js 16 + React 19 + TypeScript 5.9
- **Styling:** Tailwind CSS 4 + shadcn/ui (Radix primitives)
- **Database:** Cloudflare D1 (production), SQLite via better-sqlite3 + Drizzle ORM (local dev)
- **Auth:** Clerk (Core 3) -- auto light/dark theme, Google OAuth, email/password
- **Hosting:** Cloudflare Pages via `@cloudflare/next-on-pages`
- **Fonts:** Inter (body), Space Grotesk (display), JetBrains Mono (mono) via next/font/google

### Design System

Dark-first with blue-tinted blacks (oklch color space). Each zone has a unique accent color. Cards use a glass effect (backdrop-blur + transparency) with zone-colored radial gradient backgrounds.

Event pills use a colored border ring with transparent card background (not filled).

Muted pastel event color palette (10 colors, Apple Calendar-inspired, oklch chroma ~0.08-0.10). Colors are assigned by hashing the event ID for stability.

### Key Directories

```
web_app/thirdscreen/
  app/
    page.tsx              # Landing page
    app/page.tsx          # Dashboard route (edge runtime)
    layout.tsx            # Root: ThemeProvider > ClerkThemeProvider > ScaleProvider > NotificationProvider
    globals.css           # oklch color system, zone surfaces, glass utilities, RGL overrides
    api/                  # REST endpoints (edge runtime, Drizzle + D1)
      calories/           # Food items + water
      medicines/          # Medicines + dose logs
      schedule/           # Calendar events
      todos/              # Tasks
      notes/ + notes/links/ # Notes + bookmarks
      settings/           # Key-value settings store
      google-calendar/    # Multi-account OAuth, event fetching
      spotify/            # OAuth, playback, lyrics
  components/
    dashboard/
      Dashboard.tsx       # Main view: header, orientation-aware layout, edit mode
      GridDashboard.tsx   # react-grid-layout wrapper, resize handles, dot grid overlay
      DashboardContext.tsx # React context for editMode propagation
      ZoneDragHandle.tsx  # Grip icon in zone headers (edit mode only)
      SettingsView.tsx    # Theme customizer + integration catalog
    zones/
      TimelineZone.tsx    # Schedule: horizontal/vertical day view, week view, month view
      VitalsZone.tsx      # Calories, water, medicines with ring gauges
      TasksZone.tsx       # Task list with inline add
      NotesZone.tsx       # Notes with list/grid views + full editor
      MediaZone.tsx       # Spotify: now playing, controls, lyrics
      StatusBar.tsx       # Clock, weather, AQI, pomodoro, timer, notification ticker
    auth/
      AuthModal.tsx       # Custom sign-in/sign-up modal (unused, Clerk native modal active)
    clerk-theme-provider.tsx  # ClerkProvider + Cloudflare session sync workaround
    ui/                   # shadcn/ui components (44px min touch targets)
  lib/
    grid-layout.ts        # Grid types, defaults, min sizes, RGL conversion, migration
    data-layer.ts         # Unified API: localStorage / fetch / Electron IPC
    local-store.ts        # Complete localStorage CRUD
    notifications.tsx     # NotificationProvider + useNotifications hook
    mascot.tsx            # Mascot context + character system
    types.ts              # Shared types
    utils.ts              # cn() utility
    integrations/         # Integration registry (30+ definitions by zone/category)
    google-calendar/      # OAuth, token refresh, multi-account event fetching
    google-services/      # Gmail + Chat: OAuth, unread counts, polling
    spotify/              # OAuth, PKCE, playback API, SDK
  db/
    schema.ts             # Drizzle ORM table definitions
    index.ts              # DB connection, migrations, seed data
```

### DB Tables

`cards`, `todos`, `notes`, `links`, `medicines`, `medicine_dose_logs`, `food_items`, `water_logs`, `schedule_events`, `settings`, `admin_config`, `enabled_integrations`, `calendar_accounts`, `google_service_accounts`, `lyrics_cache`

All use text UUIDs as primary keys. Child tables cascade-delete on parent removal. Multi-tenant via `userId` column (empty string for anonymous/local).

---

## Grid Layout System

### Overview

Users can freely drag and resize zone cards on a grid. The layout engine is `react-grid-layout` (RGL). Each zone is a grid item with position `{x, y, w, h}`. Edit mode (toggle via Grid3x3 button in header) enables drag handles on zone headers and macOS-style L-bracket corner resize handles.

### Grid Configuration

Defined in `lib/grid-layout.ts`:

- **Grid size:** 16 columns x 16 rows
- **Margin:** 2px between cells
- **Row height:** Computed dynamically: `(containerHeight - margins) / GRID_ROWS`
- **RGL props:** `compactType="vertical"`, `useCSSTransforms`, `draggableHandle=".zone-drag-handle"`

### Orientation-Aware Layouts (Critical System)

The dashboard stores two independent layouts, one for each screen orientation. This mirrors iPad widget behavior.

| Orientation | Condition | Settings key | State variable |
|-------------|-----------|-------------|----------------|
| **Portrait** | `window.innerHeight > window.innerWidth` | `dashboardLayoutPortrait` | `portraitLayout` |
| **Landscape** | `window.innerWidth >= window.innerHeight` | `dashboardLayoutLandscape` | `landscapeLayout` |

**Implementation flow (in `Dashboard.tsx`):**

1. `orientation` state is initialized from `window.innerWidth/innerHeight` on mount
2. A `resize` event listener updates `orientation` in real-time when the browser/device changes shape
3. `layout` is derived: `orientation === "portrait" ? portraitLayout : landscapeLayout`
4. `setLayout` is derived the same way -- mutations go to the correct orientation's state
5. `persistLayout()` saves to the orientation-specific key using `orientationRef.current` (a ref, not state, to avoid stale closures in the debounced callback)
6. On initial load, both layouts are fetched from settings. The old single `dashboardLayout` key (pre-orientation) is migrated to the landscape slot. Portrait starts with defaults until customized.
7. Reset layout resets only the current orientation

**Why `orientationRef` instead of `orientation` in the closure:** `persistLayout` is wrapped in `useCallback([], [])` with no dependencies so the 300ms debounce timer isn't recreated on every render. The ref captures the current orientation at the moment of save, not the stale value from when the callback was created.

**Persistence keys:**
- `dashboardLayoutPortrait` -- saved to D1 settings + localStorage backup
- `dashboardLayoutLandscape` -- saved to D1 settings + localStorage backup
- Old `dashboardLayout` -- read during migration only, not written to

### Layout Data Model

```typescript
type ZoneId = "timeline" | "tasks" | "notes" | "vitals" | "media"

interface ZonePosition {
  x: number  // column start (0-indexed)
  y: number  // row start (0-indexed)
  w: number  // width in columns
  h: number  // height in rows
}

type DashboardLayout = Record<ZoneId, ZonePosition>
```

### Layout Migration

`migrateLayout()` in `grid-layout.ts` handles three cases:

1. **Valid layout, current grid size** -- returned as-is
2. **Valid layout, different grid size** (zones exceed current bounds) -- scaled proportionally
3. **Old `GridLayout` format** (pre-RGL: `{timelineEnd, sidebarStart, taskEnd, mediaEnd}`) -- converted to per-zone positions
4. **Unknown/missing** -- returns `DEFAULT_DASHBOARD_LAYOUT`

### Zone Minimum Sizes

Enforced by RGL per-item `minW`/`minH`:

| Zone | minW | minH |
|------|------|------|
| timeline | 3 | 2 |
| tasks | 3 | 3 |
| notes | 3 | 3 |
| vitals | 3 | 3 |
| media | 3 | 3 |

Adjustable at runtime via +/- controls on each card in edit mode. Stored in `zoneMinSizes` setting.

### Edit Mode UI

- **Dot grid:** 20px spacing radial-gradient on the scrollable container (tiles with scroll)
- **Drag handles:** `.zone-drag-handle` class on zone headers + `<ZoneDragHandle />` grip icon
- **Resize handles:** L-bracket corners (CSS `::after` with colored borders), `opacity: 1 !important` to override RGL's hover-only default, `touch-action: none`, 44px hit area
- **Placeholder:** Primary-colored dashed border during drag/resize
- **Infinite loop prevention:** `interactingRef` guards `onLayoutChange` -- only propagates during active drag/resize, not on RGL's compaction pass

### StatusBar (Fixed Footer)

Outside the RGL grid (`h-9 shrink-0`). Contains: clock, weather, AQI, pomodoro, stopwatch, notification ticker (up to 5 pills). All notifications display here (top banner removed).

---

## Timeline / Schedule Zone

### Day View (Horizontal)

- 24-hour window: centered on current time (today) or full 0:00-24:00 (other days)
- Smooth animated transition via `requestAnimationFrame` lerp on `windowStart`
- Sun/moon daylight arcs (SVG) with indicator dot
- Events as bordered pills (colored ring, transparent card background)
- Drag-to-create events; single click ahead of now creates event from now to clicked time
- Medicine dose markers, hour markers, amber now-line

### Day View (Vertical)

Auto-detected via `ResizeObserver` when zone `height > width`. Hours top-to-bottom, horizontal event bars, horizontal now-line. Auto-scrolls to current time.

### Week View

7 columns (Sun-Sat), mini vertical timeline per day. Click to drill into day view.

### Month View

Calendar grid with colored event dots. Click to drill into day view.

### Date Navigation

- Arrow buttons: step by day/week/month per view mode
- Calendar popover for arbitrary date selection
- "Today" button when viewing non-today date
- View mode (D/W/M) persists to localStorage

---

## Data Layer

### Three Backends

| Backend | Detection | Transport | Storage |
|---------|-----------|-----------|---------|
| **Local** | Default | `localStorage` | Browser |
| **Server** | `NEXT_PUBLIC_STORAGE=server` | `fetch()` to API routes | D1/SQLite |
| **Electron** | `window.electronAPI` | IPC to main process | SQLite in user data dir |

`lib/data-layer.ts` exports typed functions that auto-route to the correct backend. Zone components import exclusively from here.

### Cloudflare D1 (Production)

- `wrangler.toml`: `STORAGE = "d1"`, D1 binding `"DB"`
- All API routes: `export const runtime = "edge"`
- Auth: Clerk middleware, `getAuthUserId()`
- Settings: key-value pairs in `settings` table

---

## Authentication (Clerk Core 3)

### Provider Chain

```
ThemeProvider (next-themes)
  ClerkThemeProvider (reads resolvedTheme, wraps ClerkProvider)
    ScaleProvider
      NotificationProvider
        MascotProvider
```

Core 3 auto-detects light/dark from the `dark` class on `<html>`.

### Cloudflare Workaround

Clerk Core 3 uses Next.js server actions internally for session sync (POST to current page). Cloudflare Pages doesn't support POST on page routes, causing 405 errors.

Fix: `ClerkThemeProvider` overrides `window.__internal_onBeforeSetActive` with `window.location.reload()`, bypassing the server action entirely.

### Auth Flow

- Anonymous users: full dashboard, localStorage, no login
- Calendar/Spotify connect: prompts sign-in via Clerk modal
- Google Calendar OAuth requires server mode (tokens in D1)

---

## Electron App

Shares 100% of React UI. Only data transport differs:

- Web: `fetch('/api/...')`
- Electron: `window.electronAPI.invoke('db:resource:operation', ...)`

IPC channels: `db:{resource}:{operation}` (e.g., `db:todos:list`, `db:settings:set`)

Build: Static export (`next.config.export.mjs`) to `renderer/`, packaged via `electron-builder`.

---

## Touch-First Design

- **44px minimum** touch targets on all interactive elements
- **No hover-dependent UI** -- all actions always visible at low contrast
- **11px minimum** font size (Apple HIG)
- **All button variants** produce 44px minimum via `components/ui/button.tsx`

---

## External Integrations

### Google Calendar (Multi-Account)

`calendar_accounts` table. PKCE OAuth with admin-provided client ID/secret. Parallel event fetching from all accounts + local events.

### Spotify

PKCE OAuth. Web Playback SDK for device control. Lyrics with cache. Album art color extraction for dynamic zone background. `scrollIntoView` replaced with `container.scrollTo` to prevent page-level scroll jumps.

### Gmail / Google Chat

`google_service_accounts` table. 30s polling for unread counts. Notification pills in StatusBar.

---

## Development

**Package manager: `bun`**

```bash
cd web_app/thirdscreen
bun install
bun run dev          # Next.js + Turbopack on localhost:3000
bun run build        # Production build
bun run build:export # Static export for Electron
```

---

## Long-Term Vision

Home Assistant-style extensibility:

1. **Theme layer (done)** -- CSS custom properties, theme customizer
2. **Custom CSS injection (future)** -- Raw CSS from settings
3. **Plugin/widget system (future)** -- Dynamic React components in zones
4. **Marketplace (future)** -- Community themes/widgets, JSON import/export
