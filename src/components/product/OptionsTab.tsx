import { useMemo, useState } from 'react';
import { Check, Copy, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import type { PriceModifierType, Product, ProductOptionDisplayType, ProductOptionGroup, ProductOptionValue } from '../../types';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

const displayTypeOptions: { value: ProductOptionDisplayType; label: string }[] = [
  { value: 'Dropdown', label: 'Dropdown' },
  { value: 'Radio Buttons', label: 'Radio Buttons' },
  { value: 'Color Swatches', label: 'Color Swatches' },
  { value: 'Image Swatches', label: 'Image Swatches' },
  { value: 'Text Buttons', label: 'Text Buttons' },
];

const modifierOptions: { value: PriceModifierType; label: string }[] = [
  { value: 'none', label: 'No extra charge' },
  { value: 'fixed', label: 'Fixed amount' },
  { value: 'percentage', label: 'Percentage of base price' },
];

const yesNoOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export function OptionsTab({ product, onSave }: Props) {
  const sortedGroups = [...(product.optionGroups ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductOptionGroup | null>(null);
  const errors = useMemo(() => (form ? validateGroup(form, product.optionGroups, editingGroupId) : {}), [editingGroupId, form, product.optionGroups]);
  const isValid = Object.keys(errors).length === 0;
  const selectedDefaults = sortedGroups.map((group) => ({ group, value: group.values.find((value) => value.isDefault && value.isActive) ?? group.values.find((value) => value.isActive) })).filter((item): item is { group: ProductOptionGroup; value: ProductOptionValue } => Boolean(item.value));
  const finalPrice = selectedDefaults.reduce((total, item) => total + getModifierAmount(product.basePrice, item.value), product.basePrice);

  function startAddGroup() {
    setEditingGroupId(null);
    setForm(createGroup(product._id, sortedGroups.length + 1));
  }

  function startEditGroup(group: ProductOptionGroup) {
    setEditingGroupId(entityKey(group));
    setForm({ ...group, values: group.values.map((value) => ({ ...value, metadata: { ...value.metadata } })) });
  }

  function saveGroup() {
    if (!form || !isValid) return;
    const now = new Date().toISOString();
    const nextGroup: ProductOptionGroup = {
      ...form,
      name: form.name.trim(),
      code: form.code.trim(),
      updatedAt: now,
      values: form.values.map((value) => ({
        ...value,
        label: value.label.trim(),
        value: value.value.trim(),
        skuCode: value.skuCode.trim(),
        priceModifier: value.priceModifierType === 'none' ? 0 : Number(value.priceModifier),
        updatedAt: now,
      })),
    };
    const optionGroups = editingGroupId ? product.optionGroups.map((group) => (entityKey(group) === editingGroupId ? nextGroup : group)) : [...product.optionGroups, nextGroup];
    onSave({ ...product, optionGroups });
    setForm(null);
    setEditingGroupId(null);
  }

  function deleteGroup(groupId: string) {
    if (!confirm('Delete this option group?')) return;
    onSave({ ...product, optionGroups: product.optionGroups.filter((group) => entityKey(group) !== groupId) });
  }

  function duplicateGroup(group: ProductOptionGroup) {
    const now = new Date().toISOString();
    const clientId = crypto.randomUUID();
    const copy: ProductOptionGroup = {
      ...group,
      _id: '',
      clientId,
      name: `${group.name} Copy`,
      code: `${group.code}-copy`,
      sortOrder: sortedGroups.length + 1,
      values: group.values.map((value) => ({ ...value, _id: '', clientId: crypto.randomUUID(), optionGroupId: '', createdAt: now, updatedAt: now })),
      createdAt: now,
      updatedAt: now,
    };
    onSave({ ...product, optionGroups: [...product.optionGroups, copy] });
  }

  function moveGroup(groupId: string, direction: -1 | 1) {
    const index = sortedGroups.findIndex((group) => entityKey(group) === groupId);
    const target = index + direction;
    if (target < 0 || target >= sortedGroups.length) return;
    const next = [...sortedGroups];
    [next[index], next[target]] = [next[target], next[index]];
    onSave({ ...product, optionGroups: next.map((group, order) => ({ ...group, sortOrder: order + 1 })) });
  }

  function updateForm<K extends keyof ProductOptionGroup>(field: K, value: ProductOptionGroup[K]) {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function addValue() {
    setForm((prev) => (prev ? { ...prev, values: [...prev.values, createValue(prev._id, prev.values.length + 1)] } : prev));
  }

  function updateValue<K extends keyof ProductOptionValue>(id: string, field: K, value: ProductOptionValue[K]) {
    setForm((prev) => {
      if (!prev) return prev;
      const values = prev.values.map((item) => {
        if (entityKey(item) !== id) return field === 'isDefault' && value === true ? { ...item, isDefault: false } : item;
        return { ...item, [field]: value };
      });
      return { ...prev, values };
    });
  }

  function updateValueMetadata(id: string, field: keyof ProductOptionValue['metadata'], value: string) {
    setForm((prev) => prev ? { ...prev, values: prev.values.map((item) => entityKey(item) === id ? { ...item, metadata: { ...item.metadata, [field]: value } } : item) } : prev);
  }

  function deleteValue(id: string) {
    setForm((prev) => (prev ? { ...prev, values: prev.values.filter((value) => entityKey(value) !== id) } : prev));
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Product Options</h2>
          <p className="mt-1 text-sm text-gray-500">Manage customer-selectable options owned by this product.</p>
        </div>
        {!form && <button type="button" onClick={startAddGroup} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> Add Option Group</button>}
      </div>

      <PricePreview basePrice={product.basePrice} selectedDefaults={selectedDefaults} finalPrice={finalPrice} />

      {form && (
        <div className="rounded-lg bg-gray-50 p-5 ring-1 ring-gray-200">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Input label="Name" value={form.name} onChange={(e) => updateForm('name', e.target.value)} error={errors.name} />
            <Input label="Code" value={form.code} onChange={(e) => updateForm('code', slugify(e.target.value))} error={errors.code} />
            <Select label="Display Type" value={form.displayType} onChange={(e) => updateForm('displayType', e.target.value as ProductOptionDisplayType)} options={displayTypeOptions} />
            <Select label="Required" value={form.required ? 'yes' : 'no'} onChange={(e) => updateForm('required', e.target.value === 'yes')} options={yesNoOptions} />
            <Input label="Sort Order" type="number" value={form.sortOrder} onChange={(e) => updateForm('sortOrder', Number(e.target.value))} />
          </div>
          {errors.activeValues && <p className="mt-2 text-sm text-red-600">{errors.activeValues}</p>}

          <div className="mt-6 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Option Values</h3>
            <button type="button" onClick={addValue} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"><Plus className="h-4 w-4" /> Add Value</button>
          </div>

          <div className="mt-3 space-y-4">
            {form.values.map((value) => (
              <div key={entityKey(value)} className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Input label="Label" value={value.label} onChange={(e) => updateValue(entityKey(value), 'label', e.target.value)} error={errors[`value.${entityKey(value)}.label`]} />
                  <Input label="Value" value={value.value} onChange={(e) => updateValue(entityKey(value), 'value', slugify(e.target.value))} error={errors[`value.${entityKey(value)}.value`]} />
                  <Input label="SKU Code" value={value.skuCode} onChange={(e) => updateValue(entityKey(value), 'skuCode', e.target.value)} />
                  <Select label="Price Modifier Type" value={value.priceModifierType} onChange={(e) => updateValue(entityKey(value), 'priceModifierType', e.target.value as PriceModifierType)} options={modifierOptions} />
                  <Input label="Price Modifier" type="number" step="0.01" value={value.priceModifier} onChange={(e) => updateValue(entityKey(value), 'priceModifier', Number(e.target.value))} error={errors[`value.${entityKey(value)}.priceModifier`]} />
                  <Select label="Default" value={value.isDefault ? 'yes' : 'no'} onChange={(e) => updateValue(entityKey(value), 'isDefault', e.target.value === 'yes')} options={yesNoOptions} />
                  <Select label="Active" value={value.isActive ? 'yes' : 'no'} onChange={(e) => updateValue(entityKey(value), 'isActive', e.target.value === 'yes')} options={yesNoOptions} />
                  <Input label="Sort Order" type="number" value={value.sortOrder} onChange={(e) => updateValue(entityKey(value), 'sortOrder', Number(e.target.value))} />
                  <Input label="Preview Image URL" value={value.previewImageUrl} onChange={(e) => updateValue(entityKey(value), 'previewImageUrl', e.target.value)} />
                  <Input label="Thumbnail Image URL" value={value.thumbnailImageUrl} onChange={(e) => updateValue(entityKey(value), 'thumbnailImageUrl', e.target.value)} />
                  <Input label="Color Hex" value={value.metadata.colorHex ?? ''} onChange={(e) => updateValueMetadata(entityKey(value), 'colorHex', e.target.value)} error={errors[`value.${entityKey(value)}.colorHex`]} />
                  <Input label="Production Code" value={value.metadata.productionCode ?? ''} onChange={(e) => updateValueMetadata(entityKey(value), 'productionCode', e.target.value)} />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Textarea label="Description" value={value.metadata.description ?? ''} onChange={(e) => updateValueMetadata(entityKey(value), 'description', e.target.value)} rows={2} />
                  <Textarea label="Export Notes" value={value.metadata.exportNotes ?? ''} onChange={(e) => updateValueMetadata(entityKey(value), 'exportNotes', e.target.value)} rows={2} />
                </div>
                <div className="mt-3 flex justify-end"><button type="button" onClick={() => deleteValue(entityKey(value))} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete Value</button></div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button type="button" onClick={saveGroup} disabled={!isValid} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"><Check className="h-4 w-4" /> Save Group</button>
            <button type="button" onClick={() => { setForm(null); setEditingGroupId(null); }} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"><X className="h-4 w-4" /> Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {sortedGroups.map((group, index) => (
          <div key={entityKey(group)} className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900">{group.name}</h3>
                  <Pill>{group.displayType}</Pill>
                  <Pill tone={group.required ? 'amber' : 'gray'}>{group.required ? 'Required' : 'Optional'}</Pill>
                </div>
                <p className="mt-1 text-sm text-gray-500">Code: {group.code} � {group.values.length} values</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => moveGroup(entityKey(group), -1)} disabled={index === 0} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40"><GripVertical className="h-4 w-4" /></button>
                <button type="button" onClick={() => startEditGroup(group)} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"><Pencil className="h-4 w-4" /> Edit</button>
                <button type="button" onClick={() => duplicateGroup(group)} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"><Copy className="h-4 w-4" /> Duplicate</button>
                <button type="button" onClick={() => deleteGroup(entityKey(group))} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button>
              </div>
            </div>

            <OptionCustomerPreview group={group} />
            <OptionValueTable group={group} />
          </div>
        ))}
      </div>
    </div>
  );
}

function OptionValueTable({ group }: { group: ProductOptionGroup }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg ring-1 ring-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-left">
        <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Preview</th><th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Value</th><th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Price</th><th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Status</th></tr></thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {[...group.values].sort((a, b) => a.sortOrder - b.sortOrder).map((value) => (
            <tr key={entityKey(value)}>
              <td className="px-4 py-3">{(value.thumbnailImageUrl || value.previewImageUrl) ? <img src={value.thumbnailImageUrl || value.previewImageUrl} alt="" className="h-10 w-12 rounded object-cover" /> : value.metadata.colorHex ? <span className="block h-8 w-8 rounded-full ring-1 ring-gray-300" style={{ backgroundColor: value.metadata.colorHex }} /> : <span className="text-xs text-gray-400">None</span>}</td>
              <td className="px-4 py-3"><p className="text-sm font-medium text-gray-900">{value.label}</p><p className="text-xs text-gray-500">{value.value}</p></td>
              <td className="px-4 py-3 text-sm text-gray-700">{formatModifier(value)}</td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{value.isDefault && <Pill tone="blue">Default</Pill>}<Pill tone={value.isActive ? 'emerald' : 'gray'}>{value.isActive ? 'Active' : 'Inactive'}</Pill></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OptionCustomerPreview({ group }: { group: ProductOptionGroup }) {
  const values = [...group.values].filter((value) => value.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="mt-4 rounded-lg bg-gray-50 p-4 ring-1 ring-gray-200">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Customer Preview</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {group.displayType === 'Dropdown' && <select className="rounded-md border-0 px-3 py-2 text-sm ring-1 ring-gray-300">{values.map((value) => <option key={entityKey(value)}>{value.label} ({formatModifier(value)})</option>)}</select>}
        {group.displayType === 'Image Swatches' && values.map((value) => <div key={entityKey(value)} className="w-32 rounded-lg bg-white p-2 ring-1 ring-gray-200"><div className="h-20 rounded bg-gray-100">{(value.previewImageUrl || value.thumbnailImageUrl) && <img src={value.previewImageUrl || value.thumbnailImageUrl} alt="" className="h-full w-full rounded object-cover" />}</div><p className="mt-2 text-sm font-medium text-gray-900">{value.label}</p><p className="text-xs text-gray-500">{formatModifier(value)}</p></div>)}
        {group.displayType === 'Color Swatches' && values.map((value) => <div key={entityKey(value)} className="flex items-center gap-2 rounded-md bg-white px-3 py-2 ring-1 ring-gray-200"><span className="h-6 w-6 rounded-full ring-1 ring-gray-300" style={{ backgroundColor: value.metadata.colorHex || '#ffffff' }} /><span className="text-sm">{value.label} � {formatModifier(value)}</span></div>)}
        {group.displayType === 'Text Buttons' && values.map((value) => <button key={entityKey(value)} type="button" className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300">{value.label} � {formatModifier(value)}</button>)}
        {group.displayType === 'Radio Buttons' && values.map((value) => <label key={entityKey(value)} className="flex items-center gap-2 text-sm text-gray-700"><input type="radio" name={entityKey(group)} defaultChecked={value.isDefault} /> {value.label} � {formatModifier(value)}</label>)}
      </div>
    </div>
  );
}

function PricePreview({ basePrice, selectedDefaults, finalPrice }: { basePrice: number; selectedDefaults: { group: ProductOptionGroup; value: ProductOptionValue }[]; finalPrice: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
      <h3 className="text-sm font-semibold text-slate-900">Price Calculator Preview</h3>
      <div className="mt-3 space-y-2 text-sm text-slate-700">
        <div className="flex justify-between"><span>Base price</span><span className="font-medium">${basePrice.toFixed(2)}</span></div>
        {selectedDefaults.map(({ group, value }) => <div key={entityKey(group)} className="flex justify-between"><span>{group.name}: {value.label}</span><span>{formatModifier(value)}</span></div>)}
        <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-semibold text-slate-900"><span>Final price</span><span>${finalPrice.toFixed(2)}</span></div>
      </div>
    </div>
  );
}

function validateGroup(group: ProductOptionGroup, groups: ProductOptionGroup[], editingId: string | null) {
  const errors: Record<string, string> = {};
  if (!group.name.trim()) errors.name = 'Option group name is required.';
  if (!group.code.trim()) errors.code = 'Option group code is required.';
  if (group.code.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(group.code.trim())) errors.code = 'Use lowercase letters, numbers, and hyphens only.';
  if (groups.some((item) => entityKey(item) !== editingId && item.code.trim().toLowerCase() === group.code.trim().toLowerCase())) errors.code = 'Code must be unique within this product.';
  if (group.required && !group.values.some((value) => value.isActive)) errors.activeValues = 'Required groups need at least one active value.';
  if (group.values.filter((value) => value.isDefault).length > 1) errors.activeValues = 'Only one value can be default.';
  const seen = new Set<string>();
  for (const value of group.values) {
    if (!value.label.trim()) errors[`value.${entityKey(value)}.label`] = 'Label is required.';
    if (!value.value.trim()) errors[`value.${entityKey(value)}.value`] = 'Value is required.';
    if (value.value.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.value.trim())) errors[`value.${entityKey(value)}.value`] = 'Use slug-safe lowercase text.';
    if (seen.has(value.value.trim().toLowerCase())) errors[`value.${entityKey(value)}.value`] = 'Value must be unique in this group.';
    seen.add(value.value.trim().toLowerCase());
    if (!Number.isFinite(Number(value.priceModifier))) errors[`value.${entityKey(value)}.priceModifier`] = 'Price modifier must be numeric.';
    if (value.priceModifierType === 'none' && Number(value.priceModifier) !== 0) errors[`value.${entityKey(value)}.priceModifier`] = 'No extra charge must use 0.';
    if ((value.priceModifierType === 'fixed' || value.priceModifierType === 'percentage') && Number(value.priceModifier) < 0) errors[`value.${entityKey(value)}.priceModifier`] = 'Price modifier must be zero or greater.';
    if (value.metadata.colorHex && !/^#[0-9a-f]{6}$/i.test(value.metadata.colorHex)) errors[`value.${entityKey(value)}.colorHex`] = 'Use a valid hex color.';
  }
  return errors;
}

function createGroup(productId: string, sortOrder: number): ProductOptionGroup {
  const now = new Date().toISOString();
  return { _id: '', clientId: crypto.randomUUID(), productId, name: '', code: '', displayType: 'Dropdown', required: true, sortOrder, values: [], createdAt: now, updatedAt: now };
}

function createValue(optionGroupId: string, sortOrder: number): ProductOptionValue {
  const now = new Date().toISOString();
  return { _id: '', clientId: crypto.randomUUID(), optionGroupId, label: '', value: '', skuCode: '', priceModifierType: 'none', priceModifier: 0, isDefault: sortOrder === 1, isActive: true, sortOrder, previewImageUrl: '', thumbnailImageUrl: '', metadata: {}, createdAt: now, updatedAt: now };
}

function getModifierAmount(basePrice: number, value: ProductOptionValue) {
  if (value.priceModifierType === 'fixed') return value.priceModifier;
  if (value.priceModifierType === 'percentage') return (basePrice * value.priceModifier) / 100;
  return 0;
}

function formatModifier(value: ProductOptionValue) {
  if (value.priceModifierType === 'fixed') return `+$${value.priceModifier.toFixed(2).replace(/\.00$/, '')}`;
  if (value.priceModifierType === 'percentage') return `+${value.priceModifier}%`;
  return 'No extra charge';
}

function Pill({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'blue' | 'emerald' | 'amber' }) {
  const styles = { gray: 'bg-gray-50 text-gray-700 ring-gray-600/20', blue: 'bg-blue-50 text-blue-700 ring-blue-600/20', emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', amber: 'bg-amber-50 text-amber-700 ring-amber-600/20' }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${styles}`}>{children}</span>;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function entityKey(entity: { _id: string; clientId?: string }) {
  return entity._id || entity.clientId || '';
}
