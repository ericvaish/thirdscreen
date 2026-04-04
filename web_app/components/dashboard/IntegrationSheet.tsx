"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Puzzle } from "lucide-react"
import {
  INTEGRATION_REGISTRY,
  getIntegrationsByCategory,
} from "@/lib/integrations/registry"
import type { EnabledIntegration } from "@/lib/integrations/types"

// Dynamically import icons by name
import * as Icons from "lucide-react"

function getIcon(name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (Icons as any)[name] as React.ComponentType<{ className?: string }> | undefined
  return Icon ?? Icons.Puzzle
}

export function IntegrationSheet() {
  const [integrations, setIntegrations] = useState<EnabledIntegration[]>([])
  const categories = getIntegrationsByCategory()

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations")
      if (!res.ok) return
      setIntegrations(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    fetchIntegrations()
  }, [fetchIntegrations])

  const isEnabled = (integrationId: string): boolean => {
    const record = integrations.find(
      (i) => i.integrationId === integrationId
    )
    return record?.enabled ?? false
  }

  const toggle = async (integrationId: string, enabled: boolean) => {
    // Optimistic
    setIntegrations((prev) => {
      const existing = prev.find((i) => i.integrationId === integrationId)
      if (existing) {
        return prev.map((i) =>
          i.integrationId === integrationId ? { ...i, enabled } : i
        )
      }
      return [
        ...prev,
        {
          id: integrationId,
          integrationId,
          enabled,
          config: null,
          createdAt: new Date().toISOString(),
        },
      ]
    })

    try {
      const res = await fetch("/api/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId, enabled }),
      })
      if (!res.ok) throw new Error()
      setIntegrations(await res.json())
    } catch {
      fetchIntegrations()
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
        >
          <Puzzle className="size-3.5" />
          <span className="hidden sm:inline">Integrations</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[360px] overflow-auto sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Puzzle className="size-4" />
            Integrations
          </SheetTitle>
        </SheetHeader>

        <p className="mt-2 text-xs text-muted-foreground">
          Enable data sources to populate your dashboard zones. Built-in
          integrations work out of the box. External ones will require
          connecting your account.
        </p>

        <div className="mt-6 space-y-6">
          {Array.from(categories.entries()).map(([category, items]) => (
            <div key={category}>
              <h3 className="mb-3 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                {category}
              </h3>
              <div className="space-y-1">
                {items.map((def) => {
                  const Icon = getIcon(def.icon)
                  const enabled = isEnabled(def.id)

                  return (
                    <div
                      key={def.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {def.name}
                          </span>
                          {def.builtIn && (
                            <Badge
                              variant="secondary"
                              className="px-1 py-0 font-mono text-[8px] uppercase"
                            >
                              built-in
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {def.description}
                        </p>
                      </div>
                      <Switch
                        size="sm"
                        checked={enabled}
                        onCheckedChange={(checked) =>
                          toggle(def.id, checked)
                        }
                        disabled={!def.builtIn && !enabled}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
