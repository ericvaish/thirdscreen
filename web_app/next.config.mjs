import { setupDevPlatform } from "@cloudflare/next-on-pages/next-dev"

// Set up Cloudflare bindings (D1, env vars) for local dev
if (process.env.NODE_ENV === "development") {
  await setupDevPlatform()
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["@mlc-ai/web-llm"],
}

export default nextConfig
