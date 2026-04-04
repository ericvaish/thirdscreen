"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Settings, Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"

export function SettingsSheet() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <Settings className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-80 border-border bg-popover">
        <SheetHeader>
          <SheetTitle className="font-[family-name:var(--font-display)]">Settings</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {/* Appearance */}
          <div className="space-y-3">
            <Label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Appearance
            </Label>
            <div className="flex gap-2">
              {[
                { value: "light", icon: Sun, label: "Light" },
                { value: "dark", icon: Moon, label: "Dark" },
                { value: "system", icon: Monitor, label: "System" },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs transition-all ${
                    theme === value
                      ? "border-primary/30 bg-primary/10 text-foreground shadow-sm"
                      : "border-border text-muted-foreground hover:bg-muted/30"
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* About */}
          <div className="space-y-3">
            <Label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              About
            </Label>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="font-[family-name:var(--font-display)] font-medium">Third Screen Web</p>
              <p className="font-mono text-xs text-muted-foreground/50">v1.0.0</p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
