import {
  AdditiveBlending, CanvasTexture, Color, DoubleSide, MeshBasicMaterial, MeshDepthMaterial, MeshStandardMaterial, RepeatWrapping,
  ShaderMaterial, SRGBColorSpace, type InstancedMesh, type Mesh, type SkinnedMesh, type Texture,
} from 'three';
import { mulberry32 } from '../sim/rng.ts';
import type { Atlas } from './atlas.ts';

// Shared materials. A handful of materials cover the whole city so each block is a few draw calls.

export const sharedUniforms = {
  uTime: { value: 0 },
  uWindowGlow: { value: 1.0 },
};

const depthMaterials = new Map<string, MeshDepthMaterial>();

/**
 * Turns on shadows for a mesh. three.js draws every caster in the shadow pass with one shared depth
 * material, so a mix of plain, instanced and skinned casters makes it re-pick a shader over and over.
 * Instanced and skinned casters get a depth material of their own kind. Call it after any instance colors are set.
 */
export function castsShadow<T extends Mesh>(mesh: T): T {
  mesh.castShadow = true;
  const instanced = mesh as unknown as InstancedMesh;
  const kind = (mesh as unknown as SkinnedMesh).isSkinnedMesh
    ? 'skinned'
    : instanced.isInstancedMesh
      ? `instanced${instanced.instanceColor ? '+color' : ''}`
      : null;
  if (!kind) return mesh;
  let depth = depthMaterials.get(kind);
  if (!depth) depthMaterials.set(kind, (depth = new MeshDepthMaterial()));
  mesh.customDepthMaterial = depth;
  return mesh;
}

/** Low-poly props, vehicles, people: flat-shaded with baked vertex colors. */
export function toyMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 });
}

/** Things that give off light: bulbs, globes, headlights, signals. Unlit, bloom-bright. */
export function glowMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: true });
}

/** Painted words and signs from the atlas. */
export function signMaterial(atlas: Atlas): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map: atlas.texture,
    emissiveMap: atlas.texture,
    emissive: new Color(0.42, 0.42, 0.42),
    roughness: 0.7,
    transparent: true,
    alphaTest: 0.35,
    side: DoubleSide,
    // Signs are flat, so their back never overlaps their front: one pass, not three.js's default of
    // drawing transparent two-sided meshes twice (and re-picking the shader for each half).
    forceSinglePass: true,
    vertexColors: true,
  });
}

/** Soft additive glow sprites (lamp halos, headlight cones). */
export function haloMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.55 });
}

const FACADE_GLSL = /* glsl */ `
uniform float uWindowGlow;
varying vec2 vFacadeUv;
varying vec4 vFacade;
varying vec3 vFacadeWorld;
varying vec3 vFacadeNormal;
float fhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// bump from a procedural height (meters), via screen-space derivatives
vec3 facadePerturb(vec3 surfPos, vec3 surfNorm, float h, float fd) {
  vec2 dh = vec2(dFdx(h), dFdy(h));
  vec3 sx = dFdx(surfPos);
  vec3 sy = dFdy(surfPos);
  vec3 r1 = cross(sy, surfNorm);
  vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * fd;
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}

// Interior mapping: the room behind a window opening of 'size' meters, 'depth' deep, seen along v
// (v in window space: x along the facade, y up, z into the building). Returns its color.
vec3 room(vec2 local, vec2 size, float depth, vec3 v, float lit, float seed, float shop) {
  vec3 o = vec3(local, 0.0);
  float tx = v.x > 0.0 ? (size.x - o.x) / v.x : o.x / max(-v.x, 1e-4);
  float ty = v.y > 0.0 ? (size.y - o.y) / v.y : o.y / max(-v.y, 1e-4);
  float tz = depth / max(v.z, 1e-4);
  float t = min(tz, min(tx, ty));
  vec3 hp = o + v * t;
  vec3 warm = mix(vec3(1.0, 0.74, 0.46), vec3(1.0, 0.92, 0.76), fhash(vec2(seed, 7.0)));
  vec3 cool = mix(vec3(0.82, 0.9, 1.0), vec3(1.0, 0.95, 0.85), fhash(vec2(seed, 9.0)));
  vec3 light = mix(warm, cool, step(0.7, fhash(vec2(seed, 2.0))) * (1.0 - shop));
  vec3 base = mix(vec3(0.035, 0.04, 0.055), light, lit);
  float z = clamp(hp.z / depth, 0.0, 1.0);
  vec3 col;
  if (t == tz) {
    col = base * 0.85;
    if (shop > 0.5) {
      // the counter and the menu board
      col *= 1.0 - 0.55 * step(hp.y, size.y * 0.3);
      col = mix(col, vec3(0.15, 0.1, 0.08) + light * 0.3, step(abs(hp.x - size.x * 0.5), size.x * 0.3) * step(abs(hp.y - size.y * 0.72), size.y * 0.1));
    } else {
      float desk = step(hp.y, size.y * 0.3) * step(size.x * 0.15, hp.x) * step(hp.x, size.x * 0.75);
      col *= 1.0 - 0.5 * desk;
      float art = step(abs(hp.x - size.x * (0.3 + 0.4 * fhash(vec2(seed, 4.0)))), size.x * 0.13) * step(abs(hp.y - size.y * 0.62), size.y * 0.11);
      col = mix(col, col * vec3(0.55, 0.7, 1.0) + 0.02, art * 0.7);
    }
  } else if (t == ty) {
    col = v.y > 0.0 ? base * (1.0 + 0.6 * lit) : base * vec3(0.42, 0.34, 0.28);
  } else {
    col = base * mix(0.62, 0.3, shop);
    if (shop > 0.5) {
      // shelves stocked with colorful stuff along the side walls
      float shelf = step(0.88, fract(hp.y * 2.6));
      float goods = step(0.35, fract(hp.z * 7.0 + floor(hp.y * 2.6) * 0.37)) * (1.0 - shelf) * step(hp.y, size.y * 0.78) * step(0.15, fract(hp.y * 2.6));
      vec3 hue = 0.5 + 0.4 * cos(6.2831 * (fhash(vec2(floor(hp.z * 7.0), floor(hp.y * 2.6))) + vec3(0.0, 0.33, 0.67)));
      col = mix(col, col * mix(vec3(1.0), hue, 0.45), goods * 0.3);
      col *= 1.0 - 0.45 * shelf;
    }
  }
  return col * mix(1.0, 0.55, z);
}
`;

/**
 * Building facades, fully procedural (no textures). Per-vertex:
 *  facadeUv = (meters along the facade, meters above the sidewalk)
 *  facade   = (style, seed, lit fraction, storefront height)
 * Styles: 0 pre-war brick, 1 limestone, 2 glass curtain wall, 3 ribbon windows, 4 roof/blank, 5 Penn glass.
 * Windows are recessed (bump), glass reflects the sky (low roughness + environment), and behind each pane
 * is a little 3D room (interior mapping). `detail` off = the cheap version for the Low tier.
 */
export function facadeMaterial(detail = true): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  if (detail) mat.defines = { FACADE_DETAIL: '' };
  mat.onBeforeCompile = shader => {
    shader.uniforms.uWindowGlow = sharedUniforms.uWindowGlow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 facadeUv;\nattribute vec4 facade;\nvarying vec2 vFacadeUv;\nvarying vec4 vFacade;\nvarying vec3 vFacadeWorld;\nvarying vec3 vFacadeNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFacadeUv = facadeUv;\nvFacade = facade;\nvFacadeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvFacadeNormal = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FACADE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        vec3 facadeEmissive = vec3(0.0);
        float facadeH = 0.0;
        float facadeRough = 0.9;
        {
          vec3 wall = diffuseColor.rgb;
          float style = vFacade.x;
          float seed = vFacade.y;
          float litFrac = vFacade.z;
          float gf = vFacade.w;
          vec2 p = vFacadeUv;
          vec3 N = normalize(vFacadeNormal);
          vec3 T = normalize(dFdx(vFacadeWorld) * dFdy(p.y) - dFdy(vFacadeWorld) * dFdx(p.y));
          vec3 Vw = normalize(vFacadeWorld - cameraPosition);
          vec3 v = vec3(dot(Vw, T), Vw.y, -dot(Vw, N));
          float near = 1.0 - smoothstep(0.015, 0.06, fwidth(p.x));
          // soft grime toward the sidewalk and a little sun-fade up high
          wall *= mix(0.72, 1.0, smoothstep(0.0, 4.0, p.y)) * mix(1.0, 1.06, smoothstep(10.0, 60.0, p.y));
          vec3 col = wall;
          if (style > 3.5 && style < 4.5) {
            col = wall;
          } else if (p.y < gf) {
            // storefront: recessed panes onto deep, lit shops; sign band above
            float bay = 2.9;
            float bi = floor(p.x / bay);
            vec2 cell = vec2(fract(p.x / bay) * bay, p.y);
            vec2 lo = vec2(0.18, 0.45);
            vec2 hi = vec2(bay - 0.18, gf - 1.0);
            float pane = step(lo.x, cell.x) * step(cell.x, hi.x) * step(lo.y, cell.y) * step(cell.y, hi.y);
            float shopSeed = seed * 13.0 + bi;
            vec3 inside = room(cell - lo, hi - lo, 6.0, v, 0.8 + 0.2 * fhash(vec2(shopSeed, 1.0)), shopSeed, 1.0);
            float mull = step(abs(cell.x - bay * 0.5), 0.03) * step(fhash(vec2(bi, seed)), 0.5);
            float band = step(gf - 1.0, p.y) * step(p.y, gf - 0.12);
            col = mix(wall * 0.55, vec3(0.03), pane);
            col = mix(col, vec3(0.12, 0.12, 0.13), mull * pane);
            col = mix(col, wall * 0.3 + vec3(0.02), band);
            float F = 0.04 + 0.96 * pow(1.0 - clamp(v.z, 0.0, 1.0), 3.0);
            facadeEmissive = inside * pane * (1.0 - mull) * (1.0 - F) * 0.5;
            facadeRough = mix(0.85, 0.06, pane);
            facadeH = -0.12 * pane + 0.03 * band;
          } else {
            float fh = style > 4.5 ? 4.6 : style > 2.5 ? 3.6 : 3.4;
            float fy = (p.y - gf) / fh;
            float fi = floor(fy);
            float ly = fract(fy);
            float bw = style < 0.5 ? 2.5 : style < 1.5 ? 3.0 : style < 2.5 ? 1.55 : style < 3.5 ? 2.2 : 3.2;
            float bi = floor(p.x / bw);
            float lx = fract(p.x / bw);
            vec2 wlo = style < 0.5 ? vec2(0.24, 0.24) : style < 1.5 ? vec2(0.27, 0.16) : style < 2.5 ? vec2(0.05, 0.06) : style < 3.5 ? vec2(0.02, 0.34) : vec2(0.04, 0.05);
            vec2 whi = style < 0.5 ? vec2(0.76, 0.8) : style < 1.5 ? vec2(0.73, 0.84) : style < 2.5 ? vec2(0.95, 0.97) : style < 3.5 ? vec2(0.98, 0.86) : vec2(0.96, 0.95);
            float win = step(wlo.x, lx) * step(lx, whi.x) * step(wlo.y, ly) * step(ly, whi.y);
            float h = fhash(vec2(bi + seed * 61.0, fi + seed * 13.0));
            float lit = step(h, litFrac);
            #ifdef FACADE_DETAIL
              // masonry: running-bond brick or rusticated stone, fading out with distance
              if (style < 0.5) {
                float row = floor(p.y / 0.075);
                float bx = p.x / 0.23 + 0.5 * mod(row, 2.0);
                float mortar = max(step(fract(p.y / 0.075), 0.16), step(fract(bx), 0.06));
                vec3 brick = wall * (0.86 + 0.24 * fhash(vec2(floor(bx), row)));
                col = mix(wall, mix(brick, wall * 1.35 + 0.05, mortar), near);
                facadeH -= 0.006 * mortar * near;
              } else if (style < 1.5) {
                float course = step(fract(p.y / 0.62), 0.05) + step(fract(p.x / 1.24 + 0.5 * mod(floor(p.y / 0.62), 2.0)), 0.025) * 0.6;
                col = wall * (1.0 - 0.18 * course * near) * (0.95 + 0.08 * fhash(vec2(floor(p.x / 1.24), floor(p.y / 0.62))));
                facadeH -= 0.01 * course * near;
              }
            #endif
            vec2 wsize = vec2((whi.x - wlo.x) * bw, (whi.y - wlo.y) * fh);
            vec2 local = vec2((lx - wlo.x) * bw, (ly - wlo.y) * fh);
            float F = 0.04 + 0.96 * pow(1.0 - clamp(v.z, 0.0, 1.0), 5.0);
            vec3 warm = mix(vec3(1.0, 0.74, 0.42), vec3(1.0, 0.9, 0.7), fract(h * 7.0));
            #ifdef FACADE_DETAIL
              vec3 inside = room(local, wsize, 3.6, v, lit, h * 97.0 + seed, 0.0);
            #else
              vec3 inside = mix(vec3(0.03, 0.035, 0.05), warm * 0.8, lit);
            #endif
            // frames, sills and lintels; glass curtain walls get spandrel panels at each slab
            float frame = win * (1.0 - step(wlo.x + 0.035 / bw, lx) * step(lx, whi.x - 0.035 / bw) * step(wlo.y + 0.035 / fh, ly) * step(ly, whi.y - 0.035 / fh));
            float sill = (1.0 - win) * step(style, 1.5) * step(wlo.y - 0.06, ly) * step(ly, wlo.y) * step(wlo.x - 0.03, lx) * step(lx, whi.x + 0.03);
            float lintel = (1.0 - win) * step(style, 1.5) * step(whi.y, ly) * step(ly, whi.y + 0.05) * step(wlo.x - 0.03, lx) * step(lx, whi.x + 0.03);
            float spandrel = step(1.5, style) * step(style, 2.5) * (1.0 - win);
            float glass = win * (1.0 - frame);
            col = mix(col, wall * 1.2 + 0.05, (sill + lintel) * 0.85);
            col = mix(col, vec3(0.08, 0.1, 0.13), spandrel);
            col = mix(col, vec3(0.13, 0.13, 0.14), frame);
            col = mix(col, vec3(0.02), glass);
            facadeEmissive = inside * glass * (1.0 - F) * mix(0.35, 1.0, lit) * uWindowGlow;
            facadeRough = mix(mix(0.9, 0.3, spandrel), 0.05, glass);
            facadeH += -0.1 * win + 0.04 * frame + 0.05 * (sill + lintel);
            col *= 1.0 - 0.1 * step(ly, 0.04) * (1.0 - win) * step(style, 1.5);
          }
          facadeH *= near;
          diffuseColor.rgb = col;
        }`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = facadeRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n#ifdef FACADE_DETAIL\nnormal = facadePerturb(-vViewPosition, normal, facadeH, faceDirection);\n#endif')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += facadeEmissive;');
  };
  mat.customProgramCacheKey = () => `facade-${detail ? 'detail' : 'simple'}`;
  return mat;
}

/** Times Square screens: animated, emissive, brand-free abstract content. */
export function billboardMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: sharedUniforms.uTime },
    vertexShader: /* glsl */ `
      attribute vec2 bbUv;
      attribute vec4 bb;
      varying vec2 vUv;
      varying vec4 vBB;
      varying float vFog;
      void main() {
        vUv = bbUv;
        vBB = bb;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFog = smoothstep(120.0, 330.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec4 vBB;
      varying float vFog;
      vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        float style = vBB.x;
        float h0 = vBB.y;
        float t = uTime + vBB.z * 10.0;
        float aspect = vBB.w;
        vec2 uv = vUv;
        vec2 q = vec2(uv.x * aspect, uv.y);
        vec3 a = hue(h0) * 0.9 + 0.1;
        vec3 b = hue(fract(h0 + 0.45)) * 0.9 + 0.1;
        vec3 col;
        float scene = floor(mod(t / 4.0, 3.0));
        if (style < 0.5) {
          // color field with big drifting shapes, switching scenes every few seconds
          col = mix(a, b, smoothstep(0.2, 0.8, uv.y + 0.15 * sin(t * 0.7 + uv.x * 3.0)));
          vec2 c = vec2(fract(t * 0.07 + scene * 0.31) * (aspect + 1.0) - 0.5, 0.5 + 0.2 * sin(t));
          float d = length(q - c);
          col = mix(col, vec3(1.0), smoothstep(0.42, 0.38, d) * 0.85);
          col = mix(col, b * 0.3, smoothstep(0.25, 0.22, d));
        } else if (style < 1.5) {
          // scrolling bands with a fake headline bar
          float band = step(0.5, fract(uv.y * 3.0 + t * 0.35));
          col = mix(a, a * 0.55, band);
          float bar = step(0.62, uv.y) * step(uv.y, 0.82);
          float glyph = step(0.35, fract((q.x - t * 0.8) * 2.2)) * step(fract((q.x - t * 0.8) * 0.37), 0.8);
          col = mix(col, vec3(1.0), bar * glyph);
          col = mix(col, b, step(uv.y, 0.12));
        } else if (style < 2.5) {
          // big pulsing geometric mark on black
          vec2 c = q - vec2(aspect * 0.5, 0.5);
          float r = length(c);
          float ang = atan(c.y, c.x);
          float star = 0.3 + 0.08 * sin(ang * 5.0 + t * 1.5);
          col = vec3(0.04);
          col = mix(col, a, smoothstep(star + 0.02, star, r));
          col = mix(col, b, smoothstep(0.14, 0.12, r) * (0.5 + 0.5 * sin(t * 3.0)));
          col += hue(fract(h0 + uv.x * 0.3 + t * 0.05)) * 0.25 * step(0.9, uv.y);
        } else {
          // LED news ticker: dotted glyph blocks sliding left
          vec2 cell = floor(vec2(q.x * 26.0, uv.y * 7.0));
          vec2 f = fract(vec2(q.x * 26.0, uv.y * 7.0));
          float dot = smoothstep(0.5, 0.3, length(f - 0.5));
          float x = cell.x + floor(t * 9.0);
          float on = step(0.45, hash(floor(x / 5.0) * 7.0 + cell.y * 1.7 + floor(x) * 0.13)) * step(1.0, cell.y) * step(cell.y, 5.0);
          on *= step(fract(x / 5.0), 0.79);
          col = mix(vec3(0.03, 0.02, 0.02), mix(vec3(1.0, 0.55, 0.1), a, 0.3), on * dot);
        }
        // a thin frame
        float edge = step(0.02, uv.x) * step(uv.x, 0.98) * step(0.03, uv.y) * step(uv.y, 0.97);
        col = mix(vec3(0.05), col, edge);
        col = mix(col * 1.15, vec3(0.93, 0.80, 0.66), vFog * 0.8);
        gl_FragColor = vec4(col, 1.0);
      }`,
    toneMapped: false,
  });
}

function canvasTexture(size: number, paint: (c: CanvasRenderingContext2D, s: number) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paint(canvas.getContext('2d')!, size);
  const t = new CanvasTexture(canvas);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function speckle(c: CanvasRenderingContext2D, s: number, n: number, seed: number, alpha: number, light: boolean) {
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0;
    c.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`;
    c.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2);
  }
}

/** Paints a texture the first time it's asked for and hands back the same one every run after. */
function once(make: () => Texture): () => Texture {
  let texture: Texture | null = null;
  return () => (texture ??= make());
}

/** Concrete sidewalk: one texture tile = 3.2 m square = 2×2 slabs. The seams make speed readable. */
export const sidewalkTexture = once(() =>
  canvasTexture(512, (c, s) => {
    c.fillStyle = '#c9c1b4';
    c.fillRect(0, 0, s, s);
    const r = mulberry32(5);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const k = 0.94 + r() * 0.1;
        c.fillStyle = `rgba(${Math.round(201 * k)},${Math.round(193 * k)},${Math.round(180 * k)},1)`;
        c.fillRect((i * s) / 2, (j * s) / 2, s / 2, s / 2);
      }
    }
    speckle(c, s, 9000, 11, 0.12, false);
    speckle(c, s, 4000, 12, 0.15, true);
    // gum spots, the most NYC detail there is
    for (let i = 0; i < 14; i++) {
      c.fillStyle = 'rgba(70,66,62,.35)';
      c.beginPath();
      c.arc(r() * s, r() * s, 2 + r() * 3, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = 'rgba(70,64,56,.75)';
    for (const p of [0, s / 2]) {
      c.fillRect(p, 0, 3, s);
      c.fillRect(0, p, s, 3);
    }
  }),
);

/** Asphalt: one tile = 8 m. */
export const asphaltTexture = once(() =>
  canvasTexture(256, (c, s) => {
    c.fillStyle = '#55565c';
    c.fillRect(0, 0, s, s);
    speckle(c, s, 6000, 21, 0.22, false);
    speckle(c, s, 2500, 22, 0.14, true);
    const r = mulberry32(23);
    c.strokeStyle = 'rgba(30,30,34,.35)';
    c.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(r() * s, r() * s);
      c.lineTo(r() * s, r() * s);
      c.stroke();
    }
  }),
);

export function groundMaterial(map: Texture): MeshStandardMaterial {
  return new MeshStandardMaterial({ map, roughness: 0.95, metalness: 0, vertexColors: true });
}
