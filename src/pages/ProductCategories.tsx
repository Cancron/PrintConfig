import { Link, useNavigate } from 'react-router-dom';
import { Copy, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { useCategories } from '../hooks/useCategories';
import { useProducts } from '../hooks/useProducts';
import { useWorkspace } from '../hooks/useWorkspace';
import { validateCategory } from '../lib/validation';
import type { ProductCategory, ProductCategoryStatus, ProductScope } from '../types';

const statusOptions: { value: ProductCategoryStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

const scopeOptions = [
  { value: 'shared', label: 'Shared across all merchant sites' },
  { value: 'merchant', label: 'Only for selected merchant' },
];

export function ProductCategories() {
  const navigate = useNavigate();
  const { categories, allCategories, account, selectedMerchantId, addCategory, updateCategory, deleteCategory, duplicateCategory } = useCategories();
  const { products, addProduct } = useProducts();
  const { merchants, selectedMerchant } = useWorkspace();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const filtered = categories.filter((category) => {
    const matchesSearch = category.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = !filter || category.scope === filter || category.status === filter;
    return matchesSearch && matchesFilter;
  });

  const productCounts = useMemo(() => new Map(categories.map((category) => [category.id, products.filter((product) => product.categoryId === category.id).length])), [categories, products]);

  function openCreate() {
    setEditing(null);
    setIsFormOpen(true);
  }

  function openEdit(category: ProductCategory) {
    setEditing(category);
    setIsFormOpen(true);
  }

  function handleDuplicate(category: ProductCategory) {
    const includeProducts = confirm('Duplicate category with all products? Choose Cancel to duplicate category only.');
    const relatedProducts = products.filter((product) => product.categoryId === category.id);
    const result = duplicateCategory(category, relatedProducts, includeProducts);
    result.products.forEach(addProduct);
    navigate(`/categories/${result.category.id}`);
  }

  return (
    <div>
      <PageHeader title="Product Categories" description="Shared categories plus custom categories for the selected merchant." action={<button onClick={openCreate} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"><Plus className="h-4 w-4" /> Create Category</button>} />

      <div className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search categories..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-md border-0 py-2 pl-9 pr-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm" />
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm">
            <option value="">All Categories</option>
            <option value="shared">Shared Categories</option>
            <option value="merchant">Merchant Custom Categories</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {filtered.length === 0 ? <EmptyState title="No categories found" description="Create a category or adjust your filters." action={<button onClick={openCreate} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"><Plus className="h-4 w-4" />Create Category</button>} /> : (
          <Table>
            <TableHead><TableHeader>Category name</TableHeader><TableHeader>Scope</TableHeader><TableHeader>Status</TableHeader><TableHeader>Products</TableHeader><TableHeader>Sort order</TableHeader><TableHeader>Updated</TableHeader><TableHeader className="text-right">Actions</TableHeader></TableHead>
            <TableBody>
              {filtered.map((category) => <tr key={category.id}>
                <TableCell><div className="flex items-center gap-3">{category.thumbnailUrl ? <img src={category.thumbnailUrl} alt={category.name} className="h-10 w-10 rounded-md object-cover" /> : <div className="h-10 w-10 rounded-md bg-gray-100" />}<span className="font-medium text-gray-900">{category.name}</span></div></TableCell>
                <TableCell><ScopeBadge scope={category.scope} />{category.scope === 'merchant' && <p className="mt-1 text-xs text-gray-500">{merchants.find((merchant) => merchant.id === category.merchantId)?.name}</p>}</TableCell>
                <TableCell><CategoryStatusBadge status={category.status} /></TableCell>
                <TableCell>{productCounts.get(category.id) ?? 0}</TableCell>
                <TableCell>{category.sortOrder}</TableCell>
                <TableCell>{new Date(category.updatedAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right"><div className="flex items-center justify-end gap-2"><Link to={`/categories/${category.id}`} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900" title="View"><Eye className="h-4 w-4" /></Link><button onClick={() => openEdit(category)} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900" title="Edit"><Pencil className="h-4 w-4" /></button><button onClick={() => handleDuplicate(category)} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900" title="Duplicate"><Copy className="h-4 w-4" /></button><button onClick={() => { if (confirm('Delete this category? Products will remain but need reassignment.')) deleteCategory(category.id); }} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button></div></TableCell>
              </tr>)}
            </TableBody>
          </Table>
        )}
      </div>

      {isFormOpen && <CategoryForm category={editing} allCategories={allCategories} accountId={account.id} selectedMerchantId={selectedMerchantId} selectedMerchantName={selectedMerchant?.name} onClose={() => setIsFormOpen(false)} onSave={(category) => { if (editing) { updateCategory(category); } else { addCategory(category); } setIsFormOpen(false); }} />}
    </div>
  );
}

export function CategoryForm({ category, allCategories, accountId, selectedMerchantId, selectedMerchantName, onClose, onSave }: { category: ProductCategory | null; allCategories: ProductCategory[]; accountId: string; selectedMerchantId: string; selectedMerchantName?: string; onClose: () => void; onSave: (category: ProductCategory) => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [status, setStatus] = useState<ProductCategoryStatus>(category?.status ?? 'draft');
  const [scope, setScope] = useState<ProductScope>(category?.scope ?? 'shared');
  const [thumbnailUrl, setThumbnailUrl] = useState(category?.thumbnailUrl ?? '');
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const merchantId = scope === 'merchant' ? selectedMerchantId : null;
  const errors = useMemo(() => validateCategory({ id: category?.id, name, slug, status, scope, merchantId, sortOrder, existingCategories: allCategories }), [allCategories, category?.id, merchantId, name, scope, slug, sortOrder, status]);
  const isValid = Object.keys(errors).length === 0;

  function handleName(value: string) {
    setName(value);
    if (!category) setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  }

  function save() {
    if (!isValid) return;
    const now = new Date().toISOString();
    onSave({ id: category?.id ?? `cat-${Date.now()}`, accountId, merchantId, scope, name: name.trim(), slug: slug.trim(), description: description.trim(), status, thumbnailUrl: thumbnailUrl.trim(), sortOrder: Number(sortOrder), createdAt: category?.createdAt ?? now, updatedAt: now });
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-2xl rounded-lg bg-white shadow-xl ring-1 ring-gray-200"><div className="border-b border-gray-200 px-5 py-4"><h2 className="text-lg font-semibold text-gray-900">{category ? 'Edit Category' : 'Create Category'}</h2></div><div className="space-y-4 p-5"><Input label="Category Name" value={name} onChange={(event) => handleName(event.target.value)} error={errors.name} /><Input label="Slug" value={slug} onChange={(event) => setSlug(event.target.value)} error={errors.slug} /><Textarea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /><Select label="Status" value={status} onChange={(event) => setStatus(event.target.value as ProductCategoryStatus)} options={statusOptions} error={errors.status} /><Select label="Scope" value={scope} onChange={(event) => setScope(event.target.value as ProductScope)} options={scopeOptions} error={errors.scope} />{scope === 'merchant' && <p className="rounded-md bg-purple-50 p-3 text-sm text-purple-700 ring-1 ring-inset ring-purple-200">This category will belong only to {selectedMerchantName ?? 'the selected merchant'}.</p>}<Input label="Thumbnail Image URL" type="url" value={thumbnailUrl} onChange={(event) => setThumbnailUrl(event.target.value)} /><Input label="Sort Order" type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} error={errors.sortOrder} /></div><div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4"><button onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">Cancel</button><button onClick={save} disabled={!isValid} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">Save Category</button></div></div></div>;
}

function ScopeBadge({ scope }: { scope: ProductScope }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${scope === 'shared' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' : 'bg-purple-50 text-purple-700 ring-purple-600/20'}`}>{scope === 'shared' ? 'Shared' : 'Merchant Custom'}</span>;
}

export function CategoryStatusBadge({ status }: { status: ProductCategoryStatus }) {
  const styles = status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : status === 'archived' ? 'bg-gray-50 text-gray-700 ring-gray-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20';
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize ring-1 ring-inset ${styles}`}>{status}</span>;
}

