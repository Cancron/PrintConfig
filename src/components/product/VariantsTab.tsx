import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { Table, TableHead, TableBody, TableHeader, TableCell } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { EmptyState } from '../ui/EmptyState';
import type { Product, ProductVariant, ProductStatus } from '../../types';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

const statusOptions = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Active', label: 'Active' },
];

export function VariantsTab({ product, onSave }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [form, setForm] = useState<{
    name: string;
    sku: string;
    price: string;
    status: ProductStatus;
    options: { key: string; value: string }[];
  }>({
    name: '',
    sku: '',
    price: '',
    status: 'Draft',
    options: [{ key: '', value: '' }],
  });

  function resetForm() {
    setForm({
      name: '',
      sku: '',
      price: '',
      status: 'Draft',
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
      options: Object.entries(variant.options).map(([key, value]) => ({ key, value })),
    });
    setEditingId(variant.id);
    setIsAdding(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setIsAdding(false);
    resetForm();
  }

  function addOptionField() {
    setForm((prev) => ({
      ...prev,
      options: [...prev.options, { key: '', value: '' }],
    }));
  }

  function removeOptionField(index: number) {
    setForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  }

  function updateOption(index: number, field: 'key' | 'value', value: string) {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt)),
    }));
  }

  function handleSave() {
    const options: Record<string, string> = {};
    for (const opt of form.options) {
      if (opt.key.trim()) {
        options[opt.key.trim()] = opt.value.trim();
      }
    }

    const now = new Date().toISOString();
    const variant: ProductVariant = {
      id: editingId ?? `v-${Date.now()}`,
      productId: product.id,
      name: form.name.trim(),
      sku: form.sku.trim(),
      price: Number(form.price),
      status: form.status,
      options,
      surfaces: editingId ? product.variants.find((v) => v.id === editingId)?.surfaces ?? [] : [],
      createdAt: editingId ? (product.variants.find((v) => v.id === editingId)?.createdAt ?? now) : now,
      updatedAt: now,
    };

    let nextVariants: ProductVariant[];
    if (editingId) {
      nextVariants = product.variants.map((v) => (v.id === editingId ? variant : v));
    } else {
      nextVariants = [...product.variants, variant];
    }

    onSave({ ...product, variants: nextVariants });
    cancelEdit();
  }

  function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this variant?')) return;
    onSave({
      ...product,
      variants: product.variants.filter((v) => v.id !== id),
    });
  }

  const isFormOpen = isAdding || editingId !== null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">Variants</h2>
        {!isFormOpen && (
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Variant
          </button>
        )}
      </div>

      {isFormOpen && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6 ring-1 ring-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-4">
            {editingId ? 'Edit Variant' : 'New Variant'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Input
              label="Variant Name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Small Portrait"
            />
            <Input
              label="SKU"
              value={form.sku}
              onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
              placeholder="e.g. CP-S-P"
            />
            <Input
              label="Price"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              placeholder="0.00"
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as ProductStatus }))}
              options={statusOptions}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
            <div className="space-y-2">
              {form.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Key (e.g. size)"
                    value={opt.key}
                    onChange={(e) => updateOption(idx, 'key', e.target.value)}
                    className="flex-1 rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. 16x20)"
                    value={opt.value}
                    onChange={(e) => updateOption(idx, 'value', e.target.value)}
                    className="flex-1 rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm"
                  />
                  {form.options.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOptionField(idx)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addOptionField}
              className="mt-2 text-sm text-slate-700 hover:text-slate-900 font-medium"
            >
              + Add option
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              <Check className="h-4 w-4" />
              Save Variant
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

      {product.variants.length === 0 ? (
        <EmptyState
          title="No variants yet"
          description="Add your first variant to this product."
          action={
            <button
              onClick={startAdd}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Variant
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto ring-1 ring-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Options</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {product.variants.map((variant) => (
                <tr key={variant.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{variant.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{variant.sku}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">${variant.price.toFixed(2)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    <Badge status={variant.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(variant.options).map(([key, value]) => (
                        <span
                          key={key}
                          className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10"
                        >
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(variant)}
                        className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(variant.id)}
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
    </div>
  );
}
