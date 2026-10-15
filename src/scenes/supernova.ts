import * as THREE from 'three'
import { NOISE, POINT_FRAG, U } from '../common'
import type { Ctx, Viz } from '../common'

const K = 8
/** Supernova: a turbulent star whose beats launch GPU particle shells (K recycled burst slots). */
export function supernova(ctx: Ctx): Viz {
  const fade = { value: 0 }
  const bt = [new THREE.Vector4(-100, -100, -100, -100), new THREE.Vector4(-100, -100, -100, -100)], bp = [new THREE.Vector4(), new THREE.Vector4()]
  const star = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 32), new THREE.ShaderMaterial({
    uniforms: { ...U, uFade: fade }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: 'varying vec3 vN, vP, vV; void main(){ vN=normalize(normalMatrix*normal); vP=position; vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: `uniform float uTime,uBass,uBeat,uFade; uniform vec3 uC1,uC2,uC3; varying vec3 vN,vP,vV; ${NOISE}
      void main(){ float n=fbm(vP*2.2+vec3(0.,uTime*0.4,0.)+fbm(vP*4.-uTime*0.2)); float f=pow(1.-max(0.,dot(vN,vV)),2.);
        vec3 c=mix(vec3(1.,.85,.6)*0.9, uC2*0.9, smoothstep(.3,.7,n))+uC1*f*1.2; gl_FragColor=vec4(c*(0.28+uBass*0.22+uBeat*0.2)*uFade,1.); }`,
  }))
  const n = Math.min(ctx.particles, { low: 30000, medium: 60000, high: 90000 }[ctx.quality])
  const g = new THREE.BufferGeometry()
  const dir = new Float32Array(n * 3), aB = new Float32Array(n), aS = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection(); if (i % 5 === 0) v.y *= 0.06
    dir.set([v.x, v.y, v.z], i * 3); aB[i] = i % K; aS[i] = 0.4 + Math.random() * Math.random() * 1.6
  }
  g.setAttribute('position', new THREE.BufferAttribute(dir, 3)); g.setAttribute('aB', new THREE.BufferAttribute(aB, 1)); g.setAttribute('aS', new THREE.BufferAttribute(aS, 1))
  const pmat = new THREE.ShaderMaterial({
    uniforms: { ...U, uFade: fade, uBT0: { value: bt[0] }, uBT1: { value: bt[1] }, uBP0: { value: bp[0] }, uBP1: { value: bp[1] } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `uniform float uTime,uFade,uPR,uTreble; uniform vec4 uBT0,uBT1,uBP0,uBP1; uniform vec3 uC1,uC2,uC3;
      attribute float aB, aS; varying vec3 vCol; varying float vA;
      void main(){
        vec4 sel0 = vec4(equal(vec4(aB), vec4(0.,1.,2.,3.))), sel1 = vec4(equal(vec4(aB), vec4(4.,5.,6.,7.)));
        float age = uTime - (dot(sel0,uBT0)+dot(sel1,uBT1)), pw = dot(sel0,uBP0)+dot(sel1,uBP1);
        float d = 1.6 + (1.0-exp(-age*aS*1.3))*9.0*pw*aS;
        vec3 p = position*d; p += vec3(sin(age*2.+position.y*9.),cos(age*1.7+position.x*7.),0.)*0.12*age;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        float life = exp(-age*0.55)*step(0.,age);
        gl_PointSize = (0.6+aS*0.7) * uPR * 46.0 / -mv.z * (0.6+life);
        vCol = mix(mix(vec3(1.,.9,.7), uC2, smoothstep(0.,1.2,age)), uC1, smoothstep(1.,4.,age));
        vCol = mix(vCol, uC3, step(.9,fract(aS*37.))*uTreble);
        vA = pow(life,1.5)*uFade*0.45;
      }`,
    fragmentShader: POINT_FRAG,
  })
  const pts = new THREE.Points(g, pmat); pts.frustumCulled = false
  const group = new THREE.Group(); group.add(star, pts)
  let slot = 0, last = -10
  const fire = (s: number) => { bt[slot >> 2].setComponent(slot & 3, U.uTime.value); bp[slot >> 2].setComponent(slot & 3, s); slot = (slot + 1) % K; last = U.uTime.value }
  return {
    name: 'Supernova', key: 'supernova', group, fade, orbit: { dist: 15, height: 4, speed: 0.06 },
    update: (dt, b) => {
      const t = U.uTime.value
      if ((b.beat && t - last > 0.3) || t - last > 1.8) fire(0.55 + Math.min(1.2, b.bass + b.drop * 0.8))
      star.scale.setScalar(1 + b.bass * 0.25 + b.beatPulse * 0.15); star.rotation.y += dt * 0.1
    },
  }
}
