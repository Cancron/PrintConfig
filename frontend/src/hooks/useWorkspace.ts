import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Account, Merchant } from '../types';
import { api } from '../lib/api';
import { loadAccount, loadMerchants, loadSelectedMerchantId, saveSelectedMerchantId, updateMerchant as persistMerchant } from '../lib/storage';

interface WorkspaceContextValue {
  account: Account;
  merchants: Merchant[];
  selectedMerchant?: Merchant;
  selectedMerchantId: string;
  setSelectedMerchantId: (merchantId: string) => void;
  updateMerchant: (merchant: Merchant) => void;
  loading: boolean;
  error: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [account] = useState(() => loadAccount());
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedMerchantId, setSelectedMerchantIdState] = useState(() => loadSelectedMerchantId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listMerchants(account._id)
      .then((items) => {
        if (!cancelled) {
          setMerchants(items);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMerchants(loadMerchants());
          setError(err instanceof Error ? err.message : 'Could not load merchants from API.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [account._id]);

  useEffect(() => {
    if (!merchants.some((merchant) => merchant._id === selectedMerchantId) && merchants[0]) {
      setSelectedMerchantIdState(merchants[0]._id);
      saveSelectedMerchantId(merchants[0]._id);
    }
  }, [merchants, selectedMerchantId]);

  const selectedMerchant = useMemo(() => merchants.find((merchant) => merchant._id === selectedMerchantId) ?? merchants[0], [merchants, selectedMerchantId]);

  const setSelectedMerchantId = useCallback((merchantId: string) => {
    setSelectedMerchantIdState(merchantId);
    saveSelectedMerchantId(merchantId);
  }, []);

  const updateMerchant = useCallback((merchant: Merchant) => {
    setMerchants((prev) => prev.map((item) => (item._id === merchant._id ? merchant : item)));
    api.updateMerchant(merchant).then((saved) => setMerchants((prev) => prev.map((item) => (item._id === saved._id ? saved : item)))).catch(() => setMerchants(persistMerchant(merchant)));
  }, []);

  const value = useMemo(() => ({ account, merchants, selectedMerchant, selectedMerchantId: selectedMerchant?._id ?? selectedMerchantId, setSelectedMerchantId, updateMerchant, loading, error }), [account, error, loading, merchants, selectedMerchant, selectedMerchantId, setSelectedMerchantId, updateMerchant]);

  return createElement(WorkspaceContext.Provider, { value }, children);
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider.');
  return context;
}
