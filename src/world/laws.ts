/**
 * The regulamin: one absurd clause per run that is also a real modifier (DESIGN section 4).
 *
 * `applyLaw(state, lawId)` fills `state.law` (a LawFlags object; neutral values when no clause is
 * active, so every system may read the flags unconditionally). `tickLaw` runs the time-based ones.
 * `bindLaws(bus, getState)` listens to events (bot replies, service fee, update drop).
 *
 * FLAGS (state.law.*) and who is expected to read them
 *   id                 the active clause or null.
 *   spawnPairs         bool. Enemies spawn in pairs (spawn code: spawn count x2, second beside the first).
 *   lootPairs          bool. Every drop is doubled; the second is a worse "wariant" (loot code).
 *   speedMul           number. Player move speed factor (applied by lawPre/lawPost around the step).
 *   knockbackMul       number. Knockback distance factor (combat code that knocks back).
 *   enemyDrift         bool. Enemies drift slowly (tickLaw applies the drift itself).
 *   hours              {cycleS, consultantS, botS, lunchFromS, lunchToS} | null. The Godziny clock.
 *   botTime            bool, live. True during the bot part of the cycle. No damage is dealt either
 *                      way (step.ts skips the auto-attack systems); skills should check it too.
 *   reverseAfter       seconds of run time after which time runs backwards, or null.
 *   reversed           bool, live. Enemies walk backwards (tickLaw pushes chasing enemies away
 *                      itself; AI must not also reverse; it may use the flag for visuals).
 *                      The XP line in the HUD shows the negative form while true.
 *   weaponNeedsUpdate  bool. The weapon is crippled until the update is installed.
 *   weaponDamageMul    number. 0.5 while weaponNeedsUpdate, else 1 (applied by lawPre/lawPost to the
 *                      player's damage range around the step; other damage sources should multiply).
 *   noiseAggroMul      number. 2 under Nie przeszkadzac. Aggro radius = base * aggroMul(state).
 *   noisyUntil         run time until which the player is loud (set by skill events).
 *   killCost           gwiazdki taken for every kill (Oplata serwisowa).
 *   lootTierBonus      added to the rolled loot tier (loot code).
 *   cookies            bool. A banner on every page; cookieChoice 'all' | 'minimal' | null.
 *   extraElites        elites added to every populated page (spawn code reads it; populate also does).
 *   lootMul            drop quantity/quality factor from the cookie choice.
 *   enemyCountMul      population factor from the cookie choice.
 *   twoFactorExit      bool. The exit asks for a code. exitUnlocked: this page's exit may be used.
 *   officeOpen         bool, live. The kiosk (Sklep) is open (lunch break, or the default window).
 */
import type { Bus } from '../core/events';
import { t } from '../i18n';
import type { RunState } from './run';
import { resolveMove } from './pages';
import { enemyInfo } from './enemyInfo';

export type LawId =
  | 'parzystosc'
  | 'grawitacja'
  | 'godziny-konsultanta'
  | 'czas-wsteczny'
  | 'wymagana-aktualizacja'
  | 'nie-przeszkadzac'
  | 'oplata-serwisowa'
  | 'ciasteczka'
  | 'weryfikacja-dwuetapowa';

export interface Law {
  id: LawId;
  /** i18n keys, e.g. 'laws.parzystosc.name' and 'laws.parzystosc.text'. */
  nameKey: string;
  textKey: string;
}

const law = (id: LawId): Law => ({ id, nameKey: `laws.${id}.name`, textKey: `laws.${id}.text` });

export const LAWS: readonly Law[] = [
  law('parzystosc'),
  law('grawitacja'),
  law('godziny-konsultanta'),
  law('czas-wsteczny'),
  law('wymagana-aktualizacja'),
  law('nie-przeszkadzac'),
  law('oplata-serwisowa'),
  law('ciasteczka'),
  law('weryfikacja-dwuetapowa'),
];

export interface HoursSpec {
  cycleS: number;
  consultantS: number;
  botS: number;
  /** Lunch break inside the consultant part: the Sklep is open then. */
  lunchFromS: number;
  lunchToS: number;
}

export interface LawFlags {
  id: LawId | null;
  spawnPairs: boolean;
  lootPairs: boolean;
  speedMul: number;
  knockbackMul: number;
  enemyDrift: boolean;
  hours: HoursSpec | null;
  botTime: boolean;
  reverseAfter: number | null;
  reversed: boolean;
  weaponNeedsUpdate: boolean;
  weaponDamageMul: number;
  noiseAggroMul: number;
  noisyUntil: number;
  killCost: number;
  lootTierBonus: number;
  cookies: boolean;
  cookieChoice: 'all' | 'minimal' | null;
  extraElites: number;
  lootMul: number;
  enemyCountMul: number;
  twoFactorExit: boolean;
  exitUnlocked: boolean;
  officeOpen: boolean;
  // ---- private bookkeeping of the clauses (documented for tests) ----
  updateOffered: boolean;
  codeAt: number | null;
  code: string | null;
  stillFor: number;
  botLastAt: number;
  botIndex: number;
  feeNoted: boolean;
  noiseNoted: number;
  officeFrom: number | null;
  officeTo: number | null;
}

export function neutralLaw(): LawFlags {
  return {
    id: null,
    spawnPairs: false,
    lootPairs: false,
    speedMul: 1,
    knockbackMul: 1,
    enemyDrift: false,
    hours: null,
    botTime: false,
    reverseAfter: null,
    reversed: false,
    weaponNeedsUpdate: false,
    weaponDamageMul: 1,
    noiseAggroMul: 1,
    noisyUntil: -1,
    killCost: 0,
    lootTierBonus: 0,
    cookies: false,
    cookieChoice: null,
    extraElites: 0,
    lootMul: 1,
    enemyCountMul: 1,
    twoFactorExit: false,
    exitUnlocked: false,
    officeOpen: false,
    updateOffered: false,
    codeAt: null,
    code: null,
    stillFor: 0,
    botLastAt: -100,
    botIndex: 0,
    feeNoted: false,
    noiseNoted: 0,
    officeFrom: null,
    officeTo: null,
  };
}

export const HOURS: HoursSpec = { cycleS: 40, consultantS: 30, botS: 10, lunchFromS: 12, lunchToS: 22 };
export const REVERSE_AFTER_S = 300;
export const BOT_REPLY_GAP_S = 3;
export const COOKIE_IDLE_S = 30;
export const CODE_DELAY_S: readonly [number, number] = [6, 12];
/** Default Sklep window (seconds after entering the kiosk page): opens late, stays two minutes. */
export const OFFICE_OPENS_AFTER_S = 8;
export const OFFICE_WINDOW_S = 120;
export const NOISE_S = 4;
export const BOT_LINES = 8;

/** Hooks other agents' code may install (the lead wires them in main.ts). */
export interface LawHooks {
  /** Add one unwanted-feature affix to the weapon; return its footnote text (starts with "Nowość!"), or null if there is none. */
  unwantedFeature?: (state: RunState) => string | null;
  /** Tell the economy agent's office-hours module that the Sklep opened or closed. */
  officeChanged?: (open: boolean) => void;
  /** The player left the kiosk page: forget the decision. */
  officeReset?: () => void;
}
export const lawHooks: LawHooks = {};

/** Set the modifiers of one clause. Idempotent. Resets the clause-specific bookkeeping. */
export function applyLaw(state: RunState, lawId: LawId): void {
  const L = Object.assign(state.law, neutralLaw());
  L.id = lawId;
  state.lawId = lawId;
  switch (lawId) {
    case 'parzystosc':
      L.spawnPairs = true;
      L.lootPairs = true;
      break;
    case 'grawitacja':
      L.speedMul = 1.3;
      L.knockbackMul = 3;
      L.enemyDrift = true;
      break;
    case 'godziny-konsultanta':
      L.hours = { ...HOURS };
      break;
    case 'czas-wsteczny':
      L.reverseAfter = REVERSE_AFTER_S;
      break;
    case 'wymagana-aktualizacja':
      L.weaponNeedsUpdate = true;
      L.weaponDamageMul = 0.5;
      break;
    case 'nie-przeszkadzac':
      L.noiseAggroMul = 2;
      break;
    case 'oplata-serwisowa':
      L.killCost = 1;
      L.lootTierBonus = 1;
      break;
    case 'ciasteczka':
      L.cookies = true;
      break;
    case 'weryfikacja-dwuetapowa':
      L.twoFactorExit = true;
      break;
  }
}

// ---------- hours ----------

export type HoursPhase = 'consultant' | 'bot';

export function hoursPhase(h: HoursSpec, time: number): HoursPhase {
  return time % h.cycleS < h.consultantS ? 'consultant' : 'bot';
}

export function lunchBreak(h: HoursSpec, time: number): boolean {
  const c = time % h.cycleS;
  return c >= h.lunchFromS && c < h.lunchToS;
}

/** Is the kiosk open at run time `time`? Under Godziny: lunch only. Otherwise the fixed window. */
export function officeIsOpen(L: LawFlags, time: number): boolean {
  if (L.hours) return lunchBreak(L.hours, time);
  return L.officeFrom !== null && L.officeTo !== null && time >= L.officeFrom && time < L.officeTo;
}

/** Multiplier for enemy aggro radius right now (Nie przeszkadzac: skills make noise). */
export function aggroMul(state: RunState): number {
  const L = state.law;
  return L.noiseAggroMul > 1 && state.time < L.noisyUntil ? L.noiseAggroMul : 1;
}

// ---------- page entry ----------

/** A new page began (also page 0). Opens the kiosk window, resets the exit, shows the cookie banner. */
export function onPageEntered(state: RunState, bus: Bus): void {
  const L = state.law;
  L.exitUnlocked = false;
  L.code = null;
  L.codeAt = null;
  L.stillFor = 0;
  if (state.page.hasKiosk && !L.hours) {
    L.officeFrom = state.time + OFFICE_OPENS_AFTER_S;
    L.officeTo = L.officeFrom + OFFICE_WINDOW_S;
  } else if (!state.page.hasKiosk) {
    L.officeFrom = null;
    L.officeTo = null;
  }
  if (L.cookies) askCookies(state, bus);
  // The update must not stay missing for a whole run if no elite ever turns up.
  if (L.weaponNeedsUpdate && !L.updateOffered && state.pageIndex >= 2) offerUpdate(state, bus);
}

// ---------- modals ----------

export function askCookies(state: RunState, bus: Bus): void {
  if (state.modal) return;
  state.modal = 'cookies';
  state.law.stillFor = 0;
  bus.emit('law:ask', { kind: 'cookies' });
}

/** The player's answer to the cookie banner. Sets the population/loot factors for the page. */
export function answerCookies(state: RunState, bus: Bus, choice: 'all' | 'minimal'): void {
  const L = state.law;
  L.cookieChoice = choice;
  if (choice === 'all') {
    L.extraElites = 1;
    L.lootMul = 1.5;
    L.enemyCountMul = 1.25;
  } else {
    L.extraElites = 0;
    L.lootMul = 0.6;
    L.enemyCountMul = 0.6;
  }
  if (state.modal === 'cookies') state.modal = null;
  bus.emit('law:trigger', { law: 'ciasteczka', kind: `cookies:${choice}` });
  bus.emit('footnote', { text: t(choice === 'all' ? 'laws.cookies.allDone' : 'laws.cookies.minimalDone') });
}

function offerUpdate(state: RunState, bus: Bus): void {
  state.law.updateOffered = true;
  if (state.modal) return;
  state.modal = 'update';
  bus.emit('law:ask', { kind: 'update' });
}

/** The player installs the update: the weapon recovers, one unwanted feature arrives ("Nowość!"). */
export function acceptUpdate(state: RunState, bus: Bus): void {
  const L = state.law;
  if (!L.weaponNeedsUpdate) {
    if (state.modal === 'update') state.modal = null;
    return;
  }
  L.weaponNeedsUpdate = false;
  L.weaponDamageMul = 1;
  if (state.modal === 'update') state.modal = null;
  bus.emit('law:trigger', { law: 'wymagana-aktualizacja', kind: 'update:installed' });
  const feature = lawHooks.unwantedFeature?.(state) ?? null;
  if (feature) {
    bus.emit('footnote', { text: feature });
  } else {
    L.speedMul *= 0.95;
    bus.emit('footnote', { text: t('laws.update.featureDefault') });
  }
}

// ---------- two-factor exit ----------

/**
 * The player stands at the exit. Returns true when the page may be left. Otherwise a code is
 * requested (once); it arrives as an SMS footnote 6-12 s later.
 */
export function canLeave(state: RunState, bus: Bus): boolean {
  const L = state.law;
  if (!L.twoFactorExit || L.exitUnlocked) return true;
  if (L.codeAt === null && L.code === null) {
    L.codeAt = state.time + state.rngs.ai.range(CODE_DELAY_S[0], CODE_DELAY_S[1]);
    bus.emit('law:trigger', { law: 'weryfikacja-dwuetapowa', kind: 'code:requested' });
    bus.emit('footnote', { text: t('laws.code.requested') });
  }
  return false;
}

/** The player types the code (the sheet fills it in): the exit opens for this page. */
export function submitCode(state: RunState, bus: Bus): void {
  const L = state.law;
  if (L.code === null) return;
  L.exitUnlocked = true;
  if (state.modal === 'code') state.modal = null;
  bus.emit('law:trigger', { law: 'weryfikacja-dwuetapowa', kind: 'code:accepted' });
  bus.emit('footnote', { text: t('laws.code.accepted') });
}

// ---------- bot replies ----------

/** The scripted bot answer to a player action during bot hours; null when none is due. */
export function botReply(state: RunState): string | null {
  const L = state.law;
  if (!L.botTime) return null;
  if (state.time - L.botLastAt < BOT_REPLY_GAP_S) return null;
  L.botLastAt = state.time;
  const line = t(`laws.bot.${L.botIndex % BOT_LINES}`);
  L.botIndex++;
  return line;
}

// ---------- the per-step system ----------

/** Time-based clauses. Called every step after `time` advanced. */
export function tickLaw(state: RunState, bus: Bus, dt: number): void {
  const L = state.law;
  if (!L.id || state.phase === 'base') return; // the clauses tick in the run proper only
  const p = state.player;

  if (L.hours) {
    const bot = hoursPhase(L.hours, state.time) === 'bot';
    if (bot !== L.botTime) {
      L.botTime = bot;
      bus.emit('law:trigger', { law: L.id, kind: bot ? 'hours:bot' : 'hours:consultant' });
    }
  }

  if (L.reverseAfter !== null && !L.reversed && state.time >= L.reverseAfter) {
    L.reversed = true;
    bus.emit('law:trigger', { law: L.id, kind: 'reverse:start' });
  }

  if (L.enemyDrift) {
    for (const e of state.enemies) {
      const a = e.id * 2.399 + state.time * 0.35;
      e.x += Math.cos(a) * 16 * dt;
      e.y += Math.sin(a) * 16 * dt;
      resolveMove(state.page, e, e.r);
    }
  }

  if (L.reversed) {
    for (const e of state.enemies) {
      if (e.mode !== 'chase' || !e.moving) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const back = e.speed * 1.6 * dt;
      e.x += (dx / d) * back;
      e.y += (dy / d) * back;
      resolveMove(state.page, e, e.r);
    }
  }

  if (L.cookies && !state.modal) {
    if (!p.moving && p.target === null) {
      L.stillFor += dt;
      if (L.stillFor >= COOKIE_IDLE_S) {
        askCookies(state, bus);
        bus.emit('footnote', { text: t('laws.cookies.again') });
      }
    } else {
      L.stillFor = 0;
    }
  }

  if (L.codeAt !== null && state.time >= L.codeAt && L.code === null) {
    let digits = '';
    for (let i = 0; i < 6; i++) digits += String(state.rngs.ai.int(0, 9));
    L.code = digits;
    L.codeAt = null;
    bus.emit('footnote', { text: t('laws.code.sms', { code: `${digits.slice(0, 3)} ${digits.slice(3)}` }) });
    if (!state.modal) {
      state.modal = 'code';
      bus.emit('law:ask', { kind: 'code' });
    }
  }

  // The kiosk exists on one page only; the economy hears about it when it opens or closes there.
  const onKiosk = state.page.hasKiosk;
  const open = onKiosk && officeIsOpen(L, state.time);
  if (open !== L.officeOpen) {
    L.officeOpen = open;
    if (onKiosk) lawHooks.officeChanged?.(open);
    else lawHooks.officeReset?.();
  }
}

// ---------- step wrappers ----------

/**
 * Scale the player's speed and damage range by the clause's factors for the duration of one step.
 * Returns the function that undoes it. Other systems keep seeing the unmodified base values between steps.
 */
export function lawPre(state: RunState): () => void {
  const L = state.law;
  const p = state.player;
  const speedK = L.speedMul;
  const dmgK = L.weaponDamageMul;
  if (speedK === 1 && dmgK === 1) return () => undefined;
  const stats = p.stats;
  const speed0 = p.speed;
  const min0 = stats.dmgMin;
  const max0 = stats.dmgMax;
  p.speed = speed0 * speedK;
  stats.dmgMin = min0 * dmgK;
  stats.dmgMax = max0 * dmgK;
  return () => {
    if (p.speed === speed0 * speedK) p.speed = speed0;
    if (p.stats === stats && stats.dmgMin === min0 * dmgK) stats.dmgMin = min0;
    if (p.stats === stats && stats.dmgMax === max0 * dmgK) stats.dmgMax = max0;
  };
}

// ---------- event bindings ----------

/** Wire the clauses that react to the player's actions and to kills. Returns the unbind function. */
export function bindLaws(bus: Bus, getState: () => RunState | null): () => void {
  const off: (() => void)[] = [];
  const reply = (): void => {
    const s = getState();
    if (!s || s.law.id !== 'godziny-konsultanta') return;
    const line = botReply(s);
    if (line) bus.emit('footnote', { text: line });
  };
  for (const ev of ['skill:1', 'skill:2', 'skill:3', 'inventory'] as const) off.push(bus.on(ev, reply));
  off.push(bus.on('pickup:taken', reply));
  off.push(bus.on('player:tap', reply));
  for (const ev of ['skill:1', 'skill:2', 'skill:3'] as const) {
    off.push(
      bus.on(ev, () => {
        const s = getState();
        if (s && s.law.noiseAggroMul > 1) {
          const quiet = s.time >= s.law.noisyUntil;
          s.law.noisyUntil = s.time + NOISE_S;
          if (quiet && s.law.id && s.law.noiseNoted < 2) {
            s.law.noiseNoted++;
            bus.emit('law:trigger', { law: s.law.id, kind: 'noise' });
          }
        }
      }),
    );
  }
  off.push(
    bus.on('enemy:died', (e) => {
      const s = getState();
      if (!s) return;
      const L = s.law;
      if (L.killCost > 0) {
        const before = s.player.gwiazdki;
        s.player.gwiazdki = Math.max(0, before - L.killCost);
        if (!L.feeNoted) {
          L.feeNoted = true;
          bus.emit('footnote', { text: t(before > 0 ? 'laws.fee.first' : 'laws.fee.none') });
        }
      }
      if (L.weaponNeedsUpdate && !L.updateOffered && (e.tier === 'elite' || enemyInfo(e.id)?.elite)) offerUpdate(s, bus);
    }),
  );
  return () => off.forEach((f) => f());
}
