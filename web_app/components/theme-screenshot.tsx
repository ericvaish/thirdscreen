import Image from "next/image"

import { cn } from "@/lib/utils"

const DIMENSIONS = {
  horizontal: { width: 2560, height: 1440 },
  vertical: { width: 1080, height: 1920 },
}

/**
 * The light and dark screenshots of the dashboard.
 *
 * Both are rendered and CSS picks one, rather than swapping the `src` of a
 * single <img> once the theme is known on the client. Swapping the src blanks
 * the element (complete = false, naturalWidth = 0) until the new file has
 * downloaded — which meant a light-mode visitor stared at an empty frame for
 * as long as the second screenshot took to arrive, since the server always
 * rendered the dark one. This way the right image is in the markup from the
 * first paint, in both themes, with no JavaScript involved.
 */
export function ThemeScreenshot({
  name,
  alt,
  className,
}: {
  name: "horizontal" | "vertical"
  alt: string
  className?: string
}) {
  const dims = DIMENSIONS[name]
  const sizes =
    name === "horizontal" ? "(max-width: 1200px) 100vw, 1200px" : "288px"
  // Below-the-fold shots can wait; the hero shot should not.
  const loading = name === "horizontal" ? "eager" : "lazy"

  return (
    <>
      <Image
        src={`/screenshots/${name}-light.png`}
        alt={alt}
        width={dims.width}
        height={dims.height}
        sizes={sizes}
        loading={loading}
        className={cn(className, "dark:hidden")}
      />
      <Image
        src={`/screenshots/${name}-dark.png`}
        alt={alt}
        width={dims.width}
        height={dims.height}
        sizes={sizes}
        loading={loading}
        className={cn(className, "hidden dark:block")}
      />
    </>
  )
}
