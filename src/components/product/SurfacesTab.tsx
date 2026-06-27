import { useMemo, useState } from 'react';
import { Check, Pencil, Plus, X } from 'lucide-react';
import { SurfacePreview } from './SurfacePreview';
import { EmptyState } from '../ui/EmptyState';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { toPixels, validateSurface } from '../../lib/validation';
import type { BleedSettings, Product, ProductSurface, ProductUnit, SafeAreaSettings } from '../../types';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

const yesNoOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const unitOptions: { value: ProductUnit; label: string }[] = [
  { value: 'inch', label: 'inch' },
  { value: 'mm', label: 'mm' },
  { value: 'px', label: 'px' },
];

function defaultBleed(): BleedSettings {
  return { top: 0.125, right: 0.125, bottom: 0.125, left: 0.125, unit: 'inch' };
}

function defaultSafeArea(): SafeAreaSettings {
  return { top: 0.25, right: 0.25, bottom: 0.25, left: 0.25, unit: 'inch' };
}

function defaultSurface(productId: string): ProductSurface {
  const now = new Date().toISOString();
  return {
    _id: '',
    clientId: crypto.randomUUID(),
    productId,
    name: 'Front Print Area',
    code: 'front',
    backgroundColor: '#ffffff',
    allowTransparency: false,
    bleed: defaultBleed(),
    safeArea: defaultSafeArea(),
    createdAt: now,
    updatedAt: now,
  };
}

export function SurfacesTab({ product, onSave }: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants[0]?._id ?? '');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<ProductSurface>(() => product.surface ?? defaultSurface(product._id));
  const selectedVariant = product.variants.find((variant) => variant._id === selectedVariantId) ?? product.variants[0];
  const errors = useMemo(() => validateSurface(form, selectedVariant), [form, selectedVariant]);
  const isValid = Object.keys(errors).length === 0;
  const dimensions = selectedVariant ? calculateDimensions(form, selectedVariant) : null;

  function startAdd() {
    setForm(defaultSurface(product._id));
    setIsFormOpen(true);
  }

  function startEdit() {
    setForm(product.surface ?? defaultSurface(product._id));
    setIsFormOpen(true);
  }

  function cancelEdit() {
    setIsFormOpen(false);
    setForm(product.surface ?? defaultSurface(product._id));
  }

  function updateForm<K extends keyof ProductSurface>(field: K, value: ProductSurface[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateBleed(field: keyof BleedSettings, value: number | ProductUnit) {
    setForm((prev) => ({ ...prev, bleed: { ...prev.bleed, [field]: value } }));
  }

  function updateSafeArea(field: keyof SafeAreaSettings, value: number | ProductUnit) {
    setForm((prev) => ({ ...prev, safeArea: { ...prev.safeArea, [field]: value } }));
  }

  function handleSave() {
    if (!isValid) return;
    const now = new Date().toISOString();
    const surface: ProductSurface = {
      ...form,
      productId: product._id,
      name: form.name.trim(),
      code: form.code.trim(),
      createdAt: product.surface?.createdAt ?? form.createdAt ?? now,
      updatedAt: now,
    };
    onSave({ ...product, surface, updatedAt: now });
    setIsFormOpen(false);
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Surface Configuration</h2>
          <p className="mt-1 text-sm text-gray-500">One common editable surface is used across this product. Variants define the actual production size.</p>
        </div>
        {!isFormOpen && product.surface && (
          <button onClick={startEdit} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"><Pencil className="h-4 w-4" /> Edit Surface</button>
        )}
      </div>

      {!product.surface && !isFormOpen && (
        <EmptyState title="No surface configured yet" description="Add the common print/editable area for this product." action={<button onClick={startAdd} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"><Plus className="h-4 w-4" /> Add Surface Configuration</button>} />
      )}

      {product.surface && !isFormOpen && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-lg bg-white p-5 ring-1 ring-gray-200 xl:col-span-2">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Info label="Surface name" value={product.surface.name} />
              <Info label="Surface code" value={product.surface.code} />
              <Info label="Bleed settings" value={formatBox(product.surface.bleed)} />
              <Info label="Safe area settings" value={formatBox(product.surface.safeArea)} />
              <Info label="Background color" value={product.surface.backgroundColor} />
              <Info label="Allow transparency" value={product.surface.allowTransparency ? 'Yes' : 'No'} />
            </dl>
          </div>
          <PreviewPanel product={product} selectedVariantId={selectedVariantId} onVariantChange={setSelectedVariantId} />
        </div>
      )}

      {isFormOpen && (
        <div className="rounded-lg bg-gray-50 p-5 ring-1 ring-gray-200">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Surface Name" value={form.name} onChange={(event) => updateForm('name', event.target.value)} error={errors.name} placeholder="Front Print Area" />
                <Input label="Surface Code" value={form.code} onChange={(event) => updateForm('code', event.target.value)} error={errors.code} placeholder="front" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Background Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={form.backgroundColor} onChange={(event) => updateForm('backgroundColor', event.target.value)} className="h-10 w-10 cursor-pointer rounded-md border-0 p-0" />
                    <input type="text" value={form.backgroundColor} onChange={(event) => updateForm('backgroundColor', event.target.value)} className="flex-1 rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm" />
                  </div>
                  {errors.backgroundColor && <p className="mt-1 text-sm text-red-600">{errors.backgroundColor}</p>}
                </div>
                <Select label="Allow Transparency" value={form.allowTransparency ? 'yes' : 'no'} onChange={(event) => updateForm('allowTransparency', event.target.value === 'yes')} options={yesNoOptions} />
              </div>

              <BoxFields title="Bleed" box={form.bleed} errors={errors} prefix="bleed" onChange={updateBleed} />
              <BoxFields title="Safe Area" box={form.safeArea} errors={errors} prefix="safeArea" onChange={updateSafeArea} />
            </div>

            <div className="space-y-4">
              <Select label="Preview Variant" value={selectedVariant?._id ?? ''} onChange={(event) => setSelectedVariantId(event.target.value)} options={product.variants.length > 0 ? product.variants.map((variant) => ({ value: variant._id, label: `${variant.name} (${variant.width}x${variant.height})` })) : [{ value: '', label: 'No variants available' }]} disabled={product.variants.length === 0} />
              <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Preview</h4>
                {selectedVariant ? <SurfacePreview surface={form} variant={selectedVariant} size={240} /> : <p className="text-sm text-gray-500">Add a variant to preview the surface ratio.</p>}
              </div>
              <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Production Dimensions</h4>
                {dimensions ? <dl className="space-y-2 text-sm"><SummaryRow label="Trim" value={`${dimensions.widthPx} x ${dimensions.heightPx} px`} /><SummaryRow label="With bleed" value={`${dimensions.totalWidthWithBleedPx} x ${dimensions.totalHeightWithBleedPx} px`} /></dl> : <p className="text-sm text-gray-500">No dimensions available.</p>}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button onClick={handleSave} disabled={!isValid} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"><Check className="h-4 w-4" /> Save Surface</button>
            <button onClick={cancelEdit} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50"><X className="h-4 w-4" /> Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewPanel({ product, selectedVariantId, onVariantChange }: { product: Product; selectedVariantId: string; onVariantChange: (id: string) => void }) {
  const selectedVariant = product.variants.find((variant) => variant._id === selectedVariantId) ?? product.variants[0];
  const dimensions = product.surface && selectedVariant ? calculateDimensions(product.surface, selectedVariant) : null;
  return (
    <div className="space-y-4 rounded-lg bg-white p-4 ring-1 ring-gray-200">
      <Select label="Preview Variant" value={selectedVariant?._id ?? ''} onChange={(event) => onVariantChange(event.target.value)} options={product.variants.length > 0 ? product.variants.map((variant) => ({ value: variant._id, label: `${variant.name} (${variant.width}x${variant.height})` })) : [{ value: '', label: 'No variants available' }]} disabled={product.variants.length === 0} />
      <div className="flex justify-center">{product.surface && selectedVariant ? <SurfacePreview surface={product.surface} variant={selectedVariant} size={240} /> : <p className="text-sm text-gray-500">Add a variant to preview.</p>}</div>
      {dimensions && <dl className="space-y-2 text-sm"><SummaryRow label="Trim" value={`${dimensions.widthPx} x ${dimensions.heightPx} px`} /><SummaryRow label="With bleed" value={`${dimensions.totalWidthWithBleedPx} x ${dimensions.totalHeightWithBleedPx} px`} /></dl>}
    </div>
  );
}

function BoxFields({ title, box, errors, prefix, onChange }: { title: string; box: BleedSettings | SafeAreaSettings; errors: Record<string, string>; prefix: 'bleed' | 'safeArea'; onChange: (field: keyof BleedSettings, value: number | ProductUnit) => void }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <Select label="Unit" value={box.unit} onChange={(event) => onChange('unit', event.target.value as ProductUnit)} options={unitOptions} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(['top', 'right', 'bottom', 'left'] as const).map((field) => <Input key={field} label={capitalize(field)} type="number" step="0.001" min="0" value={box[field]} onChange={(event) => onChange(field, Number(event.target.value))} error={errors[`${prefix}.${field}`]} />)}
      </div>
    </section>
  );
}

function calculateDimensions(surface: ProductSurface, variant: Product['variants'][number]) {
  const widthPx = Math.round(toPixels(variant.width, variant.unit, variant.dpi));
  const heightPx = Math.round(toPixels(variant.height, variant.unit, variant.dpi));
  const bleedLeft = toPixels(surface.bleed.left, surface.bleed.unit, variant.dpi);
  const bleedRight = toPixels(surface.bleed.right, surface.bleed.unit, variant.dpi);
  const bleedTop = toPixels(surface.bleed.top, surface.bleed.unit, variant.dpi);
  const bleedBottom = toPixels(surface.bleed.bottom, surface.bleed.unit, variant.dpi);
  return { widthPx, heightPx, totalWidthWithBleedPx: Math.round(widthPx + bleedLeft + bleedRight), totalHeightWithBleedPx: Math.round(heightPx + bleedTop + bleedBottom) };
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-sm text-gray-500">{label}</dt><dd className="mt-1 text-sm font-medium text-gray-900">{value}</dd></div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-gray-500">{label}</dt><dd className="text-right font-medium text-gray-900">{value}</dd></div>;
}

function formatBox(box: BleedSettings | SafeAreaSettings) {
  return `${box.top} / ${box.right} / ${box.bottom} / ${box.left} ${box.unit}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
