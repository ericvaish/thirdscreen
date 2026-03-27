/** @type {import('next').NextConfig} */
const nextConfig = {
  // When building for Cloudflare, exclude native Node modules from the bundle
  ...(process.env.STORAGE === "d1"
    ? {
        webpack: (config) => {
          config.externals = [...(config.externals || []), "better-sqlite3"]
          return config
        },
      }
    : {}),
}

export default nextConfig
