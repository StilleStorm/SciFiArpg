import { describe, expect, it } from 'vitest';
import { ceilingCurve, dbToGain, fmBellSamples, gainToDb, ksSamples, motorSamples, noiseSamples, peakOf, reversed, saturationCurve, swellSamples } from './dsp';

const SR = 24000;

/** Pitch of the strongest partial near `f`: a windowed single-bin DFT scanned in 2-cent steps between -60 and +60 cents. */
function pitchNear(x: Float32Array, sr: number, f: number): number {
  const start = Math.floor(sr * 0.04);
  const len = Math.floor(sr * 0.3);
  let best = 0;
  let bestF = f;
  for (let c = -60; c <= 60; c += 2) {
    const fr = f * 2 ** (c / 1200);
    let re = 0;
    let im = 0;
    for (let i = 0; i < len; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / len);
      const v = (x[start + i] ?? 0) * w;
      re += v * Math.cos((2 * Math.PI * fr * i) / sr);
      im += v * Math.sin((2 * Math.PI * fr * i) / sr);
    }
    const e = re * re + im * im;
    if (e > best) {
      best = e;
      bestF = fr;
    }
  }
  return bestF;
}

describe('Karplus-Strong pluck', () => {
  it('is in tune within 15 cents from 100 Hz to 2.4 kHz (the allpass takes the fractional delay)', () => {
    for (const f of [110, 196, 330, 523.3, 880, 1318.5, 2093]) {
      const x = ksSamples(f, SR, 0.5, { t60: 1.5, seed: 3 });
      const got = pitchNear(x, SR, f);
      const cents = 1200 * Math.log2(got / f);
      expect(Math.abs(cents), `${f} Hz measured ${got.toFixed(1)}`).toBeLessThanOrEqual(15);
    }
  });

  it('decays, ends at silence, peaks at the requested level and is deterministic', () => {
    const x = ksSamples(220, SR, 1, { t60: 0.5, peak: 0.7, seed: 4 });
    expect(peakOf(x)).toBeCloseTo(0.7, 5);
    const late = x.subarray(Math.floor(SR * 0.7), Math.floor(SR * 0.9));
    expect(peakOf(late)).toBeLessThan(0.05);
    expect(Math.abs(x[x.length - 1] ?? 1)).toBeLessThan(1e-3);
    expect(Array.from(ksSamples(220, SR, 0.2, { seed: 4 }))).toEqual(Array.from(ksSamples(220, SR, 0.2, { seed: 4 })));
    expect(Array.from(ksSamples(220, SR, 0.2, { seed: 5 }))).not.toEqual(Array.from(ksSamples(220, SR, 0.2, { seed: 4 })));
  });

  it('a low body pluck (60-140 Hz) rings about its t60', () => {
    const x = ksSamples(90, SR, 0.4, { t60: 0.15, bright: 600 });
    const early = peakOf(x.subarray(0, Math.floor(SR * 0.05)));
    const late = peakOf(x.subarray(Math.floor(SR * 0.25), Math.floor(SR * 0.35)));
    expect(late / early).toBeLessThan(0.1);
  });
});

describe('other generators', () => {
  it('the FM bell is finite, normalised and decays', () => {
    const x = fmBellSamples(660, SR, 1.5, { t60: 1 });
    expect(peakOf(x)).toBeCloseTo(0.8, 5);
    expect(x.every(Number.isFinite)).toBe(true);
    expect(peakOf(x.subarray(Math.floor(SR * 1.2)))).toBeLessThan(0.1);
  });

  it('the swell rises and falls (a breath, not a tone)', () => {
    const x = swellSamples(440, SR, 2, 30, 2);
    const third = Math.floor(x.length / 3);
    const mid = peakOf(x.subarray(third, 2 * third));
    expect(mid).toBeGreaterThan(peakOf(x.subarray(0, Math.floor(SR * 0.1))) * 2);
    expect(mid).toBeGreaterThan(peakOf(x.subarray(x.length - Math.floor(SR * 0.1))) * 2);
  });

  it('the motor hum loops without a jump at the seam', () => {
    const x = motorSamples(SR, 2, 48);
    const seam = Math.abs((x[x.length - 1] ?? 0) - (x[0] ?? 0));
    let maxStep = 0;
    for (let i = 1; i < x.length; i++) maxStep = Math.max(maxStep, Math.abs((x[i] ?? 0) - (x[i - 1] ?? 0)));
    expect(seam).toBeLessThan(maxStep * 3 + 1e-3);
  });

  it('noise is white-ish, bounded and seeded; reversed reverses', () => {
    const n = noiseSamples(SR, 1, 9);
    expect(peakOf(n)).toBeLessThanOrEqual(1);
    const mean = n.reduce((a, b) => a + b, 0) / n.length;
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Array.from(noiseSamples(SR, 0.1, 9))).toEqual(Array.from(noiseSamples(SR, 0.1, 9)));
    expect(Array.from(reversed(new Float32Array([1, 2, 3])))).toEqual([3, 2, 1]);
  });

  it('db helpers invert each other', () => {
    expect(gainToDb(dbToGain(-6))).toBeCloseTo(-6, 6);
    expect(dbToGain(-12)).toBeCloseTo(0.2512, 3);
  });
});

describe('master ceiling and saturation curves', () => {
  it('the ceiling is monotonic, odd, linear below the knee and never passes -1 dBFS', () => {
    const c = ceilingCurve();
    const ceiling = dbToGain(-1);
    let prev = -Infinity;
    for (let i = 0; i < c.length; i++) {
      const y = c[i] ?? 0;
      expect(y).toBeGreaterThanOrEqual(prev);
      expect(Math.abs(y)).toBeLessThan(ceiling);
      prev = y;
    }
    const mid = Math.floor(c.length * 0.75);
    expect(c[mid]).toBeCloseTo(((mid / (c.length - 1)) * 2 - 1) * 1, 3);
    expect((c[0] ?? 0) + (c[c.length - 1] ?? 0)).toBeCloseTo(0, 6);
  });

  it('the saturation curve is odd, monotonic and adds harmonics (it bends)', () => {
    const c = saturationCurve();
    expect((c[0] ?? 0) + (c[c.length - 1] ?? 0)).toBeCloseTo(0, 6);
    for (let i = 1; i < c.length; i++) expect(c[i] ?? 0).toBeGreaterThanOrEqual(c[i - 1] ?? 0);
    const quarter = c[Math.floor(c.length * 0.75)] ?? 0;
    expect(quarter).toBeGreaterThan(0.5); // bent above the straight line (0.5)
  });
});
