import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product, ProductCategory } from '../types';
import { loadCategories, saveCategories } from '../lib/storage';
import { cloneProductConfiguration } from '../lib/productConfig';
import { useWorkspace } from './useWorkspace';

export function useCategories() {
  const { account, selectedMerchantId } = useWorkspace();
  const [allCategories, setAllCategories] = useState<ProductCategory[]>(() => loadCategories());

  useEffect(() => {
    saveCategories(allCategories);
  }, [allCategories]);

  const categories = useMemo(
    () => allCategories.filter((category) => category.accountId === account.id && (category.scope === 'shared' || category.merchantId === selectedMerchantId)).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [account.id, allCategories, selectedMerchantId]
  );

  const addCategory = useCallback((category: ProductCategory) => {
    setAllCategories((prev) => [...prev, category]);
  }, []);

  const updateCategory = useCallback((updated: ProductCategory) => {
    setAllCategories((prev) => prev.map((category) => (category.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : category)));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setAllCategories((prev) => prev.filter((category) => category.id !== id));
  }, []);

  const duplicateCategory = useCallback((category: ProductCategory, products: Product[] = [], includeProducts = false) => {
    const now = new Date().toISOString();
    const id = `cat-${Date.now()}`;
    const copy: ProductCategory = {
      ...category,
      id,
      name: `${category.name} Copy`,
      slug: `${category.slug}-copy-${Date.now()}`,
      status: 'draft',
      accountId: account.id,
      scope: category.scope,
      merchantId: category.scope === 'merchant' ? selectedMerchantId : null,
      createdAt: now,
      updatedAt: now,
    };
    const copiedProducts = includeProducts
      ? products.map((product) => ({
          ...cloneProductConfiguration(product, { addCopySuffix: true, accountId: account.id, scope: copy.scope, merchantId: copy.scope === 'merchant' ? selectedMerchantId : null }),
          categoryId: id,
          categorySnapshot: copy,
        }))
      : [];
    setAllCategories((prev) => [...prev, copy]);
    return { category: copy, products: copiedProducts };
  }, [account.id, selectedMerchantId]);

  return { categories, allCategories, account, selectedMerchantId, addCategory, updateCategory, deleteCategory, duplicateCategory };
}

