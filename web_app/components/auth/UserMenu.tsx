"use client"

import { useEffect, useRef, useState } from "react"
import { LogOut } from "lucide-react"
import { useAuth } from "./AuthProvider"

export function UserMenu() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("pointerdown", onClick)
    return () => document.removeEventListener("pointerdown", onClick)
  }, [open])

  if (!user) return null

  const initial =
    (user.name?.trim()?.charAt(0) || user.email.charAt(0) || "?").toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-foreground/10 text-xs font-semibold text-foreground transition-all hover:bg-foreground/20 active:scale-95"
        aria-label="Account menu"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.name ?? user.email}
            className="size-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span>{initial}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border/30 bg-background/95 p-1.5 shadow-xl backdrop-blur-xl">
          <div className="border-b border-border/20 px-3 py-2">
            <p className="truncate text-xs font-semibold text-foreground">
              {user.name ?? "Account"}
            </p>
            <p className="truncate text-[0.6875rem] text-muted-foreground">
              {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              void signOut()
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
