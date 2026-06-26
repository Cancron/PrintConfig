import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Product, ProductScope } from '../types';
import { loadProducts, saveProducts } from '../lib/storage';
import { cloneProductConfiguration } from '../lib/productConfig';
import { useWorkspace } from './useWorkspace';

export function useProducts() {
  const { account, selectedMerchantId } = useWorkspace();
  const [allProducts, setAllProducts] = useState<Product[]>(() => loadProducts());

  useEffect(() => {
    saveProducts(allProducts);
  }, [allProducts]);

  const products = useMemo(
    () => allProducts.filter((product) => product.accountId === account.id && (product.scope === 'shared' || product.merchantId === selectedMerchantId)),
    [account.id, allProducts, selectedMerchantId]
  );

  const addProduct = useCallback((product: Product) => {
    setAllProducts((prev) => [...prev, product]);
  }, []);

  const updateProduct = useCallback((updated: Product) => {
    setAllProducts((prev) => prev.map((p) => (p.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : p)));
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setAllProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const duplicateProduct = useCallback(
    (id: string, targetScope?: ProductScope) => {
      const source = allProducts.find((p) => p.id === id);
      if (!source) return null;
      const scope = targetScope ?? source.scope;
      const copy = cloneProductConfiguration(source, {
        addCopySuffix: true,
        accountId: account.id,
        scope,
        merchantId: scope === 'merchant' ? selectedMerchantId : null,
      });
      setAllProducts((prev) => [...prev, copy]);
      return copy.id;
    },
    [account.id, allProducts, selectedMerchantId]
  );

  return { products, allProducts, account, selectedMerchantId, addProduct, updateProduct, deleteProduct, duplicateProduct };
}
