export const WALLET_BULK_MAX_ENTRIES = 200;
export const WALLET_BULK_MAX_AMOUNT = 100_000;

export function walletBulkLimitError(providedCount?: number): string {
  const base = `Max ${WALLET_BULK_MAX_ENTRIES} allowed`;
  if (providedCount != null && providedCount > WALLET_BULK_MAX_ENTRIES) {
    return `${base}. You provided ${providedCount}.`;
  }
  return base;
}

export function assertWalletBulkEntryLimit(count: number): void {
  if (count > WALLET_BULK_MAX_ENTRIES) {
    throw new Error(walletBulkLimitError(count));
  }
}

export const WALLET_CREDIT_PUSH_DEFAULT_TITLE = 'Wallet credited';
export const WALLET_CREDIT_PUSH_DEFAULT_MESSAGE =
  '{amount} added to your MyFNG wallet. Balance: {balance}';

export type WalletCreditPushVars = {
  amount: string;
  balance: string;
  name: string;
};

export function renderWalletCreditPushTemplate(template: string, vars: WalletCreditPushVars): string {
  return template
    .replaceAll('{amount}', vars.amount)
    .replaceAll('{balance}', vars.balance)
    .replaceAll('{name}', vars.name);
}
