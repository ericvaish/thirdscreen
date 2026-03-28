// Synthesized UI sounds using Web Audio API.
// No external audio files needed - everything is generated in code.

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === "suspended") audioCtx.resume()
  return audioCtx
}

// ── Sound primitives ─────────────────────────────────────────────────────────

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.15,
  detune = 0,
) {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.value = frequency
  osc.detune.value = detune

  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration)
}

function playNoise(duration: number, volume = 0.08) {
  const ctx = getCtx()
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3))
  }

  const source = ctx.createBufferSource()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()

  source.buffer = buffer
  filter.type = "bandpass"
  filter.frequency.value = 2000
  filter.Q.value = 0.5

  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)

  source.start()
}

// ── Sound effects ────────────────────────────────────────────────────────────

/** Water gulp - bubbly descending tone like Minecraft drinking */
export function playWaterSound() {
  const ctx = getCtx()
  const t = ctx.currentTime

  // Bubble 1
  const osc1 = ctx.createOscillator()
  const g1 = ctx.createGain()
  osc1.type = "sine"
  osc1.frequency.setValueAtTime(600, t)
  osc1.frequency.exponentialRampToValueAtTime(300, t + 0.12)
  g1.gain.setValueAtTime(0.15, t)
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
  osc1.connect(g1).connect(ctx.destination)
  osc1.start(t)
  osc1.stop(t + 0.15)

  // Bubble 2
  const osc2 = ctx.createOscillator()
  const g2 = ctx.createGain()
  osc2.type = "sine"
  osc2.frequency.setValueAtTime(500, t + 0.1)
  osc2.frequency.exponentialRampToValueAtTime(250, t + 0.22)
  g2.gain.setValueAtTime(0.12, t + 0.1)
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
  osc2.connect(g2).connect(ctx.destination)
  osc2.start(t + 0.1)
  osc2.stop(t + 0.25)

  // Bubble 3
  const osc3 = ctx.createOscillator()
  const g3 = ctx.createGain()
  osc3.type = "sine"
  osc3.frequency.setValueAtTime(450, t + 0.2)
  osc3.frequency.exponentialRampToValueAtTime(200, t + 0.35)
  g3.gain.setValueAtTime(0.1, t + 0.2)
  g3.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
  osc3.connect(g3).connect(ctx.destination)
  osc3.start(t + 0.2)
  osc3.stop(t + 0.35)
}

/** Food crunch - short noise burst like a bite */
export function playFoodSound() {
  playNoise(0.12, 0.1)
  setTimeout(() => playNoise(0.08, 0.07), 100)
}

/** Task complete - satisfying ascending two-note chime */
export function playTaskSound() {
  playTone(523, 0.15, "sine", 0.12)  // C5
  setTimeout(() => playTone(784, 0.25, "sine", 0.15), 100)  // G5
}

/** Medicine taken - soft pill pop */
export function playMedicineSound() {
  playTone(880, 0.08, "sine", 0.1)
  setTimeout(() => playTone(1100, 0.12, "sine", 0.08), 60)
}

/** Event added - notebook page flip / pencil scribble */
export function playEventSound() {
  playNoise(0.15, 0.06)
  setTimeout(() => playTone(1200, 0.08, "triangle", 0.06), 80)
  setTimeout(() => playNoise(0.1, 0.04), 120)
}

/** Celebration - ascending arpeggio */
export function playCelebrateSound() {
  playTone(523, 0.15, "sine", 0.1)   // C5
  setTimeout(() => playTone(659, 0.15, "sine", 0.1), 80)   // E5
  setTimeout(() => playTone(784, 0.15, "sine", 0.1), 160)   // G5
  setTimeout(() => playTone(1047, 0.3, "sine", 0.12), 240)  // C6
}

/** Generic notification pop */
export function playNotifSound() {
  playTone(800, 0.1, "sine", 0.08)
  setTimeout(() => playTone(1000, 0.15, "sine", 0.1), 70)
}
