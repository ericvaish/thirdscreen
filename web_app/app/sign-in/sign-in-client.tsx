"use client"

import { useSearchParams } from "next/navigation"

const ERROR_MESSAGES: Record<string, string> = {
  state_mismatch: "Sign-in session expired. Please try again.",
  token_exchange_failed: "Could not complete sign-in with Google.",
  userinfo_failed: "Could not fetch your Google profile.",
  missing_email: "Your Google account did not return an email address.",
  missing_code: "Sign-in was cancelled.",
  access_denied: "Sign-in was cancelled.",
}

export function SignInClient() {
  const params = useSearchParams()
  const error = params.get("error")
  const returnTo = params.get("return_to") ?? "/app"
  const startUrl = `/api/auth/google/start?return_to=${encodeURIComponent(returnTo)}`

  return (
    <div className="mt-6 space-y-3">
      <a
        href={startUrl}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-700 transition-all hover:bg-neutral-50 active:scale-[0.98]"
      >
        <svg className="size-[18px]" viewBox="0 0 24 24" aria-hidden="true">
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
      </a>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again."}
        </p>
      )}
    </div>
  )
}
