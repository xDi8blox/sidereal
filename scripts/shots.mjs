import { chromium } from 'playwright'
const base = process.env.URL || 'http://localhost:4320/'
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const errors = []
const shoot = async (file, q, vp = { width: 1440, height: 900 }, extra = {}) => {
  const ctx = await b.newContext({ viewport: vp, ...extra })
  const p = await ctx.newPage()
  p.on('console', (m) => m.type() === 'error' && errors.push(`${file}: ${m.text()}`))
  p.on('pageerror', (e) => errors.push(`${file}: ${e.message}`))
  await p.goto(`${base}?${q}`); await p.waitForTimeout(+(process.env.WAIT || 7000))
  await p.screenshot({ path: `screenshots/${file}.png` }); await ctx.close()
}
const audio = 'autoplay&seek=38&auto=0&dyn=0'
for (const s of (process.env.SCENES || 'galaxy,nebula,blackhole,warp,supernova').split(',')) await shoot(s, `scene=${s}&ui=0&${audio}`)
if (!process.env.SCENES) {
await shoot('ui-desktop', `scene=galaxy&${audio}`)
await shoot('ui-mobile', `scene=blackhole&quality=low&${audio}`, { width: 390, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await shoot('synth-supernova', `scene=supernova&synth&ui=0&auto=0&dyn=0`)
}
await b.close()
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors')
