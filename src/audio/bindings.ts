/**
 * The only place where game events meet sounds (DESIGN 14.5: no sound code inside game systems beyond emitting events).
 * Every handler is a no-op while the audio context is locked, so the game never depends on sound.
 */
import type { Bus, GameEvents } from '../core/events';
import type { Enemy } from '../entities';
import { heroById, HERO_IDS, type HeroId } from '../heroes/registry';
import type { RunState } from '../world/run';
import { getMix } from './context';
import { musicPhase, musicTurn, setMusicPaused, startMusic, stopMusic, tickMusic } from './music';
import { FAMILY_FLAVOUR, play, startHum, type Hum, type PlayOpts, type SfxName } from './sfx';

export interface AudioDeps {
  getState(): RunState | null;
  /** Hit-stop from the game loop (`loop.freeze`). */
  freeze(ms: number): void;
}

export interface AudioBindings {
  /** Once per rendered frame: the music scheduler, the boss hum, new loot cards. */
  frame(): void;
}

/** Racja below this share of the maximum adds the hiss bed to the tear. */
export const LOW_RACJA = 0.3;
export const HIT_STOP_MS = 40;

/** How much body a hit has against a generated beast: it only exists as much as it is confirmed (DESIGN 14.3). */
export function beastBody(existence: number | undefined): number {
  const e = Math.min(1, Math.max(0.3, existence ?? 1));
  return ((e - 0.3) / 0.7) ** 2 * 0.95 + 0.05;
}

/** Which law:trigger kinds make a sound, and which. */
export const LAW_SOUNDS: Record<string, SfxName> = {
  'hours:bot': 'botOn',
  'hours:consultant': 'consultantOn',
  'reverse:start': 'reverseStart',
  noise: 'crumple',
  'cookies:all': 'stamp',
  'cookies:minimal': 'stamp',
  'update:installed': 'stamp',
  'code:requested': 'footnote',
  'code:accepted': 'stamp',
};

/**
 * The sound of hero `id`'s ultimate `ultimateId` (`HeroModule.sounds.ultimate`): a hero with one recipe plays it for every
 * ultimate; a hero with a name per ultimate id plays that one, else its first (an id not yet given a recipe). Undefined: none.
 */
export function ultimateSound(id: HeroId, ultimateId: string): SfxName | undefined {
  const u = heroById(id).sounds.ultimate;
  if (typeof u !== 'object') return u;
  return u[ultimateId] ?? Object.values(u)[0];
}

/** After this many exceptions the sound is switched off for the session; the game never depends on it. */
const MAX_FAILURES = 20;

export function bindAudio(bus: Bus, deps: AudioDeps): AudioBindings {
  let failures = 0;
  const guard =
    <A extends unknown[]>(fn: (...a: A) => void) =>
    (...a: A): void => {
      if (failures >= MAX_FAILURES) return;
      try {
        fn(...a);
      } catch (e) {
        // A browser with a half-working Web Audio must not take the game with it: say it once, go on silent.
        if (failures++ === 0) console.warn(`audio: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
  const on = <K extends keyof GameEvents>(name: K, fn: (payload: GameEvents[K]) => void): void => {
    bus.on(name, guard(fn));
  };
  let hum: Hum | null = null;
  let seenId = 0;
  let invOpen = false;
  let fxRadius = 0;

  const enemyOf = (id: number): Enemy | undefined => deps.getState()?.enemies.find((e) => e.id === id);
  const duck = (): void => getMix()?.duck();

  /** The family's flavour laid over a hit, a crit or a kill. */
  const flavour = (family: Enemy['family'] | undefined, opts: PlayOpts = {}): void => {
    if (family) play(FAMILY_FLAVOUR[family], opts);
  };

  on('run:started', () => {
    hum?.stop(0.2);
    hum = null;
    const s = deps.getState();
    seenId = s ? s.nextId - 1 : 0;
    invOpen = false;
    startMusic(deps.getState);
  });
  on('run:ended', () => {
    hum?.stop(1);
    hum = null;
    stopMusic(1.5);
  });
  // The pause sheet: the line is put on hold (the music flag acts like bot hours) and the sheet is laid down or lifted.
  on('game:paused', (e) => {
    setMusicPaused(e.paused);
    play(e.paused ? 'inventoryOpen' : 'inventoryClose');
  });
  // the base page of a planet plays the planet's calm layer (the `base` music flag); the menus have none
  on('base:entered', () => {
    stopMusic(0.4);
    startMusic(deps.getState);
  });
  on('station:opened', () => play('inventoryOpen'));
  on('ticket:accepted', () => play('stamp'));
  on('screen:changed', (e) => {
    invOpen = false;
    if (e.screen !== 'run' && e.screen !== 'baza') {
      hum?.stop(0.5);
      hum = null;
      stopMusic(1);
      if (e.screen !== 'title') play('paperSlide');
    } else if (e.screen === 'baza') play('paperSlide');
  });

  // ---- combat ----
  // the Nalesnik's auto-attack is a flip with a slap (its hit sound follows when it lands)
  on('attack:started', (e) => {
    const hero = e.attacker === 'player' ? deps.getState()?.player.heroId : undefined;
    const slap = hero ? heroById(hero).sounds.autoStart : undefined;
    if (slap) play(slap);
  });
  on('enemy:hit', (e) => {
    const en = enemyOf(e.id);
    const lethal = en !== undefined && en.hp <= 0;
    if (e.crit) deps.freeze(HIT_STOP_MS);
    if (lethal) return; // the kill sound covers it
    const beast = en?.family === 'wygenerowane';
    const body = beast ? beastBody(en?.existence) : 1;
    const opts: PlayOpts = beast ? { scale: { body, sub: body, transient: 0.7 } } : {};
    play(e.crit ? 'crit' : 'hit', opts);
    flavour(en?.family, e.crit ? { gain: 1.1 } : {});
  });
  on('enemy:died', (e) => {
    deps.freeze(HIT_STOP_MS);
    duck();
    const beast = e.family === 'wygenerowane';
    play('kill', beast ? { scale: { body: 0.5, sub: 0.5 } } : {});
    flavour(e.family, { gain: 1.2 });
  });
  on('boss:died', () => {
    hum?.stop(1);
    hum = null;
    play('bossPhase', { gain: 1.1, rate: 0.85, when: 0.2 });
    duck();
  });
  on('boss:phase', () => {
    play('bossPhase');
    duck();
    musicPhase();
  });
  on('enemy:escalated', () => play('escalate'));
  on('enemy:rebutted', () => play('strikeThrough', { when: 0.08 }));
  // Spor (DESIGN 5.4): the comment is typed in like a footnote; a right reply is struck through (the stamp sound comes from the
  // 'stamp' event); a wrong one is a crumpled sheet, quietly (the racja it costs sounds through 'player:hit')
  on('spor:posted', () => play('footnote'));
  on('spor:answered', (e) => (e.right ? play('strikeThrough') : play('crumple', { gain: 0.5 })));
  on('player:died', () => {
    // no sting: the mechanism slows to a stop (the music reads the dead state), the boss hum runs down
    hum?.stop(2.5);
    hum = null;
    invOpen = false;
  });
  on('player:hit', (e) => {
    const p = deps.getState()?.player;
    const low = p !== undefined && p.hpMax > 0 && p.hp / p.hpMax < LOW_RACJA;
    play(low ? 'playerHurtLow' : 'playerHurt', e.crit ? { gain: 1.15 } : {});
  });
  on('skill:fx', (e) => {
    fxRadius = e.r;
  });
  on('skill:cast', (e) => {
    const s = deps.getState();
    const hero = s?.player.heroId;
    if (!hero) return;
    const gain = (e.free ? 0.85 : 1) * (1 + Math.min(0.2, fxRadius / 500));
    fxRadius = 0;
    const name = heroById(hero).sounds.skills[e.skill];
    if (name) play(name, { gain });
  });

  // the ultimate: the hero's own long recipe (body, then the stamp thud at the end); the page ducks under it like under a kill
  on('ultimate:cast', (e) => {
    if (!HERO_IDS.includes(e.heroId as HeroId)) return;
    const name = ultimateSound(e.heroId as HeroId, e.ultimateId);
    if (!name) return;
    play(name);
    duck();
  });

  // ---- paper, forms, the document ----
  on('stamp', (e) => {
    if (!e.quiet) play('stamp'); // an ultimate's stamp is heard in its own recipe
  });
  on('player:levelup', () => play('stamp'));
  on('player:unsuspended', () => play('stamp'));
  on('footnote:added', (e) => play(e.correction ? 'correction' : 'footnote'));
  on('pickup:taken', () => play('pickup'));
  on('recovery:taken', () => play('paperSlide'));
  on('content:opened', () => play('paperSlide')); // a teczka (world/content.ts); seals and events are heard in their stamp
  on('page:edge', () => play('pageEdge'));
  on('page:turn', (e) => {
    play('pageTurn');
    const s = deps.getState();
    if (s) musicTurn(s, e.to);
  });
  // the service tunnel: scissors through the sheet, then a strip of tape laid over the hole (nothing when the page or run goes away)
  on('tunnel:opened', () => play('crumple'));
  // the menus stopped the music on screen:changed; the way back through the tunnel starts it again
  on('tunnel:returned', () => {
    startMusic(deps.getState);
    const s = deps.getState();
    if (s) musicTurn(s, s.pageIndex); // the base's music goes on, now with the held page's roll
  });
  on('tunnel:closed', (e) => {
    if (e.reason === 'return' || e.reason === 'second' || e.reason === 'death') play('paperSlide');
  });
  on('update:ready', () => play('paperSlide'));
  on('law:ask', () => play('paperSlide'));
  on('law:trigger', (e) => {
    const name = LAW_SOUNDS[e.kind];
    if (name) play(name);
  });
  on('inventory', () => {
    const s = deps.getState();
    if (!s) return;
    // the sheet pauses the run while it is open; this handler runs after the sheet's own
    const open = s.status === 'paused' && !s.modal && !s.turning;
    if (open === invOpen) return;
    invOpen = open;
    play(open ? 'inventoryOpen' : 'inventoryClose');
  });

  return {
    frame: guard(() => {
      const s = deps.getState();
      if (s) {
        // loot cards sketched into the margin: pickups that appeared since the last frame
        let drawn = false;
        for (const k of s.pickups) {
          if (k.id <= seenId) continue;
          if (k.item || k.permission) drawn = true;
        }
        seenId = Math.max(seenId, s.nextId - 1);
        if (drawn) play('cardDrawn');
        // the tape-motor hum under the whole boss fight
        const boss = s.status !== 'dead' && s.enemies.some((e) => e.boss);
        if (boss && !hum) hum = startHum();
        else if (!boss && hum) {
          hum.stop(1.2);
          hum = null;
        }
      }
      tickMusic();
    }),
  };
}
