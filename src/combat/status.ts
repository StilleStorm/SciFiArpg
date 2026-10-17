/** Status effects as internet behaviour (DESIGN 5.3). Plain data; one renderer adds a marker per status. */
export type StatusKind = 'zablokowany' | 'wyciszony' | 'zgloszony' | 'przeczytane' | 'do_weryfikacji';

export interface Status {
  kind: StatusKind;
  /** Seconds left. */
  remaining: number;
  /** Entity id that applied it, or null for the world. */
  source: number | null;
}

export interface HasStatuses {
  statuses: Status[];
}

/** Count down every status and drop the expired ones, in place. */
export function tickStatuses(entity: HasStatuses, dt: number): void {
  const list = entity.statuses;
  for (let i = list.length - 1; i >= 0; i--) {
    const st = list[i];
    if (!st) continue;
    st.remaining -= dt;
    if (st.remaining <= 0) list.splice(i, 1);
  }
}

/** Put a status on an entity; an existing status of the same kind is replaced. */
export function applyStatus(entity: HasStatuses, kind: StatusKind, seconds: number, source: number | null): Status {
  const status: Status = { kind, remaining: seconds, source };
  const i = entity.statuses.findIndex((s) => s.kind === kind);
  if (i >= 0) entity.statuses[i] = status;
  else entity.statuses.push(status);
  return status;
}

// ---------- what the statuses do (DESIGN 5.3) ----------

/** Damage taken multiplier of zgloszony. */
export const ZGLOSZONY_DAMAGE = 1.3;
/** Speed multiplier of do_weryfikacji. */
export const WERYFIKACJA_SLOW = 0.5;

export function hasStatus(entity: HasStatuses, kind: StatusKind): boolean {
  return entity.statuses.some((s) => s.kind === kind);
}
export function getStatus(entity: HasStatuses, kind: StatusKind): Status | undefined {
  return entity.statuses.find((s) => s.kind === kind);
}
/** zablokowany: cannot move, attack or use anything. */
export const isStunned = (entity: HasStatuses): boolean => hasStatus(entity, 'zablokowany');
/** wyciszony: cannot use skills (player) or its special (enemy). */
export const isSilenced = (entity: HasStatuses): boolean => hasStatus(entity, 'wyciszony');
/** Movement speed factor from statuses: 0 stunned, 0.5 do_weryfikacji, else 1. */
export function statusSpeedMul(entity: HasStatuses): number {
  if (isStunned(entity)) return 0;
  return hasStatus(entity, 'do_weryfikacji') ? WERYFIKACJA_SLOW : 1;
}
/** Damage taken factor from statuses: 1.3 while zgloszony. */
export const statusDamageTakenMul = (entity: HasStatuses): number => (hasStatus(entity, 'zgloszony') ? ZGLOSZONY_DAMAGE : 1);
