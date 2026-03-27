/**
 * Next.js config for Electron static export.
 * Used by `npm run build:export` -- produces a static HTML/JS/CSS bundle
 * with no server-side rendering or API routes.
 *
 * The Electron main process handles all data operations via IPC,
 * so API routes are not needed in the exported build.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // Static export outputs to `out/` directory
  // Images must use unoptimized since there's no server
  images: {
    unoptimized: true,
  },
}

export default nextConfig
