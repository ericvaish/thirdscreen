import { NextResponse } from "next/server"

// Short-lived in-memory rendezvous so the user can finish Spotify OAuth
// in a different browser/device and have the original dashboard pick up
// the tokens automatically.
//
// Flow:
//   1. Dashboard generates a random pairing code and starts polling GET.
//   2. User opens the auth link (containing the pairing code in `state`)
//      in any browser, signs in.
//   3. The callback page POSTs the tokens here keyed by the pairing code.
//   4. Dashboard's poll picks them up and clears the entry.
//
// Single-instance assumption: this is a local/self-hosted Pi-style deploy.
// Entries auto-expire after PAIR_TTL_MS to avoid stale token leftovers.

const PAIR_TTL_MS = 10 * 60 * 1000 // 10 minutes

interface PairEntry {
  tokens: {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  expiresAt: number
}

const globalAny = globalThis as unknown as { __spotifyPairs?: Map<string, PairEntry> }
const pairs: Map<string, PairEntry> = globalAny.__spotifyPairs ?? new Map()
globalAny.__spotifyPairs = pairs

function sweep() {
  const now = Date.now()
  for (const [code, entry] of pairs) {
    if (entry.expiresAt < now) pairs.delete(code)
  }
}

export async function GET(request: Request) {
  sweep()
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 })
  }
  const entry = pairs.get(code)
  if (!entry) {
    return NextResponse.json({ pending: true })
  }
  // Single-shot: return then delete.
  pairs.delete(code)
  return NextResponse.json({ pending: false, tokens: entry.tokens })
}

export async function POST(request: Request) {
  sweep()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await request.json()
  const { code, tokens } = body ?? {}
  if (!code || !tokens?.access_token || !tokens?.refresh_token) {
    return NextResponse.json({ error: "code and tokens are required" }, { status: 400 })
  }
  pairs.set(code, {
    tokens: {
      access_token: String(tokens.access_token),
      refresh_token: String(tokens.refresh_token),
      expires_in: Number(tokens.expires_in ?? 3600),
    },
    expiresAt: Date.now() + PAIR_TTL_MS,
  })
  return NextResponse.json({ ok: true })
}
