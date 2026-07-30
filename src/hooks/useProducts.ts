import { useEffect, useState } from 'react';
import type { ProductSummary } from '../types';
import { api } from '../lib/api';
import { useWorkspace } from './useWorkspace';

export function useProducts() {
  const { account, selectedMerchantId } = useWorkspace();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listProductSummaries({
      accountId: account._id,
      merchantId: selectedMerchantId,
      page: 1,
      pageSize: 500,
    })
      .then((result) => {
        if (cancelled) return;
        setProducts(result.items);
        setError(null);
      })
      .catch((reason) => {
        if (cancelled) return;
        setProducts([]);
        setError(reason instanceof Error ? reason.message : 'Could not load products from API.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [account._id, selectedMerchantId]);

  return { products, account, selectedMerchantId, loading, error };
}
