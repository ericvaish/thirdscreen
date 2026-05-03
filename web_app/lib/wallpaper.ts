"use client"

import { getSetting, setSetting } from "@/lib/data-layer"

export type WallpaperPreset = "photo1" | "photo2" | "photo3" | "photo4" | "photo5"
export type WallpaperKind = "none" | WallpaperPreset | "custom"

interface WallpaperPresetDef {
  label: string
  /** Background CSS shorthand applied to the body. */
  css: string
  /** Underlying image URL if this preset is photo-backed. Used for adaptive
   *  contrast sampling. Omit for pure gradients. */
  imageUrl?: string
}

const PRESET_URLS: Record<WallpaperPreset, string> = {
  photo1:
    "https://images.unsplash.com/photo-1669295384050-a1d4357bd1d7?q=80&w=3270&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  photo2:
    "https://images.unsplash.com/photo-1574169208507-84376144848b?q=80&w=2079&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  photo3:
    "https://plus.unsplash.com/premium_photo-1667587245819-2bea7a93e7a1?q=80&w=3270&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  photo4:
    "https://images.unsplash.com/photo-1776695799247-b15851a1aa2d?q=80&w=3283&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  photo5:
    "https://plus.unsplash.com/premium_photo-1732736767074-daf7bba30e81?q=80&w=2750&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
}

const PRESET_LABELS: Record<WallpaperPreset, string> = {
  photo1: "Photo 1",
  photo2: "Photo 2",
  photo3: "Photo 3",
  photo4: "Photo 4",
  photo5: "Photo 5",
}

export const WALLPAPER_PRESETS: Record<WallpaperPreset, WallpaperPresetDef> = Object.fromEntries(
  (Object.keys(PRESET_URLS) as WallpaperPreset[]).map((id) => [
    id,
    {
      label: PRESET_LABELS[id],
      css: `url(${JSON.stringify(PRESET_URLS[id])}) center/cover no-repeat`,
      imageUrl: PRESET_URLS[id],
    },
  ]),
) as Record<WallpaperPreset, WallpaperPresetDef>

const WALLPAPER_KIND_KEY = "wallpaper_kind"
const WALLPAPER_URL_KEY = "wallpaper_url"

export function applyWallpaperToDOM(kind: WallpaperKind, customUrl: string | null) {
  if (typeof document === "undefined") return
  const root = document.documentElement

  if (kind === "none") {
    root.removeAttribute("data-wallpaper")
    root.style.removeProperty("--ts-wallpaper-image")
    return
  }

  let value: string
  if (kind === "custom" && customUrl) {
    value = `url(${JSON.stringify(customUrl)}) center/cover no-repeat fixed`
  } else if (kind in WALLPAPER_PRESETS) {
    value = WALLPAPER_PRESETS[kind as WallpaperPreset].css + " fixed"
  } else {
    root.removeAttribute("data-wallpaper")
    root.style.removeProperty("--ts-wallpaper-image")
    return
  }

  root.style.setProperty("--ts-wallpaper-image", value)
  root.setAttribute("data-wallpaper", "1")
}

/** Returns the underlying image URL, if the current wallpaper is a photo (preset or custom). */
export function getWallpaperImageURL(kind: WallpaperKind, customUrl: string | null): string | null {
  if (kind === "custom") return customUrl
  if (kind in WALLPAPER_PRESETS) return WALLPAPER_PRESETS[kind as WallpaperPreset].imageUrl ?? null
  return null
}

export async function loadWallpaper(): Promise<{ kind: WallpaperKind; url: string | null }> {
  const stored = (await getSetting(WALLPAPER_KIND_KEY)) as WallpaperKind | null
  // Coerce removed presets back to the first photo preset.
  const valid: WallpaperKind[] = [
    "none",
    "custom",
    ...(Object.keys(WALLPAPER_PRESETS) as WallpaperPreset[]),
  ]
  const kind = stored && valid.includes(stored) ? stored : "photo1"
  const url = ((await getSetting(WALLPAPER_URL_KEY)) as string | null) ?? null
  return { kind, url }
}

export async function saveWallpaper(kind: WallpaperKind, url: string | null) {
  await Promise.all([
    setSetting(WALLPAPER_KIND_KEY, kind),
    setSetting(WALLPAPER_URL_KEY, url),
  ])
  applyWallpaperToDOM(kind, url)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ts:wallpaper-changed"))
  }
}
