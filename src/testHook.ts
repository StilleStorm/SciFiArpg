import { dist } from './core/vec';
import type { Screen } from './core/events';
import type { Game } from './game';
import { currentTheme, setTheme, type Theme } from './render/stage';
import { addFootnote } from './ui/footnotes';
import type { Enemy } from './entities';
import type { Bus } from './core/events';
import { applyDamage } from './systems/combat';
import { attack as attackWith } from './systems/combat';
import { fireAuto } from './heroes/auto';
import type { Input } from './input';
import type { Character } from './save/character';
import type { MetaState, Settings } from './save/save';
import { steerVector } from './ui/joystick';
import { currentOrient, effectiveSteering, type Orient, type Steering } from './ui/layout';
import type { RunOptions, RunState } from './world/run';
import { openKiosk } from './economy/kiosk';
import { fillDemoInventory, giveRandomItem } from './items/demo';
import type { Item, ItemTier, Slot } from './items';
import { mountSklep, type SklepHandle } from './ui/sklep';
import { createHeroHook, type HeroHook } from './heroes/hook';
import type { Aim } from './heroes/aim';
import { castSkill } from './heroes/skills';
import { holdPad, releasePad, tapUltimatePad, ultimatePadInfo } from './ui/pads';
import { setMeterForUi } from './ui/ultimate';
import { castUltimate, meterOf, ultimateReady } from './heroes/ultimate';
import { createEnemyHook, createSporHook, type EnemyHook, type SporHook } from './enemies/hook';
import { createAudioHook, type AudioHook } from './audio/hook';

export interface GameHook {
  /** Start a run from a seed (default 1) and show the run screen. */
  start(seed?: number, opts?: RunOptions): void;
  /** Run the simulation for `seconds` of game time at once (60 Hz steps). */
  advance(seconds: number): void;
  /** The live run (read-only use in shots and tests). */
  state(): RunState | null;
  /** Play the page turn to page `index` at once, as if the exit was reached. */
  turnTo(index: number): void;
  meta(): MetaState;
  setMeta(meta: MetaState): void;
  screen(): Screen;
  go(screen: Screen): void;
  /**
   * One attack at the nearest enemy, as the step would do it (pulled into view if far): by the player's auto-attack
   * (a thrown shot for the ranged heroes, the Kartograf's laser at once) or, with 'enemy', that enemy's blow at the player. Emits attack:started.
   */
  attack(who?: 'player' | 'enemy'): boolean;
  /** Wound the nearest enemy without killing it (moves it near the player first if far away). */
  hitEnemy(): boolean;
  /** Kill the nearest enemy through the normal path (blot, strike, pickup, footnote). */
  killEnemy(): boolean;
  /** Take away `amount` racja from the player (lethal amounts kill). */
  hurtPlayer(amount: number): void;
  /** Put the player at world (x, y) and clear its walk target. */
  placePlayer(x: number, y: number): void;
  setTheme(theme: Theme): void;
  theme(): 'day' | 'night';
  footnote(text: string): void;
  /** The printed footnotes, oldest first (the last 60): their numbers run on through one ticket, base page and run. */
  notes(): { n: number; text: string }[];
  /** Put a rolled item of `tier` (default zwykly) into the inventory; returns it, or null when there is no run or no room. */
  giveItem(tier?: ItemTier | 'unikatowy', slot?: Slot): Item | null;
  /** Replace the inventory with six fixed items (two worn, one niekompatybilny, a unique, a free version). */
  demoInventory(): void;
  /** Open the Załączniki sheet (same as the pad). */
  openInventory(): void;
  /** Open the base Sklep sheet over the current screen (gwiazdki are topped up to 40 if lower). */
  openSklep(): void;
  /** Tap the in-run kiosk: the sheet when the office is open, a bot footnote otherwise. */
  openKiosk(): string;
  /** Hero skills, updates, permissions and deaths (heroes/hook.ts). */
  hero: HeroHook;
  /**
   * Fire skill 1, 2 or 3 with an aim now: `{kind:'kierunek', dx, dy}`, `{kind:'wskazanie', x, y}` (world units) or
   * `{kind:'auto'}` (heroes/aim.ts). False on cooldown or if nothing happened.
   */
  aimCast(slot: 1 | 2 | 3, aim: Aim): boolean;
  /** Hold skill pad 1..3 with the finger (dx, dy) css px from the pad's centre (0, 0 = back on the pad); the preview is drawn. */
  holdPad(slot: 1 | 2 | 3, dx: number, dy: number): void;
  /** Lift the finger held by `holdPad`: the skill fires with that aim, or nothing if the finger is back on the pad. True when a cast was asked for. */
  releasePad(slot: 1 | 2 | 3): boolean;
  /** Press the ultimate stamp pad (S3). True when a cast happened (the pad is disabled until the meter is full). */
  tapUltimate(): boolean;
  /** What the ultimate pad shows: ready, drawn disabled, strokes inked, hidden (below the level of the first ultimate). Null before the pads exist. */
  ultimatePad(): { ready: boolean; off: boolean; inked: number; hidden: boolean } | null;
  /** Set the player's level directly (no update form, no reputacja): shows the ultimate pad at FIRST_ULTIMATE_LEVEL and lets the cast go. */
  setLevel(level: number): void;
  /** Set the Argument meter (0..1) of the live run, for the interface only (shots, the pad leg). */
  setMeterUi(v: number): void;
  /** Fill the Argument meter of the live run (default full). The meter itself, not only its drawing. */
  fillMeter(v?: number): void;
  /** Cast the hero's ultimate now (heroes/ultimate.ts): needs a full meter. True when cast. */
  castUltimate(): boolean;
  /** Plain data: the meter and the running ultimates. */
  ultimateInfo(): { meter: number; ready: boolean; active: string[]; paragraph: number } | null;
  /** Families, bosses and statuses on demand (enemies/hook.ts). */
  enemies: EnemyHook;
  /** The boss argument: answer a reply, read the prompt and the x2 window (enemies/hook.ts). */
  spor: SporHook;
  /** Offline audio renders and the live context state (audio/hook.ts). */
  audio: AudioHook;
  /**
   * Save the orientation setting and ask for the lock where there is one. The layout itself follows the window:
   * in a browser test change the viewport (`page.setViewportSize`) to flip `data-orient`.
   */
  setOrientation(orient: Orient): void;
  /** Choose joystick or tap as the player would in the settings (it is remembered as his choice). */
  setSteering(steering: Steering): void;
  /** The left-handed mirror, as the settings screen sets it. */
  setLeftHanded(on: boolean): void;
  /** What steers now: the layout orientation and the steering in force. */
  controls(): { orient: Orient; steering: Steering };
  /** Hold the stick at a finger offset of (dx, dy) css px from its centre (null lets go). Needs joystick mode. */
  joystick(dx: number, dy: number): void;
  /** The pause button: hold the run and open the pause sheet. False when a form or the sheet already holds it. */
  pause(): boolean;
  /** Wznów on the pause sheet. */
  resume(): void;
  /** Zakończ zgłoszenie on the pause sheet: character and bookmark saved, back to the base. */
  endTicket(): void;
  /** "Wznów zgłoszenie nr ..." on the base; false when there is no bookmark. */
  resumeTicket(): boolean;
  /** The Tunel note on the HUD: cut a hole at the player's feet. False when nothing can be cut now. */
  openTunnel(): boolean;
  /**
   * Walk onto the open hole: the hole is armed, the player is put on it and one step runs, so the real rule takes him in
   * (the run is held, the screen is 'baza'). False when no tunnel is open or the screen did not change.
   */
  enterTunnel(): boolean;
  /** "Wróć do zgłoszenia" on the base: the held run continues. False when none is held. */
  returnFromTunnel(): boolean;
  /** The saved character record (null before the first save). */
  character(): Character | null;
  /**
   * The base page of a planet (DESIGN 4.1) for `seed` (default: the next ticket's planet), as `go('baza')` shows it: a
   * walkable page with the stations, no enemies, the exit locked. Returns the state.
   */
  startBase(seed?: number): RunState;
  /** Walk up to a station and tap it: its sheet opens ('biurko' the desk, 'kiosk' the Sklep, 'tablica' the settings, 'paczkomat' a footnote). */
  station(name: 'biurko' | 'kiosk' | 'tablica' | 'paczkomat'): boolean;
  /** "Akceptuję regulamin" without the sheet: the exit of the base opens. False outside the base. */
  acceptTicket(): boolean;
  /**
   * Put the player into the exit of the base page and run one step: when the exit is open the page turn to the first page of
   * the run starts (the run begins). Returns whether the turn started; a locked exit only answers with its note.
   */
  walkToExit(): boolean;
  /** Plain-data snapshot for assertions. */
  snapshot(): { screen: Screen; time: number; hp: number; enemies: number; pickups: number; kills: number; x: number; y: number } | null;
}

declare global {
  interface Window {
    __game?: GameHook;
  }
}

export interface HookDeps {
  game: Game;
  getScreen(): Screen;
  go(screen: Screen, seed?: number, opts?: RunOptions): void;
  getMeta(): MetaState;
  setMeta(meta: MetaState): void;
  bus: Bus;
  input: Input;
  /** Merge into the saved settings and apply them (main.ts). */
  changeSettings(patch: Partial<Settings>): void;
  pause(): boolean;
  resume(): void;
  endTicket(): void;
  resumeTicket(): boolean;
  openTunnel(): boolean;
  returnFromTunnel(): boolean;
  startBase(seed?: number): RunState;
  station(name: 'biurko' | 'kiosk' | 'tablica' | 'paczkomat'): boolean;
  acceptTicket(): boolean;
  /** The footnotes as printed (ui/footnotes.ts `recent`). */
  notes(): { n: number; text: string }[];
}

const NEAR = 90;

let skHandle: SklepHandle | null = null;

export function installTestHook(deps: HookDeps): void {
  const { game } = deps;

  /** Nearest enemy, pulled into view if needed so screenshots are deterministic. */
  function nearest(): Enemy | null {
    const s = game.state;
    if (!s) return null;
    let best: Enemy | null = null;
    for (const e of s.enemies) if (!best || dist(e, s.player) < dist(best, s.player)) best = e;
    if (best && dist(best, s.player) > 150) {
      best.x = s.player.x + NEAR;
      best.y = s.player.y - 20;
      best.home = { x: best.x, y: best.y };
    }
    return best;
  }

  window.__game = {
    start: (seed = 1, opts) => deps.go('run', seed, opts),
    advance(seconds) {
      const steps = Math.round(seconds * 60);
      for (let i = 0; i < steps; i++) game.update(1 / 60);
    },
    state: () => game.state,
    hero: createHeroHook(game, deps.bus),
    aimCast(slot, aim) {
      const st = game.state;
      return st ? castSkill(st, deps.bus, (slot - 1) as 0 | 1 | 2, false, aim) : false;
    },
    holdPad,
    releasePad,
    tapUltimate: tapUltimatePad,
    ultimatePad: ultimatePadInfo,
    setLevel: (level) => {
      if (game.state) game.state.player.level = Math.max(1, Math.floor(level));
    },
    setMeterUi: (v) => {
      if (game.state) setMeterForUi(game.state, v);
    },
    fillMeter: (v = 1) => {
      if (game.state) game.state.player.meter = Math.min(1, Math.max(0, v));
    },
    castUltimate: () => (game.state ? castUltimate(game.state, deps.bus) : false),
    ultimateInfo() {
      const st = game.state;
      if (!st) return null;
      return { meter: meterOf(st.player), ready: ultimateReady(st.player), active: (st.hero.ult?.active ?? []).map((u) => u.id), paragraph: st.hero.ult?.para ?? 1 };
    },
    enemies: createEnemyHook(() => game.state, deps.bus),
    spor: createSporHook(() => game.state, deps.bus),
    audio: createAudioHook(),
    turnTo(index) {
      const s = game.state;
      if (!s || s.turning) return;
      s.turning = true;
      deps.bus.emit('page:turn', { from: s.pageIndex, to: index });
    },
    meta: () => deps.getMeta(),
    setMeta: (m) => deps.setMeta(m),
    screen: () => deps.getScreen(),
    go: (screen) => deps.go(screen),
    attack(who = 'player') {
      const e = nearest();
      const s = game.state;
      if (!e || !s) return false;
      if (who === 'enemy') attackWith(s, deps.bus, e, s.player);
      else if (!fireAuto(s, s.player, e, deps.bus)) attackWith(s, deps.bus, s.player, e);
      return true;
    },
    hitEnemy() {
      const e = nearest();
      const s = game.state;
      if (!e || !s) return false;
      applyDamage(s, deps.bus, e, 4, false);
      return true;
    },
    killEnemy() {
      const e = nearest();
      const s = game.state;
      if (!e || !s) return false;
      applyDamage(s, deps.bus, e, e.hp + 1, false);
      return true;
    },
    hurtPlayer(amount) {
      const s = game.state;
      if (s && s.status === 'running' && s.phase === 'run') applyDamage(s, deps.bus, s.player, amount, false);
    },
    placePlayer(x, y) {
      const s = game.state;
      if (!s) return;
      s.player.x = x;
      s.player.y = y;
      s.player.target = null;
    },
    setTheme,
    theme: currentTheme,
    footnote: addFootnote,
    notes: () => deps.notes(),
    giveItem(tier = 'zwykly', slot) {
      const st = game.state;
      if (!st) return null;
      return giveRandomItem(st.player, st.nextItemNumber++, tier, Math.max(1, st.player.level + st.pageIndex), slot);
    },
    demoInventory() {
      const st = game.state;
      if (st) {
        fillDemoInventory(st.player);
        st.nextItemNumber = 15;
      }
    },
    openInventory: () => deps.bus.emit('inventory'),
    openSklep() {
      const st = game.state;
      const root = document.getElementById('ui');
      if (!root) return;
      const player = st?.player ?? { gwiazdki: 40, inventory: [], level: 1 };
      if (player.gwiazdki < 40) player.gwiazdki = 40;
      skHandle?.unmount();
      skHandle = mountSklep(root, deps.getMeta(), player);
    },
    openKiosk: () => openKiosk(),
    setOrientation: (orient) => deps.changeSettings({ orientation: orient }),
    setLeftHanded: (on) => deps.changeSettings({ leftHanded: on }),
    setSteering: (steering) => deps.changeSettings({ steering, steeringTouched: true }),
    controls: () => ({ orient: currentOrient(), steering: effectiveSteering(deps.getMeta().settings, currentOrient()) }),
    joystick(dx, dy) {
      deps.input.inject(dx === 0 && dy === 0 ? null : steerVector(dx, dy));
    },
    pause: () => deps.pause(),
    resume: () => deps.resume(),
    endTicket: () => deps.endTicket(),
    resumeTicket: () => deps.resumeTicket(),
    openTunnel: () => deps.openTunnel(),
    enterTunnel() {
      const s = game.state;
      if (!s?.tunnel) return false;
      s.tunnel.armed = true;
      s.player.x = s.tunnel.x;
      s.player.y = s.tunnel.y;
      s.player.target = null;
      game.update(1 / 60);
      return deps.getScreen() === 'baza';
    },
    returnFromTunnel: () => deps.returnFromTunnel(),
    character: () => deps.getMeta().character ?? null,
    startBase: (seed) => deps.startBase(seed),
    station: (name) => deps.station(name),
    acceptTicket: () => deps.acceptTicket(),
    walkToExit() {
      const s = game.state;
      const exit = s?.page.exit;
      if (!s || s.phase !== 'base' || !exit) return false;
      s.player.x = exit.x + (exit.corner[1] === 'l' ? 45 : -45);
      s.player.y = exit.y + (exit.corner[0] === 't' ? 45 : -45);
      s.player.target = null;
      game.update(1 / 60);
      return s.turning;
    },
    snapshot() {
      const s = game.state;
      if (!s) return null;
      return {
        screen: deps.getScreen(),
        time: s.time,
        hp: s.player.hp,
        enemies: s.enemies.length,
        pickups: s.pickups.length,
        kills: s.kills,
        x: s.player.x,
        y: s.player.y,
      };
    },
  };
}
