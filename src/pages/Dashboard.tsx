import { Package, CheckCircle, FileText, Layers, Share2, Store } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useProducts } from '../hooks/useProducts';
import { useWorkspace } from '../hooks/useWorkspace';

export function Dashboard() {
  const { products } = useProducts();
  const { selectedMerchant } = useWorkspace();

  const total = products.length;
  const shared = products.filter((p) => p.scope === 'shared').length;
  const custom = products.filter((p) => p.scope === 'merchant').length;
  const active = products.filter((p) => p.status === 'Active').length;
  const draft = products.filter((p) => p.status === 'Draft').length;
  const variants = products.reduce((sum, p) => sum + p.variants.length, 0);

  const stats = [
    { label: 'Visible Products', value: total, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Shared Products', value: shared, icon: Share2, color: 'text-cyan-700', bg: 'bg-cyan-50' },
    { label: 'Merchant Custom', value: custom, icon: Store, color: 'text-purple-700', bg: 'bg-purple-50' },
    { label: 'Active Products', value: active, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Draft Products', value: draft, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Total Variants', value: variants, icon: Layers, color: 'text-slate-600', bg: 'bg-slate-50' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Dashboard</h1>
      <p className="mb-6 text-sm text-gray-500">Showing products visible for {selectedMerchant?.name ?? 'the selected merchant'}.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.bg}`}><Icon className={`h-6 w-6 ${stat.color}`} /></div>
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
