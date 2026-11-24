import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Search, X } from 'lucide-react';
import type { EditorProductSelectionMode, ProductSummary } from '../../types';
import { Select } from '../ui/Select';

interface Props {
  currentProductId: string;
  categoryId: string;
  products: ProductSummary[];
  mode: EditorProductSelectionMode;
  specificProductIds: string[];
  onModeChange: (mode: EditorProductSelectionMode) => void;
  onSpecificProductIdsChange: (ids: string[]) => void;
}

export function EditorProductSelection({
  currentProductId,
  categoryId,
  products,
  mode,
  specificProductIds,
  onModeChange,
  onSpecificProductIdsChange,
}: Props) {
  const [search, setSearch] = useState('');
  const candidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products
      .filter(
        (item) =>
          item._id !== currentProductId &&
          item.status === 'Active' &&
          !specificProductIds.includes(item._id)
      )
      .filter((item) =>
        !query
          ? true
          : [item.name, item.slug, item.productType].join(' ').toLowerCase().includes(query)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentProductId, products, search, specificProductIds]);

  const sameCategoryCount = products.filter(
    (item) =>
      item._id !== currentProductId &&
      item.status === 'Active' &&
      item.categoryId === categoryId
  ).length;

  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= specificProductIds.length) return;
    const next = [...specificProductIds];
    [next[index], next[target]] = [next[target], next[index]];
    onSpecificProductIdsChange(next);
  };

  return (
    <section className="space-y-4 border-t border-gray-200 pt-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Editor Product Selection</h3>
        <p className="mt-1 text-sm text-gray-600">
          Choose whether customers can switch products while using the editor.
        </p>
      </div>
      <Select
        label="Products available in the editor"
        value={mode}
        onChange={(event) => onModeChange(event.target.value as EditorProductSelectionMode)}
        options={[
          { value: 'single', label: 'Only this product' },
          { value: 'same-category', label: 'Products from the same category' },
          { value: 'specific', label: 'Specific products' },
        ]}
      />
      {mode === 'single' && (
        <p className="text-sm text-gray-600">Customers will remain on this product.</p>
      )}
      {mode === 'same-category' && (
        <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          {categoryId
            ? `${sameCategoryCount} active visible product${sameCategoryCount === 1 ? '' : 's'} currently match.`
            : 'Select a category to make same-category products available.'}
        </p>
      )}
      {mode === 'specific' && (
        <div className="space-y-4">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              aria-label="Search active products"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search active products"
              className="w-full rounded border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-48 overflow-y-auto rounded border border-gray-200">
            {candidates.length ? (
              candidates.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="truncate text-xs text-gray-500">
                      {item.productType} · {item.scope === 'shared' ? 'Shared' : 'Merchant Custom'}
                    </p>
                  </div>
                  <button
                    type="button"
                    title={`Add ${item.name}`}
                    aria-label={`Add ${item.name}`}
                    onClick={() => onSpecificProductIdsChange([...specificProductIds, item._id])}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-blue-600 hover:bg-blue-50"
                  >
                    <Plus size={17} />
                  </button>
                </div>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-gray-500">No matching products available.</p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Selected products ({specificProductIds.length})
            </p>
            {specificProductIds.map((id, index) => {
              const selected = products.find((item) => item._id === id);
              const unavailable = !selected || selected.status !== 'Active';
              return (
                <div
                  key={id}
                  className={`flex items-center gap-2 rounded border px-3 py-2 ${
                    unavailable ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {selected?.name ?? 'Unavailable product'}
                    </p>
                    <p className={`truncate text-xs ${unavailable ? 'text-amber-700' : 'text-gray-500'}`}>
                      {unavailable
                        ? `Deleted, inactive, or no longer visible (${id})`
                        : selected.slug}
                    </p>
                  </div>
                  <IconButton label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp size={16} />
                  </IconButton>
                  <IconButton
                    label="Move down"
                    disabled={index === specificProductIds.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={16} />
                  </IconButton>
                  <IconButton
                    label="Remove product"
                    danger
                    onClick={() =>
                      onSpecificProductIdsChange(specificProductIds.filter((item) => item !== id))
                    }
                  >
                    <X size={16} />
                  </IconButton>
                </div>
              );
            })}
            {!specificProductIds.length && (
              <p className="rounded border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500">
                No products selected yet.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function IconButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 ${
        danger ? 'text-red-600' : 'text-gray-600'
      }`}
    >
      {children}
    </button>
  );
}
