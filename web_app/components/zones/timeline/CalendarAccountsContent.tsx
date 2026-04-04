"use client"

import { Plus, Mail, Trash2, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SignInButton } from "@clerk/nextjs"

export function CalendarAccountsContent({
  isSignedIn,
  calendarAccounts,
  googleClientId,
  addGoogleAccount,
  removeCalendarAccount,
}: {
  isSignedIn: boolean
  calendarAccounts: { id: string; email: string; color?: string | null }[]
  googleClientId: string | null
  addGoogleAccount: () => void
  removeCalendarAccount: (id: string) => void
}) {
  return (
    <>
      <p className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Connected Calendars
      </p>
      {isSignedIn ? (
        <>
          {calendarAccounts.length > 0 ? (
            <div className="mb-3 space-y-1">
              {calendarAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="group flex min-h-11 items-center gap-2 rounded px-2 hover:bg-muted/30"
                >
                  <div
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: acc.color ?? "#3b82f6" }}
                  />
                  <Mail className="size-3 shrink-0 text-muted-foreground/40" />
                  <span className="min-w-0 flex-1 truncate text-xs">{acc.email}</span>
                  <button
                    onClick={() => removeCalendarAccount(acc.id)}
                    className="flex size-11 shrink-0 items-center justify-center"
                  >
                    <Trash2 className="size-2.5 text-muted-foreground/30 hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-xs text-muted-foreground/40">
              No calendars connected yet
            </p>
          )}
          {googleClientId && (
            <Button
              variant="outline"
              size="sm"
              onClick={addGoogleAccount}
              className="w-full text-xs"
            >
              <Plus className="size-3" />
              Add Google Account
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground/50">
            Connect your calendars to see events from Google, Outlook, and more on your schedule.
          </p>
          <div className="mb-3 space-y-1.5">
            <div className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground/40">
              <div className="size-2 rounded-full bg-blue-500/40" />
              Google Calendar
            </div>
            <div className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground/40">
              <div className="size-2 rounded-full bg-sky-500/40" />
              Outlook Calendar
            </div>
            <div className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground/40">
              <div className="size-2 rounded-full bg-rose-500/40" />
              Apple Calendar
            </div>
          </div>
          <SignInButton mode="modal">
            <Button variant="outline" size="sm" className="w-full text-xs">
              <LogIn className="size-3" />
              Sign in to connect
            </Button>
          </SignInButton>
        </>
      )}
    </>
  )
}
