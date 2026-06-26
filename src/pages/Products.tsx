import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Copy, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Table, TableHead, TableBody, TableHeader, TableCell } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { useProducts } from '../hooks/useProducts';
import { useWorkspace } from '../hooks/useWorkspace';
import type { ProductScope, ProductType } from '../types';

const productTypes: ProductType[] = ['Canvas Print', 'Poster Print', 'Framed Poster', 'T-Shirt', 'Mug', 'Business Card', 'Sticker'];

export function Products() {
  const { products, deleteProduct, duplicateProduct } = useProducts();
  const { merchants } = useWorkspace();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [scopeFilter, setScopeFilter] = useState<ProductScope | ''>('');

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = !typeFilter || p.productType === typeFilter;
    const matchesStatus = !statusFilter || p.status === statusFilter;
    const matchesScope = !scopeFilter || p.scope === scopeFilter;
    return matchesSearch && matchesType && matchesStatus && matchesScope;
  });

  function handleDuplicate(id: string, scope: ProductScope) {
    const targetScope = scope === 'shared' && !confirm('Duplicate as shared product? Choose Cancel to duplicate as merchant custom for the selected merchant.') ? 'merchant' : scope;
    duplicateProduct(id, targetScope);
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Shared products plus custom products for the selected merchant."
        action={
          <Link to="/products/new" className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors">
            <Plus className="h-4 w-4" /> Create Product
          </Link>
        }
      />

      <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-md border-0 py-2 pl-9 pr-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm" />
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value as ProductScope | '')} className="rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm">
              <option value="">All Products</option>
              <option value="shared">Shared Products</option>
              <option value="merchant">Merchant Custom Products</option>
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm">
              <option value="">All Types</option>
              {productTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-slate-600 sm:text-sm">
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Draft">Draft</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No products found" description="Try adjusting your filters or create a new product." action={<Link to="/products/new" className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"><Plus className="h-4 w-4" />Create Product</Link>} />
        ) : (
          <Table>
            <TableHead>
              <TableHeader>Product</TableHeader>
              <TableHeader>Type</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Scope</TableHeader>
              <TableHeader>Variants</TableHeader>
              <TableHeader>Updated</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableHead>
            <TableBody>
              {filtered.map((product) => (
                <tr key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {product.thumbnailUrl ? <img src={product.thumbnailUrl} alt={product.name} className="h-10 w-10 rounded-md object-cover" /> : <div className="h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center"><span className="text-xs text-gray-400">IMG</span></div>}
                      <span className="font-medium text-gray-900">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{product.productType}</TableCell>
                  <TableCell><Badge status={product.status} /></TableCell>
                  <TableCell>
                    <ScopeBadge scope={product.scope} />
                    {product.scope === 'merchant' && <p className="mt-1 text-xs text-gray-500">{merchants.find((m) => m.id === product.merchantId)?.name}</p>}
                  </TableCell>
                  <TableCell>{product.variants.length}</TableCell>
                  <TableCell>{new Date(product.updatedAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link to={`/products/${product.id}`} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors" title="View"><Eye className="h-4 w-4" /></Link>
                      <Link to={`/products/${product.id}?tab=basic`} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors" title="Edit"><Pencil className="h-4 w-4" /></Link>
                      <button onClick={() => handleDuplicate(product.id, product.scope)} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors" title="Duplicate"><Copy className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm('Are you sure you want to delete this product?')) deleteProduct(product.id); }} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TableCell>
                </tr>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function ScopeBadge({ scope }: { scope: ProductScope }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${scope === 'shared' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' : 'bg-purple-50 text-purple-700 ring-purple-600/20'}`}>
      {scope === 'shared' ? 'Shared' : 'Merchant Custom'}
    </span>
  );
}

