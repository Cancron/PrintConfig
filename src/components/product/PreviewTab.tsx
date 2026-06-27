import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, FileJson } from 'lucide-react';
import { SurfacePreview } from './SurfacePreview';
import { RoomPreviewsPanel } from './RoomPreviewsPanel';
import { Select } from '../ui/Select';
import { toPixels } from '../../lib/validation';
import type { Product, ProductSurface, ProductVariant } from '../../types';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

export function PreviewTab({ product, onSave }: Props) {
  const [searchParams] = useSearchParams();
  const activeVariants = product.variants.filter((variant) => variant.status === 'Active');
  const variantsForSelection = product.variants;
  const requestedVariantId = searchParams.get('variantId');
  const [selectedVariantId, setSelectedVariantId] = useState(requestedVariantId ?? variantsForSelection[0]?._id ?? '');
  const selectedVariant = variantsForSelection.find((variant) => variant._id === selectedVariantId) ?? variantsForSelection[0];
  const [testConfig, setTestConfig] = useState<object | null>(null);
  const dimensions = useMemo(() => (selectedVariant ? calculateDimensions(product.surface, selectedVariant) : null), [product.surface, selectedVariant]);
  const warnings = useMemo(() => getWarnings(product, activeVariants, selectedVariant), [activeVariants, product, selectedVariant]);

  useEffect(() => {
    if (requestedVariantId && product.variants.some((variant) => variant._id === requestedVariantId)) setSelectedVariantId(requestedVariantId);
  }, [product.variants, requestedVariantId]);

  function handleVariantChange(variantId: string) {
    setSelectedVariantId(variantId);
    setTestConfig(null);
  }

  function generateTestConfiguration() {
    setTestConfig({
      note: 'This is a configuration test only. It is not a real print export.',
      product: summarizeProduct(product),
      selectedVariant: selectedVariant ? summarizeVariant(selectedVariant) : null,
      selectedSurface: product.surface ?? null,
      editorRules: product.editorRules ?? null,
      exportRules: product.exportRules ?? null,
      calculatedDimensions: dimensions,
    });
  }

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Configuration Preview</h2>
        <p className="mt-1 text-sm text-gray-500">Test how this product setup will behave before publishing it.</p>
      </div>

      <Select
        label="Variant"
        value={selectedVariant?._id ?? ''}
        onChange={(event) => handleVariantChange(event.target.value)}
        options={variantsForSelection.length > 0 ? variantsForSelection.map((variant) => ({ value: variant._id, label: `${variant.name} (${variant.sku})` })) : [{ value: '', label: 'No variants available' }]}
        disabled={variantsForSelection.length === 0}
      />

      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning) => <div key={warning} className="flex gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 flex-none" /><span>{warning}</span></div>)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-lg bg-gray-50 p-4 ring-1 ring-gray-200 xl:col-span-2">
          <h3 className="text-sm font-semibold text-gray-900">Surface Preview</h3>
          <p className="mt-1 text-sm text-gray-500">Bleed, trim, and safe area use the product surface and selected variant size.</p>
          <div className="mt-6 flex min-h-80 items-center justify-center overflow-auto rounded-lg bg-white p-4 ring-1 ring-gray-200">
            {selectedVariant ? <SurfacePreview surface={product.surface} variant={selectedVariant} size={420} /> : <p className="text-sm text-gray-500">No variant selected.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <SummaryPanel title="Production Dimensions">
            {dimensions ? (
              <dl className="space-y-2 text-sm">
                <SummaryRow label="Trim" value={`${dimensions.trimWidthPx} x ${dimensions.trimHeightPx} px`} />
                <SummaryRow label="With bleed" value={`${dimensions.totalWidthPx} x ${dimensions.totalHeightPx} px`} />
                <SummaryRow label="Safe area" value={`${dimensions.safeWidthPx} x ${dimensions.safeHeightPx} px`} />
                <SummaryRow label="Variant DPI" value={`${selectedVariant?.dpi ?? 0}`} />
              </dl>
            ) : <p className="text-sm text-gray-500">No dimensions available.</p>}
          </SummaryPanel>

          <SummaryPanel title="Export Settings">
            {product.exportRules ? <dl className="space-y-2 text-sm"><SummaryRow label="Format" value={product.exportRules.format} /><SummaryRow label="DPI" value={`${product.exportRules.dpi}`} /><SummaryRow label="Include bleed" value={yesNo(product.exportRules.includeBleed)} /><SummaryRow label="Flatten output" value={yesNo(product.exportRules.flattenOutput)} /><SummaryRow label="Transparent background" value={yesNo(product.exportRules.transparentBackground)} /><SummaryRow label="Background" value={product.exportRules.backgroundColor} /><SummaryRow label="Color mode" value={product.exportRules.colorMode} /></dl> : <p className="text-sm text-gray-500">Export rules are missing.</p>}
          </SummaryPanel>

          <SummaryPanel title="Editor Rules">
            {product.editorRules ? <dl className="space-y-2 text-sm"><SummaryRow label="Image upload" value={yesNo(product.editorRules.allowImageUpload)} /><SummaryRow label="Add text" value={yesNo(product.editorRules.allowAddText)} /><SummaryRow label="Clipart" value={yesNo(product.editorRules.allowClipart)} /><SummaryRow label="Crop" value={yesNo(product.editorRules.allowCrop)} /><SummaryRow label="Rotate" value={yesNo(product.editorRules.allowRotate)} /><SummaryRow label="Max images" value={`${product.editorRules.maxImageCount}`} /><SummaryRow label="Max text" value={`${product.editorRules.maxTextCount}`} /></dl> : <p className="text-sm text-gray-500">Editor rules are missing.</p>}
          </SummaryPanel>
        </div>
      </div>

      <RoomPreviewsPanel product={product} variant={selectedVariant} onSave={onSave} />

      <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="text-sm font-semibold text-slate-900">Test Configuration</h3><p className="mt-1 text-sm text-slate-600">This is only a configuration test, not a real print export.</p></div>
          <button type="button" onClick={generateTestConfiguration} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"><FileJson className="h-4 w-4" /> Generate Test Configuration</button>
        </div>
        {testConfig && <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-sm leading-relaxed text-slate-50"><code>{JSON.stringify(testConfig, null, 2)}</code></pre>}
      </div>
    </div>
  );
}

function SummaryPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg bg-white p-4 ring-1 ring-gray-200"><h3 className="text-sm font-semibold text-gray-900">{title}</h3><div className="mt-3">{children}</div></section>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-gray-500">{label}</dt><dd className="text-right font-medium text-gray-900">{value}</dd></div>;
}

function calculateDimensions(surface: ProductSurface | null, variant: ProductVariant) {
  const trimWidth = toPixels(variant.width, variant.unit, variant.dpi);
  const trimHeight = toPixels(variant.height, variant.unit, variant.dpi);
  const bleedLeft = surface ? toPixels(surface.bleed.left, surface.bleed.unit, variant.dpi) : 0;
  const bleedRight = surface ? toPixels(surface.bleed.right, surface.bleed.unit, variant.dpi) : 0;
  const bleedTop = surface ? toPixels(surface.bleed.top, surface.bleed.unit, variant.dpi) : 0;
  const bleedBottom = surface ? toPixels(surface.bleed.bottom, surface.bleed.unit, variant.dpi) : 0;
  const safeLeft = surface ? toPixels(surface.safeArea.left, surface.safeArea.unit, variant.dpi) : 0;
  const safeRight = surface ? toPixels(surface.safeArea.right, surface.safeArea.unit, variant.dpi) : 0;
  const safeTop = surface ? toPixels(surface.safeArea.top, surface.safeArea.unit, variant.dpi) : 0;
  const safeBottom = surface ? toPixels(surface.safeArea.bottom, surface.safeArea.unit, variant.dpi) : 0;
  return {
    trimWidthPx: Math.round(trimWidth),
    trimHeightPx: Math.round(trimHeight),
    totalWidthPx: Math.round(trimWidth + bleedLeft + bleedRight),
    totalHeightPx: Math.round(trimHeight + bleedTop + bleedBottom),
    safeWidthPx: Math.max(Math.round(trimWidth - safeLeft - safeRight), 0),
    safeHeightPx: Math.max(Math.round(trimHeight - safeTop - safeBottom), 0),
    bleedPx: { top: Math.round(bleedTop), right: Math.round(bleedRight), bottom: Math.round(bleedBottom), left: Math.round(bleedLeft) },
    safeAreaPx: { top: Math.round(safeTop), right: Math.round(safeRight), bottom: Math.round(safeBottom), left: Math.round(safeLeft) },
  };
}

function getWarnings(product: Product, activeVariants: ProductVariant[], selectedVariant?: ProductVariant) {
  const warnings: string[] = [];
  if (activeVariants.length === 0) warnings.push('No active variant exists. Activate a variant before publishing.');
  if (!product.surface) warnings.push('No surface exists. Add a surface before publishing.');
  if (!selectedVariant) warnings.push('No variant exists. Add a variant before previewing.');
  if (!product.exportRules) warnings.push('Export rules are missing. Configure export rules before publishing.');
  if (selectedVariant && selectedVariant.dpi < 150) warnings.push('DPI is below 150. Production quality may be too low.');
  if (product.surface && selectedVariant && hasTightSafeArea(product.surface, selectedVariant)) warnings.push('Image/text may go outside safe area. Review the safe area margins for this surface.');
  return warnings;
}

function hasTightSafeArea(surface: ProductSurface, variant: ProductVariant) {
  const safeHorizontal = surface.safeArea.left + surface.safeArea.right;
  const safeVertical = surface.safeArea.top + surface.safeArea.bottom;
  return safeHorizontal <= 0 || safeVertical <= 0 || safeHorizontal >= variant.width || safeVertical >= variant.height;
}

function summarizeProduct(product: Product) {
  return { _id: product._id, name: product.name, slug: product.slug, productType: product.productType, status: product.status, basePrice: product.basePrice };
}

function summarizeVariant(variant: ProductVariant) {
  return { _id: variant._id, name: variant.name, sku: variant.sku, status: variant.status, price: variant.price, width: variant.width, height: variant.height, unit: variant.unit, dpi: variant.dpi, previewImageUrl: variant.previewImageUrl, thumbnailImageUrl: variant.thumbnailImageUrl, options: variant.options, roomPreviews: variant.roomPreviews };
}

function yesNo(value: boolean) {
  return value ? 'Yes' : 'No';
}
