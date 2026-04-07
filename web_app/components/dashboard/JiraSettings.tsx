"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Globe } from "lucide-react"
import { toast } from "sonner"
import {
  ATLASSIAN_AUTH_URL,
  JIRA_SCOPES,
} from "@/lib/jira/constants"

interface JiraAccountInfo {
  id: string
  email: string
  displayName: string | null
  siteUrl: string | null
  createdAt: string
}

export function JiraSettings() {
  const [clientId, setClientId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<JiraAccountInfo[]>([])
  const [loading, setLoading] = useState(true)

  const fetchState = useCallback(async () => {
    try {
      const [cidRes, accRes] = await Promise.all([
        fetch("/api/jira?action=client-id"),
        fetch("/api/jira?action=accounts"),
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
      if (e.data?.type === "jira-auth" && e.data.success) {
        toast.success("Jira account connected")
        fetchState()
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [fetchState])

  const addAccount = async () => {
    if (!clientId) return

    const redirectUri = `${window.location.origin}/api/jira/callback`
    const state = btoa(JSON.stringify({ r: redirectUri }))

    const params = new URLSearchParams({
      audience: "api.atlassian.com",
      client_id: clientId,
      scope: JIRA_SCOPES,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      prompt: "consent",
    })

    window.open(
      `${ATLASSIAN_AUTH_URL}?${params}`,
      "jira-auth",
      "width=500,height=700,left=200,top=100"
    )
  }

  const removeAccount = async (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id))
    try {
      const res = await fetch(`/api/jira?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Jira account removed")
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
        Jira is not configured yet.
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
            <Globe className="size-3.5 shrink-0 text-muted-foreground/50" />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm">
                {account.email}
              </span>
              {account.siteUrl && (
                <span className="block truncate text-xs text-muted-foreground/50">
                  {account.siteUrl.replace(/^https?:\/\//, "")}
                </span>
              )}
            </div>
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
        Add Jira Account
      </Button>
    </div>
  )
}
