import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, ChevronDown } from 'lucide-react';
import { SurfacePreview } from './SurfacePreview';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { EmptyState } from '../ui/EmptyState';
import { toPixels, validateSurface } from '../../lib/validation';
import type { Product, ProductSurface, BleedSettings, SafeAreaSettings } from '../../types';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

const unitOptions = [
  { value: 'in', label: 'inches' },
  { value: 'mm', label: 'mm' },
  { value: 'px', label: 'px' },
];

const yesNoOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

function defaultBleed(): BleedSettings {
  return { top: 0.125, right: 0.125, bottom: 0.125, left: 0.125, unit: 'in' };
}

function defaultSafeArea(): SafeAreaSettings {
  return { top: 0.25, right: 0.25, bottom: 0.25, left: 0.25, unit: 'in' };
}

function defaultSurface(variantId: string): ProductSurface {
  const now = new Date().toISOString();
  return {
    id: `s-${Date.now()}`,
    variantId,
    name: '',
    code: '',
    width: 8,
    height: 10,
    unit: 'in',
    dpi: 300,
    bleed: defaultBleed(),
    safeArea: defaultSafeArea(),
    backgroundColor: '#ffffff',
    allowTransparency: false,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function SurfacesTab({ product, onSave }: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.variants[0]?.id ?? ''
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<ProductSurface>(() =>
    defaultSurface(selectedVariantId)
  );

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId);
  const surfaces = selectedVariant?.surfaces ?? [];
  const errors = useMemo(() => validateSurface(form), [form]);
  const isValid = Object.keys(errors).length === 0;

  function resetForm() {
    setForm(defaultSurface(selectedVariantId));
  }

  function startAdd() {
    if (!selectedVariant) return;
    resetForm();
    setIsAdding(true);
    setEditingId(null);
  }

  function startEdit(surface: ProductSurface) {
    setForm({ ...surface });
    setEditingId(surface.id);
    setIsAdding(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setIsAdding(false);
    resetForm();
  }

  function updateForm<K extends keyof ProductSurface>(field: K, value: ProductSurface[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateBleed(field: keyof BleedSettings, value: number | string) {
    setForm((prev) => ({
      ...prev,
      bleed: { ...prev.bleed, [field]: value },
    }));
  }

  function updateSafeArea(field: keyof SafeAreaSettings, value: number | string) {
    setForm((prev) => ({
      ...prev,
      safeArea: { ...prev.safeArea, [field]: value },
    }));
  }

  function handleSave() {
    if (!selectedVariant || !isValid) return;
    const now = new Date().toISOString();
    const surface: ProductSurface = {
      ...form,
      name: form.name.trim(),
      code: form.code.trim(),
      id: editingId ?? `s-${Date.now()}`,
      variantId: selectedVariant.id,
      updatedAt: now,
      createdAt: editingId
        ? (selectedVariant.surfaces.find((s) => s.id === editingId)?.createdAt ?? now)
        : now,
    };

    const nextVariants = product.variants.map((v) => {
      if (v.id !== selectedVariant.id) return v;
      if (editingId) {
        return {
          ...v,
          surfaces: v.surfaces.map((s) => (s.id === editingId ? surface : s)),
          updatedAt: now,
        };
      }
      return {
        ...v,
        surfaces: [...v.surfaces, surface],
        updatedAt: now,
      };
    });

    onSave({ ...product, variants: nextVariants, updatedAt: now });
    cancelEdit();
  }

  function handleDelete(surfaceId: string) {
    if (!selectedVariant) return;
    if (!confirm('Are you sure you want to delete this surface?')) return;
    const now = new Date().toISOString();
    const nextVariants = product.variants.map((v) => {
      if (v.id !== selectedVariant.id) return v;
      return {
        ...v,
        surfaces: v.surfaces.filter((s) => s.id !== surfaceId),
        updatedAt: now,
      };
    });
    onSave({ ...product, variants: nextVariants, updatedAt: now });
  }

  const isFormOpen = isAdding || editingId !== null;
  const widthPx = toPixels(form.width, form.unit, form.dpi);
  const heightPx = toPixels(form.height, form.unit, form.dpi);
  const totalWidthWithBleedPx = widthPx + toPixels(form.bleed.left, form.bleed.unit, form.dpi) + toPixels(form.bleed.right, form.bleed.unit, form.dpi);
  const totalHeightWithBleedPx = heightPx + toPixels(form.bleed.top, form.bleed.unit, form.dpi) + toPixels(form.bleed.bottom, form.bleed.unit, form.dpi);

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Variant</label>
        <div className="relative max-w-sm">
          <select
            value={selectedVariantId}
            onChange={(e) => {
              setSelectedVariantId(e.target.value);
              setForm(defaultSurface(e.target.value));
              setEditingId(null);
              setIsAdding(false);
            }}
            disabled={product.variants.length === 0}
            className="block w-full appearance-none rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-slate-600 disabled:bg-gray-100 disabled:text-gray-400 sm:text-sm"
          >
            {product.variants.length === 0 ? (
              <option value="">No variants available</option>
            ) : (
              product.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.sku})
                </option>
              ))
            )}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
      </div>

      {!selectedVariant || surfaces.length === 0 ? (
        <EmptyState
          title="No surfaces yet"
          description={selectedVariant ? 'Add your first surface to this variant.' : 'Add a variant before configuring surfaces.'}
          action={
            selectedVariant && (
              <button
                onClick={startAdd}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Surface
              </button>
            )
          }
        />
      ) : (
        <div className="mb-6 overflow-x-auto ring-1 ring-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Preview</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Size</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">DPI</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Export Pixels</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {surfaces.map((surface) => (
                <tr key={surface.id}>
                  <td className="px-4 py-3">
                    <SurfacePreview surface={surface} size={80} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{surface.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{surface.code}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {surface.width} x {surface.height} {surface.unit}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{surface.dpi}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {Math.round(toPixels(surface.width, surface.unit, surface.dpi))} x {Math.round(toPixels(surface.height, surface.unit, surface.dpi))} px
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(surface)}
                        className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(surface.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isFormOpen && selectedVariant && surfaces.length > 0 && (
        <button
          onClick={startAdd}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors mb-6"
        >
          <Plus className="h-4 w-4" />
          Add Surface
        </button>
      )}

      {isFormOpen && (
        <div className="bg-gray-50 rounded-lg p-6 mb-6 ring-1 ring-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-4">
            {editingId ? 'Edit Surface' : 'New Surface'}
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Surface Name"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  error={errors.name}
                  placeholder="e.g. Front"
                />
                <Input
                  label="Surface Code"
                  value={form.code}
                  onChange={(e) => updateForm('code', e.target.value)}
                  error={errors.code}
                  placeholder="e.g. front"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Input
                  label="Width"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.width}
                  onChange={(e) => updateForm('width', Number(e.target.value))}
                  error={errors.width}
                />
                <Input
                  label="Height"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.height}
                  onChange={(e) => updateForm('height', Number(e.target.value))}
                  error={errors.height}
                />
                <Select
                  label="Unit"
                  value={form.unit}
                  onChange={(e) => updateForm('unit', e.target.value as ProductSurface['unit'])}
                  options={unitOptions}
                  error={errors.unit}
                />
                <Input
                  label="DPI"
                  type="number"
                  min="1"
                  value={form.dpi}
                  onChange={(e) => updateForm('dpi', Number(e.target.value))}
                  error={errors.dpi}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Input
                  label="Bleed Top"
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.bleed.top}
                  onChange={(e) => updateBleed('top', Number(e.target.value))}
                  error={errors['bleed.top']}
                />
                <Input
                  label="Bleed Right"
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.bleed.right}
                  onChange={(e) => updateBleed('right', Number(e.target.value))}
                  error={errors['bleed.right']}
                />
                <Input
                  label="Bleed Bottom"
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.bleed.bottom}
                  onChange={(e) => updateBleed('bottom', Number(e.target.value))}
                  error={errors['bleed.bottom']}
                />
                <Input
                  label="Bleed Left"
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.bleed.left}
                  onChange={(e) => updateBleed('left', Number(e.target.value))}
                  error={errors['bleed.left']}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Input
                  label="Safe Area Top"
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.safeArea.top}
                  onChange={(e) => updateSafeArea('top', Number(e.target.value))}
                  error={errors['safeArea.top']}
                />
                <Input
                  label="Safe Area Right"
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.safeArea.right}
                  onChange={(e) => updateSafeArea('right', Number(e.target.value))}
                  error={errors['safeArea.right']}
                />
                <Input
                  label="Safe Area Bottom"
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.safeArea.bottom}
                  onChange={(e) => updateSafeArea('bottom', Number(e.target.value))}
                  error={errors['safeArea.bottom']}
                />
                <Input
                  label="Safe Area Left"
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.safeArea.left}
                  onChange={(e) => updateSafeArea('left', Number(e.target.value))}
                  error={errors['safeArea.left']}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.backgroundColor}
                      onChange={(e) => updateForm('backgroundColor', e.target.value)}
                      className="h-10 w-10 rounded-md border-0 p-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={form.backgroundColor}
                      onChange={(e) => updateForm('backgroundColor', e.target.value)}
                      className="flex-1 rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm"
                    />
                  </div>
                </div>
                <Select
                  label="Allow Transparency"
                  value={form.allowTransparency ? 'yes' : 'no'}
                  onChange={(e) => updateForm('allowTransparency', e.target.value === 'yes')}
                  options={yesNoOptions}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-lg ring-1 ring-gray-200 p-4 flex flex-col items-center">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Live Preview</h4>
                <SurfacePreview surface={form} size={220} />
              </div>

              <div className="bg-white rounded-lg ring-1 ring-gray-200 p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Export Dimensions</h4>
                <div className="space-y-1 text-sm text-gray-700">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Width (px)</span>
                    <span className="font-medium">{Math.round(widthPx)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Height (px)</span>
                    <span className="font-medium">{Math.round(heightPx)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total w/ Bleed (px)</span>
                    <span className="font-medium">{Math.round(totalWidthWithBleedPx)} x {Math.round(totalHeightWithBleedPx)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={!isValid}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Check className="h-4 w-4" />
              Save Surface
            </button>
            <button
              onClick={cancelEdit}
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
