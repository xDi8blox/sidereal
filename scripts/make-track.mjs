// Synthesises the bundled demo track "Sidereal Drift" from scratch (original work, CC0).
import { writeFileSync } from 'fs'
const SR = 44100, BPM = 124, beat = 60 / BPM, bars = 36, dur = bars * 4 * beat
const N = Math.floor(dur * SR), L = new Float32Array(N), R = new Float32Array(N)
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
const mtof = (m) => 440 * 2 ** ((m - 69) / 12)
const add = (i, l, r = l) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r } }
const prog = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]] // Am9 F C G
const section = (bar) => (bar < 8 ? 'intro' : bar < 16 ? 'build' : bar < 18 ? 'riser' : bar < 30 ? 'drop' : 'outro')
for (let bar = 0; bar < bars; bar++) {
  const s = section(bar), chord = prog[bar % 4], t0 = bar * 4 * beat
  // pad
  const padLen = Math.floor(4 * beat * SR)
  for (let j = 0; j < padLen; j++) {
    const t = t0 + j / SR, env = Math.min(1, j / (SR * 0.6)) * Math.min(1, (padLen - j) / (SR * 0.5))
    let v = 0
    for (const n of chord) { const f = mtof(n); v += Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 1.003 * t + 1) + 0.2 * Math.sin(4 * Math.PI * f * t) }
    const amp = s === 'drop' ? 0.035 : 0.05
    add(Math.floor(t * SR), v * env * amp * (1 + 0.2 * Math.sin(t * 0.7)), v * env * amp * (1 + 0.2 * Math.cos(t * 0.6)))
  }
  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * beat
    // kick
    if (s !== 'intro' && s !== 'riser' || (s === 'intro' && bar >= 4 && b === 0)) {
      for (let j = 0; j < SR * 0.35; j++) { const t = j / SR, f = 45 + 120 * Math.exp(-t * 30); add(Math.floor(tb * SR) + j, Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 9) * (s === 'drop' ? 0.85 : 0.6)) }
    }
    // clap on 2 & 4
    if ((s === 'drop' || s === 'build') && b % 2 === 1) for (let j = 0; j < SR * 0.18; j++) { const t = j / SR, v = rnd() * Math.exp(-t * 22) * 0.22; add(Math.floor(tb * SR) + j, v, v * 0.9) }
    // hats on offbeats
    if (s !== 'intro') for (let h = 0; h < 2; h++) { const th = tb + (h + 0.5) * beat / 2; for (let j = 0; j < SR * 0.04; j++) { let v = rnd() * Math.exp(-j / SR * 120) * 0.08; v = v - (L[Math.floor(th * SR) + j - 1] || 0) * 0; add(Math.floor(th * SR) + j, v * 0.7, v) } }
    // bass: 8ths
    if (s === 'drop' || s === 'build') for (let e = 0; e < 2; e++) {
      const te = tb + e * beat / 2, f = mtof(chord[0] - 24), len = SR * beat / 2 * 0.9
      for (let j = 0; j < len; j++) { const t = j / SR, ph = (f * t) % 1, saw = 2 * ph - 1, env = Math.exp(-t * 6); add(Math.floor(te * SR) + j, (Math.sin(2 * Math.PI * f * t) * 0.5 + saw * 0.18 * env) * 0.32 * (e ? 0.8 : 1)) }
    }
    // arp in drop / outro
    if (s === 'drop' || s === 'outro' || s === 'build') for (let a = 0; a < 4; a++) {
      const ta = tb + a * beat / 4, n = chord[(b * 4 + a) % 4] + 12 + (a === 3 ? 12 : 0), f = mtof(n)
      for (let j = 0; j < SR * 0.22; j++) { const t = j / SR, v = Math.sin(2 * Math.PI * f * t + 2 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 10)) * Math.exp(-t * 14) * 0.07; const p = a % 2 ? 0.6 : 1; add(Math.floor(ta * SR) + j + Math.floor(SR * beat * 0.375) * 0, v * p, v * (1.6 - p)) }
    }
  }
  // riser
  if (s === 'riser') { const len = Math.floor(4 * beat * SR); let lp = 0; for (let j = 0; j < len; j++) { const k = j / len; lp += (rnd() - lp) * (0.02 + k * 0.5); add(Math.floor(t0 * SR) + j, lp * k * 0.35 + Math.sin(2 * Math.PI * (200 + 1800 * k * k) * j / SR) * 0.05 * k) } }
}
// simple echo + soft clip + fades
const d = Math.floor(beat * 0.75 * SR)
for (let i = d; i < N; i++) { L[i] += R[i - d] * 0.22; R[i] += L[i - d] * 0.22 }
const out = Buffer.alloc(44 + N * 4)
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
for (let i = 0; i < N; i++) {
  const fade = Math.min(1, i / (SR * 1.5), (N - i) / (SR * 3))
  out.writeInt16LE(Math.round(Math.tanh(L[i] / peak * 1.4) * fade * 30000), 44 + i * 4)
  out.writeInt16LE(Math.round(Math.tanh(R[i] / peak * 1.4) * fade * 30000), 46 + i * 4)
}
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22)
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40)
writeFileSync('/tmp/track.wav', out)
console.log('seconds', dur.toFixed(1))
