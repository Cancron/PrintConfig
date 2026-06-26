import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product, ProductScope } from '../types';
import { api } from '../lib/api';
import { loadCategories, loadProducts } from '../lib/storage';
import { cloneProductConfiguration } from '../lib/productConfig';
import { useWorkspace } from './useWorkspace';

export function useProducts() {
  const { account, selectedMerchantId } = useWorkspace();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listProducts(account.id, selectedMerchantId)
      .then((items) => { if (!cancelled) { setAllProducts(items); setError(null); } })
      .catch((err) => { if (!cancelled) { setAllProducts(loadProducts()); setError(err instanceof Error ? err.message : 'Could not load products from API.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [account.id, selectedMerchantId]);

  const products = useMemo(() => allProducts.filter((product) => product.accountId === account.id && (product.scope === 'shared' || product.merchantId === selectedMerchantId)), [account.id, allProducts, selectedMerchantId]);

  const addProduct = useCallback((product: Product) => {
    setAllProducts((prev) => [...prev, product]);
    api.createProduct(product).then((saved) => setAllProducts((prev) => prev.map((item) => (item.id === product.id ? saved : item)))).catch((err) => setError(err instanceof Error ? err.message : 'Could not create product.'));
  }, []);

  const updateProduct = useCallback((updated: Product) => {
    setAllProducts((prev) => prev.map((product) => (product.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : product)));
    api.updateProduct(updated).then((saved) => setAllProducts((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))).catch((err) => setError(err instanceof Error ? err.message : 'Could not update product.'));
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setAllProducts((prev) => prev.filter((product) => product.id !== id));
    api.deleteProduct(id).catch((err) => setError(err instanceof Error ? err.message : 'Could not delete product.'));
  }, []);

  const duplicateProduct = useCallback((id: string, targetScope?: ProductScope) => {
    const source = allProducts.find((product) => product.id === id);
    if (!source) return null;
    const scope = targetScope ?? source.scope;
    const categories = loadCategories();
    const copy = cloneProductConfiguration(source, { addCopySuffix: true, accountId: account.id, scope, merchantId: scope === 'merchant' ? selectedMerchantId : null });
    copy.categorySnapshot = categories.find((category) => category.id === copy.categoryId);
    setAllProducts((prev) => [...prev, copy]);
    api.duplicateProduct(id, scope, scope === 'merchant' ? selectedMerchantId : null).then((saved) => setAllProducts((prev) => prev.map((item) => (item.id === copy.id ? saved : item)))).catch(() => undefined);
    return copy.id;
  }, [account.id, allProducts, selectedMerchantId]);

  return { products, allProducts, account, selectedMerchantId, addProduct, updateProduct, deleteProduct, duplicateProduct, loading, error };
}
