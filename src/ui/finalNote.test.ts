import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { LONG_NOTE } from './footnotes';

describe('the final footnote', () => {
  it('stays longer than LONG_NOTE, so the slip holds it alone (STORY 8.6); a shorter text must drop the constant first', () => {
    expect(t('story.finale.footnote').length).toBeGreaterThan(LONG_NOTE);
  });
});
