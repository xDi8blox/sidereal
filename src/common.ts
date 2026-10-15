import * as THREE from 'three'
import type { Bands } from './audio'

export const PALETTES: Record<string, [string, string, string]> = {
  Cosmic: ['#6a5cff', '#ff4fd8', '#3fe0ff'],
  Solar: ['#ff6a1a', '#ffd36b', '#ff3d6e'],
  Aurora: ['#2dffb0', '#3fa9ff', '#b46bff'],
  Ember: ['#ff2e4d', '#ff9f43', '#7a2cff'],
  Ice: ['#cfe8ff', '#5aa9ff', '#8d7dff'],
}
export type Quality = 'low' | 'medium' | 'high'
export interface Ctx { quality: Quality; particles: number; camera: THREE.PerspectiveCamera; pixelRatio: number }

/** Uniforms shared by every scene (one object, referenced by all materials). */
export const U = {
  uTime: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 }, uTreble: { value: 0 }, uBeat: { value: 0 }, uDrop: { value: 0 },
  uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() },
  uPR: { value: 1 }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
}
export function setPalette(name: string) {
  const p = PALETTES[name] ?? PALETTES.Cosmic
  U.uC1.value.set(p[0]); U.uC2.value.set(p[1]); U.uC3.value.set(p[2])
}

export interface Viz {
  name: string; key: string; group: THREE.Object3D; fade: { value: number }
  orbit: { dist: number; height: number; speed: number }
  update(dt: number, b: Bands, ctx: Ctx): void
  rebuild?(ctx: Ctx): void
}

export const NOISE = /* glsl */ `
float hash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
vec3 stars(vec3 d){ vec3 c=vec3(0); for(int i=0;i<2;i++){ vec3 q=d*(180.0+float(i)*220.0); vec3 id=floor(q); float h=hash(id);
  if(h>0.985){ vec3 f=fract(q)-.5; c+=vec3(.8,.85,1.)*smoothstep(.12,.0,length(f))*(h-.985)*60.0; } } return c; }
`
/** Fullscreen quad whose fragment shader receives a world-space view ray (for raymarched scenes). */
export function rayQuad(frag: string, extra: Record<string, THREE.IUniform> = {}) {
  const fade = { value: 0 }
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uFade: fade, ...extra }, depthWrite: false, depthTest: false, transparent: true, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader: `uniform float uTime,uBass,uMid,uTreble,uBeat,uDrop,uFade; uniform vec3 uC1,uC2,uC3; uniform mat4 uInvProj,uCamWorld; varying vec2 vUv;
      ${NOISE}
      vec3 viewRay(){ vec4 v=uInvProj*vec4(vUv*2.-1.,1.,1.); return normalize((uCamWorld*vec4(v.xyz/v.w,0.)).xyz); }
      ${frag}`,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  mesh.frustumCulled = false; mesh.renderOrder = -1
  return { mesh, mat, fade }
}
export const POINT_FRAG = /* glsl */ `varying vec3 vCol; varying float vA; void main(){ vec2 c=gl_PointCoord-.5; float d=length(c); float a=smoothstep(.5,.0,d); a*=a; gl_FragColor=vec4(vCol*a*vA,1.); }`
