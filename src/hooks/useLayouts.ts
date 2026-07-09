import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Collage, LayoutCategory, LayoutTemplate } from '../types';
import { api } from '../lib/api';
import { useWorkspace } from './useWorkspace';

interface LayoutCacheEntry {
  categories?: LayoutCategory[];
  templates?: LayoutTemplate[];
  collages?: Collage[];
  categoriesPromise?: Promise<LayoutCategory[]>;
  templatesPromise?: Promise<LayoutTemplate[]>;
  collagesPromise?: Promise<Collage[]>;
}

interface PagedCollageResult {
  items: Collage[];
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
}

type PagedCollageFilters = Parameters<typeof api.listCollagesPaged>[0];

const layoutCache = new Map<string, LayoutCacheEntry>();
const pagedCollageCache = new Map<string, PagedCollageResult>();
const pagedCollagePromises = new Map<string, Promise<PagedCollageResult>>();

function cacheKey(accountId: string, merchantId: string) {
  return `${accountId}::${merchantId}`;
}

function getLayoutCache(accountId: string, merchantId: string) {
  const key = cacheKey(accountId, merchantId);
  let entry = layoutCache.get(key);
  if (!entry) {
    entry = {};
    layoutCache.set(key, entry);
  }
  return entry;
}

function invalidatePagedCollages(accountId?: string, merchantId?: string) {
  const prefix = accountId && merchantId ? `${accountId}::${merchantId}::` : '';
  for (const key of pagedCollageCache.keys()) {
    if (!prefix || key.startsWith(prefix)) pagedCollageCache.delete(key);
  }
  for (const key of pagedCollagePromises.keys()) {
    if (!prefix || key.startsWith(prefix)) pagedCollagePromises.delete(key);
  }
}

function pagedKey(filters: PagedCollageFilters) {
  return [
    filters.accountId,
    filters.merchantId,
    filters.categoryId ?? '',
    filters.scope ?? '',
    filters.status ?? '',
    filters.orientation ?? '',
    filters.search ?? '',
    filters.page,
    filters.pageSize,
  ].join('::');
}

export function useLayouts(options: { loadCollages?: boolean } = {}) {
  const loadCollages = options.loadCollages !== false;
  const { account, selectedMerchantId } = useWorkspace();
  const [categories, setCategories] = useState<LayoutCategory[]>([]);
  const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
  const [collages, setCollages] = useState<Collage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((force = false) => {
    let active = true;
    setLoading(true);
    const entry = getLayoutCache(account._id, selectedMerchantId);
    if (force) {
      entry.categories = undefined;
      entry.templates = undefined;
      if (loadCollages) entry.collages = undefined;
    }
    const categoriesPromise = entry.categories
      ? Promise.resolve(entry.categories)
      : entry.categoriesPromise ?? (entry.categoriesPromise = api.listLayoutCategories(account._id, selectedMerchantId).then((items) => {
        entry.categories = items;
        entry.categoriesPromise = undefined;
        return items;
      }).catch((error) => {
        entry.categoriesPromise = undefined;
        throw error;
      }));
    const templatesPromise = entry.templates
      ? Promise.resolve(entry.templates)
      : entry.templatesPromise ?? (entry.templatesPromise = api.listLayoutTemplates({ accountId: account._id, merchantId: selectedMerchantId }).then((items) => {
        entry.templates = items;
        entry.templatesPromise = undefined;
        return items;
      }).catch((error) => {
        entry.templatesPromise = undefined;
        throw error;
      }));
    const collagesPromise = !loadCollages
      ? Promise.resolve(entry.collages ?? [])
      : entry.collages
        ? Promise.resolve(entry.collages)
        : entry.collagesPromise ?? (entry.collagesPromise = api.listCollages({ accountId: account._id, merchantId: selectedMerchantId }).then((items) => {
          entry.collages = items;
          entry.collagesPromise = undefined;
          return items;
        }).catch((error) => {
          entry.collagesPromise = undefined;
          throw error;
        }));
    Promise.all([categoriesPromise, templatesPromise, collagesPromise])
      .then(([nextCategories, nextTemplates, nextCollages]) => {
        if (!active) return;
        setCategories(nextCategories);
        setTemplates(nextTemplates);
        setCollages(nextCollages);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load layouts from API.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [account._id, loadCollages, selectedMerchantId]);

  useEffect(() => load(), [load]);
  const reload = useCallback(() => load(true), [load]);

  const visibleCategories = useMemo(() => categories.filter((category) => category.accountId === account._id && (category.scope === 'shared' || category.merchantId === selectedMerchantId)).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [account._id, categories, selectedMerchantId]);
  const visibleTemplates = useMemo(() => templates.filter((template) => template.accountId === account._id && (template.scope === 'shared' || template.merchantId === selectedMerchantId)).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [account._id, templates, selectedMerchantId]);
  const visibleCollages = useMemo(() => collages.filter((collage) => collage.accountId === account._id && (collage.scope === 'shared' || collage.merchantId === selectedMerchantId)).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [account._id, collages, selectedMerchantId]);

  const addCategory = useCallback(async (category: LayoutCategory) => {
    const saved = await api.createLayoutCategory(category);
    const entry = getLayoutCache(account._id, selectedMerchantId);
    entry.categories = [...(entry.categories ?? categories), saved];
    entry.templates = undefined;
    setCategories((prev) => [...prev, saved]);
    return saved;
  }, [account._id, categories, selectedMerchantId]);

  const updateCategory = useCallback(async (category: LayoutCategory) => {
    setCategories((prev) => prev.map((item) => (item._id === category._id ? category : item)));
    const saved = await api.updateLayoutCategory(category);
    const entry = getLayoutCache(account._id, selectedMerchantId);
    entry.categories = (entry.categories ?? categories).map((item) => (item._id === saved._id ? saved : item));
    entry.templates = undefined;
    setCategories((prev) => prev.map((item) => (item._id === saved._id ? saved : item)));
    return saved;
  }, [account._id, categories, selectedMerchantId]);

  const deleteCategory = useCallback(async (id: string) => {
    await api.deleteLayoutCategory(id);
    const entry = getLayoutCache(account._id, selectedMerchantId);
    entry.categories = (entry.categories ?? categories).filter((item) => item._id !== id);
    entry.templates = undefined;
    setCategories((prev) => prev.filter((item) => item._id !== id));
  }, [account._id, categories, selectedMerchantId]);

  const duplicateCategory = useCallback(async (id: string, includeTemplates: boolean) => {
    const result = await api.duplicateLayoutCategory(id, includeTemplates);
    const entry = getLayoutCache(account._id, selectedMerchantId);
    entry.categories = [...(entry.categories ?? categories), result.category];
    if (includeTemplates) entry.templates = undefined;
    setCategories((prev) => [...prev, result.category]);
    if (result.templates.length > 0) setTemplates((prev) => [...prev, ...result.templates]);
    return result;
  }, [account._id, categories, selectedMerchantId]);

  const addTemplate = useCallback(async (template: LayoutTemplate) => {
    const saved = await api.createLayoutTemplate(template);
    const entry = getLayoutCache(account._id, selectedMerchantId);
    entry.templates = [...(entry.templates ?? templates), saved];
    setTemplates((prev) => [...prev, saved]);
    return saved;
  }, [account._id, selectedMerchantId, templates]);

  const updateTemplate = useCallback(async (template: LayoutTemplate) => {
    setTemplates((prev) => prev.map((item) => (item._id === template._id ? template : item)));
    const saved = await api.updateLayoutTemplate(template);
    const entry = getLayoutCache(account._id, selectedMerchantId);
    entry.templates = (entry.templates ?? templates).map((item) => (item._id === saved._id ? saved : item));
    setTemplates((prev) => prev.map((item) => (item._id === saved._id ? saved : item)));
    return saved;
  }, [account._id, selectedMerchantId, templates]);

  const deleteTemplate = useCallback(async (id: string) => {
    await api.deleteLayoutTemplate(id);
    const entry = getLayoutCache(account._id, selectedMerchantId);
    entry.templates = (entry.templates ?? templates).filter((item) => item._id !== id);
    setTemplates((prev) => prev.filter((item) => item._id !== id));
  }, [account._id, selectedMerchantId, templates]);

  const duplicateTemplate = useCallback(async (id: string) => {
    const saved = await api.duplicateLayoutTemplate(id);
    const entry = getLayoutCache(account._id, selectedMerchantId);
    entry.templates = [...(entry.templates ?? templates), saved];
    setTemplates((prev) => [...prev, saved]);
    return saved;
  }, [account._id, selectedMerchantId, templates]);
  const addCollage = useCallback(async (collage: Collage) => {
    const saved = await api.createCollage(collage);
    const entry = getLayoutCache(account._id, selectedMerchantId);
    if (entry.collages) entry.collages = [...entry.collages, saved];
    invalidatePagedCollages(account._id, selectedMerchantId);
    setCollages((prev) => [...prev, saved]);
    return saved;
  }, [account._id, selectedMerchantId]);

  const updateCollage = useCallback(async (collage: Collage) => {
    setCollages((prev) => prev.map((item) => (item._id === collage._id ? collage : item)));
    const saved = await api.updateCollage(collage);
    const entry = getLayoutCache(account._id, selectedMerchantId);
    if (entry.collages) entry.collages = entry.collages.map((item) => (item._id === saved._id ? saved : item));
    invalidatePagedCollages(account._id, selectedMerchantId);
    setCollages((prev) => prev.map((item) => (item._id === saved._id ? saved : item)));
    return saved;
  }, [account._id, selectedMerchantId]);

  const deleteCollage = useCallback(async (id: string) => {
    await api.deleteCollage(id);
    const entry = getLayoutCache(account._id, selectedMerchantId);
    if (entry.collages) entry.collages = entry.collages.filter((item) => item._id !== id);
    invalidatePagedCollages(account._id, selectedMerchantId);
    setCollages((prev) => prev.filter((item) => item._id !== id));
  }, [account._id, selectedMerchantId]);

  const duplicateCollage = useCallback(async (id: string) => {
    const saved = await api.duplicateCollage(id);
    const entry = getLayoutCache(account._id, selectedMerchantId);
    if (entry.collages) entry.collages = [...entry.collages, saved];
    invalidatePagedCollages(account._id, selectedMerchantId);
    setCollages((prev) => [...prev, saved]);
    return saved;
  }, [account._id, selectedMerchantId]);

  const listPagedCollages = useCallback(async (filters: Omit<PagedCollageFilters, 'accountId' | 'merchantId'>, force = false) => {
    const fullFilters = { ...filters, accountId: account._id, merchantId: selectedMerchantId };
    const key = pagedKey(fullFilters);
    if (!force && pagedCollageCache.has(key)) return pagedCollageCache.get(key)!;
    if (!force && pagedCollagePromises.has(key)) return pagedCollagePromises.get(key)!;
    const promise = api.listCollagesPaged(fullFilters).then((result) => {
      pagedCollageCache.set(key, result);
      pagedCollagePromises.delete(key);
      return result;
    }).catch((error) => {
      pagedCollagePromises.delete(key);
      throw error;
    });
    pagedCollagePromises.set(key, promise);
    return promise;
  }, [account._id, selectedMerchantId]);

  const invalidateCollageCache = useCallback(() => {
    const entry = getLayoutCache(account._id, selectedMerchantId);
    entry.collages = undefined;
    entry.collagesPromise = undefined;
    invalidatePagedCollages(account._id, selectedMerchantId);
  }, [account._id, selectedMerchantId]);

  return { account, selectedMerchantId, categories: visibleCategories, allCategories: categories, templates: visibleTemplates, allTemplates: templates, collages: visibleCollages, allCollages: collages, loading, error, reload, addCategory, updateCategory, deleteCategory, duplicateCategory, addTemplate, updateTemplate, deleteTemplate, duplicateTemplate, addCollage, updateCollage, deleteCollage, duplicateCollage, listPagedCollages, invalidateCollageCache };
}
