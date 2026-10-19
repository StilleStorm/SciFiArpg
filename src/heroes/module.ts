/**
 * What a hero is made of (S1). One folder per hero, `src/heroes/<id>/`, exports a `HeroModule`; `heroes/registry.ts` lists them.
 * Types only; no hero id appears here.
 */
import type { SfxName } from '../audio/recipes';
import type { Bus } from '../core/events';
import type { Family } from '../progression/update';
import type { RunState } from '../world/run';
import type { Aim } from './aim';
import type { HeroDef } from './defs';
import type { SkillParagraphs } from './paragraphs';
import type { HeroFigure } from './figureKit';
import type { Mods } from './state';
import type { UltimateDef } from './ultimateDefs';

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
  /** The ultimate's recipe (audio/bindings.ts plays it on `ultimate:cast`; it ends in the stamp's thud). */
  ultimate?: SfxName;
}

/**
 * The five pad glyphs, by SkillIndex (ui/pads.ts draws them). Each is a list of path strings centred on 0,0 inside a
 * 52 x 52 box; a leading "~" draws that stroke dotted.
 */
export type HeroPadGlyphs = readonly [readonly string[], readonly string[], readonly string[], readonly string[], readonly string[]];

/** One passive of the update form (progression/update.ts): its change to Mods, and the permission family it needs. */
export interface HeroPassive {
  mods: Partial<Mods>;
  requires?: Family;
}

export interface HeroModule {
  def: HeroDef;
  figure: HeroFigure;
  sounds: HeroSounds;
  /** The cast of each skill, by `SkillDef.id` (built from the primitives in heroes/primitives). */
  casts: Readonly<Record<string, SkillFn>>;
  /** The three paragraphs of each skill, by `SkillDef.id` (heroes/paragraphs.ts; text `heroes.<id>.para.<skill>.<n>.{name,desc}`). */
  paragraphs: Readonly<Record<string, SkillParagraphs>>;
  /** The pad glyphs of the five skills. */
  pads: HeroPadGlyphs;
  /** The six passives the update form offers (`passive1..6`, text `forms.update.passive.<id>.N.{name,desc}`). */
  passives: readonly HeroPassive[];
  quirk?: HeroQuirk;
  /** The ultimates, by level (12 / 24 / 36); S3 builds the first (heroes/ultimate.ts casts it). Text `heroes.<id>.ult.<ultimate>.*`. */
  ultimates?: readonly UltimateDef[];
}
