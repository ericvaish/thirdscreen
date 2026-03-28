"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Mail, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { generatePKCE } from "@/lib/spotify/pkce"
import {
  GOOGLE_AUTH_URL,
  GMAIL_SCOPES,
  CHAT_SCOPES,
} from "@/lib/google-services/constants"

type ServiceType = "gmail" | "chat"

interface ServiceAccount {
  id: string
  email: string
  service: ServiceType
}

const SERVICE_META: Record<ServiceType, { label: string; icon: typeof Mail; color: string; scopes: string }> = {
  gmail: { label: "Gmail", icon: Mail, color: "text-violet-400", scopes: GMAIL_SCOPES },
  chat: { label: "Google Chat", icon: MessageSquare, color: "text-cyan-400", scopes: CHAT_SCOPES },
}

export function GoogleServicesSettings() {
  const [clientId, setClientId] = useState<string | null>(null)
  const [gmailAccounts, setGmailAccounts] = useState<ServiceAccount[]>([])
  const [chatAccounts, setChatAccounts] = useState<ServiceAccount[]>([])
  const [loading, setLoading] = useState(true)

  const fetchState = useCallback(async () => {
    try {
      const [cidRes, gmailRes, chatRes] = await Promise.all([
        fetch("/api/google-services?action=client-id"),
        fetch("/api/google-services?service=gmail&action=accounts"),
        fetch("/api/google-services?service=chat&action=accounts"),
      ])
      if (cidRes.ok) {
        const data: { clientId?: string } = await cidRes.json()
        setClientId(data.clientId ?? null)
      }
      if (gmailRes.ok) setGmailAccounts(await gmailRes.json())
      if (chatRes.ok) setChatAccounts(await chatRes.json())
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
      if (e.data?.type === "google-service-auth" && e.data.success) {
        const svc = e.data.service as ServiceType
        const label = SERVICE_META[svc]?.label ?? svc
        toast.success(`${label} connected`)
        fetchState()
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [fetchState])

  const addAccount = async (service: ServiceType) => {
    if (!clientId) return

    const { codeVerifier, codeChallenge } = await generatePKCE()
    const redirectUri = `${window.location.origin}/api/google-services/callback`
    const state = btoa(JSON.stringify({ v: codeVerifier, r: redirectUri, s: service }))

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SERVICE_META[service].scopes,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
      access_type: "offline",
      prompt: "consent",
    })

    window.open(
      `${GOOGLE_AUTH_URL}?${params}`,
      `google-${service}-auth`,
      "width=500,height=700,left=200,top=100"
    )
  }

  const removeAccount = async (id: string, service: ServiceType) => {
    const setter = service === "gmail" ? setGmailAccounts : setChatAccounts
    setter((prev) => prev.filter((a) => a.id !== id))
    try {
      const res = await fetch(
        `/api/google-services?service=${service}&id=${id}`,
        { method: "DELETE" }
      )
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
        Google services are not configured yet. Set up your Google OAuth Client
        ID in environment variables.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {(["gmail", "chat"] as const).map((service) => {
        const meta = SERVICE_META[service]
        const Icon = meta.icon
        const accounts = service === "gmail" ? gmailAccounts : chatAccounts

        return (
          <div key={service}>
            <div className="mb-2 flex items-center gap-1.5">
              <Icon className={`size-3.5 ${meta.color}`} />
              <span className="text-xs font-semibold">{meta.label}</span>
            </div>

            {accounts.length > 0 && (
              <div className="mb-2 space-y-1">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/20"
                  >
                    <Mail className="size-3.5 shrink-0 text-muted-foreground/50" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {acc.email}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeAccount(acc.id, service)}
                      className="shrink-0 text-muted-foreground/50 hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => addAccount(service)}
              className="w-full text-xs"
            >
              <Plus className="mr-1 size-3" />
              Connect {meta.label}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
