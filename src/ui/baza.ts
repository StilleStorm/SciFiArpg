import { t } from '../i18n';
import type { Bookmark } from '../save/bookmark';
import { describeMeta, downloadArchive, parseArchive, pickArchive } from '../save/export';
import type { MetaState } from '../save/save';
import { rosterStore } from './rosterStore';
import { h } from './dom';
import { openPopup, type Popup } from './popup';
import { createSheet, type Sheet } from './sheet';
import './base.css';

export interface BazaHandlers {
  /** "Nowe zgłoszenie": the ticket form opens as a sheet over the base. */
  onNewTicket(): void;
  /** "Wykaz spraw": back to the roster, to open another case file. */
  onOpenRoster(): void;
  /** Take up the ticket that was left unfinished (Zakończ, or the app was closed during a run): the exit of the base leads back into it. */
  onResume(bookmark: Bookmark): void;
  /** "Wróć do zgłoszenia": back through the service tunnel into the held run (only offered while a run is held). */
  onReturn?(): void;
  /** An archive file was read and the player confirmed: this save replaces the stored one (main.ts saves and applies it). */
  onImport?(meta: MetaState): void;
  /** The sheet was closed with "Zamknij". */
  onClose(): void;
}

/** The ticket that waits on its page while the player is in the base (world/tunnel.ts, main.ts). */
export interface TunnelWait {
  number: number;
  /** 1-based page number. */
  page: number;
}

export interface Baza {
  /** The desk sheet over the base page: profile, resume, "Nowe zgłoszenie" (the history is on the notice board). */
  open(meta: MetaState): void;
  close(): void;
  isOpen(): boolean;
  /** While a run is held the desk offers the return line and does not offer the bookmark (it is the same ticket); null clears it. */
  setTunnel(wait: TunnelWait | null): void;
}

/** The desk of the Asystent: the case file, resume line and the new ticket, as a sheet that scrolls in its own area (portrait and landscape). */
export function createBaza(root: HTMLElement, handlers: BazaHandlers): Baza {
  let sheet: Sheet | null = null;
  let waiting: TunnelWait | null = null;
  let current: MetaState | null = null;
  let confirm: Popup | null = null;

  const exportFile = (): void => {
    if (!current) return;
    sheet?.note(t(downloadArchive(current) ? 'screens.baza.exportDone' : 'screens.baza.exportFailed'));
  };
  const importFile = async (): Promise<void> => {
    const text = await pickArchive();
    if (text === null || !sheet) return;
    const res = parseArchive(text);
    if (!res.ok) {
      sheet.note(t(res.reason === 'newer' ? 'screens.baza.importNewer' : 'screens.baza.importBadFile'));
      return;
    }
    const info = describeMeta(res.meta);
    confirm?.close();
    confirm = openPopup(root, {
      title: t('screens.baza.importTitle'),
      body: [t('screens.baza.importBody', { hero: info.hero ? t(`screens.profile.${info.hero}`) : t('screens.baza.noHero'), level: info.level, tickets: info.tickets })],
      buttons: [
        {
          label: t('screens.baza.importConfirm'),
          onClick: () => {
            confirm?.close();
            handlers.onImport?.(res.meta);
            sheet?.note(t('screens.baza.importDone'));
          },
        },
        { label: t('screens.baza.importCancel'), quiet: true, onClick: () => confirm?.close() },
      ],
    });
  };
  const archiveLine = (label: string, note: string, id: string, onTap: () => void): HTMLElement => {
    const row = h('div', 'trow archive-row');
    const btn = h('button', 'link-btn', label);
    btn.type = 'button';
    btn.dataset['desk'] = id;
    btn.addEventListener('click', onTap);
    row.append(h('label', '', note), btn);
    return row;
  };

  const render = (meta: MetaState): void => {
    if (!sheet) return;
    current = meta;
    const scroll = sheet.scroll;
    scroll.replaceChildren();
    const heroName = meta.heroId ? t(`screens.profile.${meta.heroId}`) : t('screens.baza.noHero');

    const change = h('button', 'link-btn', t('screens.baza.openRoster'));
    change.type = 'button';
    change.dataset['desk'] = 'roster';
    change.addEventListener('click', handlers.onOpenRoster);
    const caseName = rosterStore().activeName();
    const file = h('div', 'trow');
    file.append(h('label', '', t('screens.baza.case')), h('span', 'tval', caseName ? t('screens.baza.caseNo', { name: caseName }) : t('screens.baza.noHero')), change);
    const profile = h('div', 'trow');
    profile.append(h('label', '', t('screens.baza.hero')), h('span', 'tval', heroName));
    const stars = h('div', 'trow');
    stars.append(h('label', '', t('screens.baza.gwiazdki')), h('span', 'tval', String(meta.character?.gwiazdki ?? 0)));

    const left = h('div', 'desk-col desk-col-a');
    const right = h('div', 'desk-col desk-col-b');
    if (waiting) {
      const back = h('button', 'resume-btn tunnel-return', t('screens.baza.tunnelReturn'));
      back.type = 'button';
      back.addEventListener('click', () => handlers.onReturn?.());
      const block = h('div', 'resume-line tunnel-line');
      block.append(h('p', 'tunnel-wait', t('screens.baza.tunnelWaiting', { number: waiting.number, page: waiting.page })), back, h('p', 'resume-note', t('screens.baza.tunnelNote')));
      left.append(block);
    }
    const mark = waiting ? undefined : meta.bookmark;
    if (mark) {
      const resume = h('button', 'resume-btn', t('screens.baza.resume', { number: mark.ticketNumber }));
      resume.type = 'button';
      resume.addEventListener('click', () => handlers.onResume(mark));
      const block = h('div', 'resume-line');
      block.append(resume, h('p', 'resume-note', t('screens.baza.resumeNote', { planet: mark.planetName, page: mark.pageIndex + 1 })));
      left.append(block);
    }
    const archive = h('div', 'archive');
    archive.append(
      h('h3', 'archive-title', t('screens.baza.archive')),
      archiveLine(t('screens.baza.archiveExport'), t('screens.baza.archiveExportNote'), 'export', exportFile),
      archiveLine(t('screens.baza.archiveImport'), t('screens.baza.archiveImportNote'), 'import', () => void importFile()),
    );
    right.append(file, profile, stars);
    const desk = h('div', 'desk');
    desk.append(...(left.childElementCount > 0 ? [left, right] : [right]));
    desk.classList.toggle('two', left.childElementCount > 0);
    desk.append(archive);
    scroll.append(desk);

    // the action is pinned under the scrolling area, so a long desk never pushes it off the page
    sheet.el.querySelector('.desk-actions')?.remove();
    const actions = h('div', 'desk-actions');
    const fresh = h('button', 'start', t('screens.baza.newTicket'));
    fresh.type = 'button';
    fresh.addEventListener('click', handlers.onNewTicket);
    actions.append(fresh);
    scroll.after(actions);
  };

  return {
    open(meta) {
      sheet?.remove();
      sheet = createSheet(root, { title: t('screens.base.deskTitle'), sub: t('screens.baza.agency'), onClose: handlers.onClose });
      sheet.el.classList.add('desk-sheet');
      sheet.note(t('screens.base.deskNote'));
      render(meta);
    },
    close() {
      confirm?.close();
      sheet?.remove();
      sheet = null;
    },
    isOpen: () => sheet !== null,
    setTunnel(wait) {
      waiting = wait;
    },
  };
}
