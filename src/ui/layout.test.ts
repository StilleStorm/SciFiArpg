import { describe, expect, it } from 'vitest';
import { defaultSteering, effectiveSteering, orientationOf, orientationSetting } from './layout';

describe('orientationOf', () => {
  it('is landscape when the window is wider than tall', () => {
    expect(orientationOf(844, 390)).toBe('landscape');
    expect(orientationOf(1920, 1080)).toBe('landscape');
  });
  it('is portrait when taller, and for a square window', () => {
    expect(orientationOf(390, 844)).toBe('portrait');
    expect(orientationOf(600, 600)).toBe('portrait');
  });
});

describe('steering default', () => {
  it('is joystick in landscape and tap in portrait', () => {
    expect(defaultSteering('landscape')).toBe('joystick');
    expect(defaultSteering('portrait')).toBe('tap');
  });
  it('follows the orientation until the player chooses', () => {
    expect(effectiveSteering({}, 'landscape')).toBe('joystick');
    expect(effectiveSteering({}, 'portrait')).toBe('tap');
    // a stored value without the "touched" flag is only the default that was once in force
    expect(effectiveSteering({ steering: 'tap' }, 'landscape')).toBe('joystick');
  });
  it('is remembered once the player changed it, in either orientation', () => {
    expect(effectiveSteering({ steering: 'tap', steeringTouched: true }, 'landscape')).toBe('tap');
    expect(effectiveSteering({ steering: 'joystick', steeringTouched: true }, 'portrait')).toBe('joystick');
  });
});

describe('orientation setting', () => {
  it('is landscape unless the player asked for portrait', () => {
    expect(orientationSetting({})).toBe('landscape');
    expect(orientationSetting({ orientation: 'portrait' })).toBe('portrait');
  });
});
