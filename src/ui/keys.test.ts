import { describe, expect, it } from 'vitest';
import { keyAction, keyVector, mouseAim } from './keys';

describe('keyVector', () => {
  it('is null with nothing held', () => {
    expect(keyVector([])).toBeNull();
    expect(keyVector(['KeyQ'])).toBeNull();
  });
  it('steers at full speed in one direction', () => {
    expect(keyVector(['KeyD'])).toEqual({ dx: 1, dy: 0, mag: 1 });
    expect(keyVector(['ArrowUp'])).toEqual({ dx: 0, dy: -1, mag: 1 });
  });
  it('normalises diagonals', () => {
    const v = keyVector(['KeyW', 'KeyD']);
    expect(v?.mag).toBe(1);
    expect(Math.hypot(v?.dx ?? 0, v?.dy ?? 0)).toBeCloseTo(1);
    expect(v?.dx).toBeCloseTo(Math.SQRT1_2);
    expect(v?.dy).toBeCloseTo(-Math.SQRT1_2);
  });
  it('cancels opposite keys', () => {
    expect(keyVector(['KeyA', 'KeyD'])).toBeNull();
    expect(keyVector(['ArrowLeft', 'KeyD'])).toBeNull();
    expect(keyVector(['KeyA', 'KeyD', 'KeyW'])).toEqual({ dx: 0, dy: -1, mag: 1 });
  });
  it('counts WASD and the arrow of the same way once', () => {
    expect(keyVector(['KeyW', 'ArrowUp'])).toEqual({ dx: 0, dy: -1, mag: 1 });
  });
});

describe('keyAction', () => {
  it('maps digits 1-5 to pad slots, numpad too', () => {
    expect(keyAction('Digit1')).toEqual({ kind: 'pad', slot: 1 });
    expect(keyAction('Digit5')).toEqual({ kind: 'pad', slot: 5 });
    expect(keyAction('Numpad3')).toEqual({ kind: 'pad', slot: 3 });
    expect(keyAction('Digit6')).toBeNull();
    expect(keyAction('Digit0')).toBeNull();
  });
  it('maps Esc, I, T, F', () => {
    expect(keyAction('Escape')).toEqual({ kind: 'pause' });
    expect(keyAction('KeyI')).toEqual({ kind: 'inventory' });
    expect(keyAction('KeyT')).toEqual({ kind: 'tunnel' });
    expect(keyAction('KeyF')).toEqual({ kind: 'potw' });
    expect(keyAction('KeyW')).toBeNull();
  });
});

describe('mouseAim', () => {
  const hero = { x: 100, y: 100 };
  it('gives the unit direction hero -> cursor for kierunek', () => {
    const a = mouseAim('kierunek', hero, { x: 100, y: 40 }, 200);
    expect(a).toEqual({ kind: 'kierunek', dx: 0, dy: -1 });
  });
  it('gives the cursor point for wskazanie inside range', () => {
    expect(mouseAim('wskazanie', hero, { x: 160, y: 100 }, 200)).toEqual({ kind: 'wskazanie', x: 160, y: 100 });
  });
  it('clamps wskazanie to range', () => {
    const a = mouseAim('wskazanie', hero, { x: 500, y: 100 }, 150);
    expect(a).toEqual({ kind: 'wskazanie', x: 250, y: 100 });
  });
  it('leaves auto skills and a cursor on the hero to the auto aim', () => {
    expect(mouseAim('auto', hero, { x: 1, y: 1 }, 100)).toEqual({ kind: 'auto' });
    expect(mouseAim('kierunek', hero, hero, 100)).toEqual({ kind: 'auto' });
  });
});
