"use client"

import { useEffect } from "react"
import { applyWallpaperToDOM, loadWallpaper } from "@/lib/wallpaper"

export function WallpaperProvider() {
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { kind, url } = await loadWallpaper()
      if (!cancelled) applyWallpaperToDOM(kind, url)
    }
    load()
    const handler = () => load()
    window.addEventListener("ts:wallpaper-changed", handler)
    return () => {
      cancelled = true
      window.removeEventListener("ts:wallpaper-changed", handler)
    }
  }, [])
  return null
}
