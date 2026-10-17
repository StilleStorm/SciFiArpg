/**
 * Glue between the bus, the hero state and the hero forms (update, death). Created once by createGame.
 * Owns no rules of its own: skills are in skills.ts, outcomes in death/outcomes.ts, upgrades in progression/update.ts.
 */
import { maybeDropAppeal } from '../death/appeal';
import { applyPetla, applyZawieszenie, chooseOutcome, ghostExpired, takeCopyDrop, type DeathOutcome } from '../death/outcomes';
import type { Bus } from '../core/events';
import { createPickup } from '../entities/factory';
import type { Input } from '../input';
import { t } from '../i18n';
import { entryView, gainXp, confirmUpdate, openOffer, reroll, xpForKill } from '../progression';
import { eraseOut } from '../render/ink';
import type { Views } from '../render/view';
import { createDeathForms, type DeathForms } from '../ui/deathForms';
import { updatePadCooldowns, setPadHero } from '../ui/pads';
import { createUpdateForm, type UpdateForm } from '../ui/update';
import { nextId, type RunState } from '../world/run';
import { onPlayerHit } from './quirks';
import { castSkill } from './skills';

export interface HeroLayerDeps {
  root: HTMLElement;
  bus: Bus;
  views: Views;
  input: Input;
  getState(): RunState | null;
}

export interface HeroLayer {
  /** A run began: reset the forms and show this hero on the pads. */
  onStart(s: RunState): void;
  /** Every rendered frame: cooldown rings. */
  frame(s: RunState): void;
  readonly update: UpdateForm;
  readonly death: DeathForms;
  /** Test hook: make the next death this outcome. */
  forceOutcome(o: DeathOutcome | null): void;
  /** Open the update form for the player's current level (test hook, normally opened by a level up). */
  openUpdate(): boolean;
}

export function createHeroLayer(deps: HeroLayerDeps): HeroLayer {
  const { bus, views, input } = deps;
  const update = createUpdateForm(deps.root);
  const death = createDeathForms(deps.root);
  let forced: DeathOutcome | null = null;

  const resume = (s: RunState): void => {
    s.status = 'running';
    input.setEnabled(true);
    flush(s);
  };

  /** Open the form if a level was gained and nothing else holds the screen. */
  function flush(s: RunState): void {
    if (s.hero.pendingLevels <= 0 || s.status !== 'running' || update.isOpen) return;
    openUpdate(s);
  }

  function openUpdate(s: RunState): boolean {
    if (s.status !== 'running') return false;
    s.status = 'paused';
    input.setEnabled(false);
    const offer = openOffer(s);
    update.open({
      version: s.player.level,
      entries: offer.entries.map((e) => entryView(s, e)),
      rerollUsed: s.hero.rerollUsed,
      onReport() {
        const next = reroll(s);
        if (!next) return null;
        bus.emit('footnote', { text: t('forms.update.reportNote') });
        return next.entries.map((e) => entryView(s, e));
      },
      onPick(id) {
        if (!confirmUpdate(s, id)) return;
        bus.emit('footnote', { text: t('forms.update.installedNote', { n: s.player.level }) });
        s.hero.pendingLevels = Math.max(0, s.hero.pendingLevels - 1);
        update.close();
        resume(s);
      },
    });
    return true;
  }

  const state = (): RunState | null => deps.getState();
  const cast = (slot: 0 | 1 | 2): void => {
    const s = state();
    if (s) castSkill(s, bus, slot);
  };
  bus.on('skill:1', () => cast(0));
  bus.on('skill:2', () => cast(1));
  bus.on('skill:3', () => cast(2));

  // Pralka: every 10th hit taken is a "blad programu" (quirks.ts)
  bus.on('player:hit', () => {
    const s = state();
    if (s) onPlayerHit(s, bus);
  });

  bus.on('enemy:died', (ev) => {
    const s = state();
    if (!s) return;
    const p = s.player;
    const tier = ev.tier;
    const h = s.hero;
    p.gwiazdki += h.mods.gwiazdki;
    if (p.heroId === 'konsultant' && s.time < h.buffUntil) p.gwiazdki += 1;
    if (h.mods.lifeOnKill > 0) p.hp = Math.min(p.hpMax, p.hp + h.mods.lifeOnKill);
    maybeDropAppeal(s, ev.x, ev.y, tier);
    const item = takeCopyDrop(s, ev.id);
    if (item) {
      s.pickups.push(createPickup(nextId(s), ev.x, ev.y, item.number > 0 ? item.number : s.nextItemNumber++, item));
      bus.emit('footnote', { text: t('heroes.copy.killed') });
    }
    gainXp(s, bus, xpForKill(tier)); // each level gained emits player:levelup, handled below
  });

  bus.on('player:levelup', () => {
    const s = state();
    if (!s) return;
    s.hero.pendingLevels++;
    flush(s);
  });

  // Kartograf: the whole page map at once. The cheap honest version is a footnote naming the exit corner
  // (render/exitReveal.ts draws the dog-ear in straight away for this hero).
  bus.on('page:entered', () => {
    const s = state();
    const exit = s?.page.exit;
    if (!s || !exit || !s.player.revealsPage) return;
    bus.emit('footnote', { text: t('heroes.kartograf.exit', { corner: t(`heroes.kartograf.corner.${exit.corner}`) }) });
  });

  bus.on('summon:expired', ({ id }) => {
    const g = views.detach(id);
    if (g) eraseOut(g, 380, 0, () => g.remove());
    const s = state();
    if (s) ghostExpired(s, bus, id);
  });

  bus.on('player:unsuspended', () => death.clearHudStamp());

  bus.on('player:died', () => {
    const s = state();
    if (!s) return;
    const outcome = forced ?? chooseOutcome(s);
    forced = null;
    s.hero.deaths++;
    input.setEnabled(false);
    update.close();
    if (outcome === 'zgloszenie') {
      // "paused", not "dead": the ticket form owns the screen for six seconds, then the router takes over
      s.status = 'paused';
      death.hide();
      death.clearHudStamp();
      death.showZgloszenie(s.kills, () => {
        death.hide();
        bus.emit('run:ended', { outcome: 'zgloszenie' });
      });
      return;
    }
    if (outcome === 'petla') applyPetla(s, bus);
    else {
      applyZawieszenie(s, bus);
      death.showHudStamp();
    }
    s.status = 'paused';
    death.showSlip(outcome, () => {
      death.hide();
      resume(s);
    });
  });

  return {
    update,
    death,
    onStart(s) {
      update.close();
      death.hide();
      death.clearHudStamp();
      forced = null;
      setPadHero(s.player.heroId);
    },
    frame(s) {
      updatePadCooldowns(s.hero.cd, s.hero.cdTotal);
    },
    forceOutcome(o) {
      forced = o;
    },
    openUpdate() {
      const s = state();
      return s ? openUpdate(s) : false;
    },
  };
}
