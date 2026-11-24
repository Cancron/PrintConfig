import { Link } from 'react-router-dom';
import { Copy, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '../components/ui/Table';
import { useCategories } from '../hooks/useCategories';
import { useWorkspace } from '../hooks/useWorkspace';
import { api } from '../lib/api';
import type { ProductScope, ProductSummary, ProductType } from '../types';

const productTypes: ProductType[] = [
  'Canvas Print',
  'Metal Print',
  'Framed Print',
  'Photo Print',
  'Photo Collage Print',
  'Photo Book Print',
  'Pillow Print',
  'Mug Print',
  'AI Art Generation',
  'Art Print',
  'T-Shirt Print',
  'Business Card', 
  'Sticker'
];

export function Products() {
  const { categories } = useCategories();
  const { account, merchants, selectedMerchantId } = useWorkspace();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ProductScope | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, pageCount: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, debouncedSearch, pageSize, scopeFilter, statusFilter, typeFilter, selectedMerchantId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.listProductSummaries({
        accountId: account.id,
        merchantId: selectedMerchantId,
        search: debouncedSearch,
        productType: typeFilter,
        status: statusFilter,
        scope: scopeFilter,
        categoryId: categoryFilter,
        page,
        pageSize,
      });
      setProducts(result.items);
      setPagination(result.pagination);
      if (result.pagination.page !== page) setPage(result.pagination.page);
    } catch (reason) {
      setProducts([]);
      setError(reason instanceof Error ? reason.message : 'Could not load products.');
    } finally {
      setLoading(false);
    }
  }, [account.id, categoryFilter, debouncedSearch, page, pageSize, scopeFilter, selectedMerchantId, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  function categoryName(id: string) {
    return categories.find((category) => category.id === id)?.name ?? 'Unassigned';
  }

  async function handleDuplicate(id: string, scope: ProductScope) {
    const targetScope = scope === 'shared' && !confirm('Duplicate as shared product? Choose Cancel to duplicate as merchant custom for the selected merchant.') ? 'merchant' : scope;
    try {
      await api.duplicateProduct(id, targetScope, targetScope === 'merchant' ? selectedMerchantId : null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not duplicate product.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.deleteProduct(id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete product.');
    }
  }

  return (
    <div>
      <PageHeader title="Products" description="Shared products plus custom products for the selected merchant." action={<Link to="/products/new" className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"><Plus className="h-4 w-4" /> Create Product</Link>} />
      {loading && <div className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-700 ring-1 ring-inset ring-blue-200">Loading products from API...</div>}
      {error && <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">{error}</div>}
      <div className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row">
          <div className="relative max-w-md flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search products..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-md border-0 py-2 pl-9 pr-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm" /></div>
          <div className="flex flex-wrap gap-3">
            <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value as ProductScope | '')} className="rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm"><option value="">All Products</option><option value="shared">Shared Products</option><option value="merchant">Merchant Custom Products</option></select>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm"><option value="">All Categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm"><option value="">All Types</option>{productTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm"><option value="">All Statuses</option><option value="Active">Active</option><option value="Draft">Draft</option></select>
          </div>
        </div>
        {products.length === 0 && !loading ? <EmptyState title="No products found" description="Try adjusting your filters or create a new product." action={<Link to="/products/new" className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"><Plus className="h-4 w-4" />Create Product</Link>} /> : <Table><TableHead><TableHeader>Product</TableHeader><TableHeader>Category</TableHeader><TableHeader>Type</TableHeader><TableHeader>Status</TableHeader><TableHeader>Scope</TableHeader><TableHeader>Options</TableHeader><TableHeader>Variants</TableHeader><TableHeader>Updated</TableHeader><TableHeader className="text-right">Actions</TableHeader></TableHead><TableBody>{products.map((product) => <tr key={product.id}><TableCell className="w-64 max-w-64"><div className="flex min-w-0 items-center gap-3">{product.thumbnailUrl ? <img src={product.thumbnailUrl} alt={product.name} className="h-10 w-10 shrink-0 rounded-md object-cover" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-100"><span className="text-xs text-gray-400">IMG</span></div>}<span className="line-clamp-2 min-w-0 max-w-48 font-medium leading-5 text-gray-900" title={product.name}>{product.name}</span></div></TableCell><TableCell>{categoryName(product.categoryId)}</TableCell><TableCell>{product.productType}</TableCell><TableCell><Badge status={product.status} /></TableCell><TableCell><ScopeBadge scope={product.scope} />{product.scope === 'merchant' && <p className="mt-1 text-xs text-gray-500">{merchants.find((merchant) => merchant.id === product.merchantId)?.name}</p>}</TableCell><TableCell>{product.optionGroupCount}</TableCell><TableCell>{product.variantCount}</TableCell><TableCell>{new Date(product.updatedAt).toLocaleDateString()}</TableCell><TableCell className="text-right"><div className="flex items-center justify-end gap-2"><Link to={`/products/${product.id}`} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900" title="View"><Eye className="h-4 w-4" /></Link><Link to={`/products/${product.id}?tab=basic`} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900" title="Edit"><Pencil className="h-4 w-4" /></Link><button onClick={() => handleDuplicate(product.id, product.scope)} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900" title="Duplicate"><Copy className="h-4 w-4" /></button><button onClick={() => handleDelete(product.id)} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button></div></TableCell></tr>)}</TableBody></Table>}
        {pagination.total > 0 && (
          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
            <p>Showing <span className="font-medium text-gray-900">{(pagination.page - 1) * pagination.pageSize + 1}</span> to <span className="font-medium text-gray-900">{Math.min(pagination.total, pagination.page * pagination.pageSize)}</span> of <span className="font-medium text-gray-900">{pagination.total}</span> products</p>
            <div className="flex items-center gap-3">
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="Products per page" className="rounded-md border-0 px-3 py-2 shadow-sm ring-1 ring-inset ring-gray-300">
                {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} per page</option>)}
              </select>
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={pagination.page <= 1 || loading} className="rounded-md px-3 py-2 font-medium ring-1 ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300">Previous</button>
              <span className="min-w-24 text-center">Page {pagination.page} of {pagination.pageCount}</span>
              <button type="button" onClick={() => setPage((current) => Math.min(pagination.pageCount, current + 1))} disabled={pagination.page >= pagination.pageCount || loading} className="rounded-md px-3 py-2 font-medium ring-1 ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScopeBadge({ scope }: { scope: ProductScope }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${scope === 'shared' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' : 'bg-purple-50 text-purple-700 ring-purple-600/20'}`}>{scope === 'shared' ? 'Shared' : 'Merchant Custom'}</span>;
}
