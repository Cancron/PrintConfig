import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Copy, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { ImageField } from '../gallery/ImageField';
import type { AiArtConfig, AiArtStyle, Product } from '../../types';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

const yesNoOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export function AiArtTab({ product, onSave }: Props) {
  const originalAiArt = product.aiArt;
  const [form, setForm] = useState<AiArtConfig>(JSON.parse(JSON.stringify(originalAiArt)));
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);
  const [styleForm, setStyleForm] = useState<AiArtStyle | null>(null);

  const hasChanges = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(originalAiArt);
  }, [form, originalAiArt]);

  const sortedStyles = useMemo(() => {
    return [...(form.styles ?? [])].sort((a, b) => {
      const groupA = a.groupName || '';
      const groupB = b.groupName || '';
      if (groupA !== groupB) return groupA.localeCompare(groupB);
      return a.sortOrder - b.sortOrder;
    });
  }, [form.styles]);

  const styleErrors = useMemo(() => (styleForm ? validateStyle(styleForm, form.styles, editingStyleId) : {}), [editingStyleId, styleForm, form.styles]);
  const isStyleValid = Object.keys(styleErrors).length === 0;

  // Sync form when product changes (e.g., after save)
  useEffect(() => {
    setForm(JSON.parse(JSON.stringify(originalAiArt)));
  }, [originalAiArt]);

  function saveAll() {
    onSave({ ...product, aiArt: form });
  }

  function updateConfig<K extends keyof AiArtConfig>(field: K, value: AiArtConfig[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function startAddStyle() {
    setEditingStyleId(null);
    const now = new Date().toISOString();
    setStyleForm({
      _id: '',
      clientId: crypto.randomUUID(),
      name: '',
      slug: '',
      groupName: '',
      description: '',
      prompt: '',
      negativePrompt: '',
      additionalPrice: 0,
      previewImageUrl: '',
      thumbnailImageUrl: '',
      sortOrder: (form.styles?.length ?? 0) + 1,
      isActive: true,
      tags: [],
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });
  }

  function startEditStyle(style: AiArtStyle) {
    setEditingStyleId(entityKey(style));
    setStyleForm({ ...style });
  }

  function saveStyle() {
    if (!styleForm || !isStyleValid) return;
    const now = new Date().toISOString();
    const nextStyle: AiArtStyle = {
      ...styleForm,
      name: styleForm.name.trim(),
      slug: styleForm.slug.trim(),
      updatedAt: now,
    };

    let styles: AiArtStyle[];
    if (editingStyleId) {
      styles = form.styles.map((s) => (entityKey(s) === editingStyleId ? nextStyle : s));
    } else {
      styles = [...form.styles, nextStyle];
    }

    setForm((prev) => ({ ...prev, styles }));
    setStyleForm(null);
    setEditingStyleId(null);
  }

  function deleteStyle(styleId: string) {
    if (!confirm('Delete this AI Art style?')) return;
    setForm((prev) => ({ ...prev, styles: prev.styles.filter((s) => entityKey(s) !== styleId) }));
  }

  function duplicateStyle(style: AiArtStyle) {
    const now = new Date().toISOString();
    const copy: AiArtStyle = {
      ...style,
      _id: '',
      clientId: crypto.randomUUID(),
      name: `${style.name} Copy`,
      slug: `${style.slug}-copy`,
      sortOrder: (form.styles?.length ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
    };
    setForm((prev) => ({ ...prev, styles: [...prev.styles, copy] }));
  }

  function moveStyle(styleId: string, direction: -1 | 1) {
    const index = sortedStyles.findIndex((s) => entityKey(s) === styleId);
    const target = index + direction;
    if (target < 0 || target >= sortedStyles.length) return;
    const next = [...sortedStyles];
    [next[index], next[target]] = [next[target], next[index]];
    setForm((prev) => ({ ...prev, styles: next.map((s, order) => ({ ...s, sortOrder: order + 1 })) }));
  }

  function updateStyleField<K extends keyof AiArtStyle>(field: K, value: AiArtStyle[K]) {
    setStyleForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function toggleStyleActive(style: AiArtStyle) {
    setForm((prev) => ({
      ...prev,
      styles: prev.styles.map((s) => (entityKey(s) === entityKey(style) ? { ...s, isActive: !s.isActive } : s)),
    }));
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">AI Art Configuration</h2>
          <p className="mt-1 text-sm text-gray-500">Configure AI-generated art styles for this product.</p>
        </div>
        <button
          type="button"
          onClick={saveAll}
          disabled={!hasChanges}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Check className="h-4 w-4" /> Save Changes
        </button>
      </div>

      {hasChanges && (
        <div className="rounded-md bg-blue-50 p-3 ring-1 ring-blue-100">
          <p className="text-sm text-blue-700">You have unsaved changes. Click "Save Changes" to persist.</p>
        </div>
      )}

      {/* Settings Card */}
      <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h3 className="text-base font-semibold text-gray-900 mb-4">AI Art Settings</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Enable AI Art"
            value={form.enabled ? 'yes' : 'no'}
            onChange={(e) => updateConfig('enabled', e.target.value === 'yes')}
            options={yesNoOptions}
          />
          <Input
            label="Section Title"
            value={form.sectionTitle}
            onChange={(e) => updateConfig('sectionTitle', e.target.value)}
            placeholder="AI Art Styles"
          />
          <Input
            label="Badge Text"
            value={form.badgeText}
            onChange={(e) => updateConfig('badgeText', e.target.value)}
            placeholder="Artwork fee added"
          />
          <Input
            label="Max Upload Images"
            type="number"
            min={1}
            value={form.maxUploadImages}
            onChange={(e) => updateConfig('maxUploadImages', Math.max(1, Number(e.target.value)))}
          />
          <Input
            label="Default Generated Image Count"
            type="number"
            min={1}
            value={form.defaultGeneratedImageCount}
            onChange={(e) => updateConfig('defaultGeneratedImageCount', Math.max(1, Number(e.target.value)))}
          />
          <Select
            label="Require Upload Before Style Selection"
            value={form.requireUploadBeforeStyleSelection ? 'yes' : 'no'}
            onChange={(e) => updateConfig('requireUploadBeforeStyleSelection', e.target.value === 'yes')}
            options={yesNoOptions}
          />
          <Select
            label="Show Descriptions"
            value={form.showDescriptions ? 'yes' : 'no'}
            onChange={(e) => updateConfig('showDescriptions', e.target.value === 'yes')}
            options={yesNoOptions}
          />
          <Select
            label="Show Group Names"
            value={form.showGroupNames ? 'yes' : 'no'}
            onChange={(e) => updateConfig('showGroupNames', e.target.value === 'yes')}
            options={yesNoOptions}
          />
          <Select
            label="Show Additional Price"
            value={form.showAdditionalPrice ? 'yes' : 'no'}
            onChange={(e) => updateConfig('showAdditionalPrice', e.target.value === 'yes')}
            options={yesNoOptions}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Textarea
            label="Help Text"
            value={form.helpText}
            onChange={(e) => updateConfig('helpText', e.target.value)}
            rows={2}
            placeholder="Upload your pet photo. We will create the selected artwork style before printing."
          />
          <Textarea
            label="Generation Note"
            value={form.generationNote}
            onChange={(e) => updateConfig('generationNote', e.target.value)}
            rows={2}
            placeholder="Proof/revision available before production."
          />
        </div>
      </div>

      {/* Styles Card */}
      <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">AI Art Styles</h3>
          {!styleForm && (
            <button
              type="button"
              onClick={startAddStyle}
              className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" /> Add Style
            </button>
          )}
        </div>

        {/* Style Form */}
        {styleForm && (
          <div className="rounded-lg bg-gray-50 p-5 ring-1 ring-gray-200 mb-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input label="Style Name" value={styleForm.name} onChange={(e) => updateStyleField('name', e.target.value)} error={styleErrors.name} required />
              <Input
                label="Slug"
                value={styleForm.slug}
                onChange={(e) => updateStyleField('slug', slugifyStyle(e.target.value))}
                error={styleErrors.slug}
                required
              />
              <Input label="Group Name" value={styleForm.groupName} onChange={(e) => updateStyleField('groupName', e.target.value)} placeholder="Classic Styles" />
              <Input label="Sort Order" type="number" value={styleForm.sortOrder} onChange={(e) => updateStyleField('sortOrder', Number(e.target.value))} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Textarea label="Description" value={styleForm.description} onChange={(e) => updateStyleField('description', e.target.value)} rows={2} />
              <Textarea label="Negative Prompt" value={styleForm.negativePrompt} onChange={(e) => updateStyleField('negativePrompt', e.target.value)} rows={2} />
            </div>
            <div className="mt-4">
              <Textarea
                label="Prompt"
                value={styleForm.prompt}
                onChange={(e) => updateStyleField('prompt', e.target.value)}
                rows={3}
                error={styleErrors.prompt}
                required
                placeholder="Create a watercolor pet portrait from the uploaded pet photo..."
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Additional Price"
                type="number"
                min={0}
                step={0.01}
                value={styleForm.additionalPrice}
                onChange={(e) => updateStyleField('additionalPrice', Math.max(0, Number(e.target.value)))}
                error={styleErrors.additionalPrice}
              />
              <Input label="Tags (comma separated)" value={styleForm.tags.join(', ')} onChange={(e) => updateStyleField('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} />
              <Select
                label="Active"
                value={styleForm.isActive ? 'yes' : 'no'}
                onChange={(e) => updateStyleField('isActive', e.target.value === 'yes')}
                options={yesNoOptions}
              />
              <div className="sm:col-span-1">
                <ImageField
                  label="Preview Image"
                  url={styleForm.previewImageUrl}
                  assetId={styleForm.previewImageAssetId}
                  onChange={(url, assetId) => {
                    updateStyleField('previewImageUrl', url);
                    updateStyleField('previewImageAssetId', assetId);
                  }}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={saveStyle}
                disabled={!isStyleValid}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Check className="h-4 w-4" /> Save Style
              </button>
              <button
                type="button"
                onClick={() => {
                  setStyleForm(null);
                  setEditingStyleId(null);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </div>
        )}

        {/* Styles List */}
        {!styleForm && (
          <div className="space-y-3">
            {sortedStyles.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No AI Art styles configured. Click "Add Style" to create one.</p>
            )}
            {sortedStyles.map((style, index) => (
              <div key={entityKey(style)} className="rounded-lg bg-gray-50 p-4 ring-1 ring-gray-200">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
                      {style.previewImageUrl || style.thumbnailImageUrl ? (
                        <img src={style.previewImageUrl || style.thumbnailImageUrl} alt={style.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">No image</div>
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-gray-900">{style.name}</h4>
                        <Pill tone={style.isActive ? 'emerald' : 'gray'}>{style.isActive ? 'Active' : 'Inactive'}</Pill>
                        {style.groupName && <Pill tone="blue">{style.groupName}</Pill>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Slug: {style.slug}</p>
                      {style.description && <p className="text-xs text-gray-600 mt-1 line-clamp-1">{style.description}</p>}
                      <p className="text-xs text-gray-500 mt-1">Additional Price: ${style.additionalPrice.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => moveStyle(entityKey(style), -1)} disabled={index === 0} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40">
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <button onClick={() => startEditStyle(style)} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                      <Pencil className="h-4 w-4" /> Edit
                    </button>
                    <button onClick={() => duplicateStyle(style)} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                      <Copy className="h-4 w-4" /> Duplicate
                    </button>
                    <button onClick={() => toggleStyleActive(style)} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                      {style.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => deleteStyle(entityKey(style))} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Preview Card */}
      {form.enabled && (
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Frontend Preview</h3>
          <div className="rounded-lg bg-gray-50 p-4 ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-900">{form.sectionTitle || 'AI Art Styles'}</h4>
              {form.badgeText && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">{form.badgeText}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {sortedStyles.filter((s) => s.isActive).map((style) => (
                <div
                  key={entityKey(style)}
                  className="w-32 rounded-lg bg-white p-3 ring-1 ring-gray-200 hover:ring-2 hover:ring-blue-500 cursor-pointer transition-all"
                >
                  <div className="h-20 rounded bg-gray-100 overflow-hidden">
                    {style.previewImageUrl || style.thumbnailImageUrl ? (
                      <img src={style.previewImageUrl || style.thumbnailImageUrl} alt={style.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">No preview</div>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-900 line-clamp-1">{style.name}</p>
                  {form.showAdditionalPrice && style.additionalPrice > 0 && (
                    <p className="text-xs text-gray-500">+${style.additionalPrice.toFixed(0)}</p>
                  )}
                  {form.showDescriptions && style.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{style.description}</p>
                  )}
                </div>
              ))}
            </div>
            {(form.helpText || form.generationNote) && (
              <div className="mt-4 space-y-1 text-xs text-gray-600">
                {form.helpText && <p>{form.helpText}</p>}
                {form.generationNote && <p className="text-gray-500">{form.generationNote}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disabled notice */}
      {!form.enabled && (
        <div className="rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">AI Art is disabled</span>
          </div>
          <p className="mt-1 text-sm text-amber-600">Enable AI Art above to configure styles and show this section on the frontend.</p>
        </div>
      )}
    </div>
  );
}

function validateStyle(style: AiArtStyle, styles: AiArtStyle[], editingId: string | null) {
  const errors: Record<string, string> = {};
  if (!style.name.trim()) errors.name = 'Style name is required.';
  if (!style.slug.trim()) errors.slug = 'Slug is required.';
  if (style.slug.trim() && !/^(?=.*[a-z0-9])[a-z0-9_-]+$/.test(style.slug.trim())) {
    errors.slug = 'Slug may use lowercase letters, numbers, hyphens, and underscores only.';
  }
  if (styles.some((s) => entityKey(s) !== editingId && s.slug.toLowerCase() === style.slug.toLowerCase())) {
    errors.slug = 'Slug must be unique within this product.';
  }
  if (!style.prompt.trim()) errors.prompt = 'Prompt is required.';
  if (style.additionalPrice < 0) errors.additionalPrice = 'Additional price must be zero or greater.';
  return errors;
}

function Pill({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'blue' | 'emerald' | 'amber' }) {
  const styles = {
    gray: 'bg-gray-50 text-gray-700 ring-gray-600/20',
    blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${styles}`}>{children}</span>;
}

function slugifyStyle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
}

function entityKey(entity: { _id: string; clientId?: string }) {
  return entity._id || entity.clientId || '';
}
