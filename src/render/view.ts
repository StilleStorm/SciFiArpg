import type { Entity, EntityKind } from '../entities';
import { drawIn } from './ink';

/**
 * How an entity kind looks. `create` builds the `<g>` once; `patch` may update a few
 * attributes per frame (never rebuild children). Position/facing are handled by the view sync.
 */
export interface Builder<E extends Entity> {
  create(e: E): SVGGElement;
  patch?(e: E, g: SVGGElement, timeMs: number): void;
  /** If set, strokes are drawn in over this many ms when the view is created. */
  drawInMs?: number;
}

export type Builders = { [K in EntityKind]: Builder<Extract<Entity, { kind: K }>> };

export interface Views {
  /** Create views for new entities, patch existing ones, remove views of vanished ones. */
  sync(entities: Iterable<Entity>, timeMs: number): void;
  get(id: number): SVGGElement | undefined;
  /** Forget the view but leave its node in the DOM, so a death animation can finish and remove it. */
  detach(id: number): SVGGElement | undefined;
  clear(): void;
  readonly size: number;
}

interface Slot {
  g: SVGGElement;
  transform: string;
  seen: number;
}

const r1 = (n: number): string => (Math.round(n * 10) / 10).toString();

export function createViews(layer: SVGGElement, builders: Builders): Views {
  const slots = new Map<number, Slot>();
  let pass = 0;

  function make(e: Entity): SVGGElement {
    switch (e.kind) {
      case 'player':
        return decorate(builders.player.create(e), builders.player.drawInMs);
      case 'enemy':
        return decorate(builders.enemy.create(e), builders.enemy.drawInMs);
      case 'pickup':
        return decorate(builders.pickup.create(e), builders.pickup.drawInMs);
      case 'projectile':
        return decorate(builders.projectile.create(e), builders.projectile.drawInMs);
      case 'summon':
        return decorate(builders.summon.create(e), builders.summon.drawInMs);
      case 'zone':
        return decorate(builders.zone.create(e), builders.zone.drawInMs);
    }
  }
  function patch(e: Entity, g: SVGGElement, timeMs: number): void {
    switch (e.kind) {
      case 'player':
        builders.player.patch?.(e, g, timeMs);
        break;
      case 'enemy':
        builders.enemy.patch?.(e, g, timeMs);
        break;
      case 'pickup':
        builders.pickup.patch?.(e, g, timeMs);
        break;
      case 'projectile':
        builders.projectile.patch?.(e, g, timeMs);
        break;
      case 'summon':
        builders.summon.patch?.(e, g, timeMs);
        break;
      case 'zone':
        builders.zone.patch?.(e, g, timeMs);
        break;
    }
  }
  const pending = new WeakMap<SVGGElement, number>();
  function decorate(g: SVGGElement, ms: number | undefined): SVGGElement {
    if (ms) pending.set(g, ms);
    return g;
  }

  return {
    sync(entities, timeMs) {
      pass++;
      for (const e of entities) {
        let slot = slots.get(e.id);
        if (!slot) {
          const g = make(e);
          g.dataset['id'] = String(e.id);
          g.dataset['kind'] = e.kind;
          if (e.kind === 'pickup' || e.kind === 'zone') layer.prepend(g);
          else layer.append(g);
          slot = { g, transform: '', seen: pass };
          slots.set(e.id, slot);
          const ms = pending.get(g);
          if (ms) drawIn(g, ms);
        }
        slot.seen = pass;
        const flip = e.kind === 'player' || e.kind === 'enemy' || e.kind === 'summon' ? e.facing : 1;
        const tf = `translate(${r1(e.x)} ${r1(e.y)})${flip < 0 ? ' scale(-1 1)' : ''}`;
        if (tf !== slot.transform) {
          slot.transform = tf;
          slot.g.setAttribute('transform', tf);
        }
        patch(e, slot.g, timeMs);
      }
      for (const [id, slot] of slots) {
        if (slot.seen !== pass) {
          slot.g.remove();
          slots.delete(id);
        }
      }
    },
    get: (id) => slots.get(id)?.g,
    detach(id) {
      const slot = slots.get(id);
      slots.delete(id);
      return slot?.g;
    },
    clear() {
      for (const slot of slots.values()) slot.g.remove();
      slots.clear();
    },
    get size() {
      return slots.size;
    },
  };
}
