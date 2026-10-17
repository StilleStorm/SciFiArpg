import './style.css';
import { setOfficeOpen } from './economy/hours';
import { createBus, type Screen } from './core/events';
import { createLoop } from './core/loop';
import { createGame } from './game';
import { createInput } from './input';
import { bindAsystent } from './narration';
import { bindFx } from './render/bindings';
import { createCamera } from './render/camera';
import { initInk } from './render/ink';
import { installPaper } from './render/paper';
import { createWobble, getStage, setTheme } from './render/stage';
import { tickTweens } from './render/tween';
import { markRewritten, recordRun } from './save/history';
import { loadMeta, saveMeta, type Settings } from './save/save';
import { giveStash, takeStash } from './save/stash';
import { installTestHook } from './testHook';
import { createBaza } from './ui/baza';
import { createFootnotes } from './ui/footnotes';
import { createHud } from './ui/hud';
import { bindLawSheets } from './ui/lawSheets';
import { createPads } from './ui/pads';
import { mountProfile } from './ui/profile';
import { createSettings } from './ui/settings';
import { mountSklep, type SklepHandle } from './ui/sklep';
import { createTicket } from './ui/ticket';
import { createTitle } from './ui/title';
import { bindLaws, lawHooks } from './world/laws';
import { PAGE_H, PAGE_W } from './world/pages';
import { bindPageTurn, bindRunEvents } from './world/pageTurn';
import type { RunOptions } from './world/run';
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

/** Day / night / by device, and the left-handed mirror of the pads. */
function applySettings(s: Settings): void {
  setTheme(s.theme);
  stage.ui.classList.toggle('lefty', s.leftHanded);
}
applySettings(meta.settings);

const save = (next: typeof meta): void => {
  meta = next;
  saveMeta(meta);
};

// Router: title -> profile -> baza <-> settings / Sklep, baza -> ticket -> run -> baza
const input = createInput(stage.svg, (x, y) => game.onTap(x, y));
const game = createGame(stage, bus, camera, input);
const hud = createHud(stage.ui);
const footnotes = createFootnotes(stage.ui);
const pads = createPads(stage.ui, bus);
const title = createTitle(stage.ui, () => go(meta.heroId ? 'baza' : 'profile'));
let shop: SklepHandle | null = null;
const baza = createBaza(stage.ui, {
  onNewTicket: () => go('ticket'),
  onSettings: () => go('settings'),
  onChangeHero: () => go('profile'),
  onRewritten: (indices) => save(markRewritten(meta, indices)),
  onShop: () => {
    // The base Sklep spends the gwiazdki and fills the stash that the next run starts with.
    shop?.unmount();
    const stash = meta.stash ?? { inventory: [], equipment: {} };
    const purse = { gwiazdki: meta.gwiazdki, inventory: stash.inventory, equipment: stash.equipment, level: 1 };
    shop = mountSklep(stage.ui, { runsCompleted: meta.runsCompleted }, purse, {
      onClose: () => {
        shop = null;
        save({ ...meta, gwiazdki: purse.gwiazdki, stash: { inventory: purse.inventory, equipment: purse.equipment } });
        if (screen === 'baza') baza.show(meta);
      },
    });
  },
});
const settings = createSettings(
  stage.ui,
  (next) => {
    save({ ...meta, settings: next });
    applySettings(next);
  },
  () => go('baza'),
);
let pendingTicket: { seed: number; info: TicketInfo } | null = null;
const ticket = createTicket(stage.ui, () => {
  if (pendingTicket) go('run', pendingTicket.seed);
});

const freshSeed = (): number => (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;

function go(next: Screen, seed: number = freshSeed(), opts: RunOptions = {}): void {
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
      footnotes.reset();
      setOfficeOpen(null);
      const state = game.start(seed, { ticketNumber: TICKET_BASE + meta.history.length, heroId: meta.heroId, ...opts });
      if (meta.stash) state.nextItemNumber = giveStash(state.player, meta.stash);
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
bindLaws(bus, () => game.state);
bindLawSheets(stage.ui, bus, () => game.state);
const asystent = bindAsystent(bus, { say: (text) => footnotes.add(text), getState: () => game.state });
bus.on('footnote', (e) => footnotes.add(e.text));
// The kiosk's office hours are decided by the clause (economy/hours.ts keeps the decision).
lawHooks.officeReset = () => setOfficeOpen(null);

/** The ticket is closed (won, or lost for good): file it in the Historia, bank the gwiazdki and the items, back to the base. */
bus.on('run:ended', (e) => {
  const s = game.state;
  if (!s || screen !== 'run') return;
  save({
    ...recordRun(meta, {
      number: s.ticket.number,
      planet: s.ticket.planet,
      clause: s.ticket.lawId,
      outcome: e.outcome,
      kills: s.kills,
      pages: s.pageIndex + 1,
      total: s.pageCount,
      gwiazdki: s.player.gwiazdki,
    }),
    stash: takeStash(s.player),
  });
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
    if (screen === 'run' && game.state) hud.update(game.state);
  },
});

window.addEventListener('resize', () => {
  camera.resize();
  hud.invalidate();
});

installTestHook({ game, bus, getScreen: () => screen, go, getMeta: () => meta, setMeta: (m) => (meta = m) });
go('title');
loop.start();
