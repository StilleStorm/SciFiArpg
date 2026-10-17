/**
 * Page turns and page population.
 *
 * Logic (pure state changes, testable): `tickPageTurn` notices the player at the exit and starts the turn
 * (`page:turn`), `enterPage` moves the run to the next page, `populatePage` fills it with enemies.
 * Visuals: `bindPageTurn` listens to `page:turn` and plays the sweep (the old sheet of #page and #world slides off
 * in 400 ms, the new page is drawn in).
 */
import type { Bus } from '../core/events';
import { FAMILY_IDS, type FamilyId } from '../enemies/ids';
import { t } from '../i18n';
import { openKiosk } from '../economy/kiosk';
import { spawnBoss } from '../enemies/bosses';
import { spawnEntryWave, spawnWave } from '../enemies/spawn';
import { MIN_VIEW_H, MIN_VIEW_W, viewRect, type Camera } from '../render/camera';
import { drawIn, stamp } from '../render/ink';
import { drawPage, type PageHeader } from '../render/obstacles';
import type { Stage } from '../render/stage';
import { el, n2 } from '../render/svg';
import { easeIn, tween } from '../render/tween';
import type { Views } from '../render/view';
import { canLeave, onPageEntered } from './laws';
import { atExit } from './pages';
import type { RunState } from './run';

export const SWEEP_MS = 400;
const KIOSK_REACH = 130;
const KIOSK_TAP = 80;

// ---------- header ----------

export function headerFor(s: RunState): PageHeader {
  return {
    top: t('screens.header.top', { number: s.ticket.number, page: s.pageIndex + 1, total: s.pageCount }),
    clause: t(`laws.${s.ticket.lawId}.header`, { planet: s.ticket.planetLoc }),
  };
}

// ---------- population ----------

interface Wave {
  family: FamilyId;
  count: number;
}

/** Waves for one page: the dominant family carries about 60%, the others split the rest. */
export function planWaves(s: RunState): Wave[] {
  const L = s.law;
  const last = s.pageIndex >= s.pageCount - 1;
  const total = Math.max(2, Math.round((5 + s.pageIndex * 2 + (last ? -1 : 0)) * L.enemyCountMul));
  const dominant = s.ticket.family;
  const others = FAMILY_IDS.filter((f) => f !== dominant);
  const mainCount = Math.max(1, Math.round(total * 0.6));
  const rest = total - mainCount;
  const waves: Wave[] = [{ family: dominant, count: mainCount }];
  others.forEach((family, i) => {
    const share = i === 0 ? Math.ceil(rest / 2) : Math.floor(rest / 2);
    if (share > 0) waves.push({ family, count: share });
  });
  return waves;
}

/** What the camera shows on entering the page: at least 390 x 700 units around the player, clamped to the paper. */
export function entryView(s: RunState): { x0: number; y0: number; x1: number; y1: number } {
  return viewRect(s.player.x, s.player.y, MIN_VIEW_W, MIN_VIEW_H, { w: s.page.w, h: s.page.h });
}

/** Fill the current page (and, on the last page, put the boss on it). Clears `s.populate`. */
export function populatePage(s: RunState, bus: Bus): void {
  s.populate = false;
  const r = s.rngs.spawn;
  const waves = planWaves(s);
  // The first wave stands in view of the entry (at least 3 enemies, none closer than 180 units).
  const first = waves.shift();
  if (first) spawnEntryWave(s, first.family, first.count, entryView(s));
  for (const w of waves) {
    // Spread each wave over the page, away from where the player stands.
    for (let tries = 0; tries < 20; tries++) {
      const around = { x: r.range(160, s.page.w - 160), y: r.range(160, s.page.h - 160) };
      if (Math.hypot(around.x - s.player.x, around.y - s.player.y) < 420) continue;
      spawnWave(s, w.family, w.count, around); // doubles the count itself under Parzystosc
      break;
    }
  }
  const last = s.pageIndex >= s.pageCount - 1;
  if (last) {
    if (!spawnBoss(s, s.ticket.family)) bus.emit('footnote', { text: t('screens.noBoss') });
  }
}

// ---------- the turn ----------

/** Move the run to page `index`: new page, player at the entry, everything else cleared. */
export function enterPage(s: RunState, bus: Bus, index: number): void {
  const page = s.pages[index];
  if (!page) return;
  s.pageIndex = index;
  s.page = page;
  s.enemies.length = 0;
  s.projectiles.length = 0;
  s.pickups.length = 0;
  s.zones.length = 0;
  for (const m of s.summons) {
    m.x = page.entry.x;
    m.y = page.entry.y;
  }
  s.player.x = page.entry.x;
  s.player.y = page.entry.y;
  s.player.target = null;
  s.player.moving = false;
  s.kioskPending = false;
  s.populate = true;
  s.spawnTimer = 10;
  onPageEntered(s, bus);
  bus.emit('page:entered', { index, count: s.pageCount });
}

/** Per step: populate a fresh page, watch the exit, the kiosk and the end of the run. */
export function tickPageTurn(s: RunState, bus: Bus): void {
  if (s.turning || s.modal) return;
  if (s.populate) populatePage(s, bus);

  if (s.victoryAt !== null && s.victoryAt >= 0 && s.time >= s.victoryAt) {
    s.victoryAt = -1;
    bus.emit('run:ended', { outcome: 'ukonczono' });
    return;
  }

  if (kioskReached(s)) openKiosk();

  if (s.page.exit && s.pageIndex < s.pageCount - 1 && atExit(s.page, s.player)) {
    if (canLeave(s, bus)) {
      s.turning = true;
      s.player.target = null;
      bus.emit('page:turn', { from: s.pageIndex, to: s.pageIndex + 1 });
    }
  }
}

/** Mark the run as won when the boss goes down. */
export function bindRunEvents(bus: Bus, getState: () => RunState | null): () => void {
  return bus.on('boss:died', (e) => {
    const s = getState();
    if (!s || s.victoryAt !== null) return;
    s.victoryAt = s.time + 2.8;
    bus.emit('stamp', { text: t('screens.victoryStamp'), x: e.x, y: e.y - 60 });
  });
}

// ---------- the kiosk ----------

/** The paczkomat on this page, if any. */
export function kioskOf(s: RunState): { x: number; y: number } | null {
  const k = s.page.obstacles.find((o) => o.kind === 'kiosk');
  return k ? { x: k.x, y: k.y } : null;
}

/** A tap at world (x, y): if it is on the kiosk, remember to open it when the player arrives. */
export function tapKiosk(s: RunState, x: number, y: number): boolean {
  const k = kioskOf(s);
  const hit = k !== null && Math.hypot(x - k.x, y - k.y) < KIOSK_TAP;
  s.kioskPending = hit;
  return hit;
}

/** True once when a pending kiosk tap has brought the player close enough. */
export function kioskReached(s: RunState): boolean {
  const k = kioskOf(s);
  if (!s.kioskPending || !k) return false;
  if (Math.hypot(s.player.x - k.x, s.player.y - k.y) > KIOSK_REACH) return false;
  s.kioskPending = false;
  return true;
}

// ---------- the sweep ----------

export interface TurnDeps {
  stage: Stage;
  camera: Camera;
  views: Views;
  getState(): RunState | null;
}

/** Plays the page-turn sweep on every `page:turn`. Returns the unbind function. */
export function bindPageTurn(bus: Bus, deps: TurnDeps): () => void {
  const { stage, camera, views } = deps;
  return bus.on('page:turn', (e) => {
    const s = deps.getState();
    if (!s) return;
    const oldView = (stage.svg.getAttribute('viewBox') ?? '0 0 390 844').split(' ').map(Number);
    const [ox = 0, oy = 0, vw = 390, vh = 844] = oldView;

    // 1. A copy of the old sheet (paper and drawings), kept as it looked.
    const sheet = el('g', { class: 'swept' });
    const oldPage = stage.page.cloneNode(true) as SVGGElement;
    oldPage.removeAttribute('id');
    oldPage.setAttribute('class', 'swept');
    const oldWorld = stage.world.cloneNode(true) as SVGGElement;
    oldWorld.removeAttribute('id');
    oldWorld.removeAttribute('filter');
    oldWorld.setAttribute('class', 'swept');
    sheet.append(oldPage, oldWorld);

    // 2. Move the run to the new page and draw it underneath.
    enterPage(s, bus, e.to);
    views.clear();
    stage.world.replaceChildren();
    stage.fx.replaceChildren();
    const ink = drawPage(stage.page, s.page, headerFor(s));
    camera.snap(s.player.x, s.player.y);
    camera.apply();
    const [nx = 0, ny = 0] = (stage.svg.getAttribute('viewBox') ?? '0 0 0 0').split(' ').map(Number);
    stage.svg.insertBefore(sheet, stage.fx.nextSibling);

    // 3. The old sheet is put back where it was on the screen, then swept to the left like a page.
    const dx = nx - ox;
    const dy = ny - oy;
    const cx = ox + vw / 2;
    const cy = oy + vh / 2;
    const place = (p: number): void => {
      sheet.setAttribute(
        'transform',
        `translate(${n2(dx - p * vw * 1.15)} ${n2(dy - p * 18)}) rotate(${n2(-p * 3)} ${n2(cx)} ${n2(cy)})`,
      );
    };
    place(0);
    drawIn(ink, SWEEP_MS);
    tween(SWEEP_MS, place, {
      ease: easeIn,
      done: () => {
        sheet.remove();
        s.turning = false;
        stamp(t('screens.pageStamp', { page: s.pageIndex + 1 }), s.player.x, s.player.y - 110, { ttl: 900 });
      },
    });
  });
}
