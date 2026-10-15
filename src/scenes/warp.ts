import * as THREE from 'three'
import { U } from '../common'
import type { Ctx, Viz } from '../common'

/** Hyperspace: line-segment stars streaming past the camera; speed and streak length follow energy and drops. */
export function warp(ctx: Ctx): Viz {
  const n = { low: 6000, medium: 14000, high: 24000 }[ctx.quality]
  const fade = { value: 0 }, travel = { value: 0 }, stretch = { value: 0 }
  const g = new THREE.BufferGeometry()
  const seed = new Float32Array(n * 6), tail = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = 1.6 + Math.pow(Math.random(), 0.7) * 16, z = Math.random()
    for (let k = 0; k < 2; k++) { seed.set([Math.cos(a) * r, Math.sin(a) * r, z], (i * 2 + k) * 3); tail[i * 2 + k] = k }
  }
  g.setAttribute('position', new THREE.BufferAttribute(seed, 3))
  g.setAttribute('aTail', new THREE.BufferAttribute(tail, 1))
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uFade: fade, uTravel: travel, uStretch: stretch }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `uniform float uTravel,uStretch,uFade,uTreble,uBeat,uTime; uniform vec3 uC1,uC2,uC3; attribute float aTail; varying vec3 vCol;
      void main(){
        float L = 120.0; float z = -mod(position.z*L + uTravel, L);
        float swirl = uTime*0.05 + z*0.004;
        vec2 xy = mat2(cos(swirl),-sin(swirl),sin(swirl),cos(swirl))*position.xy;
        vec3 p = vec3(xy, z - aTail*uStretch*(0.6+fract(position.z*13.)*0.8));
        gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.);
        float near = smoothstep(-L, -8.0, z); near *= near;
        vec3 c = mix(uC3, uC1, fract(position.z*7.3)); c = mix(vec3(1.), c, 0.55 + 0.3*aTail);
        vCol = c * near * (1.0-aTail*0.85) * (0.6+uBeat*0.8+uTreble*0.6) * uFade * (0.35+uStretch*0.04) * 0.22;
      }`,
    fragmentShader: 'varying vec3 vCol; void main(){ gl_FragColor=vec4(vCol,1.); }',
  })
  const lines = new THREE.LineSegments(g, mat); lines.frustumCulled = false
  const group = new THREE.Group(); group.add(lines)
  let speed = 10
  return {
    name: 'Hyperspace', key: 'warp', group, fade, orbit: { dist: 6, height: 0, speed: 0 },
    update: (dt, b, c) => {
      const target = 12 + b.level * 70 + b.drop * 160 + b.beatPulse * 40
      speed += (target - speed) * (1 - Math.exp(-dt * 3))
      travel.value += speed * dt; stretch.value = speed * 0.09
      group.position.copy(c.camera.position); group.quaternion.copy(c.camera.quaternion)
      group.rotateZ(Math.sin(performance.now() * 0.0002) * 0.2)
    },
  }
}
