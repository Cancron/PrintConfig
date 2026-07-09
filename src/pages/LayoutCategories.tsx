import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Copy, Download, Eye, FileJson, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { ImageField } from '../components/gallery/ImageField';
import { useLayouts } from '../hooks/useLayouts';
import { useWorkspace } from '../hooks/useWorkspace';
import { api } from '../lib/api';
import { validateLayoutCategory } from '../lib/validation';
import type { LayoutCategory, LayoutStatus, ProductScope } from '../types';

const statusOptions: { value: LayoutStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];
const scopeOptions = [
  { value: 'shared', label: 'Shared across all merchant sites' },
  { value: 'merchant', label: 'Only for selected merchant' },
];

export function LayoutCategories() {
  const navigate = useNavigate();
  const { categories, allCategories, templates, account, selectedMerchantId, addCategory, updateCategory, deleteCategory, duplicateCategory, loading, error, reload } = useLayouts({loadCollages: false});
  const { merchants, selectedMerchant } = useWorkspace();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<LayoutCategory | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = categories.filter((category) => {
    const query = search.toLowerCase();
    const matchesSearch = category.name.toLowerCase().includes(query) || category.description.toLowerCase().includes(query);
    const matchesFilter = !filter || category.scope === filter || category.status === filter;
    return matchesSearch && matchesFilter;
  });
  const templateCounts = useMemo(() => new Map(categories.map((category) => [category._id, templates.filter((template) => template.categoryId === category._id).length])), [categories, templates]);

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(category: LayoutCategory) { setEditing(category); setFormOpen(true); }

  async function handleDuplicate(category: LayoutCategory) {
    const includeTemplates = confirm('Duplicate category with all layout templates? Choose Cancel to duplicate category only.');
    const result = await duplicateCategory(category._id, includeTemplates);
    navigate(`/layouts/categories/${result.category._id}`);
  }

  async function handleExport(category: LayoutCategory) {
    const includeTemplates = confirm('Export this category with templates? Choose Cancel for category only.');
    const data = await api.exportLayoutCategory(category._id, includeTemplates);
    downloadJson(`layout-category-${category.slug}.json`, data);
  }

  return (
    <div>
      <PageHeader title="Layout Categories" description="Reusable design layout categories, separate from sellable product categories." action={<div className="flex flex-wrap gap-2"><button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"><Upload className="h-4 w-4" /> Import JSON</button><button onClick={openCreate} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> Create Category</button></div>} />
      {loading && <Notice tone="info">Loading layout categories...</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}

      <div className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row">
          <div className="relative max-w-md flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search layout categories..." className="w-full rounded-md border-0 py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-slate-600" /></div>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-md border-0 px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-slate-600"><option value="">All Categories</option><option value="shared">Shared Categories</option><option value="merchant">Merchant Custom Categories</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select>
        </div>
        {filtered.length === 0 ? <EmptyState title="No layout categories found" description="Create a layout category or adjust your filters." action={<button onClick={openCreate} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"><Plus className="h-4 w-4" />Create Category</button>} /> : (
          <Table>
            <TableHead><TableHeader>Thumbnail</TableHeader><TableHeader>Name</TableHeader><TableHeader>Scope</TableHeader><TableHeader>Status</TableHeader><TableHeader>Templates</TableHeader><TableHeader>Sort</TableHeader><TableHeader>Updated</TableHeader><TableHeader className="text-right">Actions</TableHeader></TableHead>
            <TableBody>{filtered.map((category) => <tr key={category._id}><TableCell>{category.thumbnailUrl ? <img src={category.thumbnailUrl} alt={category.name} className="h-12 w-12 rounded-md object-cover" /> : <div className="h-12 w-12 rounded-md bg-gray-100" />}</TableCell><TableCell><div><Link to={`/layouts/categories/${category._id}`} className="font-medium text-gray-900 hover:text-slate-700">{category.name}</Link><p className="mt-1 line-clamp-1 max-w-md text-xs text-gray-500">{category.description}</p></div></TableCell><TableCell><ScopeBadge scope={category.scope} />{category.scope === 'merchant' && <p className="mt-1 text-xs text-gray-500">{merchants.find((merchant) => merchant._id === category.merchantId)?.name}</p>}</TableCell><TableCell><StatusBadge status={category.status} /></TableCell><TableCell>{templateCounts.get(category._id) ?? 0}</TableCell><TableCell>{category.sortOrder}</TableCell><TableCell>{new Date(category.updatedAt).toLocaleDateString()}</TableCell><TableCell className="text-right"><div className="flex items-center justify-end gap-2"><Link to={`/layouts/categories/${category._id}`} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="View"><Eye className="h-4 w-4" /></Link><button onClick={() => openEdit(category)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="Edit"><Pencil className="h-4 w-4" /></button><button onClick={() => handleDuplicate(category)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="Duplicate"><Copy className="h-4 w-4" /></button><button onClick={() => handleExport(category)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="Export"><Download className="h-4 w-4" /></button><button onClick={() => { if (confirm('Delete this layout category? It must not contain templates.')) deleteCategory(category._id); }} className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button></div></TableCell></tr>)}</TableBody>
          </Table>
        )}
      </div>

      {formOpen && <LayoutCategoryForm category={editing} allCategories={allCategories} accountId={account._id} selectedMerchantId={selectedMerchantId} selectedMerchantName={selectedMerchant?.name} onClose={() => setFormOpen(false)} onSave={async (category) => { if (editing) await updateCategory(category); else await addCategory(category); setFormOpen(false); setMessage('Layout category saved.'); }} />}
      {importOpen && <ImportCategoryModal onClose={() => setImportOpen(false)} onImported={async () => { setImportOpen(false); setMessage('Layout category imported.'); reload(); }} />}
    </div>
  );
}

export function LayoutCategoryDetail() {
  const { id } = useParamsSafe();
  const navigate = useNavigate();
  const { categories, templates, loading } = useLayouts();
  const category = categories.find((item) => item._id === id);
  const categoryTemplates = templates.filter((template) => template.categoryId === id);
  if (loading && !category) return <Notice tone="info">Loading layout category...</Notice>;
  if (!category) return <EmptyState title="Layout category not found" description="The selected category is not available for this merchant." action={<button onClick={() => navigate('/layouts/categories')} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">Back to Layout Categories</button>} />;
  return <div><PageHeader title={category.name} description={category.description || 'Layout category details and templates.'} action={<Link to={`/layouts/templates/new?categoryId=${category._id}`} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> New Template</Link>} /><div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200"><h2 className="text-base font-semibold text-gray-900">Templates</h2>{categoryTemplates.length === 0 ? <EmptyState title="No templates in this category" description="Create a layout template directly inside this category." /> : <div className="mt-4 overflow-hidden rounded-lg ring-1 ring-gray-200"><Table><TableHead><TableHeader>Template</TableHeader><TableHeader>Type</TableHeader><TableHeader>Orientation</TableHeader><TableHeader>Status</TableHeader><TableHeader className="text-right">Actions</TableHeader></TableHead><TableBody>{categoryTemplates.map((template) => <tr key={template._id}><TableCell><Link to={`/layouts/templates/${template._id}`} className="font-medium text-gray-900 hover:text-slate-700">{template.name}</Link></TableCell><TableCell>{formatLabel(template.templateType)}</TableCell><TableCell>{formatLabel(template.orientation)}</TableCell><TableCell><StatusBadge status={template.status} /></TableCell><TableCell className="text-right"><Link to={`/layouts/templates/${template._id}`} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">Open</Link></TableCell></tr>)}</TableBody></Table></div>}</div><div className="space-y-6"><div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200"><h2 className="text-base font-semibold text-gray-900">Category Info</h2><dl className="mt-4 space-y-3 text-sm"><InfoRow label="Scope" value={category.scope === 'shared' ? 'Shared' : 'Merchant Custom'} /><InfoRow label="Status" value={category.status} /><InfoRow label="Sort order" value={String(category.sortOrder)} /><InfoRow label="Updated" value={new Date(category.updatedAt).toLocaleString()} /></dl></div><div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200"><div className="mb-3 flex items-center gap-2"><FileJson className="h-4 w-4 text-gray-500" /><h2 className="text-base font-semibold text-gray-900">JSON Preview</h2></div><pre className="max-h-96 overflow-auto rounded-md bg-gray-950 p-4 text-xs text-gray-100">{JSON.stringify(category, null, 2)}</pre></div></div></div></div>;
}

function LayoutCategoryForm({ category, allCategories, accountId, selectedMerchantId, selectedMerchantName, onClose, onSave }: { category: LayoutCategory | null; allCategories: LayoutCategory[]; accountId: string; selectedMerchantId: string; selectedMerchantName?: string; onClose: () => void; onSave: (category: LayoutCategory) => void | Promise<void> }) {
  const [name, setName] = useState(category?.name ?? '');
  const [slug, setSlug] = useState(category?.slug ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [status, setStatus] = useState<LayoutStatus>(category?.status ?? 'draft');
  const [scope, setScope] = useState<ProductScope>(category?.scope ?? 'shared');
  const [thumbnailUrl, setThumbnailUrl] = useState(category?.thumbnailUrl ?? '');
  const [thumbnailAssetId, setThumbnailAssetId] = useState(category?.thumbnailAssetId);
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));
  const merchantId = scope === 'merchant' ? selectedMerchantId : null;
  const errors = useMemo(() => validateLayoutCategory({ _id: category?._id, name, slug, status, scope, merchantId, sortOrder, existingCategories: allCategories }), [allCategories, category?._id, merchantId, name, scope, slug, sortOrder, status]);
  const isValid = Object.keys(errors).length === 0;
  function handleName(value: string) { setName(value); if (!category) setSlug(slugifyLocal(value)); }
  function save() { if (!isValid) return; const now = new Date().toISOString(); onSave({ _id: category?._id ?? '', accountId, merchantId, scope, name: name.trim(), slug: slug.trim(), description: description.trim(), status, thumbnailUrl: thumbnailUrl.trim(), thumbnailAssetId, sortOrder: Number(sortOrder), createdAt: category?.createdAt ?? now, updatedAt: now }); }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-2xl rounded-lg bg-white shadow-xl ring-1 ring-gray-200"><div className="border-b border-gray-200 px-5 py-4"><h2 className="text-lg font-semibold text-gray-900">{category ? 'Edit Layout Category' : 'Create Layout Category'}</h2></div><div className="max-h-[70vh] space-y-4 overflow-auto p-5"><Input label="Name" value={name} onChange={(event) => handleName(event.target.value)} error={errors.name} /><Input label="Slug" value={slug} onChange={(event) => setSlug(event.target.value)} error={errors.slug} /><Textarea label="Description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /><Select label="Status" value={status} onChange={(event) => setStatus(event.target.value as LayoutStatus)} options={statusOptions} error={errors.status} /><Select label="Scope" value={scope} onChange={(event) => setScope(event.target.value as ProductScope)} options={scopeOptions} error={errors.scope} />{scope === 'merchant' && <p className="rounded-md bg-purple-50 p-3 text-sm text-purple-700 ring-1 ring-purple-200">This layout category will belong only to {selectedMerchantName ?? 'the selected merchant'}.</p>}<ImageField label="Thumbnail Image URL" url={thumbnailUrl} assetId={thumbnailAssetId} onChange={(url, assetId) => { setThumbnailUrl(url); setThumbnailAssetId(assetId); }} /><Input label="Sort Order" type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} error={errors.sortOrder} /></div><div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4"><button onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">Cancel</button><button onClick={save} disabled={!isValid} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">Save Category</button></div></div></div>;
}

function ImportCategoryModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [json, setJson] = useState('');
  const [error, setError] = useState('');
  async function submit() { try { setError(''); await api.importLayoutCategory(JSON.parse(json)); onImported(); } catch (err) { setError(err instanceof Error ? err.message : 'Could not import category JSON.'); } }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-2xl rounded-lg bg-white shadow-xl ring-1 ring-gray-200"><div className="border-b border-gray-200 px-5 py-4"><h2 className="text-lg font-semibold text-gray-900">Import Layout Category JSON</h2></div><div className="p-5"><Textarea label="JSON" value={json} onChange={(event) => setJson(event.target.value)} rows={12} />{error && <p className="mt-2 text-sm text-red-600">{error}</p>}</div><div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4"><button onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">Cancel</button><button onClick={submit} disabled={!json.trim()} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300">Import</button></div></div></div>;
}

function ScopeBadge({ scope }: { scope: ProductScope }) { return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${scope === 'shared' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' : 'bg-purple-50 text-purple-700 ring-purple-600/20'}`}>{scope === 'shared' ? 'Shared' : 'Merchant Custom'}</span>; }
export function StatusBadge({ status }: { status: LayoutStatus }) { const styles = status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : status === 'archived' ? 'bg-gray-50 text-gray-700 ring-gray-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'; return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize ring-1 ring-inset ${styles}`}>{status}</span>; }
function Notice({ tone, children }: { tone: 'info' | 'warning' | 'success'; children: ReactNode }) { const styles = tone === 'info' ? 'bg-blue-50 text-blue-700 ring-blue-200' : tone === 'success' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200'; return <div className={`mb-4 rounded-md p-3 text-sm ring-1 ring-inset ${styles}`}>{children}</div>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><dt className="text-gray-500">{label}</dt><dd className="font-medium text-gray-900">{value}</dd></div>; }
function formatLabel(value: string) { return value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()); }
function slugifyLocal(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function downloadJson(filename: string, value: unknown) { const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
function useParamsSafe() { return useParams<{ id: string }>(); }