export type Side = 'l' | 'r' | 't' | 'b';
export type Screen = 'title' | 'run' | 'death';

/** Every event on the bus and its payload. `undefined` payload = no argument. */
export interface GameEvents {
  'skill:1': undefined;
  'skill:2': undefined;
  'skill:3': undefined;
  inventory: undefined;
  'screen:changed': { screen: Screen };
  'run:started': { seed: number };
  'player:hit': { x: number; y: number; amount: number; crit: boolean };
  'player:died': { x: number; y: number };
  'enemy:hit': { id: number; x: number; y: number; amount: number; crit: boolean };
  'enemy:miss': { id: number };
  'enemy:died': { id: number; x: number; y: number };
  'pickup:taken': { id: number; number: number };
  'page:edge': { x: number; y: number; side: Side };
  footnote: { text: string };
  stamp: { text: string; x: number; y: number };
}

type Args<K extends keyof GameEvents> = GameEvents[K] extends undefined ? [] : [GameEvents[K]];
type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

export interface Bus {
  on<K extends keyof GameEvents>(name: K, fn: Handler<K>): () => void;
  emit<K extends keyof GameEvents>(name: K, ...payload: Args<K>): void;
}

export function createBus(): Bus {
  const handlers = new Map<keyof GameEvents, Set<Handler<keyof GameEvents>>>();
  return {
    on(name, fn) {
      const set = handlers.get(name) ?? new Set();
      set.add(fn as Handler<keyof GameEvents>);
      handlers.set(name, set);
      return () => {
        set.delete(fn as Handler<keyof GameEvents>);
      };
    },
    emit(name, ...payload) {
      const set = handlers.get(name);
      if (!set) return;
      for (const fn of [...set]) fn(payload[0] as GameEvents[keyof GameEvents]);
    },
  };
}
