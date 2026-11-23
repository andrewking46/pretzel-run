import {
  AdditiveBlending, CanvasTexture, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, RepeatWrapping,
  ShaderMaterial, SRGBColorSpace, type Texture,
} from 'three';
import { mulberry32 } from '../sim/rng.ts';
import type { Atlas } from './atlas.ts';

// Shared materials. A handful of materials cover the whole city so each block is a few draw calls.

export const sharedUniforms = {
  uTime: { value: 0 },
  uWindowGlow: { value: 1.0 },
};

/** Low-poly props, vehicles, people: flat-shaded with baked vertex colors. */
export function toyMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0 });
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
    vertexColors: true,
  });
}

/** Soft additive glow sprites (lamp halos, headlight cones). */
export function haloMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.55 });
}

const FACADE_GLSL = /* glsl */ `
float fhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

/**
 * Building facades with procedural windows. Per-vertex:
 *  facadeUv = (meters along the facade, meters above the sidewalk)
 *  facade   = (style, seed, lit fraction, storefront height)
 * Styles: 0 pre-war brick, 1 limestone, 2 glass curtain wall, 3 ribbon windows, 4 roof/blank, 5 Penn glass.
 */
export function facadeMaterial(): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  mat.onBeforeCompile = shader => {
    shader.uniforms.uWindowGlow = sharedUniforms.uWindowGlow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 facadeUv;\nattribute vec4 facade;\nvarying vec2 vFacadeUv;\nvarying vec4 vFacade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFacadeUv = facadeUv;\nvFacade = facade;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uWindowGlow;\nvarying vec2 vFacadeUv;\nvarying vec4 vFacade;\n${FACADE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        vec3 facadeEmissive = vec3(0.0);
        {
          vec3 wall = diffuseColor.rgb;
          float style = vFacade.x;
          float seed = vFacade.y;
          float litFrac = vFacade.z;
          float gf = vFacade.w;
          vec2 p = vFacadeUv;
          vec3 col = wall;
          if (style > 3.5 && style < 4.5) {
            col = wall;
          } else if (p.y < gf) {
            // storefront: big lit windows between dark mullions, a sign band above
            float bay = 2.9;
            float bi = floor(p.x / bay);
            float bx = fract(p.x / bay);
            float pane = step(0.07, bx) * step(bx, 0.93) * step(0.45, p.y) * step(p.y, gf - 1.0);
            float door = step(fhash(vec2(bi, seed)), 0.3) * step(0.3, bx) * step(bx, 0.7) * step(p.y, gf - 1.0);
            vec3 inside = mix(vec3(1.0, 0.62, 0.32), vec3(0.95, 0.84, 0.6), fhash(vec2(bi * 3.1, seed)));
            float glass = max(pane, door);
            // a lit interior: brighter toward the ceiling, darker shelf bands and shoppers' silhouettes
            float depth = smoothstep(0.4, gf - 1.0, p.y);
            float shelves = step(0.55, fract(p.y * 1.6)) * step(p.y, 2.2) * 0.45;
            float shopper = step(0.75, fhash(vec2(floor(p.x / 0.7), seed + 9.0))) * step(p.y, 1.9) * step(0.6, p.y) * 0.6;
            vec3 room = inside * (0.35 + 0.65 * depth) * (1.0 - shelves) * (1.0 - shopper);
            col = mix(wall * 0.35, room * 0.35, glass);
            col = mix(col, vec3(0.08, 0.07, 0.07), step(gf - 1.0, p.y) * step(p.y, gf - 0.15));
            facadeEmissive = room * glass * (0.32 + 0.2 * fhash(vec2(bi, seed + 4.0)));
          } else {
            float fh = style > 4.5 ? 4.6 : style > 2.5 ? 3.6 : 3.4;
            float fy = (p.y - gf) / fh;
            float fi = floor(fy);
            float ly = fract(fy);
            float bw = style < 0.5 ? 2.5 : style < 1.5 ? 3.0 : style < 2.5 ? 1.55 : style < 3.5 ? 2.2 : 3.2;
            float bi = floor(p.x / bw);
            float lx = fract(p.x / bw);
            float win;
            if (style < 0.5) win = step(0.24, lx) * step(lx, 0.76) * step(0.24, ly) * step(ly, 0.8);
            else if (style < 1.5) win = step(0.27, lx) * step(lx, 0.73) * step(0.16, ly) * step(ly, 0.84);
            else if (style < 2.5) win = step(0.05, lx) * step(lx, 0.95) * step(0.06, ly) * step(ly, 0.97);
            else if (style < 3.5) win = step(0.02, lx) * step(lx, 0.98) * step(0.34, ly) * step(ly, 0.86);
            else win = step(0.04, lx) * step(lx, 0.96) * step(0.05, ly) * step(ly, 0.95);
            float h = fhash(vec2(bi + seed * 61.0, fi + seed * 13.0));
            float lit = step(h, litFrac);
            vec3 sky = mix(vec3(0.28, 0.36, 0.50), vec3(0.62, 0.72, 0.86), clamp(p.y / 90.0, 0.0, 1.0));
            vec3 glassCol = mix(sky * 0.75, sky, fhash(vec2(bi, fi)) * 0.6);
            if (style > 1.5 && style < 2.5) glassCol = mix(vec3(0.35, 0.48, 0.60), vec3(0.75, 0.82, 0.88), clamp(p.y / 70.0 + h * 0.2, 0.0, 1.0));
            vec3 warm = mix(vec3(1.0, 0.74, 0.42), vec3(1.0, 0.9, 0.7), fract(h * 7.0));
            vec3 w = mix(glassCol, warm * 0.75, lit);
            // sills and lintels give brick and limestone some depth
            float sill = (1.0 - win) * step(style, 1.5) * (step(0.18, ly) * step(ly, 0.24) + step(0.8, ly) * step(ly, 0.85)) * step(0.2, lx) * step(lx, 0.8);
            col = mix(wall, w, win);
            col = mix(col, wall * 1.25 + 0.06, sill * 0.8);
            col *= 1.0 - 0.1 * step(ly, 0.05) * (1.0 - win);
            facadeEmissive = warm * lit * win * 0.5 * uWindowGlow;
          }
          diffuseColor.rgb = col;
        }`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += facadeEmissive;');
  };
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

/** Concrete sidewalk: one texture tile = 3.2 m square = 2×2 slabs. The seams make speed readable. */
export function sidewalkTexture(): Texture {
  return canvasTexture(512, (c, s) => {
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
  });
}

/** Asphalt: one tile = 8 m. */
export function asphaltTexture(): Texture {
  return canvasTexture(256, (c, s) => {
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
  });
}

export function groundMaterial(map: Texture): MeshStandardMaterial {
  return new MeshStandardMaterial({ map, roughness: 0.95, metalness: 0, vertexColors: true });
}
