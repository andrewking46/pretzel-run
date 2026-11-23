// The pretzel: one rope curve, drawn to a canvas for the HUD, progress bar and counter case, and to SVG
// for the app icons (scripts/share-image.ts).

const PTS: [number, number][] = [[-0.4, 0.3], [-0.15, 0], [0.12, -0.35], [0.3, -0.62], [0.62, -0.55], [0.8, -0.15], [0.62, 0.38], [0, 0.62], [-0.62, 0.38], [-0.8, -0.15], [-0.62, -0.55], [-0.3, -0.62], [-0.12, -0.35], [0.15, 0], [0.4, 0.3]];

/** Salt grains on the rope: [x, y, degrees], in the same units as the curve. */
export const SALT: [number, number, number][] = [
  [-0.15, -0.02, 35], [0.3, -0.64, -15], [0.63, -0.57, 40], [0.8, -0.17, 75], [0.62, 0.36, -40], [0, 0.6, 5],
  [-0.62, 0.36, 40], [-0.8, -0.17, -75], [-0.63, -0.57, -40], [-0.3, -0.64, 15], [0.15, -0.02, -35],
];

type Segment = [number, number, number, number, number, number];

/** The rope as cubic Béziers (Catmull-Rom through the knot points), scaled by `s`, centered on 0,0. */
export function pretzelCurve(s: number): { start: [number, number]; segments: Segment[] } {
  const p = PTS.map(([x, y]) => [x * s, y * s]);
  const segments = p.slice(0, -1).map((p1, i): Segment => {
    const p0 = p[Math.max(0, i - 1)];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];
    return [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]];
  });
  return { start: [p[0][0], p[0][1]], segments };
}

function trace(c: CanvasRenderingContext2D, s: number) {
  const { start, segments } = pretzelCurve(s);
  c.beginPath();
  c.moveTo(...start);
  for (const seg of segments) c.bezierCurveTo(...seg);
}

let cached: string | null = null;

export function pretzelDataUrl(): string {
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 120;
  c.height = 100;
  const g = c.getContext('2d')!;
  const s = 54;
  g.translate(60, 52);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  trace(g, s);
  g.strokeStyle = '#5b2e0e';
  g.lineWidth = s * 0.36;
  g.stroke();
  trace(g, s);
  g.strokeStyle = '#c0712a';
  g.lineWidth = s * 0.27;
  g.stroke();
  g.save();
  g.translate(-s * 0.03, -s * 0.05);
  trace(g, s);
  g.strokeStyle = 'rgba(255,214,150,.7)';
  g.lineWidth = s * 0.07;
  g.stroke();
  g.restore();
  g.fillStyle = '#fff';
  for (const [x, y, a] of SALT) {
    g.save();
    g.translate(x * s, y * s);
    g.rotate((a * Math.PI) / 180);
    g.fillRect(-2, -1.5, 4, 3);
    g.restore();
  }
  cached = c.toDataURL();
  return cached;
}
