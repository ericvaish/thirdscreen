"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

export interface AuthUser {
  id: string
  email: string
  name?: string | null
  avatarUrl?: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  isLoaded: boolean
  isSignedIn: boolean
  userId: string | null
  signIn: (returnTo?: string) => void
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" })
      if (!res.ok) {
        setUser(null)
        return
      }
      const data = await res.json()
      setUser(data.user ?? null)
    } catch {
      setUser(null)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback((returnTo?: string) => {
    const target =
      returnTo ??
      (typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/app")
    window.location.href = `/sign-in?return_to=${encodeURIComponent(target)}`
  }, [])

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" })
    } catch {
      // ignore
    }
    setUser(null)
    if (typeof window !== "undefined") {
      window.location.href = "/"
    }
  }, [])

  const value: AuthContextValue = {
    user,
    isLoaded,
    isSignedIn: !!user,
    userId: user?.id ?? null,
    signIn,
    signOut,
    refresh,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    // Match Clerk's behavior of returning a sane default before mount.
    return {
      user: null,
      isLoaded: false,
      isSignedIn: false,
      userId: null,
      signIn: () => {},
      signOut: async () => {},
      refresh: async () => {},
    }
  }
  return ctx
}
