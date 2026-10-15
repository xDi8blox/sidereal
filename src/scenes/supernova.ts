import * as THREE from 'three'
import { NOISE, POINT_FRAG, U } from '../common'
import type { Ctx, Viz } from '../common'

const K = 8
/** Supernova: a turbulent star whose beats launch GPU particle shells (K recycled burst slots). */
export function supernova(ctx: Ctx): Viz {
  const fade = { value: 0 }
  const bursts = { value: new Array(K).fill(-100) }, power = { value: new Array(K).fill(0) }
  const star = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 32), new THREE.ShaderMaterial({
    uniforms: { ...U, uFade: fade }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: 'varying vec3 vN, vP, vV; void main(){ vN=normalize(normalMatrix*normal); vP=position; vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: `uniform float uTime,uBass,uBeat,uFade; uniform vec3 uC1,uC2,uC3; varying vec3 vN,vP,vV; ${NOISE}
      void main(){ float n=fbm(vP*2.2+vec3(0.,uTime*0.4,0.)+fbm(vP*4.-uTime*0.2)); float f=pow(1.-max(0.,dot(vN,vV)),2.);
        vec3 c=mix(vec3(1.,.95,.8)*2.2, uC2*1.6, n)+uC1*f*2.5; gl_FragColor=vec4(c*(0.7+uBass*1.2+uBeat)*uFade,1.); }`,
  }))
  const n = Math.min(ctx.particles, { low: 40000, medium: 90000, high: 160000 }[ctx.quality])
  const g = new THREE.BufferGeometry()
  const dir = new Float32Array(n * 3), aB = new Float32Array(n), aS = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection(); if (i % 5 === 0) v.y *= 0.06
    dir.set([v.x, v.y, v.z], i * 3); aB[i] = i % K; aS[i] = 0.4 + Math.random() * Math.random() * 1.6
  }
  g.setAttribute('position', new THREE.BufferAttribute(dir, 3)); g.setAttribute('aB', new THREE.BufferAttribute(aB, 1)); g.setAttribute('aS', new THREE.BufferAttribute(aS, 1))
  const pmat = new THREE.ShaderMaterial({
    uniforms: { ...U, uFade: fade, uBurst: bursts, uPow: power }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `uniform float uTime,uFade,uPR,uTreble; uniform float uBurst[${K}], uPow[${K}]; uniform vec3 uC1,uC2,uC3;
      attribute float aB, aS; varying vec3 vCol; varying float vA;
      void main(){
        int b = int(aB+.5); float age = uTime - uBurst[b], pw = uPow[b];
        float d = 1.6 + (1.0-exp(-age*aS*1.3))*9.0*pw*aS;
        vec3 p = position*d; p += vec3(sin(age*2.+position.y*9.),cos(age*1.7+position.x*7.),0.)*0.12*age;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        float life = exp(-age*0.55)*step(0.,age);
        gl_PointSize = (1.0+aS) * uPR * 10.0 / -mv.z * (0.6+life);
        vCol = mix(mix(vec3(1.,.9,.7)*1.6, uC2, smoothstep(0.,1.2,age)), uC1, smoothstep(1.,4.,age));
        vCol = mix(vCol, uC3, step(.9,fract(aS*37.))*uTreble);
        vA = life*uFade*0.8;
      }`,
    fragmentShader: POINT_FRAG,
  })
  const pts = new THREE.Points(g, pmat); pts.frustumCulled = false
  const group = new THREE.Group(); group.add(star, pts)
  let slot = 0, last = 0
  const fire = (s: number) => { bursts.value[slot] = U.uTime.value; power.value[slot] = s; slot = (slot + 1) % K; last = U.uTime.value }
  return {
    name: 'Supernova', key: 'supernova', group, fade, orbit: { dist: 15, height: 4, speed: 0.06 },
    update: (dt, b) => {
      const t = U.uTime.value
      if ((b.beat && t - last > 0.3) || t - last > 2.2) fire(0.55 + Math.min(1.2, b.bass + b.drop * 0.8))
      star.scale.setScalar(1 + b.bass * 0.25 + b.beatPulse * 0.15); star.rotation.y += dt * 0.1
    },
  }
}
