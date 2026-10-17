/** Stub. Economy agent: Sklep prices, service fee, vendor lie rate, problem reports. */
export interface Wallet {
  gwiazdki: number;
}

export function emptyWallet(): Wallet {
  return { gwiazdki: 0 };
}
