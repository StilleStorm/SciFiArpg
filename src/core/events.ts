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
  'attack:started': {
    attackerId: number;
    attacker: 'player' | 'enemy' | 'summon';
    x: number;
    y: number;
    tx: number;
    ty: number;
    ranged: boolean;
    /** The Kartograf's hitscan shot (heroes/auto.ts): a ruled line from the instrument (sx, sy) to (ex, ey), already resolved. */
    laser?: { sx: number; sy: number; ex: number; ey: number; crit: boolean; metres: number; scale?: boolean };
  };
  'enemy:died': { id: number; x: number; y: number; tier?: 'common' | 'elite' | 'boss'; family?: 'urzadzenia' | 'powiadomienia' | 'wygenerowane' };
  'pickup:taken': { id: number; number: number };
  'page:edge': { x: number; y: number; side: Side };
  /** `correction`: the Asystent corrects an earlier note (printed with the carriage-return sound, like the corrections of wrong notes); the finale's phase 1 uses it. */
  footnote: { text: string; correction?: boolean };
  /** A footnote was printed with number `n`; `correction` = the Asystent's later correction of a wrong note (audio: typewriter key / carriage return). */
  'footnote:added': { n: number; text: string; correction: boolean };
  /**
   * A stamp on the page. `quiet`: another sound carries it (an ultimate's recipe ends in its own thud), audio does not play the stamp.
   * `away`: a point the stamp must not cover (the hero who cast it); render keeps every stamp inside the view.
   */
  stamp: { text: string; x: number; y: number; quiet?: boolean; away?: { x: number; y: number } };
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
  /** A hero skill fired: `slot` is the pad (0..2), `skill` the hero's skill index (0..4, DESIGN 10.1); free = fired by the Pralka quirk without cooldown. */
  'skill:cast': { slot: 0 | 1 | 2; skill: 0 | 1 | 2 | 3 | 4; free: boolean; aim?: { kind: 'auto' | 'kierunek' | 'wskazanie'; dx: number; dy: number; x: number; y: number } };
  /** An ultimate was cast (combat/meter.ts castUltimate): the hero, the ultimate's id and where it was cast; audio/bindings.ts plays the hero's ultimate recipe. */
  'ultimate:cast': { heroId: string; ultimateId: string; x: number; y: number };
  /** A pad is held and dragged (DESIGN 5.6): the aim as it would fire now (direction and point both filled); pads.ts emits it on every change. */
  'skill:aim': { slot: 0 | 1 | 2; mode: 'auto' | 'kierunek' | 'wskazanie'; x: number; y: number; dx: number; dy: number };
  /** A summon ran out of time or was replaced; its drawing is rubbed out. */
  'summon:expired': { id: number };
  /** The appeal form was filed: the shadowban is lifted. */
  'player:unsuspended': undefined;
  /** A skill wants a sketch on the page (render/heroFx.ts draws it): from (x, y) to (x2, y2) or with radius r. */
  'skill:fx': { kind: 'swirl' | 'foam' | 'cone' | 'ring' | 'line' | 'blink' | 'dash' | 'drum' | 'wet' | 'section' | 'cut' | 'tide' | 'capsule'; x: number; y: number; x2: number; y2: number; r: number };
  /** A hit matched the enemy's claim: the bubble is struck through (enemies/claims in systems/combat.ts). */
  'enemy:rebutted': { id: number };
  /** First hit of another type than the claim on this enemy ("nie na temat"). */
  'enemy:offTopic': { id: number; x: number; y: number };
  /** The Asystent recorded a named elite (enemies/named.ts) when the player first met it. */
  'elite:named': { id: number; x: number; y: number; name: string };
  /** A named elite fell: the kill guarantees an item of at least `minTier` (systems/loot.ts claims it with claimNamedDrop). */
  'elite:slain': { id: number; x: number; y: number; name: string; minTier: 'nietypowy' };
  /** A notification climbed to the next tier. */
  'enemy:escalated': { id: number; tier: number; x: number; y: number };
  /** A boss reached a new phase (Prototyp at half racja, Weryfikacja's grid solved, Hipoteza confirmed). */
  'boss:phase': { id: number; family: 'urzadzenia' | 'powiadomienia' | 'wygenerowane'; x: number; y: number };
  /** A boss fell (also reported through enemy:died). */
  'boss:died': { id: number; family: 'urzadzenia' | 'powiadomienia' | 'wygenerowane'; x: number; y: number };
  /** A boss posted a comment (DESIGN 5.4, combat/spor.ts): `commentKey` and the three reply keys (the types are in `RunState.spor.prompt`). */
  'spor:posted': { id: number; phase: 1 | 2; commentKey: string; replies: string[]; params?: Record<string, string | number> };
  /** The player picked reply `index` of the prompt; `right` = it matched the comment. */
  'spor:answered': { id: number; index: number; right: boolean };
  /** The prompt is gone: answered (right or wrong), run out of time (also when a later phase replaced it), or the boss fell. */
  'spor:closed': { id: number; reason: 'answered' | 'expired' | 'died' };
  /** A service tunnel was cut at world x, y of page `pageIndex` (world/tunnel.ts); render/tunnelFx.ts draws the hole. */
  'tunnel:opened': { x: number; y: number; pageIndex: number };
  /** The player walked onto an armed hole: main.ts holds the run and goes to the base. */
  'tunnel:entered': undefined;
  /** The player came back from the base into the held run; the tunnel closes right after (`tunnel:closed {reason: 'return'}`). */
  'tunnel:returned': undefined;
  /** The tunnel is gone. 'return' and 'second' and 'death' are repaired with tape, 'end' and 'page' are only rubbed out. */
  'tunnel:closed': { reason: TunnelCloseReason };
  /**
   * The player stands in the base page of a planet (world/base.ts): `layout` is one of lądowisko / wioska / miasteczko (ids
   * ladowisko, wioska, miasteczko); `seed` and `number` name the ticket (the Asystent keeps one narrator per ticket).
   */
  'base:entered': { layout: 'ladowisko' | 'wioska' | 'miasteczko'; seed: number; number: number };
  /** The player tapped a station of the base and reached it: main.ts opens its sheet (biurko, kiosk, tablica, paczkomat). */
  'station:opened': { station: 'biurko' | 'kiosk' | 'tablica' | 'paczkomat' | 'urzednik' };
  /** A side ticket changed (world/quests.ts): taken from the board, counted, ready to report, paid out or given back. */
  'quest:changed': { id: string; what: 'accepted' | 'progress' | 'ready' | 'done' | 'dropped' };
  /** A potwierdzenie slip was taken (systems/recovery.ts): `healed` racja restored at once (0 when kept), `held` slips now in the stack. */
  'recovery:taken': { healed: number; held: number };
  /** A held potwierdzenie was used, by the player's tap or automatically before a hit (`auto`). */
  'recovery:used': { auto: boolean; healed: number; held: number };
  /** The plan on the desk was (re)accepted (the ticket form's button, a change of priority, travel). The base exit is always open. */
  'ticket:accepted': undefined;
  /** The player walked into the always-open exit of the base, just before `page:turn` (main.ts settles a run held in the tunnel). */
  'base:exit': undefined;
  /** A campaign planet was closed (world/campaign.ts settleCampaign): `to` is the next planet (0-based); `finale` = planet 9 was closed and the return ticket to planet 1 is next. */
  'campaign:advanced': { from: number; to: number; finale: boolean };
  /** The final ticket was closed: the case is closed, extras and free travel are open. */
  'case:closed': undefined;
  /** A teczka was opened (world/content.ts): its loot lies on the paper at x, y; audio plays a paper sound. */
  'content:opened': { kind: 'teczka'; id: number; x: number; y: number };
  /** A seal stamped a buff on the player (world/content.ts); x, y is the seal's place. */
  'content:sealed': { seal: string; x: number; y: number };
  /** A page event started, was won or failed (world/content.ts): `event` is formularz, przesylka or audyt. */
  'content:event': { event: string; id: number; phase: 'active' | 'done' | 'failed'; x: number; y: number };
  /** Page content `id` changed state: its drawing is made again (render/obstacles.ts redrawContent). */
  'content:changed': { id: number };
}

type Args<K extends keyof GameEvents> = GameEvents[K] extends undefined ? [] : [GameEvents[K]];
type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

export interface Bus {
  on<K extends keyof GameEvents>(name: K, fn: Handler<K>): () => void;
  emit<K extends keyof GameEvents>(name: K, ...payload: Args<K>): void;
  /** The last `n` events (default 10) as name + short payload text, oldest first; for the bug report. */
  recent?(n?: number): { name: string; payload: string }[];
}

/** Events too frequent to be worth a place in the bug report's short list. */
const QUIET_EVENTS: ReadonlySet<string> = new Set(['skill:aim', 'player:tap', 'enemy:miss', 'attack:started']);
const RECENT_KEEP = 40;

export function createBus(): Bus {
  const ring: { name: string; payload: string }[] = [];
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
    recent(n = 10) {
      return ring.slice(-n);
    },
    emit(name, ...payload) {
      if (!QUIET_EVENTS.has(name)) {
        let text = '';
        try {
          text = payload[0] === undefined ? '' : JSON.stringify(payload[0]).slice(0, 160);
        } catch {
          text = '?';
        }
        ring.push({ name, payload: text });
        if (ring.length > RECENT_KEEP) ring.shift();
      }
      const set = handlers.get(name);
      if (!set) return;
      for (const fn of [...set]) fn(payload[0] as GameEvents[keyof GameEvents]);
    },
  };
}
