import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { useLayouts } from '../../hooks/useLayouts';
import type { LayoutTemplate, Product, ProductLayoutTemplateMode } from '../../types';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

const modeOptions: { value: ProductLayoutTemplateMode; label: string }[] = [
  { value: 'none', label: 'No layout templates' },
  { value: 'all', label: 'All active layout templates' },
  { value: 'specific', label: 'Specific layout templates' },
  { value: 'by-tags', label: 'Templates matching tags' },
];

export function LayoutSettingsTab({ product, onSave }: Props) {
  const { templates, loading, error } = useLayouts({ loadCollages: false });
  const current = product.layoutSettings;
  const [mode, setMode] = useState<ProductLayoutTemplateMode>(current.mode ?? (current.enabled ? 'all' : 'none'));
  const [allowedTemplateIds, setAllowedTemplateIds] = useState(current.allowedTemplateIds ?? []);
  const [allowedTemplateTags, setAllowedTemplateTags] = useState((current.allowedTemplateTags ?? []).join(', '));
  const [requireTemplateSelection, setRequireTemplateSelection] = useState(current.requireTemplateSelection);
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState(false);

  const activeTemplates = useMemo(() => templates.filter((template) => template.status === 'active'), [templates]);
  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activeTemplates;
    return activeTemplates.filter((template) => `${template.name} ${template.slug} ${template.tags.join(' ')}`.toLowerCase().includes(query));
  }, [activeTemplates, search]);
  const selectedTemplates = useMemo(() => allowedTemplateIds.map((id) => activeTemplates.find((template) => template._id === id)).filter(Boolean) as LayoutTemplate[], [activeTemplates, allowedTemplateIds]);
  const templateTags = useMemo(() => Array.from(new Set(activeTemplates.flatMap((template) => template.tags).map((tag) => tag.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [activeTemplates]);
  const parsedTags = allowedTemplateTags.split(',').map((tag) => tag.trim()).filter(Boolean);
  const invalid = mode === 'specific' && allowedTemplateIds.length === 0 || mode === 'by-tags' && parsedTags.length === 0;

  function toggleTemplate(id: string) {
    setAllowedTemplateIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  }

  function handleSave() {
    if (invalid) return;
    onSave({
      ...product,
      layoutSettings: {
        enabled: mode !== 'none',
        mode,
        allowedTemplateIds: mode === 'specific' ? allowedTemplateIds : [],
        allowedTemplateTags: mode === 'by-tags' ? parsedTags : [],
        requireTemplateSelection: mode !== 'none' && requireTemplateSelection,
      },
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-5xl space-y-6 pb-6">
      <section className="rounded-lg bg-white p-5 ring-1 ring-gray-200">
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Template Availability" value={mode} onChange={(event) => setMode(event.target.value as ProductLayoutTemplateMode)} options={modeOptions} />
          <label className="flex items-center gap-3 rounded-md bg-gray-50 p-3 text-sm text-gray-700 ring-1 ring-gray-200">
            <input type="checkbox" checked={requireTemplateSelection} disabled={mode === 'none'} onChange={(event) => setRequireTemplateSelection(event.target.checked)} />
            Require customers to choose a template before editing
          </label>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Layout templates are reusable multi-page structures. Use specific templates for strict product geometry, or tags for broader groups like canvas, metal, pillow, or collage.
        </p>
      </section>

      {mode === 'specific' && (
        <section className="rounded-lg bg-white p-5 ring-1 ring-gray-200">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <Input label="Search Active Templates" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, slug, or tag" />
            <p className="text-sm text-gray-500">{selectedTemplates.length} selected</p>
          </div>
          {loading && <p className="text-sm text-gray-500">Loading layout templates...</p>}
          {error && <p className="text-sm text-amber-700">{error}</p>}
          {filteredTemplates.length === 0 ? (
            <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">No active layout templates match this search.</p>
          ) : (
            <div className="overflow-hidden rounded-lg ring-1 ring-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr><th className="px-4 py-3">Use</th><th className="px-4 py-3">Template</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Tags</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredTemplates.map((template) => (
                    <tr key={template._id}>
                      <td className="px-4 py-3"><input type="checkbox" checked={allowedTemplateIds.includes(template._id)} onChange={() => toggleTemplate(template._id)} /></td>
                      <td className="px-4 py-3"><p className="font-medium text-gray-900">{template.name}</p><p className="text-xs text-gray-500">{template.slug}</p></td>
                      <td className="px-4 py-3 text-gray-600">{template.templateType}</td>
                      <td className="px-4 py-3 text-gray-600">{template.tags.join(', ') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {invalid && <p className="mt-2 text-sm text-red-600">Select at least one active template.</p>}
        </section>
      )}

      {mode === 'by-tags' && (
        <section className="rounded-lg bg-white p-5 ring-1 ring-gray-200">
          <Input label="Allowed Template Tags" value={allowedTemplateTags} onChange={(event) => setAllowedTemplateTags(event.target.value)} placeholder="canvas, wall-art, collage" />
          <p className="mt-2 text-sm text-gray-500">Separate tags with commas. Public config will return active visible templates containing any of these tags.</p>
          {templateTags.length > 0 && <p className="mt-3 text-xs text-gray-500">Available tags: {templateTags.join(', ')}</p>}
          {invalid && <p className="mt-2 text-sm text-red-600">Add at least one tag.</p>}
        </section>
      )}

      {mode === 'all' && (
        <section className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-200">
          This product will expose all active layout templates visible to the selected merchant.
        </section>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={invalid} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
          <Save className="h-4 w-4" /> Save Layout Settings
        </button>
        {saved && <span className="text-sm font-medium text-emerald-600">Saved!</span>}
      </div>
    </div>
  );
}
