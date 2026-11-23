// The pretzel, drawn once to a canvas (HUD, progress bar, counter case, favicon-ish uses).

const PTS: [number, number][] = [[-0.4, 0.3], [-0.15, 0], [0.12, -0.35], [0.3, -0.62], [0.62, -0.55], [0.8, -0.15], [0.62, 0.38], [0, 0.62], [-0.62, 0.38], [-0.8, -0.15], [-0.62, -0.55], [-0.3, -0.62], [-0.12, -0.35], [0.15, 0], [0.4, 0.3]];

function path(c: CanvasRenderingContext2D, s: number) {
  const p = PTS.map(([x, y]) => [x * s, y * s]);
  c.beginPath();
  c.moveTo(p[0][0], p[0][1]);
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
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
  path(g, s);
  g.strokeStyle = '#5b2e0e';
  g.lineWidth = s * 0.36;
  g.stroke();
  path(g, s);
  g.strokeStyle = '#c0712a';
  g.lineWidth = s * 0.27;
  g.stroke();
  g.translate(-s * 0.03, -s * 0.05);
  path(g, s);
  g.strokeStyle = 'rgba(255,214,150,.7)';
  g.lineWidth = s * 0.07;
  g.stroke();
  g.fillStyle = '#fff';
  for (let i = 1; i < PTS.length - 1; i += 2) g.fillRect(PTS[i][0] * s - 2, PTS[i][1] * s - 3, 4, 3);
  cached = c.toDataURL();
  return cached;
}
