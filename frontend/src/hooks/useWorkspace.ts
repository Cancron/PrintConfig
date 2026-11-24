import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Account, Merchant } from '../types';
import { api } from '../lib/api';
import { loadAccount, loadMerchants, loadSelectedMerchantId, saveSelectedMerchantId, updateMerchant as persistMerchant } from '../lib/storage';
import { useAuth } from './useAuth';

interface WorkspaceContextValue {
  account: Account;
  merchants: Merchant[];
  selectedMerchant?: Merchant;
  selectedMerchantId: string;
  setSelectedMerchantId: (merchantId: string) => void;
  createMerchant: (input: Pick<Merchant, 'name' | 'slug' | 'status'>) => Promise<Merchant>;
  updateMerchant: (merchant: Merchant) => void;
  loading: boolean;
  error: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const account = useMemo(() => ({ ...loadAccount(), id: user?.accountId ?? '' }), [user?.accountId]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedMerchantId, setSelectedMerchantIdState] = useState(() => loadSelectedMerchantId(account.id));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMerchants([]);
    setSelectedMerchantIdState(loadSelectedMerchantId(account.id));
    if (!account.id) { setLoading(false); return; }
    setLoading(true);
    api.listMerchants(account.id)
      .then((items) => {
        if (!cancelled) {
          setMerchants(items.filter((merchant) => merchant.accountId === account.id));
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMerchants(loadMerchants().filter((merchant) => merchant.accountId === account.id));
          setError(err instanceof Error ? err.message : 'Could not load merchants from API.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [account.id]);

  const accountMerchants = useMemo(() => merchants.filter((merchant) => merchant.accountId === account.id), [account.id, merchants]);

  useEffect(() => {
    if (!accountMerchants.some((merchant) => merchant.id === selectedMerchantId) && accountMerchants[0]) {
      setSelectedMerchantIdState(accountMerchants[0].id);
      saveSelectedMerchantId(account.id, accountMerchants[0].id);
    }
  }, [account.id, accountMerchants, selectedMerchantId]);

  const selectedMerchant = useMemo(() => accountMerchants.find((merchant) => merchant.id === selectedMerchantId) ?? accountMerchants[0], [accountMerchants, selectedMerchantId]);

  const setSelectedMerchantId = useCallback((merchantId: string) => {
    if (!accountMerchants.some((merchant) => merchant.id === merchantId)) return;
    setSelectedMerchantIdState(merchantId);
    saveSelectedMerchantId(account.id, merchantId);
  }, [account.id, accountMerchants]);

  const createMerchant = useCallback(async (input: Pick<Merchant, 'name' | 'slug' | 'status'>) => {
    const saved = await api.createMerchant({ ...input, accountId: account.id });
    setMerchants((prev) => [...prev, saved]);
    setSelectedMerchantIdState(saved.id);
    saveSelectedMerchantId(account.id, saved.id);
    return saved;
  }, [account.id]);

  const updateMerchant = useCallback((merchant: Merchant) => {
    setMerchants((prev) => prev.map((item) => (item.id === merchant.id ? merchant : item)));
    api.updateMerchant(merchant).then((saved) => setMerchants((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))).catch(() => setMerchants(persistMerchant(merchant)));
  }, []);

  const value = useMemo(() => ({ account, merchants: accountMerchants, selectedMerchant, selectedMerchantId: selectedMerchant?.id ?? '', setSelectedMerchantId, createMerchant, updateMerchant, loading, error }), [account, accountMerchants, createMerchant, error, loading, selectedMerchant, setSelectedMerchantId, updateMerchant]);

  return createElement(WorkspaceContext.Provider, { value }, children);
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider.');
  return context;
}
