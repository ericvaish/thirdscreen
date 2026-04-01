import type { MascotState, MascotCharacter } from "./mascot"

function row(s: string): string[] { return s.split("") }
function frame(rows: string[]): string[][] { return rows.map(row) }

export const PALETTES: Record<MascotCharacter, Record<string, string | null>> = {
  robot: {
    ".": null, O: "#1a1a2e", M: "#78909c", m: "#90a4ae", D: "#546e7a",
    d: "#455a64", A: "#4fc3f7", a: "#81d4fa", W: "#ffffff", K: "#111111",
    R: "#e91e63", r: "#f48fb1", S: "#ffd54f", s: "#fff9c4", G: "#66bb6a",
    g: "#a5d6a7", Z: "#78909c", z: "#b0bec5", Y: "#ffeb3b", T: "#4db6ac",
    B: "#37474f", L: "#b0bec5",
  },
  cat: {
    ".": null, O: "#1a1a2e", M: "#ff9800", m: "#ffb74d", D: "#e65100",
    d: "#bf360c", A: "#ff9800", a: "#ffcc80", W: "#ffffff", K: "#111111",
    R: "#e91e63", r: "#f48fb1", S: "#ffd54f", s: "#fff9c4", G: "#66bb6a",
    g: "#a5d6a7", Z: "#78909c", z: "#b0bec5", Y: "#ffcc80", T: "#f48fb1",
    B: "#e65100", L: "#ffe0b2",
  },
  ghost: {
    ".": null, O: "#1a1a2e", M: "#e0e0e0", m: "#f5f5f5", D: "#bdbdbd",
    d: "#9e9e9e", A: "#ce93d8", a: "#e1bee7", W: "#ffffff", K: "#111111",
    R: "#e91e63", r: "#f48fb1", S: "#ffd54f", s: "#fff9c4", G: "#66bb6a",
    g: "#a5d6a7", Z: "#78909c", z: "#b0bec5", Y: "#ce93d8", T: "#e91e63",
    B: "#bdbdbd", L: "#fafafa",
  },
  cactus: {
    ".": null, O: "#1a1a2e", M: "#4caf50", m: "#81c784", D: "#388e3c",
    d: "#2e7d32", A: "#4caf50", a: "#a5d6a7", W: "#ffffff", K: "#111111",
    R: "#e91e63", r: "#f48fb1", S: "#ffd54f", s: "#fff9c4", G: "#66bb6a",
    g: "#a5d6a7", Z: "#78909c", z: "#b0bec5", Y: "#ffeb3b", T: "#ff7043",
    B: "#2e7d32", L: "#c8e6c9",
  },
  octopus: {
    ".": null, O: "#1a1a2e", M: "#7c4dff", m: "#b388ff", D: "#651fff",
    d: "#4a148c", A: "#7c4dff", a: "#b388ff", W: "#ffffff", K: "#111111",
    R: "#e91e63", r: "#f48fb1", S: "#ffd54f", s: "#fff9c4", G: "#66bb6a",
    g: "#a5d6a7", Z: "#78909c", z: "#b0bec5", Y: "#ea80fc", T: "#e91e63",
    B: "#4a148c", L: "#d1c4e9",
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROBOT - Bolt: Square head, antenna, screen eyes, boxy body with panel
// ═══════════════════════════════════════════════════════════════════════════════

const ROBOT_IDLE_0 = frame([
  "................................", "..............OO................",
  "..............OY................", "..............OO................",
  ".........OOOOOOOOOOOO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMmmmMMMMMO..........", ".........OMMmmmMMMMMO..........",
  ".........OMMMMMMMMMMO..........", ".........OMMOOOMOOMMO..........",
  ".........OMMWWWMWWWMO..........", ".........OMMWWWMWWWMO..........",
  ".........OMMWKWMWKWMO..........", ".........OMMOOOMOOMMO..........",
  ".........OMMMMMMMMMMO..........", ".........OMMMRRRRMMMMO..........",
  ".........OMMMMMMMMMMO..........", ".........OOOOOOOOOOOO..........",
  "..........OMMMMMMMO............", "......OOOOOMMMMMMMOOOOMO........",
  "......OAAAOOMMMMMOOMMMO........", "......OAAAOOMMMMMOOMMMO........",
  "......OOOOOMMBBBMMOOOOO........", "..........OMMBBBBMO............",
  "..........OMMBBBMMO............", "..........OMMMMMMMO............",
  "..........OOOOOOOOOO...........", "..........OMMM.MMMMO...........",
  "..........OMMM.MMMMO...........", "..........ODDD.DDDDO...........",
  "..........OOOO.OOOOO...........", "................................",
])

const ROBOT_IDLE_1 = frame([
  "................................", "................................",
  "..............OO................", "..............OY................",
  "..............OO................", ".........OOOOOOOOOOOO..........",
  ".........OMMMMMMMMMMO..........", ".........OMMmmmMMMMMO..........",
  ".........OMMmmmMMMMMO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMOOOMOOMMO..........", ".........OMMWWWMWWWMO..........",
  ".........OMMWWWMWWWMO..........", ".........OMMWKWMWKWMO..........",
  ".........OMMOOOMOOMMO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMMRRRRMMMMO..........", ".........OMMMMMMMMMMO..........",
  ".........OOOOOOOOOOOO..........", "..........OMMMMMMMO............",
  "......OOOOOMMMMMMMOOOOMO........", "......OAAAOOMMMMMOOMMMO........",
  "......OAAAOOMMMMMOOMMMO........", "......OOOOOMMBBBMMOOOOO........",
  "..........OMMBBBBMO............", "..........OMMBBBMMO............",
  "..........OMMMMMMMO............", "..........OOOOOOOOOO...........",
  "..........OMMM.MMMMO...........", "..........ODDD.DDDDO...........",
  "..........OOOO.OOOOO...........", "................................",
])

const ROBOT_DRINK = frame([
  "................................", "..............SS................",
  "..............OO................", "..............OY................",
  "..............OO................", ".........OOOOOOOOOOOO..........",
  ".........OMMMMMMMMMMO..........", ".........OMMmmmMMMMMO..........",
  ".........OMMMMMMMMMMO..........", ".........OMMOOOMOOMMO..........",
  ".........OMMOOOMMOOOMO..........", ".........OMMWWWMWWWMO..........",
  ".........OMMOOOMOOMMO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMrMMMMMrMO..........", ".........OMMMAAAAAMMMO.........",
  ".........OMMMMMMMMMMO..........", ".........OOOOOOOOOOOO..........",
  "..........OMMMMMMMO............", "......OOOOOMMMMMMMOOOOMO........",
  "......OAAAOOMMMMMOOMMMO........", "......OAAAOOMMMMMOOMMMO........",
  "......OOOOOMMBBBMMOOOOO........", "..........OMMBBBBMO............",
  "..........OMMBBBMMO............", "..........OMMMMMMMO............",
  "..........OOOOOOOOOO...........", "..........OMMM.MMMMO...........",
  "..........ODDD.DDDDO...........", "..........OOOO.OOOOO...........",
  "................................", "................................",
])

const ROBOT_EAT = frame([
  "................................", "..............OO................",
  "..............OY................", "..............OO................",
  ".........OOOOOOOOOOOO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMmmmMMMMMO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMOOOMOOMMO..........", ".........OMMWWWMWWWMO..........",
  ".........OMMWKWMWKWMO..........", ".........OMMOOOMOOMMO..........",
  ".........OMMMMMMMMMMO..........", ".........OMMOOOOOOOMMO.........",
  ".........OMMOTTTTTOMO..........", ".........OMMOOOOOOOMMO.........",
  ".........OMMMMMMMMMMO..........", ".........OOOOOOOOOOOO..........",
  "..........OMMMMMMMO............", "......OOOOOMMMMMMMOOOOMO........",
  "......OAAAOOMMMMMOOMMMO........", "......OAAAOOMMMMMOOMMMO........",
  "......OOOOOMMBBBMMOOOOO........", "..........OMMBBBBMO............",
  "..........OMMBBBMMO............", "..........OMMMMMMMO............",
  "..........OOOOOOOOOO...........", "..........OMMM.MMMMO...........",
  "..........ODDD.DDDDO...........", "..........OOOO.OOOOO...........",
  "................................", "................................",
])

const ROBOT_EAT_1 = frame([
  "................................", "..............OO................",
  "..............OY................", "..............OO................",
  ".........OOOOOOOOOOOO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMmmmMMMMMO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMOOOMOOMMO..........", ".........OMMOOOMMOOOMO..........",
  ".........OMMWWWMWWWMO..........", ".........OMMOOOMOOMMO..........",
  ".........OMMMMMMMMMMO..........", ".........OMMrMMMMMrMO..........",
  ".........OMMMAAAAAMMMO.........", ".........OMMMMMMMMMMO..........",
  ".........OMMMMMMMMMMO..........", ".........OOOOOOOOOOOO..........",
  "..........OMMMMMMMO............", "......OOOOOMMMMMMMOOOOMO........",
  "......OAAAOOMMMMMOOMMMO........", "......OAAAOOMMMMMOOMMMO........",
  "......OOOOOMMBBBMMOOOOO........", "..........OMMBBBBMO............",
  "..........OMMBBBMMO............", "..........OMMMMMMMO............",
  "..........OOOOOOOOOO...........", "..........OMMM.MMMMO...........",
  "..........ODDD.DDDDO...........", "..........OOOO.OOOOO...........",
  "................................", "................................",
])

const ROBOT_CELEBRATE_0 = frame([
  "................................", "......S.......OO.........S.....",
  ".....sS.......OY.........Ss....", "..............OO................",
  ".........OOOOOOOOOOOO..........", ".........OMMMMMMMMMMO..........",
  "..OO.....OMMmmmMMMMMO.....OO..", "..OO.....OMMMMMMMMMMO.....OO..",
  "..OO.....OMMOOOMOOMMO.....OO..", ".........OMMOOOMMOOOMO..........",
  ".........OMMWWWMWWWMO..........", ".........OMMOOOMOOMMO..........",
  ".........OMMMMMMMMMMO..........", ".........OMMrMMMMMrMO..........",
  ".........OMMMAAAAAMMMO.........", ".........OMMMMMMMMMMO..........",
  ".........OOOOOOOOOOOO..........", "..........OMMMMMMMO............",
  "......OOOOOMMMMMMMOOOOMO........", "......OAAAOOMMMMMOOMMMO........",
  "......OAAAOOMMMMMOOMMMO........", "......OOOOOMMBBBMMOOOOO........",
  "..........OMMBBBBMO............", "..........OMMBBBMMO............",
  "..........OMMMMMMMO............", "..........OOOOOOOOOO...........",
  "..........OMMM.MMMMO...........", "..........ODDD.DDDDO...........",
  "..........OOOO.OOOOO...........", "................................",
  "................................", "................................",
])

const ROBOT_CELEBRATE_1 = frame([
  "................................", "........S.....OO.......S.......",
  ".........s....OY.......s.......", "..............OO................",
  ".........OOOOOOOOOOOO..........", ".OO......OMMMMMMMMMMO......OO.",
  ".OO......OMMmmmMMMMMO......OO.", "..OO.....OMMMMMMMMMMO.....OO..",
  ".........OMMOOOMOOMMO..........", ".........OMMOOOMMOOOMO..........",
  ".........OMMWWWMWWWMO..........", ".........OMMOOOMOOMMO..........",
  ".........OMMMMMMMMMMO..........", ".........OMMrMMMMMrMO..........",
  ".........OMMMAAAAAMMMO.........", ".........OMMMMMMMMMMO..........",
  ".........OOOOOOOOOOOO..........", "..........OMMMMMMMO............",
  "......OOOOOMMMMMMMOOOOMO........", "......OAAAOOMMMMMOOMMMO........",
  "......OAAAOOMMMMMOOMMMO........", "......OOOOOMMBBBMMOOOOO........",
  "..........OMMBBBBMO............", "..........OMMBBBMMO............",
  "..........OMMMMMMMO............", "..........OOOOOOOOOO...........",
  "..........OMMM.MMMMO...........", "..........ODDD.DDDDO...........",
  "..........OOOO.OOOOO...........", "................................",
  "................................", "................................",
])

const ROBOT_SLEEP_0 = frame([
  "................................", "..............OO................",
  "..............OO................", "..............OO................",
  ".........OOOOOOOOOOOO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMmmmMMMMMO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMMMMMMMMMO..........", ".........OMMOOOMOOMMO..Z.......",
  ".........OMMOOOMMOOOMO.Z........", ".........OMMMMMMMMMMO..........",
  ".........OMMOOOMOOMMO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMMMOOMMMMMO..........", ".........OMMMMMMMMMMO..........",
  ".........OOOOOOOOOOOO..........", "..........OMMMMMMMO............",
  "......OOOOOMMMMMMMOOOOMO........", "......ODDDOMMMMMMOOMMMO........",
  "......ODDDOMMMMMMOOMMMO........", "......OOOOOMMBBBMMOOOOO........",
  "..........OMMBBBBMO............", "..........OMMBBBMMO............",
  "..........OMMMMMMMO............", "..........OOOOOOOOOO...........",
  "..........OMMM.MMMMO...........", "..........OMMM.MMMMO...........",
  "..........ODDD.DDDDO...........", "..........OOOO.OOOOO...........",
  "................................", "................................",
])

const ROBOT_SLEEP_1 = frame([
  "................................", "..............OO............z..",
  "..............OO...........Z...", "..............OO.........z.....",
  ".........OOOOOOOOOOOO..Z.......", ".........OMMMMMMMMMMO..........",
  ".........OMMmmmMMMMMO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMMMMMMMMMO..........", ".........OMMOOOMOOMMO..........",
  ".........OMMOOOMMOOOMO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMOOOMOOMMO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMMMOOMMMMMO..........", ".........OMMMMMMMMMMO..........",
  ".........OOOOOOOOOOOO..........", "..........OMMMMMMMO............",
  "......OOOOOMMMMMMMOOOOMO........", "......ODDDOMMMMMMOOMMMO........",
  "......ODDDOMMMMMMOOMMMO........", "......OOOOOMMBBBMMOOOOO........",
  "..........OMMBBBBMO............", "..........OMMBBBMMO............",
  "..........OMMMMMMMO............", "..........OOOOOOOOOO...........",
  "..........OMMM.MMMMO...........", "..........OMMM.MMMMO...........",
  "..........ODDD.DDDDO...........", "..........OOOO.OOOOO...........",
  "................................", "................................",
])

const ROBOT_WAVE_0 = frame([
  "................................", "..............OO..........OO...",
  "..............OY..........OO...", "..............OO................",
  ".........OOOOOOOOOOOO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMmmmMMMMMO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMOOOMOOMMO..........", ".........OMMWWWMWWWMO..........",
  ".........OMMWKWMWKWMO..........", ".........OMMOOOMOOMMO..........",
  ".........OMMMMMMMMMMO..........", ".........OMMMRRRRMMMMO..........",
  ".........OMMMMMMMMMMO..........", ".........OOOOOOOOOOOO..........",
  "..........OMMMMMMMO............", "......OOOOOMMMMMMMOOOOMO........",
  "......OAAAOOMMMMMOOMMMO........", "......OAAAOOMMMMMOOMMMO........",
  "......OOOOOMMBBBMMOOOOO........", "..........OMMBBBBMO............",
  "..........OMMBBBMMO............", "..........OMMMMMMMO............",
  "..........OOOOOOOOOO...........", "..........OMMM.MMMMO...........",
  "..........OMMM.MMMMO...........", "..........ODDD.DDDDO...........",
  "..........OOOO.OOOOO...........", "................................",
  "................................", "................................",
])

const ROBOT_WAVE_1 = frame([
  "................................", "..............OO........OO....",
  "..............OY.........OO....", "..............OO................",
  ".........OOOOOOOOOOOO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMmmmMMMMMO..........", ".........OMMMMMMMMMMO..........",
  ".........OMMOOOMOOMMO..........", ".........OMMWWWMWWWMO..........",
  ".........OMMWKWMWKWMO..........", ".........OMMOOOMOOMMO..........",
  ".........OMMMMMMMMMMO..........", ".........OMMMRRRRMMMMO..........",
  ".........OMMMMMMMMMMO..........", ".........OOOOOOOOOOOO..........",
  "..........OMMMMMMMO............", "......OOOOOMMMMMMMOOOOMO........",
  "......OAAAOOMMMMMOOMMMO........", "......OAAAOOMMMMMOOMMMO........",
  "......OOOOOMMBBBMMOOOOO........", "..........OMMBBBBMO............",
  "..........OMMBBBMMO............", "..........OMMMMMMMO............",
  "..........OOOOOOOOOO...........", "..........OMMM.MMMMO...........",
  "..........OMMM.MMMMO...........", "..........ODDD.DDDDO...........",
  "..........OOOO.OOOOO...........", "................................",
  "................................", "................................",
])

// ═══════════════════════════════════════════════════════════════════════════════
// CAT - Whiskers: Round head, pointy ears, whiskers, tail
// ═══════════════════════════════════════════════════════════════════════════════

const CAT_IDLE_0 = frame([
  "................................", "................................",
  "........OO..........OO.........", ".......OMMO........OMMO........",
  "......OMMMO......OMMM O........", ".....OMMMMOOOOOOOOMMM MO.......",
  "....OMMMMMMMMMMMMMMMMM MO......",  "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMMWWWWMMMMWWWWMMO.......", "....OMMMWWWWMMMMWWWWMMO.......",
  "....OMMMWWWWMMMMWWWWMMO.......", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMDMMMMMMMMMMMDMMO.......", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMMMMMMRRRRMMMMMMO.......", "....OMMMMMMMMMMMMMMMMM MO......",
  ".....OMMMMMMMMMMMMMMMMO.......", "......OOMMMMMMMMMMMMOO........",
  ".......OOMMMMMMMMMMOO..........", "........OOMMMMMMMMOO...........",
  "........OMMMMMMMMMO............", "........OMMMMMMMMMO............",
  "........OMMMMMMMMMO............", "........OMMMMMMMMMO............",
  "........OOMMMMMMOO.............", ".........OOMM.MMOO.....OMM....",
  "..........OMM.MMO......OMMM...", "..........ODD.DDO.......OMMO..",
  "..........OOO.OOO.......OOO...", "................................",
  "................................", "................................",
])

const CAT_IDLE_1 = frame([
  "................................", "................................",
  "................................", "........OO..........OO.........",
  ".......OMMO........OMMO........", "......OMMMO......OMMM O........",
  ".....OMMMMOOOOOOOOMMM MO.......", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMMMMMMMMMMMMMMMM MO......", "....OMMMWWWWMMMMWWWWMMO.......",
  "....OMMMWWWWMMMMWWWWMMO.......", "....OMMMWWWWMMMMWWWWMMO.......",
  "....OMMMMMMMMMMMMMMMMM MO......", "....OMMDMMMMMMMMMMMDMMO.......",
  "....OMMMMMMMMMMMMMMMMM MO......", "....OMMMMMMMRRRRMMMMMMO.......",
  "....OMMMMMMMMMMMMMMMMM MO......", ".....OMMMMMMMMMMMMMMMMO.......",
  "......OOMMMMMMMMMMMMOO........", ".......OOMMMMMMMMMMOO..........",
  "........OOMMMMMMMMOO...........", "........OMMMMMMMMMO............",
  "........OMMMMMMMMMO............", "........OMMMMMMMMMO............",
  "........OMMMMMMMMMO............", "........OOMMMMMMOO.............",
  ".........OOMM.MMOO......OMM...", "..........OMM.MMO.......OMMM..",
  "..........ODD.DDO........OOO..", "..........OOO.OOO...............",
  "................................", "................................",
])

// CAT action frames use same idle shape but with expression changes
const CAT_DRINK = frame([
  "................................", "..............SS................",
  "........OO..........OO.........", ".......OMMO........OMMO........",
  "......OMMMO......OMMM O........", ".....OMMMMOOOOOOOOMMM MO.......",
  "....OMMMMMMMMMMMMMMMMM MO......", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMMOOOOMMMMOOOOMMMO.......", "....OMMMWWWWMMMMWWWWMMO.......",
  "....OMMMWWWWMMMMWWWWMMO.......", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMrMMMMMMMMMMrMMO........", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMMMMMMAAAAAMMMMMO.......", "....OMMMMMMMMMMMMMMMMM MO......",
  ".....OMMMMMMMMMMMMMMMMO.......", "......OOMMMMMMMMMMMMOO........",
  ".......OOMMMMMMMMMMOO..........", "........OMMMMMMMMMO............",
  "........OMMMMMMMMMO............", "........OMMMMMMMMMO............",
  "........OMMMMMMMMMO............", "........OOMMMMMMOO.............",
  ".........OOMM.MMOO.............", "..........OMM.MMO...............",
  "..........ODD.DDO...............", "..........OOO.OOO...............",
  "................................", "................................",
  "................................", "................................",
])

const CAT_EAT = frame([
  "................................", "................................",
  "........OO..........OO.........", ".......OMMO........OMMO........",
  "......OMMMO......OMMM O........", ".....OMMMMOOOOOOOOMMM MO.......",
  "....OMMMMMMMMMMMMMMMMM MO......", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMMWWWWMMMMWWWWMMO.......", "....OMMMWWKKMMMMWWKKMMO.......",
  "....OMMMMMMMMMMMMMMMMM MO......", "....OMMDMMMMMMMMMMMDMMO.......",
  "....OMMMMMMMMMMMMMMMMM MO......", "....OMMMMMOOOOOOMMMMMO........",
  "....OMMMMMOTTTTTOMMMMO........", "....OMMMMMOOOOOOMMMMMO........",
  "....OMMMMMMMMMMMMMMMMM MO......", ".....OMMMMMMMMMMMMMMMMO.......",
  "......OOMMMMMMMMMMMMOO........", ".......OOMMMMMMMMMMOO..........",
  "........OMMMMMMMMMO............", "........OMMMMMMMMMO............",
  "........OMMMMMMMMMO............", "........OOMMMMMMOO.............",
  ".........OOMM.MMOO.............", "..........OMM.MMO...............",
  "..........ODD.DDO...............", "..........OOO.OOO...............",
  "................................", "................................",
  "................................", "................................",
])

const CAT_CELEBRATE = frame([
  "................................", ".....S..................S......",
  "....sS..OO..........OO.Ss.....", ".......OMMO........OMMO........",
  "......OMMMO......OMMM O........", ".OO..OMMMMOOOOOOOOMMM MO..OO...",
  ".OO.OMMMMMMMMMMMMMMMMM MO.OO...", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMMOOOOMMMMOOOOMMMO.......", "....OMMMWWWWMMMMWWWWMMO.......",
  "....OMMMWWWWMMMMWWWWMMO.......", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMrMMMMMMMMMMrMMO........", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMMMMMAAAAAAMMMMMO.......", "....OMMMMMMMMMMMMMMMMM MO......",
  ".....OMMMMMMMMMMMMMMMMO.......", "......OOMMMMMMMMMMMMOO........",
  ".......OOMMMMMMMMMMOO..........", "........OMMMMMMMMMO............",
  "........OMMMMMMMMMO............", "........OMMMMMMMMMO............",
  "........OOMMMMMMOO.............", ".........OOMM.MMOO.............",
  "..........OMM.MMO...............", "..........ODD.DDO...............",
  "..........OOO.OOO...............", "................................",
  "................................", "................................",
  "................................", "................................",
])

const CAT_SLEEP = frame([
  "................................", "................................",
  "........OO..........OO.........", ".......OMMO........OMMO........",
  "......OMMMO......OMMM O........", ".....OMMMMOOOOOOOOMMM MO.......",
  "....OMMMMMMMMMMMMMMMMM MO......", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMMMMMMMMMMMMMMMM MO..Z...", "....OMMMOOOOMMMMOOOOMMO.Z.....",
  "....OMMMMMMMMMMMMMMMMM MO......", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMDMMMMMMMMMMMDMMO.......", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMMMMMMOOMMMMMMMMO.......", "....OMMMMMMMMMMMMMMMMM MO......",
  ".....OMMMMMMMMMMMMMMMMO.......", "......OOMMMMMMMMMMMMOO........",
  ".......OOMMMMMMMMMMOO..........", "........OMMMMMMMMMO............",
  "........OMMMMMMMMMO............", "........OMMMMMMMMMO............",
  "........OOMMMMMMOO.............", ".........OOMM.MMOO.............",
  "..........OMM.MMO...............", "..........ODD.DDO...............",
  "..........OOO.OOO...............", "................................",
  "................................", "................................",
  "................................", "................................",
])

const CAT_WAVE = frame([
  "................................", "................................",
  "........OO..........OO....OO...", ".......OMMO........OMMO..OO....",
  "......OMMMO......OMMM O........", ".....OMMMMOOOOOOOOMMM MO.......",
  "....OMMMMMMMMMMMMMMMMM MO......", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMMWWWWMMMMWWWWMMO.......", "....OMMMWWWWMMMMWWWWMMO.......",
  "....OMMMWWKKMMMMWWKKMMO.......", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMDMMMMMMMMMMMDMMO.......", "....OMMMMMMMMMMMMMMMMM MO......",
  "....OMMMMMMMRRRRMMMMMMO.......", "....OMMMMMMMMMMMMMMMMM MO......",
  ".....OMMMMMMMMMMMMMMMMO.......", "......OOMMMMMMMMMMMMOO........",
  ".......OOMMMMMMMMMMOO..........", "........OMMMMMMMMMO............",
  "........OMMMMMMMMMO............", "........OMMMMMMMMMO............",
  "........OOMMMMMMOO.............", ".........OOMM.MMOO.............",
  "..........OMM.MMO...............", "..........ODD.DDO...............",
  "..........OOO.OOO...............", "................................",
  "................................", "................................",
  "................................", "................................",
])

// ═══════════════════════════════════════════════════════════════════════════════
// GHOST - Boo: Rounded top, wavy bottom, no legs, floaty
// ═══════════════════════════════════════════════════════════════════════════════

const GHOST_IDLE_0 = frame([
  "................................", "................................",
  "................................", "..........OOOOOOOOOO...........",
  ".........OMMMMMMMMMMO..........", "........OMMMMMMMMMMMMMO.........",
  ".......OMMMMMMMMMMMMMMMO........", ".......OMMmmmmMMMMMMMO........",
  ".......OMMmmmmMMMMMMMO........", ".......OMMMMMMMMMMMMMMMO........",
  ".......OMMWWWWMMWWWWMO........", ".......OMMWWWWMMWWWWMO........",
  ".......OMMWWKKMMWWKKMO........", ".......OMMMMMMMMMMMMMMMO........",
  ".......OMMrMMMMMMMMrMO........", ".......OMMMMMMMMMMMMMMMO........",
  ".......OMMMMMMRRRRMM MO........", ".......OMMMMMMMMMMMMMMMO........",
  ".......OMMMMMMMMMMMMMMMO........", ".......OMMMMMMMMMMMMMMMO........",
  "........OMMMMMMMMMMMMMO.........", "........OMMMMMMMMMMMMMO.........",
  "........OMMMMMMMMMMMMMO.........", ".......OMMO.OMMMMO.OMMO........",
  "......OMMO..OMMMO..OMMO.......", "......OMO...OMMO....OMO.......",
  ".......O.....OO......O........", "................................",
  "................................", "................................",
  "................................", "................................",
])

const GHOST_IDLE_1 = frame([
  "................................", "................................",
  "................................", "................................",
  "..........OOOOOOOOOO...........", ".........OMMMMMMMMMMO..........",
  "........OMMMMMMMMMMMMMO.........", ".......OMMMMMMMMMMMMMMMO........",
  ".......OMMmmmmMMMMMMMO........", ".......OMMmmmmMMMMMMMO........",
  ".......OMMMMMMMMMMMMMMMO........", ".......OMMWWWWMMWWWWMO........",
  ".......OMMWWWWMMWWWWMO........", ".......OMMWWKKMMWWKKMO........",
  ".......OMMMMMMMMMMMMMMMO........", ".......OMMrMMMMMMMMrMO........",
  ".......OMMMMMMMMMMMMMMMO........", ".......OMMMMMMRRRRMM MO........",
  ".......OMMMMMMMMMMMMMMMO........", ".......OMMMMMMMMMMMMMMMO........",
  ".......OMMMMMMMMMMMMMMMO........", "........OMMMMMMMMMMMMMO.........",
  "........OMMMMMMMMMMMMMO.........", "........OMMMMMMMMMMMMMO.........",
  "......OMMO..OMMMO..OMMO.......", ".......OMO..OMMO...OMO........",
  "........O....OO.....O.........", "................................",
  "................................", "................................",
  "................................", "................................",
])

const GHOST_CELEBRATE = frame([
  "................................", "......S.................S......",
  ".....sS.................Ss.....", "..........OOOOOOOOOO...........",
  ".........OMMMMMMMMMMO..........", "........OMMMMMMMMMMMMMO.........",
  ".OO....OMMMMMMMMMMMMM MO...OO..", ".OO....OMMmmmmMMMMMMMO...OO...",
  "........OMMmmmmMMMMMMMO........", ".......OMMMMMMMMMMMMMMMO........",
  ".......OMMOOOOMMOOOOMO........", ".......OMMWWWWMMWWWWMO........",
  ".......OMMWWWWMMWWWWMO........", ".......OMMMMMMMMMMMMMMMO........",
  ".......OMMrMMMMMMMMrMO........", ".......OMMMMMMMMMMMMMMMO........",
  ".......OMMMMMAAAAAAMMMO........", ".......OMMMMMMMMMMMMMMMO........",
  ".......OMMMMMMMMMMMMMMMO........", ".......OMMMMMMMMMMMMMMMO........",
  "........OMMMMMMMMMMMMMO.........", "........OMMMMMMMMMMMMMO.........",
  "........OMMMMMMMMMMMMMO.........", ".......OMMO.OMMMMO.OMMO........",
  "......OMMO..OMMMO..OMMO.......", "......OMO...OMMO....OMO.......",
  ".......O.....OO......O........", "................................",
  "................................", "................................",
  "................................", "................................",
])

// ═══════════════════════════════════════════════════════════════════════════════
// CACTUS - Spike: Oval body, two arm-branches, flower on top
// ═══════════════════════════════════════════════════════════════════════════════

const CACTUS_IDLE_0 = frame([
  "................................", "................................",
  "..............OYO...............", ".............OYYYO..............",
  "..............OOO...............", "...........OOOOOOOOO............",
  "..........OMMMMMMMM MO...........", "..........OMMMMMMMM MO...........",
  ".........OMMmmmMMMMMO..........", ".........OMMmmmMMMMMO..........",
  ".........OMMMMMMMMMMMO..........", "..OOO....OMMMMMMMMMMMO..........",
  ".OMMMO...OMMWWWMWWWMO..........", ".OMMMMO..OMMWWWMWWWMO..........",
  "..OMMMO..OMMWKWMWKWMO..OMMMO..", "..OMMMOOOOMMMMMMMMM MOOOMMMMO..",
  "...OMMMMMMMMMMMMMM MMMMMMMMO...", "...OOMMMMMMMMMMMMM MMMMMMOO....",
  "....OOOMMMMMMMMMM MMMMOOO......", ".........OMMMMMMMMMMMO..........",
  ".........OMMMMMMMMMMMO..........", ".........OMMMMRRRRMMO..........",
  ".........OMMMMMMMMMMMO..........", ".........OMMMMMMMMMMMO..........",
  "..........OMMMMMMMM MO...........", "..........OMMMMMMMM MO...........",
  "..........OOOOOOOOOOO...........", "..........ODDD.DDDDO...........",
  "..........OOO...OOO............", "................................",
  "................................", "................................",
])

const CACTUS_IDLE_1 = frame([
  "................................", "................................",
  "................................", "..............OYO...............",
  ".............OYYYO..............", "..............OOO...............",
  "...........OOOOOOOOO............", "..........OMMMMMMMM MO...........",
  "..........OMMMMMMMM MO...........", ".........OMMmmmMMMMMO..........",
  ".........OMMmmmMMMMMO..........", ".........OMMMMMMMMMMMO..........",
  "..OOO....OMMMMMMMMMMMO..........", ".OMMMO...OMMWWWMWWWMO..........",
  ".OMMMMO..OMMWWWMWWWMO..........", "..OMMMO..OMMWKWMWKWMO..OMMMO..",
  "..OMMMOOOOMMMMMMMMM MOOOMMMMO..", "...OMMMMMMMMMMMMMM MMMMMMMMO...",
  "...OOMMMMMMMMMMMMM MMMMMMOO....", "....OOOMMMMMMMMMM MMMMOOO......",
  ".........OMMMMMMMMMMMO..........", ".........OMMMMMMMMMMMO..........",
  ".........OMMMMRRRRMMO..........", ".........OMMMMMMMMMMMO..........",
  ".........OMMMMMMMMMMMO..........", "..........OMMMMMMMM MO...........",
  "..........OMMMMMMMM MO...........", "..........OOOOOOOOOOO...........",
  "..........ODDD.DDDDO...........", "..........OOO...OOO............",
  "................................", "................................",
])

const CACTUS_CELEBRATE = frame([
  "................................", "......S...OYO..........S......",
  ".....sS..OYYYO.........Ss.....", "..............OOO...............",
  "...........OOOOOOOOO............", "..........OMMMMMMMM MO...........",
  "..........OMMMMMMMM MO...........", ".........OMMmmmMMMMMO..........",
  ".........OMMMMMMMMMMMO..........", ".OMMMO...OMMMMMMMMM MO...OMMMO.",
  ".OMMMMO..OMMOOOMMOOOMO..OMMMMO.",
  "..OMMMO..OMMWWWMWWWMO..OMMMO..",
  "..OMMMOOOOMMWWWMWWWMOOOOMMMO..",
  "...OMMMMMMMMMMMMMM MMMMMMMO...",
  "...OOMMMMMMMMMMMMM MMMMMOO....", "....OOOMMMMrMMMMMrMMOOO.......",
  ".........OMMMAAAAAMMMO.........", ".........OMMMMMMMMMMMO..........",
  ".........OMMMMMMMMMMMO..........", ".........OMMMMMMMMMMMO..........",
  "..........OMMMMMMMM MO...........", "..........OMMMMMMMM MO...........",
  "..........OOOOOOOOOOO...........", "..........ODDD.DDDDO...........",
  "..........OOO...OOO............", "................................",
  "................................", "................................",
  "................................", "................................",
  "................................", "................................",
])

// ═══════════════════════════════════════════════════════════════════════════════
// OCTOPUS - Inky: Dome head, big eyes, 4 tentacles at bottom
// ═══════════════════════════════════════════════════════════════════════════════

const OCTO_IDLE_0 = frame([
  "................................", "................................",
  "................................", "..........OOOOOOOOOO...........",
  ".........OMMMMMMMMMMO..........", "........OMMMMMMMMMMMMMO.........",
  ".......OMMMMMMMMMMMMMMMO........", ".......OMMmmmmMMMMMMMO........",
  ".......OMMmmmMMMMMMMM O........", ".......OMMMMMMMMMMMMMMMO........",
  ".......OMMWWWWMMWWWWMO........", ".......OMMWWWWMMWWWWMO........",
  ".......OMMWWKKMMWWKKMO........", ".......OMMMMMMMMMMMMMMMO........",
  ".......OMMMMMMMMMMMMMMMO........", ".......OMMMMMMRRRRMM MO........",
  ".......OMMMMMMMMMMMMMMMO........", "........OMMMMMMMMMMMMMO.........",
  ".......OMMMMMMMMMMMMMMMO........", "......OMMMMMMMMMMMMMMMMMO.......",
  ".....OMMO.OMMMMMO.OMMO.......", ".....OMO..OMMMMO..OMMO.......",
  "....OMO..OMMMO...OMMO........", "...OMO..OMMMO...OMMO.........",
  "...OMO..OMMO....OMMO..........", "...OMO..OMO.....OMO...........",
  "...OO...OO......OO............", "................................",
  "................................", "................................",
  "................................", "................................",
])

const OCTO_IDLE_1 = frame([
  "................................", "................................",
  "................................", "................................",
  "..........OOOOOOOOOO...........", ".........OMMMMMMMMMMO..........",
  "........OMMMMMMMMMMMMMO.........", ".......OMMMMMMMMMMMMMMMO........",
  ".......OMMmmmmMMMMMMMO........", ".......OMMmmmMMMMMMMM O........",
  ".......OMMMMMMMMMMMMMMMO........", ".......OMMWWWWMMWWWWMO........",
  ".......OMMWWWWMMWWWWMO........", ".......OMMWWKKMMWWKKMO........",
  ".......OMMMMMMMMMMMMMMMO........", ".......OMMMMMMMMMMMMMMMO........",
  ".......OMMMMMMRRRRMM MO........", ".......OMMMMMMMMMMMMMMMO........",
  "........OMMMMMMMMMMMMMO.........", ".......OMMMMMMMMMMMMMMMO........",
  "......OMMMMMMMMMMMMMMMMMO.......", "....OMMMO.OMMMMMO.OMMMO......",
  "...OMMMO..OMMMMO..OMMMO......", "....OMMO..OMMMO...OMMO.......",
  "....OMO..OMMMO...OMMO........", ".....OMO.OMMO....OMO..........",
  ".....OO..OO......OO...........", "................................",
  "................................", "................................",
  "................................", "................................",
])

const OCTO_CELEBRATE = frame([
  "................................", "......S.................S......",
  ".....sS.................Ss.....", "..........OOOOOOOOOO...........",
  ".........OMMMMMMMMMMO..........", "........OMMMMMMMMMMMMMO.........",
  ".......OMMMMMMMMMMMMMMMO........", ".......OMMmmmmMMMMMMMO........",
  ".......OMMMMMMMMMMMMMMMO........", ".......OMMOOOOMMOOOOMO........",
  ".......OMMWWWWMMWWWWMO........", ".......OMMWWWWMMWWWWMO........",
  ".......OMMMMMMMMMMMMMMMO........", ".......OMMrMMMMMMMMrMO........",
  ".......OMMMMMMMMMMMMMMMO........", ".......OMMMMMAAAAAAMMMO........",
  ".......OMMMMMMMMMMMMMMMO........", "........OMMMMMMMMMMMMMO.........",
  "......OMMMMMMMMMMMMMMMMMO.......", "...OMMMO.OMMMMMO.OMMMO.......",
  "..OMMMO...OMMMO...OMMMO......", "..OMMO....OMMO....OMMO........",
  "..OMO.....OMO.....OMO.........", "..OO......OO......OO..........",
  "................................", "................................",
  "................................", "................................",
  "................................", "................................",
  "................................", "................................",
])

// ═══════════════════════════════════════════════════════════════════════════════
// All character frames
// ═══════════════════════════════════════════════════════════════════════════════

export const CHARACTER_FRAMES: Record<MascotCharacter, Record<MascotState, string[][][]>> = {
  robot: {
    idle: [ROBOT_IDLE_0, ROBOT_IDLE_1],
    drink: [ROBOT_IDLE_0, ROBOT_DRINK],
    eat: [ROBOT_EAT, ROBOT_EAT_1],
    celebrate: [ROBOT_CELEBRATE_0, ROBOT_CELEBRATE_1],
    sleep: [ROBOT_SLEEP_0, ROBOT_SLEEP_1],
    wave: [ROBOT_WAVE_0, ROBOT_WAVE_1],
  },
  cat: {
    idle: [CAT_IDLE_0, CAT_IDLE_1],
    drink: [CAT_IDLE_0, CAT_DRINK],
    eat: [CAT_EAT, CAT_IDLE_0],
    celebrate: [CAT_CELEBRATE, CAT_IDLE_0],
    sleep: [CAT_SLEEP, CAT_IDLE_1],
    wave: [CAT_WAVE, CAT_IDLE_0],
  },
  ghost: {
    idle: [GHOST_IDLE_0, GHOST_IDLE_1],
    drink: [GHOST_IDLE_0, GHOST_IDLE_1],
    eat: [GHOST_IDLE_0, GHOST_IDLE_1],
    celebrate: [GHOST_CELEBRATE, GHOST_IDLE_0],
    sleep: [GHOST_IDLE_0, GHOST_IDLE_1],
    wave: [GHOST_IDLE_0, GHOST_IDLE_1],
  },
  cactus: {
    idle: [CACTUS_IDLE_0, CACTUS_IDLE_1],
    drink: [CACTUS_IDLE_0, CACTUS_IDLE_1],
    eat: [CACTUS_IDLE_0, CACTUS_IDLE_1],
    celebrate: [CACTUS_CELEBRATE, CACTUS_IDLE_0],
    sleep: [CACTUS_IDLE_0, CACTUS_IDLE_1],
    wave: [CACTUS_IDLE_0, CACTUS_IDLE_1],
  },
  octopus: {
    idle: [OCTO_IDLE_0, OCTO_IDLE_1],
    drink: [OCTO_IDLE_0, OCTO_IDLE_1],
    eat: [OCTO_IDLE_0, OCTO_IDLE_1],
    celebrate: [OCTO_CELEBRATE, OCTO_IDLE_0],
    sleep: [OCTO_IDLE_0, OCTO_IDLE_1],
    wave: [OCTO_IDLE_0, OCTO_IDLE_1],
  },
}
