import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { useCategories } from '../hooks/useCategories';
import { useProducts } from '../hooks/useProducts';
import { useWorkspace } from '../hooks/useWorkspace';
import { CategoryForm, CategoryStatusBadge } from './ProductCategories';

export function CategoryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { categories, allCategories, account, selectedMerchantId, updateCategory } = useCategories();
  const { products } = useProducts();
  const { selectedMerchant } = useWorkspace();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const category = categories.find((item) => item._id === id);

  if (!category) {
    return <div className="py-12 text-center"><h2 className="text-lg font-semibold text-gray-900">Category not found</h2><button onClick={() => navigate('/categories')} className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Back to Categories</button></div>;
  }

  const currentCategory = category;
  const categoryProducts = products.filter((product) => product.categoryId === currentCategory._id);
  const categoryExport = { category: currentCategory, products: categoryProducts };

  function exportCategory() {
    const blob = new Blob([JSON.stringify(categoryExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentCategory.slug}-category.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <button onClick={() => navigate('/categories')} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft className="h-4 w-4" />Back to Categories</button>
      <PageHeader title={currentCategory.name} description={currentCategory.description || 'Product category'} action={<div className="flex flex-wrap gap-2"><CategoryStatusBadge status={currentCategory.status} /><button onClick={() => setIsEditOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"><Pencil className="h-4 w-4" />Edit</button><button onClick={exportCategory} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"><Download className="h-4 w-4" />Export JSON</button><Link to={`/products/new?categoryId=${currentCategory._id}`} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"><Plus className="h-4 w-4" />New Product</Link></div>} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Info label="Scope" value={currentCategory.scope === 'shared' ? 'Shared' : `Merchant Custom (${selectedMerchant?.name ?? 'selected merchant'})`} />
        <Info label="Slug" value={currentCategory.slug} />
        <Info label="Sort order" value={String(currentCategory.sortOrder)} />
        <Info label="Products" value={String(categoryProducts.length)} />
      </div>

      <section className="mb-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Products in this category</h2>
        {categoryProducts.length === 0 ? <EmptyState title="No products in this category" description="Create a product directly inside this category." action={<Link to={`/products/new?categoryId=${currentCategory._id}`} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"><Plus className="h-4 w-4" />Create Product</Link>} /> : <Table><TableHead><TableHeader>Product</TableHeader><TableHeader>Status</TableHeader><TableHeader>Scope</TableHeader><TableHeader>Variants</TableHeader><TableHeader>Updated</TableHeader></TableHead><TableBody>{categoryProducts.map((product) => <tr key={product._id}><TableCell><Link to={`/products/${product._id}`} className="font-medium text-gray-900 hover:text-slate-700">{product.name}</Link></TableCell><TableCell><Badge status={product.status} /></TableCell><TableCell>{product.scope === 'shared' ? 'Shared' : 'Merchant Custom'}</TableCell><TableCell>{product.variants.length}</TableCell><TableCell>{new Date(product.updatedAt).toLocaleDateString()}</TableCell></tr>)}</TableBody></Table>}
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Category JSON Preview</h2>
        <pre className="max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-sm leading-relaxed text-slate-50"><code>{JSON.stringify(categoryExport, null, 2)}</code></pre>
      </section>

      {isEditOpen && <CategoryForm category={currentCategory} allCategories={allCategories} accountId={account._id} selectedMerchantId={selectedMerchantId} selectedMerchantName={selectedMerchant?.name} onClose={() => setIsEditOpen(false)} onSave={(next) => { updateCategory(next); setIsEditOpen(false); }} />}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"><p className="text-sm text-gray-500">{label}</p><p className="mt-1 text-lg font-semibold text-gray-900">{value}</p></div>;
}

