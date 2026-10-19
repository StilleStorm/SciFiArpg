/**
 * Page content (PLAN 8): what lies on a run page besides the obstacles. Plain data only; the rules are in world/content.ts,
 * the drawings in render/obstacles.ts, the placement in world/pages.ts.
 *  - teczka: a folder tapped open for loot, 0-2 per page.
 *  - pieczec: an office seal; walking onto it stamps a timed buff on the player, 0-1 per page, one of six.
 *  - zdarzenie: an event of the frame (a form to fill under fire, a lost delivery, an audit), 0-1 per page.
 */

export const SEAL_IDS = ['pilnosc', 'kontrola', 'argument', 'obieg', 'zwolnienie', 'wypoczynek'] as const;
export type SealId = (typeof SEAL_IDS)[number];

export const EVENT_IDS = ['formularz', 'przesylka', 'audyt'] as const;
export type EventId = (typeof EVENT_IDS)[number];

/** What a seal changes, as neutral-by-default numbers (see `effectsOf` in world/content.ts). */
export interface SealDef {
  id: SealId;
  /** How long the stamp holds. */
  seconds: number;
  /** pilnosc: factor on the move speed. */
  speedMul?: number;
  /** kontrola: added to the crit chance (0..1). */
  crit?: number;
  /** argument: extra share of every meter gain (0.5 = one and a half times). */
  meterBonus?: number;
  /** obieg: added to the clause's loot tier bonus (lifts a plain drop one column). */
  lootTier?: number;
  /** zwolnienie: paragraphs cost nothing while the stamp holds (no racja price, no added cooldown; PLAN 8 "free paragraphs"). */
  freeParagraphs?: boolean;
  /** wypoczynek: racja back per second as a share of the maximum. */
  regen?: number;
}

export const SEALS: Record<SealId, SealDef> = {
  pilnosc: { id: 'pilnosc', seconds: 40, speedMul: 1.25 },
  kontrola: { id: 'kontrola', seconds: 40, crit: 0.15 },
  argument: { id: 'argument', seconds: 40, meterBonus: 0.5 },
  obieg: { id: 'obieg', seconds: 40, lootTier: 1 },
  zwolnienie: { id: 'zwolnienie', seconds: 30, freeParagraphs: true },
  wypoczynek: { id: 'wypoczynek', seconds: 40, regen: 0.03 },
};

/** A stamp on the player: the seal, the seconds left and the length it started with. */
export interface ActiveBuff {
  id: SealId;
  remaining: number;
  total: number;
}

interface ContentBase {
  /** Unique within a run (page index x 100 + position). */
  id: number;
  x: number;
  y: number;
  /** Seeds the hand-drawn irregularity (render only). */
  seed: number;
}

export interface Teczka extends ContentBase {
  kind: 'teczka';
  opened: boolean;
}

export interface Pieczec extends ContentBase {
  kind: 'pieczec';
  seal: SealId;
  used: boolean;
}

export type EventPhase = 'idle' | 'active' | 'done' | 'failed';

export interface Zdarzenie extends ContentBase {
  kind: 'zdarzenie';
  event: EventId;
  phase: EventPhase;
  /**
   * formularz: seconds filled. przesylka: seconds left once the parcel is carried. audyt: seconds elapsed.
   * Zero while idle.
   */
  progress: number;
  /** przesylka: where the addressee waits (x, y is the parcel). */
  to?: { x: number; y: number };
}

export type PageContent = Teczka | Pieczec | Zdarzenie;
export type ContentKind = PageContent['kind'];

/** Geometry shared by the rules, the placement and the drawings (world units). */
export const CONTENT = {
  /** Footprint kept free around an object when it is placed. */
  teczkaR: 34,
  pieczecR: 30,
  /** A tap within this distance of a folder chooses it. */
  teczkaTap: 70,
  /** A chosen folder opens when the player is this close. */
  teczkaReach: 64,
  /** With a joystick there is no tap: standing this close opens it. */
  teczkaSteerReach: 46,
  /** The seal stamps the player at this distance (plus the player's radius). */
  pieczecReach: 34,
  /** formularz: radius of the desk the player must stay at, seconds needed, enemies sent. */
  formR: 95,
  formNeed: 8,
  /** przesylka: pick-up radius, delivery radius, seconds to deliver. */
  parcelPick: 52,
  addresseeR: 64,
  parcelSeconds: 50,
  /** audyt: radius that starts it, radius that must not be left, length. */
  auditStart: 70,
  auditR: 130,
  auditSeconds: 14,
} as const;

/** True while a stamp on the player waives the price of paragraphs (zwolnienie). Pure; `buffs` is `RunState.buffs`. */
export function paragraphsFree(buffs: readonly ActiveBuff[] | undefined): boolean {
  return buffs !== undefined && buffs.some((b) => SEALS[b.id].freeParagraphs === true);
}

/** A paragraph patch with its price taken off: no racja cost, no added cooldown (a shorter one stays). Pure. */
export function waivePrice<P extends { cost?: number; cd?: number }>(patch: P): P {
  const out = { ...patch };
  delete out.cost;
  if ((out.cd ?? 0) > 0) delete out.cd;
  return out;
}
