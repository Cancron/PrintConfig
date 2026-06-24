import { useState, useCallback, useEffect } from 'react';
import type { Product } from '../types';
import { loadProducts, saveProducts } from '../lib/storage';

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

  const duplicateProduct = useCallback((id: string) => {
    setProducts((prev) => {
      const source = prev.find((p) => p.id === id);
      if (!source) return prev;
      const copy: Product = {
        ...source,
        id: `p-${Date.now()}`,
        name: `${source.name} (Copy)`,
        slug: `${source.slug}-copy`,
        status: 'Draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        variants: source.variants.map((v) => ({
          ...v,
          id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          productId: `p-${Date.now()}`,
          status: 'Draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      };
      return [...prev, copy];
    });
  }, []);

  return { products, addProduct, updateProduct, deleteProduct, duplicateProduct };
}
