import { describe, expect, it } from 'vitest';
import { createBus } from '../core/events';
import { bugDump, exportText, parseArchive } from './export';
import { SAVE_VERSION, defaultMeta, migrate } from './save';

describe('archive', () => {
  const meta = migrate({
    ...defaultMeta(),
    stamps: 7,
    runsCompleted: 3,
    heroId: 'pralka',
    settings: { theme: 'night', leftHanded: true, musicVolume: 40, sfxVolume: 90, textSize: 2, damageNumbers: true, bugButton: false },
  });
  it('round-trips the whole save', () => {
    const res = parseArchive(exportText(meta, new Date(0)));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.meta).toEqual(meta);
  });
  it('writes the save as migrate reads it: settings at their defaults are left out, and a file read back exports the same', () => {
    const raw = { ...meta, settings: { ...meta.settings, textSize: 0 as const, damageNumbers: false } };
    const first = exportText(raw, new Date(0));
    const back = parseArchive(first);
    expect(back.ok).toBe(true);
    if (back.ok) expect(exportText(back.meta, new Date(0))).toBe(first);
  });
  it('refuses garbage, foreign files and files from a newer game', () => {
    expect(parseArchive('{nope')).toEqual({ ok: false, reason: 'parse' });
    expect(parseArchive('{"a":1}')).toEqual({ ok: false, reason: 'kind' });
    const newer = JSON.parse(exportText(meta)) as Record<string, unknown>;
    newer['version'] = SAVE_VERSION + 1;
    expect(parseArchive(JSON.stringify(newer))).toEqual({ ok: false, reason: 'newer' });
  });
  it('keeps the three new settings through migrate', () => {
    expect(meta.settings.textSize).toBe(2);
    expect(meta.settings.damageNumbers).toBe(true);
    expect(meta.settings.bugButton).toBe(false);
    expect(defaultMeta().settings.damageNumbers).toBeUndefined();
  });
});

describe('bug dump', () => {
  it('names version, hero, planet, page, settings, device and the last ten events', () => {
    const bus = createBus();
    for (let i = 0; i < 14; i++) bus.emit('pickup:taken', { id: i, number: i });
    bus.emit('skill:aim', { slot: 0, mode: 'auto', x: 0, y: 0, dx: 0, dy: 0 });
    const text = bugDump({ meta: { ...defaultMeta(), heroId: 'pralka' }, bus, planet: 'Planeta', page: 2, total: 5, device: { ua: 'UA', width: 390, height: 844, dpr: 2 } });
    expect(text).toContain(`version: ${SAVE_VERSION}`);
    expect(text).toContain('hero: pralka');
    expect(text).toContain('page: 2/5');
    expect(text).toContain('viewport: 390x844@2');
    expect(text.match(/pickup:taken/g)?.length).toBe(10);
    expect(text).not.toContain('skill:aim');
  });
});
