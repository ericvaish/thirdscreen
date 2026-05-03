"use client"

import { useEffect, useRef } from "react"

/**
 * Adaptive text-color hook (visionOS / iOS-style).
 *
 * Samples the pixels of `imageUrl` directly behind the bounding box of the
 * element pointed to by `ref`, computes the average relative luminance, and
 * sets two CSS variables on that element:
 *
 *   --adaptive-fg        — solid foreground color (black or white)
 *   --adaptive-fg-muted  — same hue with reduced opacity for secondary text
 *
 * Children that consume `currentColor` (lucide icons, most SVGs) automatically
 * pick up the chosen color when the element's `color` is set to
 * `var(--adaptive-fg)`.
 *
 * The mapping from the viewport rect to image-space coordinates assumes the
 * image is painted with `background-size: cover` on the body — i.e. it
 * covers the viewport, centered. This matches the wallpaper system in
 * lib/wallpaper.ts.
 *
 * Recomputes on:
 *   - imageUrl change
 *   - element resize / window resize
 *   - `ts:wallpaper-changed` custom event
 *
 * Falls back silently (no CSS vars set) on CORS errors or load failures.
 */
export function useAdaptiveContrast(
  ref: React.RefObject<HTMLElement | null>,
  imageUrl: string | null,
) {
  const imgRef = useRef<{ url: string; img: HTMLImageElement | null }>({
    url: "",
    img: null,
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (!imageUrl) {
      el.style.removeProperty("--adaptive-fg")
      el.style.removeProperty("--adaptive-fg-muted")
      return
    }

    let cancelled = false

    const compute = () => {
      const img = imgRef.current.img
      if (!img || !img.complete || cancelled) return

      const rect = el.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const vw = window.innerWidth
      const vh = window.innerHeight
      const iw = img.naturalWidth
      const ih = img.naturalHeight
      if (!iw || !ih) return

      // background-size: cover math
      const imgAR = iw / ih
      const vpAR = vw / vh
      let scale: number
      let offsetX = 0
      let offsetY = 0
      if (imgAR > vpAR) {
        scale = vh / ih
        offsetX = (vw - iw * scale) / 2
      } else {
        scale = vw / iw
        offsetY = (vh - ih * scale) / 2
      }

      const sx = Math.max(0, Math.floor((rect.left - offsetX) / scale))
      const sy = Math.max(0, Math.floor((rect.top - offsetY) / scale))
      const sw = Math.min(iw - sx, Math.ceil(rect.width / scale))
      const sh = Math.min(ih - sy, Math.ceil(rect.height / scale))
      if (sw <= 0 || sh <= 0) return

      const sampleW = Math.min(sw, 64)
      const sampleH = Math.max(1, Math.min(sh, 16))
      const canvas = document.createElement("canvas")
      canvas.width = sampleW
      canvas.height = sampleH
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return

      try {
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sampleW, sampleH)
        const data = ctx.getImageData(0, 0, sampleW, sampleH).data

        let total = 0
        let count = 0
        for (let i = 0; i < data.length; i += 4) {
          // Approximate sRGB → relative luminance (Rec. 709 weights, gamma ignored for speed).
          const r = data[i] / 255
          const g = data[i + 1] / 255
          const b = data[i + 2] / 255
          total += 0.2126 * r + 0.7152 * g + 0.0722 * b
          count++
        }
        const lum = count > 0 ? total / count : 0.5

        // The wallpaper isn't what the user actually sees — every glass surface in
        // this app paints a dark tint on top (rgba(20,22,30, ~0.3–0.6)). Approximate
        // the visible luminance as wallpaper composited with that dark overlay so
        // the threshold matches what the eye actually reads.
        //   visible = wallpaper * (1 - overlayAlpha) + overlayLum * overlayAlpha
        // Using a representative overlay (alpha ~0.5, luminance ~0.085) collapses to:
        const visibleLum = lum * 0.5 + 0.05

        if (visibleLum < 0.55) {
          el.style.setProperty("--adaptive-fg", "rgb(255,255,255)")
          el.style.setProperty("--adaptive-fg-muted", "rgba(255,255,255,0.72)")
        } else {
          el.style.setProperty("--adaptive-fg", "rgb(20,20,22)")
          el.style.setProperty("--adaptive-fg-muted", "rgba(20,20,22,0.72)")
        }
      } catch {
        // Cross-origin tainted canvas — leave the element on its default color.
      }
    }

    if (imgRef.current.url !== imageUrl) {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => compute()
      img.onerror = () => {}
      img.src = imageUrl
      imgRef.current = { url: imageUrl, img }
    } else {
      compute()
    }

    const onResize = () => compute()
    window.addEventListener("resize", onResize)
    window.addEventListener("ts:wallpaper-changed", onResize)

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(onResize)
      ro.observe(el)
    }

    return () => {
      cancelled = true
      window.removeEventListener("resize", onResize)
      window.removeEventListener("ts:wallpaper-changed", onResize)
      ro?.disconnect()
    }
  }, [imageUrl, ref])
}
