"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Mail, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { generatePKCE } from "@/lib/spotify/pkce" // reuse PKCE utility
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
  const [clientId, setClientId] = useState("")
  const [savedClientId, setSavedClientId] = useState<string | null>(null)
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
        const cid = data.clientId as string | null
        setSavedClientId(cid)
        if (cid) setClientId(cid)
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

  const saveClientId = async () => {
    const trimmed = clientId.trim()
    if (!trimmed) return
    try {
      await fetch("/api/google-calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: trimmed }),
      })
      setSavedClientId(trimmed)
      toast.success("Client ID saved")
    } catch {
      toast.error("Failed to save")
    }
  }

  const addAccount = async () => {
    if (!savedClientId) {
      toast.error("Set a Client ID first")
      return
    }

    const { codeVerifier, codeChallenge } = await generatePKCE()
    const redirectUri = `${window.location.origin}/api/google-calendar/callback`
    const state = btoa(JSON.stringify({ v: codeVerifier, r: redirectUri }))

    const params = new URLSearchParams({
      client_id: savedClientId,
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

  return (
    <div className="space-y-4">
      {/* Client ID setup */}
      {!savedClientId ? (
        <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            To sync Google Calendar, enter your Google OAuth Client ID.
            Create one at{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              Google Cloud Console
              <ExternalLink className="size-2.5" />
            </a>
            {" "}with redirect URI:{" "}
            <code className="rounded bg-muted/40 px-1 py-0.5 font-mono text-[0.625rem]">
              {typeof window !== "undefined"
                ? `${window.location.origin}/api/google-calendar/callback`
                : "/api/google-calendar/callback"}
            </code>
          </p>
          <div className="flex gap-2">
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Google OAuth Client ID"
              className="h-8 flex-1 font-mono text-xs"
            />
            <Button
              size="sm"
              onClick={saveClientId}
              disabled={!clientId.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/10 px-4 py-2">
          <div className="text-xs text-muted-foreground">
            Client ID:{" "}
            <span className="font-mono text-foreground/60">
              {savedClientId.slice(0, 20)}...
            </span>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setSavedClientId(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Change
          </Button>
        </div>
      )}

      {/* Connected accounts */}
      {savedClientId && (
        <>
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
        </>
      )}
    </div>
  )
}
