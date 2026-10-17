/** Reputacja (XP), AKTUALIZACJA on level up, permissions, one problem report per run (DESIGN section 8). */
export interface Progress {
  level: number;
  xp: number;
}

export function emptyProgress(): Progress {
  return { level: 1, xp: 0 };
}

export * from './xp';
export * from './update';
