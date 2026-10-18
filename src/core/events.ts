export type Side = 'l' | 'r' | 't' | 'b';
/** Why a service tunnel closed (world/tunnel.ts): the player came back, a second one was cut, he died, the run ended, or the page turned. */
export type TunnelCloseReason = 'return' | 'second' | 'death' | 'end' | 'page';
export type Screen = 'title' | 'run' | 'death' | 'baza' | 'ticket' | 'settings' | 'profile';

/** Every event on the bus and its payload. `undefined` payload = no argument. */
export interface GameEvents {
  'skill:1': undefined;
  'skill:2': undefined;
  'skill:3': undefined;
  inventory: undefined;
  'screen:changed': { screen: Screen };
  'run:started': { seed: number };
  /** The run was paused (pause button, the app went to the background) or resumed; the music turns to hold music while paused. */
  'game:paused': { paused: boolean };
  /** A bookmark of the run was written to the save (page turn, pause, Zakończ, the app hidden). */
  'run:bookmarked': { pageIndex: number };
  'player:hit': { x: number; y: number; amount: number; crit: boolean };
  'player:died': { x: number; y: number };
  'enemy:hit': { id: number; x: number; y: number; amount: number; crit: boolean };
  'enemy:miss': { id: number };
  /** An attack was started (hit or miss): once per attempt. A ranged attack reports the moment of firing, not of landing. render/attackFx.ts draws it. */
  'attack:started': { attackerId: number; attacker: 'player' | 'enemy' | 'summon'; x: number; y: number; tx: number; ty: number; ranged: boolean };
  'enemy:died': { id: number; x: number; y: number; tier?: 'common' | 'elite' | 'boss'; family?: 'urzadzenia' | 'powiadomienia' | 'wygenerowane' };
  'pickup:taken': { id: number; number: number };
  'page:edge': { x: number; y: number; side: Side };
  footnote: { text: string };
  /** A footnote was printed with number `n`; `correction` = the Asystent's later correction of a wrong note (audio: typewriter key / carriage return). */
  'footnote:added': { n: number; text: string; correction: boolean };
  stamp: { text: string; x: number; y: number };
  /** A short handwritten note in the margin next to world x, y (text is already translated). */
  'margin:note': { text: string; x: number; y: number; ttl?: number };
  'run:ended': { outcome: 'zgloszenie' | 'petla' | 'zawieszenie' | 'ukonczono' };
  'player:levelup': { level: number };
  /** A queued update may open now (calm page, page turn or HUD tap); heroes/layer.ts opens the form. */
  'update:ready': undefined;
  /** The player is on page `index` (0-based) of `count`; emitted at run start and after every page turn. */
  'page:entered': { index: number; count: number };
  /** The player reached the exit; the sweep starts (render/pageturn). */
  'page:turn': { from: number; to: number };
  /** A regulamin clause did something visible (kind is a short id such as 'hours:bot'). */
  'law:trigger': { law: string; kind: string };
  /** A clause wants an answer from the player (a modal sheet). */
  'law:ask': { kind: 'cookies' | 'update' | 'code' };
  /** The player tapped the page at world x, y. */
  'player:tap': { x: number; y: number };
  /** A hero skill fired (slot 0..2); free = fired by the Pralka quirk without cooldown. */
  'skill:cast': { slot: 0 | 1 | 2; free: boolean };
  /** A summon ran out of time or was replaced; its drawing is rubbed out. */
  'summon:expired': { id: number };
  /** The appeal form was filed: the shadowban is lifted. */
  'player:unsuspended': undefined;
  /** A skill wants a sketch on the page (render/heroFx.ts draws it): from (x, y) to (x2, y2) or with radius r. */
  'skill:fx': { kind: 'swirl' | 'foam' | 'cone' | 'ring' | 'line' | 'blink' | 'dash'; x: number; y: number; x2: number; y2: number; r: number };
  /** A hit matched the enemy's claim: the bubble is struck through (enemies/claims in systems/combat.ts). */
  'enemy:rebutted': { id: number };
  /** First hit of another type than the claim on this enemy ("nie na temat"). */
  'enemy:offTopic': { id: number; x: number; y: number };
  /** A notification climbed to the next tier. */
  'enemy:escalated': { id: number; tier: number; x: number; y: number };
  /** A boss reached a new phase (Prototyp at half racja, Weryfikacja's grid solved, Hipoteza confirmed). */
  'boss:phase': { id: number; family: 'urzadzenia' | 'powiadomienia' | 'wygenerowane'; x: number; y: number };
  /** A boss fell (also reported through enemy:died). */
  'boss:died': { id: number; family: 'urzadzenia' | 'powiadomienia' | 'wygenerowane'; x: number; y: number };
  /** A service tunnel was cut at world x, y of page `pageIndex` (world/tunnel.ts); render/tunnelFx.ts draws the hole. */
  'tunnel:opened': { x: number; y: number; pageIndex: number };
  /** The player walked onto an armed hole: main.ts holds the run and goes to the base. */
  'tunnel:entered': undefined;
  /** The player came back from the base into the held run; the tunnel closes right after (`tunnel:closed {reason: 'return'}`). */
  'tunnel:returned': undefined;
  /** The tunnel is gone. 'return' and 'second' and 'death' are repaired with tape, 'end' and 'page' are only rubbed out. */
  'tunnel:closed': { reason: TunnelCloseReason };
  /** The player stands in the base page of a planet (world/base.ts): `layout` is one of lądowisko / wioska / miasteczko (ids ladowisko, wioska, miasteczko). */
  'base:entered': { layout: 'ladowisko' | 'wioska' | 'miasteczko' };
  /** The player tapped a station of the base and reached it: main.ts opens its sheet (biurko, kiosk, tablica, paczkomat). */
  'station:opened': { station: 'biurko' | 'kiosk' | 'tablica' | 'paczkomat' };
  /** "Akceptuję regulamin" (or "Wznów zgłoszenie") was pressed in the base: the exit of the base page is unlocked. */
  'ticket:accepted': undefined;
}

type Args<K extends keyof GameEvents> = GameEvents[K] extends undefined ? [] : [GameEvents[K]];
type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

export interface Bus {
  on<K extends keyof GameEvents>(name: K, fn: Handler<K>): () => void;
  emit<K extends keyof GameEvents>(name: K, ...payload: Args<K>): void;
}

export function createBus(): Bus {
  const handlers = new Map<keyof GameEvents, Set<Handler<keyof GameEvents>>>();
  return {
    on(name, fn) {
      const set = handlers.get(name) ?? new Set();
      set.add(fn as Handler<keyof GameEvents>);
      handlers.set(name, set);
      return () => {
        set.delete(fn as Handler<keyof GameEvents>);
      };
    },
    emit(name, ...payload) {
      const set = handlers.get(name);
      if (!set) return;
      for (const fn of [...set]) fn(payload[0] as GameEvents[keyof GameEvents]);
    },
  };
}
