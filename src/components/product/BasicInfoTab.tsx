import { useState } from 'react';
import { Save } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import type { Product, ProductType, ProductStatus } from '../../types';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

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

export function BasicInfoTab({ product, onSave }: Props) {
  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);
  const [productType, setProductType] = useState<ProductType>(product.productType);
  const [description, setDescription] = useState(product.description);
  const [status, setStatus] = useState<ProductStatus>(product.status);
  const [basePrice, setBasePrice] = useState(String(product.basePrice));
  const [thumbnailUrl, setThumbnailUrl] = useState(product.thumbnailUrl);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      ...product,
      name: name.trim(),
      slug: slug.trim(),
      productType,
      description: description.trim(),
      status,
      basePrice: Number(basePrice),
      thumbnailUrl: thumbnailUrl.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6 pb-6">
      <Input
        label="Product Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Canvas Print"
      />

      <Input
        label="Slug"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="e.g. canvas-print"
      />

      <Select
        label="Product Type"
        value={productType}
        onChange={(e) => setProductType(e.target.value as ProductType)}
        options={productTypeOptions}
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
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
        >
          <Save className="h-4 w-4" />
          Save Changes
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 font-medium">Saved!</span>
        )}
      </div>
    </form>
  );
}
