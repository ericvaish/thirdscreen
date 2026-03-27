import { getRequestContext } from "@cloudflare/next-on-pages"
import { getD1Db } from "@/db"

export function getDb() {
  const { env } = getRequestContext()
  return getD1Db(env.DB)
}
