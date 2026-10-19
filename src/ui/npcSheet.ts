/**
 * The short sheet of a person on the base page (world/npc.ts): the nameplate, the role, three lines the Asystent copied down,
 * and whatever the person has to do with the side tickets (a parcel handed over). No choices, no tree. Opened from main.ts
 * when `station:opened` names the clerk.
 */
import { t } from '../i18n';
import type { NpcDef } from '../world/npc';
import { h } from './dom';
import { inkStamp } from './karta-osobowa';
import { createSheet, type Sheet } from './sheet';
import './npc-sheet.css';

export interface NpcSheetHandlers {
  onClose(): void;
}

export interface NpcSheet {
  close(): void;
  el: HTMLElement;
}

/** `handed`: the titles of the tickets whose parcel was taken on this visit. */
export function openNpcSheet(root: HTMLElement, def: NpcDef, handed: string[], handlers: NpcSheetHandlers): NpcSheet {
  const sheet: Sheet = createSheet(root, { title: t(def.nameKey), sub: t(def.roleKey), onClose: handlers.onClose });
  sheet.el.classList.add('npc-sheet');
  sheet.el.dataset['npc'] = def.id;
  const body = h('div', 'npc-body');
  const lines = h('div', 'npc-lines');
  for (const key of def.lineKeys) lines.append(h('p', 'npc-line', t(key)));
  body.append(lines);
  if (handed.length > 0) {
    for (const title of handed) {
      const slip = h('div', 'npc-slip');
      slip.dataset['handed'] = '1';
      slip.append(h('p', '', t('screens.npc.parcel', { title })), inkStamp(t('screens.quests.stamp'), 14, -4, 'os-stamp'));
      body.append(slip);
    }
  }
  const back = h('button', 'pz-btn npc-back', t('screens.npc.back'));
  back.type = 'button';
  back.dataset['npc'] = 'back';
  back.addEventListener('click', handlers.onClose);
  body.append(back);
  sheet.scroll.append(body);
  return { el: sheet.el, close: () => sheet.remove() };
}
