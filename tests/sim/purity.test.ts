import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// sim/ and config/ must run headless in Node and produce the same course on every device.
const roots = ['src/sim', 'src/config'];
const files = roots.flatMap(root => readdirSync(root, { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.ts')).map(f => join(root, f)));

const forbidden: [RegExp, string][] = [
  [/from ['"]three/, 'three.js import'],
  [/from ['"]\.\.\/(world|actors|fx|audio|ui|input)\//, 'import from a rendering/UI layer'],
  [/\b(document|window|navigator|localStorage)\.|requestAnimationFrame\(/, 'DOM global'],
  [/Math\.random/, 'unseeded randomness'],
  [/Math\.(sin|cos|tan|atan2?|asin|acos|exp|log|pow|hypot|cbrt)\b/, 'transcendental math (not bit-identical across engines)'],
  [/\bDate\b|performance\.now/, 'wall-clock time'],
];

describe('simulation purity', () => {
  it('finds the sim files', () => expect(files.length).toBeGreaterThan(8));
  for (const file of files) {
    it(file, () => {
      const src = readFileSync(file, 'utf8');
      for (const [pattern, why] of forbidden) expect(src, `${file}: ${why}`).not.toMatch(pattern);
    });
  }
});
