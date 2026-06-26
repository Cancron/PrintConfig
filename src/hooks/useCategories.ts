import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product, ProductCategory } from '../types';
import { api } from '../lib/api';
import { loadCategories } from '../lib/storage';
import { cloneProductConfiguration } from '../lib/productConfig';
import { useWorkspace } from './useWorkspace';

export function useCategories() {
  const { account, selectedMerchantId } = useWorkspace();
  const [allCategories, setAllCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listCategories(account.id, selectedMerchantId)
      .then((items) => { if (!cancelled) { setAllCategories(items); setError(null); } })
      .catch((err) => { if (!cancelled) { setAllCategories(loadCategories()); setError(err instanceof Error ? err.message : 'Could not load categories from API.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [account.id, selectedMerchantId]);

  const categories = useMemo(() => allCategories.filter((category) => category.accountId === account.id && (category.scope === 'shared' || category.merchantId === selectedMerchantId)).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [account.id, allCategories, selectedMerchantId]);

  const addCategory = useCallback((category: ProductCategory) => {
    setAllCategories((prev) => [...prev, category]);
    api.createCategory(category).then((saved) => setAllCategories((prev) => prev.map((item) => (item.id === category.id ? saved : item)))).catch((err) => setError(err instanceof Error ? err.message : 'Could not create category.'));
  }, []);

  const updateCategory = useCallback((updated: ProductCategory) => {
    setAllCategories((prev) => prev.map((category) => (category.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : category)));
    api.updateCategory(updated).then((saved) => setAllCategories((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))).catch((err) => setError(err instanceof Error ? err.message : 'Could not update category.'));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setAllCategories((prev) => prev.filter((category) => category.id !== id));
    api.deleteCategory(id).catch((err) => setError(err instanceof Error ? err.message : 'Could not delete category.'));
  }, []);

  const duplicateCategory = useCallback((category: ProductCategory, products: Product[] = [], includeProducts = false) => {
    const now = new Date().toISOString();
    const id = `cat-${Date.now()}`;
    const copy: ProductCategory = { ...category, id, name: `${category.name} Copy`, slug: `${category.slug}-copy-${Date.now()}`, status: 'draft', accountId: account.id, scope: category.scope, merchantId: category.scope === 'merchant' ? selectedMerchantId : null, createdAt: now, updatedAt: now };
    const copiedProducts = includeProducts ? products.map((product) => ({ ...cloneProductConfiguration(product, { addCopySuffix: true, accountId: account.id, scope: copy.scope, merchantId: copy.scope === 'merchant' ? selectedMerchantId : null }), categoryId: id, categorySnapshot: copy })) : [];
    setAllCategories((prev) => [...prev, copy]);
    api.duplicateCategory(category.id, includeProducts).then((result) => { if (result?.category) setAllCategories((prev) => prev.map((item) => (item.id === copy.id ? { ...result.category, id: result.category.id ?? result.category._id } : item))); }).catch(() => undefined);
    return { category: copy, products: copiedProducts };
  }, [account.id, selectedMerchantId]);

  return { categories, allCategories, account, selectedMerchantId, addCategory, updateCategory, deleteCategory, duplicateCategory, loading, error };
}
