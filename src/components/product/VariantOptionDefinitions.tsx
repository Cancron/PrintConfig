import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { Product, VariantOptionDefinition } from '../../types';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

const yesNoOptions = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
];

function entityKey(definition: VariantOptionDefinition) {
  return definition._id || definition.clientId || definition.key;
}

export function VariantOptionDefinitions({ product, onSave }: Props) {
  const definitions = useMemo(
    () => [...product.variantOptionDefinitions].sort((a, b) => a.sortOrder - b.sortOrder),
    [product.variantOptionDefinitions],
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState<VariantOptionDefinition | null>(null);

  const errors = useMemo(() => {
    if (!form) return {};
    const result: Record<string, string> = {};
    if (!form.name.trim()) result.name = 'Name is required.';
    if (!form.key.trim()) result.key = 'Key is required.';
    const currentDefinition = editingKey
      ? product.variantOptionDefinitions.find((definition) => entityKey(definition) === editingKey)
      : undefined;
    if (
      form.required &&
      product.variants.some((variant) => !String(variant.options[form.key] ?? (currentDefinition ? variant.options[currentDefinition.key] : '') ?? '').trim())
    ) {
      result.required = 'Fill this option on every existing variant before making it required.';
    }    if (
      product.variantOptionDefinitions.some(
        (definition) =>
          entityKey(definition) !== editingKey &&
          definition.key.trim().toLowerCase() === form.key.trim().toLowerCase(),
      )
    ) {
      result.key = 'Key must be unique within this product.';
    }
    return result;
  }, [editingKey, form, product.variantOptionDefinitions, product.variants]);

  function startAdd() {
    const now = new Date().toISOString();
    setEditingKey(null);
    setForm({
      _id: '',
      clientId: crypto.randomUUID(),
      productId: product._id,
      name: '',
      key: '',
      required: false,
      groupBy: false,
      sortOrder: definitions.length + 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  function startEdit(definition: VariantOptionDefinition) {
    setEditingKey(entityKey(definition));
    setForm({ ...definition });
  }

  function closeForm() {
    setEditingKey(null);
    setForm(null);
  }

  function saveDefinition() {
    if (!form || Object.keys(errors).length > 0) return;
    const now = new Date().toISOString();
    const oldDefinition = editingKey
      ? product.variantOptionDefinitions.find((definition) => entityKey(definition) === editingKey)
      : undefined;
    const nextDefinition = {
      ...form,
      name: form.name.trim(),
      key: form.key.trim(),
      updatedAt: now,
    };
    let nextDefinitions = editingKey
      ? product.variantOptionDefinitions.map((definition) =>
          entityKey(definition) === editingKey ? nextDefinition : definition,
        )
      : [...product.variantOptionDefinitions, nextDefinition];
    if (nextDefinition.groupBy) {
      nextDefinitions = nextDefinitions.map((definition) => ({
        ...definition,
        groupBy: entityKey(definition) === entityKey(nextDefinition),
      }));
    }
    const variants =
      oldDefinition && oldDefinition.key !== nextDefinition.key
        ? product.variants.map((variant) => {
            if (!(oldDefinition.key in variant.options)) return variant;
            const options = { ...variant.options };
            if (!(nextDefinition.key in options)) options[nextDefinition.key] = options[oldDefinition.key];
            delete options[oldDefinition.key];
            return { ...variant, options, updatedAt: now };
          })
        : product.variants;
    onSave({ ...product, variantOptionDefinitions: nextDefinitions, variants, updatedAt: now });
    closeForm();
  }

  function deleteDefinition(definition: VariantOptionDefinition) {
    if (!confirm(`Delete the "${definition.name}" definition? Existing variant option values will be kept.`)) return;
    onSave({
      ...product,
      variantOptionDefinitions: product.variantOptionDefinitions
        .filter((item) => entityKey(item) !== entityKey(definition))
        .map((item, index) => ({ ...item, sortOrder: index + 1 })),
      updatedAt: new Date().toISOString(),
    });
  }

  function moveDefinition(definition: VariantOptionDefinition, direction: -1 | 1) {
    const index = definitions.findIndex((item) => entityKey(item) === entityKey(definition));
    const target = index + direction;
    if (target < 0 || target >= definitions.length) return;
    const reordered = [...definitions];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    onSave({
      ...product,
      variantOptionDefinitions: reordered.map((item, sortIndex) => ({ ...item, sortOrder: sortIndex + 1 })),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <section className="overflow-hidden rounded-lg bg-white ring-1 ring-gray-200">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Option Definitions</h3>
          <p className="mt-1 text-sm text-gray-500">Define the named values stored on every variant and optionally choose one frontend grouping field.</p>
        </div>
        <button type="button" onClick={startAdd} className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
          <Plus className="h-4 w-4" /> Add Definition
        </button>
      </div>

      {definitions.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500">No option definitions. Variants may still use additional options.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Key</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Required</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">Group By</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {definitions.map((definition, index) => (
                <tr key={entityKey(definition)}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{definition.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{definition.key}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{definition.required ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{definition.groupBy ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" disabled={index === 0} onClick={() => moveDefinition(definition, -1)} title="Move up" className="rounded-md p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" disabled={index === definitions.length - 1} onClick={() => moveDefinition(definition, 1)} title="Move down" className="rounded-md p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                      <button type="button" onClick={() => startEdit(definition)} title="Edit" className="rounded-md p-2 text-gray-500 hover:bg-gray-100"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => deleteDefinition(definition)} title="Delete" className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-gray-900">{editingKey ? 'Edit Option Definition' : 'New Option Definition'}</h3>
              <button type="button" onClick={closeForm} title="Close" className="rounded-md p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <Input label="Name" value={form.name} onChange={(event) => setForm((current) => current ? { ...current, name: event.target.value } : current)} error={errors.name} />
              <Input label="Key" value={form.key} onChange={(event) => setForm((current) => current ? { ...current, key: event.target.value } : current)} error={errors.key} />
              <Select label="Required" value={form.required ? 'yes' : 'no'} onChange={(event) => setForm((current) => current ? { ...current, required: event.target.value === 'yes' } : current)} options={yesNoOptions} error={errors.required} />
              <Select label="Group By" value={form.groupBy ? 'yes' : 'no'} onChange={(event) => setForm((current) => current ? { ...current, groupBy: event.target.value === 'yes' } : current)} options={yesNoOptions} />
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button type="button" onClick={closeForm} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={saveDefinition} disabled={Object.keys(errors).length > 0} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"><Check className="h-4 w-4" /> Save Definition</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
