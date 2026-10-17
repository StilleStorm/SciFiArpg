import type { Bus } from '../core/events';
import { createRng } from '../core/rng';
import { heroDef, type HeroId } from '../heroes';
import { t } from '../i18n';
import { el, wobblyCircle } from '../render/svg';
import { h } from './dom';
import './forms.css';

type PadId = 'skill1' | 'skill2' | 'skill3' | 'inventory';

const circ = (cx: number, cy: number, r: number): string => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

/**
 * Small ink drawings, centered on 0,0 inside a 52 x 52 box. A leading "~" draws that stroke dotted.
 * Order per hero: skill 1, 2, 3.
 */
const SKILL_DRAWINGS: Record<HeroId, readonly (readonly string[])[]> = {
  // a spinning drum, foam, a dragged box
  pralka: [
    [circ(0, 0, 11), 'M0-11V11M-11 0H11', circ(0, 0, 4), 'M-17-8A19 19 0 0 1-6-17M-8-19L-6-17L-9-14', 'M17 8A19 19 0 0 1 6 17M8 19L6 17L9 14'],
    [circ(-6, 5, 7), circ(6, 7, 5), circ(1, -7, 5.5), circ(-9, -8, 2.5), circ(10, -4, 2.2), circ(11, 14, 1.6)],
    ['M-3-9H12V5H-3Z', 'M-3-9L2-13H12M12-9L17-13V1L12 5', 'M-17-2H-8M-19 3H-8M-17 8H-8', 'M-14 13H17'],
  ],
  // an hourglass, a redirect arrow, a headset
  konsultant: [
    ['M-8-13H8M-8 13H8M-7-13C-7-4-1-2 0 0C-1 2-7 4-7 13M7-13C7-4 1-2 0 0C1 2 7 4 7 13', 'M-3.5 11H3.5M0 3V9'],
    ['M-13 12V0Q-13-11-2-11H11', 'M6-17L12-11L6-5', 'M-13 12H-6'],
    ['M-11 3A11 11 0 0 1 11 3', 'M-14 0H-10V9H-14Z', 'M10 0H14V9H10Z', 'M-12 9Q-10 15 0 15', circ(1, 15, 1.6)],
  ],
  // two cosmonauts, a pair of speech bubbles, a loop
  petlowiec: [
    [circ(-8, -6, 5.5), 'M-13-3H-3L-4 9H-12Z', 'M-11 9V15M-5 9V15', '~' + circ(8, -4, 5.5), '~M3 -1H13L12 11H4Z', '~M5 11V17M11 11V17'],
    ['M-15-14H3V-1H-8L-12 4V-1H-15Z', 'M-4-3H15V10H9L6 15V10H-4Z', 'M-11-9H-1M0 2H11M0 6H8'],
    ['M-12 0C-12-12-2-12 0 0C2 12 12 12 12 0C12-12 2-12 0 0C-2 12-12 12-12 0', 'M7 8L12 2L16 8'],
  ],
  // a theodolite, a dashed area, a crossed pin
  kartograf: [
    ['M0 3L-10 15M0 3L10 15M0 3V15', 'M-6-8H6V3H-6Z', 'M-6-4H-15M-15-7V-1', circ(0, -2.5, 2.6), 'M-3-12H3V-8H-3Z'],
    ['~' + 'M-15 0A15 10 0 1 0 15 0A15 10 0 1 0 -15 0', 'M-6 0H6M0-5V5', 'M-10-6l2 2M10 6l2 2M10-6l-2 2M-10 6l-2 2'],
    ['M0-12C-6-12-7-4 0 5C7-4 6-12 0-12Z', circ(0, -7, 2), 'M0 5V13', 'M-13 12L13-12'],
  ],
};

const INVENTORY_DRAWING = 'M-5 11V-8A5 5 0 0 1 5-8V8A3 3 0 0 1-1 8V-4'; // paper clip

const PADS: PadId[] = ['skill1', 'skill2', 'skill3', 'inventory'];
const SLOT_CLASS: Record<PadId, string> = { skill1: 's1', skill2: 's2', skill3: 's3', inventory: 'inv' };
const EVENT: Record<PadId, 'skill:1' | 'skill:2' | 'skill:3' | 'inventory'> = {
  skill1: 'skill:1',
  skill2: 'skill:2',
  skill3: 'skill:3',
  inventory: 'inventory',
};

interface PadNode {
  btn: HTMLButtonElement;
  glyph: SVGGElement;
  word: HTMLElement;
  ring: SVGPathElement;
  last: number;
}
const nodes: PadNode[] = [];
let currentHero: HeroId | null = null;

function drawGlyph(g: SVGGElement, strokes: readonly string[]): void {
  g.replaceChildren(
    ...strokes.map((d) => {
      const dotted = d.startsWith('~');
      return el('path', dotted ? { d: d.slice(1), 'stroke-dasharray': '2 3' } : { d });
    }),
  );
}

/** Show the skill drawings and words of this hero on the three pads. */
export function setPadHero(heroId: HeroId): void {
  if (currentHero === heroId) return;
  currentHero = heroId;
  const def = heroDef(heroId);
  const drawings = SKILL_DRAWINGS[heroId];
  nodes.slice(0, 3).forEach((n, i) => {
    const sk = def.skills[i as 0 | 1 | 2];
    n.word.textContent = t(sk.padKey);
    n.btn.setAttribute('aria-label', t(sk.nameKey));
    drawGlyph(n.glyph, drawings[i] ?? []);
  });
}

/** Cooldown rings: the circle around a pad is drawn as the cooldown runs out. Call every frame. */
export function updatePadCooldowns(cd: readonly number[], total: readonly number[]): void {
  for (let i = 0; i < 3; i++) {
    const n = nodes[i];
    if (!n) continue;
    const left = cd[i] ?? 0;
    const len = Math.max(0.01, total[i] ?? 1);
    const offset = left > 0 ? Math.round((left / len) * 200) / 2 : -1;
    if (offset === n.last) continue;
    n.last = offset;
    const cooling = left > 0;
    n.btn.classList.toggle('cooling', cooling);
    if (cooling) n.ring.style.strokeDashoffset = String(offset);
  }
}

/** Three skill buttons and the inventory button: circled margin notes with a word label. */
export function createPads(root: HTMLElement, bus: Bus): HTMLElement {
  const wrap = h('div', 'pads');
  const rng = createRng(77);
  nodes.length = 0;
  currentHero = null;
  PADS.forEach((id) => {
    const btn = h('button', `pad ${SLOT_CLASS[id]}`);
    btn.type = 'button';
    const word = h('span', 'word', id === 'inventory' ? t('ui.pads.inventory') : '');
    const svg = el('svg', { viewBox: '-26 -26 52 52' });
    const base = el('g', { class: 'base' });
    base.append(
      el('path', { d: wobblyCircle(rng, 0, 0, 23, 11, 0.03) }),
      el('path', { d: wobblyCircle(rng, 0.6, -0.4, 21.4, 9, 0.035), 'stroke-width': 0.9 }),
    );
    const glyph = el('g', { class: 'glyph' });
    if (id === 'inventory') glyph.append(el('path', { d: INVENTORY_DRAWING }));
    const ring = el('path', { class: 'cd', d: wobblyCircle(rng, 0, 0, 25.4, 12, 0.012), pathLength: 100 });
    ring.style.strokeDasharray = '100';
    svg.append(base, glyph, ring);
    btn.append(svg, word);
    if (id === 'inventory') btn.setAttribute('aria-label', t('ui.pads.inventory'));
    btn.addEventListener('click', () => bus.emit(EVENT[id]));
    wrap.append(btn);
    nodes.push({ btn, glyph, word, ring, last: -2 });
  });
  root.append(wrap);
  setPadHero('pralka');
  return wrap;
}
