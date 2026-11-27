/**
 * Zaswiadczenia (PLAN 3.5, STORY 5): what the Komisja certifies about a case file, listed at the board. Pure and derived: nothing
 * is stored, so a certificate cannot be lost and an older save has the ones its campaign already earned. Three for the acts (every
 * planet of the act closed), one for the closed case, three for the pisma of the Komisja's case against the applicant (every
 * zgloszenie dodatkowe is one letter in it, STORY 8.16).
 */
import type { CampaignState } from './campaign';

export type CertificateId = 'akt1' | 'akt2' | 'akt3' | 'sprawa' | 'pisma1' | 'pisma10' | 'pisma25';

export interface Certificate {
  id: CertificateId;
  /** `screens.certs.<id>.name|text` */
  key: string;
  /** Pisma count the certificate states (pisma tiers only). */
  count?: number;
}

/** Zgloszenia dodatkowe that earn the three pisma certificates. */
export const PISMA_TIERS: readonly [number, number, number] = [1, 10, 25];

const ACT_PLANETS: readonly (readonly number[])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
];

/** The certificates `c` has earned, in the order the board lists them. */
export function certificatesOf(c: CampaignState): Certificate[] {
  const out: Certificate[] = [];
  ACT_PLANETS.forEach((planets, i) => {
    if (planets.every((p) => c.closed.includes(p))) out.push({ id: `akt${i + 1}` as CertificateId, key: `screens.certs.akt${i + 1}` });
  });
  if (c.caseClosed) out.push({ id: 'sprawa', key: 'screens.certs.sprawa' });
  PISMA_TIERS.forEach((n) => {
    if (c.extras >= n) out.push({ id: `pisma${n}` as CertificateId, key: `screens.certs.pisma${n}`, count: n });
  });
  return out;
}
