import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { useProducts } from '../hooks/useProducts';
import { createDefaultEditorRules } from '../lib/storage';
import { validateProductBasicInfo } from '../lib/validation';
import type { Product, ProductType, ProductStatus } from '../types';

const productTypeOptions: { value: ProductType; label: ProductType }[] = [
  { value: 'Canvas Print', label: 'Canvas Print' },
  { value: 'Poster Print', label: 'Poster Print' },
  { value: 'Framed Poster', label: 'Framed Poster' },
  { value: 'T-Shirt', label: 'T-Shirt' },
  { value: 'Mug', label: 'Mug' },
  { value: 'Business Card', label: 'Business Card' },
  { value: 'Sticker', label: 'Sticker' },
];

const statusOptions = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Active', label: 'Active' },
];

export function CreateProduct() {
  const navigate = useNavigate();
  const { addProduct } = useProducts();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [productType, setProductType] = useState<ProductType>('Canvas Print');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProductStatus>('Draft');
  const [basePrice, setBasePrice] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');

  const errors = useMemo(
    () => validateProductBasicInfo({ name, slug, productType, basePrice }),
    [basePrice, name, productType, slug]
  );
  const isValid = Object.keys(errors).length === 0;

  function handleNameChange(value: string) {
    setName(value);
    setSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    const product: Product = {
      id: `p-${Date.now()}`,
      merchantId: 'm1',
      name: name.trim(),
      slug: slug.trim(),
      productType,
      description: description.trim(),
      status,
      basePrice: Number(basePrice),
      thumbnailUrl: thumbnailUrl.trim(),
      editorRules: createDefaultEditorRules(),
      variants: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addProduct(product);
    navigate('/products');
  }

  return (
    <div>
      <button
        onClick={() => navigate('/products')}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Products
      </button>

      <PageHeader title="Create Product" description="Add a new print product to your catalog." />

      <form onSubmit={handleSubmit} className="max-w-2xl bg-white rounded-lg shadow-sm ring-1 ring-gray-200 p-6 space-y-6">
        <Input
          label="Product Name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          error={errors.name}
          placeholder="e.g. Canvas Print"
        />

        <Input
          label="Slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          error={errors.slug}
          placeholder="e.g. canvas-print"
        />

        <Select
          label="Product Type"
          value={productType}
          onChange={(e) => setProductType(e.target.value as ProductType)}
          options={productTypeOptions}
          error={errors.productType}
        />

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe the product..."
        />

        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ProductStatus)}
          options={statusOptions}
        />

        <Input
          label="Base Price"
          type="number"
          step="0.01"
          min="0"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
          error={errors.basePrice}
          placeholder="0.00"
        />

        <Input
          label="Thumbnail Image URL"
          type="url"
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
          placeholder="https://..."
        />

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={!isValid}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Create Product
          </button>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}



