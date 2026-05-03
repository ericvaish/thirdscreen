"use client"

import { forwardRef, useRef, useImperativeHandle } from "react"
import { useAdaptiveContrast } from "@/lib/use-adaptive-contrast"
import { useWallpaperImage } from "@/lib/wallpaper-context"
import { cn } from "@/lib/utils"

/**
 * Wraps children in a div that samples the wallpaper pixels behind itself
 * and exposes `--adaptive-fg` / `--adaptive-fg-muted` CSS variables for its
 * descendants. Children that use `currentColor` (lucide icons, most SVGs)
 * automatically pick up the chosen color via the `.ts-adaptive-fg` styling.
 */
export const AdaptiveSurface = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function AdaptiveSurface({ className, children, ...rest }, externalRef) {
    const innerRef = useRef<HTMLDivElement | null>(null)
    useImperativeHandle(externalRef, () => innerRef.current as HTMLDivElement)
    const imageUrl = useWallpaperImage()
    useAdaptiveContrast(innerRef, imageUrl)
    return (
      <div ref={innerRef} className={cn("ts-adaptive-fg", className)} {...rest}>
        {children}
      </div>
    )
  },
)
