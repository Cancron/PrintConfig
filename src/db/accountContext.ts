import { AsyncLocalStorage } from 'node:async_hooks';

const accountContext = new AsyncLocalStorage<string>();

export function withAccountContext<T>(accountId: string, work: () => T): T {
  return accountContext.run(accountId, work);
}

export function currentAccountId() {
  return accountContext.getStore();
}
