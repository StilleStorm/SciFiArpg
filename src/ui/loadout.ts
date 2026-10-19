/**
 * The loadout sheet (DESIGN 10.1): the pause line "Umiejętności" opens it, in a run and in the base. Five rows (name, type,
 * rank in roman numerals, the one-line description); a skill that no update has installed yet is greyed. Every installed row
 * carries the pad numbers 1 2 3, the pad it occupies marked with a double rule; tapping a number calls `assignPad` (a skill
 * already on another pad swaps with the one on the tapped pad) and redraws. The sheet owns no rules: heroes/loadout.ts does.
 */
import { heroDef, PAD_SLOTS, SKILL_INDICES, type PadSlot, type SkillIndex } from '../heroes';
import { assignPad, effectiveSkill, isInstalled, padOf } from '../heroes/loadout';
import { t } from '../i18n';
import { roman } from '../progression/update';
import type { RunState } from '../world/run';
import { h } from './dom';
import { createSheet, type Sheet } from './sheet';

/** What one row shows; plain data, so it can be tested without a page. */
export interface LoadoutRow {
  index: SkillIndex;
  name: string;
  type: string;
  /** Roman numeral, or the dash at rank 0. */
  rank: string;
  desc: string;
  installed: boolean;
  /** The pad the skill occupies; null for a skill off the pads. */
  pad: PadSlot | null;
  /** The permission line of a skill that is not installed yet ("Wymaga uprawnień: urządzenia."), else null. */
  requires: string | null;
}

export function loadoutRows(s: RunState): LoadoutRow[] {
  const def = heroDef(s.player.heroId);
  return SKILL_INDICES.map((index) => {
    const sk = def.skills[index];
    const installed = isInstalled(s, index);
    const rank = s.hero.ranks[index] ?? 0;
    return {
      index,
      name: t(sk.nameKey),
      type: t(`heroes.types.${effectiveSkill(s, index).type}`), // the active paragraph may change the type
      rank: rank > 0 ? roman(rank) : t('screens.loadout.noRank'),
      desc: t(sk.descKey),
      installed,
      pad: installed ? padOf(s, index) : null,
      requires: !installed && sk.requires ? t('forms.update.requires', { family: t(`forms.update.family.${sk.requires}`) }) : null,
    };
  });
}

export interface LoadoutSheet {
  /** Redraw the rows from the state (after something else changed the pads). */
  refresh(): void;
  close(): void;
}

/** Put the loadout sheet over the page. `onBack` is "Wróć" and the "Zamknij" link: the caller shows the pause sheet again. */
export function openLoadout(root: HTMLElement, s: RunState, onBack: () => void): LoadoutSheet {
  const sheet: Sheet = createSheet(root, { title: t('screens.loadout.title'), sub: t('screens.loadout.sub'), onClose: onBack });
  sheet.el.classList.add('loadout-sheet');
  sheet.note(t('screens.loadout.note'));

  const list = h('div', 'lo-rows');
  const back = h('button', 'pz-btn lo-back', t('screens.loadout.back'));
  back.type = 'button';
  back.dataset['loadout'] = 'back';
  back.addEventListener('click', onBack);
  sheet.scroll.append(list, back);

  function draw(): void {
    list.replaceChildren();
    for (const row of loadoutRows(s)) {
      const el = h('div', `lo-row${row.installed ? '' : ' off'}`);
      el.dataset['skill'] = String(row.index);
      const head = h('div', 'lo-head');
      head.append(h('span', 'lo-name', row.name), h('span', 'lo-type', row.type), h('span', 'lo-rank', row.rank));
      el.append(head, h('p', 'lo-desc', row.desc));
      const foot = h('div', 'lo-foot');
      if (row.installed) {
        for (const slot of PAD_SLOTS) {
          const on = row.pad === slot;
          const b = h('button', `lo-pad${on ? ' on' : ''}`, String(slot + 1));
          b.type = 'button';
          b.dataset['pad'] = String(slot + 1);
          b.setAttribute('aria-label', t(on ? 'screens.loadout.padTaken' : 'screens.loadout.pad', { n: slot + 1 }));
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.addEventListener('click', () => {
            if (assignPad(s, slot, row.index)) draw();
          });
          foot.append(b);
        }
      } else {
        foot.append(h('span', 'lo-off', t('screens.loadout.notInstalled')));
        if (row.requires) foot.append(h('span', 'lo-req', row.requires));
      }
      el.append(foot);
      list.append(el);
    }
  }
  draw();

  return {
    refresh: draw,
    close: () => sheet.remove(),
  };
}
