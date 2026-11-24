import { CheckCircle, FileText, FolderTree, Layers, Package, Share2, Store } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useCategories } from '../hooks/useCategories';
import { useProducts } from '../hooks/useProducts';
import { useWorkspace } from '../hooks/useWorkspace';

export function Dashboard() {
  const { products } = useProducts();
  const { categories } = useCategories();
  const { selectedMerchant } = useWorkspace();
  const total = products.length;
  const shared = products.filter((product) => product.scope === 'shared').length;
  const custom = products.filter((product) => product.scope === 'merchant').length;
  const active = products.filter((product) => product.status === 'Active').length;
  const draft = products.filter((product) => product.status === 'Draft').length;
  const variants = products.reduce((sum, product) => sum + product.variantCount, 0);
  const sharedCategories = categories.filter((category) => category.scope === 'shared').length;
  const merchantCategories = categories.filter((category) => category.scope === 'merchant').length;

  const stats = [
    { label: 'Visible Products', value: total, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Visible Categories', value: categories.length, icon: FolderTree, color: 'text-indigo-700', bg: 'bg-indigo-50' },
    { label: 'Shared Categories', value: sharedCategories, icon: Share2, color: 'text-cyan-700', bg: 'bg-cyan-50' },
    { label: 'Merchant Categories', value: merchantCategories, icon: Store, color: 'text-purple-700', bg: 'bg-purple-50' },
    { label: 'Shared Products', value: shared, icon: Share2, color: 'text-cyan-700', bg: 'bg-cyan-50' },
    { label: 'Merchant Custom', value: custom, icon: Store, color: 'text-purple-700', bg: 'bg-purple-50' },
    { label: 'Active Products', value: active, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Draft Products', value: draft, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Total Variants', value: variants, icon: Layers, color: 'text-slate-600', bg: 'bg-slate-50' },
  ];

  return <div><h1 className="mb-2 text-2xl font-semibold text-gray-900">Dashboard</h1><p className="mb-6 text-sm text-gray-500">Showing products and categories visible for {selectedMerchant?.name ?? 'the selected merchant'}.</p><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{stats.map((stat) => { const Icon = stat.icon; return <Card key={stat.label} className="p-6"><div className="flex items-center gap-4"><div className={`rounded-lg p-3 ${stat.bg}`}><Icon className={`h-6 w-6 ${stat.color}`} /></div><div><p className="text-sm font-medium text-gray-500">{stat.label}</p><p className="text-2xl font-semibold text-gray-900">{stat.value}</p></div></div></Card>; })}</div><section className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200"><h2 className="text-base font-semibold text-gray-900">Products by Category</h2><div className="mt-4 space-y-3">{categories.map((category) => { const count = products.filter((product) => product.categoryId === category.id).length; return <div key={category.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm ring-1 ring-gray-200"><span className="font-medium text-gray-800">{category.name}</span><span className="text-gray-600">{count} products</span></div>; })}</div></section></div>;
}
