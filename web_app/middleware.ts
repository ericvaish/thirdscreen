import type { NextRequest } from "next/server"
import { auth0 } from "@/lib/auth0"

export async function middleware(request: NextRequest) {
  return await auth0.middleware(request)
}

export const config = {
  matcher: [
    /*
     * Every path except Next internals and static metadata files.
     * The Auth0 middleware mounts /auth/* and keeps the session cookie fresh.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}
