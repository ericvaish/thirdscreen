"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Home,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { getSetting, setSetting } from "@/lib/data-layer"

interface EntityInfo {
  entity_id: string
  state: string
  friendly_name: string
  domain: string
}

type Phase =
  | "loading"
  | "setup"      // No URL/token configured yet
  | "connected"  // Successfully connected

export function HomeAssistantSettings() {
  const [phase, setPhase] = useState<Phase>("loading")
  const [url, setUrl] = useState("")
  const [token, setToken] = useState("")
  const [testing, setTesting] = useState(false)
  const [connectionInfo, setConnectionInfo] = useState<{
    locationName: string
    version: string
  } | null>(null)
  const [entities, setEntities] = useState<EntityInfo[]>([])
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set())

  const fetchEntities = useCallback(async () => {
    try {
      const res = await fetch("/api/home-assistant?action=entities")
      if (res.ok) {
        const data = await res.json() as { entities: EntityInfo[] }
        setEntities(data.entities)
      }
    } catch {}
  }, [])

  // Load existing config
  useEffect(() => {
    async function load() {
      try {
        const [storedUrl, storedToken, storedSelected] = await Promise.all([
          getSetting("ha_base_url") as Promise<string | null>,
          getSetting("ha_access_token") as Promise<string | null>,
          getSetting("ha_selected_entities") as Promise<string[] | null>,
        ])

        if (storedUrl && storedToken) {
          setUrl(storedUrl)
          setToken(storedToken)
          setSelectedEntities(new Set(storedSelected ?? []))
          try {
            const res = await fetch(
              `/api/home-assistant?action=test&url=${encodeURIComponent(storedUrl)}&token=${encodeURIComponent(storedToken)}`,
            )
            if (res.ok) {
              const data = (await res.json()) as { locationName: string; version: string }
              setConnectionInfo({ locationName: data.locationName, version: data.version })
              setPhase("connected")
              fetchEntities()
              return
            }
          } catch {}
          setPhase("setup")
        } else {
          setPhase("setup")
        }
      } catch {
        setPhase("setup")
      }
    }
    load()
  }, [fetchEntities])

  const handleTest = async () => {
    if (!url || !token) {
      toast.error("Enter both URL and access token")
      return
    }

    setTesting(true)
    try {
      const cleanUrl = url.replace(/\/+$/, "")
      const res = await fetch(
        `/api/home-assistant?action=test&url=${encodeURIComponent(cleanUrl)}&token=${encodeURIComponent(token)}`,
      )
      const data = (await res.json()) as {
        success?: boolean
        error?: string
        locationName?: string
        version?: string
      }

      if (!res.ok || data.error) {
        toast.error(data.error || "Connection failed")
        return
      }

      // Save config
      await Promise.all([
        setSetting("ha_base_url", cleanUrl),
        setSetting("ha_access_token", token),
      ])

      // Also save to server
      try {
        await fetch("/api/home-assistant", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseUrl: cleanUrl, accessToken: token }),
        })
      } catch {}

      setConnectionInfo({ locationName: data.locationName ?? "", version: data.version ?? "" })
      setPhase("connected")
      toast.success(`Connected to ${data.locationName ?? "Home Assistant"}`)
      fetchEntities()
    } catch {
      toast.error("Could not reach Home Assistant")
    } finally {
      setTesting(false)
    }
  }

  const handleDisconnect = async () => {
    await Promise.all([
      setSetting("ha_base_url", null),
      setSetting("ha_access_token", null),
      setSetting("ha_selected_entities", null),
    ])

    try {
      await fetch("/api/home-assistant", { method: "DELETE" })
    } catch {}

    setUrl("")
    setToken("")
    setConnectionInfo(null)
    setSelectedEntities(new Set())
    setEntities([])
    setPhase("setup")
    toast.success("Disconnected from Home Assistant")
  }

  const toggleEntity = async (entityId: string) => {
    const next = new Set(selectedEntities)
    if (next.has(entityId)) {
      next.delete(entityId)
    } else {
      next.add(entityId)
    }
    setSelectedEntities(next)

    const arr = Array.from(next)
    await setSetting("ha_selected_entities", arr)
    try {
      await fetch("/api/home-assistant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedEntities: arr }),
      })
    } catch {}
  }

  const selectAll = async () => {
    const all = new Set(entities.map((e) => e.entity_id))
    setSelectedEntities(all)
    const arr = Array.from(all)
    await setSetting("ha_selected_entities", arr)
    try {
      await fetch("/api/home-assistant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedEntities: arr }),
      })
    } catch {}
  }

  const selectNone = async () => {
    setSelectedEntities(new Set())
    await setSetting("ha_selected_entities", [])
    try {
      await fetch("/api/home-assistant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedEntities: [] }),
      })
    } catch {}
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/30 px-4 py-3">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/30 px-4 py-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--zone-smarthome-accent)]/15">
          <Home className="size-4 text-[var(--zone-smarthome-accent)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Home Assistant</span>
            {phase === "connected" && (
              <CheckCircle2 className="size-4 text-emerald-500" />
            )}
          </div>
          {connectionInfo && (
            <p className="text-xs text-muted-foreground">
              {connectionInfo.locationName} (v{connectionInfo.version})
            </p>
          )}
        </div>
        {phase === "connected" && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDisconnect}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {/* Setup form */}
      {phase === "setup" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Enter your Home Assistant URL and a long-lived access token.
            Generate one from your{" "}
            <span className="font-medium text-foreground/80">
              HA Profile &gt; Long-Lived Access Tokens
            </span>.
          </p>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Home Assistant URL
            </Label>
            <Input
              placeholder="https://homeassistant.local:8123"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-11 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Access Token
            </Label>
            <Input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="h-11 text-sm"
            />
          </div>

          <Button
            onClick={handleTest}
            disabled={testing || !url || !token}
            className="h-11 w-full"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Testing...
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </div>
      )}

      {/* Entity picker (connected state) */}
      {phase === "connected" && entities.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Dashboard Entities ({selectedEntities.size} of {entities.length})
            </Label>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 px-2 text-xs">
                All
              </Button>
              <Button variant="ghost" size="sm" onClick={selectNone} className="h-7 px-2 text-xs">
                None
              </Button>
            </div>
          </div>

          <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-border/20 p-1">
            {entities.map((entity) => (
              <label
                key={entity.entity_id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/30"
              >
                <Switch
                  checked={selectedEntities.has(entity.entity_id)}
                  onCheckedChange={() => toggleEntity(entity.entity_id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{entity.friendly_name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground/60">
                    {entity.entity_id}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs ${
                    entity.state === "on"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {entity.state}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {phase === "connected" && entities.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No supported entities found. Make sure you have lights, switches, fans, or climate devices in Home Assistant.
        </p>
      )}
    </div>
  )
}
