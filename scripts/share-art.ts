// The link-preview illustration and the app icons, as SVG. A poster, not a screenshot: golden hour over
// Midtown, a pretzel setting like the sun at the end of the street, and Alex sprinting for it in his suit.
import { mulberry32 } from '../src/sim/rng.ts';
import { pretzelCurve, SALT } from '../src/ui/icons.ts';

export const OG_W = 1200;
export const OG_H = 630;

type P = [number, number];
const f = (n: number) => n.toFixed(1);
const rad = (deg: number) => (deg * Math.PI) / 180;
const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
/** a vector of `len` at `deg` from straight down, positive toward +x (the way Alex runs) */
const swing = (len: number, deg: number): P => [len * Math.sin(rad(deg)), len * Math.cos(rad(deg))];

// ---------- pretzel ----------

interface Bake {
  id: string;
  outline: string;
  top: string;
  bottom: string;
  shine: string;
  shadow: number;
}

const BAKED: Bake = { id: 'bake', outline: '#4a230a', top: '#d98a3a', bottom: '#a95a1c', shine: '#ffe2b0', shadow: 0.28 };

/** The pretzel centered on 0,0 at scale `s`: defs (its gradient) and shapes, arms crossing over and under. */
export function pretzelSvg(s: number, bake: Bake = BAKED): { defs: string; shapes: string } {
  const { start, segments } = pretzelCurve(s);
  const d = `M${start.map(f).join(' ')}` + segments.map(seg => `C${seg.map(f).join(' ')}`).join('');
  const over = `M${start.map(f).join(' ')}C${segments[0].map(f).join(' ')}C${segments[1].map(f).join(' ')}`;
  const rope = (path: string, cap: string) => `
    <path d="${path}" stroke="${bake.outline}" stroke-width="${f(s * 0.36)}" stroke-linecap="${cap}"/>
    <path d="${path}" stroke="url(#${bake.id})" stroke-width="${f(s * 0.27)}" stroke-linecap="${cap}"/>
    <path d="${path}" stroke="${bake.shine}" stroke-opacity=".6" stroke-width="${f(s * 0.06)}" stroke-linecap="${cap}" transform="translate(${f(-s * 0.03)} ${f(-s * 0.055)})"/>`;
  const salt = SALT.map(([x, y, a]) => `<rect x="${f(x * s - s * 0.03)}" y="${f(y * s - s * 0.02)}" width="${f(s * 0.06)}" height="${f(s * 0.04)}" rx="${f(s * 0.012)}" fill="#fff" transform="rotate(${a} ${f(x * s)} ${f(y * s)})"/>`).join('');
  return {
    defs: `<linearGradient id="${bake.id}" x1="0" y1="${f(-s)}" x2="0" y2="${f(s)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${bake.top}"/><stop offset="1" stop-color="${bake.bottom}"/></linearGradient>`,
    shapes: `<g fill="none" stroke-linejoin="round">
    ${bake.shadow ? `<path d="${d}" stroke="#000" stroke-opacity="${bake.shadow}" stroke-width="${f(s * 0.36)}" stroke-linecap="round" transform="translate(0 ${f(s * 0.07)})"/>` : ''}
    ${rope(d, 'round')}
    ${rope(over, 'butt')}
    ${salt}
  </g>`,
  };
}

/** The green street-sign square with the pretzel on it. `corner` 0 = full bleed (iOS and maskable crop it). */
export function iconSvg({ corner, border, scale }: { corner: number; border: boolean; scale: number }): string {
  const pretzel = pretzelSvg(scale);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="sign" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#138a51"/><stop offset="1" stop-color="#0a5531"/></linearGradient>
    ${pretzel.defs}
  </defs>
  <rect width="512" height="512" rx="${corner}" fill="url(#sign)"/>
  ${border ? '<rect x="30" y="30" width="452" height="452" rx="86" fill="none" stroke="#fff" stroke-width="14"/>' : ''}
  <g transform="translate(256 262)">${pretzel.shapes}</g>
</svg>
`;
}

// ---------- Alex ----------

const SUIT = '#27355a';
const SUIT_FAR = '#1a2440';
const SKIN = '#f3d6be';
const SKIN_SHADE = '#e3b89a';
const HAIR = '#5b3a22';
const SHOE = '#6b3c1f';
const SOLE = '#2b170c';
const TIE = '#c8303b';
const SHIRT = '#f6f7fb';

/** a tapered limb: a hull between two circles */
function limb(a: P, b: P, ra: number, rb: number, fill: string): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const n: P = [-dy / len, dx / len];
  const pts = [add(a, [n[0] * ra, n[1] * ra]), add(b, [n[0] * rb, n[1] * rb]), add(b, [-n[0] * rb, -n[1] * rb]), add(a, [-n[0] * ra, -n[1] * ra])];
  return `<path d="M${pts.map(p => p.map(f).join(' ')).join('L')}Z" fill="${fill}"/><circle cx="${f(a[0])}" cy="${f(a[1])}" r="${f(ra)}" fill="${fill}"/><circle cx="${f(b[0])}" cy="${f(b[1])}" r="${f(rb)}" fill="${fill}"/>`;
}

/** a brown leather dress shoe, heel at 0,0, toe toward +x, sole down */
function shoe(at: P, deg: number, one?: string): string {
  const upper = one ?? SHOE;
  const sole = one ?? SOLE;
  return `<g transform="translate(${f(at[0])} ${f(at[1])}) rotate(${deg})">
    <path d="M-8 -9 C-11 2 -9 9 -2 10 L38 10 C47 10 50 3 45 -2 C38 -7 24 -9 13 -12 L2 -14 Z" fill="${upper}"/>
    <path d="M-6 6 L40 6 C46 6 48 9 46 11 L-4 12 C-8 12 -9 9 -6 6 Z" fill="${sole}"/>
    ${one ? '' : '<path d="M14 -9 C22 -7 30 -5 37 -2" stroke="#8c5430" stroke-width="2" fill="none" stroke-linecap="round"/>'}
  </g>`;
}

/**
 * Alex mid-sprint, facing right, in his own coordinates (hip at 0,0, about 300 units head to toe).
 * `one` paints every part a single color, for the light and shade masks; `head` false leaves the
 * head and neck out (shading on a face reads as stubble).
 */
function alex(one?: string, head = true): string {
  const c = (color: string) => one ?? color;
  const hip: P = [0, 0];
  const lean = 16;
  const up: P = [Math.sin(rad(lean)), -Math.cos(rad(lean))];
  const fwd: P = [Math.cos(rad(lean)), Math.sin(rad(lean))];
  /** a point in the torso's frame: `a` forward, `b` up from the hip */
  const T = (a: number, b: number): P => [hip[0] + fwd[0] * a + up[0] * b, hip[1] + fwd[1] * a + up[1] * b];
  const shoulder = T(-2, 100);
  const shoulderFar = T(6, 102);

  // legs: the near (left) leg drives forward, the far one kicks back
  const kneeN = add(hip, swing(86, 72));
  const ankleN = add(kneeN, swing(84, -24));
  const kneeF = add(T(4, 2), swing(86, -42));
  const ankleF = add(kneeF, swing(80, -112));
  // arms: opposite to the legs; the near hand swings back with the briefcase
  const elbowN = add(shoulder, swing(64, -50));
  const wristN = add(elbowN, swing(58, -70));
  const elbowF = add(shoulderFar, swing(62, 62));
  const wristF = add(elbowF, swing(56, 128));

  const parts: string[] = [];

  // far arm, reaching ahead
  parts.push(limb(shoulderFar, elbowF, 15, 13, c(SUIT_FAR)), limb(elbowF, wristF, 13, 11, c(SUIT_FAR)));
  parts.push(`<circle cx="${f(wristF[0] + 3)}" cy="${f(wristF[1] - 3)}" r="9" fill="${c(SHIRT)}"/>`);
  const handF = add(wristF, swing(14, 140));
  parts.push(`<g transform="translate(${f(handF[0])} ${f(handF[1])}) rotate(-40)"><ellipse rx="13" ry="10" fill="${c(SKIN_SHADE)}"/><ellipse cx="9" cy="-8" rx="5" ry="8" transform="rotate(-30 9 -8)" fill="${c(SKIN_SHADE)}"/></g>`);

  // far leg, kicked up behind
  parts.push(limb(T(4, 2), kneeF, 21, 16, c(SUIT_FAR)), limb(kneeF, ankleF, 16, 12, c(SUIT_FAR)));
  parts.push(shoe(add(ankleF, [-2, -2]), 118, one));

  // near leg, driving forward
  parts.push(limb(hip, kneeN, 23, 17, c(SUIT)), limb(kneeN, ankleN, 17, 13, c(SUIT)));
  parts.push(shoe(add(ankleN, [-4, 4]), 8, one));

  // jacket: shoulders to a hem that flaps back in the wind
  const jacket = [T(-22, 104), T(-4, 112), T(14, 108), T(27, 82), T(24, 40), T(26, -14), T(10, -26), T(-20, -22), T(-44, -18), T(-50, -8), T(-30, 6), T(-26, 40), T(-30, 76)];
  parts.push(`<path d="M${jacket.map(p => p.map(f).join(' ')).join('L')}Z" fill="${c(SUIT)}" stroke="${c(SUIT)}" stroke-width="10" stroke-linejoin="round"/>`);
  if (!one) {
    // shirt front and lapel
    parts.push(`<path d="M${[T(6, 110), T(20, 106), T(26, 84), T(18, 66)].map(p => p.map(f).join(' ')).join('L')}Z" fill="${SHIRT}"/>`);
    parts.push(`<path d="M${[T(4, 108), T(18, 64), T(10, 70), T(-2, 104)].map(p => p.map(f).join(' ')).join('L')}Z" fill="#1d2848"/>`);
    parts.push(`<circle cx="${f(T(25, 30)[0])}" cy="${f(T(25, 30)[1])}" r="3" fill="#0f1730"/><circle cx="${f(T(25, 12)[0])}" cy="${f(T(25, 12)[1])}" r="3" fill="#0f1730"/>`);
  }

  // tie: knotted at the collar, streaming back over his shoulder
  const knot = T(20, 104);
  parts.push(`<path d="M${f(knot[0])} ${f(knot[1])} C${[T(16, 124), T(-2, 134)].map(p => p.map(f).join(' ')).join(' ')} ${T(-20, 132).map(f).join(' ')} S${[T(-46, 124), T(-58, 136)].map(p => p.map(f).join(' ')).join(' ')} L${T(-74, 138).map(f).join(' ')} L${T(-62, 120).map(f).join(' ')} C${[T(-48, 112), T(-34, 120)].map(p => p.map(f).join(' ')).join(' ')} ${T(-20, 118).map(f).join(' ')} S${[T(4, 116), T(12, 104)].map(p => p.map(f).join(' ')).join(' ')} Z" fill="${c(TIE)}"/>`);
  parts.push(`<circle cx="${f(knot[0])}" cy="${f(knot[1])}" r="6" fill="${c('#a5232d')}"/>`);

  // near arm, swinging back with the briefcase
  parts.push(limb(shoulder, elbowN, 17, 14, c(SUIT)), limb(elbowN, wristN, 14, 12, c(SUIT)));
  parts.push(`<circle cx="${f(wristN[0] - 4)}" cy="${f(wristN[1] + 1)}" r="9" fill="${c(SHIRT)}"/>`);
  const handN = add(wristN, [-10, 6]);
  parts.push(`<g transform="translate(${f(handN[0])} ${f(handN[1])}) rotate(-22)">
    <path d="M-12 2 C-12 -10 12 -10 12 2" stroke="${c('#3a2112')}" stroke-width="5" fill="none"/>
    <rect x="-36" y="0" width="72" height="50" rx="7" fill="${c('#7c4a26')}"/>
    ${one ? '' : '<rect x="-36" y="0" width="72" height="13" rx="6" fill="#8f5a30"/><rect x="-6" y="8" width="12" height="8" rx="2" fill="#e8b84e"/><path d="M-36 40 L36 40" stroke="#6a3d1f" stroke-width="2"/>'}
  </g>`);
  parts.push(`<ellipse cx="${f(handN[0])}" cy="${f(handN[1] - 2)}" rx="11" ry="10" fill="${c(SKIN)}"/>`);

  if (!head) return parts.join('\n');

  // neck and head
  const neck = T(4, 112);
  const face = T(12, 146);
  parts.push(limb(neck, add(neck, [4, -16]), 10, 10, c(SKIN_SHADE)));
  parts.push(`<g transform="translate(${f(face[0])} ${f(face[1])}) rotate(${lean - 4})">
    <ellipse cx="0" cy="0" rx="25" ry="29" fill="${c(SKIN)}"/>
    <ellipse cx="5" cy="10" rx="22" ry="20" fill="${c(SKIN)}"/>
    <ellipse cx="24" cy="2" rx="6" ry="5.5" fill="${c(SKIN)}"/>
    <path d="M18 -15 C21 -28 6 -36 -9 -33 C-24 -30 -31 -15 -28 2 C-27 10 -23 16 -18 18 L-14 7 C-12 -1 -9 -7 -2 -11 C5 -14 12 -12 18 -15 Z" fill="${c(HAIR)}"/>
    <path d="M-26 -16 L-40 -20 L-29 -8 L-42 -6 L-28 0 Z" fill="${c(HAIR)}"/>
    ${one ? '' : '<path d="M-14 -27 C-4 -31 8 -29 14 -22" stroke="#7d5434" stroke-width="3" fill="none" stroke-linecap="round"/>'}
    ${
      one
        ? ''
        : `<ellipse cx="-7" cy="3" rx="6" ry="8" fill="${SKIN_SHADE}"/>
    <ellipse cx="-6" cy="3" rx="2.5" ry="4" fill="#d49e80"/>
    <ellipse cx="13" cy="-3" rx="2.8" ry="3.4" fill="#3b2415"/>
    <circle cx="14" cy="-4.2" r=".9" fill="#fff"/>
    <path d="M7 -11 Q13 -14 19 -11" stroke="${HAIR}" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    <circle cx="11" cy="8" r="4.5" fill="#f0a08a" opacity=".55"/>
    <path d="M14 13 Q19 18 24 12" stroke="#8a3b2e" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
    }
  </g>`);

  return parts.join('\n');
}

// ---------- the city ----------

interface Layer {
  x0: number;
  x1: number;
  base: number;
  minH: number;
  maxH: number;
  minW: number;
  maxW: number;
  color: string;
  windows?: { lit: string; dark: string };
  gap?: [number, number];
  waterTowers?: boolean;
}

function skyline(seed: number, L: Layer): string {
  const r = mulberry32(seed);
  const out: string[] = [];
  let x = L.x0;
  while (x < L.x1) {
    const w = L.minW + r() * (L.maxW - L.minW);
    if (L.gap && x + w > L.gap[0] && x < L.gap[1]) {
      x = L.gap[1];
      continue;
    }
    const h = L.minH + r() * (L.maxH - L.minH);
    const top = L.base - h;
    out.push(`<rect x="${f(x)}" y="${f(top)}" width="${f(w + 1)}" height="${f(h + 40)}" fill="${L.color}"/>`);
    const roof = r();
    if (roof < 0.3) {
      // a setback crown
      out.push(`<rect x="${f(x + w * 0.18)}" y="${f(top - h * 0.12)}" width="${f(w * 0.64)}" height="${f(h * 0.12 + 1)}" fill="${L.color}"/>`);
      if (r() < 0.5) out.push(`<rect x="${f(x + w * 0.47)}" y="${f(top - h * 0.12 - 26)}" width="${f(w * 0.06)}" height="27" fill="${L.color}"/>`);
    } else if (roof < 0.62 && L.waterTowers) {
      // a water tower on legs
      const tx = x + w * (0.25 + r() * 0.4);
      out.push(`<g fill="${L.color}"><rect x="${f(tx - 1)}" y="${f(top - 14)}" width="3" height="15"/><rect x="${f(tx + 17)}" y="${f(top - 14)}" width="3" height="15"/>
        <rect x="${f(tx - 2)}" y="${f(top - 36)}" width="23" height="23" rx="2"/><path d="M${f(tx - 4)} ${f(top - 35)} L${f(tx + 9.5)} ${f(top - 47)} L${f(tx + 23)} ${f(top - 35)} Z"/></g>`);
    }
    if (L.windows) {
      const cols = Math.max(2, Math.floor((w - 12) / 15));
      const pitch = (w - 12) / cols;
      for (let wy = top + 14; wy < L.base - 22; wy += 20) {
        for (let i = 0; i < cols; i++) {
          const lit = r() < 0.34;
          out.push(`<rect x="${f(x + 6 + i * pitch + 2)}" y="${f(wy)}" width="${f(pitch - 6)}" height="11" rx="1.5" fill="${lit ? L.windows.lit : L.windows.dark}" ${lit ? '' : 'opacity=".55"'}/>`);
        }
      }
    }
    x += w + (L.windows ? 3 : 0);
  }
  return out.join('');
}

/** A spire tower in the far haze, for the Midtown skyline without naming one. */
function spire(x: number, base: number, color: string): string {
  const tiers: [number, number][] = [[64, 210], [48, 250], [34, 276], [22, 294], [12, 308]];
  return `<g fill="${color}">${tiers.map(([w, h]) => `<rect x="${f(x - w / 2)}" y="${f(base - h)}" width="${w}" height="${h}"/>`).join('')}<rect x="${f(x - 2)}" y="${f(base - 352)}" width="4" height="46"/></g>`;
}

function bill(x: number, y: number, deg: number, s = 1): string {
  return `<g transform="translate(${x} ${y}) rotate(${deg}) scale(${s}) skewX(-8)">
    <rect x="-36" y="-17" width="72" height="34" rx="3" fill="#b9dca0" stroke="#4f7d43" stroke-width="2.5"/>
    <rect x="-30" y="-11" width="60" height="22" rx="2" fill="none" stroke="#6f9d5f" stroke-width="1.6"/>
    <ellipse cx="0" cy="0" rx="9" ry="10" fill="#8fbf7a" stroke="#4f7d43" stroke-width="1.6"/>
    <circle cx="-22" cy="0" r="4" fill="#6f9d5f"/><circle cx="22" cy="0" r="4" fill="#6f9d5f"/>
  </g>`;
}

function sparkle(x: number, y: number, r: number, color = '#fff6d8'): string {
  return `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="${color}"/>`;
}

/** The whole illustration as one SVG; the title sign is laid over it in HTML. */
export function ogScene(): string {
  const W = OG_W;
  const H = OG_H;
  const ground = 540;
  const sun: P = [1056, 350];
  const sunPretzel = pretzelSvg(124, { id: 'sunbake', outline: '#c25a1c', top: '#ffe08a', bottom: '#f5a03e', shine: '#fffbe6', shadow: 0 });

  const rays = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    const b = a + Math.PI / 30;
    const R = 900;
    return `<path d="M${sun[0]} ${sun[1]} L${f(sun[0] + Math.cos(a) * R)} ${f(sun[1] + Math.sin(a) * R)} L${f(sun[0] + Math.cos(b) * R)} ${f(sun[1] + Math.sin(b) * R)} Z"/>`;
  }).join('');

  // Alex: hip placement and scale in the poster
  const alexAt: P = [796, 366];
  const alexScale = 1.28;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="${ground}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#2f2f66"/><stop offset=".34" stop-color="#8a4c86"/><stop offset=".62" stop-color="#ef8466"/>
    <stop offset=".84" stop-color="#ffc36e"/><stop offset="1" stop-color="#ffe0a0"/>
  </linearGradient>
  <radialGradient id="glow" cx="${sun[0]}" cy="${sun[1]}" r="330" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff3c4" stop-opacity="1"/><stop offset=".35" stop-color="#ffd27a" stop-opacity=".75"/><stop offset="1" stop-color="#ff9a5a" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="walk" x1="0" y1="${ground}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#e9bf92"/><stop offset="1" stop-color="#c99a76"/>
  </linearGradient>
  <linearGradient id="haze" x1="0" y1="${ground - 220}" x2="0" y2="${ground}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#ffd7a0" stop-opacity="0"/><stop offset="1" stop-color="#ffd7a0" stop-opacity=".55"/>
  </linearGradient>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 .5  0 0 0 0 .4  0 0 0 0 .35  0 0 0 .22 0"/>
    <feComposite in2="SourceGraphic" operator="in"/>
  </filter>
  <mask id="shade"><g transform="translate(${alexAt.join(' ')}) scale(${alexScale})">${alex('#fff', false)}<g transform="translate(5 -4)">${alex('#000')}</g></g></mask>
  <mask id="rim"><g transform="translate(${alexAt.join(' ')}) scale(${alexScale})">${alex('#fff')}<g transform="translate(-3 2.5)">${alex('#000')}</g></g></mask>
  ${sunPretzel.defs}
</defs>

<rect width="${W}" height="${H}" fill="url(#sky)"/>
<g fill="#fff4cf" opacity=".09">${rays}</g>
<circle cx="${sun[0]}" cy="${sun[1]}" r="330" fill="url(#glow)"/>
<g transform="translate(${sun.join(' ')}) rotate(-6)">${sunPretzel.shapes}</g>

<!-- far haze, then plum, then the street wall with lit windows -->
${spire(586, ground - 40, '#d98f8f')}
${skyline(3, { x0: -20, x1: W + 20, base: ground - 40, minH: 90, maxH: 210, minW: 40, maxW: 90, color: '#d98f8f', gap: [930, 1090] })}
${skyline(5, { x0: 880, x1: 1180, base: ground - 30, minH: 36, maxH: 96, minW: 30, maxW: 60, color: '#eba48c' })}
${skyline(8, { x0: -30, x1: W + 30, base: ground - 10, minH: 70, maxH: 170, minW: 50, maxW: 110, color: '#9a5274', gap: [890, 1135], waterTowers: true })}
<rect x="0" y="${ground - 220}" width="${W}" height="220" fill="url(#haze)"/>
${skyline(21, { x0: -40, x1: W + 40, base: ground, minH: 120, maxH: 250, minW: 90, maxW: 170, color: '#3a2849', windows: { lit: '#ffcf73', dark: '#5a4466' }, gap: [860, 1160] })}

<!-- sidewalk -->
<rect x="0" y="${ground}" width="${W}" height="${H - ground}" fill="url(#walk)"/>
<rect x="0" y="${ground}" width="${W}" height="6" fill="#b58866"/>
<g stroke="#c59a74" stroke-width="2">${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 120 - 20}" y1="${ground + 6}" x2="${i * 120 - 70}" y2="${H}"/>`).join('')}<line x1="0" y1="${ground + 58}" x2="${W}" y2="${ground + 58}"/></g>
<rect x="0" y="${H - 16}" width="${W}" height="16" fill="#9c7458"/>

<!-- speed lines, cash in the air, Alex -->
<g stroke="#fff3dc" stroke-linecap="round" opacity=".7">
  <line x1="${alexAt[0] - 330}" y1="${alexAt[1] + 40}" x2="${alexAt[0] - 220}" y2="${alexAt[1] + 40}" stroke-width="5"/>
  <line x1="${alexAt[0] - 300}" y1="${alexAt[1] + 80}" x2="${alexAt[0] - 215}" y2="${alexAt[1] + 80}" stroke-width="4"/>
  <line x1="${alexAt[0] - 350}" y1="${alexAt[1] + 120}" x2="${alexAt[0] - 250}" y2="${alexAt[1] + 120}" stroke-width="5"/>
</g>
<ellipse cx="${alexAt[0] + 10}" cy="${ground + 62}" rx="110" ry="12" fill="#6a3f3a" opacity=".22"/>
${bill(985, 150, 16)}${bill(860, 92, -14, 0.85)}${bill(1135, 78, 30, 0.75)}
${sparkle(930, 118, 12)}${sparkle(1060, 112, 9)}${sparkle(1170, 150, 10)}${sparkle(800, 130, 8)}
<g transform="translate(${alexAt.join(' ')}) scale(${alexScale})">${alex()}</g>
<rect width="${W}" height="${H}" fill="#1c1238" opacity=".28" mask="url(#shade)"/>
<rect width="${W}" height="${H}" fill="#ffbf80" opacity=".9" mask="url(#rim)"/>

<rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`;
}
