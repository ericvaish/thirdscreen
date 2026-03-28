"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// ── Pixel art mascot: 32x32 grid, frame-based animation ─────────────────────

type MascotState = "idle" | "drink" | "eat" | "celebrate" | "sleep" | "wave"

// Color palette
const P: Record<string, string | null> = {
  ".": null,         // transparent
  O: "#1a1a2e",      // outline dark
  B: "#4fc3f7",      // body main
  b: "#81d4fa",      // body highlight
  d: "#29b6f6",      // body shadow
  D: "#0288d1",      // body deep shadow
  W: "#ffffff",      // white (eyes)
  K: "#111111",      // pupil
  R: "#e91e63",      // mouth
  r: "#f48fb1",      // cheek blush
  c: "#ff80ab",      // cheek bright
  S: "#ffd54f",      // sparkle gold
  s: "#fff9c4",      // sparkle bright
  G: "#66bb6a",      // green (cup)
  g: "#a5d6a7",      // green light
  Z: "#78909c",      // zzz
  z: "#b0bec5",      // zzz light
  T: "#4db6ac",      // tongue/mouth interior
  L: "#e0e0e0",      // teeth
  H: "#ffc107",      // highlight accent
}

// Parse a compact string into a row of palette keys
function row(s: string): string[] {
  return s.split("")
}

// Each frame is 32 rows of 32 characters
function frame(rows: string[]): string[][] {
  return rows.map(row)
}

const GRID = 32

// ── IDLE frames ──────────────────────────────────────────────────────────────

const IDLE_0 = frame([
  "................................",
  "................................",
  "................................",
  "..........OOOOOOOOOOOO.........",
  ".........OBBBBBBBBBBBbO........",
  "........OBBBBBBBBBBBBbbO.......",
  ".......OBBbbbbBBBBBBBBBBO......",
  ".......OBBbbbBBBBBBBBBBBO......",
  "......OBBBbbBBBBBBBBBBBBOO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBWWKKBBBBWWKKBBdO.....",
  "......OBBBWWKKBBBBWWKKBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBrBBBBBBBBBrBBBdO.....",
  "......OBBBcBBBBBBBBBcBBBdO.....",
  "......OBBBBBBBRRRRBBBBBBdO.....",
  "......OBBBBBBBRRRRBBBBBBdO.....",
  ".......OBBBBBBBBBBBBBBBdO......",
  ".......OBBBBBBBBBBBBBBBdO......",
  "........OBBBBBBBBBBBBBdO.......",
  "........OBBBBBBBBBBBBBdO.......",
  ".........OBBBBBBBBBBBdO........",
  ".........OOBBBBBBBBBdOO........",
  "..........OOBBBBBBBdOO.........",
  "..........OOBB...BBdOO.........",
  "..........OOdd...ddOO..........",
  "..........OOO.....OOO..........",
  "................................",
  "................................",
])

const IDLE_1 = frame([
  "................................",
  "................................",
  "................................",
  "................................",
  "..........OOOOOOOOOOOO.........",
  ".........OBBBBBBBBBBBbO........",
  "........OBBBBBBBBBBBBbbO.......",
  ".......OBBbbbbBBBBBBBBBBO......",
  ".......OBBbbbBBBBBBBBBBBO......",
  "......OBBBbbBBBBBBBBBBBBOO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBWWKKBBBBWWKKBBdO.....",
  "......OBBBWWKKBBBBWWKKBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBrBBBBBBBBBrBBBdO.....",
  "......OBBBcBBBBBBBBBcBBBdO.....",
  "......OBBBBBBBRRRRBBBBBBdO.....",
  "......OBBBBBBBRRRRBBBBBBdO.....",
  ".......OBBBBBBBBBBBBBBBdO......",
  ".......OBBBBBBBBBBBBBBBdO......",
  "........OBBBBBBBBBBBBBdO.......",
  "........OBBBBBBBBBBBBBdO.......",
  ".........OBBBBBBBBBBBdO........",
  ".........OOBBBBBBBBBdOO........",
  "..........OOBBBBBBBdOO.........",
  "..........OOBB...BBdOO.........",
  "..........OOdd...ddOO..........",
  "..........OOO.....OOO..........",
  "................................",
])

const IDLE_2 = frame([
  "................................",
  "................................",
  "................................",
  "..........OOOOOOOOOOOO.........",
  ".........OBBBBBBBBBBBbO........",
  "........OBBBBBBBBBBBBbbO.......",
  ".......OBBbbbbBBBBBBBBBBO......",
  ".......OBBbbbBBBBBBBBBBBO......",
  "......OBBBbbBBBBBBBBBBBBOO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBOOOOBBBBOOOOB BdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBrBBBBBBBBBrBBBdO.....",
  "......OBBBcBBBBBBBBBcBBBdO.....",
  "......OBBBBBBBRRRRBBBBBBdO.....",
  "......OBBBBBBBRRRRBBBBBBdO.....",
  ".......OBBBBBBBBBBBBBBBdO......",
  ".......OBBBBBBBBBBBBBBBdO......",
  "........OBBBBBBBBBBBBBdO.......",
  "........OBBBBBBBBBBBBBdO.......",
  ".........OBBBBBBBBBBBdO........",
  ".........OOBBBBBBBBBdOO........",
  "..........OOBBBBBBBdOO.........",
  "..........OOBB...BBdOO.........",
  "..........OOdd...ddOO..........",
  "..........OOO.....OOO..........",
  "................................",
  "................................",
])

// ── DRINK frames ─────────────────────────────────────────────────────────────

const DRINK_0 = frame([
  "................................",
  "................................",
  "................................",
  "..........OOOOOOOOOOOO.........",
  ".........OBBBBBBBBBBBbO........",
  "........OBBBBBBBBBBBBbbO.......",
  ".......OBBbbbbBBBBBBBBBBO......",
  ".......OBBbbbBBBBBBBBBBBO......",
  "......OBBBbbBBBBBBBBBBBBOO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBWWKKBBBBWWKKBBdO.....",
  "......OBBBWWKKBBBBWWKKBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBrBBBBBBBBBrBBBdO.....",
  "......OBBBBBBBRRRRBBBBBBdO.....",
  ".......OBBBBBBBBBBBBBBBdO......",
  ".......OBBBBBBBBBBBBBBBdO......",
  "........OBBBBBBBBBBBBBdO.......",
  "........OBBBBBBBBBBOGGGGO......",
  ".........OBBBBBBBBBOGggGO......",
  ".........OOBBBBBBBBOGggGO......",
  "..........OOBBBBBBBOGGGGO......",
  "..........OOBB...BBOOOOO.......",
  "..........OOdd...ddOO..........",
  "..........OOO.....OOO..........",
  "................................",
  "................................",
  "................................",
  "................................",
])

const DRINK_1 = frame([
  "................................",
  "................................",
  "................................",
  "..........OOOOOOOOOOOO.........",
  ".........OBBBBBBBBBBBbO........",
  "........OBBBBBBBBBBBBbbO.......",
  ".......OBBbbbbBBBBBBBBBBO......",
  ".......OBBbbbBBBBBBBBBBBO......",
  "......OBBBbbBBBBBBBBBBBBOO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBKKBBBBBBBBKKBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBrBBBBBBBBBrBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBROOOGGGGBBdO.....",
  ".......OBBBBBBBBBBGggGBdO......",
  ".......OBBBBBBBBBBGggGBdO......",
  "........OBBBBBBBBBGGGGdO.......",
  "........OBBBBBBBBBBBBBdO.......",
  ".........OBBBBBBBBBBBdO........",
  ".........OOBBBBBBBBBdOO........",
  "..........OOBBBBBBBdOO.........",
  "..........OOBB...BBdOO.........",
  "..........OOdd...ddOO..........",
  "..........OOO.....OOO..........",
  "................................",
  "................................",
  "................................",
  "................................",
])

const DRINK_2 = frame([
  "................................",
  "................................",
  "..............sS................",
  "..........OOOOOOOOOOOO.........",
  ".........OBBBBBBBBBBBbO........",
  "........OBBBBBBBBBBBBbbO.......",
  ".......OBBbbbbBBBBBBBBBBO......",
  ".......OBBbbbBBBBBBBBBBBO......",
  "......OBBBbbBBBBBBBBBBBBOO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBOOOOBBBBOOOOB BdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBcBBBBBBBBBcBBBdO.....",
  "......OBBBrBBBBBBBBBrBBBdO.....",
  "......OBBBBBBRRRRRRB BBBBdO.....",
  ".......OBBBBBBBBBBBBBBBdO......",
  ".......OBBBBBBBBBBBBBBBdO......",
  "........OBBBBBBBBBBBBBdO.......",
  "........OBBBBBBBBBBBBBdO.......",
  ".........OBBBBBBBBBBBdO........",
  ".........OOBBBBBBBBBdOO........",
  "..........OOBBBBBBBdOO.........",
  "..........OOBB...BBdOO.........",
  "..........OOdd...ddOO..........",
  "..........OOO.....OOO..........",
  "................................",
  "................................",
  "................................",
  "................................",
])

// ── EAT frames ───────────────────────────────────────────────────────────────

const EAT_0 = frame([
  "................................",
  "................................",
  "................................",
  "..........OOOOOOOOOOOO.........",
  ".........OBBBBBBBBBBBbO........",
  "........OBBBBBBBBBBBBbbO.......",
  ".......OBBbbbbBBBBBBBBBBO......",
  ".......OBBbbbBBBBBBBBBBBO......",
  "......OBBBbbBBBBBBBBBBBBOO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBWWKKBBBBWWKKBBdO.....",
  "......OBBBWWKKBBBBWWKKBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBOOOOOOBBBBBdO.....",
  "......OBBBBBOTTTTTTOBBBBdO.....",
  "......OBBBBBOTTTTTTOBBBBdO.....",
  "......OBBBBBBOOOOOOBBBBBdO.....",
  ".......OBBBBBBBBBBBBBBBdO......",
  ".......OBBBBBBBBBBBBBBBdO......",
  "........OBBBBBBBBBBBBBdO.......",
  "........OBBBBBBBBBBBBBdO.......",
  ".........OBBBBBBBBBBBdO........",
  ".........OOBBBBBBBBBdOO........",
  "..........OOBBBBBBBdOO.........",
  "..........OOBB...BBdOO.........",
  "..........OOdd...ddOO..........",
  "..........OOO.....OOO..........",
  "................................",
  "................................",
])

const EAT_1 = frame([
  "................................",
  "................................",
  "................................",
  "..........OOOOOOOOOOOO.........",
  ".........OBBBBBBBBBBBbO........",
  "........OBBBBBBBBBBBBbbO.......",
  ".......OBBbbbbBBBBBBBBBBO......",
  ".......OBBbbbBBBBBBBBBBBO......",
  "......OBBBbbBBBBBBBBBBBBOO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBOOOOBBBBOOOOB BdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBcBBBBBBBBBcBBBdO.....",
  "......OBBBrBBBBBBBBBrBBBdO.....",
  "......OBBBBBBRRRRRRB BBBBdO.....",
  ".......OBBBBBBBBBBBBBBBdO......",
  ".......OBBBBBBBBBBBBBBBdO......",
  "........OBBBBBBBBBBBBBdO.......",
  "........OBBBBBBBBBBBBBdO.......",
  ".........OBBBBBBBBBBBdO........",
  ".........OOBBBBBBBBBdOO........",
  "..........OOBBBBBBBdOO.........",
  "..........OOBB...BBdOO.........",
  "..........OOdd...ddOO..........",
  "..........OOO.....OOO..........",
  "................................",
  "................................",
  "................................",
  "................................",
])

// ── CELEBRATE frames ─────────────────────────────────────────────────────────

const CELEBRATE_0 = frame([
  "................................",
  "......S..............S.........",
  ".....sS..............Ss........",
  "..........OOOOOOOOOOOO.........",
  ".........OBBBBBBBBBBBbO........",
  "........OBBBBBBBBBBBBbbO.......",
  ".......OBBbbbbBBBBBBBBBBO......",
  "..O....OBBbbbBBBBBBBBBBBO..O...",
  "..OO..OBBBbbBBBBBBBBBBBBOOO...",
  "..OO..OBBBBBBBBBBBBBBBBBdOO...",
  "..OO..OBBBOOOOBBBBOOOOB BdOO...",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBcBBBBBBBBBcBBBdO.....",
  "......OBBBrBBBBBBBBBrBBBdO.....",
  "......OBBBBBRRRRRRRR BBBBdO.....",
  ".......OBBBBBBBBBBBBBBBdO......",
  ".......OBBBBBBBBBBBBBBBdO......",
  "........OBBBBBBBBBBBBBdO.......",
  "........OBBBBBBBBBBBBBdO.......",
  ".........OBBBBBBBBBBBdO........",
  ".........OOBBBBBBBBBdOO........",
  "..........OOBBBBBBBdOO.........",
  "..........OOBB...BBdOO.........",
  "...........Odd...ddO...........",
  "...........OOO...OOO...........",
  "................................",
  "................................",
  "................................",
  "................................",
])

const CELEBRATE_1 = frame([
  "................................",
  "........S..............S.......",
  ".........s..............s......",
  "..........OOOOOOOOOOOO.........",
  ".........OBBBBBBBBBBBbO........",
  "........OBBBBBBBBBBBBbbO.......",
  ".O.....OBBbbbbBBBBBBBBBBO..O...",
  ".OO....OBBbbbBBBBBBBBBBBO.OO...",
  "..OO..OBBBbbBBBBBBBBBBBBOOO...",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBOOOOBBBBOOOOB BdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBcBBBBBBBBBcBBBdO.....",
  "......OBBBrBBBBBBBBBrBBBdO.....",
  "......OBBBBBRRRRRRRR BBBBdO.....",
  ".......OBBBBBBBBBBBBBBBdO......",
  ".......OBBBBBBBBBBBBBBBdO......",
  "........OBBBBBBBBBBBBBdO.......",
  "........OBBBBBBBBBBBBBdO.......",
  ".........OBBBBBBBBBBBdO........",
  "..........OBBBBBBBBBdO.........",
  "..........OOBBBBBBBdOO.........",
  "..........OOBB...BBdOO.........",
  "..........OOdd...ddOO..........",
  "..........OOO.....OOO..........",
  "................................",
  "................................",
  "................................",
  "................................",
])

// ── SLEEP frames ─────────────────────────────────────────────────────────────

const SLEEP_0 = frame([
  "................................",
  "................................",
  "................................",
  "..........OOOOOOOOOOOO.........",
  ".........OBBBBBBBBBBBbO........",
  "........OBBBBBBBBBBBBbbO.......",
  ".......OBBbbbbBBBBBBBBBBO......",
  ".......OBBbbbBBBBBBBBBBBO......",
  "......OBBBbbBBBBBBBBBBBBOO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBOOOOBBBBOOOOB BdO..Z..",
  "......OBBBBBBBBBBBBBBBBBdO.Z...",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBOOBBBBBBBdO.....",
  "......OBBBBBBBBOOBBBBBBBdO.....",
  ".......OBBBBBBBBBBBBBBBdO......",
  ".......OBBBBBBBBBBBBBBBdO......",
  "........OBBBBBBBBBBBBBdO.......",
  "........OBBBBBBBBBBBBBdO.......",
  ".........OBBBBBBBBBBBdO........",
  ".........OOBBBBBBBBBdOO........",
  "..........OOBBBBBBBdOO.........",
  "..........OOBB...BBdOO.........",
  "..........OOdd...ddOO..........",
  "..........OOO.....OOO..........",
  "................................",
  "................................",
  "................................",
])

const SLEEP_1 = frame([
  "................................",
  "................................",
  ".............................z..",
  "............................Z...",
  "..........OOOOOOOOOOOO...z.....",
  ".........OBBBBBBBBBBBbO.Z......",
  "........OBBBBBBBBBBBBbbO.......",
  ".......OBBbbbbBBBBBBBBBBO......",
  ".......OBBbbbBBBBBBBBBBBO......",
  "......OBBBbbBBBBBBBBBBBBOO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBOOOOBBBBOOOOB BdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBOOBBBBBBBdO.....",
  "......OBBBBBBBBOOBBBBBBBdO.....",
  ".......OBBBBBBBBBBBBBBBdO......",
  ".......OBBBBBBBBBBBBBBBdO......",
  "........OBBBBBBBBBBBBBdO.......",
  "........OBBBBBBBBBBBBBdO.......",
  ".........OBBBBBBBBBBBdO........",
  ".........OOBBBBBBBBBdOO........",
  "..........OOBBBBBBBdOO.........",
  "..........OOBB...BBdOO.........",
  "..........OOdd...ddOO..........",
  "..........OOO.....OOO..........",
  "................................",
  "................................",
  "................................",
])

// ── WAVE frames ──────────────────────────────────────────────────────────────

const WAVE_0 = frame([
  "................................",
  "................................",
  "................................",
  "..........OOOOOOOOOOOO.........",
  ".........OBBBBBBBBBBBbO........",
  "........OBBBBBBBBBBBBbbO..O....",
  ".......OBBbbbbBBBBBBBBBBO.OO...",
  ".......OBBbbbBBBBBBBBBBBOOO....",
  "......OBBBbbBBBBBBBBBBBBOO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBWWKKBBBBWWKKBBdO.....",
  "......OBBBWWKKBBBBWWKKBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBrBBBBBBBBBrBBBdO.....",
  "......OBBBcBBBBBBBBBcBBBdO.....",
  "......OBBBBBBBRRRRBBBBBBdO.....",
  "......OBBBBBBBRRRRBBBBBBdO.....",
  ".......OBBBBBBBBBBBBBBBdO......",
  ".......OBBBBBBBBBBBBBBBdO......",
  "........OBBBBBBBBBBBBBdO.......",
  "........OBBBBBBBBBBBBBdO.......",
  ".........OBBBBBBBBBBBdO........",
  ".........OOBBBBBBBBBdOO........",
  "..........OOBBBBBBBdOO.........",
  "..........OOBB...BBdOO.........",
  "..........OOdd...ddOO..........",
  "..........OOO.....OOO..........",
  "................................",
  "................................",
])

const WAVE_1 = frame([
  "................................",
  "...........................OO...",
  "...........................OO...",
  "..........OOOOOOOOOOOO.........",
  ".........OBBBBBBBBBBBbO........",
  "........OBBBBBBBBBBBBbbO.......",
  ".......OBBbbbbBBBBBBBBBBO......",
  ".......OBBbbbBBBBBBBBBBBO......",
  "......OBBBbbBBBBBBBBBBBBOO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBWWWWBBBBWWWWBBdO.....",
  "......OBBBWWKKBBBBWWKKBBdO.....",
  "......OBBBWWKKBBBBWWKKBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBBBBBBBBBBBBBBBdO.....",
  "......OBBBrBBBBBBBBBrBBBdO.....",
  "......OBBBcBBBBBBBBBcBBBdO.....",
  "......OBBBBBBBRRRRBBBBBBdO.....",
  "......OBBBBBBBRRRRBBBBBBdO.....",
  ".......OBBBBBBBBBBBBBBBdO......",
  ".......OBBBBBBBBBBBBBBBdO......",
  "........OBBBBBBBBBBBBBdO.......",
  "........OBBBBBBBBBBBBBdO.......",
  ".........OBBBBBBBBBBBdO........",
  ".........OOBBBBBBBBBdOO........",
  "..........OOBBBBBBBdOO.........",
  "..........OOBB...BBdOO.........",
  "..........OOdd...ddOO..........",
  "..........OOO.....OOO..........",
  "................................",
  "................................",
])

// ── State config ─────────────────────────────────────────────────────────────

const FRAMES: Record<MascotState, string[][][]> = {
  idle: [IDLE_0, IDLE_1, IDLE_2, IDLE_1],
  drink: [DRINK_0, DRINK_1, DRINK_2],
  eat: [EAT_0, EAT_1, EAT_0, EAT_1],
  celebrate: [CELEBRATE_0, CELEBRATE_1],
  sleep: [SLEEP_0, SLEEP_1],
  wave: [WAVE_0, WAVE_1],
}

const STATE_SPEED: Record<MascotState, number> = {
  idle: 500,
  drink: 600,
  eat: 300,
  celebrate: 250,
  sleep: 900,
  wave: 350,
}

const STATE_LOOPS: Record<MascotState, number> = {
  idle: -1,
  drink: 2,
  eat: 3,
  celebrate: 5,
  sleep: -1,
  wave: 4,
}

const PIXEL_SIZE = 4

function renderFrame(ctx: CanvasRenderingContext2D, fr: string[][]) {
  ctx.clearRect(0, 0, GRID * PIXEL_SIZE, GRID * PIXEL_SIZE)
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const key = fr[y]?.[x]
      if (!key || key === ".") continue
      const color = P[key]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE)
    }
  }
}

// ── Preview page ─────────────────────────────────────────────────────────────

export default function BlobPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentState, setCurrentState] = useState<MascotState>("idle")
  const [frameIndex, setFrameIndex] = useState(0)
  const loopCountRef = useRef(0)
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startState = useCallback((state: MascotState) => {
    setCurrentState(state)
    setFrameIndex(0)
    loopCountRef.current = 0
  }, [])

  useEffect(() => {
    const frames = FRAMES[currentState]
    const speed = STATE_SPEED[currentState]
    const maxLoops = STATE_LOOPS[currentState]

    if (animRef.current) clearInterval(animRef.current)

    animRef.current = setInterval(() => {
      setFrameIndex((prev) => {
        const next = (prev + 1) % frames.length
        if (next === 0) {
          loopCountRef.current++
          if (maxLoops > 0 && loopCountRef.current >= maxLoops) {
            setTimeout(() => startState("idle"), 0)
            return 0
          }
        }
        return next
      })
    }, speed)

    return () => {
      if (animRef.current) clearInterval(animRef.current)
    }
  }, [currentState, startState])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const frames = FRAMES[currentState]
    const fr = frames[frameIndex % frames.length]
    renderFrame(ctx, fr)
  }, [currentState, frameIndex])

  const states: { state: MascotState; label: string; emoji: string }[] = [
    { state: "idle", label: "Idle", emoji: "😊" },
    { state: "drink", label: "Drink Water", emoji: "🥤" },
    { state: "eat", label: "Log Food", emoji: "🍔" },
    { state: "celebrate", label: "Goal Reached!", emoji: "🎉" },
    { state: "sleep", label: "Sleeping", emoji: "😴" },
    { state: "wave", label: "Hello!", emoji: "👋" },
  ]

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fff",
        fontFamily: "system-ui",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2.5rem",
        padding: "2rem",
      }}
    >
      <h1
        style={{
          fontFamily: "'Space Grotesk', system-ui",
          fontSize: "1.5rem",
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}
      >
        Pixel Buddy Preview
      </h1>

      <div
        style={{
          background: "#1a1a2e",
          borderRadius: "1.25rem",
          padding: "2.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.25rem",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 0 40px rgba(79,195,247,0.08)",
        }}
      >
        <canvas
          ref={canvasRef}
          width={GRID * PIXEL_SIZE}
          height={GRID * PIXEL_SIZE}
          style={{
            imageRendering: "pixelated",
            width: GRID * PIXEL_SIZE * 3,
            height: GRID * PIXEL_SIZE * 3,
          }}
        />
        <p
          style={{
            fontFamily: "monospace",
            fontSize: "0.875rem",
            color: "#4fc3f7",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            fontWeight: 700,
          }}
        >
          {currentState}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: "500px",
        }}
      >
        {states.map(({ state, label, emoji }) => (
          <button
            key={state}
            onClick={() => startState(state)}
            style={{
              background:
                currentState === state
                  ? "rgba(79,195,247,0.2)"
                  : "rgba(255,255,255,0.04)",
              border:
                currentState === state
                  ? "1px solid rgba(79,195,247,0.4)"
                  : "1px solid rgba(255,255,255,0.08)",
              color: currentState === state ? "#4fc3f7" : "#999",
              borderRadius: "0.75rem",
              padding: "0.875rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "1.25rem" }}>{emoji}</span>
            {label}
          </button>
        ))}
      </div>

      <p
        style={{
          fontSize: "0.8rem",
          color: "#444",
          maxWidth: "360px",
          textAlign: "center",
          lineHeight: 1.7,
        }}
      >
        Click a state to preview the animation. In the dashboard, the buddy
        reacts automatically when you log water, food, complete tasks, etc.
      </p>
    </div>
  )
}
