/** AKTUALIZACJA as a typed form laid over the paused page. Dumb: it shows what it is given and calls back. */
import { createRng } from '../core/rng';
import { heroDef, PAD_SLOTS, type SkillIndex } from '../heroes';
import { assignPad, padSkill } from '../heroes/loadout';
import { t } from '../i18n';
import { stamp } from '../render/ink';
import { el, n2 } from '../render/svg';
import { tween } from '../render/tween';
import { h } from './dom';
import type { EntryView } from '../progression/update';
import type { RunState } from '../world/run';
import './forms.css';

export interface UpdateOpen {
  /** The "N" in "Aktualizacja 1.N". */
  version: number;
  entries: EntryView[];
  rerollUsed: boolean;
  /** Called once the stamp has landed. */
  onPick(id: string): void;
  /** The "Zglos problem" link: returns the new three entries, or null if there is none to give. */
  onReport(): EntryView[] | null;
}

export interface UpdateForm {
  readonly isOpen: boolean;
  open(o: UpdateOpen): void;
  /**
   * The second step of the same sheet after skill 4 or 5 was installed: "Przypisz do przycisku", the three pads with the
   * words they carry now, and "Później". A pad button calls `assignPad` and then `done`; "Później" only calls `done`.
   */
  assign(s: RunState, skill: SkillIndex, done: () => void): void;
  close(): void;
}

const pen = createRng(0x0b0c);
const STAMP_MS = 800;

/** A square drawn by hand: corners a little off, the last stroke overshoots the first. */
function box(): string {
  const j = (): number => pen.range(-1.1, 1.1);
  const p = (x: number, y: number): string => `${n2(x + j())} ${n2(y + j())}`;
  return `M${p(-9, -9)}L${p(9, -9)}L${p(9, 9)}L${p(-9, 9)}L${p(-9, -11)}`;
}

function checkbox(): SVGSVGElement {
  const svg = el('svg', { viewBox: '-12 -12 24 24', 'aria-hidden': 'true' });
  svg.append(
    el('path', { d: box() }),
    el('path', { class: 'tick', d: 'M-6 0.5L-1.5 6L9-9' }),
  );
  return svg;
}

export function createUpdateForm(root: HTMLElement): UpdateForm {
  const sheet = h('div', 'sheet full hidden');
  const title = h('h2');
  const sub = h('p', 'sub', t('forms.update.subtitle'));
  const instr = h('p', 'lead instr', t('forms.update.instruction'));
  const rule = h('hr', 'rule');
  const list = h('div', 'entries');
  const report = h('button', 'report', t('forms.update.report'));
  report.type = 'button';
  const install = h('button', 'install', t('forms.update.install'));
  install.type = 'button';
  const actions = h('div', 'actions');
  actions.append(report, install);
  const layer = el('svg', { class: 'stamp-layer', 'aria-hidden': 'true' });
  const layerG = el('g', {});
  layer.append(layerG);
  // The text scrolls on its own on a small phone; the buttons stay in a bottom row that is always reachable.
  const scroll = h('div', 'sheet-scroll');
  scroll.append(title, sub, instr, rule, list);
  // Step two (assign): shown instead of the entries; the sheet keeps its frame and its stamp layer.
  const assignBox = h('div', 'assign');
  const assignLead = h('p', 'lead');
  const assignPads = h('div', 'assign-pads');
  const assignNote = h('p', 'eta', t('forms.update.assign.note'));
  assignBox.append(assignLead, assignPads, assignNote);
  const later = h('button', 'report later', t('forms.update.assign.later'));
  later.type = 'button';
  scroll.append(assignBox);
  actions.append(later);
  sheet.append(scroll, actions, layer);
  root.append(sheet);

  let current: UpdateOpen | null = null;
  let picked: string | null = null;
  let busy = false;

  function render(entries: EntryView[]): void {
    list.replaceChildren();
    picked = null;
    install.disabled = true;
    entries.forEach((e, i) => {
      const row = h('button', `entry${e.locked ? ' locked' : ''}`);
      row.type = 'button';
      const sec = h('div', 'sec', t('forms.update.section', { n: i + 1 }));
      sec.append(checkbox());
      const body = h('div', 'body-col');
      body.append(h('div', 'title', e.title), h('div', 'desc', e.desc), h('div', 'tag', e.tag));
      if (e.requires) body.append(h('div', 'req', e.requires));
      row.append(sec, body);
      if (e.locked) {
        const spot = el('svg', { class: 'stamp-spot', style: 'left:58%;top:50%', 'aria-hidden': 'true' });
        const g = el('g', {});
        spot.append(g);
        row.append(spot);
        tween(1, () => undefined, { delay: 260 + i * 80, done: () => stamp(t('forms.update.noPermission'), 0, 0, { parent: g, ttl: Infinity, rotation: -7, fontSize: 11 }) });
      }
      row.addEventListener('click', () => {
        if (e.locked || busy) return;
        picked = e.id;
        install.disabled = false;
        for (const r of list.children) r.classList.remove('picked');
        row.classList.add('picked');
      });
      list.append(row);
    });
  }

  report.addEventListener('click', () => {
    if (!current || busy || report.disabled) return;
    const next = current.onReport();
    if (!next) return;
    report.disabled = true;
    report.textContent = t('forms.update.reportUsed');
    render(next);
  });
  install.addEventListener('click', () => {
    const cur = current;
    const id = picked;
    if (!cur || id === null || busy) return;
    busy = true;
    stamp(t('forms.update.installed'), sheet.clientWidth / 2, sheet.clientHeight * 0.42, { parent: layerG, ttl: Infinity, rotation: -6, fontSize: 19 });
    tween(STAMP_MS, () => undefined, {
      done: () => {
        layerG.replaceChildren();
        cur.onPick(id);
      },
    });
  });

  function setStep(assigning: boolean): void {
    sheet.classList.toggle('assigning', assigning);
  }

  return {
    assign(s, skill, done) {
      const hero = s.player.heroId;
      busy = false;
      setStep(true);
      sheet.classList.remove('hidden');
      title.textContent = t('forms.update.assign.title');
      assignLead.textContent = t('forms.update.assign.lead', { skill: t(heroDef(hero).skills[skill].nameKey) });
      let closed = false;
      const finish = (): void => {
        if (closed) return;
        closed = true;
        done();
      };
      assignPads.replaceChildren();
      for (const slot of PAD_SLOTS) {
        const b = h('button', 'assign-pad');
        b.type = 'button';
        b.dataset['pad'] = String(slot + 1);
        b.append(h('span', 'assign-n', t('forms.update.assign.button', { n: slot + 1 })), h('span', 'assign-word', t(padSkill(s, slot).padKey)));
        b.addEventListener('click', () => {
          assignPad(s, slot, skill);
          finish();
        });
        assignPads.append(b);
      }
      later.onclick = finish;
    },
    get isOpen() {
      return !sheet.classList.contains('hidden');
    },
    open(o) {
      current = o;
      busy = false;
      setStep(false);
      title.textContent = t('forms.update.title', { n: o.version });
      report.disabled = o.rerollUsed;
      report.textContent = o.rerollUsed ? t('forms.update.reportUsed') : t('forms.update.report');
      layerG.replaceChildren();
      render(o.entries);
      sheet.classList.remove('hidden');
    },
    close() {
      setStep(false);
      sheet.classList.add('hidden');
      current = null;
      layerG.replaceChildren();
    },
  };
}
