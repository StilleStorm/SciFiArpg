/**
 * Przesyłka (ITEMS 6.4, 8; DESIGN 7): the rare channel. A zestaw piece or a unique from a common or elite enemy, and a rzadki three
 * times in ten, does not drop; it is sent by post (an awizo, `Awizo` in items/types.ts) to the paczkomat of the run, at most once per page.
 * In the run the awizo waits at the paczkomat's page: standing at the paczkomat requests the code, the SMS arrives 6-12 s later and the
 * item enters the bag. An awizo not collected goes to the base paczkomat when the run ends (pickup 15 gwiazdki, ui/paczkomat.ts) and goes
 * back to the sender after two more runs. A side ticket's item reward is an awizo at the base from the start. Awizos sit beside the bag
 * (`Player.awizos`), saved with the character. Everything here is plain data and functions of the run state.
 */
import type { Bus } from '../core/events';
import { createRng, type Rng } from '../core/rng';
import type { Player } from '../entities/types';
import { spendStars } from '../economy/stars';
import { t } from '../i18n';
import { AWIZO_RUNS_AT_BASE, CODE_DELAY, CODE_KEEP, CODE_REACH, PACZKOMAT_FEE, RZADKI_AWIZO_CHANCE } from '../balance/loot';
import type { RunState } from '../world/run';
import { freeVersionOf } from './generate';
import { addItem, inventoryFull } from './inventory';
import { makeSetPiece } from './setPieces';
import { UNIQUES_BY_ID, makeUnique, uniqueNote } from './uniques';
import type { Awizo, Item, SetId } from './types';

export const awizosOf = (p: Pick<Player, 'awizos'>): readonly Awizo[] => p.awizos ?? [];

/** The channel an item travels by: zestaw pieces and uniques always, a rzadki by chance, the rest never. */
export function postKind(item: Pick<Item, 'tier' | 'setId' | 'uniqueId'>): 'always' | 'maybe' | 'never' {
  if (item.setId || item.uniqueId || item.tier === 'unikatowy') return 'always';
  return item.tier === 'rzadki' ? 'maybe' : 'never';
}

/** The 1-based page of this run whose paczkomat is still ahead (or here); 0 when the run has none (or it was passed). */
export function paczkomatPage(s: Pick<RunState, 'pages' | 'pageIndex'>): number {
  const at = s.pages.findIndex((pg) => pg.hasKiosk);
  return at >= s.pageIndex ? at + 1 : 0;
}

const sentOn = new WeakMap<RunState, Set<number>>();

/** Put a parcel on the post: number it, address it, file it with the player. */
export function issueAwizo(s: Pick<RunState, 'nextItemNumber' | 'player' | 'seed'>, item: Item, page: number, komisja = false): Awizo {
  item.number = s.nextItemNumber++;
  const awizo: Awizo = { n: item.number, item, page, age: 0, ...(page > 0 ? { seed: s.seed } : {}), ...(komisja ? { komisja: true } : {}) };
  (s.player.awizos ??= []).push(awizo);
  return awizo;
}

/**
 * A drop of a common or elite enemy: send it by post when it travels that way and the page has not sent one yet. Returns the awizo, or
 * null when the item must drop on the ground (the caller then places it). Rolls the 30% of a rzadki on `rng` only when the page is free.
 */
export function sendByPost(s: RunState, bus: Bus | undefined, rng: Rng, item: Item): Awizo | null {
  const kind = postKind(item);
  if (kind === 'never') return null;
  const used = sentOn.get(s) ?? new Set<number>();
  sentOn.set(s, used);
  if (used.has(s.pageIndex)) return null;
  if (kind === 'maybe' && !rng.chance(RZADKI_AWIZO_CHANCE)) return null;
  used.add(s.pageIndex);
  const page = paczkomatPage(s);
  const awizo = issueAwizo(s, kind === 'maybe' ? freeVersionOf(item) : item, page);
  bus?.emit('footnote', { text: t(page > 0 ? 'economy.paczkomat.sent' : 'economy.paczkomat.sentBase', { n: awizo.n, page }) });
  return awizo;
}

/** How the item of a side ticket's reward is named: a unique by id, or a piece of a set. */
export type RewardItem = { unique: string; level?: number } | { set: SetId; piece?: 0 | 1 | 2; level?: number };

/** Build the reward item of a side ticket (never paid into the bag). Null when the id names nothing. */
export function rewardItem(rng: Rng, what: RewardItem, fallbackLevel: number): Item | null {
  const level = Math.max(1, what.level ?? fallbackLevel);
  if ('unique' in what) {
    const def = UNIQUES_BY_ID.get(what.unique);
    return def ? makeUnique(def, rng.int(1, 0x3fffffff), level) : null;
  }
  return makeSetPiece(rng, what.set, level, what.piece);
}

/** The Komisja sends a side ticket's item: an awizo at the base paczkomat. */
export function sendReward(s: Pick<RunState, 'nextItemNumber' | 'player' | 'seed'>, rng: Rng, what: RewardItem, fallbackLevel: number): Awizo | null {
  const item = rewardItem(rng, what, fallbackLevel);
  return item ? issueAwizo(s, item, 0, true) : null;
}

// ---------- in the run: the code ----------

/** Seconds left until the SMS of an awizo whose code was requested. Runtime only (a clone of the awizo starts over). */
const waits = new WeakMap<Awizo, number>();

/** The four digits the SMS carries, from the item's uid. */
export const codeOf = (a: Pick<Awizo, 'item'>): string => String(1000 + (a.item.uid % 9000));

/** Is the code of this awizo on its way? */
export const codePending = (a: Awizo): boolean => waits.has(a);

/** Per step in the run: request the code of an awizo addressed to this page's paczkomat, and hand the parcel over when the SMS arrives. */
export function tickDelivery(s: RunState, bus: Bus, dt: number): void {
  const list = s.player.awizos;
  if (!list || list.length === 0 || s.phase !== 'run' || s.player.suspended) return;
  const here = s.pageIndex + 1;
  const k = s.page.obstacles.find((o) => o.kind === 'kiosk');
  const d = k ? Math.hypot(s.player.x - k.x, s.player.y - k.y) : Infinity;
  for (const a of [...list]) {
    if (a.page !== here) continue;
    const wait = waits.get(a);
    if (wait === undefined) {
      if (d > CODE_REACH) continue;
      waits.set(a, createRng(a.item.uid).fork('kod').range(CODE_DELAY[0], CODE_DELAY[1]));
      bus.emit('footnote', { text: t('economy.paczkomat.codeAsked', { n: a.n }) });
      continue;
    }
    if (d > CODE_KEEP) {
      waits.delete(a);
      bus.emit('footnote', { text: t('economy.paczkomat.codeLost', { n: a.n }) });
      continue;
    }
    if (wait - dt > 0) {
      waits.set(a, wait - dt);
      continue;
    }
    if (inventoryFull(s.player)) {
      waits.set(a, 4);
      bus.emit('footnote', { text: t('items.full') });
      continue;
    }
    waits.delete(a);
    list.splice(list.indexOf(a), 1);
    if (list.length === 0) delete s.player.awizos;
    addItem(s.player, a.item);
    bus.emit('footnote', { text: t('economy.paczkomat.released', { n: a.n, code: codeOf(a) }) });
    if (a.item.uniqueId) bus.emit('footnote', { text: uniqueNote(a.item.uniqueId) });
  }
}

// ---------- the end of a run, the base paczkomat ----------

/**
 * A run ended: every awizo still on a page goes to the base paczkomat; one that was already at the base has waited one more run, and
 * after `AWIZO_RUNS_AT_BASE` it is returned to the sender. Gives back the items sent back.
 */
export function settleAwizos(p: Pick<Player, 'awizos'>): Item[] {
  const returned: Item[] = [];
  const keep: Awizo[] = [];
  for (const a of p.awizos ?? []) {
    if (a.page > 0) {
      a.page = 0;
      keep.push(a);
    } else if (++a.age >= AWIZO_RUNS_AT_BASE) returned.push(a.item);
    else keep.push(a);
  }
  if (keep.length > 0) p.awizos = keep;
  else delete p.awizos;
  return returned;
}

/** Runs an awizo at the base has left before it goes back. */
export const runsLeft = (a: Pick<Awizo, 'age'>): number => Math.max(0, AWIZO_RUNS_AT_BASE - a.age);

export type ClaimResult = 'ok' | 'missing' | 'away' | 'full' | 'poor';

/** Fetch a parcel from the base paczkomat for `PACZKOMAT_FEE` gwiazdki; the item goes into the bag. */
export function claimAwizo(p: Player, n: number): { result: ClaimResult; item?: Item } {
  const a = (p.awizos ?? []).find((x) => x.n === n);
  if (!a) return { result: 'missing' };
  if (a.page > 0) return { result: 'away' };
  if (inventoryFull(p)) return { result: 'full' };
  if (!spendStars(p, PACZKOMAT_FEE)) return { result: 'poor' };
  p.awizos = (p.awizos ?? []).filter((x) => x !== a);
  if (p.awizos.length === 0) delete p.awizos;
  addItem(p, a.item);
  return { result: 'ok', item: a.item };
}

const sentBack: Item[] = [];

/**
 * Wire the post once (items/install.ts): an ended run files its awizos, a new ticket takes those of a given-up one to the base, and the base
 * prints what went back to the sender. `run:ended` is heard before main.ts files the run into the save.
 */
export function bindDelivery(bus: Bus, getState: () => RunState | null): void {
  bus.on('run:ended', () => {
    const s = getState();
    if (s) sentBack.push(...settleAwizos(s.player));
  });
  // a ticket that was given up (the desk's "Nowe zgłoszenie", another seed starts): its awizos wait at the base instead of at a page that is gone
  bus.on('run:started', (e) => {
    for (const a of getState()?.player.awizos ?? []) if (a.page > 0 && a.seed !== undefined && a.seed !== e.seed) a.page = 0;
  });
  bus.on('base:entered', () => {
    for (const item of sentBack.splice(0)) bus.emit('footnote', { text: t('economy.paczkomat.returned', { n: item.number }) });
  });
}
