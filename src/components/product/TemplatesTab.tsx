import { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { Product, ProductStatus, ProductSurface, ProductTemplate, TemplateElement, TemplateElementType } from '../../types';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

const statusOptions: { value: ProductStatus; label: string }[] = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Active', label: 'Active' },
];

const typeOptions: { value: TemplateElementType; label: string }[] = [
  { value: 'photo', label: 'Photo placeholder' },
  { value: 'text', label: 'Text placeholder' },
];

const yesNoOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export function TemplatesTab({ product, onSave }: Props) {
  const firstVariant = product.variants[0];
  const firstSurface = firstVariant?.surfaces[0];
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductTemplate>(() => createTemplate(product.id, firstVariant?.id ?? '', firstSurface?.id ?? ''));

  const selectedVariant = product.variants.find((variant) => variant.id === form.variantId);
  const availableSurfaces = selectedVariant?.surfaces ?? [];
  const selectedSurface = availableSurfaces.find((surface) => surface.id === form.surfaceId);
  const errors = useMemo(() => validateTemplate(form), [form]);
  const isValid = Object.keys(errors).length === 0;

  function startCreate() {
    const variant = product.variants[0];
    setForm(createTemplate(product.id, variant?.id ?? '', variant?.surfaces[0]?.id ?? ''));
    setEditingId(null);
    setIsFormOpen(true);
  }

  function startEdit(template: ProductTemplate) {
    setForm({ ...template, elements: template.elements.map((element) => ({ ...element })) });
    setEditingId(template.id);
    setIsFormOpen(true);
  }

  function cancelEdit() {
    setIsFormOpen(false);
    setEditingId(null);
  }

  function update<K extends keyof ProductTemplate>(field: K, value: ProductTemplate[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateVariant(variantId: string) {
    const variant = product.variants.find((item) => item.id === variantId);
    setForm((prev) => ({
      ...prev,
      variantId,
      surfaceId: variant?.surfaces[0]?.id ?? '',
    }));
  }

  function addElement(type: TemplateElementType) {
    setForm((prev) => ({
      ...prev,
      elements: [...prev.elements, createElement(type)],
    }));
  }

  function updateElement<K extends keyof TemplateElement>(id: string, field: K, value: TemplateElement[K]) {
    setForm((prev) => ({
      ...prev,
      elements: prev.elements.map((element) => (element.id === id ? { ...element, [field]: value } : element)),
    }));
  }

  function deleteElement(id: string) {
    setForm((prev) => ({
      ...prev,
      elements: prev.elements.filter((element) => element.id !== id),
    }));
  }

  function saveTemplate() {
    if (!isValid) return;
    const now = new Date().toISOString();
    const template: ProductTemplate = {
      ...form,
      name: form.name.trim(),
      thumbnailUrl: form.thumbnailUrl.trim(),
      updatedAt: now,
      createdAt: editingId ? form.createdAt : now,
      elements: form.elements.map((element) => ({
        ...element,
        name: element.name.trim(),
        x: clampPercent(element.x),
        y: clampPercent(element.y),
        width: clampPercent(element.width),
        height: clampPercent(element.height),
      })),
    };

    const templates = editingId
      ? product.templates.map((item) => (item.id === editingId ? template : item))
      : [...product.templates, template];

    onSave({ ...product, templates });
    cancelEdit();
  }

  function deleteTemplate(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) return;
    onSave({ ...product, templates: product.templates.filter((template) => template.id !== id) });
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Templates</h2>
          <p className="mt-1 text-sm text-gray-500">Create reusable layouts with normalized placeholder positions.</p>
        </div>
        {!isFormOpen && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Template
          </button>
        )}
      </div>

      {product.templates.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create a template to test placeholder layouts for this product."
          action={
            !isFormOpen && (
              <button
                type="button"
                onClick={startCreate}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Template
              </button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg ring-1 ring-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Template</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Variant</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Surface</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Elements</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {product.templates.map((template) => {
                const variant = product.variants.find((item) => item.id === template.variantId);
                const surface = variant?.surfaces.find((item) => item.id === template.surfaceId);
                return (
                  <tr key={template.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {template.thumbnailUrl ? (
                          <img src={template.thumbnailUrl} alt={template.name} className="h-10 w-10 rounded-md object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-gray-100" />
                        )}
                        <span className="whitespace-nowrap text-sm font-medium text-gray-900">{template.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge status={template.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{variant?.name ?? 'Missing variant'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{surface?.name ?? 'Missing surface'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{template.elements.length}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={() => startEdit(template)} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => deleteTemplate(template.id)} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <div className="rounded-lg bg-gray-50 p-5 ring-1 ring-gray-200">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Template Name" value={form.name} onChange={(event) => update('name', event.target.value)} error={errors.name} placeholder="e.g. Holiday Card Front" />
                <Select label="Status" value={form.status} onChange={(event) => update('status', event.target.value as ProductStatus)} options={statusOptions} />
                <Select
                  label="Assigned Product Variant"
                  value={form.variantId}
                  onChange={(event) => updateVariant(event.target.value)}
                  options={product.variants.length > 0 ? product.variants.map((variant) => ({ value: variant.id, label: `${variant.name} (${variant.sku})` })) : [{ value: '', label: 'No variants available' }]}
                  error={errors.variantId}
                  disabled={product.variants.length === 0}
                />
                <Select
                  label="Assigned Surface"
                  value={form.surfaceId}
                  onChange={(event) => update('surfaceId', event.target.value)}
                  options={availableSurfaces.length > 0 ? availableSurfaces.map((surface) => ({ value: surface.id, label: `${surface.name} (${surface.code})` })) : [{ value: '', label: 'No surfaces available' }]}
                  error={errors.surfaceId}
                  disabled={availableSurfaces.length === 0}
                />
              </div>

              <Input label="Thumbnail URL" type="url" value={form.thumbnailUrl} onChange={(event) => update('thumbnailUrl', event.target.value)} placeholder="https://..." />

              <div>
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Template Elements</h3>
                    <p className="mt-1 text-sm text-gray-500">Positions are stored as percentages from 0 to 100.</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => addElement('photo')} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">
                      <Plus className="h-4 w-4" /> Photo
                    </button>
                    <button type="button" onClick={() => addElement('text')} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">
                      <Plus className="h-4 w-4" /> Text
                    </button>
                  </div>
                </div>

                {form.elements.length === 0 ? (
                  <div className="rounded-lg bg-white p-5 text-center text-sm text-gray-500 ring-1 ring-gray-200">No placeholders yet.</div>
                ) : (
                  <div className="space-y-3">
                    {form.elements.map((element, index) => (
                      <div key={element.id} className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold text-gray-900">Placeholder {index + 1}</h4>
                          <button type="button" onClick={() => deleteElement(element.id)} className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" title="Delete placeholder">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <Input label="Name" value={element.name} onChange={(event) => updateElement(element.id, 'name', event.target.value)} error={errors[`element.${element.id}.name`]} />
                          <Select label="Type" value={element.type} onChange={(event) => updateElement(element.id, 'type', event.target.value as TemplateElementType)} options={typeOptions} />
                          <Input label="X %" type="number" min="0" max="100" value={element.x} onChange={(event) => updateElement(element.id, 'x', Number(event.target.value))} error={errors[`element.${element.id}.x`]} />
                          <Input label="Y %" type="number" min="0" max="100" value={element.y} onChange={(event) => updateElement(element.id, 'y', Number(event.target.value))} error={errors[`element.${element.id}.y`]} />
                          <Input label="Width %" type="number" min="0" max="100" value={element.width} onChange={(event) => updateElement(element.id, 'width', Number(event.target.value))} error={errors[`element.${element.id}.width`]} />
                          <Input label="Height %" type="number" min="0" max="100" value={element.height} onChange={(event) => updateElement(element.id, 'height', Number(event.target.value))} error={errors[`element.${element.id}.height`]} />
                          <Select label="Required" value={element.required ? 'yes' : 'no'} onChange={(event) => updateElement(element.id, 'required', event.target.value === 'yes')} options={yesNoOptions} />
                          <Select label="Locked" value={element.locked ? 'yes' : 'no'} onChange={(event) => updateElement(element.id, 'locked', event.target.value === 'yes')} options={yesNoOptions} />
                          <Select label="Editable" value={element.editable ? 'yes' : 'no'} onChange={(event) => updateElement(element.id, 'editable', event.target.value === 'yes')} options={yesNoOptions} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={saveTemplate} disabled={!isValid} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                  <Check className="h-4 w-4" /> Save Template
                </button>
                <button type="button" onClick={cancelEdit} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 transition-colors hover:bg-gray-50">
                  <X className="h-4 w-4" /> Cancel
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Template Preview</h3>
                <p className="mt-1 text-sm text-gray-500">Placeholder boxes use normalized percentage coordinates.</p>
                <div className="mt-4 flex justify-center overflow-auto">
                  {selectedSurface ? (
                    <TemplatePreview surface={selectedSurface} elements={form.elements} />
                  ) : (
                    <div className="flex h-64 w-full items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500 ring-1 ring-gray-200">Select a surface to preview.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplatePreview({ surface, elements }: { surface: ProductSurface; elements: TemplateElement[] }) {
  const maxSize = 320;
  const ratio = surface.width > 0 && surface.height > 0 ? surface.width / surface.height : 1;
  const width = ratio >= 1 ? maxSize : maxSize * ratio;
  const height = ratio >= 1 ? maxSize / ratio : maxSize;

  return (
    <div className="relative rounded-md bg-white shadow-sm ring-1 ring-gray-300" style={{ width, height }}>
      {elements.map((element) => (
        <div
          key={element.id}
          className={`absolute flex items-center justify-center border-2 border-dashed text-center text-xs font-medium ${element.type === 'photo' ? 'border-blue-500 bg-blue-50/80 text-blue-700' : 'border-emerald-500 bg-emerald-50/80 text-emerald-700'}`}
          style={{
            left: `${element.x}%`,
            top: `${element.y}%`,
            width: `${element.width}%`,
            height: `${element.height}%`,
          }}
          title={`${element.name} (${element.type})`}
        >
          <span className="px-1">{element.name || element.type}</span>
        </div>
      ))}
    </div>
  );
}

function createTemplate(productId: string, variantId: string, surfaceId: string): ProductTemplate {
  const now = new Date().toISOString();
  return {
    id: `tpl-${Date.now()}`,
    productId,
    name: '',
    status: 'Draft',
    variantId,
    surfaceId,
    thumbnailUrl: '',
    elements: [],
    createdAt: now,
    updatedAt: now,
  };
}

function createElement(type: TemplateElementType): TemplateElement {
  return {
    id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: type === 'photo' ? 'Photo placeholder' : 'Text placeholder',
    type,
    x: 10,
    y: 10,
    width: type === 'photo' ? 40 : 60,
    height: type === 'photo' ? 40 : 15,
    required: true,
    locked: false,
    editable: true,
  };
}

function validateTemplate(template: ProductTemplate) {
  const errors: Record<string, string> = {};
  if (!template.name.trim()) errors.name = 'Template name is required.';
  if (!template.variantId) errors.variantId = 'Assign a product variant.';
  if (!template.surfaceId) errors.surfaceId = 'Assign a surface.';

  for (const element of template.elements) {
    if (!element.name.trim()) errors[`element.${element.id}.name`] = 'Name is required.';
    if (!isPercent(element.x)) errors[`element.${element.id}.x`] = 'Use 0 to 100.';
    if (!isPercent(element.y)) errors[`element.${element.id}.y`] = 'Use 0 to 100.';
    if (!isPercent(element.width) || element.width <= 0) errors[`element.${element.id}.width`] = 'Use more than 0 and up to 100.';
    if (!isPercent(element.height) || element.height <= 0) errors[`element.${element.id}.height`] = 'Use more than 0 and up to 100.';
    if (element.x + element.width > 100) errors[`element.${element.id}.width`] = 'X plus width must stay within 100%.';
    if (element.y + element.height > 100) errors[`element.${element.id}.height`] = 'Y plus height must stay within 100%.';
  }

  return errors;
}

function isPercent(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function clampPercent(value: number) {
  return Math.min(Math.max(value, 0), 100);
}
