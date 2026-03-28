# Third Screen

A glanceable personal dashboard. The user should see everything they need for the day -- schedule, tasks, notes, health vitals -- in a single viewport with zero scrolling. This is NOT an interactive app the user pokes at constantly; it is a dashboard that passively displays information at a glance.

Originally a native macOS SwiftUI app, now pivoting to a web-first architecture with an Electron desktop wrapper planned for cross-platform native access.

## Project Status

- **Swift macOS app** (`iphone_app/`, `thirdscreen.xcodeproj/`): Abandoned. Was a native SwiftUI dashboard. Do not invest time here.
- **Web app** (`web_app/thirdscreen/`): Active primary codebase. Runs standalone in any browser.
- **Electron app** (`electron-app/`): Scaffolded. Shell, IPC handlers, and DB layer built. Data layer abstraction in web app ready. Needs zone components migrated to use data layer, then production packaging.
- **Marketing website**: Removed. Landing page, privacy, and terms pages are now part of the web app (`web_app/thirdscreen/app/page.tsx`, `/privacy`, `/terms`).

## Web App Architecture

**Stack:** Next.js 16 + React 19 + TypeScript 5.9 + Tailwind CSS 4 + shadcn/ui (Radix)

**Database:** SQLite via better-sqlite3 + Drizzle ORM. Single file at `web_app/thirdscreen/thirdscreen.db`. WAL mode, foreign keys enabled.

**Layout:** Zone-based CSS Grid layout. Fixed zones (timeline, tasks, notes, vitals, status bar) fill the viewport with no scrolling. Content adapts to any screen shape -- landscape, portrait, or square. The layout is not a card grid; each zone has a strategic fixed position.

**Fonts:** Inter (body), Space Grotesk (display/headings), JetBrains Mono (monospace). Loaded via next/font/google.

**Design system:** Dark-first with blue-tinted blacks. Each card type has a unique accent color:
- Clock: cyan | Timer: emerald | Todo: amber | Notes: violet
- Schedule: blue | Calories: orange | Medicines: rose

Cards use a glass effect (backdrop-blur + transparency) with colored top borders.

### Key Directories

```
web_app/thirdscreen/
  app/
    page.tsx            # Renders <Dashboard />
    layout.tsx          # Root layout, fonts, ThemeProvider
    globals.css         # Color system (oklch), glass utilities, ambient background
    api/                # REST endpoints (one route.ts per resource)
      cards/            # CRUD for dashboard cards
      layout/           # GET/PUT card positions
      todos/            # CRUD for todo items
      notes/            # CRUD for notes + links sub-resource
      schedule/         # CRUD for calendar events
      calories/         # CRUD for food items + water sub-resource
      medicines/        # CRUD for medicines + doses sub-resource
      settings/         # Key-value app settings
  components/
    dashboard/
      Dashboard.tsx     # Main view: header, zone grid, view switching
      SettingsView.tsx   # Inline settings: theme + integration catalog
    zones/
      TimelineZone.tsx  # Full-width horizontal schedule (percentage-based, no scroll)
      VitalsZone.tsx    # SVG ring gauges for calories, water, medicines
      TasksZone.tsx     # Task list with inline add
      NotesZone.tsx     # Notes + links list
      StatusBar.tsx     # Clock + notification ticker + timer
    cards/              # Legacy card components (kept for reference)
    ui/                 # shadcn/ui components (button, dialog, input, etc.)
    theme-provider.tsx  # next-themes wrapper
  db/
    schema.ts           # Drizzle ORM table definitions
    index.ts            # DB connection, table creation, default seed data
  lib/
    notifications.tsx   # NotificationProvider context + useNotifications hook
    types.ts            # CardType, CardData, TodoItem, NoteItem, etc.
    utils.ts            # cn() utility (clsx + tailwind-merge)
    data-layer.ts       # Unified data abstraction (fetch for web, IPC for Electron)
    integrations/
      types.ts          # IntegrationDef, EnabledIntegration, ZoneType
      registry.ts       # 30+ integration definitions by zone/category
    google-calendar/
      constants.ts      # Google OAuth URLs, scopes, settings keys
      service.ts        # Multi-account OAuth, token refresh, event fetching
    spotify/
      constants.ts      # Spotify OAuth URLs, scopes, settings keys
      service.ts        # OAuth token management, playback API
      pkce.ts           # PKCE utilities (shared with Google Calendar)
```

### DB Tables

`cards`, `todos`, `notes`, `links`, `medicines`, `medicine_dose_logs`, `food_items`, `water_logs`, `schedule_events`, `settings`, `admin_config`, `enabled_integrations`, `calendar_accounts`, `lyrics_cache`. All use text UUIDs as primary keys. Child tables cascade-delete on card removal.

### External Calendar Integration (Multi-Account)

The `calendar_accounts` table stores OAuth tokens for external calendar providers. Supports multiple accounts per provider (e.g. 5 Google accounts, 3 Outlook accounts).

**Schema:** `id, provider ("google"|"outlook"|"apple"), email, access_token, refresh_token, token_expiry, calendar_ids (JSON string[]), color, created_at`

**Google Calendar flow:**
1. User enters Google OAuth Client ID in Settings (stored in `settings` table)
2. Clicks "Add Google Account" -- opens OAuth popup with PKCE
3. Callback at `/api/google-calendar/callback` exchanges code for tokens
4. Account stored in `calendar_accounts` with email auto-detected
5. TimelineZone fetches events from all connected accounts + local events in parallel
6. Each account gets a unique color for its events

**API routes:**
- `GET /api/google-calendar?action=accounts` -- list connected accounts (tokens stripped)
- `GET /api/google-calendar?action=events&date=YYYY-MM-DD` -- events from all accounts
- `GET /api/google-calendar?action=client-id` -- get stored client ID
- `PUT /api/google-calendar` -- set client ID or update account settings
- `DELETE /api/google-calendar?id=...` -- remove an account

### Card Types

`clock` | `timer` | `todo` | `notes` | `schedule` | `calories` | `medicines`

Each card type has a default size defined in `lib/types.ts` (`DEFAULT_CARD_SIZES`). New cards are created via the AddCardDialog which POSTs to `/api/cards`.

### Data Flow & Storage Architecture (Excalidraw Model)

The app has three storage backends, selected automatically:

1. **Local (default)** -- `localStorage` in the browser. No server, no login. Used for anonymous users on the hosted version. All data lives on the user's device.
2. **Server** -- Next.js API routes via `fetch()`. Used for self-hosted deployments or authenticated users (future). Opt-in via `NEXT_PUBLIC_STORAGE=server` env var.
3. **Electron** -- IPC to main process. Used in the desktop app.

**Key files:**
- `lib/data-layer.ts` -- Unified API. Every zone component imports from here instead of calling `fetch()` directly. Auto-detects which backend to use.
- `lib/local-store.ts` -- Complete localStorage CRUD for all data types. Includes `exportAllLocalData()` for future migration to server when user signs in.

**Zone components are fully migrated** to use the data layer: `TasksZone`, `NotesZone`, `VitalsZone`, `TimelineZone`, `Dashboard` (settings), `SettingsView` (integrations), `ScaleProvider`. They work identically in all three storage modes.

**Business model:** Anonymous users get the full dashboard for free (localStorage). Signing in (future) syncs data to server, enables Google Calendar OAuth (admin provides API keys centrally), cross-device sync, and paid features.

**Other data flow patterns:**
- Optimistic updates for todos, notes, links
- Debounced saves for layout changes (300ms) and note content (400ms)
- localStorage for UI preferences (clock style, sun arc toggle)

## Electron App (Option B: Static Export + IPC)

Ships native `.app` (macOS), `.exe` (Windows), AppImage/deb (Linux) with OS-level API access.

### Architecture

```
electron-app/
  src/
    main.ts            # BrowserWindow, app lifecycle. Dev: loads localhost:3000. Prod: loads renderer/
    preload.ts         # contextBridge: exposes window.electronAPI.invoke() to renderer
    database.ts        # SQLite init (same schema as web app db/index.ts), stored in app.getPath('userData')
    ipc-handlers.ts    # All DB operations as IPC handlers (mirrors every API route)
  dist/                # Compiled JS output (git-ignored)
  renderer/            # Static export of Next.js app (git-ignored, built from web_app)
  package.json         # electron, electron-builder, better-sqlite3, uuid
  tsconfig.json
```

### How It Works

**The React UI is shared 100%.** Only the data transport differs:

- `lib/data-layer.ts` (in web app) exports functions like `listTodos()`, `createNote()`, etc.
- Each function checks `isElectron` (detects `window.electronAPI`)
- **Web**: calls `fetch('/api/...')` hitting Next.js API routes
- **Electron**: calls `window.electronAPI.invoke('db:todos:list', ...)` hitting IPC handlers in main process

Zone components should import from `@/lib/data-layer` instead of calling `fetch()` directly. This is the remaining migration step -- current zone components still use raw `fetch()`.

### IPC Channel Naming

All channels follow the pattern `db:{resource}:{operation}`:
- `db:layout:get` / `db:layout:update`
- `db:cards:create` / `db:cards:delete`
- `db:todos:list` / `db:todos:create` / `db:todos:update` / `db:todos:delete`
- `db:notes:list` / `db:notes:create` / `db:notes:update` / `db:notes:delete`
- `db:links:list` / `db:links:create` / `db:links:delete`
- `db:schedule:list` / `db:schedule:create` / `db:schedule:update` / `db:schedule:delete`
- `db:calories:list` / `db:calories:create` / `db:calories:delete`
- `db:water:get` / `db:water:upsert`
- `db:medicines:list` / `db:medicines:create` / `db:medicines:update` / `db:medicines:delete`
- `db:doses:list` / `db:doses:toggle`
- `db:settings:get` / `db:settings:set`
- `db:integrations:list` / `db:integrations:toggle`

### Remaining Steps

1. **Migrate zone components** to use `data-layer.ts` instead of raw `fetch()` calls
2. **Test Electron dev mode** (`npm run dev` in electron-app while web app dev server runs)
3. **Test static export** (`npm run build:export` in web app, copy `out/` to `electron-app/renderer/`)
4. **Package for macOS** (`npm run dist:mac` in electron-app)

### Static Export

The web app has a separate Next.js config for Electron builds:
- `next.config.export.mjs` -- sets `output: 'export'`, disables image optimization
- `npm run build:export` -- builds to `out/` directory (no server, no API routes)

### Native Features (post-MVP)

- **macOS:** Calendar.app integration (EventKit), system notifications, menu bar widget, global shortcuts
- **Linux:** System tray, D-Bus notifications
- **Windows:** Taskbar integration, Windows notifications, startup launch
- Auto-update via `electron-updater` with GitHub Releases

## Development

### Web app (standalone browser use)
```bash
cd web_app/thirdscreen
bun install          # or npm install
bun run dev          # Next.js dev server with Turbopack on localhost:3000
bun run build        # production build (server mode)
bun run build:export # static export for Electron (outputs to out/)
bun run typecheck    # TypeScript check
bun run lint         # ESLint
bun run format       # Prettier
```

### Electron app (desktop use)
```bash
cd electron-app
npm install
npm run dev          # compiles TS + launches Electron (expects web dev server on :3000)
npm run build        # compile TypeScript only
npm run dist:mac     # full build: compile + export web app + package .app/.dmg
```

DB file is auto-created on first run with default seed data. Web app stores in `web_app/thirdscreen/thirdscreen.db`. Electron stores in the OS user data directory.

## Maintaining This File

This project evolves rapidly. When you make structural changes (new components, new directories, new card types, architecture shifts, new build steps, etc.), update this CLAUDE.md to reflect them before finishing the task. This file is the primary context an AI reads at the start of every conversation -- if it's stale, the next session starts with wrong assumptions.

## Dashboard Design Principles

- **Zero scroll by default.** Everything must fit in a single viewport. No page-level scrollbar. Internal scroll only for lists that grow beyond their zone (tasks, notes).
- **Viewport-adaptive.** The layout must work on any screen shape: landscape, portrait, square, ultrawide. Zones rearrange or resize to fill the available space without clipping or scrolling.
- **Glanceable, not interactive.** This is a dashboard, not a CRUD app. The primary use case is looking at it. Interaction (adding tasks, logging food) is secondary and should not dominate the UI.
- **No fixed pixel sizes for layout.** Use percentages, fr units, and flex/grid to fill available space. Fixed pixel values cause scrollbars on different screen sizes.
- **Integration-driven data.** Zones consume data from pluggable integrations (lib/integrations/). The UI does not care where data comes from -- Google Calendar, local DB, or Todoist all feed into the same timeline zone.

## Touch Targets & Button Sizing

This app is designed to run on tablets (iPad, Android tablets) as wall-mounted or desk dashboards with touchscreen input. All interactive elements must meet minimum touch target sizes.

**Minimum touch target: 44x44px** (Apple HIG / WCAG 2.5.8). No interactive element should be smaller than this. This applies to buttons, icon buttons, checkboxes, links in lists, popover triggers, and any clickable element.

**Button size variants** (defined in `components/ui/button.tsx`):

| Variant | Current | Target | Use for |
|---------|---------|--------|---------|
| `icon-xs` | 24px (size-6) | **44px (size-11)** | Icon-only buttons in zone headers, inline actions |
| `xs` | h-6 (24px) | **h-11 (44px)** | Small text buttons, tag-style actions |
| `icon-sm` | 28px (size-7) | **44px (size-11)** | Dialog/sheet close buttons |
| `sm` | h-7 (28px) | **h-11 (44px)** | Secondary actions, form buttons |
| `default` | h-8 (32px) | **h-11 (44px)** | Primary actions |
| `icon` | 32px (size-8) | **44px (size-11)** | Standard icon buttons |
| `lg` | h-9 (36px) | **h-12 (48px)** | Large primary CTAs |
| `icon-lg` | 36px (size-9) | **48px (size-12)** | Large icon buttons |

**Rules:**
- Every `<Button>` variant must produce a minimum 44px touch target.
- Icon buttons that appear visually small can use padding to reach 44px (the visual icon stays small, but the hit area is large).
- Inline text links inside lists/paragraphs should have at least 44px of vertical hit area via padding.
- Checkboxes and toggles need a 44px tappable wrapper, even if the visual checkbox is smaller.
- In the timeline/schedule zone, event bars are already tall enough; clickable pills (all-day events, medicine doses) should have min-height 44px hit area.
- Do not make buttons so large that they dominate the glanceable UI. Use padding for hit area, not visual size. The visual footprint can stay compact.

**Implementation approach:** Update `buttonVariants` in `components/ui/button.tsx` to set minimum heights/sizes to 44px across all variants. Consolidate `icon-xs`, `xs`, `icon-sm`, `sm`, `default`, and `icon` into fewer distinct sizes since they all converge to the same minimum.

## Touch-First Interaction Design

This app targets iPads and touchscreen displays. Hover states are unreliable on touch interfaces.

- **Never hide UI behind hover.** Do not use `opacity-0 group-hover:opacity-100` or similar patterns to reveal buttons, icons, or actions. On touch devices, users cannot hover, so these elements become undiscoverable.
- **Always-visible, subtle actions.** Action buttons (delete, pin, dismiss) should always be visible but use low-contrast colors (e.g. `text-muted-foreground/30`) so they don't dominate the glanceable UI. They become more prominent on press via `hover:text-destructive` or `active:` states, which do work on touch (fired on tap).
- **No hover-dependent tooltips for critical info.** If information is important, show it inline. Tooltips via `title` attributes are acceptable for supplementary info since they don't affect functionality.

## Minimum Font Sizes

This app runs on iPads and touchscreen displays where readability at a glance is critical. All text must meet minimum size requirements based on Apple HIG, Material Design, and WCAG guidelines.

**Hard minimum: 11px (0.6875rem).** No text in the app should be smaller than this. This matches Apple's smallest allowed size in Human Interface Guidelines.

| Tailwind Class | Size | Use for |
|---------------|------|---------|
| `text-xs` | 12px | Smallest standard text: labels, metadata, timestamps, captions |
| `text-sm` | 14px | Body text, list items, descriptions |
| `text-base` | 16px | Primary readable content |
| `text-[0.6875rem]` | 11px | Absolute minimum: only for decorative/non-essential labels (e.g. source badges) |

**Banned sizes** (all below 11px):
- `text-[0.625rem]` (10px), `text-[0.5625rem]` (9px), `text-[0.5rem]` (8px), `text-[0.4375rem]` (7px), `text-[0.375rem]` (6px)
- These exist in the current codebase and should be migrated to `text-xs` (12px) or `text-[0.6875rem]` (11px) over time.

**Rules:**
- New code must not use any font size below 11px.
- When editing existing code that uses banned sizes, upgrade them to the nearest allowed size.
- Monospace text (timestamps, counters) at `text-xs` (12px) is the smallest allowed.
- Zone header labels should be at least `text-sm` (14px).

## Style Guidelines

- Do not use em dashes in public-facing website copy (signals AI-generated content).
- Always use the `frontend-design` skill when designing any web application UI.
