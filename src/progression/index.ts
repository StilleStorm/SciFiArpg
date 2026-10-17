/** Stub. Progression agent: xp curve, AKTUALIZACJA entries, permissions, problem report. */
export interface Progress {
  level: number;
  xp: number;
}

export function emptyProgress(): Progress {
  return { level: 1, xp: 0 };
}
