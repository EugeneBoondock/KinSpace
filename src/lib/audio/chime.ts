// A warm, gentle "KinSpace" notification chime — procedural Web Audio so there's
// no audio file to ship and no paid service. Two soft bell tones a rising major
// sixth apart (A5 → F#6) with a slow bloom and long decay: calm, not jarring,
// suited to a support platform where alerts shouldn't spike anxiety.

let sharedCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!sharedCtx) sharedCtx = new Ctor()
  return sharedCtx
}

function bell(ctx: AudioContext, freq: number, startAt: number, gain: number) {
  // A bell = a sine fundamental plus a quiet, slightly detuned overtone, shaped
  // by a soft attack and a long exponential tail.
  const osc = ctx.createOscillator()
  const overtone = ctx.createOscillator()
  const amp = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.value = freq
  overtone.type = 'sine'
  overtone.frequency.value = freq * 2.005
  const overtoneGain = ctx.createGain()
  overtoneGain.gain.value = 0.18

  amp.gain.setValueAtTime(0.0001, startAt)
  amp.gain.exponentialRampToValueAtTime(gain, startAt + 0.04)
  amp.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.6)

  osc.connect(amp)
  overtone.connect(overtoneGain).connect(amp)
  amp.connect(ctx.destination)

  osc.start(startAt)
  overtone.start(startAt)
  osc.stop(startAt + 1.7)
  overtone.stop(startAt + 1.7)
}

/**
 * Play the KinSpace notification chime. Best-effort: silently no-ops if Web Audio
 * is unavailable or the AudioContext can't resume (e.g. no prior user gesture).
 */
export function playNotificationChime(volume = 0.16) {
  const ctx = getCtx()
  if (!ctx) return
  const start = () => {
    const now = ctx.currentTime
    bell(ctx, 880, now, volume) // A5
    bell(ctx, 1479.98, now + 0.16, volume * 0.92) // F#6 — a warm rising sixth
  }
  if (ctx.state === 'suspended') {
    ctx.resume().then(start).catch(() => undefined)
  } else {
    start()
  }
}
