/**
 * Whether a story text exists (`src/i18n/pl/story.json`, keys `story.<path>`). The frames that take their lines from the story file
 * (cards, Spor, the boss variant) fall back to the placeholders and the family tables for a planet whose keys are not written yet;
 * `t()` would answer a missing key with the key itself and a console warning, so they ask first. Read-only: the file is the voice's.
 */
import story from '../../i18n/pl/story.json';

/** True when `story.<path>` is a string or a plural object, e.g. `hasStory('p1.card.lines.1')`. */
export function hasStory(path: string): boolean {
  let node: unknown = story;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' || (typeof node === 'object' && node !== null && 'one' in node);
}
