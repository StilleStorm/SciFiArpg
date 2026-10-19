/** The drawing of the hero and its auto-attack animation. TODO: draw the figure (DESIGN 3, 10.2), pose the attack, drive its parts. */
import { clamp01, keyframes, LURCH, neutralPose, type HeroPose } from '../poseKit';
import type { FigureDef, HeroFigure } from '../figureKit';

/** About 64 world units tall, origin near the middle of the body; paths in figure units. TODO: replace this placeholder box. */
export const figureDef: FigureDef = {
  scale: 1.3,
  body: ['M-10-18H10V10H-10Z'],
  hatch: [],
  circles: [[0, -22, 5]],
  // two leg frames, each [left, right]
  legs: [
    ['M-5 10L-5 18', 'M5 10L5 18'],
    ['M-5 10L-3 18', 'M5 10L7 18'],
  ],
  // TODO: `parts` for whatever moves in the attack (arm, drum, head ...): see heroes/figureKit.ts PartName
};

/** The pose `t` ms into the auto-attack. TODO: keyframes of the parts; set draw/erase if the attack leaves an ink stroke. */
export function pose(t: number): HeroPose {
  const p = neutralPose();
  p.lurch = LURCH * keyframes(clamp01(t / 300), [[0, 0], [0.4, 1], [1, 0]]);
  return p;
}

export const figure: HeroFigure = {
  def: figureDef,
  // TODO: the stain under the figure (centre, radius, fixed seed) and its hue (render/wash.ts WashHue)
  wash: { cx: 0, cy: -4, r: 20, seed: 0x4900 },
  hue: 'indigo',
  attackMs: 300,
  pose,
  // TODO: `drive` (move the parts of the figure each frame), `build` (extra drawing), `patch` (per-frame, attacking or not), `stroke`
};
