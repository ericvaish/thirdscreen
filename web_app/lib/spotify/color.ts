// Extract the dominant color from an album art image using median cut quantization.
// This finds the color that covers the most area of the image (like Spotify/Apple Music)
// rather than picking the most saturated single pixel.

export interface ExtractedColor {
  r: number
  g: number
  b: number
  hex: string
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.crossOrigin = "anonymous"
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject()
    img.src = url
  })
  return img
}

export async function extractDominantColor(
  imageUrl: string
): Promise<ExtractedColor | null> {
  try {
    let img: HTMLImageElement
    try {
      img = await loadImage(imageUrl)
    } catch {
      // Retry once after a short delay (Spotify CDN sometimes drops connections)
      await new Promise((r) => setTimeout(r, 1000))
      img = await loadImage(imageUrl)
    }

    const canvas = document.createElement("canvas")
    const size = 50
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.drawImage(img, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)

    // Collect pixels, filtering out very dark and very light
    const pixels: [number, number, number][] = []
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      const luma = 0.299 * r + 0.587 * g + 0.114 * b
      if (luma < 30 || luma > 230) continue

      pixels.push([r, g, b])
    }

    if (pixels.length === 0) return fallbackAverage(data)

    // Median cut: split pixels into buckets, find the largest vibrant one
    const palette = medianCut(pixels, 5) // 2^5 = 32 max buckets

    // Pick the best bucket: largest area with decent saturation
    let best: ExtractedColor | null = null
    let bestScore = -1

    for (const bucket of palette) {
      const avg = bucketAverage(bucket)
      const sat = saturation(avg[0], avg[1], avg[2])
      // Score = area * (saturation boost). Slightly favor saturated colors
      // but area is the primary driver.
      const score = bucket.length * (0.5 + sat * 0.5)

      if (score > bestScore) {
        bestScore = score
        best = rgbToResult(avg[0], avg[1], avg[2])
      }
    }

    return best ?? fallbackAverage(data)
  } catch {
    return null
  }
}

// ── Median cut algorithm ────────────────────────────────────────────────────

function medianCut(
  pixels: [number, number, number][],
  depth: number
): [number, number, number][][] {
  if (depth === 0 || pixels.length < 2) return [pixels]

  // Find which channel (R, G, B) has the widest range
  let maxRange = 0
  let splitChannel = 0

  for (let ch = 0; ch < 3; ch++) {
    let min = 255
    let max = 0
    for (const px of pixels) {
      if (px[ch] < min) min = px[ch]
      if (px[ch] > max) max = px[ch]
    }
    const range = max - min
    if (range > maxRange) {
      maxRange = range
      splitChannel = ch
    }
  }

  // Sort by that channel and split at median
  pixels.sort((a, b) => a[splitChannel] - b[splitChannel])
  const mid = Math.floor(pixels.length / 2)

  return [
    ...medianCut(pixels.slice(0, mid), depth - 1),
    ...medianCut(pixels.slice(mid), depth - 1),
  ]
}

function bucketAverage(pixels: [number, number, number][]): [number, number, number] {
  let r = 0, g = 0, b = 0
  for (const px of pixels) {
    r += px[0]
    g += px[1]
    b += px[2]
  }
  const n = pixels.length
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  if (max === 0) return 0
  return (max - min) / max
}

function rgbToResult(r: number, g: number, b: number): ExtractedColor {
  return {
    r, g, b,
    hex: `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`,
  }
}

function fallbackAverage(data: Uint8ClampedArray): ExtractedColor {
  let r = 0, g = 0, b = 0, count = 0
  for (let i = 0; i < data.length; i += 16) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    count++
  }
  return rgbToResult(
    Math.round(r / count),
    Math.round(g / count),
    Math.round(b / count)
  )
}
