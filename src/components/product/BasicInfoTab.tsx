import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
// import { ThumbnailUpload } from './ThumbnailUpload';
import { ImageField } from '../gallery/ImageField';
import { EditorProductSelection } from './EditorProductSelection';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useCategories } from '../../hooks/useCategories';
import { validateProductBasicInfo } from '../../lib/validation';
import { createDefaultMugProductConfig, createDefaultPhotoBookConfig, createDefaultPillowProductConfig } from '../../lib/storage';
import type { EditorProductSelectionMode, MugProductConfig, PhotoBookConfig, PillowProductConfig, Product, ProductScope, ProductSummary, ProductType, ProductStatus } from '../../types';
import { ensureTShirtVariantOptionDefinitions } from '../../lib/variantOptions';

interface Props {
  product: Product;
  products: ProductSummary[];
  onSave: (product: Product) => void;
}

const productTypeOptions: { value: ProductType; label: ProductType }[] = [
  { value: 'Canvas Print', label: 'Canvas Print' },
  { value: 'Metal Print', label: 'Metal Print' },
  { value: 'Framed Print', label: 'Framed Print' },
  { value: 'Photo Print', label: 'Photo Print' },
  { value: 'Photo Collage Print', label: 'Photo Collage Print' },
  { value: 'Photo Book Print', label: 'Photo Book Print' },
  { value: 'Pillow Print', label: 'Pillow Print' },
  { value: 'Mug Print', label: 'Mug Print' },
  { value: 'AI Art Generation', label: 'AI Art Generation' },
  { value: 'Art Print', label: 'Art Print' },
  { value: 'T-Shirt Print', label: 'T-Shirt Print' },
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

const yesNoOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const coverTypeOptions = [
  { value: 'softcover', label: 'Softcover' },
  { value: 'hardcover', label: 'Hardcover' },
  { value: 'layflat', label: 'Layflat' },
  { value: 'custom', label: 'Custom' },
];

const bindingTypeOptions = [
  { value: 'perfect', label: 'Perfect bound' },
  { value: 'saddle_stitch', label: 'Saddle stitch' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'layflat', label: 'Layflat' },
];

export function BasicInfoTab({ product, products, onSave }: Props) {
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
  const [selectionMode, setSelectionMode] = useState<EditorProductSelectionMode>(product.editorProductSelection.mode);
  const [specificProductIds, setSpecificProductIds] = useState([...product.editorProductSelection.specificProductIds]);
  const [photoBook, setPhotoBook] = useState<PhotoBookConfig>(product.photoBook ?? createDefaultPhotoBookConfig(product.productType === 'Photo Book Print'));
  const [pillow, setPillow] = useState<PillowProductConfig>(product.pillow ?? createDefaultPillowProductConfig(product.productType === 'Pillow Print'));
  const [mug, setMug] = useState<MugProductConfig>(product.mug ?? createDefaultMugProductConfig(product.productType === 'Mug Print'));

  const errors = useMemo(
    () => validateProductBasicInfo({ name, slug, productType, basePrice, categoryId }),
    [basePrice, categoryId, name, productType, slug]
  );
  const isValid = Object.keys(errors).length === 0;

  function updatePhotoBook<K extends keyof PhotoBookConfig>(key: K, value: PhotoBookConfig[K]) {
    setPhotoBook((current) => ({ ...current, [key]: value }));
  }

  function updatePillow<K extends keyof PillowProductConfig>(key: K, value: PillowProductConfig[K]) {
    setPillow((current) => ({ ...current, [key]: value }));
  }

  function updateMug<K extends keyof MugProductConfig>(key: K, value: MugProductConfig[K]) {
    setMug((current) => ({ ...current, [key]: value }));
  }

  function handleProductTypeChange(nextType: ProductType) {
    setProductType(nextType);
    if (nextType === 'Pillow Print' && product.productType !== 'Pillow Print') {
      setPillow((current) => ({ ...current, enabled: true }));
    }
    if (nextType === 'Mug Print' && product.productType !== 'Mug Print') {
      setMug((current) => ({ ...current, enabled: true }));
    }
  }

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
      editorProductSelection: {
        mode: selectionMode,
        specificProductIds: specificProductIds.filter((id) => id !== product._id),
      },
      photoBook: {
        ...photoBook,
        enabled: productType === 'Photo Book Print',
      },
      variantOptionDefinitions: productType === 'T-Shirt Print'
        ? ensureTShirtVariantOptionDefinitions(product.variantOptionDefinitions, product.tshirt.colorOptionKey, product.tshirt.sizeOptionKey)
        : product.variantOptionDefinitions,
      pillow: {
        ...pillow,
        enabled: productType === 'Pillow Print' && pillow.enabled,
        sides: ['front', 'back'],
        defaultLayout: 'full-bleed',
      },
      mug: {
        ...mug,
        enabled: productType === 'Mug Print' && mug.enabled,
        defaultLayout: 'blank',
      },
      tshirt: {
        ...product.tshirt,
        enabled: productType === 'T-Shirt Print',
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-6 pb-6">
      <Input label="Product Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="e.g. Canvas Print" />
      <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} error={errors.slug} placeholder="e.g. canvas-print" />
      <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={categories.map((category) => ({ value: category._id, label: category.name }))} error={errors.categoryId} />
      <Select label="Product Type" value={productType} onChange={(e) => handleProductTypeChange(e.target.value as ProductType)} options={productTypeOptions} error={errors.productType} />
      {productType === 'Photo Book Print' && (
        <section className="rounded-lg bg-white p-5 ring-1 ring-gray-200">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Photo Book Settings</h3>
            <p className="mt-1 text-sm text-gray-500">Controls page limits, photo limits, and extra-page pricing for the customer editor.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Default Pages" type="number" min="1" value={photoBook.defaultPages} onChange={(e) => updatePhotoBook('defaultPages', Number(e.target.value))} />
            <Input label="Maximum Pages" type="number" min="1" value={photoBook.maxPages} onChange={(e) => updatePhotoBook('maxPages', Number(e.target.value))} />
            <Input label="Maximum Photo Count" type="number" min="0" value={photoBook.maxPhotoCount} onChange={(e) => updatePhotoBook('maxPhotoCount', Number(e.target.value))} />
            <Input label="Pages Per Spread" type="number" min="1" value={photoBook.pagesPerSpread} onChange={(e) => updatePhotoBook('pagesPerSpread', Number(e.target.value))} />
            <Input label="Price Per Extra Page" type="number" step="0.01" min="0" value={photoBook.pricePerExtraPage} onChange={(e) => updatePhotoBook('pricePerExtraPage', Number(e.target.value))} />
            <Input label="Paper Type" value={photoBook.paperType} onChange={(e) => updatePhotoBook('paperType', e.target.value)} placeholder="e.g. lustre, matte" />
            <Select label="Cover Type" value={photoBook.coverType} onChange={(e) => updatePhotoBook('coverType', e.target.value as PhotoBookConfig['coverType'])} options={coverTypeOptions} />
            <Select label="Binding Type" value={photoBook.bindingType} onChange={(e) => updatePhotoBook('bindingType', e.target.value as PhotoBookConfig['bindingType'])} options={bindingTypeOptions} />
            <Select label="Allow Page Reorder" value={photoBook.allowPageReorder ? 'yes' : 'no'} onChange={(e) => updatePhotoBook('allowPageReorder', e.target.value === 'yes')} options={yesNoOptions} />
            <Select label="Allow Blank Pages" value={photoBook.allowBlankPages ? 'yes' : 'no'} onChange={(e) => updatePhotoBook('allowBlankPages', e.target.value === 'yes')} options={yesNoOptions} />
            <Select label="Starts With Cover" value={photoBook.startsWithCover ? 'yes' : 'no'} onChange={(e) => updatePhotoBook('startsWithCover', e.target.value === 'yes')} options={yesNoOptions} />
            <Select label="Has Back Cover" value={photoBook.hasBackCover ? 'yes' : 'no'} onChange={(e) => updatePhotoBook('hasBackCover', e.target.value === 'yes')} options={yesNoOptions} />
          </div>
        </section>
      )}
      {productType === 'Pillow Print' && (
        <section className="rounded-lg bg-white p-5 ring-1 ring-gray-200">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Pillow Settings</h3>
            <p className="mt-1 text-sm text-gray-500">Controls which sides customers must design. Pillow print areas and mockups are configured on each variant.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select label="Enable Pillow Editor" value={pillow.enabled ? 'yes' : 'no'} onChange={(e) => updatePillow('enabled', e.target.value === 'yes')} options={yesNoOptions} />
            <Select label="Minimum Designed Sides" value={String(pillow.minimumDesignedSides)} onChange={(e) => updatePillow('minimumDesignedSides', Number(e.target.value) === 2 ? 2 : 1)} options={[{ value: '1', label: 'Either side (1)' }, { value: '2', label: 'Both sides (2)' }]} />
            <Select label="Default Layout" value="full-bleed" onChange={() => undefined} options={[{ value: 'full-bleed', label: 'Full Bleed' }]} disabled />
          </div>
          <p className="mt-3 text-sm text-gray-500">Available sides are fixed to Front and Back for the current pillow editor.</p>
        </section>
      )}
      {productType === 'Mug Print' && (
        <section className="rounded-lg bg-white p-5 ring-1 ring-gray-200">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Mug Settings</h3>
            <p className="mt-1 text-sm text-gray-500">Mug print areas and 3D model material targets are configured on each variant.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Enable Mug Editor" value={mug.enabled ? 'yes' : 'no'} onChange={(e) => updateMug('enabled', e.target.value === 'yes')} options={yesNoOptions} />
            <Select label="Default Layout" value="blank" onChange={() => undefined} options={[{ value: 'blank', label: 'Blank' }]} disabled />
          </div>
        </section>
      )}
      <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe the product..." />
      <Select label="Product Scope" value={scope} onChange={(e) => setScope(e.target.value as ProductScope)} options={scopeOptions} />
      {scope === 'merchant' && selectedMerchant && <p className="rounded-md bg-purple-50 p-3 text-sm text-purple-700 ring-1 ring-inset ring-purple-200">This product will belong to {selectedMerchant.name}.</p>}
      <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)} options={statusOptions} />
      <Input label="Base Price" type="number" step="0.01" min="0" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} error={errors.basePrice} placeholder="0.00" />
      {/* <ThumbnailUpload value={thumbnailUrl} onChange={(url) => { setThumbnailUrl(url); setThumbnailAssetId(undefined); }} productId={product._id} /> */}
      <ImageField label="Thumbnail Image URL" url={thumbnailUrl} assetId={thumbnailAssetId} onChange={(url, assetId) => { setThumbnailUrl(url); setThumbnailAssetId(assetId); }} />

      <EditorProductSelection
        currentProductId={product._id}
        categoryId={categoryId}
        products={products}
        mode={selectionMode}
        specificProductIds={specificProductIds}
        onModeChange={setSelectionMode}
        onSpecificProductIdsChange={setSpecificProductIds}
      />
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={!isValid} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors disabled:cursor-not-allowed disabled:bg-slate-300">
          <Save className="h-4 w-4" /> Save Changes
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
      </div>
    </form>
  );
}
