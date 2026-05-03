"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { getWallpaperImageURL, loadWallpaper, type WallpaperKind } from "./wallpaper"

interface WallpaperImageContextValue {
  imageUrl: string | null
}

const WallpaperImageContext = createContext<WallpaperImageContextValue>({ imageUrl: null })

export function WallpaperImageProvider({ children }: { children: React.ReactNode }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    const refresh = async () => {
      const { kind, url } = await loadWallpaper()
      setImageUrl(getWallpaperImageURL(kind as WallpaperKind, url))
    }
    refresh()
    const handler = () => refresh()
    window.addEventListener("ts:wallpaper-changed", handler)
    return () => window.removeEventListener("ts:wallpaper-changed", handler)
  }, [])

  return (
    <WallpaperImageContext.Provider value={{ imageUrl }}>
      {children}
    </WallpaperImageContext.Provider>
  )
}

export function useWallpaperImage(): string | null {
  return useContext(WallpaperImageContext).imageUrl
}
