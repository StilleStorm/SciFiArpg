import type { Bus } from '../core/events';
import { t } from '../i18n';
import { acceptUpdate, answerCookies, submitCode } from '../world/laws';
import type { RunState } from '../world/run';
import { h } from './dom';
import { openPopup, type Popup } from './popup';

/** Open the sheets that clauses ask for: cookie banner, update notice, SMS code. Returns the unbind function. */
export function bindLawSheets(root: HTMLElement, bus: Bus, getState: () => RunState | null): () => void {
  let open: Popup | null = null;
  const close = (): void => {
    open?.close();
    open = null;
  };
  const offAsk = bus.on('law:ask', (e) => {
    const s = getState();
    if (!s) return;
    close();
    switch (e.kind) {
      case 'cookies':
        open = openPopup(root, {
          title: t('laws.cookies.title'),
          className: 'cookie',
          body: [t('laws.cookies.body')],
          buttons: [
            { label: t('laws.cookies.all'), onClick: () => (close(), answerCookies(s, bus, 'all')) },
            { label: t('laws.cookies.minimal'), quiet: true, onClick: () => (close(), answerCookies(s, bus, 'minimal')) },
          ],
        });
        break;
      case 'update':
        open = openPopup(root, {
          title: t('laws.update.title'),
          body: [t('laws.update.body')],
          buttons: [{ label: t('laws.update.install'), onClick: () => (close(), acceptUpdate(s, bus)) }],
        });
        break;
      case 'code': {
        const code = s.law.code ?? '';
        const shown = h('p', 'code', `${code.slice(0, 3)} ${code.slice(3)}`);
        open = openPopup(root, {
          title: t('laws.code.title'),
          body: [t('laws.code.body'), shown],
          buttons: [{ label: t('laws.code.enter'), onClick: () => (close(), submitCode(s, bus)) }],
        });
        break;
      }
    }
  });
  const offScreen = bus.on('screen:changed', (e) => {
    if (e.screen !== 'run') close();
  });
  return () => {
    offAsk();
    offScreen();
    close();
  };
}
