import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Copy, Download, Upload, X, XCircle } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import type { Product, ProductScope } from '../types';
import { Tabs } from '../components/ui/Tabs';
import { Badge } from '../components/ui/Badge';
import { useProducts } from '../hooks/useProducts';
import { useWorkspace } from '../hooks/useWorkspace';
import { parseImportedProduct } from '../lib/productConfig';
import { getProductReadiness } from '../lib/validation';
import { BasicInfoTab } from '../components/product/BasicInfoTab';
import { OptionsTab } from '../components/product/OptionsTab';
import { VariantsTab } from '../components/product/VariantsTab';
import { SurfacesTab } from '../components/product/SurfacesTab';
import { EditorRulesTab } from '../components/product/EditorRulesTab';
import { ExportRulesTab } from '../components/product/ExportRulesTab';
import { PreviewTab } from '../components/product/PreviewTab';
import { TemplatesTab } from '../components/product/TemplatesTab';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { products, addProduct, updateProduct, duplicateProduct, account, selectedMerchantId } = useProducts();
  const { merchants, selectedMerchant } = useWorkspace();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState('');
  const [importScope, setImportScope] = useState<ProductScope>('shared');

  const product = products.find((p) => p._id === id);

  if (!product) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold text-gray-900">Product not found</h2>
        <button onClick={() => navigate('/products')} className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Back to Products</button>
      </div>
    );
  }

  const currentProduct = product;
  const defaultTab = searchParams.get('tab') ?? 'basic';
  const merchantName = merchants.find((merchant) => merchant._id === currentProduct.merchantId)?.name ?? selectedMerchant?.name ?? 'selected merchant';

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3000);
  }

  function handleExportJson() {
    const blob = new Blob([JSON.stringify(currentProduct, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentProduct.slug || currentProduct._id}-configuration.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showMessage('success', 'Product configuration exported.');
  }

  async function handleDuplicateProduct() {
    const targetScope: ProductScope = currentProduct.scope === 'shared' && !confirm('Duplicate as shared product? Choose Cancel to duplicate as merchant custom for the selected merchant.') ? 'merchant' : currentProduct.scope;
    const newId = await duplicateProduct(currentProduct._id, targetScope);
    if (!newId) {
      showMessage('error', 'Could not duplicate product.');
      return;
    }
    showMessage('success', 'Product duplicated as draft.');
    navigate(`/products/${newId}`);
  }

  async function handleImportJson() {
    const result = parseImportedProduct(importJson, {
      accountId: account._id,
      scope: importScope,
      merchantId: importScope === 'merchant' ? selectedMerchantId : null,
    });
    if (result.error || !result.product) {
      setImportError(result.error ?? 'Import failed.');
      return;
    }
    const saved = await addProduct(result.product);
    setImportOpen(false);
    setImportJson('');
    setImportError('');
    showMessage('success', 'Product configuration imported as a new draft product.');
    navigate(`/products/${saved._id}`);
  }

  const tabs = [
    { _id: 'basic', label: 'Basic Info', content: <BasicInfoTab product={product} onSave={updateProduct} /> },
    { _id: 'options', label: 'Options', content: <OptionsTab product={product} onSave={updateProduct} /> },
    { _id: 'variants', label: 'Variants', content: <VariantsTab product={product} onSave={updateProduct} /> },
    { _id: 'surfaces', label: 'Surfaces', content: <SurfacesTab product={product} onSave={updateProduct} /> },
    { _id: 'editor-rules', label: 'Editor Rules', content: <EditorRulesTab product={product} onSave={updateProduct} /> },
    { _id: 'export-rules', label: 'Export Rules', content: <ExportRulesTab product={product} onSave={updateProduct} /> },
    { _id: 'templates', label: 'Templates', content: <TemplatesTab product={product} onSave={updateProduct} /> },
    { _id: 'preview', label: 'Preview', content: <PreviewTab product={product} onSave={updateProduct} /> },
    { _id: 'json', label: 'JSON', content: <JsonPreviewTab product={product} /> },
  ];

  return (
    <div>
      <button onClick={() => navigate('/products')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" />Back to Products</button>

      <PageHeader
        title={product.name}
        description={product.productType}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={product.status} />
            <button type="button" onClick={handleExportJson} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 transition-colors"><Download className="h-4 w-4" />Export JSON</button>
            <button type="button" onClick={() => setImportOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 transition-colors"><Upload className="h-4 w-4" />Import JSON</button>
            <button type="button" onClick={handleDuplicateProduct} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"><Copy className="h-4 w-4" />Duplicate Product</button>
          </div>
        }
      />

      {message && <div className={`mb-4 rounded-md p-3 text-sm ring-1 ring-inset ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-700 ring-red-200'}`}>{message.text}</div>}

      <div className="flex flex-wrap items-center gap-4 mb-6">
        {product.thumbnailUrl ? <img src={product.thumbnailUrl} alt={product.name} className="h-16 w-16 rounded-lg object-cover ring-1 ring-gray-200" /> : <div className="h-16 w-16 rounded-lg bg-gray-100 flex items-center justify-center ring-1 ring-gray-200"><span className="text-xs text-gray-400">IMG</span></div>}
        <div><p className="text-sm text-gray-500">Base Price</p><p className="text-lg font-semibold text-gray-900">${product.basePrice.toFixed(2)}</p></div>
        <div><p className="text-sm text-gray-500">Variants</p><p className="text-lg font-semibold text-gray-900">{product.variants.length}</p></div>
        <div><p className="text-sm text-gray-500">Ownership</p><ScopeBadge scope={product.scope} /></div>
      </div>

      <div className="mb-6 rounded-lg bg-white p-4 text-sm text-gray-700 shadow-sm ring-1 ring-gray-200">
        {currentProduct.scope === 'shared' ? 'Available across all merchant sites.' : `Merchant custom product for ${merchantName}.`}
      </div>

      <ProductReadinessPanel product={product} />
      <div className="bg-white rounded-lg shadow-sm ring-1 ring-gray-200 px-6"><Tabs tabs={tabs} defaultTab={defaultTab} /></div>

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl ring-1 ring-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div><h2 className="text-lg font-semibold text-gray-900">Import Product JSON</h2><p className="mt-1 text-sm text-gray-500">Paste a product configuration. It will import as a new draft product.</p></div>
              <button type="button" onClick={() => setImportOpen(false)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-md bg-gray-50 p-3 ring-1 ring-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-1">Import As</label>
                <select value={importScope} onChange={(event) => setImportScope(event.target.value as ProductScope)} className="rounded-md border-0 py-2 px-3 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-slate-600">
                  <option value="shared">Shared product</option>
                  <option value="merchant">Merchant custom product for {selectedMerchant?.name}</option>
                </select>
              </div>
              <textarea value={importJson} onChange={(event) => { setImportJson(event.target.value); setImportError(''); }} className="min-h-72 w-full rounded-md border-0 p-3 font-mono text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-slate-600" placeholder="Paste product JSON here..." />
              {importError && <p className="text-sm text-red-600">{importError}</p>}
              <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={() => setImportOpen(false)} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">Cancel</button>
                <button type="button" onClick={handleImportJson} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Import JSON</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScopeBadge({ scope }: { scope: ProductScope }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${scope === 'shared' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' : 'bg-purple-50 text-purple-700 ring-purple-600/20'}`}>{scope === 'shared' ? 'Shared' : 'Merchant Custom'}</span>;
}

function ProductReadinessPanel({ product }: { product: Product }) {
  const readiness = getProductReadiness(product);
  const checks = [
    { label: 'Has basic info', value: readiness.hasBasicInfo },
    { label: 'Has at least one active variant', value: readiness.hasActiveVariant },
    { label: 'Active variants have width, height, unit, and DPI', value: readiness.activeVariantsHaveDimensions },
    { label: 'Product surface exists', value: readiness.hasSurface },
    { label: 'Surface settings are valid', value: readiness.surfaceValid },
    { label: 'Export rules exist', value: readiness.hasExportRules },
    { label: 'Editor rules exist', value: readiness.hasEditorRules },
    { label: 'Active variants have compatible shared rooms', value: readiness.activeVariantsHaveRoomPreviews },
    { label: 'Active variant orientations have defaults', value: readiness.activeVariantsHaveDefaultRoomPreview },
  ];

  return (
    <section className="mb-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="text-base font-semibold text-gray-900">Product Readiness</h2><p className="mt-1 text-sm text-gray-500">Ready to publish: {readiness.ready ? 'yes' : 'no'}</p></div>
        <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${readiness.ready ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'}`}>{readiness.ready ? 'Ready' : 'Not ready'}</span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {checks.map((check) => { const Icon = check.value ? CheckCircle : XCircle; return <div key={check.label} className="flex items-center gap-2 text-sm text-gray-700"><Icon className={`h-4 w-4 ${check.value ? 'text-emerald-600' : 'text-amber-600'}`} /><span>{check.label}</span></div>; })}
      </div>
      <div className="mt-5 border-t border-gray-200 pt-4">
        <p className="text-sm font-medium text-gray-900">Optional room preview enhancements</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[{ label: 'At least one variant has room preview images', value: readiness.hasAnyRoomPreviews }, { label: 'Each active variant has at least one room preview', value: readiness.activeVariantsHaveRoomPreviews }, { label: 'Each active variant has a default room preview', value: readiness.activeVariantsHaveDefaultRoomPreview }].map((check) => { const Icon = check.value ? CheckCircle : XCircle; return <div key={check.label} className="flex items-center gap-2 text-sm text-gray-700"><Icon className={`h-4 w-4 ${check.value ? 'text-emerald-600' : 'text-gray-400'}`} /><span>{check.label}</span></div>; })}
        </div>
      </div>
      {!readiness.ready && <div className="mt-4 rounded-md bg-amber-50 p-3 ring-1 ring-inset ring-amber-200"><p className="text-sm font-medium text-amber-900">Missing</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">{readiness.missing.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    </section>
  );
}

function JsonPreviewTab({ product }: { product: Product }) {
  const json = JSON.stringify(product, null, 2);
  return <div className="relative"><pre className="bg-slate-900 text-slate-50 rounded-lg p-4 overflow-x-auto text-sm font-mono leading-relaxed"><code>{json}</code></pre></div>;
}





