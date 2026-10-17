interface Point {
  x: number;
  y: number;
}

/** Uniform grid for neighbor queries. Rebuild every step: clear(), then insert(). */
export interface Grid<T extends Point> {
  clear(): void;
  insert(item: T): void;
  /** Append every item within `radius` of (x, y) to `out` (circle test on centers). */
  query(x: number, y: number, radius: number, out?: T[]): T[];
}

export function createGrid<T extends Point>(cell = 64): Grid<T> {
  const cells = new Map<number, T[]>();
  // Cell coordinates are small signed ints; pack them into one number key.
  const key = (cx: number, cy: number): number => (cx + 4096) * 8192 + (cy + 4096);
  return {
    clear() {
      for (const list of cells.values()) list.length = 0;
    },
    insert(item) {
      const k = key(Math.floor(item.x / cell), Math.floor(item.y / cell));
      const list = cells.get(k);
      if (list) list.push(item);
      else cells.set(k, [item]);
    },
    query(x, y, radius, out = []) {
      const x0 = Math.floor((x - radius) / cell);
      const x1 = Math.floor((x + radius) / cell);
      const y0 = Math.floor((y - radius) / cell);
      const y1 = Math.floor((y + radius) / cell);
      const r2 = radius * radius;
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const list = cells.get(key(cx, cy));
          if (!list) continue;
          for (const it of list) {
            if ((it.x - x) ** 2 + (it.y - y) ** 2 <= r2) out.push(it);
          }
        }
      }
      return out;
    },
  };
}
