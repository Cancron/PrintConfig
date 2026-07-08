import { Link, useLocation } from 'react-router-dom';
import { Images, LayoutDashboard, Package, Settings, Menu, X, Store, FolderTree, LayoutTemplate } from 'lucide-react';
import { useState } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/categories', label: 'Categories', icon: FolderTree },
  { path: '/products', label: 'Products', icon: Package },
  { path: '/image-library', label: 'Image Library', icon: Images },
  { path: '/layouts/categories', label: 'Layout Categories', icon: LayoutTemplate },
  { path: '/layouts/collages', label: 'Collages', icon: LayoutTemplate },
  { path: '/layouts/templates', label: 'Layout Templates', icon: LayoutTemplate },
  { path: '/merchant-settings', label: 'Merchant Settings', icon: Store },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { merchants, selectedMerchantId, setSelectedMerchantId } = useWorkspace();

  return (
    <div className="flex h-screen bg-gray-50">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:transform-none ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-slate-800" />
            <span className="text-lg font-semibold text-slate-900">PrintConfig</span>
          </Link>
          <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-4 border-b border-gray-200">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Merchant Site</label>
          <select
            value={selectedMerchantId}
            onChange={(event) => setSelectedMerchantId(event.target.value)}
            className="block w-full rounded-md border-0 py-2 px-3 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-slate-600"
          >
            {merchants.map((merchant) => (
              <option key={merchant._id} value={merchant._id}>{merchant.name}</option>
            ))}
          </select>
        </div>

        <nav className="px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.path === '/' ? location.pathname === item.path : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active ? 'bg-slate-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
          <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={() => setMobileOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Admin</span>
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-700">A</div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

