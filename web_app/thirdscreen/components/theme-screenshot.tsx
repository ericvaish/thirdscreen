"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

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

  return <img src={src} alt={alt} className={className} />
}
