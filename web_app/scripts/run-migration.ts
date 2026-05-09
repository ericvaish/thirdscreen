import { createClient } from "@libsql/client"
import { readFileSync } from "fs"

const file = process.argv[2]
if (!file) {
  console.error("usage: bun scripts/run-migration.ts <path-to-sql>")
  process.exit(1)
}

const url = process.env.TURSO_DATABASE_URL
const token = process.env.TURSO_AUTH_TOKEN
if (!url) {
  console.error("TURSO_DATABASE_URL is not set")
  process.exit(1)
}

const client = createClient({ url, authToken: token })

const sql = readFileSync(file, "utf8")
const stmts = sql
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean)

for (const stmt of stmts) {
  const head = stmt.split("\n")[0].slice(0, 100)
  console.log("→", head)
  await client.execute(stmt)
}

console.log(`✓ Applied ${file}`)
