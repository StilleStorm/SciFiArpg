import type { Bus } from '../core/events';
import { t } from '../i18n';

/** Serial numbers in the report start here (nr ewidencyjny). */
const SERIAL_BASE = 4400;

/**
 * PLACEHOLDER narration: three notes so the footnote area has something to say.
 * The narration agent replaces this with the real generator (wrong notes, corrections).
 */
export function bindPlaceholderNotes(bus: Bus): void {
  let firstKill = true;
  const say = (text: string): void => bus.emit('footnote', { text });
  bus.on('run:started', () => {
    firstKill = true;
    say(t('ui.note.start'));
  });
  bus.on('enemy:died', (e) => {
    if (!firstKill) return;
    firstKill = false;
    say(t('ui.note.firstKill', { n: SERIAL_BASE + e.id }));
  });
  bus.on('pickup:taken', (e) => say(t('ui.note.pickup', { n: e.number })));
}
