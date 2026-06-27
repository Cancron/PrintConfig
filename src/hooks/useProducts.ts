import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product, ProductScope } from '../types';
import { api } from '../lib/api';
import { loadProducts } from '../lib/storage';
import { useWorkspace } from './useWorkspace';

export function useProducts() {
  const { account, selectedMerchantId } = useWorkspace();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listProducts(account._id, selectedMerchantId)
      .then((items) => { if (!cancelled) { setAllProducts(items); setError(null); } })
      .catch((err) => { if (!cancelled) { setAllProducts(loadProducts()); setError(err instanceof Error ? err.message : 'Could not load products from API.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [account._id, selectedMerchantId]);

  const products = useMemo(() => allProducts.filter((product) => product.accountId === account._id && (product.scope === 'shared' || product.merchantId === selectedMerchantId)), [account._id, allProducts, selectedMerchantId]);

  const addProduct = useCallback(async (product: Product) => {
    try {
      const saved = await api.createProduct(product);
      setAllProducts((prev) => [...prev, saved]);
      setError(null);
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create product.');
      throw err;
    }
  }, []);

  const updateProduct = useCallback((updated: Product) => {
    setAllProducts((prev) => prev.map((product) => (product._id === updated._id ? { ...updated, updatedAt: new Date().toISOString() } : product)));
    api.updateProduct(updated).then((saved) => setAllProducts((prev) => prev.map((item) => (item._id === saved._id ? saved : item)))).catch((err) => setError(err instanceof Error ? err.message : 'Could not update product.'));
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setAllProducts((prev) => prev.filter((product) => product._id !== id));
    api.deleteProduct(id).catch((err) => setError(err instanceof Error ? err.message : 'Could not delete product.'));
  }, []);

  const duplicateProduct = useCallback(async (id: string, targetScope?: ProductScope) => {
    const source = allProducts.find((product) => product._id === id);
    if (!source) return null;
    const scope = targetScope ?? source.scope;
    try {
      const saved = await api.duplicateProduct(id, scope, scope === 'merchant' ? selectedMerchantId : null);
      setAllProducts((prev) => [...prev, saved]);
      return saved._id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not duplicate product.');
      return null;
    }
  }, [allProducts, selectedMerchantId]);

  return { products, allProducts, account, selectedMerchantId, addProduct, updateProduct, deleteProduct, duplicateProduct, loading, error };
}