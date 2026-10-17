import { must } from '../core/util';

export type Theme = 'day' | 'night' | 'auto';

export interface Stage {
  svg: SVGSVGElement;
  page: SVGGElement;
  world: SVGGElement;
  fx: SVGGElement;
  ui: HTMLElement;
  wobble: SVGFilterElement;
  noise: SVGFETurbulenceElement;
}

/** Look up the static skeleton declared in index.html. */
export function getStage(): Stage {
  const q = <T extends Element>(sel: string): T => must(document.querySelector<T>(sel), sel);
  return {
    svg: q<SVGSVGElement>('#stage'),
    page: q<SVGGElement>('#page'),
    world: q<SVGGElement>('#world'),
    fx: q<SVGGElement>('#fx'),
    ui: q<HTMLElement>('#ui'),
    wobble: q<SVGFilterElement>('#wobble'),
    noise: q<SVGFETurbulenceElement>('#wobble-noise'),
  };
}

export const WOBBLE_PERIOD_MS = 500;

/** Re-seed the pen wobble every ~0.5 s (never per frame). Call from the render step. */
export function createWobble(stage: Stage) {
  let acc = 0;
  let seed = 1;
  return {
    tick(dtMs: number): void {
      acc += dtMs;
      if (acc < WOBBLE_PERIOD_MS) return;
      acc -= WOBBLE_PERIOD_MS;
      seed = (seed % 997) + 1;
      stage.noise.setAttribute('seed', String(seed));
    },
  };
}

/** 'auto' follows prefers-color-scheme (no attribute); 'day' / 'night' force it. */
export function setTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function currentTheme(): 'day' | 'night' {
  const forced = document.documentElement.getAttribute('data-theme');
  if (forced === 'day' || forced === 'night') return forced;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
}
