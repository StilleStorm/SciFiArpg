/**
 * Location types as page data (STORY 8.0): which props a type puts on a page, how they are laid out, and the circles
 * each one blocks. Pure data; the drawings are `render/locations/*.ts`, keyed by the same prop ids. A planet module adds
 * its types here (S12: przedmiescie, magazyn); a type without an entry leaves the page on the generic obstacles.
 */
import type { LocationType } from '../campaign';
import type { Circle } from '../pages';

/** A prop's footprint: circles as [dx, dy, r] in fractions of the prop's size (its width). An empty body is a flat mark on the paper. */
export interface PropSpec {
  id: string;
  /** Width range in world units. */
  size: readonly [number, number];
  body: readonly (readonly [number, number, number])[];
}

export type LocationLayout = 'rows' | 'aisles' | 'corridors' | 'rooms';

export interface LocationSpec {
  /** rows: props stand along horizontal streets; aisles: along vertical aisles; corridors: columns of `wall` props make narrow parallel corridors. */
  layout: LocationLayout;
  /** corridors only: the prop id that forms the walls of the corridors. */
  wall?: string;
  /** rooms only: `wall` is the horizontal partition (cut by doorways, its gaps), `wallSide` the vertical one, `row` the prop set out in rows (desks). */
  wallSide?: string;
  row?: string;
  props: readonly PropSpec[];
  /** Flat marks put on the page first, under everything (ids of props with an empty body). */
  flat: readonly string[];
}

const P = (id: string, size: readonly [number, number], body: PropSpec['body']): PropSpec => ({ id, size, body });

const PRZEDMIESCIE: LocationSpec = {
  layout: 'rows',
  flat: ['trawnik'],
  props: [
    P('trawnik', [150, 210], []),
    P('zywoplot', [110, 150], [[-0.3, 0, 0.15], [0, 0, 0.15], [0.3, 0, 0.15]]),
    P('plot', [120, 160], [[-0.34, 0, 0.1], [-0.11, 0, 0.1], [0.11, 0, 0.1], [0.34, 0, 0.1]]),
    P('skrzynka', [46, 58], [[0, -0.1, 0.34], [0, 0.34, 0.16]]),
    P('kosiarka', [84, 104], [[-0.22, 0, 0.3], [0.22, 0, 0.3]]),
    P('antena', [72, 92], [[0, 0, 0.36]]),
    P('krasnal', [40, 52], [[0, 0, 0.42]]),
    P('dzwonek', [36, 46], [[0, 0, 0.42]]),
    P('kraweznik', [92, 124], [[-0.32, 0, 0.17], [0, 0, 0.17], [0.32, 0, 0.17]]),
    // planet 3 (S14)
    P('lodowka', [58, 76], [[0, -0.15, 0.4], [0, 0.45, 0.2]]),
    P('drzwi', [96, 116], [[-0.25, 0, 0.2], [0.25, 0, 0.2]]),
    P('linijka', [120, 150], [[0.37, 0, 0.1]]),
  ],
};

const MAGAZYN: LocationSpec = {
  layout: 'aisles',
  flat: [],
  props: [
    P('palety', [72, 100], [[-0.24, 0, 0.3], [0.24, 0, 0.3]]),
    P('regal', [130, 170], [[-0.34, 0, 0.14], [0, 0, 0.14], [0.34, 0, 0.14]]),
    P('wozek', [100, 124], [[-0.22, 0, 0.28], [0.2, 0, 0.28]]),
    P('tasma', [42, 56], [[0, 0, 0.45]]),
    P('waga', [72, 92], [[0, 0, 0.46]]),
    P('tasmociag', [150, 190], [[-0.36, 0, 0.1], [-0.12, 0, 0.1], [0.12, 0, 0.1], [0.36, 0, 0.1]]),
    P('paczki', [110, 140], [[-0.3, 0, 0.19], [0, 0, 0.19], [0.3, 0, 0.19]]),
    P('wozek-reczny', [50, 64], [[0, 0, 0.42]]),
    // planet 2 (S13)
    P('stos', [96, 126], [[-0.28, 0.05, 0.2], [0.28, 0.05, 0.2], [0, -0.25, 0.2]]),
    P('awizo', [120, 150], [[-0.32, 0, 0.14], [0, 0, 0.14], [0.32, 0, 0.14]]),
    P('kolejka', [150, 190], [[-0.36, 0, 0.1], [-0.12, 0, 0.1], [0.12, 0, 0.1], [0.36, 0, 0.1]]),
  ],
};

/** Serwerownia (STORY 8.2): columns of racks make narrow parallel corridors; the rest are small things in the aisles and flat marks on the floor. */
const SERWEROWNIA: LocationSpec = {
  layout: 'corridors',
  wall: 'rack',
  flat: ['siatka', 'koryto', 'kurtyna'],
  props: [
    P('rack', [50, 60], [[0, -1, 0.5], [0, 0, 0.5], [0, 1, 0.5]]),
    P('wentylator', [70, 90], [[0, 0, 0.45]]),
    P('gasnica', [30, 38], [[0, 0, 0.45]]),
    P('drabina', [44, 56], [[0, -0.6, 0.45], [0, 0.6, 0.45]]),
    P('cisza', [60, 76], [[0, 0, 0.4]]),
    P('siatka', [150, 210], []),
    P('koryto', [90, 120], []),
    P('kurtyna', [150, 200], []),
  ],
};

/**
 * Biuro (STORY 8.3): the regional office. Rooms cut by partitions (ruled rectangles) with doorways as gaps; desks in rows, filing
 * cabinets, a water cooler, a hatched plant, a photocopier, a row of waiting chairs, a numbered ticket dispenser, a clock on a post.
 * The boss page is an open-plan hall: partitions only along its lower edge, the middle left clear for the boss.
 */
const BIURO: LocationSpec = {
  layout: 'rooms',
  wall: 'przepierzenie',
  wallSide: 'przepierzenie-boczne',
  row: 'biurko',
  flat: [],
  props: [
    P('przepierzenie', [150, 170], [[-0.375, 0, 0.1], [-0.125, 0, 0.1], [0.125, 0, 0.1], [0.375, 0, 0.1]]),
    P('przepierzenie-boczne', [46, 52], [[0, -1, 0.34], [0, -0.33, 0.34], [0, 0.33, 0.34], [0, 1, 0.34]]),
    P('biurko', [96, 120], [[-0.25, 0, 0.2], [0.25, 0, 0.2]]),
    P('kartoteka', [50, 60], [[0, -0.45, 0.4], [0, 0.45, 0.4]]),
    P('dystrybutor', [34, 42], [[0, 0, 0.45]]),
    P('roslina', [44, 56], [[0, 0, 0.42]]),
    P('kserokopiarka', [80, 100], [[-0.22, 0, 0.3], [0.22, 0, 0.3]]),
    P('krzesla', [120, 150], [[-0.36, 0, 0.1], [-0.12, 0, 0.1], [0.12, 0, 0.1], [0.36, 0, 0.1]]),
    P('numerek', [38, 48], [[0, 0, 0.42]]),
    P('zegar', [40, 50], [[0, 0, 0.4]]),
  ],
};

/** The types that have props. Planets 2 and 3 add theirs (serwerownia, biuro, ...) here. */
export const LOCATIONS: Partial<Record<LocationType, LocationSpec>> = {
  przedmiescie: PRZEDMIESCIE,
  magazyn: MAGAZYN,
  serwerownia: SERWEROWNIA,
  biuro: BIURO,
};

export const locationSpec = (type: LocationType | undefined): LocationSpec | undefined => (type ? LOCATIONS[type] : undefined);

/** The spec of a prop id, whichever type owns it. */
export function propSpec(id: string | undefined): PropSpec | undefined {
  if (!id) return undefined;
  for (const spec of Object.values(LOCATIONS)) {
    const p = spec?.props.find((q) => q.id === id);
    if (p) return p;
  }
  return undefined;
}

/** The blocking circles of a prop at (x, y) with width `size`. Props are never rotated. */
export function propColliders(id: string | undefined, x: number, y: number, size: number): Circle[] {
  const spec = propSpec(id);
  if (!spec) return [{ x, y, r: size * 0.4 }];
  return spec.body.map(([dx, dy, r]) => ({ x: x + dx * size, y: y + dy * size, r: r * size }));
}
