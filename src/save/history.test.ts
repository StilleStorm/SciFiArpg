import { describe, expect, it } from 'vitest';
import { isLost, markRewritten, pendingRewrites, recordRun, rewriteIndex } from './history';
import { HISTORY_MAX, defaultMeta, migrate, type MetaState } from './save';

const run = (n: number, outcome: 'zgloszenie' | 'ukonczono' = 'zgloszenie') => ({
  number: n,
  planet: `Planeta ${n}`,
  clause: 'parzystosc' as const,
  outcome,
  kills: 10,
  pages: 2,
  total: 5,
  gwiazdki: 7,
});

describe('Historia zgloszen', () => {
  it('records a run: history, count and banked gwiazdki', () => {
    const m = recordRun(defaultMeta(), run(48213));
    expect(m.history).toHaveLength(1);
    expect(m.runsCompleted).toBe(1);
    expect(m.gwiazdki).toBe(7);
    expect(m.history[0]).toMatchObject({ number: 48213, outcome: 'zgloszenie', pages: 2, total: 5 });
    expect(m.history[0]?.rewritten).toBeUndefined();
  });

  it('keeps only the latest entries', () => {
    let m: MetaState = defaultMeta();
    for (let i = 0; i < HISTORY_MAX + 5; i++) m = recordRun(m, run(i));
    expect(m.history).toHaveLength(HISTORY_MAX);
    expect(m.history[HISTORY_MAX - 1]?.number).toBe(HISTORY_MAX + 4);
  });

  it('rewrites only lost runs, once: pending until shown, then marked', () => {
    let m = recordRun(defaultMeta(), run(1, 'zgloszenie'));
    m = recordRun(m, run(2, 'ukonczono'));
    m = recordRun(m, run(3, 'zgloszenie'));
    expect(isLost('ukonczono')).toBe(false);
    expect(pendingRewrites(m)).toEqual([0, 2]);
    const shown = markRewritten(m, [0, 2]);
    expect(pendingRewrites(shown)).toEqual([]);
    expect(shown.history.map((e) => e.rewritten)).toEqual([true, undefined, true]);
    // the original outcome is kept so the struck line can still be printed
    expect(shown.history[0]?.outcome).toBe('zgloszenie');
    // a new loss is pending again
    expect(pendingRewrites(recordRun(shown, run(4)))).toEqual([3]);
    // marking does not mutate
    expect(m.history[0]?.rewritten).toBeUndefined();
  });

  it('picks the replacement outcome from the ticket number, stably', () => {
    const e = recordRun(defaultMeta(), run(48214)).history[0];
    expect(e).toBeDefined();
    if (!e) return;
    expect(rewriteIndex(e, 5)).toBe(48214 % 5);
    expect(rewriteIndex(e, 5)).toBe(rewriteIndex(e, 5));
    expect(rewriteIndex(e, 0)).toBe(0);
  });

  it('survives a round trip through the save format, with settings and unknown fields', () => {
    const m = recordRun({ ...defaultMeta(), settings: { theme: 'night', leftHanded: true } }, run(9));
    const back = migrate(JSON.parse(JSON.stringify({ ...m, futureField: 3 })));
    expect(back.history).toEqual(m.history);
    expect(back.settings).toEqual({ theme: 'night', leftHanded: true });
    expect(back['futureField']).toBe(3);
    expect(migrate({ history: [{ nonsense: true }, null, 4], settings: { theme: 'blue' } })).toEqual(defaultMeta());
  });
});
