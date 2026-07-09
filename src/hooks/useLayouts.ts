import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Collage, LayoutCategory, LayoutTemplate } from '../types';
import { api } from '../lib/api';
import { useWorkspace } from './useWorkspace';

export function useLayouts(options: { loadCollages?: boolean } = {}) {
  const loadCollages = options.loadCollages !== false;
  const { account, selectedMerchantId } = useWorkspace();
  const [categories, setCategories] = useState<LayoutCategory[]>([]);
  const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
  const [collages, setCollages] = useState<Collage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.listLayoutCategories(account._id, selectedMerchantId),
      api.listLayoutTemplates({ accountId: account._id, merchantId: selectedMerchantId }),
      loadCollages ? api.listCollages({ accountId: account._id, merchantId: selectedMerchantId }) : Promise.resolve([]),
    ])
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

  const visibleCategories = useMemo(() => categories.filter((category) => category.accountId === account._id && (category.scope === 'shared' || category.merchantId === selectedMerchantId)).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [account._id, categories, selectedMerchantId]);
  const visibleTemplates = useMemo(() => templates.filter((template) => template.accountId === account._id && (template.scope === 'shared' || template.merchantId === selectedMerchantId)).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [account._id, templates, selectedMerchantId]);
  const visibleCollages = useMemo(() => collages.filter((collage) => collage.accountId === account._id && (collage.scope === 'shared' || collage.merchantId === selectedMerchantId)).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [account._id, collages, selectedMerchantId]);

  const addCategory = useCallback(async (category: LayoutCategory) => {
    const saved = await api.createLayoutCategory(category);
    setCategories((prev) => [...prev, saved]);
    return saved;
  }, []);

  const updateCategory = useCallback(async (category: LayoutCategory) => {
    setCategories((prev) => prev.map((item) => (item._id === category._id ? category : item)));
    const saved = await api.updateLayoutCategory(category);
    setCategories((prev) => prev.map((item) => (item._id === saved._id ? saved : item)));
    return saved;
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    await api.deleteLayoutCategory(id);
    setCategories((prev) => prev.filter((item) => item._id !== id));
  }, []);

  const duplicateCategory = useCallback(async (id: string, includeTemplates: boolean) => {
    const result = await api.duplicateLayoutCategory(id, includeTemplates);
    setCategories((prev) => [...prev, result.category]);
    if (result.templates.length > 0) setTemplates((prev) => [...prev, ...result.templates]);
    return result;
  }, []);

  const addTemplate = useCallback(async (template: LayoutTemplate) => {
    const saved = await api.createLayoutTemplate(template);
    setTemplates((prev) => [...prev, saved]);
    return saved;
  }, []);

  const updateTemplate = useCallback(async (template: LayoutTemplate) => {
    setTemplates((prev) => prev.map((item) => (item._id === template._id ? template : item)));
    const saved = await api.updateLayoutTemplate(template);
    setTemplates((prev) => prev.map((item) => (item._id === saved._id ? saved : item)));
    return saved;
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    await api.deleteLayoutTemplate(id);
    setTemplates((prev) => prev.filter((item) => item._id !== id));
  }, []);

  const duplicateTemplate = useCallback(async (id: string) => {
    const saved = await api.duplicateLayoutTemplate(id);
    setTemplates((prev) => [...prev, saved]);
    return saved;
  }, []);
  const addCollage = useCallback(async (collage: Collage) => {
    const saved = await api.createCollage(collage);
    setCollages((prev) => [...prev, saved]);
    return saved;
  }, []);

  const updateCollage = useCallback(async (collage: Collage) => {
    setCollages((prev) => prev.map((item) => (item._id === collage._id ? collage : item)));
    const saved = await api.updateCollage(collage);
    setCollages((prev) => prev.map((item) => (item._id === saved._id ? saved : item)));
    return saved;
  }, []);

  const deleteCollage = useCallback(async (id: string) => {
    await api.deleteCollage(id);
    setCollages((prev) => prev.filter((item) => item._id !== id));
  }, []);

  const duplicateCollage = useCallback(async (id: string) => {
    const saved = await api.duplicateCollage(id);
    setCollages((prev) => [...prev, saved]);
    return saved;
  }, []);

  return { account, selectedMerchantId, categories: visibleCategories, allCategories: categories, templates: visibleTemplates, allTemplates: templates, collages: visibleCollages, allCollages: collages, loading, error, reload: load, addCategory, updateCategory, deleteCategory, duplicateCategory, addTemplate, updateTemplate, deleteTemplate, duplicateTemplate, addCollage, updateCollage, deleteCollage, duplicateCollage };
}
