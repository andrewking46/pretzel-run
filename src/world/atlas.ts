import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';

// Every painted word in the world (blade signs, street signs, awnings, the cart, the plywood…) drawn once
// into one canvas texture, so signs across a whole block share a single material.

export const DISPLAY_FONT = '"Bebas Neue","AvenirNextCondensed-Heavy","Futura-CondensedExtraBold",Impact,"Arial Narrow",sans-serif';
export const UI_FONT = 'Archivo, "Helvetica Neue", Arial, sans-serif';

export type UvRect = [number, number, number, number];

interface Entry {
  w: number;
  h: number;
  draw(c: CanvasRenderingContext2D, w: number, h: number): void;
}

export const STORE_WORDS = ['DELI', 'PIZZA', 'BAGELS', 'NAILS', 'PHARMACY', 'HALAL', '24 HRS', 'LOTTO', 'CAFE', 'SHOES', 'DINER', 'GIFTS'];
export const SQUARE_WORDS = ['THEATRE', 'HOTEL', 'SHOW', 'GIFTS', 'PIZZA', 'OPEN 24 HRS'];
export const AWNING_WORDS = ['DELI & GROCERY', 'PIZZA · SLICES', 'BAGELS', 'COFFEE SHOP', 'PHARMACY', 'NAIL SALON', 'HALAL FOOD', 'SHOE REPAIR', 'DINER', 'WINE & LIQUOR'];
const BLADE_COLORS: [string, string][] = [['#a31f2b', '#fff'], ['#1e3b7a', '#fff'], ['#111', '#ffd23f'], ['#0f5a36', '#fff'], ['#f1e6c8', '#7a1b1b'], ['#6a2a8a', '#fff']];

function font(px: number, family = DISPLAY_FONT, weight = '400') {
  return `${weight} ${px}px ${family}`;
}

function fitText(c: CanvasRenderingContext2D, text: string, maxW: number, px: number, family = DISPLAY_FONT, weight = '400'): void {
  c.font = font(px, family, weight);
  const w = c.measureText(text).width;
  if (w > maxW) c.font = font(Math.floor((px * maxW) / w), family, weight);
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function entries(): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  STORE_WORDS.concat(SQUARE_WORDS).forEach((word, i) => {
    const [bg, fg] = BLADE_COLORS[i % BLADE_COLORS.length];
    out[`blade:${word}`] = {
      w: 64,
      h: 256,
      draw(c, w, h) {
        c.fillStyle = bg;
        c.fillRect(0, 0, w, h);
        c.strokeStyle = fg;
        c.lineWidth = 3;
        c.strokeRect(5, 5, w - 10, h - 10);
        const letters = [...word.replace(/ /g, '')];
        const step = Math.min(44, (h - 24) / letters.length);
        c.fillStyle = fg;
        c.font = font(Math.min(46, step * 1.05));
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        letters.forEach((ch, k) => c.fillText(ch, w / 2, h / 2 + (k - (letters.length - 1) / 2) * step + 2));
      },
    };
  });
  AWNING_WORDS.forEach(word => {
    out[`awning:${word}`] = {
      w: 512,
      h: 64,
      draw(c, w, h) {
        c.clearRect(0, 0, w, h);
        c.fillStyle = '#fff';
        fitText(c, word, w - 40, 50);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(word, w / 2, h / 2 + 3);
      },
    };
  });
  for (let street = 59; street >= 28; street--) {
    out[`street:${street}`] = streetSign(`W ${street} ST`, 256, 64);
  }
  out['street:avenue'] = streetSign('7 AV', 160, 52);
  out.subway = {
    w: 192,
    h: 48,
    draw(c, w, h) {
      c.fillStyle = '#111';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff';
      c.font = font(38);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('SUBWAY', w / 2, h / 2 + 2);
    },
  };
  out.penn = {
    w: 640,
    h: 120,
    draw(c, w, h) {
      c.fillStyle = '#0f1a2c';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff';
      c.font = font(92);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('PENN STATION', w / 2, h / 2 + 4);
    },
  };
  out.pennSub = {
    w: 512,
    h: 48,
    draw(c, w, h) {
      c.fillStyle = '#0f1a2c';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#f2c26b';
      fitText(c, "7 AV · W 32 ST · TRAINS · AUNTIE ANNE'S ↓", w - 24, 30, UI_FONT, '800');
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText("7 AV · W 32 ST · TRAINS · AUNTIE ANNE'S ↓", w / 2, h / 2 + 1);
    },
  };
  out.cart = {
    w: 256,
    h: 160,
    draw(c, w, h) {
      c.fillStyle = '#d0d4da';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#c62828';
      c.fillRect(8, 10, w - 16, 70);
      c.fillStyle = '#fff';
      c.font = font(64);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('HOT DOGS', w / 2, 47);
      c.fillStyle = '#222';
      c.font = font(40);
      c.fillText('PRETZELS $3', w / 2, 118);
    },
  };
  out.plywood = {
    w: 512,
    h: 168,
    draw(c, w, h) {
      c.fillStyle = '#1f5e3a';
      c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(0,0,0,.18)';
      for (let i = 1; i < 6; i++) c.fillRect((i * w) / 6, 0, 2, h);
      const posters: [number, number, string, string][] = [[14, 12, '#f1e9d8', '#e94f37'], [418, 14, '#ffd23f', '#2a2a2a'], [92, 96, '#9ad0ff', '#1b3f8b']];
      for (const [x, y, a, b] of posters) {
        c.fillStyle = a;
        c.fillRect(x, y, 70, 58);
        c.fillStyle = b;
        c.fillRect(x + 6, y + 8, 58, 20);
        c.fillRect(x + 6, y + 34, 36, 6);
      }
      c.fillStyle = '#f4f1e8';
      c.font = font(64);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('POST NO BILLS', w / 2, 62);
      c.font = font(26, UI_FONT, '800');
      c.fillStyle = 'rgba(244,241,232,.75)';
      c.fillText('▼ SLIDE UNDER ▼', w / 2, 122);
      c.fillStyle = '#111';
      c.fillRect(0, h - 14, w, 14);
      c.fillStyle = '#ffd400';
      for (let x = 0; x < w; x += 28) c.fillRect(x, h - 14, 14, 14);
    },
  };
  out.notInService = {
    w: 256,
    h: 40,
    draw(c, w, h) {
      c.fillStyle = '#120c05';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffb000';
      c.font = font(32);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('NOT IN SERVICE', w / 2, h / 2 + 2);
    },
  };
  out.taxi = {
    w: 96,
    h: 32,
    draw(c, w, h) {
      c.fillStyle = '#fff8dc';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#222';
      c.font = font(28);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('TAXI', w / 2, h / 2 + 1);
    },
  };
  out.nyc = {
    w: 64,
    h: 48,
    draw(c, w, h) {
      c.clearRect(0, 0, w, h);
      c.fillStyle = '#fff';
      c.font = font(40);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('NYC', w / 2, h / 2 + 2);
    },
  };
  out.busOnly = {
    w: 256,
    h: 64,
    draw(c, w, h) {
      c.clearRect(0, 0, w, h);
      c.fillStyle = '#f4f1ea';
      c.font = font(60);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('BUS ONLY', w / 2, h / 2 + 3);
    },
  };
  out.walk = signal(true);
  out.dontWalk = signal(false);
  return out;
}

function streetSign(text: string, w: number, h: number): Entry {
  return {
    w,
    h,
    draw(c) {
      c.fillStyle = '#0d6b3f';
      roundRect(c, 0, 0, w, h, 8);
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = 3;
      roundRect(c, 4, 4, w - 8, h - 8, 6);
      c.stroke();
      c.fillStyle = '#fff';
      fitText(c, text, w - 24, h * 0.78);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(text, w / 2, h / 2 + 2);
    },
  };
}

function signal(walk: boolean): Entry {
  return {
    w: 64,
    h: 64,
    draw(c, w) {
      c.fillStyle = '#111';
      c.fillRect(0, 0, w, w);
      if (walk) {
        c.strokeStyle = '#f4f4f4';
        c.fillStyle = '#f4f4f4';
        c.lineWidth = 5;
        c.lineCap = 'round';
        c.beginPath();
        c.arc(32, 14, 6, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.moveTo(32, 22);
        c.lineTo(30, 40);
        c.lineTo(22, 54);
        c.moveTo(30, 40);
        c.lineTo(40, 54);
        c.moveTo(20, 30);
        c.lineTo(42, 32);
        c.stroke();
      } else {
        c.fillStyle = '#ff7a1a';
        roundRect(c, 18, 14, 28, 34, 8);
        c.fill();
        c.fillRect(18, 34, 28, 20);
      }
    },
  };
}

export interface Atlas {
  texture: Texture;
  uv(name: string): UvRect;
  has(name: string): boolean;
  aspect(name: string): number;
}

export function buildAtlas(): Atlas {
  const all = entries();
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d')!;
  const rects = new Map<string, { x: number; y: number; w: number; h: number }>();
  // shelf packing, tallest first
  const order = Object.entries(all).sort((a, b) => b[1].h - a[1].h);
  let x = 0;
  let y = 0;
  let shelf = 0;
  const pad = 4;
  for (const [name, e] of order) {
    if (x + e.w > size) {
      x = 0;
      y += shelf + pad;
      shelf = 0;
    }
    c.save();
    c.translate(x, y);
    c.beginPath();
    c.rect(0, 0, e.w, e.h);
    c.clip();
    e.draw(c, e.w, e.h);
    c.restore();
    rects.set(name, { x, y, w: e.w, h: e.h });
    x += e.w + pad;
    shelf = Math.max(shelf, e.h);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.flipY = false;
  return {
    texture,
    has: name => rects.has(name),
    uv(name) {
      const r = rects.get(name);
      if (!r) throw new Error(`atlas: no "${name}"`);
      return [r.x / size, r.y / size, (r.x + r.w) / size, (r.y + r.h) / size];
    },
    aspect(name) {
      const r = rects.get(name)!;
      return r.w / r.h;
    },
  };
}
