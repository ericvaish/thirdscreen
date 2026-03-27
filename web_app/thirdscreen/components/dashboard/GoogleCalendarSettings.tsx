"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Mail } from "lucide-react"
import { toast } from "sonner"
import { generatePKCE } from "@/lib/spotify/pkce"
import {
  GOOGLE_AUTH_URL,
  GOOGLE_SCOPES,
} from "@/lib/google-calendar/constants"

interface GoogleAccount {
  id: string
  email: string
  color: string | null
  calendarIds: string[]
  createdAt: string
}

export function GoogleCalendarSettings() {
  const [clientId, setClientId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<GoogleAccount[]>([])
  const [loading, setLoading] = useState(true)

  const fetchState = useCallback(async () => {
    try {
      const [cidRes, accRes] = await Promise.all([
        fetch("/api/google-calendar?action=client-id"),
        fetch("/api/google-calendar?action=accounts"),
      ])
      if (cidRes.ok) {
        const data = await cidRes.json()
        setClientId(data.clientId as string | null)
      }
      if (accRes.ok) {
        setAccounts(await accRes.json())
      }
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchState()
  }, [fetchState])

  // Listen for OAuth callback
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === "google-calendar-auth" && e.data.success) {
        toast.success("Google account connected")
        fetchState()
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [fetchState])

  const addAccount = async () => {
    if (!clientId) return

    const { codeVerifier, codeChallenge } = await generatePKCE()
    const redirectUri = `${window.location.origin}/api/google-calendar/callback`
    const state = btoa(JSON.stringify({ v: codeVerifier, r: redirectUri }))

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPES,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      access_type: "offline",
      prompt: "consent",
    })

    window.open(
      `${GOOGLE_AUTH_URL}?${params}`,
      "google-calendar-auth",
      "width=500,height=700,left=200,top=100"
    )
  }

  const removeAccount = async (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id))
    try {
      const res = await fetch(`/api/google-calendar?id=${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error()
      toast.success("Account removed")
    } catch {
      toast.error("Failed to remove account")
      fetchState()
    }
  }

  if (loading) {
    return (
      <div className="py-4 text-xs text-muted-foreground animate-pulse">
        Loading...
      </div>
    )
  }

  if (!clientId) {
    return (
      <p className="py-2 text-xs text-muted-foreground">
        Google Calendar is not configured yet.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Connected accounts */}
      <div className="space-y-1.5">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/20"
          >
            <div
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: account.color ?? "#3b82f6" }}
            />
            <Mail className="size-3.5 shrink-0 text-muted-foreground/50" />
            <span className="min-w-0 flex-1 truncate text-sm">
              {account.email}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => removeAccount(account.id)}
              className="shrink-0 text-muted-foreground/50 hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={addAccount}
        className="w-full text-xs"
      >
        <Plus className="mr-1 size-3" />
        Add Google Account
      </Button>
    </div>
  )
}
