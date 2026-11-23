import { AdditiveBlending, BufferAttribute, BufferGeometry, NormalBlending, Points, ShaderMaterial, type Blending } from 'three';

// Two particle pools (soft puffs and additive sparkles), each one draw call.

export interface Emit {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  size: number;
  grow?: number;
  color: [number, number, number];
  alpha?: number;
  gravity?: number;
  drag?: number;
}

class Pool {
  readonly points: Points;
  private readonly max: number;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly alpha: Float32Array;
  private readonly size: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly grow: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;
  private readonly baseAlpha: Float32Array;
  private readonly baseSize: Float32Array;
  private cursor = 0;

  constructor(max: number, blending: Blending, soft: boolean) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.baseAlpha = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('color', new BufferAttribute(this.col, 3));
    g.setAttribute('alpha', new BufferAttribute(this.alpha, 1));
    g.setAttribute('size', new BufferAttribute(this.size, 1));
    const mat = new ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute float alpha;
        attribute float size;
        attribute vec3 color;
        uniform float uScale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / max(0.5, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: soft
        ? /* glsl */ `
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.1, d) * vAlpha;
            if (a < 0.01) discard;
            gl_FragColor = vec4(vColor, a);
          }`
        : /* glsl */ `
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vec2 p = gl_PointCoord - 0.5;
            float d = length(p);
            float star = max(smoothstep(0.08, 0.0, abs(p.x)) * smoothstep(0.5, 0.0, abs(p.y)), smoothstep(0.08, 0.0, abs(p.y)) * smoothstep(0.5, 0.0, abs(p.x)));
            float a = (smoothstep(0.5, 0.0, d) * 0.6 + star) * vAlpha;
            gl_FragColor = vec4(vColor * a, a);
          }`,
      transparent: true,
      depthWrite: false,
      blending,
      toneMapped: false,
    });
    this.points = new Points(g, mat);
    this.points.frustumCulled = false;
  }

  setScale(s: number): void {
    (this.points.material as ShaderMaterial).uniforms.uScale.value = s;
  }

  emit(e: Emit): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos.set([e.x, e.y, e.z], i * 3);
    this.vel.set([e.vx ?? 0, e.vy ?? 0, e.vz ?? 0], i * 3);
    this.col.set(e.color, i * 3);
    this.life[i] = this.maxLife[i] = e.life;
    this.baseSize[i] = e.size;
    this.grow[i] = e.grow ?? 0;
    this.gravity[i] = e.gravity ?? 0;
    this.drag[i] = e.drag ?? 0;
    this.baseAlpha[i] = e.alpha ?? 1;
  }

  update(dt: number): void {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const drag = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= drag;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag - this.gravity[i] * dt;
      this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = this.baseAlpha[i] * Math.min(1, k * 2.5) * Math.min(1, (1 - k) * 12 + 0.2);
      this.size[i] = this.baseSize[i] * (1 + this.grow[i] * (1 - k));
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }
}

export class Particles {
  readonly soft = new Pool(600, NormalBlending, true);
  readonly glow = new Pool(300, AdditiveBlending, false);

  setViewport(height: number, fovDeg: number): void {
    const s = height / 2 / Math.tan((fovDeg * Math.PI) / 360);
    this.soft.setScale(s);
    this.glow.setScale(s);
  }

  update(dt: number): void {
    this.soft.update(dt);
    this.glow.update(dt);
  }

  puff(x: number, y: number, z: number, opts: Partial<Emit> = {}): void {
    this.soft.emit({ x, y, z, life: 1.6, size: 0.9, grow: 2.2, color: [1, 1, 1], alpha: 0.5, vy: 1.4, drag: 0.6, ...opts });
  }

  /** A burst of glints; `carry` is a forward velocity to travel with (e.g. Alex's speed). */
  sparkle(x: number, y: number, z: number, color: [number, number, number] = [1, 0.95, 0.7], n = 6, speed = 2.5, carry = 0): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - u * u);
      this.glow.emit({ x, y, z, vx: Math.cos(a) * r * speed, vy: u * speed + 1, vz: Math.sin(a) * r * speed + carry, life: 0.45 + Math.random() * 0.25, size: 0.22 + Math.random() * 0.12, color, drag: carry ? 0 : 2, gravity: 4 });
    }
  }

  dust(x: number, y: number, z: number, vz: number): void {
    this.soft.emit({ x: x + (Math.random() - 0.5) * 0.5, y: y + 0.05, z, vx: (Math.random() - 0.5) * 1.2, vy: 0.6 + Math.random() * 0.6, vz, life: 0.7, size: 0.35, grow: 2.5, color: [0.86, 0.8, 0.7], alpha: 0.45, drag: 2.5 });
  }

  confetti(x: number, y: number, z: number, n = 40): void {
    const colors: [number, number, number][] = [[1, 0.82, 0.25], [1, 0.4, 0.4], [0.4, 0.75, 1], [0.5, 0.9, 0.5], [1, 1, 1]];
    for (let i = 0; i < n; i++) {
      this.glow.emit({ x, y, z, vx: (Math.random() - 0.5) * 6, vy: 4 + Math.random() * 5, vz: (Math.random() - 0.5) * 6, life: 1.6 + Math.random(), size: 0.16, color: colors[i % colors.length], gravity: 7, drag: 1.2 });
    }
  }
}
