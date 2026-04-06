import { drizzle } from "drizzle-orm/libsql"
import { createClient } from "@libsql/client"
import * as schema from "./schema"

let db: ReturnType<typeof drizzle> | null = null

export function getTursoDb() {
  if (db) return db

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  db = drizzle(client, { schema })
  return db
}
