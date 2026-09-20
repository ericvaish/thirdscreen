"use client"

import { useRef, type ReactNode } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"

/**
 * Scroll-linked 3D frame (adapted from Aceternity UI's "ContainerScroll").
 * The framed screenshot starts tilted back and flattens out as it scrolls
 * into view.
 *
 * The frame is sized by its content — never by a fixed pixel height — so the
 * screenshot is always fully visible, and it never scales past 1 so it can't
 * push a horizontal scrollbar onto the page.
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
        className="glass-card mx-auto w-full max-w-5xl rounded-2xl p-1.5 shadow-[0_2px_6px_rgba(15,23,42,0.06),0_30px_80px_-30px_rgba(15,23,42,0.45)] ring-1 ring-black/10 sm:rounded-[1.75rem] sm:p-2 xl:max-w-6xl 2xl:max-w-[84rem] dark:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] dark:ring-white/10"
      >
        <div className="overflow-hidden rounded-[0.875rem] ring-1 ring-black/5 sm:rounded-[1.375rem] dark:ring-white/10">
          {children}
        </div>
      </motion.div>
    </div>
  )
}
