import { useState, useCallback, useEffect } from 'react';
import type { Product } from '../types';
import { loadProducts, saveProducts } from '../lib/storage';
import { cloneProductConfiguration } from '../lib/productConfig';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>(() => loadProducts());

  useEffect(() => {
    saveProducts(products);
  }, [products]);

  const addProduct = useCallback((product: Product) => {
    setProducts((prev) => [...prev, product]);
  }, []);

  const updateProduct = useCallback((updated: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : p))
    );
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const duplicateProduct = useCallback(
    (id: string) => {
      const source = products.find((p) => p.id === id);
      if (!source) return null;
      const copy = cloneProductConfiguration(source, true);
      setProducts((prev) => [...prev, copy]);
      return copy.id;
    },
    [products]
  );

  return { products, addProduct, updateProduct, deleteProduct, duplicateProduct };
}
