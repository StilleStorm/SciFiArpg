/**
 * The shared kit of a hero figure (S1): the data shape of a drawing, the per-figure DOM state the render layer keeps
 * (`Parts`), and the contract a hero's `figure.ts` fills in (`HeroFigure`). Types and tiny helpers only; the engine that
 * builds and patches the `<g>` is render/heroFigures.ts.
 */
import type { AttackAnim } from '../render/attackFx';
import { n2 } from '../render/svg';
import type { WashHue } from '../render/wash';
import type { HeroId } from './registry';
import type { HeroPose } from './poseKit';

export interface FigureDef {
  scale: number;
  /** Strokes. */
  body: readonly string[];
  /** Hatched fills (no stroke). */
  hatch: readonly string[];
  /** Hatched circles [cx, cy, r]. */
  hatchCircles?: readonly (readonly [number, number, number])[];
  /** Circles [cx, cy, r]. */
  circles: readonly (readonly [number, number, number])[];
  /** Two leg frames, each [left, right]. */
  legs: readonly [readonly [string, string], readonly [string, string]];
  /** Dotted extras that stay dotted even on a solid figure. */
  echo?: readonly (readonly [number, number, number])[];
  /** Sub-groups that move in an attack (data-part); what they hold is left out of the lists above. */
  parts?: Partial<Record<PartName, PartDef>>;
}

export type PartName = 'arm' | 'ticket' | 'drum' | 'door' | 'instrument' | 'head' | 'cable' | 'disc' | 'pores' | 'pebble';
export interface PartDef {
  body?: readonly string[];
  /** Strokes that go into a nested group `data-tail` (the loose end of the Konsultant's cable, hidden while it lashes). */
  tail?: readonly string[];
  hatch?: readonly string[];
  hatchCircles?: readonly (readonly [number, number, number])[];
  circles?: readonly (readonly [number, number, number])[];
}


export interface Parts {
  inner: SVGGElement;
  /** The sub-groups that move in an attack, found once at creation. */
  named: Partial<Record<PartName, SVGGElement>>;
  /** Konsultant: the loose end of the cable (hidden while the lash is out). */
  tail: SVGGElement | null;
  /** Petlowiec: the ink "—!" next to the head, and its strokes (pathLength 1). */
  speech: SVGGElement | null;
  speechPaths: SVGPathElement[];
  /** Offsets of `inner` (leg bob, attack lurch) and the last transform written to each moving node. */
  bob: number;
  lx: number;
  ly: number;
  sig: Partial<Record<PartName | 'inner' | 'speech' | 'rim', string>>;
  /** Parts are away from their rest pose; the next frame without an attack puts them back. */
  posed: boolean;
  legs: SVGPathElement[];
  foam: SVGGElement | null;
  caption: SVGTextElement | null;
  /** The stain; it is counter-mirrored when the figure faces left, so it does not jump sideways on a turn. */
  wash: SVGGElement | null;
  heroId: HeroId;
  scale: number;
  /** Nalesnik: the rim stroke (thicker when rounded) and the state of the roll. */
  rim: SVGPathElement | null;
  pancake: { squash: number; roll: number; flip: number; lastMs: number; px: number | null; py: number | null };
}

/** A circle as a path for a pad glyph (heroes/<id>/pads.ts), numbers left as written. */
export const glyphCircle = (cx: number, cy: number, r: number): string => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
export const circlePath = (cx: number, cy: number, r: number): string => `M${n2(cx - r)} ${n2(cy)}a${n2(r)} ${n2(r)} 0 1 0 ${n2(2 * r)} 0a${n2(r)} ${n2(r)} 0 1 0 ${n2(-2 * r)} 0`;

export interface Walker {
  /** Where the figure stands (the Konsultant's lash starts at his hand, which moves with him). */
  x?: number;
  y?: number;
  moving: boolean;
  facing?: 1 | -1;
  shield?: number;
  suspended?: boolean;
  /** Nalesnik rounded up by its quirk. */
  round?: boolean;
}

export const hide = (node: SVGElement, off: boolean): void => {
  node.style.display = off ? 'none' : '';
};

/** `inner` carries the leg bob and the attack lurch in front of its scale. */
export function syncInner(p: Parts): void {
  const tf = `translate(${n2(p.lx)} ${n2(p.ly + p.bob)}) scale(${p.scale})`;
  if (p.sig.inner === tf) return;
  p.sig.inner = tf;
  p.inner.setAttribute('transform', tf);
}

/** Write a transform on a moving part only when it changed. An empty string puts the part back. */
export function setPart(p: Parts, name: PartName | 'speech', node: SVGElement | null | undefined, tf: string): void {
  if (!node || p.sig[name] === tf) return;
  p.sig[name] = tf;
  if (tf) node.setAttribute('transform', tf);
  else node.removeAttribute('transform');
}


/** What a hero's `drive` may call that lives in the render layer (injected, so a figure module imports no render code but svg). */
export interface DriveFx {
  driveLash(a: AttackAnim, pose: HeroPose, t: number, hand: { x: number; y: number }): void;
  driveLaser(a: AttackAnim, t: number): void;
  setStroke(node: Element, draw: number, erase: number): void;
}

/** One frame of an auto-attack, handed to a hero's `drive`: the figure's state, the pose, and the mirror of the target's side. */
export interface DriveCtx {
  e: Walker;
  p: Parts;
  pose: HeroPose;
  /** The attack record (target direction in world space) and ms since it began. */
  a: AttackAnim;
  t: number;
  /** The target's direction in the figure's own frame (mirrored when it faces left), and its sign. */
  lux: number;
  side: 1 | -1;
  fx: DriveFx;
}

/** Pieces `build` adds to the figure that the engine keeps in `Parts`. */
export interface BuildExtras {
  rim?: SVGPathElement;
  speech?: SVGGElement;
  speechPaths?: SVGPathElement[];
}

/** The drawing and the attack animation of one hero (the `figure.ts` of its folder). */
export interface HeroFigure {
  def: FigureDef;
  /** The stain under the figure: centre, radius (figure units) and its fixed seed. */
  wash: { cx: number; cy: number; r: number; seed: number };
  /** The hue of that stain (DESIGN 3.4). */
  hue: WashHue;
  /** Length of the auto-attack animation, ms. */
  attackMs: number;
  /** The player figure carries the foam-shield group. */
  foam?: boolean;
  /** Which ink stroke attackFx draws in the fx layer for this hero's attack. */
  stroke?: 'whip' | 'slap';
  /** The pose `t` ms into the auto-attack (pure; render/attackFx.ts re-exports it as `heroPose`). */
  pose(t: number): HeroPose;
  /** Extra drawing built into `inner` after the parts (the pancake's disc, the helmet's remark). */
  build?(inner: SVGGElement, named: Partial<Record<PartName, SVGGElement>>): BuildExtras;
  /** Move this hero's parts for one frame of a live attack. */
  drive?(c: DriveCtx): void;
  /** Called every frame, attacking or not (the pancake rolls). */
  patch?(e: Walker, p: Parts, timeMs: number): void;
}
