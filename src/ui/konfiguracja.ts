/**
 * KONFIGURACJA (DESIGN 10.2): the loadout form. Four slots on top (pads 1..3 and the ultimate), the specialization column with its
 * capstone line, then per skill its category, a pad chooser and three paragraph boxes (§ 1, § 2, § 3), the active one stamped; the
 * ultimate closes the list. A tap on an owned box switches. Opens from the desk (base) and from the pause sheet line "Konfiguracja"
 * (run and base). The sheet owns no rules: it reads the schedule and the paragraph texts from progression/paragraphs.ts, switches
 * with `setRunParagraph`, and writes the loadout through ui/konfLoadout.ts (`commitLoadout`, which ends in heroes/specializations.ts
 * `setLoadout`). Categories, columns and the capstone come from heroes/specializations.ts.
 */
import { heroDef, PAD_SLOTS, SKILL_INDICES, type PadSlot, type SkillIndex } from '../heroes/defs';
import { effectiveSkill, isInstalled } from '../heroes/loadout';
import { setUltimateParagraph, ultimateOf, ultRun } from '../heroes/ultimate';
import { t } from '../i18n';
import { isParagraphUnlocked, paragraphLevel, paragraphsOf, runParagraph, runProgress, setRunParagraph, type ParagraphNo } from '../progression/paragraphs';
import { PARAGRAPH_NOS } from '../heroes/paragraphs';
import { stamp } from '../render/ink';
import { el } from '../render/svg';
import type { RunState } from '../world/run';
import { h } from './dom';
import { createSheet, type Sheet } from './sheet';
import { activeCapstone, capstoneCount, categoryNameKey, categoryOf, loadoutAdvice, specializationOf, specializationsOf, type SkillCategory, type Specialization } from '../heroes/specializations';
import { chosenSpec, commitLoadout, viewOf } from './konfLoadout';
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
  /** Null for a skill the hero data gives no category (the line then shows the type only). */
  category: SkillCategory | null;
  /** The pad (0..2) that fires it, if any. */
  pad: PadSlot | null;
  boxes: KonfBox[];
}

/** The ultimate row: closed until the hero's level opens it; its paragraphs switch the next cast. */
export interface KonfUltimate {
  name: string;
  type: string;
  level: number;
  locked: boolean;
  desc: string;
  boxes: KonfBox[];
}

/** A column of the specialization strip. */
export interface KonfSpec {
  id: string;
  name: string;
  have: number;
  total: number;
  /** The player chose this column. */
  chosen: boolean;
  /** Its capstone is in force (chosen and >= 2 of its skills on the pads). */
  active: boolean;
}

/** Move skill `i` onto `slot` of the three pads: a skill already on another pad swaps places with the one on `slot` (as `assignPad`). */
export function padsWith(pads: readonly SkillIndex[], slot: PadSlot, i: SkillIndex): SkillIndex[] {
  const out = [...pads];
  const was = out[slot];
  const other = out.indexOf(i);
  if (other >= 0 && was !== undefined) out[other] = was;
  out[slot] = i;
  return out;
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
    const padAt = PAD_SLOTS.find((slot) => s.hero.pads[slot] === skill);
    return { skill, id: sk.id, name: t(sk.nameKey), type: t(`heroes.types.${effectiveSkill(s, skill).type}`), installed, category: categoryOf(sk), pad: padAt ?? null, boxes };
  });
}

/** The ultimate row as data, or null for a hero without one. */
export function konfiguracjaUltimate(s: RunState): KonfUltimate | null {
  const def = ultimateOf(s);
  if (!def) return null;
  const locked = s.player.level < def.level;
  const active = ultRun(s).para;
  const boxes = def.list.map((p): KonfBox => ({ n: p.n, name: t(p.nameKey), desc: t(p.descKey), state: locked ? 'locked' : p.n === active ? 'active' : 'open', level: def.level }));
  return { name: t(def.nameKey), type: t(`heroes.types.${def.type}`), level: def.level, locked, desc: t(def.descKey), boxes };
}

/** The three columns with how many of their skills stand on the pads, the chosen one, and whether its capstone is in force. */
export function konfiguracjaSpecs(s: RunState): { specs: KonfSpec[]; chosen: Specialization | null; active: boolean } {
  const view = viewOf(s);
  const granted = activeCapstone(view);
  const chosenId = chosenSpec(s);
  const specs = specializationsOf(view.heroId).map(
    (sp): KonfSpec => ({ id: sp.id, name: t(sp.nameKey), have: capstoneCount(view, sp.id), total: sp.skills.length, chosen: sp.id === chosenId, active: granted?.spec.id === sp.id }),
  );
  return { specs, chosen: chosenId ? (specializationOf(view.heroId, chosenId) ?? null) : null, active: granted !== null };
}

/**
 * A line at the foot of a sheet's scroll area that says there is more form below, shown only while there is. Returns `update`,
 * to call after the content changed, and `dispose`.
 */
export function attachScrollCue(sheet: Pick<Sheet, 'scroll'>, key: string): { update(): void; dispose(): void } {
  const cue = h('div', 'kf-cue');
  const svg = el('svg', { viewBox: '0 0 16 12', width: 16, height: 12, 'aria-hidden': 'true' });
  svg.setAttribute('style', 'fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round;overflow:visible');
  svg.append(el('path', { d: 'M8 1V10M3 6L8 11L13 6' }));
  cue.append(svg, h('span', '', t(key)));
  sheet.scroll.after(cue);
  const update = (): void => {
    const sc = sheet.scroll;
    cue.classList.toggle('on', sc.scrollHeight - sc.scrollTop - sc.clientHeight > 6);
  };
  sheet.scroll.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  const obs = new MutationObserver(update);
  obs.observe(sheet.scroll, { childList: true, subtree: true });
  update();
  return {
    update,
    dispose: () => {
      window.removeEventListener('resize', update);
      obs.disconnect();
    },
  };
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

function stampBox(btn: HTMLElement): void {
  const svg = el('svg', { class: 'kf-stamp', viewBox: '-66 -19 132 38', 'aria-hidden': 'true' });
  const g = el('g', {});
  svg.append(g);
  btn.append(svg);
  stamp(t('forms.konfiguracja.active'), 0, 0, { parent: g, ttl: Infinity, rotation: -3, fontSize: 14 });
}

/** The three paragraph boxes of a skill or of the ultimate; `pick` is called for an open box. */
function boxesOf(boxes: readonly KonfBox[], pick: (b: KonfBox) => void): HTMLElement {
  const wrap = h('div', 'kf-boxes');
  for (const b of boxes) {
    const btn = h('button', `kf-box ${b.state}`);
    btn.type = 'button';
    btn.dataset['n'] = String(b.n);
    btn.disabled = b.state === 'locked';
    btn.setAttribute('aria-pressed', b.state === 'active' ? 'true' : 'false');
    btn.setAttribute('aria-label', t('forms.konfiguracja.boxLabel', { n: b.n, name: caption(b) }));
    btn.append(h('span', 'kf-n', t('forms.konfiguracja.section', { n: b.n })), h('span', 'kf-cap', caption(b)));
    if (b.state === 'active') stampBox(btn);
    btn.addEventListener('click', () => {
      if (b.state === 'open') pick(b);
    });
    wrap.append(btn);
  }
  return wrap;
}

/** Put the Konfiguracja sheet over the page. `onBack` is "Wróć" and "Zamknij": the caller shows what stood under it. */
export function openKonfiguracja(root: HTMLElement, s: RunState, onBack: () => void): KonfiguracjaSheet {
  const sheet: Sheet = createSheet(root, { title: t('forms.konfiguracja.title'), sub: t('forms.konfiguracja.sub'), onClose: onBack });
  sheet.el.classList.add('kf-sheet');
  sheet.note(t('forms.konfiguracja.note'));
  const top = h('div', 'kf-top');
  const list = h('div', 'kf-rows');
  const advice = h('p', 'kf-advice');
  const back = h('button', 'pz-btn kf-back', t('forms.konfiguracja.back'));
  back.type = 'button';
  back.dataset['konfiguracja'] = 'back';
  back.addEventListener('click', onBack);
  sheet.scroll.append(top, list, advice, back);
  const cue = attachScrollCue(sheet, 'forms.konfiguracja.cue');
  const def = heroDef(s.player.heroId);

  function drawTop(): void {
    top.replaceChildren();
    // the four slots: pads 1..3 and the ultimate
    const slots = h('div', 'kf-slots');
    for (const slot of PAD_SLOTS) {
      const sk = def.skills[s.hero.pads[slot]];
      const cell = h('div', 'kf-slot');
      cell.dataset['slot'] = String(slot + 1);
      cell.append(h('span', 'kf-slotn', t('forms.konfiguracja.slotPad', { n: slot + 1 })), h('span', 'kf-slotv', sk ? t(sk.nameKey) : t('forms.konfiguracja.slotNone')));
      slots.append(cell);
    }
    const ult = konfiguracjaUltimate(s);
    const uc = h('div', `kf-slot ult${ult?.locked ? ' off' : ''}`);
    uc.dataset['slot'] = 'ult';
    uc.append(h('span', 'kf-slotn', t('forms.konfiguracja.slotUlt')), h('span', 'kf-slotv', ult ? (ult.locked ? t('forms.konfiguracja.slotLocked', { level: ult.level }) : ult.name) : t('forms.konfiguracja.slotNone')));
    slots.append(uc);
    top.append(h('div', 'kf-label', t('forms.konfiguracja.slots')), slots);

    // the specialization columns and the capstone line
    const { specs, chosen, active } = konfiguracjaSpecs(s);
    const strip = h('div', 'kf-specs');
    for (const sp of specs) {
      const btn = h('button', `kf-spec${sp.chosen ? ' on' : ''}`);
      btn.type = 'button';
      btn.dataset['spec'] = sp.id;
      btn.setAttribute('aria-pressed', sp.chosen ? 'true' : 'false');
      btn.setAttribute('aria-label', `${sp.name}. ${t('forms.konfiguracja.specCountLabel', { have: sp.have, total: sp.total })}`);
      btn.append(h('span', 'kf-spec-name', sp.name), h('span', 'kf-spec-n', t('forms.konfiguracja.specCount', { have: sp.have, total: sp.total })));
      btn.addEventListener('click', () => {
        commitLoadout(s, { specialization: sp.chosen ? null : sp.id }); // a second tap withdraws the choice
        draw();
      });
      strip.append(btn);
    }
    const cap = h('p', 'kf-cap-line');
    if (chosen) {
      cap.append(h('b', '', `${t('forms.konfiguracja.capstone')}: ${t(chosen.capstone.nameKey)}. `), `${t(chosen.capstone.descKey)} `, h('i', active ? 'granted' : 'idle', t(active ? 'forms.konfiguracja.capGranted' : 'forms.konfiguracja.capIdle')));
    } else {
      cap.append(h('i', 'idle', t('forms.konfiguracja.capNone')));
    }
    top.append(h('div', 'kf-label', t('forms.konfiguracja.specTitle')), strip, cap);
  }

  function drawRows(): void {
    list.replaceChildren();
    for (const row of konfiguracjaRows(s)) {
      const rowEl = h('div', `kf-row${row.installed ? '' : ' off'}`);
      rowEl.dataset['skill'] = String(row.skill);
      const head = h('div', 'kf-head');
      const id = h('div', 'kf-id');
      id.append(h('span', 'kf-name', row.name), h('span', 'kf-type', row.category ? `${row.type} · ${t(categoryNameKey(row.category))}` : row.type));
      head.append(id);
      if (row.installed) {
        const pads = h('div', 'kf-pads');
        for (const slot of PAD_SLOTS) {
          const b = h('button', `kf-pad${row.pad === slot ? ' on' : ''}`, String(slot + 1));
          b.type = 'button';
          b.dataset['pad'] = String(slot + 1);
          b.setAttribute('aria-pressed', row.pad === slot ? 'true' : 'false');
          b.setAttribute('aria-label', t('forms.konfiguracja.padLabel', { skill: row.name, n: slot + 1 }));
          b.addEventListener('click', () => {
            if (row.pad === slot) return;
            const next = padsWith(s.hero.pads, slot, row.skill);
            commitLoadout(s, { pads: [next[0] ?? 0, next[1] ?? 1, next[2] ?? 2] });
            draw();
          });
          pads.append(b);
        }
        head.append(pads);
      }
      rowEl.append(head);
      if (!row.installed) {
        rowEl.append(h('p', 'kf-off', t('forms.konfiguracja.notInstalled')));
        list.append(rowEl);
        continue;
      }
      const boxes = boxesOf(row.boxes, (b) => {
        if (setRunParagraph(s, row.id, b.n)) draw();
      });
      const act = row.boxes.find((b) => b.state === 'active');
      const desc = h('p', 'kf-desc');
      if (act) desc.append(h('span', 'kf-dname', act.name), act.desc); // the stamp covers the active box's name, so it heads the description
      rowEl.append(boxes, desc);
      list.append(rowEl);
    }
    const ult = konfiguracjaUltimate(s);
    if (ult) {
      const rowEl = h('div', `kf-ultrow${ult.locked ? ' off' : ''}`);
      rowEl.dataset['skill'] = 'ult';
      const head = h('div', 'kf-head');
      const id = h('div', 'kf-id');
      id.append(h('span', 'kf-name', ult.name), h('span', 'kf-type', `${ult.type} · ${t(categoryNameKey('ostateczna'))}`));
      head.append(id);
      rowEl.append(head);
      if (ult.locked) {
        rowEl.append(h('p', 'kf-off', t('forms.konfiguracja.ultLocked', { level: ult.level })));
      } else {
        const boxes = boxesOf(ult.boxes, (b) => {
          setUltimateParagraph(s, b.n);
          draw();
        });
        const act = ult.boxes.find((b) => b.state === 'active');
        const desc = h('p', 'kf-desc');
        if (act) desc.append(h('span', 'kf-dname', act.name), act.desc);
        rowEl.append(boxes, desc);
      }
      list.append(rowEl);
    }
    // advisory only: the rule of three is recommended, not enforced
    const missing = loadoutAdvice(viewOf(s));
    advice.textContent = missing.length > 0 ? t('forms.konfiguracja.adviceMissing', { missing: missing.map((c) => t(categoryNameKey(c))).join(', ') }) : t('forms.konfiguracja.adviceOk');
  }

  function draw(): void {
    drawTop();
    drawRows();
    cue.update();
  }
  draw();
  return {
    refresh: draw,
    close: () => {
      cue.dispose();
      sheet.remove();
    },
    el: sheet.el,
  };
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
