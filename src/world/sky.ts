import {
  BackSide, CanvasTexture, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RepeatWrapping,
  ShaderMaterial, SphereGeometry, SRGBColorSpace, type Vector3,
} from 'three';
import { mulberry32 } from '../sim/rng.ts';

// Golden-hour sky that travels with the camera: gradient + soft clouds, a hazy skyline band all around,
// and the Empire State Building ahead and to the left (it's at 34th & 5th), growing as you get closer.

export const HAZE = new Color('#efcba4');

export class Sky {
  readonly group = new Group();
  private readonly esb: Mesh;

  constructor(sunDir: Vector3) {
    const dome = new Mesh(
      new SphereGeometry(700, 32, 16),
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uSun: { value: sunDir.clone().normalize() } },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uSun;
          varying vec3 vDir;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
          }
          float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
          void main() {
            float h = vDir.y;
            vec3 zenith = vec3(0.24, 0.45, 0.78);
            vec3 mid = vec3(0.62, 0.74, 0.88);
            vec3 low = vec3(0.98, 0.83, 0.64);
            vec3 horizon = vec3(1.0, 0.76, 0.52);
            vec3 col = mix(horizon, low, smoothstep(-0.02, 0.06, h));
            col = mix(col, mid, smoothstep(0.06, 0.3, h));
            col = mix(col, zenith, smoothstep(0.3, 0.85, h));
            float sun = max(dot(vDir, normalize(uSun)), 0.0);
            col += vec3(1.0, 0.62, 0.3) * pow(sun, 6.0) * 0.35;
            // soft clouds drifting in a band above the skyline
            vec2 cp = vDir.xz / max(h + 0.25, 0.05) * 1.6;
            float c = smoothstep(0.52, 0.8, fbm(cp + vec2(3.0, 1.0)));
            float band = smoothstep(0.04, 0.16, h) * (1.0 - smoothstep(0.35, 0.7, h));
            vec3 cloudCol = mix(vec3(1.0, 0.88, 0.76), vec3(1.0, 0.97, 0.93), smoothstep(0.1, 0.4, h));
            col = mix(col, cloudCol, c * band * 0.75);
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    );
    dome.renderOrder = -10;
    this.group.add(dome);

    this.group.add(this.skyline(470, 54, 3, '#a9a8b8', 0.9, -14));
    this.group.add(this.skyline(430, 40, 11, '#9d9cad', 0.95, -8));

    this.esb = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: empireTexture(), transparent: true, fog: false, depthWrite: false, toneMapped: false }));
    this.esb.renderOrder = -8;
    this.group.add(this.esb);
  }

  /** Follow the camera; `progress` 0..1 along the route grows the Empire State Building. */
  update(camera: Vector3, progress: number): void {
    this.group.position.copy(camera);
    const bearing = (-14 + 6 * progress) * (Math.PI / 180);
    const dist = 420;
    const h = 120 + 70 * progress;
    this.esb.scale.set(h * 0.42, h, 1);
    this.esb.position.set(Math.sin(bearing) * dist, h / 2 - 16, -Math.cos(bearing) * dist);
    this.esb.rotation.y = -bearing;
  }

  private skyline(radius: number, height: number, seed: number, color: string, alpha: number, y: number): Mesh {
    const w = 2048;
    const hgt = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = hgt;
    const c = canvas.getContext('2d')!;
    const r = mulberry32(seed);
    c.fillStyle = '#fff';
    let x = 0;
    while (x < w) {
      const bw = 14 + r() * 40;
      const bh = 40 + r() * r() * 200;
      c.fillRect(x, hgt - bh, bw + 1, bh);
      if (r() < 0.3) c.fillRect(x + bw * 0.25, hgt - bh - bh * 0.18, bw * 0.5, bh * 0.18 + 1);
      if (r() < 0.12) c.fillRect(x + bw * 0.45, hgt - bh - bh * 0.4, bw * 0.1, bh * 0.4);
      x += bw;
    }
    const tex = new CanvasTexture(canvas);
    tex.wrapS = RepeatWrapping;
    tex.repeat.set(3, 1);
    tex.colorSpace = SRGBColorSpace;
    const mesh = new Mesh(
      new CylinderGeometry(radius, radius, height, 48, 1, true),
      new MeshBasicMaterial({ map: tex, color, transparent: true, opacity: alpha, side: BackSide, fog: false, depthWrite: false }),
    );
    mesh.position.y = y + height / 2;
    mesh.renderOrder = -9;
    return mesh;
  }
}

/**
 * What the street "sees" for reflections: the golden sky above, a ring of building walls with lit
 * windows around the horizon, and pavement below. Used only to bake the environment map.
 */
export function canyonEnvironment(sunDir: Vector3): Group {
  const g = new Sky(sunDir).group;
  const w = 1024;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d')!;
  const r = mulberry32(17);
  let x = 0;
  while (x < w) {
    const bw = 40 + r() * 70;
    const top = h * (0.05 + r() * 0.35);
    const tone = ['#6e5a4c', '#8a7a68', '#5d6470', '#7a6a5a', '#9a8a74'][Math.floor(r() * 5)];
    c.fillStyle = tone;
    c.fillRect(x, top, bw + 1, h - top);
    for (let wy = top + 8; wy < h - 30; wy += 14) {
      for (let wx = x + 5; wx < x + bw - 6; wx += 11) {
        c.fillStyle = r() < 0.25 ? 'rgba(255,214,150,.9)' : 'rgba(40,48,62,.85)';
        c.fillRect(wx, wy, 6, 8);
      }
    }
    x += bw;
  }
  c.fillStyle = '#3a3633';
  c.fillRect(0, h - 26, w, 26);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.colorSpace = SRGBColorSpace;
  const walls = new Mesh(new CylinderGeometry(120, 120, 150, 32, 1, true), new MeshBasicMaterial({ map: tex, side: BackSide, transparent: true, fog: false }));
  walls.position.y = 40;
  const ground = new Mesh(new CylinderGeometry(120, 120, 1, 32), new MeshBasicMaterial({ color: '#5a5650', fog: false }));
  ground.position.y = -36;
  g.add(walls, ground);
  return g;
}

function empireTexture(): CanvasTexture {
  const w = 128;
  const h = 300;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d')!;
  const cx = w / 2;
  const tier = (bw: number, y0: number, y1: number) => c.fillRect(cx - bw / 2, y0, bw, y1 - y0);
  c.fillStyle = 'rgba(132,138,160,0.92)';
  tier(116, 150, h);
  tier(84, 108, 152);
  tier(60, 82, 110);
  tier(44, 64, 84);
  tier(30, 52, 66);
  tier(18, 36, 54);
  tier(8, 6, 38);
  // the lit crown at golden hour
  c.fillStyle = 'rgba(255,214,150,0.95)';
  tier(30, 54, 58);
  tier(18, 40, 44);
  c.fillStyle = 'rgba(255,255,240,1)';
  tier(3, 0, 8);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  return t;
}
