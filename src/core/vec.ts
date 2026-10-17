export interface Vec {
  x: number;
  y: number;
}

export const vec = (x = 0, y = 0): Vec => ({ x, y });
export const dist2 = (a: Vec, b: Vec): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Unit vector of (x, y); (0, 0) stays (0, 0). */
export function normalize(x: number, y: number): Vec {
  const l = Math.hypot(x, y);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: x / l, y: y / l };
}
