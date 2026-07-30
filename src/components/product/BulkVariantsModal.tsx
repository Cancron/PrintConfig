import { useMemo, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import type { ProductStatus, ProductType, ProductUnit, ProductVariant, VariantOptionDefinition } from '../../types';

interface BulkVariantInput {
  w?: unknown;
  h?: unknown;
  price?: unknown;
  options?: unknown;
}

interface ParsedBatch {
  variants: ProductVariant[];
  skippedSkus: string[];
  errors: string[];
}

interface Props {
  productId: string;
  productType: ProductType;
  tshirtColorOptionKey: string;
  tshirtSizeOptionKey: string;
  existingVariants: ProductVariant[];
  optionDefinitions: VariantOptionDefinition[];
  onClose: () => void;
  onImport: (variants: ProductVariant[]) => void;
}

const statusOptions = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Active', label: 'Active' },
];

const unitOptions = [
  { value: 'inch', label: 'inch' },
  { value: 'mm', label: 'mm' },
  { value: 'px', label: 'px' },
];

const dpiOptions = ['72', '150', '300', '600'].map((value) => ({ value, label: `${value} DPI` }));

export function BulkVariantsModal({
  productId,
  productType,
  tshirtColorOptionKey,
  tshirtSizeOptionKey,
  existingVariants,
  optionDefinitions,
  onClose,
  onImport,
}: Props) {
  const [json, setJson] = useState('[\n  { "w": 10, "h": 10, "price": 55, "options": { "Color": "white", "Size": "XS" } }\n]');
  const [namePrefix, setNamePrefix] = useState('');
  const [skuPrefix, setSkuPrefix] = useState('cpccd');
  const [status, setStatus] = useState<ProductStatus>('Draft');
  const [unit, setUnit] = useState<ProductUnit>('inch');
  const [dpi, setDpi] = useState('300');

  const batch = useMemo(
    () => parseBatch({
      json,
      namePrefix,
      skuPrefix,
      status,
      unit,
      dpi: Number(dpi),
      productId,
      productType,
      tshirtColorOptionKey,
      tshirtSizeOptionKey,
      existingVariants,
      optionDefinitions,
    }),
    [
      dpi,
      existingVariants,
      json,
      namePrefix,
      optionDefinitions,
      productId,
      productType,
      skuPrefix,
      status,
      tshirtColorOptionKey,
      tshirtSizeOptionKey,
      unit,
    ],
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Bulk Add Variants</h3>
            <p className="mt-1 text-sm text-gray-500">Paste dimensions and prices, then apply shared settings to every new variant.</p>
          </div>
          <button type="button" onClick={onClose} title="Close" className="rounded-md p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Name Prefix" value={namePrefix} onChange={(event) => setNamePrefix(event.target.value)} placeholder="Optional, e.g. Canvas" />
            <Input label="SKU Prefix" value={skuPrefix} onChange={(event) => setSkuPrefix(event.target.value)} placeholder="cpccd" />
            <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value as ProductStatus)} options={statusOptions} />
            <Select label="Unit" value={unit} onChange={(event) => setUnit(event.target.value as ProductUnit)} options={unitOptions} />
            <Select label="DPI" value={dpi} onChange={(event) => setDpi(event.target.value)} options={dpiOptions} />
          </div>

          <Textarea
            label="Variant JSON"
            rows={10}
            value={json}
            onChange={(event) => setJson(event.target.value)}
            className="font-mono"
            error={batch.errors.length ? batch.errors.join(' ') : undefined}
          />
          <p className="text-sm text-gray-500">
            Expected format: an array of objects containing numeric <code>w</code>, <code>h</code>, and <code>price</code> values.
            T-shirt SKUs use the configured color and size values; other product SKUs use width and height.
          </p>

          {!batch.errors.length && (
            <div className="rounded-md bg-gray-50 p-4 text-sm ring-1 ring-gray-200">
              <p className="font-medium text-gray-900">{batch.variants.length} variant{batch.variants.length === 1 ? '' : 's'} ready to add.</p>
              {batch.skippedSkus.length > 0 && <p className="mt-1 text-amber-700">{batch.skippedSkus.length} duplicate SKU{batch.skippedSkus.length === 1 ? '' : 's'} will be skipped: {batch.skippedSkus.join(', ')}</p>}
              {batch.variants[0] && (
                <p className="mt-2 text-gray-600">
                  Example: {batch.variants[0].name} · {batch.variants[0].sku} · {batch.variants[0].options.Orientation} · {batch.variants[0].options.Ratio}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">Cancel</button>
          <button
            type="button"
            disabled={batch.errors.length > 0 || batch.variants.length === 0}
            onClick={() => onImport(batch.variants)}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Upload className="h-4 w-4" /> Add {batch.variants.length} Variants
          </button>
        </div>
      </div>
    </div>
  );
}

function parseBatch(input: {
  json: string;
  namePrefix: string;
  skuPrefix: string;
  status: ProductStatus;
  unit: ProductUnit;
  dpi: number;
  productId: string;
  productType: ProductType;
  tshirtColorOptionKey: string;
  tshirtSizeOptionKey: string;
  existingVariants: ProductVariant[];
  optionDefinitions: VariantOptionDefinition[];
}): ParsedBatch {
  let rows: BulkVariantInput[];
  try {
    const parsed: unknown = JSON.parse(input.json);
    if (!Array.isArray(parsed)) return { variants: [], skippedSkus: [], errors: ['JSON must be an array.'] };
    rows = parsed;
  } catch {
    return { variants: [], skippedSkus: [], errors: ['Enter valid JSON. Property names and text values must use double quotes.'] };
  }

  const errors: string[] = [];
  const variants: ProductVariant[] = [];
  const skippedSkus: string[] = [];
  const seenSkus = new Set(input.existingVariants.map((variant) => variant.sku.trim().toLowerCase()));
  const prefix = toSkuSegment(input.skuPrefix);
  const namePrefix = input.namePrefix.trim();

  if (!prefix) errors.push('SKU prefix is required.');
  if (!Number.isFinite(input.dpi) || input.dpi <= 0) errors.push('DPI must be greater than zero.');

  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object') {
      errors.push(`Row ${index + 1} must be an object.`);
      return;
    }
    const width = Number(row.w);
    const height = Number(row.h);
    const price = Number(row.price);
    if (!Number.isFinite(width) || width <= 0) errors.push(`Row ${index + 1}: w must be greater than zero.`);
    if (!Number.isFinite(height) || height <= 0) errors.push(`Row ${index + 1}: h must be greater than zero.`);
    if (!Number.isFinite(price) || price < 0) errors.push(`Row ${index + 1}: price must be zero or greater.`);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 || !Number.isFinite(price) || price < 0) return;

    const size = `${formatNumber(width)} X ${formatNumber(height)}`;
    const rowOptions = isStringRecord(row.options) ? row.options : {};
    if (row.options !== undefined && !isStringRecord(row.options)) {
      errors.push(`Row ${index + 1}: options must be an object containing text or numeric values.`);
      return;
    }
    const isTShirt = input.productType === 'T-Shirt Print';
    const colorValue = getOptionValue(rowOptions, input.tshirtColorOptionKey);
    const clothingSizeValue = getOptionValue(rowOptions, input.tshirtSizeOptionKey);
    if (isTShirt && !colorValue) {
      errors.push(`Row ${index + 1}: options.${input.tshirtColorOptionKey} is required for the T-shirt SKU.`);
      return;
    }
    if (isTShirt && !clothingSizeValue) {
      errors.push(`Row ${index + 1}: options.${input.tshirtSizeOptionKey} is required for the T-shirt SKU.`);
      return;
    }
    const sku = isTShirt
      ? [prefix, toSkuSegment(colorValue), toSkuSegment(clothingSizeValue)].join('-')
      : [prefix, toSkuSegment(formatNumber(width)), toSkuSegment(formatNumber(height))].join('-');
    if (seenSkus.has(sku.toLowerCase())) {
      skippedSkus.push(sku);
      return;
    }
    seenSkus.add(sku.toLowerCase());
    const normalizedRowOptions = Object.fromEntries(Object.entries(rowOptions).map(([key, value]) => [key, String(value)]));
    const options: Record<string, string> = isTShirt
      ? normalizedRowOptions
      : {
          Size: size,
          Orientation: getOrientation(width, height),
          Ratio: getRatio(width, height),
          ...normalizedRowOptions,
        };
    const missing = input.optionDefinitions.filter((definition) => definition.required && !String(options[definition.key] ?? '').trim());
    if (missing.length > 0) {
      errors.push(`Row ${index + 1}: missing required options ${missing.map((definition) => definition.name).join(', ')}.`);
      return;
    }
    const variantName = isTShirt
      ? `${namePrefix ? `${namePrefix} ` : ''}(${colorValue}) (${clothingSizeValue})`
      : namePrefix
        ? `${namePrefix} ${size}`
        : size;
    const now = new Date().toISOString();
    variants.push({
      _id: '',
      clientId: crypto.randomUUID(),
      productId: input.productId,
      name: variantName,
      sku,
      price,
      status: input.status,
      options,
      width,
      height,
      unit: input.unit,
      dpi: input.dpi,
      previewImageUrl: '',
      thumbnailImageUrl: '',
      createdAt: now,
      updatedAt: now,
    });
  });

  return { variants, skippedSkus, errors };
}

function isStringRecord(value: unknown): value is Record<string, string | number> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every((item) => typeof item === 'string' || typeof item === 'number');
}

function getOptionValue(options: Record<string, string | number>, key: string) {
  const match = Object.entries(options).find(([optionKey]) => optionKey.trim().toLowerCase() === key.trim().toLowerCase());
  return match ? String(match[1]).trim() : '';
}

function getOrientation(width: number, height: number) {
  if (width === height) return 'Square';
  if (width < height) return 'Portrait';
  if (width / height > 2) return 'Panorama';
  return 'Horizontal';
}

function getRatio(width: number, height: number) {
  const scale = 10 ** Math.max(decimalPlaces(width), decimalPlaces(height));
  const scaledWidth = Math.round(width * scale);
  const scaledHeight = Math.round(height * scale);
  const divisor = greatestCommonDivisor(scaledWidth, scaledHeight);
  return `${scaledWidth / divisor}:${scaledHeight / divisor}`;
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

function decimalPlaces(value: number) {
  const text = String(value);
  return text.includes('.') ? text.length - text.indexOf('.') - 1 : 0;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function toSkuSegment(value: string) {
  return value.trim().toLowerCase().replace(/\./g, '-').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}
