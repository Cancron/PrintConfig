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

function App() {
  return (
    <BrowserRouter>
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
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
