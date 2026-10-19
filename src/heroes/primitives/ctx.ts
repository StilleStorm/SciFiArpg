/** What every primitive takes: the run state and the event bus. Primitives are plain functions on this; none keeps state of its own. */
import type { Bus, GameEvents } from '../../core/events';
import type { RunState } from '../../world/run';

export interface Ctx {
  s: RunState;
  bus: Bus;
}

export type FxKind = GameEvents['skill:fx']['kind'];

/** Ask the render layer for a sketch of the skill (`skill:fx`): from (x, y) to (x2, y2), or with radius r. */
export function fx(c: Ctx, kind: FxKind, x: number, y: number, r: number, x2 = x, y2 = y): void {
  c.bus.emit('skill:fx', { kind, x, y, x2, y2, r });
}

export interface Point {
  x: number;
  y: number;
}
