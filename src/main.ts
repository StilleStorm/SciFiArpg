import './style.css';
import { createAudio, setVolumes, unlockAudio } from './audio';
import { setOfficeOpen } from './economy/hours';
import { createBus, type Screen } from './core/events';
import { createLoop } from './core/loop';
import { createGame } from './game';
import { t } from './i18n';
import { createInput } from './input';
import { bindAsystent } from './narration';
import { bindFx } from './render/bindings';
import { initDamageNumbers } from './render/damageNumbers';
import { bindTunnelFx } from './render/tunnelFx';
import { createCamera, freeViewRect, keepOutBlocks } from './render/camera';
import { initInk } from './render/ink';
import { installPaper } from './render/paper';
import { createWobble, getStage, setTheme } from './render/stage';
import { tickTweens } from './render/tween';
import { bindAutosave, savable, settleRun, withBookmark, withCharacter, withoutBookmark } from './save/autosave';
import { markRewritten } from './save/history';
import { bugDump, copyText, deviceInfo, requestPersistence } from './save/export';
import { loadMeta, saveMeta, type Settings } from './save/save';
import { installTestHook } from './testHook';
import './world/planets'; // planet modules register clerks, tickets, locations and boss variants
import { createBaza } from './ui/baza';
import { createBoard, type BoardQuests } from './ui/board';
import { createFootnotes } from './ui/footnotes';
import { createHud } from './ui/hud';
import { watchLayout } from './ui/keepOut';
import { useHeld } from './systems/recovery';
import { createJoystick } from './ui/joystick';
import { applySteering, currentOrient, effectiveSteering, initLayout, lockOrientation, orientationSetting } from './ui/layout';
import { bindLawSheets } from './ui/lawSheets';
import { openLoadout, type LoadoutSheet } from './ui/loadout';
import { addKartaDeskLine, kartaInputFromRun, openKarta, type KartaSheet } from './ui/karta';
import { addOsobowaDeskLine, openKartaOsobowa, osobowaInputFromRun, type OsobowaSheet } from './ui/karta-osobowa';
import { openNpcSheet, type NpcSheet } from './ui/npcSheet';
import { addDeskLine, openKonfiguracja, type KonfiguracjaSheet } from './ui/konfiguracja';
import { createPads } from './ui/pads';
import { createSpor } from './ui/spor';
import { createPauseSheet } from './ui/pause';
import { mountProfile, unmountProfile } from './ui/profile';
import { addArchiveDeskLine, openArchive, type ArchiveSheet } from './ui/archive';
import { mountRoster, type Roster } from './ui/roster';
import { rosterStore } from './ui/rosterStore';
import { createSettings } from './ui/settings';
import { guardGhostClicks } from './ui/sheet';
import { openPaczkomat, type PaczkomatSheet } from './ui/paczkomat';
import { mountSklep, type SklepHandle } from './ui/sklep';
import { priceCut as heroPriceCut } from './heroes/quirks';
import { openCard, type CardHandle } from './ui/cards';
import { createTicket } from './ui/ticket';
import { campaignViewOf, cardToShow, markShown, type CampaignView } from './ui/ticketModel';
import { bindCampaign, clampPriority, cloneCampaign, defaultPlan, DEFAULT_PRIORITY, extraPlan, newCampaign, noCardsSeen, toCampaign, travelPlan, type CampaignState, type PriorityId, type TicketPlan } from './world/campaign';
import { createTitle } from './ui/title';
import { acceptTicket } from './world/base';
import { npcAt } from './world/npc';
import { bindContent } from './world/content';
import { bindQuests, cloneQuests, completeQuest, dropQuest, questPlanet, questsOf, takeQuest, visitClerk, questById } from './world/quests';
import { bindLaws, lawHooks } from './world/laws';
import { PAGE_H, PAGE_W } from './world/pages';
import { bindPageTurn, bindRunEvents } from './world/pageTurn';
import { bindGates } from './world/gate';
import type { RunOptions, RunState } from './world/run';
import { bindTunnel, carryPurse, closeFor, closeTunnel, createRunHold, cutBaseHole, fateOfHeldRun, openTunnel, type LeaveAction } from './world/tunnel';
import { TICKET_BASE } from './world/ticket';

const stage = getStage();
guardGhostClicks(); // a tap that opens a sheet on pointerdown must not click the sheet's button under the finger
installPaper();
initInk(stage.fx);
initDamageNumbers(stage.fx);
requestPersistence(); // once, guarded: the browser may then keep the save when space runs low

const bus = createBus();
/** The page the camera clamps to: the base page is smaller than the run's pages, so the game and the page turn keep this in step. */
const bounds = { w: PAGE_W, h: PAGE_H };
const camera = createCamera(stage.svg, stage.wobble, bounds);
camera.resize();
const wobble = createWobble(stage);
let meta = loadMeta();
let screen: Screen = 'title';
/** The run that waits while the player is in the base through the service tunnel (DESIGN 4.1): the same object, in memory only. */
const hold = createRunHold<RunState>();
/** The ticket (seed and number) the printed footnotes belong to: the numbering runs on from its base page through its run. */
let notesFor = '';

/** Day / night / by device, the left-handed mirror, steering and the orientation lock. */
let lockedFor: string | null = null;
function applySettings(s: Settings): void {
  setTheme(s.theme);
  stage.ui.classList.toggle('lefty', s.leftHanded);
  setVolumes(s.musicVolume, s.sfxVolume);
  document.documentElement.style.setProperty('--ts', String([1, 1.15, 1.3][s.textSize ?? 0] ?? 1));
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

// Router: title -> profile (only without a hero) -> the base page of the planet (screen 'baza', walkable) -> the exit ->
// the run (screen 'run') -> back to a base. The desk, the ticket, the Sklep and the settings are sheets over the base page.
// In joystick mode the footnote slip lets the thumb through (a thumb landing on it steers); its quick tap opens the history.
const input = createInput(
  stage.svg,
  (x, y, walk) => {
    if (!walk && footnotes.hits(x, y)) footnotes.openHistory();
    else game.onTap(x, y, walk);
  },
  createJoystick(stage.ui),
);
initLayout(() => applySettings(meta.settings)); // data-orient on <html> follows the window; steering follows it until the player chooses
applySettings(meta.settings);
const game = createGame(stage, bus, camera, input, bounds);
const hud = createHud(stage.ui, () => game.hero.requestUpdate(), () => pauseRun(), () => openTunnelNow(), () => void (game.state && useHeld(game.state, bus)), () => openOsobowaFromHud());
const footnotes = createFootnotes(stage.ui);
const pads = createPads(stage.ui, bus);
watchLayout(stage.ui); // what the HUD, pads and notes cover: bubbles, stamps and the page header keep out from under it
const sporStrip = createSpor(stage.ui, bus, () => game.state); // the reply strip of a boss argument (hidden with the footnotes)
// The cover leads to the roster (the creation form when there is no case file yet); a file opens the base.
const title = createTitle(stage.ui, () => {
  rosterFrom = 'title';
  go('profile');
});
const freshSeed = (): number => (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
/** The planet of the next ticket: chosen when the previous ticket ended (a bookmark or a held run overrides it). */
let nextSeed = freshSeed();

/** The sheets over the base page. At most one is up; the base holds still while it is. */
type SheetKind = 'biurko' | 'ticket' | 'kiosk' | 'tablica' | 'urzednik' | 'paczkomat';
let sheetKind: SheetKind | null = null;
/** The base was running and a sheet paused it (the sheet gives it back). */
let sheetHolds = false;
let shop: SklepHandle | null = null;
/** The base paczkomat's sheet (S18): the awizos waiting at the base. */
let paczkomatUi: PaczkomatSheet | null = null;

const baza = createBaza(stage.ui, {
  onNewTicket: () => newTicket(),
  onReturn: () => returnFromTunnel(),
  onImport: (next) => importSave(next),
  onClose: () => closeSheet(),
});
// The notice board: the announcements and the Historia zgłoszeń (a lost ticket is rewritten on the first visit).
const board = createBoard(stage.ui, {
  onRewritten: (indices) => save(markRewritten(meta, indices)),
  onClose: () => closeSheet(),
});
const onSettingsChange = (next: Settings): void => {
  save({ ...meta, settings: next });
  applySettings(next);
};
const onVolumeSet = (which: 'music' | 'sfx'): void => {
  if (which === 'sfx') audio.preview();
};
// The settings live in the pause sheet only: Wróć returns to the sheet.
const pauseSettings = createSettings(stage.ui, onSettingsChange, () => closePauseSettings(), onVolumeSet);
const pauseSheet = createPauseSheet(stage.ui, { onResume: () => resumeRun(), onSettings: () => openPauseSettings(), onSkills: () => openPauseSkills(), onParagraphs: () => openKonfig('pause'), onEnd: () => endTicket(), onExit: () => exitToRoster(), onReport: () => reportProblem(), showReport: () => meta.settings.bugButton !== false });
const ticket = createTicket(stage.ui, {
  onAccept: (priority) => acceptNow(priority),
  onTravel: (planet, priority) => takePlan((c, seed) => travelPlan(c, planet, priority, seed), priority),
  onExtra: (priority) => takePlan((c, seed) => extraPlan(c, priority, seed), priority),
  onClose: () => openSheet('biurko'),
});

// ---------- the campaign as the ticket form and the cards see it ----------
/**
 * The campaign lives on the character (world/campaign.ts, saved by save/character.ts); the base state carries a copy
 * (`RunState.campaign`) and the plan on the desk (`RunState.plan`). `campaignOverride` is the test hook's way to show other states.
 */
let campaignOverride: CampaignView | null = null;
const campaignView = (): CampaignView => {
  if (campaignOverride) return campaignOverride;
  const s = game.state;
  return campaignViewOf(s?.campaign ?? newCampaign(), s?.plan);
};
let cardUi: CardHandle | null = null;

/** The opening page or the chapter card of a new ticket's base, shown once per character (kept in its campaign); a tap removes it. */
function showCard(number: number, force?: 'opening' | 'chapter' | 'rewritten' | 'finale'): void {
  const s = game.state;
  const view = campaignView();
  const seen = s?.campaign?.cards ?? noCardsSeen();
  const spec = force ? { kind: force, planetIndex: Math.min(Math.max(view.planetIndex, 0), 8) } : cardToShow(view, seen, meta.history.length);
  if (!spec) return;
  cardUi?.close();
  if (!force && s) {
    s.campaign = { ...cloneCampaign(s.campaign ?? newCampaign()), cards: markShown(seen, spec) };
    if (meta.character) save(withCharacter(meta, s)); // a case file keeps it; a bare test start keeps it on the state only
  }
  cardUi = openCard(stage.ui, spec, { number, ...(meta.heroId ? { heroId: meta.heroId } : {}), onDone: () => (cardUi = null) });
}

/**
 * Free travel or a zgłoszenie dodatkowe from the ticket form: the base is laid out again for the new plan (same seed and
 * number), its card is shown, and the ticket is accepted at once with the priority chosen on the form.
 */
function takePlan(make: (c: CampaignState, seed: number) => TicketPlan | null, priority: PriorityId): void {
  const s = game.state;
  if (screen !== 'baza' || !s || s.phase !== 'base') return;
  const plan = make(s.campaign ?? newCampaign(), s.seed);
  if (!plan) return;
  closeSheet();
  leave('newTicket'); // a run held in the tunnel is given up first, as the accept button does
  enterBase({ seed: s.seed, number: s.ticket.number, plan, ...(s.campaign ? { campaign: s.campaign } : {}) });
  acceptNow(priority);
}

/**
 * "Nowe zgłoszenie" on the desk: the exit of the base leads into the open (bookmarked) quest, so a new ticket first drops
 * the bookmark (the desk asked), lays the base out again, then opens the form for the priority, travel and extras.
 */
function newTicket(): void {
  if (screen === 'baza' && meta.bookmark && !hold.peek()) {
    save(withoutBookmark(meta));
    closeSheet();
    enterBase();
  }
  openSheet('ticket');
}

/** The walkable screens: the base page and the run. */
const live = (): boolean => screen === 'run' || screen === 'baza';

function go(next: Screen, seed: number = freshSeed(), opts: RunOptions = {}): void {
  if (next === 'ticket' || next === 'settings') {
    // The ticket is a sheet of the base; the settings are the pause sheet's (the test hook still reaches both by name).
    if (screen !== 'baza') go('baza');
    if (next === 'ticket') openSheet('ticket');
    else if (pauseRun()) openPauseSettings();
    return;
  }
  // A sheet over the base is one history entry; leaving the base for another screen replaces it instead of popping and pushing.
  syncHistory(sheetKind !== null && screen === 'baza' ? 'ticket' : screen, next);
  dropSheets();
  if (next !== 'baza') cardUi?.close();
  if (next === 'profile' && screen !== 'profile') settleForRoster();
  screen = next;
  const walkable = next === 'run' || next === 'baza';
  hud.el.classList.toggle('hidden', !walkable);
  footnotes.el.classList.toggle('hidden', !walkable);
  pads.classList.toggle('hidden', !walkable);
  sporStrip.el.classList.toggle('hidden', !walkable);
  pads.classList.toggle('in-base', next === 'baza');
  footnotes.closeHistory(); // the history sheet belongs to the screen it was opened on (the notes themselves may run on)
  if (next !== 'title') title.hide();
  if (next !== 'profile') dropRosterScreens();
  if (next !== 'run') clearPause();
  if (!walkable) input.setEnabled(false);
  switch (next) {
    case 'title':
      title.show(meta.runsCompleted);
      break;
    case 'profile':
      if (rosterStore().files().length > 0) showRoster();
      else showCreate(false);
      break;
    case 'baza':
      enterBase();
      break;
    case 'run': {
      leave(opts.resume ? 'resumeBookmark' : 'newTicket'); // a run held in the tunnel is given up before another starts
      footnotes.reset();
      setOfficeOpen(null);
      // A resumed ticket keeps its number; the saved character (gear, purse, level, updates) is applied before the stats.
      const s = game.start(seed, { ...(opts.resume ? {} : { ticketNumber: TICKET_BASE + meta.history.length }), heroId: meta.heroId, character: meta.character, ...opts });
      notesFor = `${s.seed}:${s.ticket.number}`;
      hud.invalidate();
      break;
    }
    case 'death':
      break;
  }
  bus.emit('screen:changed', { screen });
}

// ---------- the roster and the creation of a case file ----------
/** Where "Wróć" of the roster leads: the cover it came from, or the base it was opened in. */
let rosterFrom: 'title' | 'baza' = 'title';
let rosterUi: Roster | null = null;
/** The hero pick is up for a new case file that came from the roster (the back button returns to the roster). */
let creatingFromRoster = false;

/**
 * The roster can make another case file active or delete this one, and the save mirrors the active file at the top level:
 * whatever is live must be written into the file it belongs to before the roster opens, and must not stay live after.
 * A held run is settled like Zakończ (bookmark), the live base or run writes its character (a run also its bookmark),
 * and the game stops, so nothing (autosave, a walk out of the exit, the tunnel) can write it over the next file.
 */
function settleForRoster(): void {
  const here = game.state;
  if (hold.held) leave('changeHero');
  else if (here && live() && savable(here)) save(withBookmark(withCharacter(meta, here), here));
  if (game.state) game.stop();
  baza.setTunnel(null);
}

function dropRosterScreens(): void {
  rosterUi?.destroy();
  rosterUi = null;
  unmountProfile();
  creatingFromRoster = false;
}

function showRoster(): void {
  dropRosterScreens();
  rosterUi = mountRoster(
    stage.ui,
    rosterStore(),
    {
      onOpen: () => {
        meta = loadMeta(); // the file the store made active: its character, bookmark and history
        go('baza');
      },
      onCreate: () => showCreate(true),
      onBack: () => go(rosterFrom === 'baza' && meta.character ? 'baza' : 'title'),
      onRemoved: () => {
        meta = loadMeta();
      },
    },
    rosterFrom,
  );
}

function showCreate(fromRoster: boolean): void {
  dropRosterScreens();
  creatingFromRoster = fromRoster;
  const store = rosterStore();
  mountProfile(stage.ui, {
    defaultName: store.nextName(),
    create: (heroId, name) => store.create(heroId, name),
    onCreated: () => {
      creatingFromRoster = false;
      meta = loadMeta();
      go('baza');
    },
    ...(fromRoster ? { onCancel: () => showRoster() } : {}),
  });
}

/**
 * The base page of a planet. Its planet is the held run's while a tunnel holds one, else the bookmarked one, else the next
 * ticket's (chosen when the previous ticket ended). A bookmark makes the desk offer "Wznów zgłoszenie"; a held run puts the
 * open hole near the landing spot. Another ticket clears the footnotes; the same ticket (the tunnel's base, the base after
 * Zakończ) keeps them and their numbering, like the Asystent (narration/asystent.ts).
 */
function enterBase(over: { seed?: number; number?: number; plan?: TicketPlan; campaign?: CampaignState } = {}): RunState {
  const held = hold.peek();
  const b = meta.bookmark;
  const seed = over.seed ?? (held ? held.seed : b ? b.seed : nextSeed);
  const number = over.number ?? (held ? held.ticket.number : b && !over.seed ? b.ticketNumber : TICKET_BASE + meta.history.length);
  if (game.state && game.state !== held) game.stop();
  if (`${seed}:${number}` !== notesFor) {
    footnotes.reset();
    notesFor = `${seed}:${number}`;
  }
  setOfficeOpen(null);
  const resume = b && !held && !over.plan && b.seed === seed ? b : undefined;
  // The plan on the desk: the held run's, the bookmarked one, a travel/extra choice, or the campaign's next ticket.
  const campaign = over.campaign ? cloneCampaign(over.campaign) : meta.character?.campaign ? toCampaign(meta.character.campaign) : newCampaign();
  // The base is entered with the plan already open (the exit is never locked): at the last priority chosen on the form, default Normalny.
  const priority = clampPriority(ticket.priority(), meta.character?.level ?? 1);
  const plan = over.plan ?? held?.plan ?? resume?.plan ?? (held || resume ? undefined : defaultPlan(campaign, priority, seed));
  const state = game.start(seed, {
    ...(plan ? { plan } : {}),
    phase: 'base',
    ticketNumber: number,
    heroId: meta.heroId,
    character: meta.character,
    ...(held && !over.plan ? { lawId: held.ticket.lawId, pageCount: held.pageCount } : {}),
    ...(resume ? { resume } : {}),
  });
  if (held?.tunnel) {
    // the base end of the tunnel: the hole is cut near the landing spot, the way back into the held run
    const hole = cutBaseHole(state);
    if (hole) tunnelFx.show(hole.x, hole.y, true);
    baza.setTunnel({ number: held.ticket.number, page: held.tunnel.pageIndex + 1 });
  } else baza.setTunnel(null);
  if (over.campaign || !state.campaign) state.campaign = campaign;
  hud.invalidate();
  if (!held && !resume) showCard(number);
  return state;
}

// ---------- the sheets over the base page ----------
/**
 * Hold the base while a sheet is up: nothing walks, nothing opens, the stick and the finger are let go. The sheet may be
 * opened by a tap (`station:opened` from `Game.onTap`), so the input is switched off here, not by the step.
 */
function holdBase(): void {
  const s = game.state;
  if (!s || s.status !== 'running') return;
  s.status = 'paused';
  sheetHolds = true;
  s.player.target = null;
  delete s.player.steer;
  input.setEnabled(false);
}

/** Give the base back. The input goes on again with the state: a sheet that stops the base must always start it (a hung stick was this). */
function releaseBase(): void {
  const s = game.state;
  if (sheetHolds && s && s.status === 'paused' && !game.paused) {
    s.status = 'running';
    input.setEnabled(true);
  }
  sheetHolds = false;
}

/** Take every sheet off the page without touching the history (the caller does that). */
function dropSheets(): void {
  archiveUi?.close();
  archiveUi = null;
  karta?.close();
  karta = null;
  osobowa?.close();
  osobowa = null;
  npcUi?.close();
  npcUi = null;
  konfig?.close();
  konfig = null;
  baza.close();
  board.close();
  ticket.close();
  shop?.unmount();
  shop = null;
  paczkomatUi?.close();
  paczkomatUi = null;
  if (sheetKind !== null) {
    sheetKind = null;
    releaseBase();
  }
}

/** Put a sheet over the base page: the desk, the ticket form, the Sklep or the notice board. */
function openSheet(kind: SheetKind): void {
  const s = game.state;
  if (screen !== 'baza' || !s || s.phase !== 'base') return;
  const wasUp = sheetKind !== null;
  baza.close();
  board.close();
  ticket.close();
  npcUi?.close();
  npcUi = null;
  shop?.unmount();
  shop = null;
  paczkomatUi?.close();
  paczkomatUi = null;
  if (!wasUp) {
    holdBase();
    syncHistory('baza', 'ticket');
  }
  sheetKind = kind;
  switch (kind) {
    case 'biurko':
      baza.open(meta);
      addDeskLine(stage.ui, () => openKonfig('desk'));
      addKartaDeskLine(stage.ui, () => openKartaSheet());
      addOsobowaDeskLine(stage.ui, () => openOsobowaSheet());
      addArchiveDeskLine(stage.ui, () => openArchiveSheet());
      break;
    case 'ticket':
      ticket.open(s.ticket, { level: s.player.level, view: campaignView() });
      break;
    case 'tablica':
      board.open(meta, boardQuests(s));
      break;
    case 'urzednik': {
      // the clerk: his lines, and a parcel carried out of the base is handed over by opening the sheet
      const handed = visitClerk(s, bus).flatMap((id) => {
        const def = questById(id);
        return def ? [t(def.titleKey)] : [];
      });
      if (handed.length > 0) save(withCharacter(meta, s));
      npcUi = openNpcSheet(stage.ui, npcAt(questPlanet(s)), handed, { onClose: () => closeSheet() });
      break;
    }
    case 'paczkomat':
      // the parcels waiting at the base; a pickup costs gwiazdki and moves the item into the bag, so the character is saved with it
      paczkomatUi = openPaczkomat(stage.ui, {
        player: () => (game.state === s ? s.player : null),
        say: (text) => {
          paczkomatUi?.sheet.note(text);
          bus.emit('footnote', { text });
        },
        changed: () => {
          if (game.state === s) save(withCharacter(meta, s));
        },
        onClose: () => closeSheet(),
      });
      break;
    case 'kiosk':
      // The base Sklep spends the gwiazdki of the live player and fills the bag and gear the run starts with.
      shop = mountSklep(stage.ui, { runsCompleted: meta.runsCompleted }, s.player, {
        nextNumber: () => s.nextItemNumber++,
        planet: s.plan?.planet ?? s.campaign?.current ?? 0,
        feeCut: () => heroPriceCut(s),
        onClose: () => {
          shop = null;
          if (game.state === s) save(withCharacter(meta, s));
          closeSheet();
        },
      });
      break;
  }
}

/** Close the sheet over the base page and give the base back (the history entry the sheet pushed is taken back). */
function closeSheet(): void {
  if (sheetKind === null) return;
  dropSheets();
  syncHistory('ticket', 'baza');
}

/**
 * The ticket form's button: the plan on the desk is accepted again at the chosen priority. The exit of the base was open
 * already; a run held in the tunnel is given up when the player walks out (`base:exit`), not here.
 */
function acceptNow(priority?: PriorityId): boolean {
  unlockAudio(); // the accept button is the natural unlock (DESIGN 14.5); any first tap also unlocks
  const s = game.state;
  if (screen !== 'baza' || !s || s.phase !== 'base') return false;
  if (s.plan) s.plan = { ...s.plan, priority: clampPriority(priority ?? ticket.priority(), s.player.level) };
  if (!acceptTicket(s)) return false;
  bus.emit('ticket:accepted');
  closeSheet();
  return true;
}

/** Open the sheet (or the footnote) of a station (a tap on it, `Game.onTap` -> `station:opened`). */
function openStation(id: 'biurko' | 'kiosk' | 'tablica' | 'paczkomat' | 'urzednik'): boolean {
  if (screen !== 'baza' || game.state?.phase !== 'base') return false;
  openSheet(id);
  return true;
}
bus.on('station:opened', (e) => void openStation(e.station));

bindFx(
  bus,
  game.views,
  () => game.state?.page ?? null,
  () => freeViewRect(camera, 'stamp'),
  () => meta.settings.damageNumbers === true,
  () => keepOutBlocks(camera),
);
bindPageTurn(bus, { stage, camera, views: game.views, getState: () => game.state, bounds });
bindRunEvents(bus, () => game.state);
bindGates(bus, () => game.state); // a boss of a gated page opens it (world/gate.ts)
bus.on('base:exit', () => leave('newTicket')); // walking out of the base starts a ticket: a run held in the tunnel is settled first
// The tunnel closes itself on death, the end of the run and a page turn; both must hear `run:ended` before the handler below drops the state.
bindTunnel(bus, () => game.state);
// A completed ticket closes its planet in the character's campaign before the handler below saves the character.
bindCampaign(bus, () => game.state);
// Side tickets count kills, finds and pages of the run proper (world/quests.ts).
bindQuests(bus, () => game.state);
bindContent(bus, () => game.state); // teczka taps and page-content redraws (world/content.ts)
const tunnelFx = bindTunnelFx(bus, { page: stage.page, pageWidth: () => game.state?.page.w ?? PAGE_W });
// The hole in the run takes the player to the base (holding the run); the hole in the base takes him back.
bus.on('tunnel:entered', () => void (game.state?.phase === 'base' ? returnFromTunnel() : holdRun()));
// The exit of the base was walked through: the same state goes on as the run proper.
bus.on('run:started', () => {
  if (screen !== 'baza') return;
  syncHistory('baza', 'run');
  screen = 'run';
  pads.classList.remove('in-base');
  hud.invalidate();
  bus.emit('screen:changed', { screen: 'run' });
});
bindLaws(bus, () => game.state);
bindLawSheets(stage.ui, bus, () => game.state);
/** Print a footnote and tell the bus (the typewriter key and the carriage return are heard from `footnote:added`). */
const printNote = (text: string, correction = false): number => {
  const n = footnotes.add(text);
  bus.emit('footnote:added', { n, text, correction });
  return n;
};
const asystent = bindAsystent(bus, { say: printNote, getState: () => game.state, firstTicket: () => meta.history.length === 0, steering: () => effectiveSteering(meta.settings, currentOrient()) });
bus.on('footnote', (e) => printNote(e.text, e.correction === true)); // the finale's duel of footnotes prints its corrections as corrections
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
  nextSeed = freshSeed(); // the next ticket is another planet
  const caseClosed = e.outcome === 'ukonczono' && s.plan?.kind === 'final';
  go('baza');
  // the final footnote (STORY 8.4) is printed again on the base it returns to: the run's slip is cleared with the new ticket, and the note
  // is the one the player is meant to read at leisure (its last sentence is the hook for "Sprawę wznowiono")
  if (caseClosed) printNote(t('story.finale.footnote'));
});

const loop = createLoop({
  update: (dt) => {
    game.update(dt);
    const s = game.state;
    // the Asystent's clock: corrections and the idle note, in the run and on the base page (not under a sheet or a form)
    if (live() && s && s.status === 'running' && !s.modal && !s.turning) asystent.tick(dt);
  },
  render: (dt) => {
    tickTweens(dt * 1000);
    wobble.tick(dt * 1000);
    game.render(dt);
    audio.frame();
    if (live() && game.state) hud.update(game.state);
  },
});

// ---------- pause, Zakończ, resume (DESIGN 4.1) ----------
/** The character and the bookmark are written at every page turn, on pause, on Zakończ and when the app is hidden. */
const autosave = bindAutosave({ bus, getState: () => game.state, getMeta: () => meta, commit: save, inRun: live });

/** Hold the run and put the pause sheet on the page. False when a form or the pause sheet already holds it. */
function pauseRun(): boolean {
  const s = game.state;
  if (!live() || !s || !game.pause()) return false;
  loop.pause();
  pauseSheet.open({ number: s.ticket.number, planet: s.ticket.planet, page: s.pageIndex + 1, total: s.pageCount, base: s.phase === 'base' });
  return true;
}

/** Wznów: the same state object continues exactly where it stopped. */
function resumeRun(): void {
  clearPause();
  game.resume();
}

/** "Zgłoś problem z grą": the state dump goes to the clipboard and a footnote on the sheet says so. */
function reportProblem(): void {
  const s = game.state;
  const text = bugDump({ meta, bus, planet: s?.ticket.planet ?? null, page: s ? s.pageIndex + 1 : null, total: s?.pageCount ?? null, device: deviceInfo() });
  void copyText(text).then((ok) => pauseSheet.note(t(ok ? 'screens.pause.reported' : 'screens.pause.reportFailed')));
}

function openPauseSettings(): void {
  pauseSheet.setHidden(true);
  pauseSettings.show(meta.settings);
}

function closePauseSettings(): void {
  pauseSettings.hide();
  pauseSheet.setHidden(false);
}

/** The loadout (DESIGN 10.1) stands over the pause sheet like the settings; Wróć brings the pause sheet back. */
let loadout: LoadoutSheet | null = null;
function openPauseSkills(): void {
  const s = game.state;
  if (!s || loadout) return;
  pauseSheet.setHidden(true);
  loadout = openLoadout(stage.ui, s, () => closePauseSkills());
}

function closePauseSkills(): void {
  loadout?.close();
  loadout = null;
  pauseSheet.setHidden(false);
}

/** Konfiguracja (DESIGN 10.2) stands over the desk or the pause sheet; Wróć shows what stood under it again. */
let konfig: KonfiguracjaSheet | null = null;
let konfigFrom: 'desk' | 'pause' = 'pause';
function openKonfig(from: 'desk' | 'pause'): void {
  const s = game.state;
  if (!s || konfig) return;
  konfigFrom = from;
  if (from === 'pause') pauseSheet.setHidden(true);
  else stage.ui.querySelector('.desk-sheet')?.classList.add('hidden');
  konfig = openKonfiguracja(stage.ui, s, () => closeKonfig());
}

function closeKonfig(): void {
  konfig?.close();
  konfig = null;
  if (konfigFrom === 'pause') pauseSheet.setHidden(false);
  else stage.ui.querySelector('.desk-sheet')?.classList.remove('hidden');
  // the loadout and paragraphs chosen here are in the saved character now (mid-ticket: with the bookmark)
  const s = game.state;
  if (s && s.phase === 'base') save(withCharacter(meta, s));
  else autosave.save();
}

/** The Karta uprawnień (DESIGN 10.3) stands over the desk; Wróć shows the desk again. */
let karta: KartaSheet | null = null;
function openKartaSheet(): void {
  const s = game.state;
  if (!s || karta) return;
  stage.ui.querySelector('.desk-sheet')?.classList.add('hidden');
  karta = openKarta(stage.ui, kartaInputFromRun(s), () => closeKartaSheet());
}

function closeKartaSheet(): void {
  karta?.close();
  karta = null;
  stage.ui.querySelector('.desk-sheet')?.classList.remove('hidden');
}

/**
 * The Karta osobowa (PLAN 8) opens from the desk like the Karta uprawnień, and from the HUD's Reputacja line in the base and in a run:
 * there the game is held as the pause sheet holds it (the sheet itself stays hidden under the card) and Wróć lets it go again.
 */
let osobowa: OsobowaSheet | null = null;
let osobowaFrom: 'desk' | 'hud' = 'desk';
function openOsobowaSheet(): void {
  const s = game.state;
  if (!s || osobowa) return;
  osobowaFrom = 'desk';
  stage.ui.querySelector('.desk-sheet')?.classList.add('hidden');
  osobowa = openKartaOsobowa(stage.ui, osobowaInputFromRun(s), () => closeOsobowa());
}

function openOsobowaFromHud(): void {
  const s = game.state;
  if (!s || osobowa || !live() || sheetKind !== null || !pauseRun()) return;
  osobowaFrom = 'hud';
  pauseSheet.setHidden(true);
  osobowa = openKartaOsobowa(stage.ui, osobowaInputFromRun(s), () => closeOsobowa());
}

function closeOsobowa(): void {
  osobowa?.close();
  osobowa = null;
  if (osobowaFrom === 'desk') stage.ui.querySelector('.desk-sheet')?.classList.remove('hidden');
  else resumeRun();
}

/** The side tickets of the notice board, on the live base: every change is written into the character at once. */
function boardQuests(s: RunState): BoardQuests {
  const persist = (): void => save(withCharacter(meta, s));
  return {
    planet: () => questPlanet(s),
    state: () => questsOf(s),
    accept: (id) => {
      const res = takeQuest(s, bus, id);
      if (res === 'ok') persist();
      return res;
    },
    drop: (id) => {
      if (dropQuest(s, bus, id)) persist();
    },
    report: (id) => {
      const ok = completeQuest(s, bus, id);
      if (ok) persist();
      return ok;
    },
  };
}

/** The Archiwum (ITEMS 8) stands over the desk the same way: the bag of the live base, the personal archive, the shared one. */
let archiveUi: ArchiveSheet | null = null;
/** The sheet of a person in the base (the clerk). */
let npcUi: NpcSheet | null = null;
function openArchiveSheet(): void {
  const s = game.state;
  if (!s || archiveUi || s.phase !== 'base') return;
  save(withCharacter(meta, s)); // storage then holds the bag as it is now; the store moves items there
  const store = rosterStore();
  stage.ui.querySelector('.desk-sheet')?.classList.add('hidden');
  archiveUi = openArchive(
    stage.ui,
    {
      who: () => ({ name: store.activeName() ?? '', level: meta.character?.level ?? 1 }),
      places: () => store.places(),
      move: (uid, from, to) => {
        const res = store.move(uid, from, to);
        if (res.ok) {
          meta = loadMeta();
          const bag = meta.character?.inventory ?? [];
          s.player.inventory.length = 0;
          s.player.inventory.push(...bag.map((i) => ({ ...i })));
        }
        return res;
      },
    },
    () => closeArchiveSheet(),
  );
}

function closeArchiveSheet(): void {
  archiveUi?.close();
  archiveUi = null;
  stage.ui.querySelector('.desk-sheet')?.classList.remove('hidden');
}

/** Take the pause sheet and its settings off the page and let the loop run (used by resume, Zakończ and every screen change). */
function clearPause(): void {
  karta?.close();
  karta = null;
  osobowa?.close();
  osobowa = null;
  konfig?.close();
  konfig = null;
  loadout?.close();
  loadout = null;
  pauseSettings.hide();
  pauseSheet.close();
  loop.resume(); // a run held in the tunnel is not stepped (it is not the live state), so the loop always runs
}

/** Wyjdź on the pause sheet: the roster of case files; go() settles the live base or run and any held run into this file first (settleForRoster). */
function exitToRoster(): void {
  if (!live()) return;
  rosterFrom = 'baza';
  go('profile');
}

/** Zakończ zgłoszenie: the character and a bookmark are saved, the run is dropped, back to the base. */
function endTicket(): void {
  if (screen !== 'run' || !game.state) return;
  autosave.save();
  closeTunnel(game.state, bus, closeFor('abandon'));
  game.stop();
  go('baza');
}

/**
 * Wznów zgłoszenie, at the desk: the exit of the base opens and leads straight to the bookmarked page, which is regenerated
 * from the bookmarked seed (enemies back, floor loot gone, racja full, the reassigned footnote on arrival).
 */
function resumeTicket(): boolean {
  if (screen !== 'baza') return false;
  let s = game.state;
  const b = meta.bookmark;
  if (!b) return false;
  if (!s || s.phase !== 'base' || s.seed !== b.seed) s = enterBase();
  leave('resumeBookmark');
  if (!acceptTicket(s, b)) return false;
  bus.emit('ticket:accepted');
  closeSheet();
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
  if (screen !== 'run' || !s?.tunnel || s.phase !== 'run' || hold.held || !game.pause()) return false;
  hold.hold(s);
  go('baza'); // the base of the held run's planet, with the open hole near the landing spot; the run waits in `hold`
  return true;
}

/**
 * The player walked into the hole of the base, or pressed "Wróć do zgłoszenia" at the desk: the held run continues exactly as
 * it was, its page is drawn anew, and the tunnel closes behind the player (a strip of tape over the hole). The base goes away.
 */
function returnFromTunnel(): boolean {
  const held = hold.peek();
  const here = game.state;
  if (screen !== 'baza' || !held || !here || here === held || here.phase !== 'base' || fateOfHeldRun(true, 'return') !== 'continue') return false;
  save(withCharacter(meta, here)); // what the player did in the base (the Sklep, the bag) is in the saved character now
  closeSheet(); // the desk's "Wróć do zgłoszenia" is a button on a sheet
  hold.take();
  carryPurse(held, meta.character); // ... and goes along into the held run
  if (here.quests) held.quests = cloneQuests(here.quests); // tickets taken or reported in the base go along too
  baza.setTunnel(null);
  delete here.tunnel;
  game.adopt(held);
  tunnelFx.restore(held.pageIndex); // the page was drawn anew: the tape of an earlier hole on it goes back where it was
  if (held.tunnel) tunnelFx.show(held.tunnel.x, held.tunnel.y, false, held.tunnel.pageIndex); // the hole is drawn again so the tape can lie across it
  syncHistory('baza', 'run');
  screen = 'run';
  pads.classList.remove('in-base');
  hud.invalidate();
  bus.emit('screen:changed', { screen: 'run' });
  loop.resume();
  game.resume();
  bus.emit('tunnel:returned');
  closeTunnel(held, bus, closeFor('return'));
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
  const here = game.state;
  if (here && here !== s && here.phase === 'base') save(withCharacter(meta, here)); // the base's own changes to the character
  carryPurse(s, meta.character);
  save(withBookmark(withCharacter(meta, s), s));
  closeTunnel(s, bus, closeFor('abandon')); // the hole in the base is rubbed out with it
  baza.setTunnel(null);
  if (here && here !== s) delete here.tunnel;
  if (game.state === s) game.stop();
}

/**
 * An archive replaced the save (the desk's confirmation form). A run held in the tunnel belonged to the old save and is
 * dropped unsaved; the base page is printed again from the new character, so walking out or settling a held run can never
 * write the old character back over the imported one. Without a hero the profile screen asks for one.
 */
function importSave(next: typeof meta): void {
  const held = hold.take();
  if (held) {
    closeTunnel(held, bus, closeFor('abandon'));
    baza.setTunnel(null);
  }
  save(next);
  applySettings(next.settings);
  if (!next.heroId) {
    game.stop(); // the old file's base is not settled into the imported save (settleForRoster finds nothing live)
    go('profile');
    return;
  }
  dropSheets();
  enterBase();
  openSheet('biurko'); // the desk is drawn again from the new save
}

// ---------- the back button (Android) ----------
/**
 * The run screen, the profile screen and a sheet over the base page (the desk, the ticket, the Sklep, the notice board; counted
 * as 'ticket') are one history entry above the base; the base page and the title are the root. Opening one of them pushes an
 * entry, leaving it by a button takes it back, so the system back button walks baza <- sheet / profile. During a run the button
 * never leaves: it opens the pause sheet, and while the run is paused it resumes (the entry the press consumed is pushed
 * again). At the root, the base page, it leaves.
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
function ownEntry(): boolean {
  try {
    const st = history.state as { screen?: string } | null;
    return typeof st?.screen === 'string';
  } catch {
    return false;
  }
}
function syncHistory(from: Screen, to: Screen): void {
  const a = HISTORY_LEVEL[from];
  const b = HISTORY_LEVEL[to];
  if (b > a) pushEntry(false, to);
  else if (b === a && b === 1) pushEntry(true, to);
  else if (b < a && !poppedByUser && pushed > 0) {
    pushed--;
    // never step back past the entries this game pushed (the first entry has no state of ours): that would leave the app
    if (ownEntry()) {
      backsWeAsked++;
      history.back();
    }
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
  if (screen === 'baza' && sheetKind !== null) {
    // the back button closes the sheet over the base page; the entry it consumed is the sheet's own
    poppedByUser = true;
    closeSheet();
    poppedByUser = false;
    return;
  }
  if (HISTORY_LEVEL[screen] === 1) {
    poppedByUser = true;
    if (screen === 'profile' && creatingFromRoster) {
      pushEntry(false, 'profile'); // the entry the press consumed stands again: the roster is the same screen
      showRoster();
    } else go(screen === 'profile' ? (rosterFrom === 'baza' && meta.character ? 'baza' : 'title') : 'baza');
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
  importSave,
  pause: pauseRun,
  resume: resumeRun,
  openTunnel: openTunnelNow,
  returnFromTunnel,
  endTicket,
  resumeTicket,
  startBase: (seed) => {
    if (screen !== 'baza') go('baza');
    return enterBase(seed === undefined ? {} : { seed });
  },
  station: openStation,
  acceptTicket: () => acceptNow(),
  setCampaignView: (v) => (campaignOverride = v),
  showCard: (kind) => showCard(TICKET_BASE + meta.history.length, kind),
  priority: () => game.state?.plan?.priority ?? DEFAULT_PRIORITY,
  notes: () => footnotes.recent(60),
  changeSettings: (patch) => {
    const next = { ...meta.settings, ...patch };
    save({ ...meta, settings: next });
    applySettings(next);
  },
});
go('title');
loop.start();
