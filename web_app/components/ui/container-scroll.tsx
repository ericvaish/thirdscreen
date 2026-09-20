"use client"

import { useRef, type ReactNode } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"

/**
 * Scroll-linked 3D tablet frame (adapted from Aceternity UI's
 * "ContainerScroll"). The screenshot sits in a thick dark bezel, like a tablet
 * propped on a desk, tilted back and flattening out as it scrolls into view.
 *
 * The frame is sized by its content — never by a fixed pixel height — so the
 * screenshot is always fully visible at its own aspect ratio, and it never
 * scales past 1 so it can't push a horizontal scrollbar onto the page.
 *
 * Bezel geometry: the corner radii are (outer − border − padding) at every
 * breakpoint, which keeps the screen's corners concentric with the shell's.
 */
export function ContainerScroll({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"],
  })

  const rotate = useTransform(scrollYProgress, [0, 1], [18, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1])

  return (
    <div ref={containerRef} className="[perspective:1400px]">
      <motion.div
        style={reduceMotion ? undefined : { rotateX: rotate, scale }}
        className="mx-auto w-full max-w-5xl rounded-[1.5rem] border-4 border-[#6C6C6C] bg-[#222222] p-2 shadow-[0_2px_8px_rgba(15,23,42,0.12),0_30px_80px_-30px_rgba(15,23,42,0.55)] sm:rounded-[2rem] sm:p-4 lg:rounded-[2.25rem] lg:p-5 xl:max-w-6xl 2xl:max-w-[84rem] dark:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85)]"
      >
        <div className="overflow-hidden rounded-xl bg-black">{children}</div>
      </motion.div>
    </div>
  )
}
