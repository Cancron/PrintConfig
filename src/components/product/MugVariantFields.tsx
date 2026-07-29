import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { MugInsets, MugVariantConfig } from '../../types';

interface Props {
  value: MugVariantConfig;
  errors: Record<string, string>;
  onChange: (value: MugVariantConfig) => void;
}

const unitOptions = [
  { value: 'inch', label: 'inch' },
  { value: 'cm', label: 'cm' },
  { value: 'mm', label: 'mm' },
];

export function MugVariantFields({ value, errors, onChange }: Props) {
  function updatePrintArea<K extends keyof MugVariantConfig['printArea']>(key: K, next: MugVariantConfig['printArea'][K]) {
    onChange({ ...value, printArea: { ...value.printArea, [key]: next } });
  }

  function updateInsets(group: 'bleed' | 'safeArea', side: keyof MugInsets, next: number) {
    updatePrintArea(group, { ...value.printArea[group], [side]: next });
  }

  return (
    <section className="mt-6 border-t border-gray-200 pt-5">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">Mug Print Configuration</h4>
        <p className="mt-1 text-sm text-gray-500">Define the flat printable wrap and the GLB material that receives the artwork texture.</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="Print Width" type="number" min="0.01" step="0.01" value={value.printArea.width} onChange={(event) => updatePrintArea('width', Number(event.target.value))} error={errors['mug.printArea.width']} />
        <Input label="Print Height" type="number" min="0.01" step="0.01" value={value.printArea.height} onChange={(event) => updatePrintArea('height', Number(event.target.value))} error={errors['mug.printArea.height']} />
        <Select label="Print Unit" value={value.printArea.unit} onChange={(event) => updatePrintArea('unit', event.target.value as MugVariantConfig['printArea']['unit'])} options={unitOptions} error={errors['mug.printArea.unit']} />
      </div>

      <InsetFields title="Bleed" group="bleed" value={value.printArea.bleed} errors={errors} onChange={updateInsets} />
      <InsetFields title="Safe Area" group="safeArea" value={value.printArea.safeArea} errors={errors} onChange={updateInsets} />

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="GLB Model URL" value={value.model.url} onChange={(event) => onChange({ ...value, model: { ...value.model, url: event.target.value } })} error={errors['mug.model.url']} placeholder="https://example.com/models/mug.glb" />
        <Input label="Printable Material Name" value={value.model.printableMaterialName} onChange={(event) => onChange({ ...value, model: { ...value.model, printableMaterialName: event.target.value } })} error={errors['mug.model.printableMaterialName']} placeholder="Mug_Print_Area" />
      </div>
      <p className="mt-2 text-xs text-gray-500">The model URL must be a public, CORS-enabled .glb file. Material matching is exact and may target multiple meshes.</p>
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
  value: MugInsets;
  errors: Record<string, string>;
  onChange: (group: 'bleed' | 'safeArea', side: keyof MugInsets, value: number) => void;
}) {
  return (
    <div className="mt-5">
      <h5 className="text-sm font-medium text-gray-800">{title}</h5>
      <p className="mt-1 text-xs text-gray-500">{group === 'bleed' ? 'Added around the finished printable wrap.' : 'Measured inward from the finished wrap boundary.'}</p>
      <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
          <Input key={side} label={`${title} ${capitalize(side)}`} type="number" min="0" step="0.01" value={value[side]} onChange={(event) => onChange(group, side, Number(event.target.value))} error={errors[`mug.printArea.${group}.${side}`]} />
        ))}
      </div>
    </div>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
