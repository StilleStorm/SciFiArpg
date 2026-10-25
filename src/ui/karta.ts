/**
 * KARTA UPRAWNIEŃ (DESIGN 10.3): one printed chart per hero. Skills, their paragraphs and the passives are boxes on a form, three
 * columns (the specializations), joined by dotted lines in unlock order; a box carries the stamp ZATWIERDZONO when the character
 * holds it and is greyed with BRAK UPRAWNIEŃ when it is gated; each column ends in its capstone. The Argument ostateczny stands
 * across the top; the passives (no column names them) stand in one band under the columns. Nothing here is a rule: the schedule
 * is progression/paragraphs.ts, the columns, categories and capstones are heroes/specializations.ts.
 */
import { heroDef, type SkillIndex } from '../heroes/defs';
import { activeCapstone, capstoneCount, categoryNameKey, categoryOf, specializationsOf, type LoadoutView, type Specialization } from '../heroes/specializations';
import { PARAGRAPH_NOS } from '../heroes/paragraphs';
import { heroById, type HeroId } from '../heroes/registry';
import { t } from '../i18n';
import { isParagraphUnlocked, paragraphLevel, runProgress, skillLevelOf, type ParagraphProgress } from '../progression/paragraphs';
import { stamp, stampSize } from '../render/ink';
import { el } from '../render/svg';
import { h } from './dom';
import { attachScrollCue } from './konfiguracja';
import { createSheet, type Sheet } from './sheet';
import type { RunState } from '../world/run';
import './karta.css';

/** `granted`: the character holds it. `gated`: a condition is missing (level or permission). `open`: nothing blocks it, it was not chosen. */
export type NodeState = 'granted' | 'gated' | 'open';

export interface KartaNode {
  id: string;
  kind: 'skill' | 'paragraph' | 'passive';
  name: string;
  /** The line over the name, left: category, paragraph number or "cecha"; `at` on the right: "poz. 7". */
  tag: string;
  at: string;
  /** The level it opens at (the sort key); null for a passive. */
  level: number | null;
  state: NodeState;
  /** Why a gated or open box is not stamped: "od poziomu 7", "wymaga: urządzenia", "nie wybrano". */
  note: string;
}

export interface KartaColumn {
  id: string;
  n: number;
  name: string;
  nodes: KartaNode[];
  capName: string;
  capDesc: string;
  /** Equipped skills of this column / skills in it. */
  have: number;
  total: number;
  /** This column's capstone is in force. */
  granted: boolean;
}

export interface KartaUltimate {
  /** The ultimate's id and whether the loadout holds it now (S19: a hero has three). */
  id?: string;
  chosen?: boolean;
  name: string;
  level: number;
  state: NodeState;
  note: string;
  paragraphs: string[];
}

export interface KartaModel {
  heroId: HeroId;
  heroName: string;
  level: number;
  ultimate: KartaUltimate | null;
  /** Every ultimate of the hero in level order, the chosen one marked (empty for a hero without one). */
  ultimates: KartaUltimate[];
  columns: KartaColumn[];
  /** The passives: no column names them, so they are printed in a band under the columns. */
  band: KartaNode[];
}

/** What the chart reads: a character's progress, the three pad skills, the chosen column and ultimate. A `Character` and a run both give one. */
export interface KartaInput {
  progress: ParagraphProgress;
  pads: readonly [SkillIndex, SkillIndex, SkillIndex];
  specialization?: string | null;
  ultimate?: string;
}

const viewOf = (input: KartaInput): LoadoutView => ({
  heroId: input.progress.heroId,
  pads: [...input.pads],
  upgrades: input.progress.upgrades,
  ...(input.specialization ? { specialization: input.specialization } : {}),
});

const FAMILY_LABEL = (family: string): string => t(`forms.update.family.${family}`);

function tagOf(skillId: string): string {
  const c = categoryOf(skillId);
  return c ? t(categoryNameKey(c)) : '';
}

function skillNodes(input: KartaInput, skillId: string): KartaNode[] {
  const c = input.progress;
  const def = heroDef(c.heroId);
  const index = def.skills.findIndex((k) => k.id === skillId);
  const sk = def.skills[index];
  if (!sk) return [];
  const installed = index <= 2 || (c.upgrades[`skill${index + 1}`] ?? 0) > 0;
  const lvl = skillLevelOf(c.heroId, skillId);
  const missingFamily = sk.requires && !c.permissions.includes(sk.requires) ? sk.requires : null;
  const skillState: NodeState = installed ? 'granted' : c.level < lvl || missingFamily ? 'gated' : 'open';
  const skillNote = installed ? '' : c.level < lvl ? t('forms.karta.fromLevel', { level: lvl }) : missingFamily ? t('forms.karta.needs', { family: FAMILY_LABEL(missingFamily) }) : t('forms.karta.open');
  const out: KartaNode[] = [
    { id: `skill:${skillId}`, kind: 'skill', name: t(sk.nameKey), tag: tagOf(skillId), at: t('forms.karta.level', { level: lvl }), level: lvl, state: skillState, note: skillNote },
  ];
  for (const n of PARAGRAPH_NOS) {
    if (n === 1) continue;
    const para = heroById(c.heroId).paragraphs[skillId]?.list[n - 1];
    if (!para) continue;
    const at = paragraphLevel(c.heroId, skillId, n);
    const open = isParagraphUnlocked(c, skillId, n);
    out.push({
      id: `para:${skillId}:${n}`,
      kind: 'paragraph',
      name: t(para.nameKey),
      tag: t('forms.karta.section', { n }),
      at: t('forms.karta.level', { level: at }),
      level: at,
      state: open ? 'granted' : 'gated',
      note: open ? '' : t('forms.karta.fromLevel', { level: at }),
    });
  }
  return out;
}

function passiveNode(input: KartaInput, n: number): KartaNode | null {
  const c = input.progress;
  const def = heroById(c.heroId).passives[n - 1];
  if (!def) return null;
  const taken = def.rule === true || (c.upgrades[`passive${n}`] ?? 0) > 0; // the rule is always on
  const gated = !taken && def.requires !== undefined && !c.permissions.includes(def.requires);
  return {
    id: `passive:${n}`,
    kind: 'passive',
    name: t(`forms.update.passive.${c.heroId}.${n}.name`),
    tag: t('forms.karta.passive'),
    at: '',
    level: null,
    state: taken ? 'granted' : gated ? 'gated' : 'open',
    note: taken ? '' : gated && def.requires ? t('forms.karta.needs', { family: FAMILY_LABEL(def.requires) }) : t('forms.karta.open'),
  };
}

function column(input: KartaInput, sp: Specialization, n: number, active: Specialization | null): KartaColumn {
  const nodes: KartaNode[] = [];
  for (const id of sp.skills) nodes.push(...skillNodes(input, id));
  // unlock order: by the level each opens at (a skill before its paragraphs on a tie)
  const ordered = nodes
    .map((node, i) => ({ node, i }))
    .sort((a, b) => (a.node.level ?? 0) - (b.node.level ?? 0) || a.i - b.i)
    .map((x) => x.node);
  return {
    id: sp.id,
    n,
    name: t(sp.nameKey),
    nodes: ordered,
    capName: t(sp.capstone.nameKey),
    capDesc: t(sp.capstone.descKey),
    have: capstoneCount(viewOf(input), sp.id),
    total: sp.skills.length,
    granted: active?.id === sp.id,
  };
}

/** The chart as plain data (tested). */
export function kartaModel(input: KartaInput): KartaModel {
  const c = input.progress;
  const heroId = c.heroId;
  const specs = specializationsOf(heroId);
  const active = activeCapstone(viewOf(input))?.spec ?? null;
  const columns = specs.map((sp, i) => column(input, sp, i + 1, active));
  const all = heroById(heroId).ultimates;
  const ult = all?.find((u) => u.id === input.ultimate) ?? all?.[0];
  const asNode = (u: NonNullable<typeof ult>): KartaUltimate => ({
    id: u.id,
    chosen: u.id === ult?.id,
    name: t(u.nameKey),
    level: u.level,
    state: c.level >= u.level ? 'granted' : 'gated',
    note: c.level >= u.level ? '' : t('forms.karta.fromLevel', { level: u.level }),
    paragraphs: u.list.map((p) => t(p.nameKey)),
  });
  const ultimate: KartaUltimate | null = ult
    ? {
        name: t(ult.nameKey),
        level: ult.level,
        state: c.level >= ult.level ? 'granted' : 'gated',
        note: c.level >= ult.level ? '' : t('forms.karta.fromLevel', { level: ult.level }),
        paragraphs: ult.list.map((p) => t(p.nameKey)),
      }
    : null;
  const band: KartaNode[] = [];
  for (let n = 1; n <= heroById(heroId).passives.length; n++) {
    const node = passiveNode(input, n);
    if (node) band.push(node);
  }
  return { heroId, heroName: t(heroDef(heroId).nameKey), level: c.level, ultimate, ultimates: (all ?? []).map(asNode), columns, band };
}

/** A run as chart input (the desk). */
export function kartaInputFromRun(s: RunState): KartaInput {
  const [a, b, c] = s.hero.pads;
  return { progress: runProgress(s), pads: [a, b, c], specialization: s.hero.spec ?? null, ...(s.hero.ultimateId ? { ultimate: s.hero.ultimateId } : {}) };
}

// ---------- drawing ----------

/** Lettering on the chart's stamps, in css px: a phone reads nothing under 11. */
const STAMP_PX = 11.5;

function stampSvg(text: string, size: number, rot: number): SVGSVGElement {
  const { w, h: hh } = stampSize(text, size);
  const k = STAMP_PX / size;
  const svg = el('svg', {
    class: 'kt-stamp',
    viewBox: `${-w / 2 - 3} ${-hh / 2 - 3} ${w + 6} ${hh + 6}`,
    width: ((w + 6) * k).toFixed(1),
    height: ((hh + 6) * k).toFixed(1),
    'aria-hidden': 'true',
  });
  const g = el('g', {});
  svg.append(g);
  stamp(text, 0, 0, { parent: g, ttl: Infinity, rotation: rot, fontSize: size });
  return svg;
}

function ultParas(names: readonly string[]): HTMLElement {
  const wrap = h('span', 'kt-ultparas');
  names.forEach((p, i) => wrap.append(h('span', '', `${t('forms.karta.section', { n: i + 1 })} ${p}`)));
  return wrap;
}

function nodeEl(node: KartaNode): HTMLElement {
  const box = h('div', `kt-node ${node.kind} ${node.state}`);
  box.dataset['node'] = node.id;
  box.dataset['state'] = node.state;
  const tag = h('span', 'kt-tag');
  tag.append(h('span', '', node.tag), h('span', '', node.at));
  box.append(tag, h('span', 'kt-name', node.name));
  if (node.state === 'granted') box.append(stampSvg(t('forms.karta.approved'), 14, -3));
  else box.append(h('span', 'kt-gate', node.state === 'gated' ? t('forms.karta.none') : ''), h('span', 'kt-need', node.note));
  return box;
}

function columnEl(col: KartaColumn): HTMLElement {
  const wrap = h('section', 'kt-col');
  wrap.dataset['spec'] = col.id;
  wrap.append(h('h3', 'kt-colhead', col.name), h('p', 'kt-colno', t('forms.karta.column', { n: col.n })));
  const chain = h('div', 'kt-chain');
  for (const node of col.nodes) chain.append(nodeEl(node));
  wrap.append(chain);
  const cap = h('div', `kt-cap ${col.granted ? 'granted' : 'idle'}`);
  cap.dataset['capstone'] = col.id;
  cap.append(h('span', 'kt-tag', t('forms.karta.capstone')), h('span', 'kt-name', col.capName), h('span', 'kt-capdesc', col.capDesc), h('span', 'kt-caphave', t('forms.karta.capHave', { have: col.have, total: col.total })));
  if (col.granted) cap.append(stampSvg(t('forms.karta.capGranted'), 14, -3));
  else cap.append(h('span', 'kt-need', t('forms.karta.capIdle')));
  wrap.append(cap);
  return wrap;
}

export interface KartaSheet {
  close(): void;
  el: HTMLElement;
}

/** Put the chart over the page. `onBack` is "Wróć" and "Zamknij"; the caller shows what stood under it. */
export function openKarta(root: HTMLElement, input: KartaInput, onBack: () => void): KartaSheet {
  const model = kartaModel(input);
  const sheet: Sheet = createSheet(root, { title: t('forms.karta.title'), sub: t('forms.karta.sub', { hero: model.heroName, level: model.level }), onClose: onBack });
  sheet.el.classList.add('kt-sheet');
  sheet.el.dataset['hero'] = model.heroId;
  sheet.note(t('forms.karta.note'));
  sheet.note(t('forms.karta.noteGate'));
  const body = h('div', 'kt-body');
  // the ultimates: the one in the slot stands first, as `data-node=ult`; the others (S19) follow, level order
  const shown = model.ultimates.length > 1 ? [...model.ultimates].sort((a, b) => Number(b.chosen === true) - Number(a.chosen === true) || a.level - b.level) : model.ultimate ? [model.ultimate] : [];
  shown.forEach((u, k) => {
    const band = h('div', `kt-ult ${u.state}`);
    band.dataset['node'] = k === 0 ? 'ult' : `ult:${u.id ?? k}`;
    band.dataset['state'] = u.state;
    const text = h('div', 'kt-ulttext');
    const utag = h('span', 'kt-tag');
    utag.append(h('span', '', t('forms.karta.ultTitle')), h('span', '', t('forms.karta.level', { level: u.level })));
    text.append(utag, h('span', 'kt-name', u.name), ultParas(u.paragraphs));
    band.append(text);
    if (u.state === 'granted') band.append(stampSvg(t('forms.karta.approved'), 14, -3));
    else band.append(h('span', 'kt-gate', t('forms.karta.none')), h('span', 'kt-need', u.note));
    body.append(band);
  });
  const cols = h('div', 'kt-cols');
  for (const col of model.columns) cols.append(columnEl(col));
  body.append(cols);
  if (model.band.length > 0) {
    const band = h('div', 'kt-band');
    band.append(h('h3', 'kt-colhead', t('forms.karta.passives')), h('p', 'kt-colno', t('forms.karta.passivesNote')));
    const row = h('div', 'kt-bandrow');
    for (const node of model.band) row.append(nodeEl(node));
    band.append(row);
    body.append(band);
  }
  const back = h('button', 'pz-btn kt-back', t('forms.karta.back'));
  back.type = 'button';
  back.dataset['karta'] = 'back';
  back.addEventListener('click', onBack);
  sheet.scroll.append(body, back);
  const cue = attachScrollCue(sheet, 'forms.karta.cue');
  return {
    el: sheet.el,
    close: () => {
      cue.dispose();
      sheet.remove();
    },
  };
}

/** The desk row, in the right-hand column of the desk. Call right after the desk sheet was opened. */
export function addKartaDeskLine(root: HTMLElement, onOpen: () => void): void {
  const col = root.querySelector('.desk-sheet .desk-col-b');
  if (!col) return;
  const row = h('div', 'trow kt-deskrow');
  const btn = h('button', 'link-btn', t('forms.karta.deskLine'));
  btn.type = 'button';
  btn.dataset['desk'] = 'karta';
  btn.addEventListener('click', onOpen);
  row.append(h('label', '', t('forms.karta.deskNote')), btn);
  col.append(row);
}
