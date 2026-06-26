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

      const now = new Date().toISOString();
      const productId = `p-${Date.now()}`;
      const copy: Product = {
        ...source,
        id: productId,
        name: `${source.name} (Copy)`,
        slug: `${source.slug}-copy`,
        status: 'Draft',
        createdAt: now,
        updatedAt: now,
        variants: source.variants.map((variant) => {
          const variantId = `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          return {
            ...variant,
            id: variantId,
            productId,
            status: 'Draft',
            createdAt: now,
            updatedAt: now,
            surfaces: variant.surfaces.map((surface) => ({
              ...surface,
              id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              variantId,
              createdAt: now,
              updatedAt: now,
            })),
          };
        }),
      };
      return [...prev, copy];
    });
  }, []);

  return { products, addProduct, updateProduct, deleteProduct, duplicateProduct };
}
