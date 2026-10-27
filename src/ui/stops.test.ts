import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { newCampaign } from '../world/campaign';
import { stopRows } from '../world/stops';
import { stopBlocks } from './stops';

describe('the stop board model', () => {
  it('names each open planet and numbers its stops from 1', () => {
    const blocks = stopBlocks(stopRows({ ...newCampaign(), current: 2, closed: [0, 1] }, { 0: [0, 2], 1: [4] }));
    expect(blocks.map((b) => b.planet)).toEqual([0, 1, 2]);
    expect(blocks[0]?.pages).toEqual([1, 3]);
    expect(blocks[1]?.pages).toEqual([5]);
    expect(blocks[2]?.pages).toEqual([]);
    expect(blocks[0]?.title).toBe(t('planets.p1.name'));
  });

  it('has the words it prints', () => {
    for (const key of ['screens.stops.title', 'screens.stops.sub', 'screens.stops.note', 'screens.stops.none', 'ui.stop.plate1', 'ui.stop.plate2', 'ui.stop.stamp', 'screens.base.station.przystanek']) {
      expect(t(key)).not.toBe(key);
    }
    expect(t('screens.stops.go', { page: 3 })).toContain('3');
    expect(t('ui.note.stopRegistered', { page: 3 })).toContain('3');
    expect(t('ui.note.stopLeft', { page: 3 })).toContain('3');
    for (const key of ['screens.stops.title', 'ui.note.stopRegistered', 'ui.note.stopLeft', 'screens.stops.note']) expect(t(key)).not.toContain('!');
  });
});
