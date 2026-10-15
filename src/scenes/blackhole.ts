import * as THREE from 'three'
import { rayQuad } from '../common'
import type { Ctx, Viz } from '../common'

export function blackhole(ctx: Ctx): Viz {
  const steps = { low: 90, medium: 140, high: 200 }[ctx.quality]
  const { mesh, fade } = rayQuad(/* glsl */ `
    vec3 disk(vec3 p, out float a){
      float r = length(p.xz);
      float ang = atan(p.z,p.x);
      float rot = uTime*(1.4/ (r*0.4));
      float n = fbm(vec3(cos(ang-rot)*r*1.3, sin(ang-rot)*r*1.3, r*0.6));
      float band = smoothstep(2.4,3.0,r)*smoothstep(9.5,4.0,r);
      float bright = band*(0.4+1.2*n)*(1.0+uBass*1.6+uBeat*0.6) / (r*0.35);
      float dop = 1.0 + 0.55*sin(ang);                      // relativistic beaming (approaching side brighter)
      vec3 hot = mix(vec3(1.,.95,.85), uC2, smoothstep(3.,7.5,r));
      a = clamp(bright*0.9,0.,1.);
      return mix(hot, uC1, smoothstep(5.,9.,r)) * bright * dop * 1.8;
    }
    void main(){
      vec3 rd = viewRay(), p = cameraPosition, col = vec3(0); float T = 1.0;
      float dt = 0.12;
      for(int i=0;i<${steps};i++){
        float r = length(p);
        if(r<1.0){ T=0.; break; }
        vec3 acc = -p/(r*r*r)*1.6;                              // bend the ray toward the singularity
        vec3 np = p + rd*dt; rd = normalize(rd + acc*dt);
        if(p.y*np.y<0.){ vec3 hp = mix(p,np, p.y/(p.y-np.y)); float a; vec3 c = disk(hp,a); col += T*c; T*=1.0-a; }
        p = np; dt = clamp(r*0.06, 0.04, 0.6);
        if(r>40.0) break;
      }
      vec3 bg = stars(rd) + mix(uC1,uC3,.5)*pow(max(0.,1.-abs(rd.y*3.)),6.)*0.05;
      col += T*bg;
      float ring = exp(-pow((length(cross(normalize(-cameraPosition), viewRay()))*length(cameraPosition)-2.6)*3.5,2.));
      col += uC3*ring*0.0*uBeat;
      gl_FragColor = vec4(col*uFade,1.);
    }`)
  const group = new THREE.Group(); group.add(mesh)
  return { name: 'Black Hole', key: 'blackhole', group, fade, orbit: { dist: 16, height: 1.4, speed: 0.035 }, update: () => {} }
}
