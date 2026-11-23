import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The link someone texts has to unfold into a proper card: absolute URLs, an image of the size the tags
// promise, small enough for every messenger to fetch, and icons that exist.

const html = readFileSync('index.html', 'utf8');
const meta = (key: string) => html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1];
const link = (rel: string) => [...html.matchAll(new RegExp(`<link rel="${rel}" href="([^"]*)"`, 'g'))].map(m => m[1]);

/** the public/ file behind an absolute URL on the site (a ?v= cache-buster is fine) */
const publicFile = (url: string) => `public/${url.slice(meta('og:url')!.length).split('?')[0]}`;

function pngSize(file: string): [number, number] {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

function jpegSize(file: string): [number, number] {
  const b = readFileSync(file);
  expect(b.readUInt16BE(0)).toBe(0xffd8);
  for (let i = 2; i < b.length; ) {
    const marker = b[i + 1];
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`no frame header in ${file}`);
}

describe('link preview', () => {
  it('has the Open Graph basics', () => {
    for (const key of ['og:type', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'twitter:card', 'description']) {
      expect(meta(key), key).toBeTruthy();
    }
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(html).toMatch(/<title>Alex's Pretzel Run<\/title>/);
  });

  it('uses absolute https URLs that agree with the canonical link', () => {
    const canonical = link('canonical')[0];
    expect(canonical).toMatch(/^https:\/\/.+\/$/);
    expect(meta('og:url')).toBe(canonical);
    expect(meta('og:image')!.startsWith(canonical)).toBe(true);
  });

  it('ships the image the tags describe, small enough for every messenger', () => {
    const file = publicFile(meta('og:image')!);
    expect(existsSync(file), file).toBe(true);
    expect(jpegSize(file)).toEqual([Number(meta('og:image:width')), Number(meta('og:image:height'))]);
    expect(meta('og:image:type')).toBe('image/jpeg');
    expect(statSync(file).size).toBeLessThan(300 * 1024);
  });

  it('has every icon it links to, at the right size', () => {
    for (const href of [...link('icon'), ...link('apple-touch-icon'), ...link('manifest')]) {
      expect(existsSync(`public/${href}`), href).toBe(true);
    }
    expect(pngSize(`public/${link('apple-touch-icon')[0]}`)).toEqual([180, 180]);
    const manifest = JSON.parse(readFileSync(`public/${link('manifest')[0]}`, 'utf8'));
    expect(manifest.name).toBe("Alex's Pretzel Run");
    for (const icon of manifest.icons.filter((i: { type: string }) => i.type === 'image/png')) {
      const [w, h] = pngSize(`public/${icon.src}`);
      expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
    }
  });
});
