import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ProductCategories } from './pages/ProductCategories';
import { CategoryDetail } from './pages/CategoryDetail';
import { Products } from './pages/Products';
import { CreateProduct } from './pages/CreateProduct';
import { ProductDetail } from './pages/ProductDetail';
import { MerchantSettings } from './pages/MerchantSettings';
import { ImageLibrary } from './pages/ImageLibrary';
import { LayoutCategories, LayoutCategoryDetail } from './pages/LayoutCategories';
import { LayoutTemplates, LayoutTemplateEditor } from './pages/LayoutTemplates';
import { Collages, CollageEditor } from './pages/Collages';
import { OrderDetailPage, Orders } from './pages/Orders';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { WorkspaceProvider } from './hooks/useWorkspace';
import { AuthProvider, useAuth } from './hooks/useAuth';

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    const intendedPath = `${location.pathname}${location.search}${location.hash}`;
    const authPath = location.pathname === '/signin' || location.pathname === '/signup';
    return (
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="*" element={<Navigate to="/signin" state={{ from: authPath ? '/' : intendedPath }} replace />} />
      </Routes>
    );
  }

  return (
    <WorkspaceProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/categories" element={<ProductCategories />} />
          <Route path="/categories/:id" element={<CategoryDetail />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/new" element={<CreateProduct />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/merchant-settings" element={<MerchantSettings />} />
          <Route path="/image-library" element={<ImageLibrary />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/layouts/categories" element={<LayoutCategories />} />
          <Route path="/layouts/categories/:id" element={<LayoutCategoryDetail />} />
          <Route path="/layouts/templates" element={<LayoutTemplates />} />
          <Route path="/layouts/collages" element={<Collages />} />
          <Route path="/layouts/collages/:id" element={<CollageEditor />} />
          <Route path="/layouts/templates/:id" element={<LayoutTemplateEditor />} />
          <Route path="/signin" element={<Navigate to="/" replace />} />
          <Route path="/signup" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </WorkspaceProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
