/** Maldivian Rufiyaa formatting — matches web expenses page. */
export function fmtMVR(n: number): string {
  return `MVR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtMVRCompact(n: number): string {
  if (n >= 1_000_000) return `MVR ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 100_000) return `MVR ${(n / 1_000).toFixed(1)}k`;
  return fmtMVR(n);
}
