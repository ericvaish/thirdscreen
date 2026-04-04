// Shared eye-tracking utilities for mascot rendering and pixel buddy editor

const GRID = 32

export type EyeRegion = { wx: number; wy: number; ww: number; wh: number }
export type PupilPos = "center" | "tl" | "tr" | "bl" | "br"

/**
 * Find W (white) regions in the frame that are eye-shaped (at least 3 wide, 2 tall).
 * Returns bounding boxes of each eye's white region.
 */
export function findEyeRegions(fr: string[][]): EyeRegion[] {
  const wPixels: { x: number; y: number }[] = []
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (fr[y]?.[x] === "W") wPixels.push({ x, y })
    }
  }
  if (wPixels.length === 0) return []

  wPixels.sort((a, b) => a.y - b.y || a.x - b.x)

  const groups: { x: number; y: number }[][] = []
  for (const p of wPixels) {
    let added = false
    for (const g of groups) {
      if (g.some(gp => Math.abs(gp.x - p.x) <= 1 && Math.abs(gp.y - p.y) <= 1)) {
        g.push(p)
        added = true
        break
      }
    }
    if (!added) groups.push([p])
  }

  return groups
    .map(g => {
      const xs = g.map(p => p.x)
      const ys = g.map(p => p.y)
      return {
        wx: Math.min(...xs),
        wy: Math.min(...ys),
        ww: Math.max(...xs) - Math.min(...xs) + 1,
        wh: Math.max(...ys) - Math.min(...ys) + 1,
      }
    })
    .filter(r => r.ww >= 3 && r.wh >= 2)
}

/**
 * Render a mascot frame with optional eye tracking.
 * When trackEyes is true, K (pupil) pixels are skipped from the base render
 * and dynamic 2x2 pupils are drawn within detected W (eye white) regions.
 */
export function renderFrameWithEyes(
  ctx: CanvasRenderingContext2D,
  fr: string[][],
  palette: Record<string, string | null>,
  px: number,
  pupilPos?: PupilPos,
  trackEyes?: boolean,
) {
  ctx.clearRect(0, 0, GRID * px, GRID * px)

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const key = fr[y]?.[x]
      if (!key || key === ".") continue
      if (trackEyes && key === "K") continue
      const color = palette[key]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x * px, y * px, px, px)
    }
  }

  if (trackEyes) {
    const eyeRegions = findEyeRegions(fr)
    const pupilColor = palette["K"]
    if (pupilColor && eyeRegions.length > 0) {
      ctx.fillStyle = pupilColor
      for (const eye of eyeRegions) {
        const maxDx = Math.max(0, eye.ww - 2)
        const maxDy = Math.max(0, eye.wh - 2)
        let epx: number, epy: number
        switch (pupilPos) {
          case "tl": epx = 0; epy = 0; break
          case "tr": epx = maxDx; epy = 0; break
          case "bl": epx = 0; epy = maxDy; break
          case "br": epx = maxDx; epy = maxDy; break
          default:   epx = Math.floor(maxDx / 2); epy = Math.floor(maxDy / 2); break
        }
        const ax = eye.wx + epx
        const ay = eye.wy + epy
        ctx.fillRect(ax * px, ay * px, px, px)
        ctx.fillRect((ax + 1) * px, ay * px, px, px)
        ctx.fillRect(ax * px, (ay + 1) * px, px, px)
        ctx.fillRect((ax + 1) * px, (ay + 1) * px, px, px)
      }
    }
  }
}

export function cursorToPupilPos(mouseX: number, mouseY: number): PupilPos {
  const midX = window.innerWidth / 2
  const midY = window.innerHeight / 2
  const isRight = mouseX >= midX
  const isDown = mouseY >= midY
  if (isDown && isRight) return "br"
  if (isDown && !isRight) return "bl"
  if (!isDown && isRight) return "tr"
  return "tl"
}
