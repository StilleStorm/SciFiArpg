/** Economy: gwiazdki, the Sklep with its service fee and lies, office hours (DESIGN section 9.2). */
export interface Wallet {
  gwiazdki: number;
}

export function emptyWallet(): Wallet {
  return { gwiazdki: 0 };
}

export * from './stars';
export * from './hours';
export * from './sklep';
