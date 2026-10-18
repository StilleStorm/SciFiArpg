/**
 * Sound recipes as data (DESIGN 14.3). A recipe is a list of layers; `sfx.ts` builds the nodes per call.
 *
 * Layer kinds
 *   noise  white noise through a bandpass (`bandpass` or `freq`, Q = `q`), optional lp/hp
 *   click  the same, but the envelope is clamped to a few ms: a pen snap, a key, a staple
 *   pluck  a Karplus-Strong string at `freq` that rings for `decay` seconds (60 dB)
 *   thump  a sine with a falling pitch, saturated so it has harmonics: the body of a hit
 *   sine   a telephone-band sine. The one raw tone allowed (hold beep); nothing else may use it.
 * `pitchDrop` moves the pitch or the filter centre: end = start * (1 - pitchDrop), negative rises.
 * `repeat` + `spread` turn a layer into a train of grains over `spread` seconds (scribbles, debris, dots).
 * `role` says what the layer is for; combat recipes must have a `body` (60-140 Hz thump or low pluck, 80-200 ms).
 */
import type { HeroId } from '../heroes';
import { TRIMS } from './levels';

export type LayerKind = 'noise' | 'click' | 'pluck' | 'thump' | 'sine';
export type LayerRole = 'transient' | 'body' | 'sub' | 'tail';

export interface Layer {
  kind: LayerKind;
  freq: number;
  bandpass?: number;
  q?: number;
  lp?: number;
  hp?: number;
  attack: number;
  decay: number;
  gain: number;
  pitchDrop?: number;
  delay?: number;
  repeat?: number;
  spread?: number;
  role?: LayerRole;
  /** Pluck excitation brightness (Hz). */
  bright?: number;
}

export interface Recipe {
  layers: Layer[];
  /** A weighted combat sound: needs a body layer. */
  combat?: boolean;
  /** Seconds before the same sound may play again (stops a swarm from becoming a buzz). */
  minGap?: number;
  /** Lower number is dropped first when too many voices play. */
  priority?: number;
  /** Level calibration: multiplies the whole recipe so its peak lands on the target of the sound (npm run render-audio). */
  trim?: number;
}

type L = Layer;

const click = (freq: number, gain: number, o: Partial<L> = {}): L => ({
  kind: 'click', freq, bandpass: freq, q: 0.9, attack: 0.0004, decay: 0.004, gain, role: 'transient', ...o,
});
const noise = (freq: number, decay: number, gain: number, o: Partial<L> = {}): L => ({
  kind: 'noise', freq, bandpass: freq, q: 1.2, attack: 0.002, decay, gain, role: 'transient', ...o,
});
const thump = (freq: number, decay: number, gain: number, o: Partial<L> = {}): L => ({
  kind: 'thump', freq, attack: 0.002, decay, gain, pitchDrop: 0.4, role: 'body', ...o,
});
const pluck = (freq: number, decay: number, gain: number, o: Partial<L> = {}): L => ({
  kind: 'pluck', freq, attack: 0.001, decay, gain, role: 'tail', ...o,
});
const sine = (freq: number, decay: number, gain: number, o: Partial<L> = {}): L => ({
  kind: 'sine', freq, bandpass: freq, q: 0.7, attack: 0.004, decay, gain, role: 'transient', ...o,
});

const combat = (layers: L[], minGap = 0.03, priority = 5): Recipe => ({ layers, combat: true, minGap, priority });
const light = (layers: L[], minGap = 0.05, priority = 2): Recipe => ({ layers, minGap, priority });

export const RECIPES = {
  // ---------- paper, forms, the document (A only; dry and light) ----------
  /** One typewriter key per footnote. */
  footnote: light([
    click(3900, 0.42),
    noise(1250, 0.03, 0.3, { q: 2, delay: 0.002 }),
    thump(170, 0.035, 0.22, { pitchDrop: 0.2, role: 'tail' }),
  ], 0.09, 1),
  /** A correction: the bell, then the carriage return. */
  correction: light([
    pluck(2093, 0.65, 0.3, { bright: 9000 }),
    noise(1500, 0.15, 0.3, { q: 2, pitchDrop: -1.2, delay: 0.12, attack: 0.004 }),
    click(2200, 0.35, { delay: 0.27 }),
  ], 0.3, 2),
  /** Rubber stamp: thud, rubber, a tiny paper slap. */
  stamp: light([
    thump(72, 0.13, 0.7, { pitchDrop: 0.35 }),
    noise(650, 0.05, 0.34, { q: 1 }),
    noise(5200, 0.03, 0.14, { q: 1.4, delay: 0.05, role: 'tail' }),
  ], 0.1, 3),
  paperSlide: light([noise(2600, 0.16, 0.2, { q: 0.8, attack: 0.045, pitchDrop: 0.45, role: 'tail' })], 0.1, 1),
  scratches3: light([
    noise(4300, 0.03, 0.26, { q: 2.2 }),
    noise(4700, 0.03, 0.24, { q: 2.2, delay: 0.055 }),
    noise(4100, 0.035, 0.26, { q: 2.2, delay: 0.115 }),
  ], 0.12, 1),
  /** A loot card sketched into the margin: a slide, then the three scratches. */
  cardDrawn: light([
    noise(2600, 0.16, 0.18, { q: 0.8, attack: 0.045, pitchDrop: 0.45, role: 'tail' }),
    noise(4300, 0.03, 0.24, { q: 2.2, delay: 0.09 }),
    noise(4700, 0.03, 0.22, { q: 2.2, delay: 0.145 }),
    noise(4100, 0.035, 0.24, { q: 2.2, delay: 0.205 }),
    thump(150, 0.05, 0.2, { delay: 0.2, pitchDrop: 0.2, role: 'tail' }),
  ], 0.08, 1),
  inventoryOpen: light([
    noise(2200, 0.18, 0.2, { q: 0.8, attack: 0.05, pitchDrop: 0.5, role: 'tail' }),
    thump(120, 0.05, 0.16, { delay: 0.14, pitchDrop: 0.2, role: 'tail' }),
  ], 0.15, 2),
  inventoryClose: light([
    noise(1500, 0.13, 0.18, { q: 0.8, attack: 0.03, pitchDrop: -0.6, role: 'tail' }),
    thump(120, 0.04, 0.14, { delay: 0.1, pitchDrop: 0.2, role: 'tail' }),
  ], 0.15, 2),
  /** A sheet lifted and laid down: two noise sweeps, about 400 ms. */
  pageTurn: light([
    noise(600, 0.2, 0.9, { q: 0.9, attack: 0.08, pitchDrop: -3, role: 'tail' }),
    noise(2800, 0.2, 0.9, { q: 0.9, attack: 0.02, pitchDrop: 0.8, delay: 0.2, role: 'tail' }),
    thump(88, 0.07, 0.3, { delay: 0.37, pitchDrop: 0.25 }),
  ], 0.5, 3),
  /** The paper ends: a dull bump. */
  pageEdge: light([
    noise(450, 0.1, 0.4, { q: 0.7, attack: 0.004 }),
    thump(95, 0.08, 0.5, { pitchDrop: 0.3 }),
  ], 0.4, 2),
  /** Bot hours: the one telephone-band sine. */
  holdBeep: light([sine(1040, 0.2, 0.2)], 1, 3),
  /** The line is picked up by a bot: two clicks and the beep. */
  botOn: light([
    click(1800, 0.4),
    click(1300, 0.3, { delay: 0.05 }),
    sine(1040, 0.16, 0.2, { delay: 0.14 }),
    thump(110, 0.06, 0.3, { role: 'tail' }),
  ], 1, 3),
  /** The consultant is back. */
  consultantOn: light([
    click(2600, 0.4),
    pluck(1760, 0.3, 0.18, { delay: 0.03, bright: 6000 }),
    thump(110, 0.06, 0.3, { role: 'tail' }),
  ], 1, 3),
  /** Time begins to run backwards: a tape flipped over. */
  reverseStart: light([
    noise(2600, 0.5, 0.3, { q: 1.4, attack: 0.03, pitchDrop: 0.85 }),
    { ...click(3200, 0.3, { delay: 0, decay: 0.006 }), repeat: 18, spread: 0.45 },
    thump(70, 0.16, 0.5, { delay: 0.45 }),
  ], 2, 3),
  crumple: light([
    { ...noise(3000, 0.012, 0.28, { q: 0.9 }), repeat: 12, spread: 0.2 },
    thump(140, 0.05, 0.2, { role: 'tail' }),
  ], 0.5, 1),
  pickup: light([
    noise(2800, 0.07, 0.3, { q: 1, attack: 0.01 }),
    click(4200, 0.3, { delay: 0.05 }),
    thump(140, 0.06, 0.34, { pitchDrop: 0.25 }),
  ], 0.08, 3),
  strikeThrough: light([
    noise(4200, 0.05, 0.3, { q: 1.6 }),
    noise(4600, 0.05, 0.28, { q: 1.6, delay: 0.065 }),
  ], 0.1, 1),

  // ---------- combat: transient + body + tail ----------
  hit: combat([
    click(4800, 0.55),
    noise(3600, 0.045, 0.5, { q: 1.4, pitchDrop: 0.35 }),
    thump(108, 0.14, 0.95, { pitchDrop: 0.42 }),
    { ...noise(2400, 0.014, 0.17, { q: 0.8, delay: 0.03, role: 'tail' }), repeat: 6, spread: 0.12 },
  ], 0.03, 5),
  crit: combat([
    click(4400, 0.6),
    noise(3300, 0.09, 0.55, { q: 1.2, pitchDrop: 0.5 }),
    thump(102, 0.18, 1.0, { pitchDrop: 0.45 }),
    thump(50, 0.26, 0.75, { delay: 0.004, pitchDrop: 0.15, role: 'sub' }),
    thump(240, 0.07, 0.4, { delay: 0.035, pitchDrop: 0.55, role: 'transient' }),
    { ...click(3000, 0.32, { delay: 0.06, decay: 0.008, role: 'tail' }), repeat: 8, spread: 0.28 },
  ], 0.05, 6),
  kill: combat([
    click(4200, 0.55),
    noise(3200, 0.06, 0.55, { q: 1.2, pitchDrop: 0.4 }),
    thump(96, 0.13, 1.0, { pitchDrop: 0.4 }),
    thump(52, 0.1, 0.55, { delay: 0.004, pitchDrop: 0.1, role: 'sub' }),
    click(3600, 0.6, { delay: 0.12 }),
    noise(2800, 0.08, 0.6, { q: 1.2, pitchDrop: 0.5, delay: 0.12 }),
    thump(76, 0.18, 1.0, { delay: 0.12, pitchDrop: 0.4 }),
    thump(48, 0.25, 0.6, { delay: 0.125, pitchDrop: 0.1, role: 'sub' }),
    { ...noise(5200, 0.016, 0.24, { q: 2.5, delay: 0.24, role: 'tail' }), repeat: 16, spread: 0.38 },
  ], 0.06, 7),
  /** A paper tear with a low body. */
  playerHurt: combat([
    click(2600, 0.5),
    noise(1700, 0.2, 0.36, { q: 0.7, attack: 0.01 }),
    { ...noise(2900, 0.014, 0.28, { q: 0.7, role: 'tail' }), repeat: 18, spread: 0.22 },
    thump(80, 0.17, 0.95, { pitchDrop: 0.35 }),
    noise(180, 0.22, 0.28, { q: 1, role: 'tail' }),
  ], 0.1, 8),
  /** The same tear with a faint hiss bed (racja is low). */
  playerHurtLow: combat([
    click(2600, 0.5),
    noise(1700, 0.2, 0.36, { q: 0.7, attack: 0.01 }),
    { ...noise(2900, 0.014, 0.28, { q: 0.7, role: 'tail' }), repeat: 18, spread: 0.22 },
    thump(80, 0.17, 0.95, { pitchDrop: 0.35 }),
    noise(180, 0.22, 0.28, { q: 1, role: 'tail' }),
    noise(7000, 0.75, 0.07, { q: 0.5, attack: 0.06, delay: 0.05, role: 'tail' }),
  ], 0.1, 8),
  bossPhase: combat([
    click(2800, 0.7),
    noise(1800, 0.05, 0.5, { q: 1.4 }),
    noise(900, 0.03, 0.3, { q: 1, delay: 0.07 }),
    thump(80, 0.2, 1.0, { pitchDrop: 0.2 }),
    thump(45, 0.4, 0.4, { delay: 0.01, pitchDrop: 0.1, role: 'sub' }),
    noise(900, 0.3, 0.12, { q: 1, delay: 0.06, role: 'tail' }),
  ], 0.5, 9),
  /** A notification climbed a tier: a stamp and a dry pluck. */
  escalate: combat([
    thump(85, 0.11, 0.7),
    noise(600, 0.04, 0.3, { q: 1 }),
    pluck(1480, 0.08, 0.3, { delay: 0.02, bright: 7000 }),
  ], 0.15, 4),

  // ---------- hero skills (five each; the first three in DESIGN 14.3, the fourth and fifth of DESIGN 10.1) ----------
  /** Pralka: drum spin. */
  pralkaSpin: combat([
    click(3000, 0.4),
    thump(95, 0.09, 0.8),
    thump(92, 0.09, 0.7, { delay: 0.06 }),
    thump(90, 0.09, 0.6, { delay: 0.12 }),
    thump(88, 0.12, 0.55, { delay: 0.18 }),
    noise(500, 0.4, 0.3, { q: 1.2, attack: 0.05, pitchDrop: -1.2, role: 'tail' }),
  ], 0.2, 7),
  /** Pralka: foam hiss. */
  pralkaFoam: combat([
    click(2400, 0.3),
    thump(78, 0.16, 0.8, { pitchDrop: 0.3 }),
    noise(5500, 0.55, 0.28, { q: 0.5, attack: 0.06, role: 'tail' }),
    { ...click(1800, 0.22, { decay: 0.014, role: 'tail' }), repeat: 10, spread: 0.4, delay: 0.05 },
  ], 0.2, 7),
  /** Pralka: a dragged box. */
  pralkaDrag: combat([
    click(1800, 0.4),
    thump(62, 0.2, 0.95, { pitchDrop: 0.2 }),
    noise(260, 0.32, 0.5, { q: 1.2, attack: 0.01, pitchDrop: 0.5, role: 'tail' }),
    thump(110, 0.05, 0.35, { delay: 0.08, role: 'tail' }),
    thump(105, 0.05, 0.3, { delay: 0.16, role: 'tail' }),
    noise(900, 0.28, 0.2, { q: 1, delay: 0.04, role: 'tail' }),
  ], 0.2, 7),
  /** Pralka: Otwarcie bębna, a latch click, a hollow thump from the drum, wet laundry sloshing out. */
  pralkaDrum: combat([
    click(2800, 0.5),
    click(1900, 0.4, { delay: 0.03 }),
    thump(84, 0.16, 0.9, { delay: 0.03, pitchDrop: 0.3 }),
    noise(320, 0.12, 0.35, { q: 5, delay: 0.03, role: 'tail' }),
    noise(700, 0.45, 0.3, { q: 0.8, attack: 0.07, pitchDrop: 0.6, delay: 0.08, role: 'tail' }),
    { ...click(1500, 0.22, { q: 2, decay: 0.012, role: 'tail' }), repeat: 9, spread: 0.45, delay: 0.14 },
  ], 0.25, 7),
  /** Pralka: Wniosek o osobowość, the form stamped, a short paper slide, a pencil section sign. */
  pralkaPersona: combat([
    click(3000, 0.4),
    thump(72, 0.13, 0.85, { pitchDrop: 0.35 }),
    noise(650, 0.05, 0.34, { q: 1 }),
    noise(2600, 0.2, 0.22, { q: 0.8, attack: 0.05, pitchDrop: 0.45, delay: 0.1, role: 'tail' }),
    noise(4300, 0.03, 0.22, { q: 2.2, delay: 0.3, role: 'tail' }),
    noise(4600, 0.03, 0.2, { q: 2.2, delay: 0.35, role: 'tail' }),
  ], 0.25, 7),
  /** Konsultant: a hold-beep stab. */
  konsBeep: combat([
    click(2200, 0.4),
    thump(100, 0.11, 0.85),
    sine(1040, 0.08, 0.2),
    sine(1040, 0.08, 0.2, { delay: 0.1 }),
  ], 0.2, 7),
  /** Konsultant: a redirect zip. */
  konsRedirect: combat([
    thump(92, 0.12, 0.85),
    noise(700, 0.17, 0.45, { q: 1.5, attack: 0.005, pitchDrop: -4 }),
    { ...click(3000, 0.2, { decay: 0.006, role: 'tail' }), repeat: 8, spread: 0.2, delay: 0.04 },
  ], 0.2, 7),
  /** Konsultant: a headset click. */
  konsHeadset: combat([
    click(2600, 0.6),
    click(2300, 0.5, { delay: 0.045 }),
    pluck(120, 0.12, 0.9, { role: 'body', bright: 700 }),
    thump(100, 0.1, 0.5, { delay: 0.045 }),
    noise(1400, 0.1, 0.18, { q: 1, delay: 0.05, role: 'tail' }),
  ], 0.2, 7),
  /** Konsultant: Numer sprawy, two handset key chirps, then the case dropped into a drawer. */
  konsCase: combat([
    click(2400, 0.4),
    pluck(1650, 0.07, 0.3, { delay: 0.005, bright: 7000 }),
    pluck(2090, 0.07, 0.28, { delay: 0.08, bright: 7000 }),
    thump(78, 0.15, 0.95, { delay: 0.17, pitchDrop: 0.3 }),
    noise(500, 0.06, 0.35, { q: 1, delay: 0.17 }),
    noise(2400, 0.16, 0.2, { q: 0.8, attack: 0.03, pitchDrop: 0.4, delay: 0.2, role: 'tail' }),
  ], 0.2, 7),
  /** Konsultant: Rozłączenie, a short tone cut dead, the receiver dropped and bouncing once. */
  konsHangup: combat([
    pluck(1040, 0.09, 0.3, { bright: 4000, role: 'transient' }),
    click(3200, 0.6, { delay: 0.1 }),
    thump(110, 0.12, 0.9, { delay: 0.12, pitchDrop: 0.2 }),
    { ...noise(1800, 0.012, 0.28, { q: 3, role: 'tail' }), repeat: 6, spread: 0.16, delay: 0.12 },
    thump(130, 0.05, 0.3, { delay: 0.26, role: 'tail' }),
    click(2200, 0.3, { delay: 0.26 }),
  ], 0.2, 7),
  /** Petlowiec: two overlapping remarks. */
  petlRemarks: combat([
    click(2400, 0.3),
    thump(85, 0.14, 0.8),
    noise(520, 0.09, 0.32, { q: 5, attack: 0.012, role: 'tail' }),
    noise(880, 0.09, 0.3, { q: 5, attack: 0.012, delay: 0.1, role: 'tail' }),
    noise(640, 0.1, 0.3, { q: 5, attack: 0.012, delay: 0.19, role: 'tail' }),
    noise(640, 0.09, 0.22, { q: 5, attack: 0.012, delay: 0.05, role: 'tail' }),
    noise(1100, 0.09, 0.22, { q: 5, attack: 0.012, delay: 0.14, role: 'tail' }),
    noise(760, 0.1, 0.22, { q: 5, attack: 0.012, delay: 0.24, role: 'tail' }),
  ], 0.2, 7),
  /** Petlowiec: a tape splice. */
  petlSplice: combat([
    click(3000, 0.7),
    noise(1500, 0.02, 0.4, { q: 1.5 }),
    thump(90, 0.14, 0.85, { delay: 0.045 }),
    noise(2400, 0.12, 0.3, { q: 1.2, pitchDrop: 0.7, delay: 0.045, role: 'tail' }),
    click(2000, 0.35, { delay: 0.17 }),
  ], 0.2, 7),
  /** Petlowiec: a loop rewind. */
  petlRewind: combat([
    noise(3200, 0.4, 0.4, { q: 2, attack: 0.01, pitchDrop: 0.9 }),
    { ...click(2800, 0.3, { decay: 0.006, role: 'tail' }), repeat: 22, spread: 0.36 },
    thump(70, 0.18, 1.0, { delay: 0.32, pitchDrop: 0.3 }),
    thump(48, 0.25, 0.55, { delay: 0.325, pitchDrop: 0.1, role: 'sub' }),
  ], 0.25, 7),
  /** Petlowiec: Już to było, a tape rewind grain climbing, a splice click, the same thump said twice. */
  petlDejaVu: combat([
    noise(1400, 0.3, 0.35, { q: 2, attack: 0.01, pitchDrop: -1.4 }),
    { ...click(3600, 0.3, { decay: 0.006, role: 'tail' }), repeat: 16, spread: 0.28 },
    click(2200, 0.6, { delay: 0.3 }),
    noise(1500, 0.02, 0.35, { q: 1.5, delay: 0.3 }),
    thump(88, 0.14, 0.9, { delay: 0.32 }),
    thump(88, 0.1, 0.45, { delay: 0.45, role: 'tail' }),
    noise(2400, 0.1, 0.22, { q: 1.2, pitchDrop: 0.7, delay: 0.45, role: 'tail' }),
  ], 0.25, 7),
  /** Petlowiec: Odłożony start, a timer ticking faster, then a soft landing. */
  petlLaunch: combat([
    { ...click(2600, 0.3, { q: 2, decay: 0.006 }), repeat: 5, spread: 0.4 },
    { ...click(2900, 0.32, { q: 2, decay: 0.006 }), repeat: 6, spread: 0.18, delay: 0.42 },
    thump(66, 0.19, 0.95, { delay: 0.64, attack: 0.012, pitchDrop: 0.2 }),
    thump(46, 0.3, 0.5, { delay: 0.645, attack: 0.012, pitchDrop: 0.1, role: 'sub' }),
    noise(300, 0.2, 0.3, { q: 1, delay: 0.64, role: 'tail' }),
    { ...noise(2000, 0.012, 0.2, { q: 0.8, role: 'tail' }), repeat: 6, spread: 0.15, delay: 0.68 },
  ], 0.3, 7),
  /** Kartograf: theodolite click-shot. */
  kartoClick: combat([
    click(3200, 0.7),
    click(2100, 0.5, { delay: 0.035 }),
    noise(5200, 0.08, 0.3, { q: 1.2, delay: 0.035 }),
    thump(100, 0.12, 0.9, { delay: 0.035 }),
    pluck(1800, 0.25, 0.14, { delay: 0.04, bright: 8000 }),
  ], 0.2, 7),
  /** Kartograf: dashed area hum. */
  kartoHum: combat([
    click(2400, 0.35),
    thump(70, 0.16, 0.8, { pitchDrop: 0.25 }),
    noise(120, 0.1, 0.55, { q: 4, attack: 0.012, role: 'body' }),
    noise(120, 0.1, 0.5, { q: 4, attack: 0.012, delay: 0.14, role: 'body' }),
    noise(120, 0.1, 0.45, { q: 4, attack: 0.012, delay: 0.28, role: 'body' }),
    noise(380, 0.1, 0.2, { q: 5, attack: 0.012, delay: 0.0, role: 'tail' }),
    noise(380, 0.1, 0.18, { q: 5, attack: 0.012, delay: 0.14, role: 'tail' }),
    noise(380, 0.1, 0.16, { q: 5, attack: 0.012, delay: 0.28, role: 'tail' }),
  ], 0.25, 7),
  /** Kartograf: a pin pulled. */
  kartoPin: combat([
    click(3000, 0.5),
    pluck(2600, 0.2, 0.22, { delay: 0.005, bright: 9000 }),
    noise(3800, 0.07, 0.4, { q: 1.2, pitchDrop: 0.5, delay: 0.01 }),
    thump(110, 0.1, 0.85, { delay: 0.03 }),
  ], 0.2, 7),

  /** Kartograf: Skala 1:1, a ruler snap, then a long steady filtered hiss of the survey line. */
  kartoScale: combat([
    click(3400, 0.7),
    click(1800, 0.45, { delay: 0.012 }),
    thump(100, 0.12, 0.9, { delay: 0.012 }),
    noise(2800, 0.6, 0.3, { q: 8, attack: 0.03, delay: 0.03, role: 'tail' }),
    noise(5400, 0.5, 0.12, { q: 6, attack: 0.05, delay: 0.05, role: 'tail' }),
    { ...click(3000, 0.22, { decay: 0.006, role: 'tail' }), repeat: 20, spread: 0.5, delay: 0.06 },
  ], 0.3, 7),
  /** Kartograf: Legenda, a pencil scribble filling in the legend, then the pin. */
  kartoLegend: combat([
    click(2000, 0.35),
    { ...noise(4300, 0.014, 0.3, { q: 2.2, role: 'tail' }), repeat: 14, spread: 0.4, delay: 0.03 },
    click(3000, 0.5, { delay: 0.44 }),
    pluck(2600, 0.2, 0.22, { delay: 0.445, bright: 9000 }),
    thump(108, 0.1, 0.85, { delay: 0.45 }),
    noise(3800, 0.07, 0.35, { q: 1.2, pitchDrop: 0.5, delay: 0.45, role: 'tail' }),
  ], 0.25, 7),
  /** Nalesnik: the auto-attack, the disc slapped down on the other side. */
  nalesSlap: combat([
    click(2600, 0.5),
    noise(1500, 0.05, 0.5, { q: 1.1 }),
    thump(96, 0.12, 0.9, { pitchDrop: 0.3 }),
    noise(3800, 0.05, 0.3, { q: 1.2, delay: 0.03, role: 'tail' }),
  ], 0.1, 5),
  /** Nalesnik: Orbita, a rolling rumble with body, a few revolutions going by. */
  nalesOrbita: combat([
    click(1900, 0.4),
    thump(88, 0.14, 0.85),
    noise(100, 0.55, 0.7, { q: 2.2, attack: 0.04, role: 'body' }),
    { ...thump(74, 0.09, 0.5, { pitchDrop: 0.15, delay: 0.06 }), repeat: 7, spread: 0.42 },
    noise(1100, 0.45, 0.18, { q: 0.8, attack: 0.08, role: 'tail' }),
  ], 0.25, 7),
  /** Nalesnik: Grawitacja, a slow noise swell falling inward and landing on a sub thud. */
  nalesGravity: combat([
    click(1200, 0.3),
    noise(2400, 0.9, 0.35, { q: 0.8, attack: 0.6, pitchDrop: 0.8, role: 'tail' }),
    noise(110, 0.9, 0.5, { q: 3, attack: 0.6, role: 'body' }),
    thump(62, 0.2, 0.95, { delay: 0.72, pitchDrop: 0.2 }),
    thump(46, 0.4, 0.6, { delay: 0.72, pitchDrop: 0.1, role: 'sub' }),
  ], 0.3, 7),
  /** Nalesnik: Wniosek o status, a flag planted with a thud, paper fluttering after it. */
  nalesFlag: combat([
    click(2200, 0.5),
    thump(92, 0.16, 1.0, { pitchDrop: 0.3 }),
    thump(52, 0.2, 0.6, { delay: 0.004, pitchDrop: 0.1, role: 'sub' }),
    noise(1800, 0.25, 0.3, { q: 0.7, attack: 0.04, delay: 0.05, role: 'tail' }),
    { ...noise(3600, 0.012, 0.3, { q: 1.2, role: 'tail' }), repeat: 14, spread: 0.3, delay: 0.06 },
  ], 0.25, 7),

  /** Nalesnik: Pływy, a slow water swell with a low body, the ring runs out, the water draws back. */
  nalesTide: combat([
    click(1400, 0.3),
    noise(500, 0.45, 0.35, { q: 0.7, attack: 0.3, pitchDrop: -1, role: 'tail' }),
    noise(110, 0.6, 0.45, { q: 3, attack: 0.3, role: 'body' }),
    thump(70, 0.18, 0.95, { delay: 0.32, pitchDrop: 0.25 }),
    noise(1400, 0.4, 0.28, { q: 0.8, attack: 0.02, pitchDrop: 0.6, delay: 0.38, role: 'tail' }),
    { ...click(1700, 0.2, { q: 2, decay: 0.012, role: 'tail' }), repeat: 8, spread: 0.3, delay: 0.4 },
  ], 0.3, 7),
  /** Nalesnik: Księżyc, a low pluck with a long ring, a faint high click. */
  nalesMoon: combat([
    click(5200, 0.2),
    pluck(90, 0.2, 0.9, { role: 'body', bright: 600 }),
    thump(78, 0.12, 0.6, { pitchDrop: 0.2 }),
    pluck(180, 0.9, 0.35, { delay: 0.005, bright: 900, role: 'tail' }),
    pluck(270, 0.6, 0.15, { delay: 0.01, bright: 1200, role: 'tail' }),
  ], 0.3, 7),

  // ---------- flavours: laid over hit / crit / kill by the enemy family ----------
  /** Devices clank: inharmonic metal. */
  flavDevice: light([
    noise(1150, 0.12, 0.3, { q: 14, role: 'tail' }),
    noise(1750, 0.09, 0.22, { q: 16, delay: 0.004, role: 'tail' }),
    noise(2630, 0.07, 0.16, { q: 18, delay: 0.008, role: 'tail' }),
    click(5200, 0.25),
  ], 0.04, 4),
  /** Notifications ping, dry and damped: never a chat-app bell. */
  flavNotice: light([
    pluck(1480, 0.075, 0.38, { bright: 7500 }),
    pluck(2210, 0.05, 0.16, { delay: 0.012, bright: 7500 }),
  ], 0.04, 4),
  /** Generated beasts: dotted lines, granular ticks. */
  flavBeast: light([
    { ...click(3400, 0.34, { q: 3, decay: 0.006, role: 'tail' }), repeat: 10, spread: 0.13 },
    { ...click(1300, 0.2, { q: 3, decay: 0.008, role: 'tail' }), repeat: 5, spread: 0.1, delay: 0.02 },
  ], 0.04, 4),
} satisfies Record<string, Recipe>;

// Level calibration (levels.ts) is applied here so the recipes above stay readable.
for (const [name, trim] of Object.entries(TRIMS)) {
  const r = (RECIPES as Record<string, Recipe>)[name];
  if (r) r.trim = trim;
}

export type SfxName = keyof typeof RECIPES;
export const SFX_NAMES = Object.keys(RECIPES) as SfxName[];

/** One sound per skill, indexed by SkillIndex (DESIGN 10.1); five distinct combat recipes per hero. */
export const HERO_SKILL_SOUNDS: Record<HeroId, readonly [SfxName, SfxName, SfxName, SfxName, SfxName]> = {
  pralka: ['pralkaSpin', 'pralkaFoam', 'pralkaDrag', 'pralkaDrum', 'pralkaPersona'],
  konsultant: ['konsBeep', 'konsRedirect', 'konsHeadset', 'konsCase', 'konsHangup'],
  petlowiec: ['petlRemarks', 'petlSplice', 'petlRewind', 'petlDejaVu', 'petlLaunch'],
  kartograf: ['kartoClick', 'kartoHum', 'kartoPin', 'kartoScale', 'kartoLegend'],
  nalesnik: ['nalesOrbita', 'nalesGravity', 'nalesFlag', 'nalesTide', 'nalesMoon'],
};

export const FAMILY_FLAVOUR = {
  urzadzenia: 'flavDevice',
  powiadomienia: 'flavNotice',
  wygenerowane: 'flavBeast',
} as const satisfies Record<string, SfxName>;

/** Total length of a recipe in seconds. */
export function recipeLength(r: Recipe): number {
  let end = 0;
  for (const l of r.layers) {
    const grains = l.repeat ? (l.spread ?? 0) : 0;
    end = Math.max(end, (l.delay ?? 0) + grains + l.attack + l.decay);
  }
  return end;
}

/** The layers that make the body: a thump or a low pluck between 60 and 140 Hz that lasts 80-200 ms. */
export function bodyLayers(r: Recipe): Layer[] {
  return r.layers.filter(
    (l) =>
      l.role === 'body' &&
      ((l.kind === 'thump' || l.kind === 'pluck') && l.freq >= 60 && l.freq <= 140 && l.decay >= 0.08 && l.decay <= 0.2 ||
        (l.kind === 'noise' && l.freq >= 60 && l.freq <= 140)),
  );
}

/** Problems with a recipe, as text; empty when it follows DESIGN 14. */
export function validateRecipe(name: string, r: Recipe): string[] {
  const bad: string[] = [];
  if (r.layers.length === 0) bad.push(`${name}: no layers`);
  if (r.combat) {
    if (bodyLayers(r).length === 0) bad.push(`${name}: combat sound without a body layer`);
    if (!r.layers.some((l) => l.role === 'transient')) bad.push(`${name}: no transient`);
  }
  for (const l of r.layers) {
    if (l.kind === 'sine' && name !== 'holdBeep' && name !== 'konsBeep' && name !== 'botOn') bad.push(`${name}: raw sine outside the hold beep`);
    if (!(l.decay > 0) || l.attack < 0 || l.gain <= 0 || l.gain > 1.2) bad.push(`${name}: bad envelope or gain`);
    if (l.kind === 'sine' && (l.freq < 300 || l.freq > 3400)) bad.push(`${name}: sine outside the telephone band`);
  }
  return bad;
}
