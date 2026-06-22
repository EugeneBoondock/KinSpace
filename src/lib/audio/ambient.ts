// Procedural ambient soundscapes for the therapy room — generated entirely with
// the Web Audio API. No audio files, no R2, no bandwidth. The texture is chosen
// by the room's theme and gentled by the current mood (heavier moods = slower,
// quieter).
//
// Design goals (rewritten to actually relax): NO harsh white-noise hiss and NO
// bare test-tone sines. Instead — soft pink/brown noise, warm detuned chord pads,
// slow "breathing" swells, everything rolled off in the highs, and a convolution
// reverb send so the room feels spacious rather than clinical.

export type AmbientPreset = 'rain' | 'fire' | 'drone' | 'white' | 'ocean' | 'forest' | 'wind'

type Nodes = {
  master: GainNode
  sources: AudioScheduledSourceNode[]
  lfos: AudioScheduledSourceNode[]
  /** Recurring schedulers (e.g. forest bird chirps) cleared on teardown. */
  intervals: number[]
}

function makeNoiseBuffer(ctx: AudioContext, kind: 'white' | 'pink' | 'brown'): AudioBuffer {
  const seconds = 4
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  if (kind === 'white') {
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
  } else if (kind === 'brown') {
    // Brown (red) noise — deep, soft, oceanic. Each sample integrates the last.
    let last = 0
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
  } else {
    // Pink noise (Paul Kellet's economical filter) — equal energy per octave, the
    // gentle "shhh" of rain/wind without white noise's piercing top end.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      b3 = 0.8665 * b3 + white * 0.3104856
      b4 = 0.55 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.016898
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
      b6 = white * 0.115926
    }
  }
  return buffer
}

// A synthesized, smooth reverb tail (decaying noise) — gives every preset a sense
// of space, which is most of what makes ambient sound "calming" rather than flat.
function makeReverbImpulse(ctx: AudioContext, seconds = 3.2, decay = 2.4): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
  }
  return impulse
}

/**
 * One calming soundscape. start() must be called from a user gesture (autoplay
 * policy). Re-call setPreset to morph; stop() fades out and frees the context.
 */
export class AmbientEngine {
  private ctx: AudioContext | null = null
  private nodes: Nodes | null = null
  private preset: AmbientPreset = 'drone'
  private intensity = 1 // 0.6 (heavy/quiet) .. 1 (default)

  get isPlaying(): boolean {
    return this.ctx !== null
  }

  async start(preset: AmbientPreset, intensity = 1): Promise<void> {
    this.preset = preset
    this.intensity = Math.max(0.5, Math.min(1, intensity))
    if (typeof window === 'undefined') return
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    if (!this.ctx) this.ctx = new Ctor()
    if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => undefined)
    this.build()
  }

  setPreset(preset: AmbientPreset, intensity = 1): void {
    if (!this.ctx) return
    this.preset = preset
    this.intensity = Math.max(0.5, Math.min(1, intensity))
    this.teardownNodes(0.8)
    this.build()
  }

  stop(): void {
    if (!this.ctx) return
    this.teardownNodes(1.0)
    const ctx = this.ctx
    this.ctx = null
    window.setTimeout(() => ctx.close().catch(() => undefined), 1300)
  }

  private teardownNodes(fade: number): void {
    if (!this.ctx || !this.nodes) return
    const { master, sources, lfos, intervals } = this.nodes
    for (const id of intervals) clearInterval(id)
    const now = this.ctx.currentTime
    try {
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(0.0001, now + fade)
    } catch {
      // ignore
    }
    const stopAt = now + fade + 0.1
    for (const node of [...sources, ...lfos]) {
      try {
        node.stop(stopAt)
      } catch {
        // already stopped
      }
    }
    this.nodes = null
  }

  /** Shared output chain: bus → (dry + reverb) → gentle high roll-off → master → out. */
  private buildBus(ctx: AudioContext): { bus: GainNode; master: GainNode } {
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, ctx.currentTime)

    // Tame the highs so nothing is ever piercing.
    const tame = ctx.createBiquadFilter()
    tame.type = 'lowpass'
    tame.frequency.value = 2600
    tame.Q.value = 0.4
    master.connect(tame)
    tame.connect(ctx.destination)

    const bus = ctx.createGain()
    bus.gain.value = 1
    bus.connect(master)

    // Reverb send for space/warmth.
    const convolver = ctx.createConvolver()
    convolver.buffer = makeReverbImpulse(ctx)
    const wet = ctx.createGain()
    wet.gain.value = 0.55
    bus.connect(convolver)
    convolver.connect(wet)
    wet.connect(master)

    return { bus, master }
  }

  private build(): void {
    const ctx = this.ctx
    if (!ctx) return
    const { bus, master } = this.buildBus(ctx)
    const sources: AudioScheduledSourceNode[] = []
    const lfos: AudioScheduledSourceNode[] = []
    const intervals: number[] = []
    const ceiling = 0.16 * this.intensity

    if (this.preset === 'rain') {
      // Soft rain: a brown-noise base (the deep wash) + pink-noise "shower" rolled
      // off and slowly swelling, so it breathes like passing showers.
      const base = ctx.createBufferSource()
      base.buffer = makeNoiseBuffer(ctx, 'brown')
      base.loop = true
      const baseFilter = ctx.createBiquadFilter()
      baseFilter.type = 'lowpass'
      baseFilter.frequency.value = 900
      const baseGain = ctx.createGain()
      baseGain.gain.value = ceiling * 0.8
      base.connect(baseFilter)
      baseFilter.connect(baseGain)
      baseGain.connect(bus)

      const shower = ctx.createBufferSource()
      shower.buffer = makeNoiseBuffer(ctx, 'pink')
      shower.loop = true
      const showerFilter = ctx.createBiquadFilter()
      showerFilter.type = 'bandpass'
      showerFilter.frequency.value = 1600
      showerFilter.Q.value = 0.7
      const showerGain = ctx.createGain()
      showerGain.gain.value = ceiling * 0.5
      const swell = ctx.createOscillator()
      swell.frequency.value = 0.08 * this.intensity
      const swellDepth = ctx.createGain()
      swellDepth.gain.value = ceiling * 0.3
      swell.connect(swellDepth)
      swellDepth.connect(showerGain.gain)
      shower.connect(showerFilter)
      showerFilter.connect(showerGain)
      showerGain.connect(bus)

      base.start()
      shower.start()
      swell.start()
      sources.push(base, shower)
      lfos.push(swell)
    } else if (this.preset === 'fire') {
      // Warm hearth: brown-noise rumble + a slow flicker on the gain for the
      // gentle "breathing" of embers (no harsh crackle).
      const noise = ctx.createBufferSource()
      noise.buffer = makeNoiseBuffer(ctx, 'brown')
      noise.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 480
      const body = ctx.createGain()
      body.gain.value = ceiling
      const flicker = ctx.createOscillator()
      flicker.frequency.value = 0.9
      const flickerDepth = ctx.createGain()
      flickerDepth.gain.value = ceiling * 0.18
      flicker.connect(flickerDepth)
      flickerDepth.connect(body.gain)
      noise.connect(filter)
      filter.connect(body)
      body.connect(bus)
      noise.start()
      flicker.start()
      sources.push(noise)
      lfos.push(flicker)
    } else if (this.preset === 'white') {
      // Soft "air": pink noise (never white) under a low cutoff with a very slow
      // swell — a clean, weightless wash to settle into.
      const noise = ctx.createBufferSource()
      noise.buffer = makeNoiseBuffer(ctx, 'pink')
      noise.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1500
      const body = ctx.createGain()
      body.gain.value = ceiling * 0.75
      const swell = ctx.createOscillator()
      swell.frequency.value = 0.05 * this.intensity
      const swellDepth = ctx.createGain()
      swellDepth.gain.value = ceiling * 0.25
      swell.connect(swellDepth)
      swellDepth.connect(body.gain)
      noise.connect(filter)
      filter.connect(body)
      body.connect(bus)
      noise.start()
      swell.start()
      sources.push(noise)
      lfos.push(swell)
    } else if (this.preset === 'ocean') {
      // Ocean: a deep brown-noise wash shaped by a slow LFO so waves roll in and out.
      const noise = ctx.createBufferSource()
      noise.buffer = makeNoiseBuffer(ctx, 'brown')
      noise.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 720
      const body = ctx.createGain()
      body.gain.value = ceiling * 0.5
      const wave = ctx.createOscillator()
      wave.frequency.value = 0.09 * this.intensity
      const waveDepth = ctx.createGain()
      waveDepth.gain.value = ceiling * 0.45
      wave.connect(waveDepth)
      waveDepth.connect(body.gain)
      noise.connect(filter)
      filter.connect(body)
      body.connect(bus)
      noise.start()
      wave.start()
      sources.push(noise)
      lfos.push(wave)
    } else if (this.preset === 'wind') {
      // Wind: pink noise through a wandering bandpass (gusts) under a slow swell.
      const noise = ctx.createBufferSource()
      noise.buffer = makeNoiseBuffer(ctx, 'pink')
      noise.loop = true
      const band = ctx.createBiquadFilter()
      band.type = 'bandpass'
      band.frequency.value = 500
      band.Q.value = 0.6
      const wander = ctx.createOscillator()
      wander.frequency.value = 0.05 * this.intensity
      const wanderDepth = ctx.createGain()
      wanderDepth.gain.value = 260
      wander.connect(wanderDepth)
      wanderDepth.connect(band.frequency)
      const body = ctx.createGain()
      body.gain.value = ceiling * 0.6
      const swell = ctx.createOscillator()
      swell.frequency.value = 0.06 * this.intensity
      const swellDepth = ctx.createGain()
      swellDepth.gain.value = ceiling * 0.3
      swell.connect(swellDepth)
      swellDepth.connect(body.gain)
      noise.connect(band)
      band.connect(body)
      body.connect(bus)
      noise.start()
      wander.start()
      swell.start()
      sources.push(noise)
      lfos.push(wander, swell)
    } else if (this.preset === 'forest') {
      // Forest: a soft bed of leaves/wind (filtered pink noise) with occasional,
      // gentle bird chirps scheduled at random intervals.
      const noise = ctx.createBufferSource()
      noise.buffer = makeNoiseBuffer(ctx, 'pink')
      noise.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 1200
      const body = ctx.createGain()
      body.gain.value = ceiling * 0.4
      noise.connect(filter)
      filter.connect(body)
      body.connect(bus)
      noise.start()
      sources.push(noise)
      const chirp = () => {
        const c = this.ctx
        if (!c) return
        const now = c.currentTime
        const base = 1800 + Math.random() * 1400
        const o = c.createOscillator()
        o.type = 'sine'
        o.frequency.setValueAtTime(base, now)
        o.frequency.exponentialRampToValueAtTime(base * 1.5, now + 0.08)
        const g = c.createGain()
        g.gain.setValueAtTime(0.0001, now)
        g.gain.exponentialRampToValueAtTime(ceiling * 0.5, now + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
        o.connect(g)
        g.connect(bus)
        o.start(now)
        o.stop(now + 0.24)
      }
      const birdTimer = window.setInterval(() => {
        if (Math.random() < 0.6) chirp()
      }, 2600)
      intervals.push(birdTimer)
    } else {
      // Drone → a warm, slow major-9th pad: each note is two slightly detuned
      // oscillators (chorus), under a soft lowpass that drifts, with a breathing
      // swell on the whole chord. This is the relaxing default.
      const root = 110 // A2
      const notes = [root, root * 1.5, root * 2, root * 2.5] // root, fifth, octave, maj-third-above-octave
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 620
      filter.Q.value = 0.5
      const cutoffLfo = ctx.createOscillator()
      cutoffLfo.frequency.value = 0.04 * this.intensity
      const cutoffDepth = ctx.createGain()
      cutoffDepth.gain.value = 180
      cutoffLfo.connect(cutoffDepth)
      cutoffDepth.connect(filter.frequency)

      const chord = ctx.createGain()
      chord.gain.value = ceiling
      // Whole-chord breathing swell.
      const swell = ctx.createOscillator()
      swell.frequency.value = 0.06 * this.intensity
      const swellDepth = ctx.createGain()
      swellDepth.gain.value = ceiling * 0.25
      swell.connect(swellDepth)
      swellDepth.connect(chord.gain)

      filter.connect(chord)
      chord.connect(bus)

      for (const freq of notes) {
        for (const detune of [-5, 6]) {
          const osc = ctx.createOscillator()
          osc.type = 'triangle'
          osc.frequency.value = freq
          osc.detune.value = detune
          const oscGain = ctx.createGain()
          oscGain.gain.value = 0.22
          osc.connect(oscGain)
          oscGain.connect(filter)
          osc.start()
          sources.push(osc)
        }
      }
      cutoffLfo.start()
      swell.start()
      lfos.push(cutoffLfo, swell)
    }

    // Long, gentle fade-in so it never "starts" abruptly.
    master.gain.linearRampToValueAtTime(ceiling, ctx.currentTime + 3.5)
    this.nodes = { master, sources, lfos, intervals }
  }
}
