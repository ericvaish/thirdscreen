"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import Image from "next/image"

const DIMENSIONS = {
  horizontal: { width: 2560, height: 1440 },
  vertical: { width: 1080, height: 1920 },
}

export function ThemeScreenshot({
  name,
  alt,
  className,
}: {
  name: "horizontal" | "vertical"
  alt: string
  className?: string
}) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const suffix = mounted && resolvedTheme === "light" ? "light" : "dark"
  const src = `/screenshots/${name}-${suffix}.png`
  const dims = DIMENSIONS[name]

  return (
    <Image
      src={src}
      alt={alt}
      width={dims.width}
      height={dims.height}
      className={className}
      priority={name === "horizontal"}
      sizes={name === "horizontal" ? "(max-width: 1200px) 100vw, 1200px" : "288px"}
    />
  )
}
