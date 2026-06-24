import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { CreateProduct } from './pages/CreateProduct';
import { ProductDetail } from './pages/ProductDetail';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/new" element={<CreateProduct />} />
          <Route path="/products/:id" element={<ProductDetail />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
