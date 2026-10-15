import * as THREE from 'three'
import { POINT_FRAG, U } from '../common'
import type { Ctx, Viz } from '../common'

export function galaxy(ctx: Ctx): Viz {
  const group = new THREE.Group()
  const fade = { value: 0 }
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uFade: fade }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime,uBass,uMid,uTreble,uBeat,uFade,uPR; uniform vec3 uC1,uC2,uC3;
      attribute float aR, aArm; attribute vec3 aRnd; varying vec3 vCol; varying float vA;
      void main(){
        float arms=4.0, r=aR, core=step(aArm,-0.5);
        float spin = r*9.0 + uTime*0.06/(0.15+r);
        float a = aArm*6.2831/arms + spin + aRnd.x*(0.35+0.4*r);
        float onArm = 1.0-min(1.0,abs(aRnd.x)*3.0);
        float wave = sin(r*26.0 - uTime*5.0);
        float rr = r*(1.0 + uBass*0.10*onArm*(0.6+0.4*wave));
        vec3 p = vec3(cos(a)*rr, aRnd.y*0.06*(1.0-r*0.7), sin(a)*rr)*12.0;
        vec3 cp = normalize(aRnd+vec3(1e-4))*pow(fract(aRnd.z*7.13),2.0)*2.4*vec3(1.,.55,1.);
        p = mix(p, cp*(1.0+uBass*0.15), core);
        vec4 mv = modelViewMatrix*vec4(p,1.);
        gl_Position = projectionMatrix*mv;
        float pulse = 1.0 + uBass*1.8*onArm*(0.5+0.5*wave) + uBeat*0.6;
        gl_PointSize = (0.9 + fract(aRnd.z*31.7)*1.6) * pulse * uPR * 9.0 / -mv.z;
        vec3 col = mix(mix(vec3(1.,.86,.62)*1.4, uC1, smoothstep(.05,.35,r)), uC2, smoothstep(.35,.85,r));
        col = mix(col, uC3, onArm*uTreble*0.6*step(0.97,fract(aRnd.z*91.0)) + core*0.0);
        col = mix(col, vec3(1.,.8,.55)*1.6, core);
        vA = uFade*(0.35+0.65*onArm)*pulse*0.55;
        vCol = col;
      }`,
    fragmentShader: POINT_FRAG,
  })
  let pts: THREE.Points | undefined
  const build = (n: number) => {
    if (pts) { group.remove(pts); pts.geometry.dispose() }
    const g = new THREE.BufferGeometry()
    const aR = new Float32Array(n), aArm = new Float32Array(n), aRnd = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const core = Math.random() < 0.18
      aR[i] = core ? 0 : Math.pow(Math.random(), 0.75) * 0.95 + 0.03
      aArm[i] = core ? -1 : Math.floor(Math.random() * 4)
      const g1 = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5
      aRnd[i * 3] = core ? Math.random() * 2 - 1 : g1 * g1 * g1 * 1.5 + g1 * 0.15
      aRnd[i * 3 + 1] = Math.random() * 2 - 1
      aRnd[i * 3 + 2] = Math.random() * 2 - 1
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('aR', new THREE.BufferAttribute(aR, 1)); g.setAttribute('aArm', new THREE.BufferAttribute(aArm, 1)); g.setAttribute('aRnd', new THREE.BufferAttribute(aRnd, 3))
    pts = new THREE.Points(g, mat); pts.frustumCulled = false; group.add(pts)
  }
  build(ctx.particles)
  group.rotation.x = 0.35
  return {
    name: 'Spiral Galaxy', key: 'galaxy', group, fade, orbit: { dist: 17, height: 7, speed: 0.05 },
    update: (dt, b) => { group.rotation.y += dt * (0.03 + b.mid * 0.05) },
    rebuild: (c) => build(c.particles),
  }
}
