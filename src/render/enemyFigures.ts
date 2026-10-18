/**
 * The enemy builder: assembles the drawn parts of an enemy (enemies/assemble.ts) into one `<g>`, with legs that
 * swap by phase, a hand-drawn claim bubble above the head, status markers, the existence flicker of the
 * Wygenerowane, elite and boss captions, the captcha grid and the outline of Hipoteza.
 * `enemyBuilder` is the Builder for kind 'enemy'; `bindEnemyFx` turns enemy events into marks on the page.
 */
import { createRng } from '../core/rng';
import type { Bus } from '../core/events';
import type { Enemy } from '../entities/types';
import { ENEMY_SCALE, assemble, assembleBoss, layoutAssembly, type Assembly, type Layout } from '../enemies/assemble';
import { CONFIRM_R, GRID_CELL, GRID_NEED_S, CONFIRM_NEED_S, gridCellCenter } from '../enemies/bosses';
import { BOSS_OF, ELITE_SCALE, eliteWord } from '../enemies/families';
import { box, circ, hatchRect, type Art, type PartText } from '../enemies/partsBase';
import { rtOf } from '../enemies/runtime';
import { t } from '../i18n';
import { bubbleShown } from './bubbleFocus';
import { viewZoom } from './camera';
import { drawIn, marginNote, stamp } from './ink';
import { syncStatusMarkers } from './statusMarkers';
import { el, n2, wobblyCircle } from './svg';
import { easeOut, tween } from './tween';
import type { Builder } from './view';
import { FAMILY_HUE, washGroup } from './wash';

const LEG_PERIOD_MS = 150;
const SPIN_S = 0.55;
const INK_FILL = 'fill: var(--ink); stroke: none';

interface FigState {
  asm: Assembly;
  layout: Layout;
  sc: number;
  top: number;
  /** The bubble sits above this y (above the captcha grid for Weryfikacja). */
  bubbleTop: number;
  feet: number;
  hw: number;
  fig: SVGGElement;
  under: SVGGElement;
  over: SVGGElement;
  bubble: SVGGElement;
  markers: SVGGElement;
  legPaths: SVGPathElement[];
  claimSig: string;
  /** The bubble is on the paper (class bubble-off hides it with opacity 0). */
  bubbleOn: boolean;
  /** The zoom transform the bubble carries (see bubbleTransform). */
  bubbleTf: string;
  phase: number;
  flip: number;
  spinning: boolean;
  dashSig: string;
  opacitySig: string;
  progressSig: string;
  hiddenLeg: boolean;
}

const states = new WeakMap<SVGGElement, FigState>();

function assemblyOf(e: Enemy): Assembly {
  return e.boss ? assembleBoss(BOSS_OF[e.family], e.seed) : assemble(e.seed, e.family, e.tier);
}

// ---------- parts to DOM ----------

function addArt(parent: SVGGElement, art: Art): void {
  if (art.hatch) parent.append(el('path', { d: art.hatch, fill: 'url(#hatch)', stroke: 'none' }));
  if (art.line) parent.append(el('path', { d: art.line }));
  if (art.thin) parent.append(el('path', { d: art.thin, 'stroke-width': 0.9 }));
  if (art.ink) parent.append(el('path', { d: art.ink, style: INK_FILL }));
}

const FONT: Record<PartText['font'], string> = {
  mono: "font-family: var(--mono); font-weight: 400",
  monoBold: "font-family: var(--mono); font-weight: 700",
  serif: "font-family: var(--serif); font-style: italic",
  title: "font-family: var(--title)",
};

function addText(parent: SVGGElement, p: PartText): void {
  const text = p.key !== undefined ? t(p.key) : (p.literal ?? '');
  const node = el('text', { x: n2(p.x), y: n2(p.y), 'font-size': n2(p.size), 'text-anchor': 'middle', style: `${FONT[p.font]}; fill: var(--ink); stroke: none` }, [text]);
  node.dataset['x'] = n2(p.x);
  node.dataset['rot'] = `rotate(${p.rot ?? 0} ${n2(p.x)} ${n2(p.y)})`;
  if (p.rot) node.setAttribute('transform', node.dataset['rot']);
  parent.append(node);
}

// ---------- the claim bubble ----------

/** Break a claim into lines of at most `max` characters, at spaces. */
export function wrapClaim(text: string, max = 15): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > max) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Bubble type: 16 units of italic Garamond, 17 units per line; readable at 1 unit = 1 css px (portrait on a phone). */
const BUBBLE_FONT = 16;
const BUBBLE_LINE = 17;
const CHAR_W = 7;

function bubbleBox(lines: string[]): { w: number; h: number } {
  return { w: Math.max(...lines.map((l) => l.length), 4) * CHAR_W + 16, h: lines.length * BUBBLE_LINE + 9 };
}

/**
 * The bubble is an annotation, so it keeps its css px size when the camera zooms out (landscape shows 520 units
 * tall, which would shrink 16 units to 12 px): it is scaled up about its tail by 1 / zoom, never below 1.
 */
function bubbleTransform(top: number): string {
  const k = Math.min(1.6, Math.max(1, 1 / viewZoom()));
  return k === 1 ? '' : `translate(0 ${n2(top)}) scale(${n2(k)}) translate(0 ${n2(-top)})`;
}

function buildBubble(e: Enemy, top: number): SVGGElement {
  const g = el('g', { class: 'bubble' });
  if (!e.claim) return g;
  const lines = wrapClaim(t(e.claim.textKey));
  const { w, h } = bubbleBox(lines);
  const rng = createRng(e.seed ^ 0xb0b).fork(e.claim.textKey);
  const j = (): number => rng.range(-0.9, 0.9);
  const yb = top - 10;
  const yt = yb - h;
  const x0 = -w / 2;
  const x1 = w / 2;
  const r = 5;
  const tl = -4;
  const tr = 3;
  const d =
    `M${n2(x0 + r)} ${n2(yt + j())}L${n2(x1 - r)} ${n2(yt + j())}Q${n2(x1 + j())} ${n2(yt)} ${n2(x1)} ${n2(yt + r)}` +
    `L${n2(x1 + j())} ${n2(yb - r)}Q${n2(x1)} ${n2(yb)} ${n2(x1 - r)} ${n2(yb + j() * 0.5)}` +
    `L${tr} ${n2(yb)}L${n2(1.5 + j())} ${n2(yb + 8)}L${tl} ${n2(yb)}` +
    `L${n2(x0 + r)} ${n2(yb + j() * 0.5)}Q${n2(x0)} ${n2(yb)} ${n2(x0)} ${n2(yb - r)}L${n2(x0 + j())} ${n2(yt + r)}Q${n2(x0)} ${n2(yt)} ${n2(x0 + r)} ${n2(yt)}Z`;
  // the bubble is a patch of clean paper: another figure's strokes never cross the words
  g.append(el('path', { d, 'stroke-width': 1.3, fill: 'var(--paper)' }));
  lines.forEach((line, i) => {
    const text = el(
      'text',
      {
        x: 0,
        y: n2(yt + BUBBLE_LINE - 0.5 + i * BUBBLE_LINE),
        'text-anchor': 'middle',
        'font-size': BUBBLE_FONT,
        style: 'font-family: var(--serif); font-style: italic; fill: var(--ink); stroke: var(--paper); stroke-width: 3; stroke-linejoin: round; paint-order: stroke',
      },
      [line],
    );
    g.append(text);
  });
  g.dataset['box'] = `${n2(x0)} ${n2(yt)} ${n2(w)} ${n2(h)}`;
  const tf = bubbleTransform(top);
  if (tf) g.setAttribute('transform', tf);
  return g;
}

/** Strike the bubble through, with a red stroke that draws itself. */
function strikeBubble(bubble: SVGGElement, animate: boolean): void {
  const [x0 = 0, yt = 0, w = 0, h = 0] = (bubble.dataset['box'] ?? '').split(' ').map(Number);
  if (w === 0) return;
  const y = yt + h * 0.5;
  const d = `M${n2(x0 - 3)} ${n2(y + 3)}L${n2(x0 + w + 3)} ${n2(y - 3)}`;
  const line = el('path', { d, class: 'strike' });
  line.style.stroke = 'var(--accent)';
  line.style.strokeWidth = '2.1';
  bubble.append(line);
  if (!animate) return;
  const len = line.getTotalLength();
  line.style.strokeDasharray = String(len);
  line.style.strokeDashoffset = String(len);
  tween(160, (p) => (line.style.strokeDashoffset = String(len * (1 - p))), { ease: easeOut });
}

/**
 * Keep the speaking figures above the silent ones in the layer: a bubble is crossed only by the strokes of
 * another figure that speaks too (a few at a time, see bubbleFocus). Nodes move only when a bubble turns on
 * or off; the view sync never reorders.
 */
function restack(g: SVGGElement, speaking: boolean): void {
  const layer = g.parentElement;
  if (!layer) return;
  if (speaking) {
    if (layer.lastElementChild !== g) layer.append(g);
    return;
  }
  const firstSpeaking = layer.querySelector(':scope > [data-kind="enemy"] > [data-part="over"] > .bubble:not(.bubble-off)')?.closest('[data-kind="enemy"]');
  if (firstSpeaking && firstSpeaking !== g) layer.insertBefore(g, firstSpeaking);
}

// ---------- paint ----------

/**
 * DESIGN 3.4: one pale wash in the family's hue, offset from the contour, under every stroke (the first child of
 * `under`, which is not mirrored, so the stain does not jump when the enemy turns). Elites get a second, smaller
 * wash somewhere else; bosses two larger ones, 0.1 more opaque. Seeded from the enemy, so it is always the same stain.
 */
function addWash(under: SVGGElement, e: Enemy, hw: number, H: number, feet: number): void {
  const rng = createRng(e.seed).fork('wash');
  const hue = FAMILY_HUE[e.family];
  const r = 0.8 * ((hw + H / 2) / 2) * (e.boss ? 1.3 : 1);
  const bonus = e.boss ? 0.1 : 0;
  const cy = feet - H * 0.5;
  const list = [washGroup(rng, hue, r, { cy, bonus })];
  if (e.elite !== undefined || e.boss === true) list.push(washGroup(rng, hue, r * 0.5, { cy, bonus, offset: [r * 0.3, r * 0.5] }));
  under.prepend(...list);
}

// ---------- the figure ----------

function buildFigure(e: Enemy, g: SVGGElement): FigState {
  g.replaceChildren();
  const asm = assemblyOf(e);
  const layout = layoutAssembly(asm);
  const sc = asm.scale * ENEMY_SCALE * (e.elite ? ELITE_SCALE : 1);
  const H = asm.height * sc;
  const feet = Math.round(H * 0.48);
  const top = feet - H;
  const hw = Math.max((asm.width / 2) * sc, 14);

  const under = el('g', { 'data-part': 'under' });
  const fig = el('g', { 'data-part': 'fig', transform: `translate(0 ${feet}) scale(${n2(sc)})` });
  const over = el('g', { 'data-part': 'over' });
  const legsG = el('g', { transform: layout.legTf });
  const legPaths: SVGPathElement[] = layout.legs(0).map((d, i) => el('path', { 'data-leg': i, d }));
  legsG.append(...legPaths);
  fig.append(legsG);
  for (const L of layout.layers) {
    const lg = el('g', { transform: L.tf });
    addArt(lg, L.art);
    for (const tx of L.texts) addText(lg, tx);
    fig.append(lg);
  }

  const boss = e.boss ? BOSS_OF[e.family] : null;
  addWash(under, e, hw, H, feet);
  if (boss === 'weryfikacja') buildGrid(under, e);
  if (boss === 'hipoteza') buildRing(under, e);

  const bubbleTop = boss === 'weryfikacja' ? Math.min(top, -GRID_CELL * 1.5 - 2) : top;
  const bubble = buildBubble(e, bubbleTop);
  const markers = el('g', { 'data-part': 'markers' });
  over.append(bubble, markers);
  if (boss) {
    over.append(
      el('text', { x: 0, y: n2(boss === 'weryfikacja' ? GRID_CELL * 1.5 + 14 : feet + 16), 'text-anchor': 'middle', 'font-size': 9, 'letter-spacing': 1.8, style: `${FONT.title}; fill: var(--ink); stroke: none` }, [t(`enemies.boss.${boss}.name`).toLocaleUpperCase('pl')]),
    );
  } else if (e.elite) {
    over.append(
      el('path', { d: `M${n2(-hw)} ${n2(feet + 3)}Q0 ${n2(feet + 6)} ${n2(hw)} ${n2(feet + 2.5)}M${n2(-hw + 5)} ${n2(feet + 6)}Q0 ${n2(feet + 8.5)} ${n2(hw - 4)} ${n2(feet + 5.5)}`, 'stroke-width': 1.1 }),
      el('text', { x: 0, y: n2(feet + 19), 'text-anchor': 'middle', 'font-size': 12, style: `${FONT.serif}; fill: var(--ink); stroke: none` }, [eliteWord(e.elite.affix, asm.body)]),
    );
  }
  g.append(under, fig, over);
  g.dataset['tier'] = String(e.tier);
  const st: FigState = {
    asm,
    layout,
    sc,
    top,
    bubbleTop,
    feet,
    hw,
    fig,
    under,
    over,
    bubble,
    markers,
    legPaths,
    claimSig: claimSig(e),
    bubbleOn: true,
    bubbleTf: bubbleTransform(bubbleTop),
    phase: 0,
    flip: 1,
    spinning: false,
    dashSig: '',
    opacitySig: '',
    progressSig: '',
    hiddenLeg: false,
  };
  if (e.claim?.struck) strikeBubble(bubble, false);
  states.set(g, st);
  return st;
}

const claimSig = (e: Enemy): string => `${e.claim?.textKey ?? ''}|${e.claim?.struck ? 1 : 0}`;

// ---------- boss floor drawings ----------

const HYDRANT =
  'M-4 8L-4-4Q-4-9 0-9Q4-9 4-4L4 8M-5.5-9.6L5.5-9.6M-4-1L-8-1L-8 3L-4 3M4-1L8-1L8 3L4 3M-6.5 8L6.5 8M0-9L0-12';

function buildGrid(under: SVGGElement, e: Enemy): void {
  const grid = rtOf(e).grid;
  if (!grid) return;
  const cell = el('g', { 'data-part': 'grid' });
  for (let i = 0; i < 9; i++) {
    const c = gridCellCenter(0, 0, i);
    const half = GRID_CELL / 2 - 3;
    const cg = el('g', { transform: `translate(${n2(c.x)} ${n2(c.y)})` });
    cg.append(el('path', { d: box(-half, -half, half, half, 1.6), 'stroke-width': 1.2 }));
    if (grid.cells.includes(i)) {
      cg.append(el('path', { d: HYDRANT, 'stroke-width': 1.5 }), el('path', { d: circ(0, 2.5, 1.1), style: INK_FILL }));
    } else if (i !== 4) {
      cg.append(el('path', { d: hatchRect(-half + 2, -half + 2, half - 2, half - 2, 3.4 + (i % 3), i % 2 === 0), 'stroke-width': 0.8 }));
    }
    cell.append(cg);
  }
  under.append(cell);
}

function buildRing(under: SVGGElement, e: Enemy): void {
  const rng = createRng(e.seed).fork('ring');
  const ring = el('path', { d: wobblyCircle(rng, 0, 4, CONFIRM_R, 14, 0.03), 'stroke-dasharray': '2 6', 'stroke-width': 1.4, 'data-part': 'ring' });
  under.append(ring);
}

/** Progress of the captcha squares and of the confirmation, drawn once something has progressed. */
function syncBossProgress(e: Enemy, st: FigState): void {
  const rt = rtOf(e);
  const boss = BOSS_OF[e.family];
  let p = 0;
  if (boss === 'weryfikacja' && rt.grid) p = Math.min(1, rt.grid.time / GRID_NEED_S);
  else if (boss === 'hipoteza') p = rt.confirmed ? 1 : Math.min(1, rt.confirm / CONFIRM_NEED_S);
  const sig = String(Math.round(p * 40));
  if (sig === st.progressSig) return;
  st.progressSig = sig;
  let host = st.under.querySelector<SVGPathElement>(':scope > [data-part="progress"]');
  if (p <= 0) {
    host?.remove();
    return;
  }
  if (!host) {
    if (boss === 'hipoteza') host = el('path', { d: wobblyCircle(createRng(e.seed).fork('ring'), 0, 4, CONFIRM_R, 14, 0.03), 'data-part': 'progress', 'stroke-width': 2.4 });
    else {
      const grid = rt.grid;
      if (!grid) return;
      let d = '';
      for (const c of grid.cells) {
        const q = gridCellCenter(0, 0, c);
        const h = GRID_CELL / 2 - 8;
        d += `M${n2(q.x - h)} ${n2(q.y - h)}L${n2(q.x + h)} ${n2(q.y - h)}L${n2(q.x + h)} ${n2(q.y + h)}L${n2(q.x - h)} ${n2(q.y + h)}Z`;
      }
      host = el('path', { d, 'data-part': 'progress', 'stroke-width': 2.4 });
    }
    st.under.append(host);
  }
  const len = host.getTotalLength();
  host.style.strokeDasharray = String(len);
  host.style.strokeDashoffset = String(len * (1 - p));
}

// ---------- per frame ----------

const legPhase = (timeMs: number, moving: boolean): 0 | 1 => (moving ? ((Math.floor(timeMs / LEG_PERIOD_MS) % 2) as 0 | 1) : 0);

function patchEnemy(e: Enemy, g: SVGGElement, timeMs: number): void {
  let st = states.get(g);
  if (!st) return;
  const rt = rtOf(e);
  if (g.dataset['tier'] !== String(e.tier)) {
    // escalation: the whole contraption is drawn again, bigger
    st = buildFigure(e, g);
    drawIn(g, 320);
  }

  // upright parts stay readable when the figure faces left
  const flip = e.facing < 0 ? -1 : 1;
  if (flip !== st.flip) {
    st.flip = flip;
    const tf = flip < 0 ? 'scale(-1 1)' : '';
    st.over.setAttribute('transform', tf);
    st.under.setAttribute('transform', tf);
    // lettering drawn on the parts must not be mirrored with them
    st.fig.querySelectorAll<SVGTextElement>('text[data-x]').forEach((tx) => {
      const x = tx.dataset['x'] ?? '0';
      const rot = tx.dataset['rot'] ?? '';
      tx.setAttribute('transform', flip < 0 ? `translate(${x} 0) scale(-1 1) translate(-${x} 0) ${rot}` : rot);
    });
  }

  // legs
  const phase = legPhase(timeMs, e.moving);
  if (phase !== st.phase) {
    st.phase = phase;
    st.layout.legs(phase).forEach((d, i) => st.legPaths[i]?.setAttribute('d', d));
  }
  const missing = rt.limped || (e.boss === true && BOSS_OF[e.family] === 'prototyp' && rt.phase >= 2);
  if (missing !== st.hiddenLeg) {
    st.hiddenLeg = missing;
    const last = st.legPaths[st.legPaths.length - 1];
    if (last) last.style.display = missing ? 'none' : '';
  }

  // spin (defect)
  if (rt.spin > 0) {
    st.spinning = true;
    const a = (rt.spinDir * 360 * (1 - rt.spin / SPIN_S)).toFixed(0);
    const mid = -(st.feet - st.top) * 0.5 + st.feet;
    st.fig.setAttribute('transform', `translate(0 ${n2(mid)}) rotate(${a}) translate(0 ${n2(st.feet - mid)}) scale(${n2(st.sc)})`);
  } else if (st.spinning) {
    st.spinning = false;
    st.fig.setAttribute('transform', `translate(0 ${st.feet}) scale(${n2(st.sc)})`);
  }

  // existence: opacity and dash pattern follow e
  if (e.existence !== undefined) {
    const x = e.existence;
    const op = ((e.boss ? 0.6 : 0.4) + (e.boss ? 0.4 : 0.6) * x).toFixed(2);
    if (op !== st.opacitySig) {
      st.opacitySig = op;
      st.fig.style.opacity = op;
    }
    const dotted = st.asm.dotted;
    const on = 11 * (0.35 + 0.65 * x) * (1 - 0.55 * dotted) + 1.4;
    const off = 1.2 + (1 - x) * 6 + dotted * 2.6;
    const sig = `${on.toFixed(1)} ${off.toFixed(1)}`;
    if (sig !== st.dashSig) {
      st.dashSig = sig;
      st.fig.setAttribute('stroke-dasharray', sig);
    }
  }

  // claim bubble
  const cs = claimSig(e);
  if (cs !== st.claimSig) {
    const keyChanged = cs.split('|')[0] !== st.claimSig.split('|')[0];
    st.claimSig = cs;
    if (keyChanged) {
      const nb = buildBubble(e, st.bubbleTop);
      st.bubble.replaceWith(nb);
      st.bubble = nb;
      nb.classList.toggle('bubble-off', !st.bubbleOn);
      drawIn(nb, 220);
      if (e.claim?.struck) strikeBubble(nb, false);
    } else if (e.claim?.struck) {
      strikeBubble(st.bubble, true);
    }
  }

  const tf = bubbleTransform(st.bubbleTop);
  if (tf !== st.bubbleTf) {
    st.bubbleTf = tf;
    if (tf) st.bubble.setAttribute('transform', tf);
    else st.bubble.removeAttribute('transform');
  }

  const on = bubbleShown(e);
  if (on !== st.bubbleOn) {
    st.bubbleOn = on;
    st.bubble.classList.toggle('bubble-off', !on);
    restack(g, on);
  }

  syncStatusMarkers(st.markers, e.statuses, { hw: st.hw, top: st.top, feet: st.feet });
  if (e.boss) syncBossProgress(e, st);
}

export const enemyBuilder: Builder<Enemy> = {
  create(e) {
    const g = el('g', { class: `enemy fam-${e.family}` });
    buildFigure(e, g);
    return g;
  },
  patch: patchEnemy,
  drawInMs: 320,
};

// ---------- events to marks ----------

/** Marginal notes and stamps that belong to enemies: "nie na temat", "ESKALACJA". Returns an unsubscribe. */
export function bindEnemyFx(bus: Bus): () => void {
  const rng = createRng(0xe4e);
  const offs = [
    bus.on('enemy:offTopic', (ev) => marginNote(t('combat.offTopic'), ev.x + 6, ev.y - 34, rng.range(-6, 4), 1100)),
    bus.on('enemy:escalated', (ev) => {
      stamp(t('combat.escalation'), ev.x, ev.y - 30, { fontSize: 10, ttl: 800, rotation: rng.range(-8, 8) });
    }),
  ];
  return () => offs.forEach((f) => f());
}

