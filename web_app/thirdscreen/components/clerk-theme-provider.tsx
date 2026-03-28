"use client"

import { useEffect } from "react"
import { ClerkProvider, useClerk } from "@clerk/nextjs"

function ClerkSessionSync({ children }: { children: React.ReactNode }) {
  const clerk = useClerk()

  useEffect(() => {
    // Override Clerk's internal server action session sync with a simple
    // page reload. Cloudflare Pages (next-on-pages) doesn't support POST
    // to page routes, which is what Clerk's default server action does.
    if (typeof window !== "undefined") {
      (window as Record<string, unknown>).__internal_onBeforeSetActive =
        async () => {
          window.location.reload()
        }
    }
  }, [clerk])

  return <>{children}</>
}

export function ClerkThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <ClerkSessionSync>{children}</ClerkSessionSync>
    </ClerkProvider>
  )
}
