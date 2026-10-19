import { createRng } from '../core/rng';
import { BASES, BASES_BY_ID } from '../items/bases';
import { buildItem, rollItem } from '../items/generate';
import { renameItem } from '../items/rename';
import { ITEM_TIERS, SLOTS, type Item, type ItemTier } from '../items/types';
import { buildPickupCard } from '../render/pickupCard';
import { el } from '../render/svg';
import { h } from './dom';
import { captionNode, displayName, figure, tierWord } from './itemView';

/** Screenshot gallery (testHook only): `tiers` = a figure per slot and tier, `bases` = all 40 drawings, `affixes` = absurd marks, `ground` = ground plates. */
export type GalleryMode = 'tiers' | 'bases' | 'affixes' | 'ground';

const AFFIX_DEMO: readonly (readonly string[])[] = [
  ['domniemany'],
  ['ewentualny'],
  ['sponsorowany'],
  ['probny'],
  ['rzekomy'],
  ['wycofany'],
  ['darmowy'],
  ['asystent'],
];

function demoItems(mode: GalleryMode): Item[] {
  const out: Item[] = [];
  let n = 1;
  const push = (it: Item): void => {
    it.number = n++;
    renameItem(it);
    out.push(it);
  };
  if (mode === 'bases') {
    for (const b of BASES) push(buildItem(createRng(40 + n), b, ITEM_TIERS[n % 4] as ItemTier, 3, []));
  } else if (mode === 'affixes') {
    const base = BASES_BY_ID.get('regulamin');
    if (!base) return out;
    for (const ids of AFFIX_DEMO) {
      const it = buildItem(createRng(70 + n), base, 'zwykly', 3, ids);
      if (ids[0] === 'darmowy') it.freeVersion = true;
      push(it);
    }
  } else {
    for (const slot of SLOTS) for (const tier of ITEM_TIERS) push(rollItem(createRng(300 + n), { level: 3, slot, tier }));
  }
  return out;
}

export function mountGallery(mode: GalleryMode): void {
  document.getElementById('item-gallery')?.remove();
  const root = h('div', 'item-gallery');
  root.id = 'item-gallery';
  root.style.cssText = 'position:fixed;inset:0;z-index:99;background:var(--paper);overflow:auto;padding:8px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;align-content:start';
  const items = demoItems(mode);
  if (mode === 'ground') {
    const svg = el('svg', { viewBox: '0 0 380 560', width: '100%', style: 'grid-column:1/-1;fill:none;stroke:var(--ink);stroke-width:1.4' });
    items.forEach((item, i) => {
      const card = buildPickupCard({ kind: 'pickup', id: 800 + i, x: 0, y: 0, r: 14, number: item.number, item });
      card.setAttribute('transform', `translate(${48 + (i % 4) * 94} ${44 + Math.floor(i / 4) * 52})`);
      svg.append(card);
    });
    root.append(svg);
  } else {
    for (const item of items) {
      const cell = h('div', 'gal-cell');
      cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;font:10px var(--mono);text-align:center';
      const cap = captionNode(item);
      cell.append(figure(item, 76), cap, h('span', 'gal-name', `${displayName(item)} (${tierWord(item)})`));
      root.append(cell);
    }
  }
  document.body.append(root);
}
