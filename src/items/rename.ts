import { AFFIXES_BY_ID, type Affix } from './affixes';
import { BASES_BY_ID } from './bases';
import { affixesOf, joinName, baseNoun, nameItem } from './grammar';
import { uniqueName } from './uniques';
import { addStats, mapStats, emptyStats, type Item } from './types';

/** Regenerate the Polish name from the item's parts. */
export function renameItem(item: Item): string {
  const affixes = affixesOf(item.affixes);
  if (item.uniqueId) return (item.name = joinName(uniqueName(item.uniqueId), item.gender, affixes));
  const base = BASES_BY_ID.get(item.baseId);
  item.name = base ? nameItem(base, affixes) : joinName(baseNoun(item.baseId), item.gender, affixes);
  return item.name;
}

/**
 * Install an affix on an existing item (the "Wymagana aktualizacja" unwanted feature).
 * It changes both claimed and actual numbers: the listing never mentioned it.
 */
export function addAffix(item: Item, affix: Affix): void {
  if (item.affixes.includes(affix.id)) return;
  item.affixes.push(affix.id);
  const eff = mapStats(addStats(emptyStats(), affix.effect), (v) => v);
  item.claimed = addStats(item.claimed, eff);
  item.actual = addStats(item.actual, eff);
  if (item.claimed.dmgMax < item.claimed.dmgMin) item.claimed.dmgMax = item.claimed.dmgMin;
  if (item.actual.dmgMax < item.actual.dmgMin) item.actual.dmgMax = item.actual.dmgMin;
  if (affix.free) item.freeVersion = true;
  renameItem(item);
}

export const affixById = (id: string): Affix | undefined => AFFIXES_BY_ID.get(id);
