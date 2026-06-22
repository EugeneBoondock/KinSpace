// Short, procedural UI + game sound effects via the Web Audio API. No audio
// files. Respects a global mute (localStorage 'kinspace_sfx_off'); best-effort,
// silently no-ops without Web Audio or a prior user gesture (autoplay policy).

let ctx: AudioContext | null = null
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  return ctx
}

const MUTE_KEY = 'kinspace_sfx_off'

export function isSfxEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(MUTE_KEY) !== '1'
  } catch {
    return true
  }
}

export function setSfxEnabled(on: boolean): void {
  try {
    if (on) window.localStorage.removeItem(MUTE_KEY)
    else window.localStorage.setItem(MUTE_KEY, '1')
    window.dispatchEvent(new CustomEvent('kinspace:sfx', { detail: on }))
  } catch {
    // ignore
  }
}

type Tone = { freq: number; start: number; dur: number; type?: OscillatorType; gain?: number; slideTo?: number }

function play(tones: Tone[], masterGain = 0.16) {
  if (!isSfxEnabled()) return
  const c = getCtx()
  if (!c) return
  const run = () => {
    const now = c.currentTime
    for (const t of tones) {
      const o = c.createOscillator()
      o.type = t.type ?? 'sine'
      const g = c.createGain()
      const at = now + t.start
      o.frequency.setValueAtTime(t.freq, at)
      if (t.slideTo) o.frequency.exponentialRampToValueAtTime(t.slideTo, at + t.dur)
      const peak = Math.max(0.0002, (t.gain ?? 1) * masterGain)
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.02, t.dur * 0.3))
      g.gain.exponentialRampToValueAtTime(0.0001, at + t.dur)
      o.connect(g)
      g.connect(c.destination)
      o.start(at)
      o.stop(at + t.dur + 0.03)
    }
  }
  if (c.state === 'suspended') c.resume().then(run).catch(() => undefined)
  else run()
}

export type SfxName =
  | 'tap'
  | 'pop'
  | 'toggle'
  | 'move'
  | 'success'
  | 'error'
  | 'win'
  | 'lose'
  | 'achievement'
  | 'reminder'

const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5, E6 = 1318.5, G6 = 1568
const E4 = 329.63, G4 = 392

/** Play a named sound effect (no-op if muted / no audio). */
export function playSfx(name: SfxName): void {
  switch (name) {
    case 'tap':
      play([{ freq: 660, start: 0, dur: 0.05, type: 'triangle', gain: 0.45 }], 0.1)
      break
    case 'pop':
      play([{ freq: 760, start: 0, dur: 0.08, type: 'sine', slideTo: 1080, gain: 0.6 }])
      break
    case 'toggle':
      play([{ freq: 520, start: 0, dur: 0.05, type: 'square', gain: 0.35 }], 0.09)
      break
    case 'move':
      play([{ freq: 360, start: 0, dur: 0.05, type: 'triangle', gain: 0.5 }], 0.12)
      break
    case 'success':
      play([{ freq: E5, start: 0, dur: 0.12 }, { freq: A5, start: 0.09, dur: 0.2 }])
      break
    case 'error':
      play([{ freq: 300, start: 0, dur: 0.18, type: 'sawtooth', slideTo: 170, gain: 0.45 }], 0.11)
      break
    case 'win':
      play([
        { freq: C5, start: 0, dur: 0.12 },
        { freq: E5, start: 0.1, dur: 0.12 },
        { freq: G5, start: 0.2, dur: 0.12 },
        { freq: C6, start: 0.3, dur: 0.32 },
      ])
      break
    case 'lose':
      play([{ freq: G4, start: 0, dur: 0.14 }, { freq: E4, start: 0.12, dur: 0.3, slideTo: 210 }], 0.13)
      break
    case 'achievement':
      play([
        { freq: G5, start: 0, dur: 0.1 },
        { freq: C6, start: 0.08, dur: 0.1 },
        { freq: E6, start: 0.16, dur: 0.1 },
        { freq: G6, start: 0.24, dur: 0.36 },
      ])
      break
    case 'reminder':
      play([{ freq: A5, start: 0, dur: 0.22 }, { freq: D5, start: 0.16, dur: 0.4 }], 0.14)
      break
  }
}
