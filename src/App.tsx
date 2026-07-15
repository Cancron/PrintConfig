import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import { Orders } from './pages/Orders';
import { WorkspaceProvider } from './hooks/useWorkspace';

function App() {
  return (
    <BrowserRouter>
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
            <Route path="/layouts/categories" element={<LayoutCategories />} />
            <Route path="/layouts/categories/:id" element={<LayoutCategoryDetail />} />
            <Route path="/layouts/templates" element={<LayoutTemplates />} />
            <Route path="/layouts/collages" element={<Collages />} />
            <Route path="/layouts/collages/:id" element={<CollageEditor />} />
            <Route path="/layouts/templates/:id" element={<LayoutTemplateEditor />} />
          </Routes>
        </Layout>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}

export default App;
