/**
 * KONFIGURACJA (DESIGN 10.2): per skill three paragraph boxes (§ 1, § 2, § 3), the active one stamped; a tap on an owned box
 * switches. Opens from the desk (base) and from the pause sheet line "Paragrafy" (run and base). The sheet owns no rules: it reads
 * the schedule and the paragraph texts from progression/paragraphs.ts and switches with `setRunParagraph` (the save keeps the run's).
 */
import { heroDef, SKILL_INDICES, type SkillIndex } from '../heroes/defs';
import { effectiveSkill, isInstalled } from '../heroes/loadout';
import { t } from '../i18n';
import { isParagraphUnlocked, paragraphLevel, paragraphsOf, runParagraph, runProgress, setRunParagraph, type ParagraphNo } from '../progression/paragraphs';
import { PARAGRAPH_NOS } from '../heroes/paragraphs';
import { stamp } from '../render/ink';
import { el } from '../render/svg';
import type { RunState } from '../world/run';
import { h } from './dom';
import { createSheet, type Sheet } from './sheet';
import './konfiguracja.css';

/** `open`: unlocked (by level or permission), a tap makes it active. `locked`: its level has not come. */
export type BoxState = 'active' | 'open' | 'locked';

export interface KonfBox {
  n: ParagraphNo;
  name: string;
  desc: string;
  state: BoxState;
  /** The hero level that opens a locked box. */
  level: number;
}

export interface KonfRow {
  skill: SkillIndex;
  /** The skill id the engine keys paragraphs by. */
  id: string;
  name: string;
  type: string;
  installed: boolean;
  boxes: KonfBox[];
}

/** What the sheet shows, as plain data. */
export function konfiguracjaRows(s: RunState): KonfRow[] {
  const heroId = s.player.heroId;
  const def = heroDef(heroId);
  const progress = runProgress(s);
  return SKILL_INDICES.map((skill) => {
    const sk = def.skills[skill];
    const installed = isInstalled(s, skill);
    const active = runParagraph(s, skill);
    const views = paragraphsOf(heroId, sk.id);
    const boxes = PARAGRAPH_NOS.map((n): KonfBox => {
      const v = views[n - 1];
      const state: BoxState = n === active ? 'active' : isParagraphUnlocked(progress, sk.id, n) ? 'open' : 'locked';
      return { n, name: v ? t(v.nameKey) : '', desc: v ? t(v.descKey) : '', state, level: paragraphLevel(heroId, sk.id, n) };
    });
    return { skill, id: sk.id, name: t(sk.nameKey), type: t(`heroes.types.${effectiveSkill(s, skill).type}`), installed, boxes };
  });
}

export interface KonfiguracjaSheet {
  refresh(): void;
  close(): void;
  /** The sheet element, so the caller can hide the sheet it stands over. */
  el: HTMLElement;
}

function caption(b: KonfBox): string {
  return b.state === 'locked' ? t('forms.konfiguracja.lockedAt', { level: b.level }) : b.name;
}

/** Put the Konfiguracja sheet over the page. `onBack` is "Wróć" and "Zamknij": the caller shows what stood under it. */
export function openKonfiguracja(root: HTMLElement, s: RunState, onBack: () => void): KonfiguracjaSheet {
  const sheet: Sheet = createSheet(root, { title: t('forms.konfiguracja.title'), sub: t('forms.konfiguracja.sub'), onClose: onBack });
  sheet.el.classList.add('kf-sheet');
  sheet.note(t('forms.konfiguracja.note'));
  const list = h('div', 'kf-rows');
  const back = h('button', 'pz-btn kf-back', t('forms.konfiguracja.back'));
  back.type = 'button';
  back.dataset['konfiguracja'] = 'back';
  back.addEventListener('click', onBack);
  sheet.scroll.append(list, back);

  function draw(): void {
    list.replaceChildren();
    for (const row of konfiguracjaRows(s)) {
      const rowEl = h('div', `kf-row${row.installed ? '' : ' off'}`);
      rowEl.dataset['skill'] = String(row.skill);
      const head = h('div', 'kf-head');
      head.append(h('span', 'kf-name', row.name), h('span', 'kf-type', row.type));
      rowEl.append(head);
      if (!row.installed) {
        rowEl.append(h('p', 'kf-off', t('forms.konfiguracja.notInstalled')));
        list.append(rowEl);
        continue;
      }
      const boxes = h('div', 'kf-boxes');
      for (const b of row.boxes) {
        const btn = h('button', `kf-box ${b.state}`);
        btn.type = 'button';
        btn.dataset['n'] = String(b.n);
        btn.disabled = b.state === 'locked';
        btn.setAttribute('aria-pressed', b.state === 'active' ? 'true' : 'false');
        btn.setAttribute('aria-label', t('forms.konfiguracja.boxLabel', { n: b.n, name: caption(b) }));
        btn.append(h('span', 'kf-n', t('forms.konfiguracja.section', { n: b.n })), h('span', 'kf-cap', caption(b)));
        if (b.state === 'active') {
          const svg = el('svg', { class: 'kf-stamp', viewBox: '-66 -19 132 38', 'aria-hidden': 'true' });
          const g = el('g', {});
          svg.append(g);
          btn.append(svg);
          stamp(t('forms.konfiguracja.active'), 0, 0, { parent: g, ttl: Infinity, rotation: -3, fontSize: 14 });
        }
        btn.addEventListener('click', () => {
          if (b.state !== 'open') return;
          if (setRunParagraph(s, row.id, b.n)) draw();
        });
        boxes.append(btn);
      }
      const act = row.boxes.find((b) => b.state === 'active');
      const desc = h('p', 'kf-desc');
      if (act) desc.append(h('span', 'kf-dname', act.name), act.desc); // the stamp covers the active box's name, so it heads the description
      rowEl.append(boxes, desc);
      list.append(rowEl);
    }
  }
  draw();
  return { refresh: draw, close: () => sheet.remove(), el: sheet.el };
}

/** The desk row, in the right-hand column of the desk next to the hero line. Call right after the desk sheet was opened. */
export function addDeskLine(root: HTMLElement, onOpen: () => void): void {
  const col = root.querySelector('.desk-sheet .desk-col-b');
  if (!col) return;
  const row = h('div', 'trow kf-deskrow');
  const btn = h('button', 'link-btn', t('forms.konfiguracja.deskLine'));
  btn.type = 'button';
  btn.dataset['desk'] = 'konfiguracja';
  btn.addEventListener('click', onOpen);
  row.append(h('label', '', t('forms.konfiguracja.deskNote')), btn);
  col.append(row);
}
