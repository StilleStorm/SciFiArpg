/**
 * What a hero is made of (S1). One folder per hero, `src/heroes/<id>/`, exports a `HeroModule`; `heroes/registry.ts` lists them.
 * Types only; no hero id appears here.
 */
import type { SfxName } from '../audio/recipes';
import type { Bus } from '../core/events';
import type { RunState } from '../world/run';
import type { Aim } from './aim';
import type { HeroDef } from './defs';
import type { HeroFigure } from './figureKit';

/** A skill as a function on the run state. Returning false = nothing happened, no cooldown. `aim` is what the player aimed. */
export type SkillFn = (s: RunState, bus: Bus, hero: HeroDef, aim: Aim) => void | false;

/** Passive behaviour of the hero's quirk (DESIGN 10): reacts to being hit, and ticks every step of a run. */
export interface HeroQuirk {
  /** The player took a hit; true if the quirk did something. */
  onHit?(s: RunState, bus: Bus): boolean;
  /** Every step of a run (heroes/system.ts). */
  tick?(s: RunState, bus: Bus): void;
}

export interface HeroSounds {
  /** One sound per skill, by SkillIndex (audio/bindings.ts plays it on `skill:cast`). */
  skills: readonly [SfxName, SfxName, SfxName, SfxName, SfxName];
  /** Played when the auto-attack starts. */
  autoStart?: SfxName;
}

export interface HeroModule {
  def: HeroDef;
  figure: HeroFigure;
  sounds: HeroSounds;
  /** The cast of each skill, by `SkillDef.id` (built from the primitives in heroes/primitives). */
  casts: Readonly<Record<string, SkillFn>>;
  quirk?: HeroQuirk;
}
