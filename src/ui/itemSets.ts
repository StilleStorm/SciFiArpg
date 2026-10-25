/**
 * The extra lines of an item card (S17): the set a piece belongs to with its two bonuses, and the paragraph a unique carries with
 * the ranks it adds. Used by ui/inventory.ts `detail` and by the notes said when such an item is put on. Plain DOM, built on demand.
 */
import type { Player } from '../entities/types';
import { grantSkill, heroOfSkill } from '../heroes/grants';
import { heroDef } from '../heroes/registry';
import { t } from '../i18n';
import { SET_BONUS_PIECES, SET_PIECES, setOf, wornSetCounts, type SetCounts } from '../items/sets';
import { grantOfItem } from '../items/uniques';
import type { Item } from '../items/types';
import { h } from './dom';

/** How many pieces of the set the player wears right now (counting only those that do something). */
export const wornPieces = (p: Pick<Player, 'equipment'>, item: Item): number => (item.setId ? (wornSetCounts(p.equipment)[item.setId] ?? 0) : 0);

/** The set block of a card: the name with the count worn, then the two bonuses, the reached ones plain and the others struck lightly. */
export function setBlock(p: Pick<Player, 'equipment'>, item: Item): HTMLElement | null {
  const def = setOf(item);
  if (!def) return null;
  const worn = wornPieces(p, item);
  const box = h('div', 'inv-set');
  box.append(h('p', 'inv-set-head', t('items.set.head', { name: t(`items.set.${def.id}.name`), n: worn, max: SET_PIECES })));
  for (const need of SET_BONUS_PIECES) {
    const key = need === SET_BONUS_PIECES[0] ? 'bonus2' : 'bonus3';
    const line = h('p', `inv-set-line ${worn >= need ? 'on' : 'off'}`);
    line.append(h('b', '', t(`items.set.pieces${need}`)), document.createTextNode(` ${t(`items.set.${def.id}.${key}`)}`));
    box.append(line);
  }
  return box;
}

/** The paragraph block of a unique: § n with a red underline, what it does, the ranks, and which hero it concerns. */
export function paragraphBlock(p: Pick<Player, 'heroId'>, item: Item): HTMLElement | null {
  const grant = grantOfItem(item);
  if (!grant) return null;
  const owner = heroOfSkill(grant.skill);
  const box = h('div', 'inv-para');
  if (!owner) return box;
  const mine = grantSkill(p.heroId, grant);
  const head = h('p', 'inv-para-head');
  head.append(h('span', 'para-mark', t('items.unique.paraMark', { n: grant.para })));
  head.append(document.createTextNode(` ${t(`heroes.${owner}.para.${grant.skill}.${grant.para}.name`)}`));
  box.append(head, h('p', 'inv-para-desc', t(`heroes.${owner}.para.${grant.skill}.${grant.para}.desc`)));
  if (mine) box.append(h('p', 'inv-line', t('items.unique.ranks', { skill: t(skillNameKey(owner, grant.skill)), count: grant.ranks })));
  box.append(h('p', 'inv-line', mine ? t('items.unique.concerns', { hero: t(heroDef(owner).nameKey) }) : t('items.unique.notYours', { hero: t(heroDef(owner).nameKey) })));
  return box;
}

/** The i18n key of a skill's name. */
function skillNameKey(owner: Parameters<typeof heroDef>[0], skillId: string): string {
  return heroDef(owner).skills.find((k) => k.id === skillId)?.nameKey ?? skillId;
}

/** "Paragraf dotyczy: <hero>." for a unique with a paragraph (the archive's note, ITEMS 4.2); null for any other item. */
export function heroNote(item: Item): string | null {
  const grant = grantOfItem(item);
  const owner = grant ? heroOfSkill(grant.skill) : null;
  return owner ? t('items.unique.concerns', { hero: t(heroDef(owner).nameKey) }) : null;
}

/**
 * The notes to say when `item` has just been put on: the joint footnote of its set when the second piece is now worn, the line
 * of the three-piece effect when the third is, and for a unique whose paragraph is not the wearer's the line that says so.
 * `before` is `wornSetCounts` taken before the change.
 */
export function equipNotes(p: Pick<Player, 'equipment' | 'heroId'>, item: Item, before: SetCounts): string[] {
  const out: string[] = [];
  const def = setOf(item);
  if (def) {
    const was = before[def.id] ?? 0;
    const now = wornPieces(p, item);
    if (was < SET_BONUS_PIECES[0] && now >= SET_BONUS_PIECES[0]) out.push(t(`items.set.${def.id}.note`));
    if (was < SET_BONUS_PIECES[1] && now >= SET_BONUS_PIECES[1]) out.push(t('items.set.complete', { name: t(`items.set.${def.id}.name`) }));
  }
  const grant = grantOfItem(item);
  if (grant && !grantSkill(p.heroId, grant)) out.push(t('items.unique.notYoursNote'));
  return out;
}
