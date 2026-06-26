import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Merchant } from '../types';
import {
  loadAccount,
  loadMerchants,
  loadSelectedMerchantId,
  saveSelectedMerchantId,
  updateMerchant as persistMerchant,
} from '../lib/storage';

export function useWorkspace() {
  const [account] = useState(() => loadAccount());
  const [merchants, setMerchants] = useState<Merchant[]>(() => loadMerchants());
  const [selectedMerchantId, setSelectedMerchantIdState] = useState(() => loadSelectedMerchantId());

  useEffect(() => {
    if (!merchants.some((merchant) => merchant.id === selectedMerchantId) && merchants[0]) {
      setSelectedMerchantIdState(merchants[0].id);
      saveSelectedMerchantId(merchants[0].id);
    }
  }, [merchants, selectedMerchantId]);

  const selectedMerchant = useMemo(
    () => merchants.find((merchant) => merchant.id === selectedMerchantId) ?? merchants[0],
    [merchants, selectedMerchantId]
  );

  const setSelectedMerchantId = useCallback((merchantId: string) => {
    setSelectedMerchantIdState(merchantId);
    saveSelectedMerchantId(merchantId);
  }, []);

  const updateMerchant = useCallback((merchant: Merchant) => {
    setMerchants(persistMerchant(merchant));
  }, []);

  return {
    account,
    merchants,
    selectedMerchant,
    selectedMerchantId: selectedMerchant?.id ?? selectedMerchantId,
    setSelectedMerchantId,
    updateMerchant,
  };
}
