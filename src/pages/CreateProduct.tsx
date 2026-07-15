import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { ImageField } from '../components/gallery/ImageField';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { useWorkspace } from '../hooks/useWorkspace';
import { createDefaultAiArtConfig, createDefaultEditorRules, createDefaultExportRules, createDefaultPhotoBookConfig } from '../lib/storage';
import { validateProductBasicInfo } from '../lib/validation';
import { createDefaultVariantOptionDefinitions } from '../lib/variantOptions';
import { createDefaultFrontendContent } from '../lib/frontendContent';
import { createDefaultEditorProductSelection } from '../lib/productSelection';
import type { Product, ProductScope, ProductType, ProductStatus } from '../types';

const productTypeOptions: { value: ProductType; label: ProductType }[] = [
  { value: 'Canvas Print', label: 'Canvas Print' },
  { value: 'Metal Print', label: 'Metal Print' },
  { value: 'Framed Print', label: 'Framed Print' },
  { value: 'Photo Print', label: 'Photo Print' },
  { value: 'Photo Book Print', label: 'Photo Book Print' },
  { value: 'AI Art Generation', label: 'AI Art Generation' },
  { value: 'Art Print', label: 'Art Print' },
  { value: 'T-Shirt', label: 'T-Shirt' },
  { value: 'Mug', label: 'Mug' },
  { value: 'Business Card', label: 'Business Card' },
  { value: 'Sticker', label: 'Sticker' },
];

const statusOptions = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Active', label: 'Active' },
];

const scopeOptions = [
  { value: 'shared', label: 'Shared across all my merchant sites' },
  { value: 'merchant', label: 'Only for selected merchant' },
];

export function CreateProduct() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addProduct, account } = useProducts();
  const { categories } = useCategories();
  const { selectedMerchant } = useWorkspace();

  const initialCategoryId = searchParams.get('categoryId') ?? categories[0]?._id ?? '';
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [productType, setProductType] = useState<ProductType>('Canvas Print');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProductStatus>('Draft');
  const [scope, setScope] = useState<ProductScope>('shared');
  const [basePrice, setBasePrice] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailAssetId, setThumbnailAssetId] = useState<string>();
  const [categoryId, setCategoryId] = useState(initialCategoryId);

  const errors = useMemo(
    () => validateProductBasicInfo({ name, slug, productType, basePrice, categoryId }),
    [basePrice, categoryId, name, productType, slug]
  );
  const isValid = Object.keys(errors).length === 0;

  function handleNameChange(value: string) {
    setName(value);
    setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    const now = new Date().toISOString();
    const product: Product = {
      _id: '',
      accountId: account._id,
      scope,
      merchantId: scope === 'merchant' ? selectedMerchant?._id ?? null : null,
      name: name.trim(),
      slug: slug.trim(),
      productType,
      description: description.trim(),
      status,
      basePrice: Number(basePrice),
      thumbnailUrl: thumbnailUrl.trim(),
      thumbnailAssetId,
      categoryId,
      categorySnapshot: categories.find((category) => category._id === categoryId),
      editorRules: createDefaultEditorRules(),
      exportRules: createDefaultExportRules(),
      surface: null,
      optionGroups: [],
      variantOptionDefinitions: createDefaultVariantOptionDefinitions(),
      roomPreviews: [],
      frontendContent: createDefaultFrontendContent(),
      editorProductSelection: createDefaultEditorProductSelection(),
      layoutSettings: { enabled: false, mode: 'none', allowedTemplateIds: [], allowedTemplateTags: [], requireTemplateSelection: false },
      variants: [],
      aiArt: createDefaultAiArtConfig(),
      photoBook: createDefaultPhotoBookConfig(productType === 'Photo Book Print'),
      createdAt: now,
      updatedAt: now,
    };

    const saved = await addProduct(product);
    navigate(`/products/${saved._id}`);
  }

  return (
    <div>
      <button onClick={() => navigate('/products')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Products
      </button>

      <PageHeader title="Create Product" description="Add a new print product to your catalog." />

      <form onSubmit={handleSubmit} className="max-w-2xl bg-white rounded-lg shadow-sm ring-1 ring-gray-200 p-6 space-y-6">
        <Input label="Product Name" value={name} onChange={(e) => handleNameChange(e.target.value)} error={errors.name} placeholder="e.g. Canvas Print" />
        <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} error={errors.slug} placeholder="e.g. canvas-print" />
        <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={categories.map((category) => ({ value: category._id, label: category.name }))} error={errors.categoryId} />
        <Select label="Product Type" value={productType} onChange={(e) => setProductType(e.target.value as ProductType)} options={productTypeOptions} error={errors.productType} />
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe the product..." />
        <Select label="Product Scope" value={scope} onChange={(e) => setScope(e.target.value as ProductScope)} options={scopeOptions} />
        {scope === 'merchant' && selectedMerchant && <p className="rounded-md bg-purple-50 p-3 text-sm text-purple-700 ring-1 ring-inset ring-purple-200">This product will belong only to {selectedMerchant.name}.</p>}
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)} options={statusOptions} />
        <Input label="Base Price" type="number" step="0.01" min="0" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} error={errors.basePrice} placeholder="0.00" />
        <ImageField label="Thumbnail Image URL" url={thumbnailUrl} assetId={thumbnailAssetId} onChange={(url, assetId) => { setThumbnailUrl(url); setThumbnailAssetId(assetId); }} />

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={!isValid} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors disabled:cursor-not-allowed disabled:bg-slate-300">Create Product</button>
          <button type="button" onClick={() => navigate('/products')} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  );
}


