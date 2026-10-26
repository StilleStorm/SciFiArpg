/**
 * What a hero is made of (S1). One folder per hero, `src/heroes/<id>/`, exports a `HeroModule`; `heroes/registry.ts` lists them.
 * Types only; no hero id appears here.
 */
import type { SfxName } from '../audio/recipes';
import type { Bus } from '../core/events';
import type { Enemy } from '../entities/types';
import type { Family } from '../progression/update';
import type { RunState } from '../world/run';
import type { Aim } from './aim';
import type { HeroDef } from './defs';
import type { SkillParagraphs } from './paragraphs';
import type { HeroFigure } from './figureKit';
import type { Mods } from './state';
import type { HeroSpecs } from './specDefs';
import type { UltimateDef } from './ultimateDefs';

/** A skill as a function on the run state. Returning false = nothing happened, no cooldown. `aim` is what the player aimed. */
export type SkillFn = (s: RunState, bus: Bus, hero: HeroDef, aim: Aim) => void | false;

/** Passive behaviour of the hero's quirk (DESIGN 10): reacts to being hit, and ticks every step of a run. */
export interface HeroQuirk {
  /** The player took a hit; true if the quirk did something. */
  onHit?(s: RunState, bus: Bus): boolean;
  /** Every step of a run (heroes/system.ts). */
  tick?(s: RunState, bus: Bus): void;
  /** The share (0..1) by which the kiosk's fee is cut while this run lasts (Konsultant, Wstrzymanie oplat); 0 or absent: none. Read through heroes/quirks.ts `priceCut` by both Sklep checkouts (base kiosk and in-run kiosk). */
  priceCut?(s: RunState): number;
  /** S20: the factor (1 = none) on every blow the player lands on `target` (Kartograf, Odleglosc w linii prostej); read through heroes/quirks.ts `dealtMul` by systems/combat.ts applyDamage. */
  dealtMul?(s: RunState, target: Enemy): number;
  /** S20: the factor (1 = none) on the walking speed of enemy `e` (Kartograf, the «Awaria» rule: the misnamed walk 20% slower); read through heroes/quirks.ts `enemySpeedMul` by enemies/ai.ts. */
  enemySpeedMul?(s: RunState, e: Enemy): number;
  /** S20: while blows taken are held back (Pętlowiec, Opóźnienie), the racja they will still cost (0 while logging and nothing owed yet); null when nothing is held. Read through heroes/quirks.ts `racjaBracket` by ui/hud.ts, which brackets that part of the racja line. */
  racjaBracket?(s: RunState): number | null;
  /** S21: a shot of enemy `from` skimmed off the player (heroes/shield.ts projectileDamageMul < 1); read through heroes/quirks.ts `onSkim` by enemies/projectiles.ts (Nalesnik, Pory). */
  onSkim?(s: RunState, bus: Bus, from: number): void;
}

export interface HeroSounds {
  /** One sound per skill, by SkillIndex (audio/bindings.ts plays it on `skill:cast`). */
  skills: readonly [SfxName, SfxName, SfxName, SfxName, SfxName, ...SfxName[]];
  /** Played when the auto-attack starts. */
  autoStart?: SfxName;
  /** The ultimate's recipe (audio/bindings.ts plays it on `ultimate:cast`; it ends in the stamp's thud): one for a hero with one ultimate, or a name per ultimate id once it has three (S19, `ultimateSound`). */
  ultimate?: SfxName | Readonly<Record<string, SfxName>>;
}

/**
 * The pad glyphs (five, then one per further skill), by SkillIndex (ui/pads.ts draws them). Each is a list of path strings centred on 0,0 inside a
 * 52 x 52 box; a leading "~" draws that stroke dotted.
 */
export type HeroPadGlyphs = readonly [readonly string[], readonly string[], readonly string[], readonly string[], readonly string[], ...(readonly string[])[]];

/** One passive of the update form (progression/update.ts): its change to Mods, and the permission family it needs. */
export interface HeroPassive {
  mods: Partial<Mods>;
  requires?: Family;
  /** The hero's rule (passive 7): always on, outside the slots, so the update form never offers it. Its text is still `forms.update.passive.<id>.N`. */
  rule?: true;
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
  /** The passives the update form offers (`passive1..6`, a filled hero has up to ten; `rule` marks the one that is always on), text `forms.update.passive.<id>.N.{name,desc}`. */
  passives: readonly HeroPassive[];
  quirk?: HeroQuirk;
  /** The ultimates, by level (12 / 24 / 36); S3 builds the first (heroes/ultimate.ts casts it). Text `heroes.<id>.ult.<ultimate>.*`. */
  ultimates?: readonly UltimateDef[];
  /** Skill categories and the three specializations with their capstones (S4, heroes/specDefs.ts; read through heroes/specializations.ts). */
  specs?: HeroSpecs;
}
