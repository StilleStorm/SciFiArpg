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
