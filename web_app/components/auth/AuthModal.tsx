"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSignIn, useSignUp } from "@clerk/nextjs/legacy"
import { Input } from "@/components/ui/input"
import { X, Loader2 } from "lucide-react"

type AuthMode = "sign-in" | "sign-up"

interface AuthModalProps {
  open: boolean
  onClose: () => void
  defaultMode?: AuthMode
}

export function AuthModal({
  open,
  onClose,
  defaultMode = "sign-in",
}: AuthModalProps) {
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } =
    useSignIn()
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } =
    useSignUp()

  const [mode, setMode] = useState<AuthMode>(defaultMode)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [code, setCode] = useState("")

  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setEmail("")
      setPassword("")
      setError("")
      setCode("")
      setVerifying(false)
      setMode(defaultMode)
    }
  }, [open, defaultMode])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose()
    },
    [onClose],
  )

  const handleOAuth = useCallback(
    async (provider: `oauth_${string}`) => {
      if (!signInLoaded || !signIn) return
      setError("")
      try {
        await signIn.authenticateWithRedirect({
          strategy: provider,
          redirectUrl: "/app",
          redirectUrlComplete: "/app",
        })
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "OAuth failed. Please try again."
        setError(msg)
      }
    },
    [signIn, signInLoaded],
  )

  const handleSignIn = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!signInLoaded || !signIn) return
      setError("")
      setLoading(true)

      try {
        // Step 1: create the sign-in attempt
        const result = await signIn.create({
          identifier: email,
        })

        if (result.status === "complete") {
          await setSignInActive({ session: result.createdSessionId })
          onClose()
          return
        }

        // Step 2: attempt password as first factor
        const factor = await signIn.attemptFirstFactor({
          strategy: "password",
          password,
        })

        if (factor.status === "complete") {
          await setSignInActive({ session: factor.createdSessionId })
          onClose()
        } else {
          setError("Additional verification required. Please try Google sign-in.")
        }
      } catch (err: unknown) {
        const clerkErr = err as { errors?: { message: string }[] }
        setError(
          clerkErr.errors?.[0]?.message ??
            "Sign in failed. Check your credentials.",
        )
      } finally {
        setLoading(false)
      }
    },
    [signIn, signInLoaded, setSignInActive, email, password, onClose],
  )

  const handleSignUp = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!signUpLoaded || !signUp) return
      setError("")
      setLoading(true)

      try {
        await signUp.create({
          emailAddress: email,
          password,
        })

        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        })

        setVerifying(true)
      } catch (err: unknown) {
        const clerkErr = err as { errors?: { message: string }[] }
        setError(
          clerkErr.errors?.[0]?.message ??
            "Sign up failed. Please try again.",
        )
      } finally {
        setLoading(false)
      }
    },
    [signUp, signUpLoaded, email, password],
  )

  const handleVerify = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!signUpLoaded || !signUp) return
      setError("")
      setLoading(true)

      try {
        const result = await signUp.attemptEmailAddressVerification({
          code,
        })

        if (result.status === "complete") {
          await setSignUpActive({ session: result.createdSessionId })
          onClose()
        }
      } catch (err: unknown) {
        const clerkErr = err as { errors?: { message: string }[] }
        setError(
          clerkErr.errors?.[0]?.message ?? "Invalid code. Please try again.",
        )
      } finally {
        setLoading(false)
      }
    },
    [signUp, signUpLoaded, setSignUpActive, code, onClose],
  )

  if (!open) return null

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      style={{ fontSize: "16px" }}
      className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-[4px]"
    >
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-black/10 dark:border-neutral-800 dark:bg-[#161616] dark:shadow-black/40">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            <X className="size-4" />
          </button>

          <div className="px-8 pt-8 pb-3">
            {/* Header */}
            <div className="mb-7 text-center">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {verifying
                  ? "Check your email"
                  : mode === "sign-in"
                    ? "Welcome back"
                    : "Create your account"}
              </h2>
              <p className="mt-1.5 text-[0.8rem] text-neutral-500 dark:text-neutral-400">
                {verifying
                  ? `We sent a code to ${email}`
                  : mode === "sign-in"
                    ? "Sign in to sync your calendar and data"
                    : "Get started with Third Screen"}
              </p>
            </div>

            {verifying ? (
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="code"
                    className="block text-[0.75rem] font-medium text-neutral-600 dark:text-neutral-400"
                  >
                    Verification code
                  </label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="h-11 border-neutral-200 bg-neutral-50 text-center font-[family-name:var(--font-mono)] tracking-[0.3em] placeholder:tracking-normal dark:border-neutral-700 dark:bg-neutral-800/60"
                    autoFocus
                    autoComplete="one-time-code"
                  />
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-[0.75rem] text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !code}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Verify
                </button>
              </form>
            ) : (
              <>
                {/* Google OAuth */}
                <button
                  onClick={() => handleOAuth("oauth_google")}
                  className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-700 transition-all hover:bg-neutral-50 active:scale-[0.98] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-750 dark:hover:brightness-110"
                >
                  <svg className="size-[18px]" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
                  <span className="font-[family-name:var(--font-mono)] text-[0.6rem] uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                    or
                  </span>
                  <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
                </div>

                {/* Email / Password */}
                <form
                  onSubmit={
                    mode === "sign-in" ? handleSignIn : handleSignUp
                  }
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label
                      htmlFor="email"
                      className="block text-[0.75rem] font-medium text-neutral-600 dark:text-neutral-400"
                    >
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-11 border-neutral-200 bg-neutral-50 text-sm dark:border-neutral-700 dark:bg-neutral-800/60"
                      autoFocus
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="password"
                      className="block text-[0.75rem] font-medium text-neutral-600 dark:text-neutral-400"
                    >
                      Password
                    </label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        mode === "sign-up"
                          ? "Create a password"
                          : "Your password"
                      }
                      className="h-11 border-neutral-200 bg-neutral-50 text-sm dark:border-neutral-700 dark:bg-neutral-800/60"
                      autoComplete={
                        mode === "sign-up"
                          ? "new-password"
                          : "current-password"
                      }
                      required
                    />
                  </div>

                  {error && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-[0.75rem] text-red-600 dark:bg-red-900/20 dark:text-red-400">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 active:scale-[0.98] disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
                  >
                    {loading && <Loader2 className="size-4 animate-spin" />}
                    {mode === "sign-in" ? "Sign in" : "Create account"}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Footer */}
          {!verifying && (
            <div className="border-t border-neutral-100 px-8 py-4 dark:border-neutral-800">
              <p className="text-center text-[0.8rem] text-neutral-500 dark:text-neutral-400">
                {mode === "sign-in"
                  ? "No account yet? "
                  : "Already have an account? "}
                <button
                  onClick={() => {
                    setMode(mode === "sign-in" ? "sign-up" : "sign-in")
                    setError("")
                  }}
                  className="font-semibold text-neutral-900 transition-colors hover:text-neutral-700 dark:text-neutral-100 dark:hover:text-neutral-300"
                >
                  {mode === "sign-in" ? "Sign up" : "Sign in"}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
