export interface Bands { bass: number; mid: number; treble: number; level: number; beat: boolean; beatPulse: number; drop: number; flux: number }
export interface Track { name: string; url: string; credit?: string }

/** Web Audio engine: <audio> element / microphone / synthetic test signal -> AnalyserNode -> smoothed bands + beat detection. */
export class AudioEngine {
  ctx = new AudioContext()
  analyser = this.ctx.createAnalyser()
  gain = this.ctx.createGain()
  el = new Audio()
  freq = new Uint8Array(1024)
  bands: Bands = { bass: 0, mid: 0, treble: 0, level: 0, beat: false, beatPulse: 0, drop: 0, flux: 0 }
  sensitivity = 1
  mode: 'file' | 'mic' | 'synth' = 'file'
  private micSrc?: MediaStreamAudioSourceNode
  private micStream?: MediaStream
  private synth?: { stop: () => void }
  private hist: number[] = []
  private longAvg = 0.2
  private lastBeat = 0
  private prevBass = 0

  constructor() {
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.6
    this.el.crossOrigin = 'anonymous'
    this.el.preload = 'auto'
    const src = this.ctx.createMediaElementSource(this.el)
    src.connect(this.analyser)
    this.analyser.connect(this.gain).connect(this.ctx.destination)
  }
  async resume() { if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {}) }
  load(t: Track) { this.stopInputs(); this.mode = 'file'; this.el.src = t.url; this.el.load() }
  async play() { await this.resume(); if (this.mode === 'file') await this.el.play().catch(() => {}) }
  pause() { this.el.pause() }
  get playing() { return this.mode !== 'file' || !this.el.paused }

  async useMic() {
    await this.resume()
    this.stopInputs(); this.el.pause()
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
    this.micSrc = this.ctx.createMediaStreamSource(this.micStream)
    this.micSrc.connect(this.analyser) // analyser -> gain -> destination: mute output to avoid feedback
    this.gain.gain.value = 0
    this.mode = 'mic'
  }
  /** Synthetic 124bpm signal (kick + pad + hats) – handy for testing with no audio. */
  async useSynth() {
    await this.resume(); this.stopInputs(); this.el.pause(); this.mode = 'synth'
    const c = this.ctx, out = c.createGain(); out.gain.value = 0.5; out.connect(this.analyser)
    const pad = [220, 261.6, 329.6].map((f) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = c.createGain(); g.gain.value = 0.05; o.connect(g).connect(out); o.start(); return o })
    const noise = c.createBuffer(1, c.sampleRate, c.sampleRate); noise.getChannelData(0).forEach((_, i, a) => (a[i] = Math.random() * 2 - 1))
    const beat = 60 / 124
    let next = c.currentTime + 0.05
    const tick = setInterval(() => {
      while (next < c.currentTime + 0.3) {
        const o = c.createOscillator(), g = c.createGain()
        o.frequency.setValueAtTime(150, next); o.frequency.exponentialRampToValueAtTime(45, next + 0.12)
        g.gain.setValueAtTime(1, next); g.gain.exponentialRampToValueAtTime(0.001, next + 0.35)
        o.connect(g).connect(out); o.start(next); o.stop(next + 0.4)
        const n = c.createBufferSource(), hg = c.createGain(), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000
        n.buffer = noise; hg.gain.setValueAtTime(0.25, next + beat / 2); hg.gain.exponentialRampToValueAtTime(0.001, next + beat / 2 + 0.06)
        n.connect(hp).connect(hg).connect(out); n.start(next + beat / 2); n.stop(next + beat / 2 + 0.08)
        next += beat
      }
    }, 100)
    this.gain.gain.value = 0
    this.synth = { stop: () => { clearInterval(tick); pad.forEach((o) => o.stop()); out.disconnect() } }
  }
  stopInputs() {
    this.synth?.stop(); this.synth = undefined
    this.micSrc?.disconnect(); this.micStream?.getTracks().forEach((t) => t.stop()); this.micSrc = undefined
    this.gain.gain.value = this.volume
  }
  volume = 0.85
  setVolume(v: number) { this.volume = v; if (this.mode === 'file') this.gain.gain.value = v }

  private range(lo: number, hi: number) {
    const hz = this.ctx.sampleRate / this.analyser.fftSize
    const a = Math.max(1, Math.floor(lo / hz)), b = Math.min(this.freq.length - 1, Math.ceil(hi / hz))
    let s = 0; for (let i = a; i <= b; i++) s += this.freq[i]
    return s / ((b - a + 1) * 255)
  }
  update(dt: number) {
    this.analyser.getByteFrequencyData(this.freq)
    const k = this.sensitivity
    const raw = { bass: this.range(25, 160) * k, mid: this.range(160, 2200) * k * 1.4, treble: this.range(2200, 12000) * k * 2.2 }
    const b = this.bands
    const sm = (cur: number, t: number, up: number, down: number) => cur + (t - cur) * (1 - Math.exp(-dt * (t > cur ? up : down)))
    b.bass = sm(b.bass, Math.min(1.5, raw.bass), 30, 6)
    b.mid = sm(b.mid, Math.min(1.5, raw.mid), 18, 5)
    b.treble = sm(b.treble, Math.min(1.5, raw.treble), 25, 7)
    b.level = (b.bass + b.mid + b.treble) / 3
    // onset: positive bass flux against adaptive threshold
    const flux = Math.max(0, raw.bass - this.prevBass); this.prevBass = raw.bass
    this.hist.push(flux); if (this.hist.length > 43) this.hist.shift()
    const mean = this.hist.reduce((a, c) => a + c, 0) / this.hist.length
    const sd = Math.sqrt(this.hist.reduce((a, c) => a + (c - mean) ** 2, 0) / this.hist.length)
    const now = performance.now()
    b.beat = flux > mean + 1.4 * sd && flux > 0.03 && raw.bass > 0.25 && now - this.lastBeat > 220
    if (b.beat) this.lastBeat = now
    b.flux = flux
    b.beatPulse = b.beat ? 1 : b.beatPulse * Math.exp(-dt * 5)
    // "drop": short-term energy well above long-term average
    this.longAvg += (b.level - this.longAvg) * (1 - Math.exp(-dt * 0.25))
    b.drop = sm(b.drop, Math.max(0, Math.min(1, (b.level - this.longAvg * 1.15) * 6)), 3, 0.8)
  }
}
