"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CloudUpload, Check, AlertTriangle, Loader2, Trash2 } from "lucide-react"
import {
  hasLocalData,
  mergeLocalToServer,
  isMergeDone,
  markMergeDone,
  clearLocalDataAfterMerge,
  exportLocalData,
} from "@/lib/data-layer"

type MergeState = "prompt" | "merging" | "done" | "error"

export function DataMergeDialog() {
  const { isSignedIn, isLoaded } = useAuth()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<MergeState>("prompt")
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [conflicts, setConflicts] = useState<{ type: string; message: string }[]>([])
  const [errorMsg, setErrorMsg] = useState("")

  // Check on mount: signed in + has local data + hasn't merged yet
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    if (isMergeDone()) return
    if (!hasLocalData()) {
      markMergeDone()
      return
    }
    setOpen(true)
  }, [isSignedIn, isLoaded])

  const handleMerge = useCallback(async () => {
    setState("merging")
    try {
      const result = await mergeLocalToServer()
      if (result.success) {
        setSummary(result.summary)
        setConflicts(result.conflicts ?? [])
        setState("done")
        markMergeDone()
      } else {
        setErrorMsg("Server returned an error.")
        setState("error")
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error")
      setState("error")
    }
  }, [])

  const handleSkip = useCallback(() => {
    markMergeDone()
    setOpen(false)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [])

  const handleCleanup = useCallback(() => {
    clearLocalDataAfterMerge()
    setOpen(false)
  }, [])

  const localData = typeof window !== "undefined" ? exportLocalData() : {}
  const localCounts = {
    todos: (localData.todos as unknown[])?.length ?? 0,
    notes: (localData.notes as unknown[])?.length ?? 0,
    links: (localData.links as unknown[])?.length ?? 0,
    events: (localData.schedule_events as unknown[])?.length ?? 0,
    medicines: (localData.medicines as unknown[])?.length ?? 0,
    foods: (localData.food_items as unknown[])?.length ?? 0,
    feeds: (localData.rss_feeds as unknown[])?.length ?? 0,
  }
  const totalLocal = Object.values(localCounts).reduce((a, b) => a + b, 0)

  const totalMerged = Object.values(summary).reduce((a, b) => a + b, 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-[family-name:var(--font-display)] text-base font-bold tracking-tight">
            <CloudUpload className="size-5 text-primary" />
            {state === "prompt" && "Sync local data to cloud"}
            {state === "merging" && "Syncing..."}
            {state === "done" && "Sync complete"}
            {state === "error" && "Sync failed"}
          </DialogTitle>
        </DialogHeader>

        {/* ── Prompt ──────────────────────────────────────────────────── */}
        {state === "prompt" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You have data saved in this browser from before you signed in.
              Would you like to merge it with your cloud data?
            </p>

            <div className="rounded-lg border border-border/20 p-3">
              <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/40">
                Local data found
              </p>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {localCounts.todos > 0 && <DataRow label="Tasks" count={localCounts.todos} />}
                {localCounts.notes > 0 && <DataRow label="Notes" count={localCounts.notes} />}
                {localCounts.links > 0 && <DataRow label="Links" count={localCounts.links} />}
                {localCounts.events > 0 && <DataRow label="Events" count={localCounts.events} />}
                {localCounts.medicines > 0 && <DataRow label="Medicines" count={localCounts.medicines} />}
                {localCounts.foods > 0 && <DataRow label="Food items" count={localCounts.foods} />}
                {localCounts.feeds > 0 && <DataRow label="RSS feeds" count={localCounts.feeds} />}
              </div>
              <p className="mt-2 font-mono text-xs text-muted-foreground/30">
                {totalLocal} items total
              </p>
            </div>

            <p className="text-xs text-muted-foreground/50">
              Duplicates will be skipped automatically. Your cloud data will not be overwritten.
            </p>
          </div>
        )}

        {/* ── Merging ─────────────────────────────────────────────────── */}
        {state === "merging" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Merging your data with the cloud...
            </p>
          </div>
        )}

        {/* ── Done ────────────────────────────────────────────────────── */}
        {state === "done" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Check className="size-5 text-emerald-500" />
              <p className="text-sm">
                {totalMerged > 0
                  ? `${totalMerged} new items merged to your cloud account.`
                  : "Everything was already in sync. No new data to merge."}
              </p>
            </div>

            {totalMerged > 0 && (
              <div className="rounded-lg border border-border/20 p-3">
                <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/40">
                  Merged
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {Object.entries(summary)
                    .filter(([, v]) => v > 0)
                    .map(([key, count]) => (
                      <DataRow key={key} label={formatKey(key)} count={count} />
                    ))}
                </div>
              </div>
            )}

            {conflicts.length > 0 && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" />
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Notes
                  </p>
                </div>
                {conflicts.map((c, i) => (
                  <p key={i} className="mt-1 text-xs text-muted-foreground">
                    {c.message}
                  </p>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground/50">
              You can clear the local browser data now that it's in the cloud, or keep it as a backup.
            </p>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────── */}
        {state === "error" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              <p className="text-sm">{errorMsg}</p>
            </div>
            <p className="text-xs text-muted-foreground/50">
              Your local data is safe. You can try again later from Settings.
            </p>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <DialogFooter className="gap-2 sm:gap-0">
          {state === "prompt" && (
            <>
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                Skip
              </Button>
              <Button size="sm" onClick={handleMerge}>
                <CloudUpload className="mr-1.5 size-3.5" />
                Merge to cloud
              </Button>
            </>
          )}
          {state === "done" && (
            <>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Keep local data
              </Button>
              <Button variant="outline" size="sm" onClick={handleCleanup}>
                <Trash2 className="mr-1.5 size-3.5" />
                Clear local data
              </Button>
            </>
          )}
          {state === "error" && (
            <>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Close
              </Button>
              <Button size="sm" onClick={handleMerge}>
                Retry
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DataRow({ label, count }: { label: string; count: number }) {
  return (
    <>
      <span className="text-muted-foreground/60">{label}</span>
      <span className="font-mono font-medium">{count}</span>
    </>
  )
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
