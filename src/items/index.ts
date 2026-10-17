export type Slot = 'bron' | 'nakrycie' | 'odziez' | 'przyrzad' | 'dokument';
export const SLOTS: readonly Slot[] = ['bron', 'nakrycie', 'odziez', 'przyrzad', 'dokument'];

/** Placeholder item. Items agent: replace with generated items (base, affixes, tier, claimed/actual stats). */
export interface Item {
  name: string;
  slot: Slot;
}

export function placeholderItem(): Item {
  return { name: 'przedmiot', slot: 'przyrzad' };
}
