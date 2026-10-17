import { isStunned, statusSpeedMul } from '../combat/status';
import type { Bus } from '../core/events';
import { resolveMove } from '../world/pages';
import type { RunState } from '../world/run';

const ARRIVE = 3;
const STUCK_LIMIT = 0.35;
const EDGE_NOTE_COOLDOWN = 3;

/** Walk the player toward `player.target`, slide along obstacles, stop at the page edge. */
export function movePlayer(s: RunState, bus: Bus, dt: number): void {
  const p = s.player;
  s.edgeCooldown = Math.max(0, s.edgeCooldown - dt);
  p.moving = false;
  const speed = p.speed * statusSpeedMul(p); // do_weryfikacji halves it, zablokowany stops it
  if (isStunned(p)) {
    p.stuck = 0;
    resolveMove(s.page, p, p.r);
    return;
  }
  if (p.target) {
    const dx = p.target.x - p.x;
    const dy = p.target.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < ARRIVE) {
      p.target = null;
    } else {
      const step = Math.min(d, speed * dt);
      const bx = p.x;
      const by = p.y;
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
      p.moving = true;
      if (Math.abs(dx) > 0.5) p.facing = dx > 0 ? 1 : -1;
      const side = resolveMove(s.page, p, p.r);
      if (side) {
        if (s.edgeCooldown <= 0) {
          s.edgeCooldown = EDGE_NOTE_COOLDOWN;
          bus.emit('page:edge', { x: p.x, y: p.y, side });
        }
        p.target = null;
        p.moving = false;
      } else if (Math.hypot(p.x - bx, p.y - by) < step * 0.25) {
        p.stuck += dt;
        if (p.stuck > STUCK_LIMIT) {
          p.target = null;
          p.moving = false;
        }
      } else {
        p.stuck = 0;
      }
      return;
    }
  }
  p.stuck = 0;
  resolveMove(s.page, p, p.r);
}
