import type { Bus } from '../core/events';
import { t } from '../i18n';
import { priceCut } from '../heroes/quirks';
import { shopIlvl } from '../items/level';
import { mountSklep, type SklepHandle } from '../ui/sklep';
import type { RunState } from '../world/run';
import { botLine, officeOverride, setOfficeOpen } from './hours';
import { createSklep, restock, type SklepState } from './sklep';

interface KioskContext {
  root: HTMLElement;
  bus: Bus;
  getState(): RunState | null;
}

let ctx: KioskContext | null = null;
let botCount = 0;
let handle: SklepHandle | null = null;
const stores = new WeakMap<RunState, Map<number, SklepState>>();

export function installKiosk(c: KioskContext): void {
  ctx = c;
  c.bus.on('screen:changed', () => closeKiosk());
  c.bus.on('run:started', () => closeKiosk());
}

/** Is the kiosk open now? A clause's decision (setOfficeOpen) wins over the run's own flag. */
export function kioskIsOpen(s: RunState): boolean {
  const open = officeOverride() ?? s.law.officeOpen;
  return open && !s.law.botTime;
}

const planetOf = (s: RunState): number => s.plan?.planet ?? 0;

/** The stock of this page's kiosk, made once per run and page. */
function storeFor(s: RunState): SklepState {
  const perRun = stores.get(s) ?? new Map<number, SklepState>();
  stores.set(s, perRun);
  const existing = perRun.get(s.pageIndex);
  if (existing) return existing;
  const fresh = createSklep();
  restock(fresh, s.seed, s.pageIndex + 1, shopIlvl(planetOf(s)), planetOf(s));
  perRun.set(s.pageIndex, fresh);
  return fresh;
}

export function closeKiosk(): void {
  handle?.unmount();
  handle = null;
}

/**
 * Called by the page when the player taps the kiosk. Open: the same sheet as at the base
 * (the simulation is paused while it is open). Outside hours: a scripted bot footnote.
 * Returns what happened.
 */
export function openKiosk(): 'sheet' | 'bot' | 'none' {
  const c = ctx;
  const s = c?.getState();
  if (!c || !s || handle) return 'none';
  if (s.status !== 'running') return 'none';
  if (!kioskIsOpen(s)) {
    c.bus.emit('footnote', { text: botLine(botCount++) });
    return 'bot';
  }
  s.status = 'paused';
  handle = mountSklep(c.root, { runsCompleted: s.pageIndex }, s.player, {
    mode: 'kiosk',
    state: storeFor(s),
    planet: planetOf(s),
    feeCut: () => priceCut(s),
    say: (text) => c.bus.emit('footnote', { text }),
    nextNumber: () => s.nextItemNumber++,
    onClose: () => {
      handle = null;
      if (s.status === 'paused') s.status = 'running';
    },
  });
  return 'sheet';
}

/** Hook for `lawHooks.officeChanged`: remember the decision and announce it. */
export function onOfficeChanged(open: boolean): void {
  setOfficeOpen(open);
  ctx?.bus.emit('footnote', { text: open ? t('economy.hours.kioskOpened') : t('economy.hours.kioskClosed') });
}
