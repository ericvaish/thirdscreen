"use client"

/**
 * Zone labels are now hidden by default — each card is expected to be
 * self-explanatory through its content. This component is kept as a no-op
 * so the existing call sites continue to work without churn while we
 * progressively redesign individual zones.
 */
export function ZoneLabel(_props: {
  accentVar: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return null
}
