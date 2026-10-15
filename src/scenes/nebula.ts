import * as THREE from 'three'
import { rayQuad } from '../common'
import type { Ctx, Viz } from '../common'

export function nebula(ctx: Ctx): Viz {
  const steps = { low: 28, medium: 44, high: 64 }[ctx.quality]
  const { mesh, fade } = rayQuad(/* glsl */ `
    float dens(vec3 p){
      float t=uTime*0.04;
      vec3 q = p*0.22 + vec3(t, -t*0.6, t*0.3);
      float f = fbm(q + fbm(q*1.7 + uMid*0.6)*1.6);
      float shell = smoothstep(9.0, 2.0, length(p*vec3(1.,1.4,1.)));
      return max(0., f - 0.52 + uMid*0.12) * shell * 1.6;
    }
    void main(){
      vec3 ro = cameraPosition, rd = viewRay();
      vec3 col = stars(rd)*0.7; float T=1.0;
      float b = dot(ro,rd), c = dot(ro,ro)-81.0, h = b*b-c;
      if(h>0.){ h=sqrt(h); float t0=max(0.,-b-h), t1=-b+h; float st=(t1-t0)/${steps}.0;
        float t = t0 + st*hash(vec3(gl_FragCoord.xy, uTime));
        for(int i=0;i<${steps};i++){
          vec3 p = ro+rd*t; float d = dens(p);
          if(d>0.002){
            float hue = fbm(p*0.15+3.0);
            vec3 e = mix(mix(uC1,uC2,smoothstep(.3,.7,hue)), uC3, smoothstep(.55,.9,d));
            e *= 0.32 + uMid*0.6 + uBeat*0.15;
            e += vec3(1.,.9,.8)*pow(d,3.0)*uTreble*1.2;
            float a = 1.0-exp(-d*st*0.7);
            col += T*a*e; T *= 1.0-a; if(T<0.03) break;
          }
          t += st;
        }
      }
      float core = exp(-length(cross(rd, -ro))*0.9)*step(0.,dot(rd,-ro));
      col += uC3*core*(0.08+uBass*0.25)*T;
      gl_FragColor = vec4(col*uFade,1.);
    }`)
  const group = new THREE.Group(); group.add(mesh)
  return { name: 'Nebula', key: 'nebula', group, fade, orbit: { dist: 12, height: 2, speed: 0.04 }, update: () => {} }
}
