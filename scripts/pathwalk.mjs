// Shared by the milestone scripts: walk the player to the exit of the current page around the props, as a player steering would.
// `gate.push` walks in a straight line and gets stuck behind a building collider on the denser Akt II pages (miasto, biuro, centrum);
// A law may print a sheet (the code of Weryfikacja dwuetapowa) and hold the run: the walk stops then and the caller settles it and calls again.
// this breadth-first search over the page's circle colliders gives waypoints, then the game runs on for real (60 Hz steps).
// Self-contained on purpose: Playwright serializes the function source into the page (`page.evaluate(pathWalk, seconds)`).
export function pathWalk(maxSeconds) {
  const h = window.__game;
  const s = h.state();
  const pg = s.page;
  const e = pg.exit;
  if (!e) return { turned: false, page: s.pageIndex, steps: 0, reason: 'no exit' };
  const from = s.pageIndex;
  const R = 18; // a little more than the player's body
  const G = 10;
  const W = Math.ceil(pg.w / G);
  const H = Math.ceil(pg.h / G);
  const lo = pg.inset + R;
  const free = (x, y) => {
    if (x < lo || x > pg.w - lo || y < lo || y > pg.h - lo) return false;
    for (const o of pg.obstacles) for (const c of o.colliders) if (Math.hypot(x - c.x, y - c.y) < c.r + R) return false;
    return true;
  };
  const goal = (x, y) => Math.hypot(x - e.x, y - e.y) < 85;
  const start = [Math.max(0, Math.min(W - 1, Math.round(s.player.x / G))), Math.max(0, Math.min(H - 1, Math.round(s.player.y / G)))];
  const prev = new Int32Array(W * H).fill(-2);
  const q = [start[1] * W + start[0]];
  prev[q[0]] = -1;
  let found = -1;
  for (let qi = 0; qi < q.length && found < 0; qi++) {
    const cur = q[qi];
    const cx = cur % W;
    const cy = (cur - cx) / W;
    if (goal(cx * G, cy * G)) {
      found = cur;
      break;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (prev[ni] !== -2 || !free(nx * G, ny * G)) continue;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (found < 0) return { turned: false, page: s.pageIndex, steps: 0, reason: 'no path' };
  const cells = [];
  for (let c = found; c >= 0; c = prev[c]) cells.push(c);
  cells.reverse();
  const way = cells.filter((_, i) => i % 6 === 0 || i === cells.length - 1).map((c) => ({ x: (c % W) * G, y: Math.floor(c / W) * G }));
  way.push({ x: e.x, y: e.y });
  let k = 0;
  let steps = 0;
  s.enemies.length = 0;
  s.player.target = way[0];
  while (steps < Math.round(maxSeconds * 60) && s.pageIndex === from && !s.turning && !s.modal) {
    s.enemies.length = 0;
    const t = way[k];
    if (Math.hypot(s.player.x - t.x, s.player.y - t.y) < 14 && k < way.length - 1) k++;
    s.player.target = way[k];
    h.advance(1 / 60);
    steps++;
  }
  return { turned: s.pageIndex !== from || s.turning, page: s.pageIndex, steps, way: way.length, reason: null, at: [Math.round(s.player.x), Math.round(s.player.y)], exit: [e.x, e.y], phase: s.phase, status: s.status, modal: s.modal ?? null, susp: !!s.player.suspended, hp: s.player.hp };
}
