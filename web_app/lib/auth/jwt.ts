import { SignJWT, jwtVerify } from "jose"

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_JWT_SECRET is missing or shorter than 32 characters",
    )
  }
  return new TextEncoder().encode(secret)
}

export interface SessionPayload {
  sub: string // user id (google sub)
  email: string
  name?: string | null
  picture?: string | null
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject(payload.sub)
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret())
}

export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    })
    if (typeof payload.sub !== "string") return null
    return {
      sub: payload.sub,
      email: (payload.email as string) ?? "",
      name: (payload.name as string | undefined) ?? null,
      picture: (payload.picture as string | undefined) ?? null,
    }
  } catch {
    return null
  }
}

export const SESSION_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME ?? "ts_session"
export const SESSION_MAX_AGE = SESSION_TTL_SECONDS
