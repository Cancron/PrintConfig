import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProductCategory } from '../types';
import { api } from '../lib/api';
import { loadCategories } from '../lib/storage';
import { useWorkspace } from './useWorkspace';

export function useCategories() {
  const { account, selectedMerchantId } = useWorkspace();
  const [allCategories, setAllCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.listCategories(account._id, selectedMerchantId)
      .then((items) => { if (!cancelled) { setAllCategories(items); setError(null); } })
      .catch((err) => { if (!cancelled) { setAllCategories(loadCategories()); setError(err instanceof Error ? err.message : 'Could not load categories from API.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [account._id, selectedMerchantId]);

  const categories = useMemo(() => allCategories.filter((category) => category.accountId === account._id && (category.scope === 'shared' || category.merchantId === selectedMerchantId)).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [account._id, allCategories, selectedMerchantId]);

  const addCategory = useCallback(async (category: ProductCategory) => {
    try {
      const saved = await api.createCategory(category);
      setAllCategories((prev) => [...prev, saved]);
      setError(null);
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create category.');
      throw err;
    }
  }, []);

  const updateCategory = useCallback((updated: ProductCategory) => {
    setAllCategories((prev) => prev.map((category) => (category._id === updated._id ? { ...updated, updatedAt: new Date().toISOString() } : category)));
    api.updateCategory(updated).then((saved) => setAllCategories((prev) => prev.map((item) => (item._id === saved._id ? saved : item)))).catch((err) => setError(err instanceof Error ? err.message : 'Could not update category.'));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setAllCategories((prev) => prev.filter((category) => category._id !== id));
    api.deleteCategory(id).catch((err) => setError(err instanceof Error ? err.message : 'Could not delete category.'));
  }, []);

  const duplicateCategory = useCallback(async (category: ProductCategory, includeProducts = false) => {
    try {
      const result = await api.duplicateCategory(category._id, includeProducts);
      setAllCategories((prev) => [...prev, result.category]);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not duplicate category.');
      return null;
    }
  }, []);

  return { categories, allCategories, account, selectedMerchantId, addCategory, updateCategory, deleteCategory, duplicateCategory, loading, error };
}