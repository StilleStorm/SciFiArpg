/**
 * KARTA OSOBOWA (PLAN 8): the character sheet, a form filled in by the Asystent. Racja, Argument, pewność siebie and upór, the
 * crit and the speeds, the damage by kind, the three resists, the adnotacje (statuses and page buffs as stamps), the potwierdzenia
 * held, the specialization with its capstone and the permissions. Built the way `ui/karta.ts` is: a pure model
 * (`osobowaModel`, tested) read from plain facts (`osobowaInputFromRun`), and a sheet that draws it (`openKartaOsobowa`).
 * Nothing here is a rule; it only reads. Opened from the desk (`[data-desk=osobowa]`) and from the HUD's Reputacja line.
 */
import { effectiveResist, DAMAGE_TYPES, type DamageType } from '../combat/damage';
import { meterOf } from '../combat/meter';
import type { StatusKind } from '../combat/status';
import { FAMILY_IDS, type FamilyId } from '../enemies/ids';
import { heroDef, type PadSlot } from '../heroes/defs';
import { padSkill } from '../heroes/loadout';
import type { HeroId } from '../heroes/registry';
import { runCapstone, specializationOf } from '../heroes/specializations';
import { ultimateOf, ultimateUnlocked } from '../heroes/ultimate';
import { t } from '../i18n';
import { xpToNext } from '../progression/xp';
import { buildSlip } from '../render/pickupCard';
import { stamp, stampSize } from '../render/ink';
import { el } from '../render/svg';
import { HELD_CAP } from '../systems/recovery';
import { activeBuffs, sealKeys } from '../world/content';
import type { RunState } from '../world/run';
import { h } from './dom';
import { createSheet, type Sheet } from './sheet';
import './karta-osobowa.css';

/** One stamped annotation: a status or a buff. `seconds` is what is left (null = until it is lifted). */
export interface Annotation {
  id: string;
  kind: 'status' | 'buff';
  /** The words on the stamp. */
  text: string;
  seconds: number | null;
}

/** The plain facts the sheet needs. A run gives them (`osobowaInputFromRun`); tests make them by hand. */
export interface OsobowaInput {
  heroId: HeroId;
  level: number;
  xp: number;
  hp: number;
  hpMax: number;
  pewnosc: number;
  upor: number;
  dmgMin: number;
  dmgMax: number;
  damageType: DamageType;
  crit: number;
  resist: Partial<Record<DamageType, number>>;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  meter: number;
  potwierdzenia: number;
  permissions: readonly string[];
  /** The skills on the three pads and the ultimate (when open), with the kind of damage each does. */
  skills: { name: string; type: DamageType }[];
  statuses: { kind: StatusKind; remaining: number }[];
  buffs: { id: string; nameKey: string; remaining: number }[];
  spec: string | null;
  /** The capstone in force (>= 2 skills of the chosen column on the pads). */
  capstoneGranted: boolean;
}

export interface OsobowaRow {
  id: string;
  label: string;
  value: string;
}

export interface DamageRow {
  type: DamageType;
  name: string;
  /** The auto-attack range, when the weapon does this kind. */
  basic: string | null;
  skills: string[];
}

export interface PermissionRow {
  family: FamilyId;
  name: string;
  held: boolean;
}

export interface OsobowaModel {
  heroId: HeroId;
  heroName: string;
  level: number;
  reputacja: string;
  racja: { text: string; ratio: number };
  meter: { text: string; ratio: number };
  stats: OsobowaRow[];
  damage: DamageRow[];
  resists: OsobowaRow[];
  annotations: Annotation[];
  potwierdzenia: { count: number; cap: number; text: string };
  specialization: { id: string | null; name: string; capstone: string | null; capDesc: string | null; granted: boolean };
  permissions: PermissionRow[];
}

/** The decimal comma, no trailing zero ("1,5", "12"). */
const dec = (n: number, digits = 1): string => String(Math.round(n * 10 ** digits) / 10 ** digits).replace('.', ',').replace('-', '−');
const pct = (n: number): string => `${Math.round(n)}%`;

/** Read the facts off the live run. */
export function osobowaInputFromRun(s: RunState): OsobowaInput {
  const p = s.player;
  const skills: OsobowaInput['skills'] = [];
  for (const slot of [0, 1, 2] as const satisfies readonly PadSlot[]) {
    const sk = padSkill(s, slot);
    skills.push({ name: t(sk.nameKey), type: sk.type });
  }
  const ult = ultimateOf(s);
  if (ult && ultimateUnlocked(s)) skills.push({ name: t(ult.nameKey), type: ult.type });
  const cap = runCapstone(s);
  return {
    heroId: p.heroId,
    level: p.level,
    xp: p.xp,
    hp: p.hp,
    hpMax: p.hpMax,
    pewnosc: p.stats.pewnoscSiebie,
    upor: p.stats.upor,
    dmgMin: p.stats.dmgMin,
    dmgMax: p.stats.dmgMax,
    damageType: p.damageType,
    crit: p.stats.critChance,
    resist: { ...p.stats.resist },
    speed: p.speed,
    attackRange: p.attackRange,
    attackCooldown: p.attackCooldown,
    meter: meterOf(p),
    potwierdzenia: p.potwierdzenia ?? 0,
    permissions: [...p.permissions],
    skills,
    statuses: p.statuses.map((st) => ({ kind: st.kind, remaining: st.remaining })),
    buffs: activeBuffs(s).map((b) => ({ id: b.id, nameKey: sealKeys(b.id).stamp, remaining: b.remaining })),
    spec: s.hero.spec ?? null,
    capstoneGranted: cap !== null,
  };
}

/** The sheet as plain data (tested). */
export function osobowaModel(i: OsobowaInput): OsobowaModel {
  const def = heroDef(i.heroId);
  const defender = { upor: i.upor, resist: i.resist };
  const ratio = (a: number, b: number): number => (b > 0 ? Math.min(1, Math.max(0, a / b)) : 0);
  const stats: OsobowaRow[] = [
    { id: 'pewnosc', label: t('screens.osobowa.pewnosc'), value: dec(i.pewnosc, 0) },
    { id: 'upor', label: t('screens.osobowa.upor'), value: dec(i.upor, 0) },
    { id: 'atak', label: t('screens.osobowa.atak'), value: `${dec(i.dmgMin, 0)}–${dec(i.dmgMax, 0)}` },
    { id: 'krytyk', label: t('screens.osobowa.krytyk'), value: pct(i.crit * 100) },
    { id: 'tempo', label: t('screens.osobowa.tempo'), value: t('screens.osobowa.tempoValue', { n: dec(i.attackCooldown > 0 ? 1 / i.attackCooldown : 0, 2) }) },
    { id: 'zasieg', label: t('screens.osobowa.zasieg'), value: dec(i.attackRange, 0) },
    { id: 'ruch', label: t('screens.osobowa.ruch'), value: dec(i.speed, 0) },
  ];
  const damage: DamageRow[] = DAMAGE_TYPES.map((type) => ({
    type,
    name: t(`combat.type.${type}`),
    basic: i.damageType === type ? `${dec(i.dmgMin, 0)}–${dec(i.dmgMax, 0)}` : null,
    skills: i.skills.filter((sk) => sk.type === type).map((sk) => sk.name),
  }));
  const resists: OsobowaRow[] = DAMAGE_TYPES.map((type) => ({
    id: type,
    label: t(`screens.osobowa.resist.${type}`),
    value: pct(effectiveResist(defender, type)),
  }));
  const annotations: Annotation[] = [
    ...i.statuses.map((st): Annotation => ({ id: `status:${st.kind}`, kind: 'status', text: t(`combat.status.${st.kind}`), seconds: st.remaining })),
    ...i.buffs.map((b): Annotation => ({ id: `buff:${b.id}`, kind: 'buff', text: t(b.nameKey), seconds: b.remaining })),
  ];
  const sp = i.spec ? specializationOf(i.heroId, i.spec) : undefined;
  return {
    heroId: i.heroId,
    heroName: t(def.nameKey),
    level: i.level,
    reputacja: `${Math.round(i.xp)}/${xpToNext(i.level)}`,
    racja: { text: `${Math.max(0, Math.ceil(i.hp))}/${i.hpMax}`, ratio: ratio(i.hp, i.hpMax) },
    meter: { text: pct(i.meter * 100), ratio: Math.min(1, Math.max(0, i.meter)) },
    stats,
    damage,
    resists,
    annotations,
    potwierdzenia: { count: i.potwierdzenia, cap: HELD_CAP, text: t('screens.osobowa.potwValue', { count: i.potwierdzenia, cap: HELD_CAP }) },
    specialization: sp
      ? { id: sp.id, name: t(sp.nameKey), capstone: t(sp.capstone.nameKey), capDesc: t(sp.capstone.descKey), granted: i.capstoneGranted }
      : { id: null, name: t('screens.osobowa.noSpec'), capstone: null, capDesc: null, granted: false },
    permissions: FAMILY_IDS.map((family) => ({ family, name: t(`screens.family.${family}`), held: i.permissions.includes(family) })),
  };
}

// ---------- drawing ----------

/** Lettering on a stamp, in css px: a phone reads nothing under 11. */
const STAMP_PX = 11.5;

/** A red rubber stamp as an inline picture (the same drawing the Karta uprawnień uses). */
export function inkStamp(text: string, size = 14, rot = -3, cls = 'os-stamp'): SVGSVGElement {
  const { w, h: hh } = stampSize(text, size);
  const k = STAMP_PX / size;
  const svg = el('svg', {
    class: cls,
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

function row(r: OsobowaRow): HTMLElement {
  const line = h('div', 'os-row');
  line.dataset['row'] = r.id;
  line.append(h('span', 'os-label', r.label), h('span', 'os-lead'), h('span', 'os-val', r.value));
  return line;
}

/** An ink underline that fills with the ratio: the same drawing as the HUD's racja and Argument. */
function underline(ratio: number, red: boolean): HTMLElement {
  const wrap = h('span', `os-line${red ? ' red' : ''}`);
  wrap.append(h('i', ''));
  (wrap.firstElementChild as HTMLElement).style.width = `${Math.round(ratio * 100)}%`;
  return wrap;
}

function section(id: string, title: string): HTMLElement {
  const box = h('section', 'os-sec');
  box.dataset['sec'] = id;
  box.append(h('h3', 'os-head', title));
  return box;
}

function slips(count: number, cap: number): SVGSVGElement {
  const w = 26;
  const svg = el('svg', { class: 'os-slips', viewBox: `0 0 ${cap * w} 24`, width: String(cap * w), height: '24', 'aria-hidden': 'true' });
  for (let k = 0; k < cap; k++) {
    const g = el('g', { transform: `translate(${k * w + 13} 12)`, class: k < count ? 'held' : 'empty' });
    g.append(buildSlip(k % 2 ? 4 : -4, 1));
    svg.append(g);
  }
  return svg;
}

export interface OsobowaSheet {
  close(): void;
  el: HTMLElement;
}

/** Put the sheet over the page. `onBack` is "Wróć" and "Zamknij"; the caller shows what stood under it. */
export function openKartaOsobowa(root: HTMLElement, input: OsobowaInput, onBack: () => void): OsobowaSheet {
  const m = osobowaModel(input);
  const sheet: Sheet = createSheet(root, { title: t('screens.osobowa.title'), sub: t('screens.osobowa.sub', { hero: m.heroName, level: m.level }), onClose: onBack });
  sheet.el.classList.add('os-sheet');
  sheet.el.dataset['hero'] = m.heroId;
  sheet.note(t('screens.osobowa.note'));
  const body = h('div', 'os-body');

  // I. dane: racja, argument, the numbers
  const dane = section('dane', t('screens.osobowa.secDane'));
  const racja = h('div', 'os-row os-big');
  racja.dataset['row'] = 'racja';
  racja.append(h('span', 'os-label', t('ui.hud.racja')), h('span', 'os-val red', m.racja.text), underline(m.racja.ratio, true));
  const arg = h('div', 'os-row os-big');
  arg.dataset['row'] = 'argument';
  arg.append(h('span', 'os-label', t('ui.hud.argument')), h('span', 'os-val', m.meter.text), underline(m.meter.ratio, false));
  const rep = h('div', 'os-row');
  rep.dataset['row'] = 'reputacja';
  rep.append(h('span', 'os-label', t('ui.hud.reputacja')), h('span', 'os-lead'), h('span', 'os-val', t('screens.osobowa.reputacjaValue', { level: m.level, xp: m.reputacja })));
  dane.append(racja, arg, rep);
  for (const r of m.stats) dane.append(row(r));

  // II. obrażenia według rodzaju
  const dmg = section('obrazenia', t('screens.osobowa.secDamage'));
  for (const d of m.damage) {
    const line = h('div', `os-dmg${d.basic || d.skills.length ? '' : ' none'}`);
    line.dataset['type'] = d.type;
    line.append(h('span', 'os-label', d.name));
    const what: string[] = [];
    if (d.basic) what.push(t('screens.osobowa.basic', { value: d.basic }));
    what.push(...d.skills);
    line.append(h('span', 'os-what', what.length > 0 ? what.join('; ') : t('screens.osobowa.noneDmg')));
    dmg.append(line);
  }

  // III. odporności
  const res = section('odpornosci', t('screens.osobowa.secResist'));
  for (const r of m.resists) res.append(row(r));

  // IV. adnotacje
  const ann = section('adnotacje', t('screens.osobowa.secNotes'));
  if (m.annotations.length === 0) ann.append(h('p', 'os-empty', t('screens.osobowa.noNotes')));
  else {
    const list = h('div', 'os-stamps');
    for (const a of m.annotations) {
      const cell = h('div', `os-note ${a.kind}`);
      cell.dataset['note'] = a.id;
      cell.append(inkStamp(a.text, 14, a.kind === 'buff' ? 2 : -3));
      if (a.seconds !== null) cell.append(h('span', 'os-secs', t('screens.osobowa.seconds', { n: Math.max(1, Math.ceil(a.seconds)) })));
      list.append(cell);
    }
    ann.append(list);
  }

  // V. potwierdzenia
  const potw = section('potwierdzenia', t('screens.osobowa.secPotw'));
  const potwLine = h('div', 'os-potw');
  potwLine.dataset['count'] = String(m.potwierdzenia.count);
  potwLine.append(slips(m.potwierdzenia.count, m.potwierdzenia.cap), h('span', 'os-val', m.potwierdzenia.text));
  potw.append(potwLine);

  // VI. specjalizacja
  const spec = section('specjalizacja', t('screens.osobowa.secSpec'));
  const sp = m.specialization;
  const specBox = h('div', `os-spec${sp.id ? '' : ' none'}`);
  specBox.append(h('span', 'os-name', sp.name));
  if (sp.capstone) {
    specBox.append(h('span', 'os-cap', `${t('screens.osobowa.capstone')}: ${sp.capstone}`), h('span', 'os-capdesc', sp.capDesc ?? ''));
    specBox.append(sp.granted ? inkStamp(t('forms.karta.capGranted'), 14, -3) : h('span', 'os-idle', t('forms.karta.capIdle')));
  }
  spec.append(specBox);

  // VII. uprawnienia
  const perm = section('uprawnienia', t('screens.osobowa.secPerm'));
  for (const p of m.permissions) {
    const line = h('div', `os-perm${p.held ? ' held' : ''}`);
    line.dataset['family'] = p.family;
    line.append(h('span', 'os-label', p.name));
    line.append(p.held ? inkStamp(t('forms.karta.approved'), 14, -3) : h('span', 'os-idle', t('forms.karta.none')));
    perm.append(line);
  }

  const left = h('div', 'os-col');
  left.append(dane, res, potw);
  const right = h('div', 'os-col');
  right.append(dmg, ann, spec, perm);
  body.append(left, right);
  const back = h('button', 'pz-btn os-back', t('screens.osobowa.back'));
  back.type = 'button';
  back.dataset['osobowa'] = 'back';
  back.addEventListener('click', onBack);
  sheet.scroll.append(body, back);
  return {
    el: sheet.el,
    close: () => sheet.remove(),
  };
}

/** The desk row, beside Konfiguracja and Karta uprawnień. Call right after the desk sheet was opened. */
export function addOsobowaDeskLine(root: HTMLElement, onOpen: () => void): void {
  const col = root.querySelector('.desk-sheet .desk-col-b');
  if (!col) return;
  const row = h('div', 'trow os-deskrow');
  const btn = h('button', 'link-btn', t('screens.osobowa.deskLine'));
  btn.type = 'button';
  btn.dataset['desk'] = 'osobowa';
  btn.addEventListener('click', onOpen);
  row.append(h('label', '', t('screens.osobowa.deskNote')), btn);
  col.append(row);
}
