/**
 * Side tickets (STORY 5, PLAN 8): the quest primitive. Four templates (kill N, fetch N, reach a page, deliver to the clerk),
 * state per character (`QuestState`, saved with the character, live on `RunState.quests`), rewards (stars, a permission card,
 * potwierdzenia) and the board's offers: two procedural "drobne ogłoszenia" per planet, plus the hand-written tickets a
 * planet module registers in `HAND_WRITTEN` (S12 and on). Everything here is pure but `bindQuests`, `visitClerk`,
 * `acceptQuest`, `completeQuest`, which touch the run state and the bus. Nothing is rendered here (`ui/board.ts` is the face).
 *
 * A quest belongs to a planet: it advances only in a ticket on that planet (`questPlanet`) and only in the run proper.
 * Its definition is never stored: the id names it (`questById`), a procedural one is regenerated from `d:<planet>:<epoch>:<slot>`.
 */
import type { Bus } from '../core/events';
import { createRng } from '../core/rng';
import type { FamilyId } from '../enemies/ids';
import { FAMILY_IDS } from '../enemies/ids';
import { QUEST_STARS } from '../balance/loot';
import { earnStars } from '../economy/stars';
import { t } from '../i18n';
import { HELD_CAP } from '../systems/recovery';
import { shopIlvl } from '../items/level';
import { sendReward, type RewardItem } from '../items/delivery';
import { PLANET_COUNT, planetDef } from './campaign';
import type { RunState } from './run';

export type QuestKind = 'kill' | 'fetch' | 'reach' | 'deliver';
export const QUEST_KINDS: readonly QuestKind[] = ['kill', 'fetch', 'reach', 'deliver'];

/** What the board pays out on "Zgłaszam wykonanie". */
export interface QuestReward {
  stars: number;
  /** A permission card for this family (granted once; nothing happens when the character already holds it). */
  permission?: FamilyId;
  /** Potwierdzenia added to the stack (up to the cap of five). */
  potwierdzenia?: number;
  /**
   * S18: a unique or a set piece, named by id. It is never paid into the bag: the Komisja sends it, and it waits as an awizo at the base
   * paczkomat (items/delivery.ts, ITEMS 12.7). `level` defaults to the planet's shop band.
   */
  item?: RewardItem;
}

export interface QuestDef {
  id: string;
  kind: QuestKind;
  /** 0-based planet whose board offers it and whose tickets advance it. */
  planet: number;
  /** The goal: kills, finds, the page to reach (1-based) or 1 (handing over). */
  n: number;
  /** Kill only: the family that counts; absent = any. */
  family?: FamilyId;
  /** i18n keys of the card (`screens.quests.<kind>.<variant>.title|text`); the text takes `{count}` and `{family}`. */
  titleKey: string;
  textKey: string;
  reward: QuestReward;
}

export interface ActiveQuest {
  id: string;
  progress: number;
  /** Deliver only: 1 once the parcel has been carried out of the base (a run was started). */
  stage: number;
}

export interface QuestState {
  active: ActiveQuest[];
  /** Quests ever completed: the board's epoch (the procedural offers change with every completion). */
  done: number;
  /** The last ids completed, so a hand-written ticket is not offered twice. */
  log: string[];
}

export const MAX_ACTIVE = 3;
export const LOG_CAP = 24;
export const OFFERS_PER_PLANET = 2;
/** Variants of the text per template (`screens.quests.<kind>.<0..2>`). */
export const VARIANTS = 3;

export const newQuests = (): QuestState => ({ active: [], done: 0, log: [] });
export const cloneQuests = (q: QuestState): QuestState => ({ done: q.done, log: [...q.log], active: q.active.map((a) => ({ ...a })) });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validate whatever was stored: an unknown id is dropped, numbers are clamped. Nothing here throws. */
export function toQuests(raw: unknown): QuestState {
  if (!isRecord(raw)) return newQuests();
  const out = newQuests();
  if (Array.isArray(raw['active'])) {
    for (const a of raw['active']) {
      if (!isRecord(a) || typeof a['id'] !== 'string' || out.active.length >= MAX_ACTIVE) continue;
      const def = questById(a['id']);
      if (!def || out.active.some((x) => x.id === def.id)) continue;
      const progress = typeof a['progress'] === 'number' && Number.isFinite(a['progress']) ? Math.min(def.n, Math.max(0, Math.floor(a['progress']))) : 0;
      const stage = a['stage'] === 1 ? 1 : 0;
      out.active.push({ id: def.id, progress, stage });
    }
  }
  out.done = typeof raw['done'] === 'number' && Number.isFinite(raw['done']) ? Math.min(1e6, Math.max(0, Math.floor(raw['done']))) : 0;
  if (Array.isArray(raw['log'])) out.log = raw['log'].filter((x): x is string => typeof x === 'string').slice(-LOG_CAP);
  return out;
}

// ---------- the offers ----------

/**
 * Hand-written side tickets by the planet modules (src/world/planets/p<N>.ts, two or three each, through
 * `registerSideTickets`). Each has an id starting with `h:`.
 */
const HAND_WRITTEN: QuestDef[] = [];

/** A planet module adds its hand-written tickets (ids must start with `h:`; a repeated id is ignored). */
export function registerSideTickets(defs: readonly QuestDef[]): void {
  for (const d of defs) if (d.id.startsWith('h:') && !HAND_WRITTEN.some((x) => x.id === d.id)) HAND_WRITTEN.push(d);
}

/** The procedural "drobne ogłoszenie" of a planet, epoch (completions so far) and slot (0 or 1). A pure function of the three. */
export function proceduralOffer(planet: number, epoch: number, slot: number): QuestDef {
  const p = Math.min(PLANET_COUNT - 1, Math.max(0, Math.floor(planet)));
  const r = createRng(p * 7919 + epoch * 131 + slot * 17 + 4091).fork('drobne');
  // slot 0 and slot 1 never share a template; the order turns with the epoch
  const first = (p + epoch) % QUEST_KINDS.length;
  const kind = QUEST_KINDS[(first + (slot === 0 ? 0 : 1 + r.int(0, 2))) % QUEST_KINDS.length] ?? 'kill';
  const variant = r.int(0, VARIANTS - 1);
  const def = planetDef(p);
  const scale = 1 + p * 0.5;
  let n = 1;
  let family: FamilyId | undefined;
  if (kind === 'kill') {
    n = Math.round(r.int(6, 10) * scale);
    // the dominant family of the planet most often, another one now and then
    family = r.chance(0.65) ? def.dominant : r.pick(FAMILY_IDS);
  } else if (kind === 'fetch') n = Math.round(r.int(4, 7) * Math.min(2, scale));
  else if (kind === 'reach') n = Math.max(2, Math.min(def.pages[0], 2 + r.int(1, 2)));
  const stars = Math.round((QUEST_STARS.base + QUEST_STARS.perPlanet * p + n * (QUEST_STARS.perUnit[kind] ?? 2)) / 5) * 5;
  const reward: QuestReward = { stars };
  const extra = r.int(0, 5);
  if (extra === 0) reward.permission = def.dominant;
  else if (extra <= 2) reward.potwierdzenia = 1;
  const id = `d:${p}:${epoch}:${slot}:${kind}:${variant}`;
  return {
    id,
    kind,
    planet: p,
    n,
    ...(family ? { family } : {}),
    titleKey: `screens.quests.${kind}.${variant}.title`,
    textKey: `screens.quests.${kind}.${variant}.text`,
    reward,
  };
}

/** The definition an id names, or null (the id of a vanished hand-written ticket, a damaged save). */
export function questById(id: string): QuestDef | null {
  if (id.startsWith('h:')) return HAND_WRITTEN.find((d) => d.id === id) ?? null;
  const m = /^d:(\d+):(\d+):([01]):(kill|fetch|reach|deliver):(\d+)$/.exec(id);
  if (!m) return null;
  const def = proceduralOffer(Number(m[1]), Number(m[2]), Number(m[3]));
  return def.id === id ? def : null;
}

export const isActive = (q: QuestState, id: string): boolean => q.active.some((a) => a.id === id);

/** What the board of `planet` pins up: its hand-written tickets not yet taken or done, then the two procedural ones. */
export function offersFor(planet: number, q: QuestState): QuestDef[] {
  const out: QuestDef[] = HAND_WRITTEN.filter((d) => d.planet === planet && !isActive(q, d.id) && !q.log.includes(d.id));
  for (let slot = 0; slot < OFFERS_PER_PLANET; slot++) {
    const def = proceduralOffer(planet, q.done, slot);
    if (!isActive(q, def.id)) out.push(def);
  }
  return out;
}

// ---------- state changes ----------

export type AcceptResult = 'ok' | 'full' | 'active' | 'unknown';

/** Take a ticket from the board. Pure on the state. */
export function acceptQuest(q: QuestState, id: string): AcceptResult {
  if (!questById(id)) return 'unknown';
  if (isActive(q, id)) return 'active';
  if (q.active.length >= MAX_ACTIVE) return 'full';
  q.active.push({ id, progress: 0, stage: 0 });
  return 'ok';
}

/** Give a ticket back. Progress is lost. */
export function abandonQuest(q: QuestState, id: string): boolean {
  const i = q.active.findIndex((a) => a.id === id);
  if (i < 0) return false;
  q.active.splice(i, 1);
  return true;
}

export function isReady(q: QuestState, id: string): boolean {
  const a = q.active.find((x) => x.id === id);
  const def = questById(id);
  return a !== undefined && def !== null && a.progress >= def.n;
}

/** What happened in the world that a quest may count. */
export type QuestHappening =
  | { what: 'kill'; family?: FamilyId }
  | { what: 'find' }
  | { what: 'page'; page: number }
  | { what: 'carry' }
  | { what: 'clerk' };

/**
 * Count one happening on `planet` for every active quest of that planet. Returns the ids whose progress changed
 * and the ids that just became ready. Pure on the state.
 */
export function advanceQuests(q: QuestState, planet: number, ev: QuestHappening): { changed: string[]; ready: string[] } {
  const changed: string[] = [];
  const ready: string[] = [];
  for (const a of q.active) {
    const def = questById(a.id);
    if (!def || def.planet !== planet || a.progress >= def.n) continue;
    let next = a.progress;
    if (def.kind === 'kill' && ev.what === 'kill' && (!def.family || def.family === ev.family)) next = a.progress + 1;
    else if (def.kind === 'fetch' && ev.what === 'find') next = a.progress + 1;
    else if (def.kind === 'reach' && ev.what === 'page') next = Math.max(a.progress, ev.page);
    else if (def.kind === 'deliver' && ev.what === 'carry') {
      if (a.stage < 1) {
        a.stage = 1;
        changed.push(a.id);
      }
      continue;
    } else if (def.kind === 'deliver' && ev.what === 'clerk' && a.stage >= 1) next = def.n;
    next = Math.min(def.n, next);
    if (next === a.progress) continue;
    a.progress = next;
    changed.push(a.id);
    if (next >= def.n) ready.push(a.id);
  }
  return { changed, ready };
}

// ---------- on the run state ----------

/** The planet a ticket counts for: its plan's, else the campaign's current one (the older random tickets: planet 1). */
export const questPlanet = (s: Pick<RunState, 'plan' | 'campaign'>): number => s.plan?.planet ?? s.campaign?.current ?? 0;

/** The quest state of the run, made on first use. */
export function questsOf(s: RunState): QuestState {
  s.quests ??= newQuests();
  return s.quests;
}

/** Pay the reward into the run's player. Returns what was actually granted (a held permission or a full stack grants nothing). */
export function payReward(s: RunState, r: QuestReward): { stars: number; permission: FamilyId | null; potwierdzenia: number } {
  const p = s.player;
  const before = p.gwiazdki;
  earnStars(p, r.stars);
  let permission: FamilyId | null = null;
  if (r.permission && !p.permissions.includes(r.permission)) {
    p.permissions.push(r.permission);
    permission = r.permission;
  }
  let slips = 0;
  if (r.potwierdzenia) {
    const have = p.potwierdzenia ?? 0;
    const next = Math.min(HELD_CAP, have + r.potwierdzenia);
    slips = next - have;
    if (slips > 0) p.potwierdzenia = next;
  }
  return { stars: p.gwiazdki - before, permission, potwierdzenia: slips };
}

/** "Zgłaszam wykonanie": the quest leaves the active list and pays. False when it is not ready. */
export function completeQuest(s: RunState, bus: Bus, id: string): boolean {
  const q = questsOf(s);
  const def = questById(id);
  if (!def || !isReady(q, id)) return false;
  abandonQuest(q, id);
  q.done++;
  q.log.push(id);
  if (q.log.length > LOG_CAP) q.log.splice(0, q.log.length - LOG_CAP);
  payReward(s, def.reward);
  if (def.reward.item) {
    const awizo = sendReward(s, createRng(s.seed).fork(`reward:${id}`), def.reward.item, shopIlvl(def.planet));
    if (awizo) bus.emit('footnote', { text: t('economy.paczkomat.komisjaSent', { n: awizo.n }) });
  }
  bus.emit('quest:changed', { id, what: 'done' });
  return true;
}

export function takeQuest(s: RunState, bus: Bus, id: string): AcceptResult {
  const res = acceptQuest(questsOf(s), id);
  if (res === 'ok') bus.emit('quest:changed', { id, what: 'accepted' });
  return res;
}

export function dropQuest(s: RunState, bus: Bus, id: string): boolean {
  const ok = abandonQuest(questsOf(s), id);
  if (ok) bus.emit('quest:changed', { id, what: 'dropped' });
  return ok;
}

function happen(s: RunState, bus: Bus, ev: QuestHappening): void {
  const q = s.quests;
  if (!q || q.active.length === 0) return;
  const res = advanceQuests(q, questPlanet(s), ev);
  for (const id of res.changed) bus.emit('quest:changed', { id, what: res.ready.includes(id) ? 'ready' : 'progress' });
}

/** The clerk's sheet was opened in the base: a parcel carried out and back is handed over. Returns the ids that became ready. */
export function visitClerk(s: RunState, bus: Bus): string[] {
  const q = s.quests;
  if (!q || s.phase !== 'base') return [];
  const res = advanceQuests(q, questPlanet(s), { what: 'clerk' });
  for (const id of res.changed) bus.emit('quest:changed', { id, what: res.ready.includes(id) ? 'ready' : 'progress' });
  return res.ready;
}

/** The line the Asystent prints when a ticket's conditions are met. */
export function readyNote(def: QuestDef): string {
  return t('screens.quests.readyNote', { title: t(def.titleKey) });
}

/**
 * Count kills, finds and pages of the run proper. Bound once per bus; `getState` is the live run. A ticket that became ready
 * prints one footnote, so the player knows to go back to the board.
 */
export function bindQuests(bus: Bus, getState: () => RunState | null): () => void {
  const live = (): RunState | null => {
    const s = getState();
    return s && s.phase === 'run' ? s : null;
  };
  const offs = [
    bus.on('enemy:died', (e) => {
      const s = live();
      if (s) happen(s, bus, { what: 'kill', ...(e.family ? { family: e.family } : {}) });
    }),
    bus.on('pickup:taken', () => {
      const s = live();
      if (s) happen(s, bus, { what: 'find' });
    }),
    bus.on('page:entered', (e) => {
      const s = live();
      if (!s) return;
      happen(s, bus, { what: 'carry' });
      happen(s, bus, { what: 'page', page: e.index + 1 });
    }),
    bus.on('quest:changed', (e) => {
      if (e.what !== 'ready') return;
      const def = questById(e.id);
      if (def) bus.emit('footnote', { text: readyNote(def) });
    }),
  ];
  return () => offs.forEach((off) => off());
}

// ---------- the test hook ----------

export interface QuestHook {
  /** The tickets pinned on the board of the current planet. */
  offers(): { id: string; kind: QuestKind; n: number; planet: number }[];
  /** The tickets taken, with their progress. */
  active(): { id: string; kind: QuestKind; progress: number; n: number; stage: number; ready: boolean }[];
  /** Take the offer with this id, or the first offer of this kind. Returns the id taken, or null. */
  accept(idOrKind: string): string | null;
  drop(id: string): boolean;
  /** Put the ticket at its goal (the walk of a real run is not repeated in a test). */
  finish(id: string): boolean;
  /** "Zgłaszam wykonanie". */
  report(id: string): boolean;
  /** Count one happening as the bus would (kill, find, page, carry, clerk). */
  happen(ev: QuestHappening): void;
  /** How many tickets were completed. */
  done(): number;
}

export function createQuestHook(getState: () => RunState | null, bus: Bus): QuestHook {
  const need = (): RunState => {
    const s = getState();
    if (!s) throw new Error('no run');
    return s;
  };
  return {
    offers: () => {
      const s = need();
      return offersFor(questPlanet(s), questsOf(s)).map((d) => ({ id: d.id, kind: d.kind, n: d.n, planet: d.planet }));
    },
    active: () => {
      const s = need();
      return questsOf(s).active.flatMap((a) => {
        const d = questById(a.id);
        return d ? [{ id: a.id, kind: d.kind, progress: a.progress, n: d.n, stage: a.stage, ready: a.progress >= d.n }] : [];
      });
    },
    accept: (idOrKind) => {
      const s = need();
      const offers = offersFor(questPlanet(s), questsOf(s));
      const pick = offers.find((d) => d.id === idOrKind) ?? offers.find((d) => d.kind === idOrKind);
      return pick && takeQuest(s, bus, pick.id) === 'ok' ? pick.id : null;
    },
    drop: (id) => dropQuest(need(), bus, id),
    finish: (id) => {
      const a = questsOf(need()).active.find((x) => x.id === id);
      const d = questById(id);
      if (!a || !d) return false;
      a.progress = d.n;
      a.stage = 1;
      bus.emit('quest:changed', { id, what: 'ready' });
      return true;
    },
    report: (id) => completeQuest(need(), bus, id),
    happen: (ev) => happen(need(), bus, ev),
    done: () => questsOf(need()).done,
  };
}
