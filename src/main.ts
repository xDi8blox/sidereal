import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { AudioEngine } from './audio'
import type { Track } from './audio'
import { PALETTES, POINT_FRAG, U, setPalette } from './common'
import type { Ctx, Quality, Viz } from './common'
import { galaxy } from './scenes/galaxy'
import { nebula } from './scenes/nebula'
import { blackhole } from './scenes/blackhole'
import { warp } from './scenes/warp'
import { supernova } from './scenes/supernova'
import './style.css'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const params = new URLSearchParams(location.search)
const store = { get: (k: string, d: string) => localStorage.getItem('sidereal:' + k) ?? d, set: (k: string, v: string) => localStorage.setItem('sidereal:' + k, v) }

// ---------- quality ----------
const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760
const autoQ: Quality = mobile ? 'low' : (navigator.hardwareConcurrency ?? 4) >= 8 ? 'high' : 'medium'
let qSetting = store.get('quality', 'auto')
const quality = (): Quality => (qSetting === 'auto' ? autoQ : (qSetting as Quality))
const basePR = () => Math.min(devicePixelRatio, { low: 1, medium: 1.5, high: 2 }[quality()])
let dynScale = 1

// ---------- renderer ----------
const canvas = $<HTMLCanvasElement>('gl')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500)
camera.position.set(0, 6, 18)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true; controls.enabled = false; controls.maxDistance = 80; controls.minDistance = 2.5

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.55, 0.3)
composer.addPass(bloom)
composer.addPass(new OutputPass())
const finalPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uCA: { value: 0 }, uGrain: { value: 1 }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
  fragmentShader: /* glsl */ `uniform sampler2D tDiffuse; uniform float uCA,uGrain,uTime; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec2 d = (vUv-.5); float r2 = dot(d,d); vec2 o = d*uCA*(0.004+r2*0.03);
      vec3 c = vec3(texture2D(tDiffuse,vUv+o).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-o).b);
      c *= 1.0 - r2*1.1;                                       // vignette
      c += (h(vUv*1000.+fract(uTime)*91.)-.5)*0.045*uGrain;    // film grain
      gl_FragColor = vec4(c,1.); }`,
})
composer.addPass(finalPass)

// ---------- background stars ----------
const bgFade = { value: 1 }
{
  const n = 6000, p = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(120 + Math.random() * 120); p.set([v.x, v.y, v.z], i * 3) }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3))
  scene.add(new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: { ...U, uFade: bgFade }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'uniform float uPR,uFade,uTreble; varying vec3 vCol; varying float vA; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; float s=fract(sin(dot(position,vec3(1.3,7.1,3.7)))*91.3); gl_PointSize=(1.+s*2.)*uPR; vCol=vec3(.75,.8,1.)*(.4+s); vA=uFade*(0.6+uTreble*0.5*s); }',
    fragmentShader: POINT_FRAG,
  })))
}

// ---------- scenes ----------
const ctx: Ctx = { quality: quality(), particles: Number(store.get('count', mobile ? '60000' : quality() === 'high' ? '250000' : '120000')), camera, pixelRatio: 1 }
const makers = [galaxy, nebula, blackhole, warp, supernova]
let vizzes: Viz[] = []
const buildScenes = () => {
  vizzes.forEach((v) => scene.remove(v.group))
  vizzes = makers.map((m) => m(ctx)); vizzes.forEach((v) => scene.add(v.group))
}
buildScenes()
let cur = Math.max(0, vizzes.findIndex((v) => v.key === params.get('scene')))
vizzes[cur].fade.value = 1
let sinceSwitch = 0
const chips = $('scenes')
const renderChips = () => { chips.innerHTML = vizzes.map((v, i) => `<button data-i="${i}" class="${i === cur ? 'on' : ''}" aria-pressed="${i === cur}" title="${v.name} (${i + 1})">${v.name}</button>`).join('') }
renderChips()
chips.onclick = (e) => { const i = (e.target as HTMLElement).dataset.i; if (i) go(+i) }
function go(i: number) { cur = (i + vizzes.length) % vizzes.length; sinceSwitch = 0; renderChips(); toast(vizzes[cur].name) }

// ---------- audio ----------
const audio = new AudioEngine()
const demo: Track = { name: 'Sidereal Drift', url: `${import.meta.env.BASE_URL}sidereal-drift.mp3`, credit: 'Death (xDi8blox) · CC0 1.0 · bundled demo' }
const tracks: Track[] = [demo]
let ti = 0
audio.load(demo)
const renderTracks = () => { $('tracks').innerHTML = tracks.map((t, i) => `<li><button data-i="${i}" class="${i === ti && audio.mode === 'file' ? 'on' : ''}">${t.name.replace(/</g, '&lt;')}</button></li>`).join(''); $('title').textContent = audio.mode === 'mic' ? 'Microphone input' : audio.mode === 'synth' ? 'Synthetic test signal' : tracks[ti].name; $('credit').textContent = audio.mode === 'file' ? tracks[ti].credit ?? 'Local file' : 'Live' }
renderTracks()
$('tracks').onclick = (e) => { const i = (e.target as HTMLElement).dataset.i; if (i) playTrack(+i) }
function playTrack(i: number) { ti = (i + tracks.length) % tracks.length; audio.load(tracks[ti]); audio.play(); renderTracks(); syncPlay() }
const syncPlay = () => { $('play').textContent = audio.playing ? '❚❚' : '▶' }
audio.el.addEventListener('play', syncPlay); audio.el.addEventListener('pause', syncPlay)
audio.el.addEventListener('ended', () => playTrack(ti + 1))
const togglePlay = async () => { if (audio.mode !== 'file') { audio.load(tracks[ti]); renderTracks() } if (audio.el.paused) await audio.play(); else audio.pause(); syncPlay(); dismissStart() }
$('play').onclick = togglePlay
$('prev').onclick = () => playTrack(audio.el.currentTime > 3 ? ti : ti - 1)
$('next').onclick = () => playTrack(ti + 1)
const fmt = (s: number) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00')
const pos = $<HTMLInputElement>('pos'), vol = $<HTMLInputElement>('vol')
let seeking = false
pos.oninput = () => { seeking = true; paintRange(pos) }
pos.onchange = () => { if (audio.el.duration) audio.el.currentTime = (+pos.value / 1000) * audio.el.duration; seeking = false }
vol.value = store.get('vol', '0.85'); audio.setVolume(+vol.value)
vol.oninput = () => { audio.setVolume(+vol.value); store.set('vol', vol.value); paintRange(vol) }
const paintRange = (r: HTMLInputElement) => r.style.setProperty('--p', `${((+r.value - +r.min) / (+r.max - +r.min)) * 100}%`)
const mic = async () => { try { await audio.useMic(); $('mic').classList.add('on'); renderTracks(); syncPlay(); dismissStart(); toast('Listening to microphone') } catch { toast('Microphone unavailable or blocked') } }
$('mic').onclick = () => (audio.mode === 'mic' ? (audio.load(tracks[ti]), $('mic').classList.remove('on'), renderTracks(), syncPlay()) : mic())
const addFiles = (files: FileList | File[]) => {
  const list = [...files].filter((f) => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac|opus|webm)$/i.test(f.name))
  if (!list.length) return toast('No audio files found')
  const first = tracks.length
  list.forEach((f) => tracks.push({ name: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f) }))
  playTrack(first); dismissStart(); toast(`Added ${list.length} track${list.length > 1 ? 's' : ''}`)
}
$<HTMLInputElement>('file').onchange = (e) => addFiles((e.target as HTMLInputElement).files ?? [])
let dragDepth = 0
addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; $('drop').hidden = false })
addEventListener('dragleave', () => { if (--dragDepth <= 0) { $('drop').hidden = true; dragDepth = 0 } })
addEventListener('dragover', (e) => e.preventDefault())
addEventListener('drop', (e) => { e.preventDefault(); dragDepth = 0; $('drop').hidden = true; if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files) })

// ---------- start overlay ----------
const dismissStart = () => $('start').classList.add('gone')
$('go').onclick = () => { playTrack(0); dismissStart() }
$('goMic').onclick = mic

// ---------- settings ----------
const sens = $<HTMLInputElement>('sens'), bloomR = $<HTMLInputElement>('bloom'), pal = $<HTMLSelectElement>('pal'), count = $<HTMLSelectElement>('count'), qSel = $<HTMLSelectElement>('quality'), cycle = $<HTMLSelectElement>('cycle'), fx = $<HTMLInputElement>('fx')
pal.innerHTML = Object.keys(PALETTES).map((p) => `<option>${p}</option>`).join('')
sens.value = store.get('sens', '1'); bloomR.value = store.get('bloom', '0.9'); pal.value = params.get('palette') ?? store.get('palette', 'Cosmic'); count.value = String(ctx.particles); qSel.value = qSetting; cycle.value = store.get('cycle', '35'); fx.checked = store.get('fx', '1') === '1'
setPalette(pal.value); audio.sensitivity = +sens.value
;[sens, bloomR, vol, pos].forEach(paintRange)
sens.oninput = () => { audio.sensitivity = +sens.value; store.set('sens', sens.value); paintRange(sens) }
bloomR.oninput = () => { store.set('bloom', bloomR.value); paintRange(bloomR) }
pal.onchange = () => { setPalette(pal.value); store.set('palette', pal.value) }
count.onchange = () => { ctx.particles = +count.value; store.set('count', count.value); vizzes[0].rebuild?.(ctx); toast(`${Math.round(ctx.particles / 1000)}k particles`) }
qSel.onchange = () => { qSetting = qSel.value; store.set('quality', qSetting); ctx.quality = quality(); dynScale = 1; const f = vizzes.map((v) => v.fade.value); buildScenes(); vizzes.forEach((v, i) => (v.fade.value = f[i])); resize(); toast(`Quality: ${ctx.quality}`) }
cycle.onchange = () => store.set('cycle', cycle.value)
fx.onchange = () => store.set('fx', fx.checked ? '1' : '0')
const panel = (id: string) => { const p = $(id); const open = p.hidden; $('settings').hidden = $('playlist').hidden = true; p.hidden = !open }
$('settingsBtn').onclick = () => panel('settings')
$('plBtn').onclick = () => panel('playlist')

// ---------- modes ----------
let auto = params.get('auto') !== '0' && store.get('auto', '1') === '1'
const autoBtn = $('auto')
const setAuto = (v: boolean) => { auto = v; store.set('auto', v ? '1' : '0'); autoBtn.setAttribute('aria-pressed', String(v)) }
setAuto(auto); autoBtn.onclick = () => { setAuto(!auto); toast(auto ? 'Auto-cycle on' : 'Auto-cycle off') }
const camBtn = $('cam')
const setFree = (v: boolean) => { controls.enabled = v; camBtn.setAttribute('aria-pressed', String(v)); if (v) controls.target.set(0, 0, 0) }
camBtn.onclick = () => { setFree(!controls.enabled); toast(controls.enabled ? 'Free camera — drag to orbit, scroll/pinch to zoom' : 'Cinematic camera') }
const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {})
$('full').onclick = toggleFull
const toggleHide = () => { document.body.classList.toggle('hide-ui'); if (document.body.classList.contains('hide-ui')) toast('UI hidden — press H or double-tap to show') }
$('hide').onclick = toggleHide
if (params.get('ui') === '0') { document.body.classList.add('hide-ui'); dismissStart() }
canvas.addEventListener('dblclick', () => document.body.classList.contains('hide-ui') && toggleHide())

let toastT = 0
function toast(msg: string) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = window.setTimeout(() => t.classList.remove('show'), 1800) }

// idle-hide chrome while playing
let idleT = 0
const wake = () => { document.body.classList.remove('idle'); clearTimeout(idleT); idleT = window.setTimeout(() => audio.playing && document.body.classList.add('idle'), 4000) }
;['pointermove', 'pointerdown', 'keydown'].forEach((e) => addEventListener(e, wake, { passive: true }))

// touch swipe to change scenes (cinematic mode)
let sx = 0, sy = 0
canvas.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY }, { passive: true })
canvas.addEventListener('touchend', (e) => { if (controls.enabled) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1)) }, { passive: true })

// ---------- capture ----------
let wantShot = false
$('shot').onclick = () => { wantShot = true }
let rec: MediaRecorder | null = null
const recDest = audio.ctx.createMediaStreamDestination(); audio.analyser.connect(recDest)
function toggleRec() {
  if (rec) { rec.stop(); return }
  if (!('MediaRecorder' in window) || !canvas.captureStream) return toast('Recording not supported in this browser')
  const stream = new MediaStream([...canvas.captureStream(60).getVideoTracks(), ...recDest.stream.getAudioTracks()])
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
  const chunks: Blob[] = []
  rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6 })
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  rec.onstop = () => { download(new Blob(chunks, { type: rec?.mimeType || 'video/webm' }), `sidereal-${Date.now()}.${mime.includes('mp4') ? 'mp4' : 'webm'}`); rec = null; $('rec').classList.remove('on'); toast('Clip saved') }
  rec.start(250); $('rec').classList.add('on'); toast('Recording… press R to stop')
  window.setTimeout(() => rec?.state === 'recording' && rec.stop(), 60000)
}
$('rec').onclick = toggleRec
const download = (b: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }

// ---------- keyboard ----------
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range' || e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey) return
  const k = e.key.toLowerCase()
  if (k === ' ') { e.preventDefault(); togglePlay() }
  else if (k >= '1' && k <= '5') go(+k - 1)
  else if (k === 'arrowright' && !(e.target instanceof HTMLInputElement)) audio.el.currentTime += 5
  else if (k === 'arrowleft' && !(e.target instanceof HTMLInputElement)) audio.el.currentTime -= 5
  else if (k === 'arrowup') { e.preventDefault(); vol.value = String(Math.min(1, +vol.value + 0.05)); vol.oninput?.(new Event('input')) }
  else if (k === 'arrowdown') { e.preventDefault(); vol.value = String(Math.max(0, +vol.value - 0.05)); vol.oninput?.(new Event('input')) }
  else if (k === 'n') playTrack(ti + 1)
  else if (k === 'p') playTrack(ti - 1)
  else if (k === 'a') autoBtn.click()
  else if (k === 'c') camBtn.click()
  else if (k === 'f') toggleFull()
  else if (k === 'h') toggleHide()
  else if (k === 's') wantShot = true
  else if (k === 'r') toggleRec()
  else if (k === 'm') $('mic').click()
  else if (k === 'escape') $('settings').hidden = $('playlist').hidden = true
})

// ---------- test hooks ----------
if (params.has('synth')) { dismissStart(); audio.useSynth().then(renderTracks) }
if (params.has('autoplay')) { dismissStart(); audio.play().then(() => { const s = +(params.get('seek') ?? 0); if (s) audio.el.currentTime = s }) }

// ---------- loop ----------
function resize() {
  const pr = basePR() * dynScale
  renderer.setPixelRatio(pr); composer.setPixelRatio(pr)
  renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight)
  bloom.resolution.set(innerWidth / 2, innerHeight / 2)
  camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 70 : 55; camera.updateProjectionMatrix()
  U.uPR.value = pr * Math.min(innerHeight, innerWidth * 1.2) / 900
}
addEventListener('resize', resize); resize()

const clock = new THREE.Clock()
let orbitA = 0.6, camDist = vizzes[cur].orbit.dist, camH = vizzes[cur].orbit.height, shake = 0
let fpsAcc = 0, fpsN = 0
const frame = () => {
  const dt = Math.min(0.05, clock.getDelta())
  audio.update(dt)
  const b = audio.bands
  U.uTime.value += dt; U.uBass.value = b.bass; U.uMid.value = b.mid; U.uTreble.value = b.treble; U.uBeat.value = b.beatPulse; U.uDrop.value = b.drop

  // scene transitions & auto cycle
  sinceSwitch += dt
  if (auto && audio.playing) {
    if (sinceSwitch > +cycle.value) go(cur === 2 ? 4 : (cur + 1) % vizzes.length)
    else if (b.drop > 0.75 && vizzes[cur].key !== 'warp' && sinceSwitch > 10) go(3)
  }
  vizzes.forEach((v, i) => {
    const t = i === cur ? 1 : 0
    v.fade.value += (t - v.fade.value) * (1 - Math.exp(-dt * 1.8))
    if (Math.abs(v.fade.value - t) < 0.002) v.fade.value = t
    v.group.visible = v.fade.value > 0.002
    if (v.group.visible) v.update(dt, b, ctx)
  })
  bgFade.value = Math.max(0, 1 - vizzes[1].fade.value - vizzes[2].fade.value - vizzes[3].fade.value)

  // camera
  const o = vizzes[cur].orbit
  camDist += (o.dist * (1 - b.drop * 0.12) - camDist) * (1 - Math.exp(-dt * 0.8))
  camH += (o.height - camH) * (1 - Math.exp(-dt * 0.8))
  shake = Math.max(shake * Math.exp(-dt * 6), b.beat ? 0.12 : 0)
  if (controls.enabled) controls.update()
  else {
    orbitA += dt * (o.speed + b.level * 0.04)
    const t = U.uTime.value
    camera.position.set(Math.cos(orbitA) * camDist, camH + Math.sin(t * 0.11) * camH * 0.35, Math.sin(orbitA) * camDist)
    camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake
    camera.lookAt(0, 0, 0)
  }
  camera.updateMatrixWorld()
  U.uInvProj.value.copy(camera.projectionMatrixInverse); U.uCamWorld.value.copy(camera.matrixWorld)

  bloom.strength = +bloomR.value * (0.85 + b.bass * 0.35 + b.beatPulse * 0.3)
  finalPass.uniforms.uCA.value = fx.checked ? 0.6 + b.beatPulse * 3 + b.drop * 2 : 0
  finalPass.uniforms.uGrain.value = fx.checked ? 1 : 0
  finalPass.uniforms.uTime.value = U.uTime.value
  composer.render(dt)

  if (wantShot) { wantShot = false; canvas.toBlob((bl) => bl && (download(bl, `sidereal-${Date.now()}.png`), toast('Screenshot saved')), 'image/png') }

  // UI
  if (!seeking && audio.el.duration) { pos.value = String((audio.el.currentTime / audio.el.duration) * 1000); paintRange(pos) }
  $('cur').textContent = fmt(audio.el.currentTime); $('dur').textContent = fmt(audio.el.duration)
  $('mB').style.transform = `scaleY(${0.05 + Math.min(1, b.bass) * 0.95})`; $('mM').style.transform = `scaleY(${0.05 + Math.min(1, b.mid) * 0.95})`; $('mT').style.transform = `scaleY(${0.05 + Math.min(1, b.treble) * 0.95})`

  // dynamic resolution: back off if we can't hold ~45 fps
  fpsAcc += dt; fpsN++
  if (fpsAcc > 2 && params.get('dyn') !== '0') { const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (fps < 42 && dynScale > 0.5) { dynScale *= 0.85; resize() } else if (fps > 58 && dynScale < 1) { dynScale = Math.min(1, dynScale * 1.1); resize() } }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
Object.assign(window, { __sidereal: { go, audio } })
if (params.has('debug')) setInterval(() => console.log(JSON.stringify(audio.bands)), 1000)
