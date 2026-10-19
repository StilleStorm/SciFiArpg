/**
 * Archiwum eksportowe: the whole save as one file, and back. Pure parts (envelope, parse, version check, bug dump) are
 * tested; the browser parts (download, file picker, clipboard) are small wrappers around them.
 */
import type { Bus } from '../core/events';
import { SAVE_VERSION, migrate, toStored, type MetaState } from './save';

export const ARCHIVE_KIND = 'zgloszenie-archiwum';
export const ARCHIVE_FORMAT = 1;
export const ARCHIVE_FILE = 'zgloszenie-archiwum.json';

export interface Archive {
  kind: typeof ARCHIVE_KIND;
  format: number;
  /** The save version the file was written with. */
  version: number;
  exportedAt: string;
  /** The stored shape (`toStored`): the roster and the shared archive, no mirror of the active character. */
  meta: Record<string, unknown>;
}

export type ImportResult =
  | { ok: true; meta: MetaState; version: number }
  | { ok: false; reason: 'parse' | 'kind' | 'newer' };

/** The save is written as `migrate` reads it (defaults left out), so a file read back exports byte for byte the same. */
export function buildArchive(meta: MetaState, now: Date = new Date()): Archive {
  return { kind: ARCHIVE_KIND, format: ARCHIVE_FORMAT, version: SAVE_VERSION, exportedAt: now.toISOString(), meta: toStored(meta) };
}

export function exportText(meta: MetaState, now?: Date): string {
  return JSON.stringify(buildArchive(meta, now), null, 1);
}

/** Read a file's text. A file from a newer game is refused; an older one goes through `migrate` like a stored save. */
export function parseArchive(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'parse' };
  }
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'kind' };
  const rec = raw as Record<string, unknown>;
  if (rec['kind'] !== ARCHIVE_KIND || typeof rec['meta'] !== 'object' || rec['meta'] === null) return { ok: false, reason: 'kind' };
  const version = typeof rec['version'] === 'number' ? rec['version'] : 0;
  if (version > SAVE_VERSION || rec['format'] !== ARCHIVE_FORMAT) return { ok: false, reason: 'newer' };
  return { ok: true, meta: migrate(rec['meta']), version };
}

/** What the confirmation form shows about the file about to replace the save. */
export function describeMeta(meta: MetaState): { hero: string | null; level: number; tickets: number; characters: number } {
  return { hero: meta.heroId ?? null, level: meta.character?.level ?? 1, tickets: meta.runsCompleted, characters: meta.characters.length };
}

export interface BugDumpInput {
  meta: MetaState;
  bus: Pick<Bus, 'recent'>;
  planet: string | null;
  page: number | null;
  total: number | null;
  device: { ua: string; width: number; height: number; dpr: number };
}

/** The short state dump the pause line copies. */
export function bugDump(i: BugDumpInput): string {
  const lines = [
    `version: ${SAVE_VERSION}`,
    `hero: ${i.meta.heroId ?? '-'}`,
    `planet: ${i.planet ?? '-'}`,
    `page: ${i.page ?? '-'}${i.total ? `/${i.total}` : ''}`,
    `settings: ${JSON.stringify(i.meta.settings)}`,
    `device: ${i.device.ua}`,
    `viewport: ${i.device.width}x${i.device.height}@${i.device.dpr}`,
    'events:',
    ...(i.bus.recent?.(10) ?? []).map((e) => `  ${e.name}${e.payload ? ` ${e.payload}` : ''}`),
  ];
  return lines.join('\n');
}

export function deviceInfo(): BugDumpInput['device'] {
  return { ua: navigator.userAgent, width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 };
}

/** Offer the archive as a download. False when the browser refused. */
export function downloadArchive(meta: MetaState): boolean {
  try {
    const blob = new Blob([exportText(meta)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = ARCHIVE_FILE;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Open the file picker; resolves with the file's text or null when nothing was chosen. */
export function pickArchive(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    });
    input.click();
  });
}

/** Copy text to the clipboard; false when the browser refused. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Ask once for persistent storage; never throws. */
export function requestPersistence(): void {
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    /* no storage manager */
  }
}
