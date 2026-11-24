import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { createDefaultExportRules } from '../../lib/storage';
import type { ColorMode, ExportFormat, ExportRules, Product } from '../../types';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

const formatOptions: { value: ExportFormat; label: string }[] = [
  { value: 'PNG', label: 'PNG' },
  { value: 'JPG', label: 'JPG' },
  { value: 'PDF', label: 'PDF' },
  { value: 'SVG', label: 'SVG' },
];

const colorModeOptions: { value: ColorMode; label: string }[] = [
  { value: 'RGB', label: 'RGB' },
  { value: 'CMYK', label: 'CMYK' },
];

const yesNoOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export function ExportRulesTab({ product, onSave }: Props) {
  const [rules, setRules] = useState<ExportRules>(() => ({
    ...createDefaultExportRules(),
    ...product.exportRules,
  }));
  const [saved, setSaved] = useState(false);

  const errors = useMemo(() => validateRules(rules), [rules]);
  const isValid = Object.keys(errors).length === 0;
  const exampleFilename = buildExampleFilename(rules);

  function update<K extends keyof ExportRules>(key: K, value: ExportRules[K]) {
    setRules((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid) return;
    onSave({ ...product, exportRules: rules });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 pb-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Export Rules</h2>
        <p className="mt-1 text-sm text-gray-500">
          Define the production file your team receives after checkout.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RuleField description="Choose the file type generated for each print surface.">
          <Select
            label="Export Format"
            value={rules.format}
            onChange={(event) => update('format', event.target.value as ExportFormat)}
            options={formatOptions}
          />
        </RuleField>

        <RuleField description="Sets the output resolution used for raster exports and quality checks.">
          <Input
            label="DPI"
            type="number"
            min="1"
            step="1"
            value={rules.dpi}
            onChange={(event) => update('dpi', Number(event.target.value))}
            error={errors.dpi}
          />
        </RuleField>

        <RuleField description="Controls JPEG compression quality. The default 94 keeps print detail while substantially reducing file size.">
          <Input
            label="Raster Quality"
            type="number"
            min="1"
            max="100"
            step="1"
            value={rules.rasterQuality}
            onChange={(event) => update('rasterQuality', Number(event.target.value))}
            error={errors.rasterQuality}
          />
        </RuleField>

        <RuleField description="Adds the configured bleed area to the final production file.">
          <Select
            label="Include Bleed"
            value={rules.includeBleed ? 'yes' : 'no'}
            onChange={(event) => update('includeBleed', event.target.value === 'yes')}
            options={yesNoOptions}
          />
        </RuleField>

        <RuleField description="Combines editable objects into a single output layer where possible.">
          <Select
            label="Flatten Output"
            value={rules.flattenOutput ? 'yes' : 'no'}
            onChange={(event) => update('flattenOutput', event.target.value === 'yes')}
            options={yesNoOptions}
          />
        </RuleField>

        <RuleField description="Keeps transparent areas transparent for formats that support it.">
          <Select
            label="Transparent Background"
            value={rules.transparentBackground ? 'yes' : 'no'}
            onChange={(event) => update('transparentBackground', event.target.value === 'yes')}
            options={yesNoOptions}
          />
        </RuleField>

        <RuleField description="Used behind the design when transparent background is turned off.">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={rules.backgroundColor}
                onChange={(event) => update('backgroundColor', event.target.value)}
                className="h-10 w-10 rounded-md border-0 p-0 cursor-pointer"
              />
              <Input
                value={rules.backgroundColor}
                onChange={(event) => update('backgroundColor', event.target.value)}
                error={errors.backgroundColor}
              />
            </div>
          </div>
        </RuleField>

        <RuleField description="Use placeholders like {orderId}, {sku}, and {surface} to name export files.">
          <Input
            label="Filename Template"
            value={rules.filenameTemplate}
            onChange={(event) => update('filenameTemplate', event.target.value)}
            error={errors.filenameTemplate}
            placeholder="{orderId}_{sku}_{surface}"
          />
        </RuleField>

        <RuleField description="CMYK is shown as a future option but does not need real conversion yet.">
          <Select
            label="Color Mode"
            value={rules.colorMode}
            onChange={(event) => update('colorMode', event.target.value as ColorMode)}
            options={colorModeOptions}
          />
        </RuleField>
      </div>

      <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
        <p className="text-sm font-medium text-slate-900">Calculated filename preview</p>
        <p className="mt-2 font-mono text-sm text-slate-700">Example: {exampleFilename}</p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!isValid}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Save className="h-4 w-4" />
          Save Rules
        </button>
        {saved && <span className="text-sm font-medium text-emerald-600">Saved!</span>}
      </div>
    </form>
  );
}

function RuleField({ children, description }: { children: React.ReactNode; description: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4 ring-1 ring-gray-200">
      {children}
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </div>
  );
}

function validateRules(rules: ExportRules): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!Number.isFinite(rules.dpi) || rules.dpi <= 0) {
    errors.dpi = 'DPI must be greater than zero.';
  }
  if (!Number.isFinite(rules.rasterQuality) || rules.rasterQuality < 1 || rules.rasterQuality > 100) {
    errors.rasterQuality = 'Raster quality must be between 1 and 100.';
  }
  if (!/^#[0-9a-f]{6}$/i.test(rules.backgroundColor)) {
    errors.backgroundColor = 'Use a valid hex color, such as #ffffff.';
  }
  if (!rules.filenameTemplate.trim()) {
    errors.filenameTemplate = 'Filename template is required.';
  }

  return errors;
}

function buildExampleFilename(rules: ExportRules) {
  const base = rules.filenameTemplate
    .replace(/\{orderId\}/g, 'ORDER123')
    .replace(/\{sku\}/g, 'CANVAS-16X20')
    .replace(/\{surface\}/g, 'front')
    .trim();

  const extension = rules.format.toLowerCase();
  return `${base || 'ORDER123_CANVAS-16X20_front'}.${extension}`;
}

