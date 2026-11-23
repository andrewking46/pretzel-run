/** A fixed, well-spread list of test seeds. */
export function testSeeds(count: number, offset = 0): number[] {
  return Array.from({ length: count }, (_, i) => Math.imul(i + 1 + offset, 2654435761) >>> 0);
}
