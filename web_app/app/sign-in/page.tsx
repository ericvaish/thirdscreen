import Link from "next/link"
import { Suspense } from "react"
import { SignInClient } from "./sign-in-client"

export const metadata = {
  title: "Sign in — Third Screen",
}

export default function SignInPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-6 text-neutral-900"
      style={{ fontSize: "16px" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <img
              src="/thirdscreen_logo.svg"
              alt="Third Screen"
              className="h-8 w-8"
            />
            <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight">
              Third Screen
            </span>
          </Link>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-8 shadow-xl shadow-black/5">
          <h1 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">
            Welcome
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Sign in to sync your dashboard across devices.
          </p>
          <Suspense fallback={null}>
            <SignInClient />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-neutral-500">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
