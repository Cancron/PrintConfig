import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
// import { ThumbnailUpload } from './ThumbnailUpload';
import { ImageField } from '../gallery/ImageField';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useCategories } from '../../hooks/useCategories';
import { validateProductBasicInfo } from '../../lib/validation';
import type { Product, ProductScope, ProductType, ProductStatus } from '../../types';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

const productTypeOptions: { value: ProductType; label: ProductType }[] = [
  { value: 'Canvas Print', label: 'Canvas Print' },
  { value: 'Metal Print', label: 'Metal Print' },
  // { value: 'Fine Art Paper', label: 'Fine Art Paper' },
  // { value: 'Matte Photo Paper', label: 'Matte Photo Paper' },
  // { value: 'Acrylic Face Mount Prints', label: 'Acrylic Face Mount Prints' },
  // { value: 'Poster Printing and Framing', label: 'Poster Printing and Framing' },
  // { value: 'Luster Photo Paper', label: 'Luster Photo Paper' },
  { value: 'Canvas Print', label: 'Canvas Print' },
  // { value: 'Poster Print', label: 'Poster Print' },
  // { value: 'Framed Poster', label: 'Framed Poster' },
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

export function BasicInfoTab({ product, onSave }: Props) {
  const { selectedMerchant } = useWorkspace();
  const { categories } = useCategories();
  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);
  const [productType, setProductType] = useState<ProductType>(product.productType);
  const [description, setDescription] = useState(product.description);
  const [status, setStatus] = useState<ProductStatus>(product.status);
  const [scope, setScope] = useState<ProductScope>(product.scope);
  const [basePrice, setBasePrice] = useState(String(product.basePrice));
  const [thumbnailUrl, setThumbnailUrl] = useState(product.thumbnailUrl);
  const [thumbnailAssetId, setThumbnailAssetId] = useState(product.thumbnailAssetId);
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [saved, setSaved] = useState(false);

  const errors = useMemo(
    () => validateProductBasicInfo({ name, slug, productType, basePrice, categoryId }),
    [basePrice, categoryId, name, productType, slug]
  );
  const isValid = Object.keys(errors).length === 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSave({
      ...product,
      name: name.trim(),
      slug: slug.trim(),
      productType,
      description: description.trim(),
      status,
      scope,
      merchantId: scope === 'merchant' ? selectedMerchant?._id ?? product.merchantId ?? null : null,
      basePrice: Number(basePrice),
      thumbnailUrl: thumbnailUrl.trim(),
      thumbnailAssetId,
      categoryId,
      categorySnapshot: categories.find((category) => category._id === categoryId),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6 pb-6">
      <Input label="Product Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="e.g. Canvas Print" />
      <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} error={errors.slug} placeholder="e.g. canvas-print" />
      <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={categories.map((category) => ({ value: category._id, label: category.name }))} error={errors.categoryId} />
      <Select label="Product Type" value={productType} onChange={(e) => setProductType(e.target.value as ProductType)} options={productTypeOptions} error={errors.productType} />
      <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe the product..." />
      <Select label="Product Scope" value={scope} onChange={(e) => setScope(e.target.value as ProductScope)} options={scopeOptions} />
      {scope === 'merchant' && selectedMerchant && <p className="rounded-md bg-purple-50 p-3 text-sm text-purple-700 ring-1 ring-inset ring-purple-200">This product will belong to {selectedMerchant.name}.</p>}
      <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)} options={statusOptions} />
      <Input label="Base Price" type="number" step="0.01" min="0" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} error={errors.basePrice} placeholder="0.00" />
      {/* <ThumbnailUpload value={thumbnailUrl} onChange={(url) => { setThumbnailUrl(url); setThumbnailAssetId(undefined); }} productId={product._id} /> */}
      <ImageField label="Thumbnail Image URL" url={thumbnailUrl} assetId={thumbnailAssetId} onChange={(url, assetId) => { setThumbnailUrl(url); setThumbnailAssetId(assetId); }} />

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={!isValid} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors disabled:cursor-not-allowed disabled:bg-slate-300">
          <Save className="h-4 w-4" /> Save Changes
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
      </div>
    </form>
  );
}


