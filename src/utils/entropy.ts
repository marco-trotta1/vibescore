/**
 * Shannon entropy over the characters of the input, in bits.
 * Used as part of heuristic secret detection.
 */
export function shannonEntropy(str: string): number {
  if (!str) return 0;
  const freq = new Map<string, number>();
  for (const ch of str) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  const len = str.length;
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}
