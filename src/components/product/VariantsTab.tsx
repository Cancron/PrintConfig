import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Eye, Pencil, Plus, Trash2, X } from 'lucide-react';
import { SurfacePreview } from './SurfacePreview';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ImageField } from '../gallery/ImageField';
import { toPixels, validateVariant } from '../../lib/validation';
import type { Product, ProductStatus, ProductUnit, ProductVariant } from '../../types';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

const statusOptions: { value: ProductStatus; label: string }[] = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Active', label: 'Active' },
];

const unitOptions: { value: ProductUnit; label: string }[] = [
  { value: 'inch', label: 'inch' },
  { value: 'mm', label: 'mm' },
  { value: 'px', label: 'px' },
];

export function VariantsTab({ product, onSave }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [previewVariant, setPreviewVariant] = useState<ProductVariant | null>(null);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    price: '',
    status: 'Draft' as ProductStatus,
    width: '',
    height: '',
    unit: 'inch' as ProductUnit,
    dpi: '300',
    previewImageUrl: '',
    previewImageAssetId: undefined as string | undefined,
    thumbnailImageUrl: '',
    thumbnailImageAssetId: undefined as string | undefined,
    options: [{ key: '', value: '' }],
  });

  const errors = useMemo(
    () => validateVariant({
      _id: editingId,
      name: form.name,
      sku: form.sku,
      price: form.price,
      width: form.width,
      height: form.height,
      unit: form.unit,
      dpi: form.dpi,
      existingSkus: product.variants.map((variant) => ({ _id: variant._id, sku: variant.sku })),
    }),
    [editingId, form.dpi, form.height, form.name, form.price, form.sku, form.unit, form.width, product.variants]
  );
  const isValid = Object.keys(errors).length === 0;

  function resetForm() {
    setForm({
      name: '',
      sku: '',
      price: '',
      status: 'Draft',
      width: '',
      height: '',
      unit: 'inch',
      dpi: '300',
      previewImageUrl: '',
      previewImageAssetId: undefined,
      thumbnailImageUrl: '',
      thumbnailImageAssetId: undefined,
      options: [{ key: '', value: '' }],
    });
  }

  function startAdd() {
    resetForm();
    setIsAdding(true);
    setEditingId(null);
  }

  function startEdit(variant: ProductVariant) {
    setForm({
      name: variant.name,
      sku: variant.sku,
      price: String(variant.price),
      status: variant.status,
      width: String(variant.width),
      height: String(variant.height),
      unit: variant.unit,
      dpi: String(variant.dpi),
      previewImageUrl: variant.previewImageUrl,
      previewImageAssetId: variant.previewImageAssetId,
      thumbnailImageUrl: variant.thumbnailImageUrl,
      thumbnailImageAssetId: variant.thumbnailImageAssetId,
      options: Object.entries(variant.options).length > 0 ? Object.entries(variant.options).map(([key, value]) => ({ key, value })) : [{ key: '', value: '' }],
    });
    setEditingId(variant._id);
    setIsAdding(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setIsAdding(false);
    resetForm();
  }

  function addOptionField() {
    setForm((prev) => ({ ...prev, options: [...prev.options, { key: '', value: '' }] }));
  }

  function removeOptionField(index: number) {
    setForm((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  }

  function updateOption(index: number, field: 'key' | 'value', value: string) {
    setForm((prev) => ({ ...prev, options: prev.options.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt)) }));
  }

  function handleSave() {
    if (!isValid) return;
    const options: Record<string, string> = {};
    for (const opt of form.options) {
      if (opt.key.trim()) options[opt.key.trim()] = opt.value.trim();
    }

    const now = new Date().toISOString();
    const existing = product.variants.find((variant) => variant._id === editingId);
    const variant: ProductVariant = {
      _id: editingId ?? '',
      clientId: existing?.clientId ?? (editingId ? undefined : crypto.randomUUID()),
      productId: product._id,
      name: form.name.trim(),
      sku: form.sku.trim(),
      price: Number(form.price),
      status: form.status,
      options,
      width: Number(form.width),
      height: Number(form.height),
      unit: form.unit,
      dpi: Number(form.dpi),
      previewImageUrl: form.previewImageUrl.trim(),
      previewImageAssetId: form.previewImageAssetId,
      thumbnailImageUrl: form.thumbnailImageUrl.trim(),
      thumbnailImageAssetId: form.thumbnailImageAssetId,
      roomPreviews: existing?.roomPreviews ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const variants = editingId ? product.variants.map((item) => (item._id === editingId ? variant : item)) : [...product.variants, variant];
    onSave({ ...product, variants, updatedAt: now });
    cancelEdit();
  }

  function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this variant?')) return;
    const now = new Date().toISOString();
    onSave({ ...product, variants: product.variants.filter((variant) => variant._id !== id), updatedAt: now });
  }

  const isFormOpen = isAdding || editingId !== null;

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Variants</h2>
        {!isFormOpen && (
          <button onClick={startAdd} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800">
            <Plus className="h-4 w-4" /> Add Variant
          </button>
        )}
      </div>

      {isFormOpen && (
        <div className="rounded-lg bg-gray-50 p-4 ring-1 ring-gray-200">
          <h3 className="mb-4 text-sm font-medium text-gray-900">{editingId ? 'Edit Variant' : 'New Variant'}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Variant Name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} error={errors.name} placeholder="e.g. 16x20 Canvas" />
            <Input label="SKU" value={form.sku} onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))} error={errors.sku} placeholder="e.g. CANVAS-16X20" />
            <Input label="Price" type="number" step="0.01" min="0" value={form.price} onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))} error={errors.price} placeholder="0.00" />
            <Select label="Status" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as ProductStatus }))} options={statusOptions} />
            <Input label="Width" type="number" step="0.01" min="0" value={form.width} onChange={(event) => setForm((prev) => ({ ...prev, width: event.target.value }))} error={errors.width} />
            <Input label="Height" type="number" step="0.01" min="0" value={form.height} onChange={(event) => setForm((prev) => ({ ...prev, height: event.target.value }))} error={errors.height} />
            <Select label="Unit" value={form.unit} onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value as ProductUnit }))} options={unitOptions} error={errors.unit} />
            <Input label="DPI" type="number" min="1" value={form.dpi} onChange={(event) => setForm((prev) => ({ ...prev, dpi: event.target.value }))} error={errors.dpi} />
            <ImageField label="Preview Image URL" url={form.previewImageUrl} assetId={form.previewImageAssetId} onChange={(url, assetId) => setForm((prev) => ({ ...prev, previewImageUrl: url, previewImageAssetId: assetId }))} />
            <ImageField label="Thumbnail Image URL" url={form.thumbnailImageUrl} assetId={form.thumbnailImageAssetId} onChange={(url, assetId) => setForm((prev) => ({ ...prev, thumbnailImageUrl: url, thumbnailImageAssetId: assetId }))} />
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-sm font-medium text-gray-700">Options</label>
            <div className="space-y-2">
              {form.options.map((opt, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input type="text" placeholder="Key (e.g. size)" value={opt.key} onChange={(event) => updateOption(index, 'key', event.target.value)} className="flex-1 rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm" />
                  <input type="text" placeholder="Value (e.g. 16x20)" value={opt.value} onChange={(event) => updateOption(index, 'value', event.target.value)} className="flex-1 rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm" />
                  {form.options.length > 1 && <button type="button" onClick={() => removeOptionField(index)} className="rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                </div>
              ))}
            </div>
            <button type="button" onClick={addOptionField} className="mt-2 text-sm font-medium text-slate-700 hover:text-slate-900">+ Add option</button>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button onClick={handleSave} disabled={!isValid} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"><Check className="h-4 w-4" /> Save Variant</button>
            <button onClick={cancelEdit} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50"><X className="h-4 w-4" /> Cancel</button>
          </div>
        </div>
      )}

      {product.variants.length === 0 ? (
        <EmptyState title="No variants yet" description="Add your first variant to this product." action={<button onClick={startAdd} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"><Plus className="h-4 w-4" /> Add Variant</button>} />
      ) : (
        <div className="overflow-x-auto rounded-lg ring-1 ring-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Image</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">SKU</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Price</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Size</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Pixels</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Options</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Room Previews</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {product.variants.map((variant) => (
                <tr key={variant._id}>
                  <td className="px-4 py-3">{variant.thumbnailImageUrl ? <img src={variant.thumbnailImageUrl} alt={variant.name} className="h-10 w-10 rounded-md object-cover ring-1 ring-gray-200" /> : <div className="h-10 w-10 rounded-md bg-gray-100 ring-1 ring-gray-200" />}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{variant.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{variant.sku}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">${variant.price.toFixed(2)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700"><Badge status={variant.status} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{variant.width} x {variant.height} {variant.unit} at {variant.dpi} DPI</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{Math.round(toPixels(variant.width, variant.unit, variant.dpi))} x {Math.round(toPixels(variant.height, variant.unit, variant.dpi))} px</td>
                  <td className="px-4 py-3 text-sm text-gray-700"><div className="flex flex-wrap gap-1">{Object.entries(variant.options).map(([key, value]) => <span key={key} className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">{key}: {value}</span>)}</div></td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm"><p className="text-gray-700">{variant.roomPreviews.length} {variant.roomPreviews.length === 1 ? 'preview' : 'previews'}</p><Link to={`?tab=preview&variantId=${variant._id}`} className="mt-1 inline-block font-medium text-slate-700 hover:text-slate-900">Manage Room Previews</Link></td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setPreviewVariant(variant)} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900" title="Preview"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => startEdit(variant)} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900" title="Edit"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(variant._id)} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewVariant && <VariantPreviewModal product={product} variant={previewVariant} onClose={() => setPreviewVariant(null)} />}
    </div>
  );
}

function VariantPreviewModal({ product, variant, onClose }: { product: Product; variant: ProductVariant; onClose: () => void }) {
  const trimWidthPx = Math.round(toPixels(variant.width, variant.unit, variant.dpi));
  const trimHeightPx = Math.round(toPixels(variant.height, variant.unit, variant.dpi));
  const bleed = product.surface?.bleed;
  const totalWidthPx = Math.round(trimWidthPx + (bleed ? toPixels(bleed.left + bleed.right, bleed.unit, variant.dpi) : 0));
  const totalHeightPx = Math.round(trimHeightPx + (bleed ? toPixels(bleed.top + bleed.bottom, bleed.unit, variant.dpi) : 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white shadow-xl ring-1 ring-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div><h3 className="text-lg font-semibold text-gray-900">{variant.name}</h3><p className="mt-1 text-sm text-gray-500">{variant.sku} · {variant.width} x {variant.height} {variant.unit} · {variant.dpi} DPI</p></div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
          <div className="flex min-h-80 items-center justify-center rounded-lg bg-gray-50 p-4 ring-1 ring-gray-200">
            <SurfacePreview surface={product.surface} variant={variant} size={320} />
          </div>
          <div className="space-y-4">
            {!product.surface && <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">Surface configuration is missing, so bleed and safe area cannot be previewed.</div>}
            {variant.previewImageUrl && <img src={variant.previewImageUrl} alt={variant.name} className="max-h-52 w-full rounded-lg object-cover ring-1 ring-gray-200" />}
            <dl className="space-y-2 text-sm">
              <SummaryRow label="Trim area" value={`${trimWidthPx} x ${trimHeightPx} px`} />
              <SummaryRow label="Export with bleed" value={`${totalWidthPx} x ${totalHeightPx} px`} />
              <SummaryRow label="Surface" value={product.surface ? `${product.surface.name} (${product.surface.code})` : 'Missing'} />
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-gray-500">{label}</dt><dd className="text-right font-medium text-gray-900">{value}</dd></div>;
}
