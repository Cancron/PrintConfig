import { ImageField } from '../gallery/ImageField';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { PillowInsets, PillowMockupConfig, PillowSide, PillowVariantConfig } from '../../types';

interface Props {
  value: PillowVariantConfig;
  errors: Record<string, string>;
  onChange: (value: PillowVariantConfig) => void;
}

const unitOptions = [
  { value: 'inch', label: 'inch' },
  { value: 'cm', label: 'cm' },
  { value: 'mm', label: 'mm' },
];

export function PillowVariantFields({ value, errors, onChange }: Props) {
  function updatePrintArea<K extends keyof PillowVariantConfig['printArea']>(key: K, next: PillowVariantConfig['printArea'][K]) {
    onChange({ ...value, printArea: { ...value.printArea, [key]: next } });
  }

  function updateInsets(group: 'bleed' | 'safeArea', side: keyof PillowInsets, next: number) {
    updatePrintArea(group, { ...value.printArea[group], [side]: next });
  }

  function updateMockup(side: PillowSide, next: PillowMockupConfig) {
    onChange({ ...value, mockups: { ...value.mockups, [side]: next } });
  }

  return (
    <section className="mt-6 border-t border-gray-200 pt-5">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">Pillow Print Configuration</h4>
        <p className="mt-1 text-sm text-gray-500">Define the production print area and where artwork appears on each mockup image.</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Select label="Shape" value={value.shape} onChange={(event) => onChange({ ...value, shape: event.target.value as PillowVariantConfig['shape'] })} options={[{ value: 'square', label: 'Square' }, { value: 'rectangle', label: 'Rectangle' }]} error={errors['pillow.shape']} />
        <Input label="Print Width" type="number" min="0.01" step="0.01" value={value.printArea.width} onChange={(event) => updatePrintArea('width', Number(event.target.value))} error={errors['pillow.printArea.width']} />
        <Input label="Print Height" type="number" min="0.01" step="0.01" value={value.printArea.height} onChange={(event) => updatePrintArea('height', Number(event.target.value))} error={errors['pillow.printArea.height']} />
        <Select label="Print Unit" value={value.printArea.unit} onChange={(event) => updatePrintArea('unit', event.target.value as PillowVariantConfig['printArea']['unit'])} options={unitOptions} error={errors['pillow.printArea.unit']} />
      </div>

      <InsetFields title="Bleed" group="bleed" value={value.printArea.bleed} errors={errors} onChange={updateInsets} />
      <InsetFields title="Safe Area" group="safeArea" value={value.printArea.safeArea} errors={errors} onChange={updateInsets} />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {(['front', 'back'] as const).map((side) => (
          <MockupFields key={side} side={side} value={value.mockups[side]} errors={errors} onChange={(next) => updateMockup(side, next)} />
        ))}
      </div>
    </section>
  );
}

function InsetFields({
  title,
  group,
  value,
  errors,
  onChange,
}: {
  title: string;
  group: 'bleed' | 'safeArea';
  value: PillowInsets;
  errors: Record<string, string>;
  onChange: (group: 'bleed' | 'safeArea', side: keyof PillowInsets, value: number) => void;
}) {
  return (
    <div className="mt-5">
      <h5 className="text-sm font-medium text-gray-800">{title}</h5>
      <p className="mt-1 text-xs text-gray-500">{group === 'bleed' ? 'Added outside the trimmed print area.' : 'Measured inward from the trimmed boundary.'}</p>
      <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
          <Input key={side} label={`${title} ${capitalize(side)}`} type="number" min="0" step="0.01" value={value[side]} onChange={(event) => onChange(group, side, Number(event.target.value))} error={errors[`pillow.printArea.${group}.${side}`]} />
        ))}
      </div>
    </div>
  );
}

function MockupFields({
  side,
  value,
  errors,
  onChange,
}: {
  side: PillowSide;
  value: PillowMockupConfig;
  errors: Record<string, string>;
  onChange: (value: PillowMockupConfig) => void;
}) {
  const prefix = `pillow.mockups.${side}`;
  function updateArea<K extends keyof PillowMockupConfig['designArea']>(key: K, next: PillowMockupConfig['designArea'][K]) {
    onChange({ ...value, designArea: { ...value.designArea, [key]: next } });
  }

  return (
    <div className="border-t border-gray-200 pt-4">
      <h5 className="text-sm font-semibold text-gray-900">{capitalize(side)} Mockup</h5>
      <div className="mt-3 space-y-4">
        <ImageField label="Mockup Image URL" url={value.imageUrl} assetId={value.imageAssetId} onChange={(url, assetId) => onChange({ ...value, imageUrl: url, imageAssetId: assetId })} />
        {errors[`${prefix}.imageUrl`] && <p className="-mt-2 text-sm text-red-600">{errors[`${prefix}.imageUrl`]}</p>}
        <ImageField label="Thumbnail Image URL" url={value.thumbnailImageUrl ?? ''} assetId={value.thumbnailImageAssetId} onChange={(url, assetId) => onChange({ ...value, thumbnailImageUrl: url, thumbnailImageAssetId: assetId })} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(['x', 'y', 'width', 'height', 'cornerRadius'] as const).map((field) => (
            <Input key={field} label={field === 'cornerRadius' ? 'Corner Radius %' : `${capitalize(field)} %`} type="number" min="0" max={field === 'cornerRadius' ? 50 : 100} step="0.1" value={value.designArea[field] ?? 0} onChange={(event) => updateArea(field, Number(event.target.value))} error={errors[`${prefix}.designArea.${field}`]} />
          ))}
        </div>
        <MockupPlacementPreview side={side} mockup={value} />
      </div>
    </div>
  );
}

function MockupPlacementPreview({ side, mockup }: { side: PillowSide; mockup: PillowMockupConfig }) {
  const area = mockup.designArea;
  return (
    <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-md bg-slate-50 p-3 ring-1 ring-inset ring-gray-200">
      {mockup.imageUrl ? (
        <div className="relative inline-block max-h-72 max-w-full">
          <img src={mockup.imageUrl} alt={`${capitalize(side)} pillow mockup`} className="block max-h-72 max-w-full object-contain" />
          <div
            className="pointer-events-none absolute border-2 border-dashed border-cyan-600 bg-cyan-500/10"
            style={{
              left: `${area.x}%`,
              top: `${area.y}%`,
              width: `${area.width}%`,
              height: `${area.height}%`,
              borderRadius: `${Math.min(50, Math.max(0, area.cornerRadius ?? 0))}%`,
            }}
          />
        </div>
      ) : (
        <p className="text-sm text-gray-500">Select a mockup image to preview placement.</p>
      )}
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
