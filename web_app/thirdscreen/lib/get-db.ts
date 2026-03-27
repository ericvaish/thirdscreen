/**
 * Get the database instance for the current request.
 *
 * - SQLite mode: returns the singleton from db/index.ts
 * - D1 mode: gets the D1 binding from Cloudflare request context
 */

import { db as sqliteDb, getD1Db } from "@/db"

const isD1 = process.env.STORAGE === "d1"

export function getDb() {
  if (!isD1) {
    return sqliteDb
  }

  // In D1 mode, get the binding from Cloudflare's request context
  // @cloudflare/next-on-pages provides getRequestContext()
  try {
    // Dynamic import to avoid bundling issues in non-Cloudflare environments
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getRequestContext } = require("@cloudflare/next-on-pages")
    const { env } = getRequestContext()
    return getD1Db(env.DB)
  } catch {
    // Fallback for build time or non-Cloudflare context
    return sqliteDb
  }
}
