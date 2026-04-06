/**
 * Patches @cloudflare/next-on-pages esbuild config to externalize bare
 * Node.js built-in specifiers (e.g. "url", "path") in addition to the
 * "node:*" prefix form it already handles.
 *
 * This is needed because some dependencies use require("url") instead of
 * require("node:url"), and next-on-pages only externalizes the prefixed form.
 *
 * Remove this script once migrated to the OpenNext adapter.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const BARE_NODE_BUILTINS = [
  "url",
  "path",
  "crypto",
  "buffer",
  "stream",
  "fs",
  "os",
  "util",
  "events",
  "assert",
  "querystring",
  "http",
  "https",
  "net",
  "tls",
  "zlib",
]

const file = join(
  "node_modules",
  "@cloudflare",
  "next-on-pages",
  "dist",
  "index.js"
)

let src = readFileSync(file, "utf8")

const needle = `"node:*",\n      "async_hooks"`
if (!src.includes(needle)) {
  console.log("[patch-nop] Already patched or pattern not found, skipping.")
  process.exit(0)
}

const replacement =
  `"node:*",\n` +
  BARE_NODE_BUILTINS.map((m) => `      "${m}"`).join(",\n") +
  `,\n      "async_hooks"`

src = src.replaceAll(needle, replacement)
writeFileSync(file, src)
console.log("[patch-nop] Patched next-on-pages externals with bare Node builtins.")
