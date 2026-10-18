import './style.css';
import { createAudio, setVolumes, unlockAudio } from './audio';
import { setOfficeOpen } from './economy/hours';
import { createBus, type Screen } from './core/events';
import { createLoop } from './core/loop';
import { createGame } from './game';
import { createInput } from './input';
import { bindAsystent } from './narration';
import { bindFx } from './render/bindings';
import { bindTunnelFx } from './render/tunnelFx';
import { createCamera } from './render/camera';
import { initInk } from './render/ink';
import { installPaper } from './render/paper';
import { createWobble, getStage, setTheme } from './render/stage';
import { tickTweens } from './render/tween';
import { bindAutosave, settleRun, withBookmark, withCharacter } from './save/autosave';
import { emptyCharacter } from './save/character';
import { markRewritten } from './save/history';
import { loadMeta, saveMeta, type Settings } from './save/save';
import { installTestHook } from './testHook';
import { createBaza } from './ui/baza';
import { createFootnotes } from './ui/footnotes';
import { createHud } from './ui/hud';
import { createJoystick } from './ui/joystick';
import { applySteering, currentOrient, effectiveSteering, initLayout, lockOrientation, orientationSetting } from './ui/layout';
import { bindLawSheets } from './ui/lawSheets';
import { createPads } from './ui/pads';
import { createPauseSheet } from './ui/pause';
import { mountProfile } from './ui/profile';
import { createSettings } from './ui/settings';
import { mountSklep, type SklepHandle } from './ui/sklep';
import { createTicket } from './ui/ticket';
import { createTitle } from './ui/title';
import { bindLaws, lawHooks } from './world/laws';
import { PAGE_H, PAGE_W } from './world/pages';
import { bindPageTurn, bindRunEvents } from './world/pageTurn';
import type { RunOptions, RunState } from './world/run';
import { bindTunnel, carryPurse, closeFor, closeTunnel, createRunHold, fateOfHeldRun, openTunnel, type LeaveAction } from './world/tunnel';
import { TICKET_BASE, ticketForSeed, type TicketInfo } from './world/ticket';

const stage = getStage();
installPaper();
initInk(stage.fx);

const bus = createBus();
const camera = createCamera(stage.svg, stage.wobble, { w: PAGE_W, h: PAGE_H });
camera.resize();
const wobble = createWobble(stage);
let meta = loadMeta();
let screen: Screen = 'title';
/** The run that waits while the player is in the base through the service tunnel (DESIGN 4.1): the same object, in memory only. */
const hold = createRunHold<RunState>();
/** The next `go('run')` is the return through the tunnel: it does not start a run. */
let returning = false;

/** Day / night / by device, the left-handed mirror, steering and the orientation lock. */
let lockedFor: string | null = null;
function applySettings(s: Settings): void {
  setTheme(s.theme);
  stage.ui.classList.toggle('lefty', s.leftHanded);
  setVolumes(s.musicVolume, s.sfxVolume);
  const steering = effectiveSteering(s, currentOrient());
  applySteering(steering);
  input.setMode(steering);
  input.setLeftHanded(s.leftHanded);
  const wanted = orientationSetting(s);
  if (wanted !== lockedFor) {
    lockedFor = wanted;
    void lockOrientation(wanted); // a no-op where the platform has no lock (iOS, a desktop tab)
  }
}

const save = (next: typeof meta): void => {
  meta = next;
  saveMeta(meta);
};

// Router: title -> profile -> baza <-> settings / Sklep, baza -> ticket -> run -> baza
const input = createInput(stage.svg, (x, y, walk) => game.onTap(x, y, walk), createJoystick(stage.ui));
initLayout(() => applySettings(meta.settings)); // data-orient on <html> follows the window; steering follows it until the player chooses
applySettings(meta.settings);
const game = createGame(stage, bus, camera, input);
const hud = createHud(stage.ui, () => game.hero.requestUpdate(), () => pauseRun(), () => openTunnelNow());
const footnotes = createFootnotes(stage.ui);
const pads = createPads(stage.ui, bus);
const title = createTitle(stage.ui, () => go(meta.heroId ? 'baza' : 'profile'));
let shop: SklepHandle | null = null;
const baza = createBaza(stage.ui, {
  onNewTicket: () => go('ticket'),
  onSettings: () => go('settings'),
  onChangeHero: () => {
    leave('changeHero'); // another hero cannot walk back into this run
    go('profile');
  },
  onReturn: () => returnFromTunnel(),
  onRewritten: (indices) => save(markRewritten(meta, indices)),
  onResume: () => resumeTicket(),
  onShop: () => {
    // The base Sklep spends the gwiazdki and fills the bag and gear that the next run starts with (the character record).
    shop?.unmount();
    const character = meta.character ?? emptyCharacter(meta.heroId);
    const purse = { gwiazdki: character.gwiazdki, inventory: [...character.inventory], equipment: { ...character.equipment }, level: 1 };
    shop = mountSklep(stage.ui, { runsCompleted: meta.runsCompleted }, purse, {
      onClose: () => {
        shop = null;
        save({ ...meta, character: { ...character, gwiazdki: purse.gwiazdki, inventory: purse.inventory, equipment: purse.equipment } });
        if (screen === 'baza') baza.show(meta);
      },
    });
  },
});
const onSettingsChange = (next: Settings): void => {
  save({ ...meta, settings: next });
  applySettings(next);
};
const onVolumeSet = (which: 'music' | 'sfx'): void => {
  if (which === 'sfx') audio.preview();
};
const settings = createSettings(stage.ui, onSettingsChange, () => go('baza'), onVolumeSet);
// The same form, opened in place from the pause sheet: Wróć returns to the sheet, not to the base.
const pauseSettings = createSettings(stage.ui, onSettingsChange, () => closePauseSettings(), onVolumeSet);
const pauseSheet = createPauseSheet(stage.ui, { onResume: () => resumeRun(), onSettings: () => openPauseSettings(), onEnd: () => endTicket() });
let pendingTicket: { seed: number; info: TicketInfo } | null = null;
const ticket = createTicket(stage.ui, () => {
  unlockAudio(); // the accept button is the natural unlock (DESIGN 14.5); any first tap also unlocks
  if (pendingTicket) go('run', pendingTicket.seed);
});

const freshSeed = (): number => (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;

function go(next: Screen, seed: number = freshSeed(), opts: RunOptions = {}): void {
  syncHistory(screen, next);
  screen = next;
  const running = next === 'run';
  hud.el.classList.toggle('hidden', !running);
  footnotes.el.classList.toggle('hidden', !running);
  pads.classList.toggle('hidden', !running);
  if (next !== 'run') footnotes.closeHistory();
  if (next !== 'title') title.hide();
  if (next !== 'baza') baza.hide();
  if (next !== 'ticket') ticket.hide();
  if (next !== 'settings') settings.hide();
  if (next !== 'run') clearPause();
  if (next !== 'run') input.setEnabled(false);
  switch (next) {
    case 'title':
      title.show(meta.runsCompleted);
      break;
    case 'profile':
      // The profile screen saves the hero itself and then calls back.
      mountProfile(stage.ui, () => {
        meta = loadMeta();
        go('baza');
      });
      break;
    case 'baza':
      baza.show(meta);
      break;
    case 'ticket': {
      const s = freshSeed();
      const info = ticketForSeed(s, TICKET_BASE + meta.history.length);
      pendingTicket = { seed: s, info };
      ticket.show(info);
      break;
    }
    case 'settings':
      settings.show(meta.settings);
      break;
    case 'run': {
      if (returning) {
        // Back through the tunnel: the held run continues, nothing is started, the footnotes and the page stay as they were.
        returning = false;
        hud.invalidate();
        break;
      }
      leave(opts.resume ? 'resumeBookmark' : 'newTicket'); // a run held in the tunnel is given up before another starts
      footnotes.reset();
      setOfficeOpen(null);
      // A resumed ticket keeps its number; the saved character (gear, purse, level, updates) is applied before the stats.
      game.start(seed, { ...(opts.resume ? {} : { ticketNumber: TICKET_BASE + meta.history.length }), heroId: meta.heroId, character: meta.character, ...opts });
      hud.invalidate();
      break;
    }
    case 'death':
      break;
  }
  bus.emit('screen:changed', { screen: next });
}

bindFx(bus, game.views);
bindPageTurn(bus, { stage, camera, views: game.views, getState: () => game.state });
bindRunEvents(bus, () => game.state);
// The tunnel closes itself on death, the end of the run and a page turn; both must hear `run:ended` before the handler below drops the state.
bindTunnel(bus, () => game.state);
bindTunnelFx(bus, { page: stage.page, pageWidth: () => game.state?.page.w ?? PAGE_W });
bus.on('tunnel:entered', () => void holdRun());
bindLaws(bus, () => game.state);
bindLawSheets(stage.ui, bus, () => game.state);
/** Print a footnote and tell the bus (the typewriter key and the carriage return are heard from `footnote:added`). */
const printNote = (text: string, correction = false): number => {
  const n = footnotes.add(text);
  bus.emit('footnote:added', { n, text, correction });
  return n;
};
const asystent = bindAsystent(bus, { say: printNote, getState: () => game.state });
bus.on('footnote', (e) => printNote(e.text));
// Sound: the bindings are the only place where events meet sounds (src/audio/bindings.ts).
const audio = createAudio(bus, { getState: () => game.state, freeze: (ms) => loop.freeze(ms) });
// The kiosk's office hours are decided by the clause (economy/hours.ts keeps the decision).
lawHooks.officeReset = () => setOfficeOpen(null);

/** The ticket is closed (won, or lost for good): file it in the Historia, keep the character as it ended, tear up the bookmark, back to the base. */
bus.on('run:ended', (e) => {
  const s = game.state;
  if (!s || screen !== 'run') return;
  save(settleRun(meta, s, e.outcome)); // Historia entry, the character as it ended, the bookmark torn up
  game.stop();
  go('baza');
});

const loop = createLoop({
  update: (dt) => {
    game.update(dt);
    const s = game.state;
    if (screen === 'run' && s && s.status === 'running' && !s.modal && !s.turning) asystent.tick(dt);
  },
  render: (dt) => {
    tickTweens(dt * 1000);
    wobble.tick(dt * 1000);
    game.render(dt);
    audio.frame();
    if (screen === 'run' && game.state) hud.update(game.state);
  },
});

// ---------- pause, Zakończ, resume (DESIGN 4.1) ----------
/** The character and the bookmark are written at every page turn, on pause, on Zakończ and when the app is hidden. */
const autosave = bindAutosave({ bus, getState: () => game.state, getMeta: () => meta, commit: save, inRun: () => screen === 'run' });

/** Hold the run and put the pause sheet on the page. False when a form or the pause sheet already holds it. */
function pauseRun(): boolean {
  const s = game.state;
  if (screen !== 'run' || !s || !game.pause()) return false;
  loop.pause();
  pauseSheet.open({ number: s.ticket.number, planet: s.ticket.planet, page: s.pageIndex + 1, total: s.pageCount });
  return true;
}

/** Wznów: the same state object continues exactly where it stopped. */
function resumeRun(): void {
  clearPause();
  game.resume();
}

function openPauseSettings(): void {
  pauseSheet.setHidden(true);
  pauseSettings.show(meta.settings);
}

function closePauseSettings(): void {
  pauseSettings.hide();
  pauseSheet.setHidden(false);
}

/** Take the pause sheet and its settings off the page and let the loop run (used by resume, Zakończ and every screen change). */
function clearPause(): void {
  pauseSettings.hide();
  pauseSheet.close();
  if (!hold.held) loop.resume(); // a run held in the tunnel stays held while the player moves between base screens
}

/** Zakończ zgłoszenie: the character and a bookmark are saved, the run is dropped, back to the base. */
function endTicket(): void {
  if (screen !== 'run' || !game.state) return;
  autosave.save();
  closeTunnel(game.state, bus, closeFor('abandon'));
  game.stop();
  go('baza');
}

/** Wznów zgłoszenie: the pages are regenerated from the bookmarked seed, the player stands on the bookmarked page. */
function resumeTicket(): boolean {
  const b = meta.bookmark;
  if (!b || screen === 'run') return false;
  go('run', b.seed, { resume: b });
  return true;
}

// ---------- the service tunnel (DESIGN 4.1) ----------
/** Tunel on the HUD: cut a hole at the player's feet (a second one closes the first). Free, no confirmation. */
function openTunnelNow(): boolean {
  const s = game.state;
  return screen === 'run' && s !== null && openTunnel(s, bus);
}

/**
 * The player walked onto the hole. The run is held: the very same RunState object stays in memory (enemies, racja,
 * floor loot, statuses, clock), the pause path stops the loop and the input and writes the character and the bookmark
 * (`game:paused`, so the save happens on every tunnel use), and the router goes to the base with the return line.
 */
function holdRun(): boolean {
  const s = game.state;
  if (screen !== 'run' || !s?.tunnel || hold.held || !game.pause()) return false;
  hold.hold(s);
  baza.setTunnel({ number: s.ticket.number, page: s.tunnel.pageIndex + 1 });
  go('baza');
  loop.pause(); // go() leaves the loop alone while a run is held, this keeps its timers still too
  return true;
}

/** "Wróć do zgłoszenia": the held run continues exactly as it was; the tunnel closes behind the player (a strip of tape). */
function returnFromTunnel(): boolean {
  const s = hold.peek();
  if (screen !== 'baza' || !s || game.state !== s || fateOfHeldRun(true, 'return') !== 'continue') return false;
  hold.take();
  carryPurse(s, meta.character); // what the base shop did to the purse goes along
  baza.setTunnel(null);
  returning = true;
  go('run');
  loop.resume();
  game.resume();
  bus.emit('tunnel:returned');
  closeTunnel(s, bus, closeFor('return'));
  autosave.save(); // the tunnel use is saved on the way back too
  return true;
}

/**
 * What becomes of a held run when the player does something else in the base. The decision is `fateOfHeldRun` (tested):
 * 'settle' means the run is given up the way Zakończ gives it up. The character (with the base shop's changes) and the
 * bookmark are written, so the desk offers "Wznów zgłoszenie nr ..." (the pages are regenerated from the seed), and the
 * held state is dropped. Starting a new ticket, resuming the bookmark or changing the hero settle; settings only look.
 */
function leave(action: LeaveAction): void {
  if (fateOfHeldRun(hold.held, action) !== 'settle') return;
  const s = hold.take();
  if (!s) return;
  carryPurse(s, meta.character);
  save(withBookmark(withCharacter(meta, s), s));
  closeTunnel(s, bus, closeFor('abandon'));
  baza.setTunnel(null);
  loop.resume();
  if (game.state === s) game.stop();
}

// ---------- the back button (Android) ----------
/**
 * The run screen and the screens that hang off the base (ticket, profile, settings) are one history entry above the base;
 * the base and the title are the root. Opening one of them pushes an entry, leaving it by a button takes it back, so the
 * system back button walks baza <- ticket / profile / settings. During a run the button never leaves: it opens the pause
 * sheet, and while the run is paused it resumes (the entry the press consumed is pushed again). At the root it leaves.
 */
const HISTORY_LEVEL: Record<Screen, 0 | 1> = { title: 0, baza: 0, death: 0, profile: 1, ticket: 1, settings: 1, run: 1 };
let pushed = 0;
let backsWeAsked = 0;
let poppedByUser = false;
function pushEntry(replace: boolean, tag: Screen): void {
  try {
    if (replace) history.replaceState({ screen: tag }, '');
    else {
      history.pushState({ screen: tag }, '');
      pushed++;
    }
  } catch {
    /* a sandboxed frame: the back button then behaves as the browser's own */
  }
}
function syncHistory(from: Screen, to: Screen): void {
  const a = HISTORY_LEVEL[from];
  const b = HISTORY_LEVEL[to];
  if (b > a) pushEntry(false, to);
  else if (b === a && b === 1) pushEntry(true, to);
  else if (b < a && !poppedByUser && pushed > 0) {
    pushed--;
    backsWeAsked++;
    history.back();
  }
}
window.addEventListener('popstate', () => {
  if (backsWeAsked > 0) {
    backsWeAsked--; // the echo of our own history.back()
    return;
  }
  if (pushed > 0) pushed--;
  if (screen === 'run') {
    pushEntry(false, 'run');
    if (pauseSheet.isOpen()) resumeRun();
    else pauseRun();
    return;
  }
  if (HISTORY_LEVEL[screen] === 1) {
    poppedByUser = true;
    go(screen === 'profile' && !meta.heroId ? 'title' : 'baza');
    poppedByUser = false;
  }
});

// The app goes to the background (tab switch, lock screen, home button): hold the run, so the player returns to the sheet.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseRun();
});

window.addEventListener('resize', () => {
  camera.resize();
  hud.invalidate();
});

installTestHook({
  game,
  bus,
  input,
  getScreen: () => screen,
  go,
  getMeta: () => meta,
  setMeta: (m) => (meta = m),
  pause: pauseRun,
  resume: resumeRun,
  openTunnel: openTunnelNow,
  returnFromTunnel,
  endTicket,
  resumeTicket,
  changeSettings: (patch) => {
    const next = { ...meta.settings, ...patch };
    save({ ...meta, settings: next });
    applySettings(next);
  },
});
go('title');
loop.start();
