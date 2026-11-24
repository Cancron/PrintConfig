import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Save, Trash2 } from 'lucide-react';
import type { Product, TShirtColorConfig, TShirtDesignArea, TShirtMockupConfig, TShirtPlacementConfig, TShirtProductConfig } from '../../types';
import { createDefaultTShirtMockupConfig, createDefaultTShirtPlacementConfig, normalizeTShirtProductConfig } from '../../lib/storage';
import { ensureTShirtVariantOptionDefinitions } from '../../lib/variantOptions';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ImageField } from '../gallery/ImageField';
import { PercentageRectangleEditor } from './PercentageRectangleEditor';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

type Errors = Record<string, string>;
const units = [{ value: 'inch', label: 'Inches' }, { value: 'cm', label: 'Centimeters' }, { value: 'mm', label: 'Millimeters' }];
const yesNo = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];
const insetSides = ['top', 'right', 'bottom', 'left'] as const;

export function TShirtSettingsTab({ product, onSave }: Props) {
  const [draft, setDraft] = useState<TShirtProductConfig>(() => normalizeTShirtProductConfig(product.tshirt, true));
  const [placementIndex, setPlacementIndex] = useState(0);
  const [colorIndex, setColorIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const errors = useMemo(() => validateDraft(draft, product), [draft, product]);
  const isValid = Object.keys(errors).length === 0;
  const placement = draft.placements[placementIndex];
  const color = draft.colors[colorIndex];
  const mockup = placement && color ? color.mockups[placement.id] ?? createDefaultTShirtMockupConfig() : undefined;

  function update(patch: Partial<TShirtProductConfig>) {
    setSaved(false);
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updatePlacement(next: TShirtPlacementConfig) {
    if (!placement) return;
    setSaved(false);
    setDraft((current) => {
      const oldId = current.placements[placementIndex]?.id ?? placement.id;
      return {
        ...current,
        placements: current.placements.map((item, index) => index === placementIndex ? next : item),
        defaultPlacementId: current.defaultPlacementId === oldId ? next.id : current.defaultPlacementId,
        colors: current.colors.map((item) => {
          if (oldId === next.id) return item;
          const mockups = {
            ...item.mockups,
            [next.id]: item.mockups[oldId] ?? item.mockups[next.id] ?? createDefaultTShirtMockupConfig(),
          };
          delete mockups[oldId];
          return { ...item, mockups };
        }),
      };
    });
  }

  function addPlacement() {
    const number = draft.placements.length + 1;
    const next = createDefaultTShirtPlacementConfig(`placement-${crypto.randomUUID().slice(0, 8)}`, `Placement ${number}`);
    setDraft((current) => ({
      ...current,
      placements: [...current.placements, next],
      colors: current.colors.map((item) => ({ ...item, mockups: { ...item.mockups, [next.id]: createDefaultTShirtMockupConfig() } })),
    }));
    setPlacementIndex(draft.placements.length);
    setSaved(false);
  }

  function deletePlacement() {
    if (!placement || draft.placements.length === 1) return;
    if (!confirm(`Delete the ${placement.label || placement.id} placement and all of its color mockups?`)) return;
    const nextPlacements = draft.placements.filter((_, index) => index !== placementIndex);
    setDraft((current) => ({
      ...current,
      placements: nextPlacements,
      defaultPlacementId: current.defaultPlacementId === placement.id ? nextPlacements[0]?.id ?? '' : current.defaultPlacementId,
      colors: current.colors.map((item) => {
        const mockups = { ...item.mockups };
        delete mockups[placement.id];
        return { ...item, mockups };
      }),
    }));
    setPlacementIndex(Math.max(0, Math.min(placementIndex, nextPlacements.length - 1)));
    setSaved(false);
  }

  function movePlacement(direction: -1 | 1) {
    const targetIndex = placementIndex + direction;
    if (!placement || targetIndex < 0 || targetIndex >= draft.placements.length) return;
    const placements = [...draft.placements];
    [placements[placementIndex], placements[targetIndex]] = [placements[targetIndex], placements[placementIndex]];
    update({ placements });
    setPlacementIndex(targetIndex);
  }

  function addColor() {
    const number = draft.colors.length + 1;
    const next: TShirtColorConfig = {
      value: `Color ${number}`,
      label: `Color ${number}`,
      swatchColor: '#111111',
      swatchImageUrl: '',
      mockups: Object.fromEntries(draft.placements.map((item) => [item.id, createDefaultTShirtMockupConfig()])),
    };
    update({ colors: [...draft.colors, next] });
    setColorIndex(draft.colors.length);
  }

  function updateColor(index: number, next: TShirtColorConfig) {
    setSaved(false);
    setDraft((current) => ({
      ...current,
      colors: current.colors.map((item, itemIndex) => itemIndex === index ? { ...item, ...next, mockups: next.mockups ?? item.mockups } : item),
    }));
  }

  function deleteColor(index: number) {
    const selected = draft.colors[index];
    if (!selected || !confirm(`Delete the ${selected.label || selected.value} color and all of its mockups?`)) return;
    const colors = draft.colors.filter((_, itemIndex) => itemIndex !== index);
    update({ colors });
    setColorIndex(Math.max(0, Math.min(colorIndex, colors.length - 1)));
  }

  function updateMockup(next: TShirtMockupConfig) {
    if (!placement || !color) return;
    setSaved(false);
    setDraft((current) => {
      const currentPlacement = current.placements[placementIndex];
      const currentColor = current.colors[colorIndex];
      if (!currentPlacement || !currentColor) return current;
      const currentMockup = currentColor.mockups[currentPlacement.id] ?? createDefaultTShirtMockupConfig();
      return {
        ...current,
        colors: current.colors.map((item, index) => index === colorIndex
          ? {
              ...item,
              mockups: {
                ...item.mockups,
                [currentPlacement.id]: { ...currentMockup, ...next },
              },
            }
          : item),
      };
    });
  }

  function handleSave() {
    if (!isValid) return;
    const optionDefinitions = ensureTShirtVariantOptionDefinitions(
      product.variantOptionDefinitions,
      draft.colorOptionKey,
      draft.sizeOptionKey,
      product.tshirt.colorOptionKey,
      product.tshirt.sizeOptionKey,
    );
    const variants = product.variants.map((variant) => {
      const options = { ...variant.options };
      for (const [previousKey, nextKey] of [[product.tshirt.colorOptionKey, draft.colorOptionKey], [product.tshirt.sizeOptionKey, draft.sizeOptionKey]]) {
        if (previousKey !== nextKey && options[previousKey] !== undefined) {
          options[nextKey] = options[previousKey];
          delete options[previousKey];
        }
      }
      return { ...variant, options };
    });
    onSave({ ...product, tshirt: draft, variantOptionDefinitions: optionDefinitions, variants, updatedAt: new Date().toISOString() });
    setSaved(true);
  }

  return (
    <div className="space-y-7 pb-6">
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Editor Configuration</h2>
          <p className="mt-1 text-sm text-gray-500">Option keys must match the Color and Size entries stored on each T-shirt variant.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Enable T-Shirt Editor" value={draft.enabled ? 'yes' : 'no'} onChange={(event) => update({ enabled: event.target.value === 'yes' })} options={yesNo} error={errors.enabled} />
          <Select label="Default Placement" value={draft.defaultPlacementId} onChange={(event) => update({ defaultPlacementId: event.target.value })} options={draft.placements.map((item) => ({ value: item.id, label: item.label || item.id }))} error={errors.defaultPlacementId} />
          <Input label="Color Option Key" value={draft.colorOptionKey} onChange={(event) => update({ colorOptionKey: event.target.value })} error={errors.colorOptionKey} />
          <Input label="Size Option Key" value={draft.sizeOptionKey} onChange={(event) => update({ sizeOptionKey: event.target.value })} error={errors.sizeOptionKey} />
        </div>
      </section>

      <section className="space-y-4 border-t border-gray-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Garment Colors</h2>
            <p className="mt-1 text-sm text-gray-500">Mockup images and design regions are configured per placement below.</p>
          </div>
          <button type="button" onClick={addColor} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><Plus className="h-4 w-4" /> Add Color</button>
        </div>
        {draft.colors.length === 0 ? (
          <div className="border-y border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">No garment colors configured.</div>
        ) : (
          <div className="divide-y divide-gray-200 border-y border-gray-200">
            {draft.colors.map((item, index) => (
              <div key={index} className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-[1fr_1fr_130px_1.5fr_auto] sm:items-start">
                <Input label="Option Value" value={item.value} onChange={(event) => updateColor(index, { ...item, value: event.target.value })} error={errors[`color.${index}.value`]} />
                <Input label="Label" value={item.label} onChange={(event) => updateColor(index, { ...item, label: event.target.value })} error={errors[`color.${index}.label`]} />
                <Input label="Swatch" type="color" value={item.swatchColor || '#111111'} onChange={(event) => updateColor(index, { ...item, swatchColor: event.target.value })} error={errors[`color.${index}.swatchColor`]} />
                <ImageField label="Swatch Image URL" url={item.swatchImageUrl ?? ''} onChange={(url) => updateColor(index, { ...item, swatchImageUrl: url })} />
                <button type="button" title="Delete color" onClick={() => deleteColor(index)} className="mt-6 rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-5 border-t border-gray-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Print Placements</h2>
            <p className="mt-1 text-sm text-gray-500">Select a placement, then choose a color to edit its mockup design region.</p>
          </div>
          <button type="button" onClick={addPlacement} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><Plus className="h-4 w-4" /> Add Placement</button>
        </div>

        <div className="overflow-x-auto border-b border-gray-200">
          <nav className="-mb-px flex min-w-max gap-6" aria-label="T-shirt placements">
            {draft.placements.map((item, index) => (
              <button key={item.id} type="button" onClick={() => setPlacementIndex(index)} className={`border-b-2 px-1 py-3 text-sm font-medium ${placementIndex === index ? 'border-slate-900 text-slate-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>
                {item.label || item.id || `Placement ${index + 1}`}
              </button>
            ))}
          </nav>
        </div>

        {placement && (
          <>
            <div className="flex justify-end gap-1">
              <button type="button" title="Move placement left" onClick={() => movePlacement(-1)} disabled={placementIndex === 0} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" title="Move placement right" onClick={() => movePlacement(1)} disabled={placementIndex === draft.placements.length - 1} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
              <button type="button" title="Delete placement" onClick={deletePlacement} disabled={draft.placements.length === 1} className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
            </div>

            <PlacementFields placement={placement} index={placementIndex} errors={errors} onChange={updatePlacement} />

            <div className="border-t border-gray-200 pt-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Mockup Design Region</h3>
                  <p className="mt-1 text-sm text-gray-500">Draw on empty image space, drag the rectangle, or resize it from a corner. Its shape follows the placement print ratio.</p>
                </div>
                <div className="w-full sm:w-64">
                  <Select label="Garment Color" value={color ? String(colorIndex) : ''} onChange={(event) => setColorIndex(Number(event.target.value))} options={draft.colors.map((item, index) => ({ value: String(index), label: item.label || item.value }))} />
                </div>
              </div>

              {!color || !mockup ? (
                <div className="border-y border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">Add a garment color before configuring placement mockups.</div>
              ) : (
                <div className="grid grid-cols-1 overflow-hidden border-y border-gray-200 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <PercentageRectangleEditor
                    imageUrl={mockup.imageUrl}
                    imageAlt={`${color.label} ${placement.label} T-shirt mockup`}
                    value={placement.designArea}
                    aspectRatio={placement.printArea.width / placement.printArea.height}
                    onChange={(designArea) => updatePlacement({ ...placement, designArea })}
                  />
                  <aside className="space-y-4 border-t border-gray-200 p-5 lg:border-l lg:border-t-0">
                    <ImageField label="Mockup Image URL" url={mockup.imageUrl} assetId={mockup.imageAssetId} onChange={(imageUrl, imageAssetId) => updateMockup({ ...mockup, imageUrl, imageAssetId })} />
                    {errors[`mockup.${colorIndex}.${placementIndex}.imageUrl`] && <p className="-mt-3 text-sm text-red-600">{errors[`mockup.${colorIndex}.${placementIndex}.imageUrl`]}</p>}
                    <ImageField label="Thumbnail Image URL" url={mockup.thumbnailImageUrl ?? ''} assetId={mockup.thumbnailImageAssetId} onChange={(thumbnailImageUrl, thumbnailImageAssetId) => updateMockup({ ...mockup, thumbnailImageUrl, thumbnailImageAssetId })} />
                    <div className="grid grid-cols-2 gap-3">
                      {(['x', 'y', 'width', 'height'] as const).map((field) => (
                        <Input key={field} label={`${field.toUpperCase()} %`} type="number" min="0" max="100" step="0.1" value={placement.designArea[field]} onChange={(event) => updatePlacement({ ...placement, designArea: clampArea({ ...placement.designArea, [field]: Number(event.target.value) }) })} error={errors[`placement.${placementIndex}.designArea.${field}`]} />
                      ))}
                    </div>
                    <Input label="Corner Radius %" type="number" min="0" max="50" step="0.1" value={placement.designArea.cornerRadius ?? 0} onChange={(event) => updatePlacement({ ...placement, designArea: { ...placement.designArea, cornerRadius: Number(event.target.value) } })} error={errors[`placement.${placementIndex}.designArea.cornerRadius`]} />
                    <p className="text-xs text-gray-500">This rectangle is shared by every {placement.label || placement.id} color mockup.</p>
                  </aside>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {!isValid && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
          <p className="font-medium">Complete the highlighted T-shirt settings before saving.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{[...new Set(Object.values(errors))].slice(0, 6).map((message) => <li key={message}>{message}</li>)}</ul>
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-gray-200 pt-5">
        <button type="button" onClick={handleSave} disabled={!isValid} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"><Save className="h-4 w-4" /> Save T-Shirt Settings</button>
        {saved && <span className="text-sm font-medium text-emerald-600">Saved!</span>}
      </div>
    </div>
  );
}

function PlacementFields({ placement, index, errors, onChange }: { placement: TShirtPlacementConfig; index: number; errors: Errors; onChange: (value: TShirtPlacementConfig) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="Label" value={placement.label} onChange={(event) => onChange({ ...placement, label: event.target.value })} error={errors[`placement.${index}.label`]} />
        <Input label="Additional Price" type="number" min="0" step="0.01" value={placement.additionalPrice} onChange={(event) => onChange({ ...placement, additionalPrice: Number(event.target.value) })} error={errors[`placement.${index}.additionalPrice`]} />
        <Input label="Print Width" type="number" min="0.01" step="0.01" value={placement.printArea.width} onChange={(event) => onChange({ ...placement, printArea: { ...placement.printArea, width: Number(event.target.value) } })} error={errors[`placement.${index}.width`]} />
        <Input label="Print Height" type="number" min="0.01" step="0.01" value={placement.printArea.height} onChange={(event) => onChange({ ...placement, printArea: { ...placement.printArea, height: Number(event.target.value) } })} error={errors[`placement.${index}.height`]} />
        <Select label="Unit" value={placement.printArea.unit} onChange={(event) => onChange({ ...placement, printArea: { ...placement.printArea, unit: event.target.value as TShirtPlacementConfig['printArea']['unit'] } })} options={units} />
      </div>
      {(['bleed', 'safeArea'] as const).map((group) => (
        <div key={group}>
          <p className="mb-2 text-xs font-semibold uppercase text-gray-500">{group === 'bleed' ? 'Bleed' : 'Safe Area'}</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {insetSides.map((side) => (
              <Input key={side} label={capitalize(side)} type="number" min="0" step="0.01" value={placement.printArea[group][side]} onChange={(event) => onChange({ ...placement, printArea: { ...placement.printArea, [group]: { ...placement.printArea[group], [side]: Number(event.target.value) } } })} error={errors[`placement.${index}.${group}.${side}`]} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function validateDraft(draft: TShirtProductConfig, product: Product): Errors {
  const errors: Errors = {};
  if (!draft.enabled) errors.enabled = 'Enable the T-shirt editor.';
  if (!draft.colorOptionKey.trim()) errors.colorOptionKey = 'Color option key is required.';
  if (!draft.sizeOptionKey.trim()) errors.sizeOptionKey = 'Size option key is required.';
  if (draft.colorOptionKey.trim().toLowerCase() === draft.sizeOptionKey.trim().toLowerCase()) errors.sizeOptionKey = 'Color and size option keys must be different.';
  if (!draft.placements.some((item) => item.id === draft.defaultPlacementId)) errors.defaultPlacementId = 'Choose a configured default placement.';

  const placementIds = new Set<string>();
  draft.placements.forEach((placement, index) => {
    const id = placement.id.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(placement.id)) errors[`placement.${index}.id`] = 'Use lowercase letters, numbers, and single hyphens.';
    else if (placementIds.has(id)) errors[`placement.${index}.id`] = 'Placement IDs must be unique.';
    placementIds.add(id);
    if (!placement.label.trim()) errors[`placement.${index}.label`] = 'Placement label is required.';
    if (!finiteAtLeast(placement.additionalPrice, 0)) errors[`placement.${index}.additionalPrice`] = 'Additional price cannot be negative.';
    if (!finiteGreaterThanZero(placement.printArea.width)) errors[`placement.${index}.width`] = 'Print width must be greater than zero.';
    if (!finiteGreaterThanZero(placement.printArea.height)) errors[`placement.${index}.height`] = 'Print height must be greater than zero.';
    for (const group of ['bleed', 'safeArea'] as const) {
      for (const side of insetSides) {
        if (!finiteAtLeast(placement.printArea[group][side], 0)) errors[`placement.${index}.${group}.${side}`] = `${group === 'bleed' ? 'Bleed' : 'Safe area'} cannot be negative.`;
      }
    }
    if (placement.printArea.safeArea.left > placement.printArea.width / 2 || placement.printArea.safeArea.right > placement.printArea.width / 2) errors[`placement.${index}.safeArea.left`] = 'Horizontal safe area cannot exceed half the print width.';
    if (placement.printArea.safeArea.top > placement.printArea.height / 2 || placement.printArea.safeArea.bottom > placement.printArea.height / 2) errors[`placement.${index}.safeArea.top`] = 'Vertical safe area cannot exceed half the print height.';
    const designArea = placement.designArea;
    if (!finiteAtLeast(designArea.x, 0) || designArea.x > 100) errors[`placement.${index}.designArea.x`] = 'X must be between 0 and 100.';
    if (!finiteAtLeast(designArea.y, 0) || designArea.y > 100) errors[`placement.${index}.designArea.y`] = 'Y must be between 0 and 100.';
    if (!finiteGreaterThanZero(designArea.width) || designArea.width > 100 || designArea.x + designArea.width > 100) errors[`placement.${index}.designArea.width`] = 'Width must fit inside the mockup.';
    if (!finiteGreaterThanZero(designArea.height) || designArea.height > 100 || designArea.y + designArea.height > 100) errors[`placement.${index}.designArea.height`] = 'Height must fit inside the mockup.';
    if (!finiteAtLeast(designArea.cornerRadius ?? 0, 0) || Number(designArea.cornerRadius ?? 0) > 50) errors[`placement.${index}.designArea.cornerRadius`] = 'Corner radius must be between 0 and 50.';
  });

  const colorValues = new Set<string>();
  draft.colors.forEach((color, colorIndex) => {
    const value = color.value.trim().toLowerCase();
    if (!value) errors[`color.${colorIndex}.value`] = 'Color option value is required.';
    else if (colorValues.has(value)) errors[`color.${colorIndex}.value`] = 'Color option values must be unique.';
    colorValues.add(value);
    if (!color.label.trim()) errors[`color.${colorIndex}.label`] = 'Color label is required.';
    if (color.swatchColor && !/^#[0-9a-f]{6}$/i.test(color.swatchColor)) errors[`color.${colorIndex}.swatchColor`] = 'Use a valid 6-digit hex color.';
    draft.placements.forEach((placement, placementIndex) => {
      const mockup = color.mockups[placement.id];
      const prefix = `mockup.${colorIndex}.${placementIndex}`;
      if (!mockup?.imageUrl.trim()) errors[`${prefix}.imageUrl`] = `${color.label || color.value || 'Color'} needs a ${placement.label || placement.id} mockup image.`;
    });
  });

  for (const variant of product.variants) {
    const valueFor = (key: string) => Object.entries(variant.options ?? {}).find(([optionKey]) => optionKey.toLowerCase() === key.toLowerCase())?.[1]?.trim();
    if (!valueFor(product.tshirt.colorOptionKey) || !valueFor(product.tshirt.sizeOptionKey)) {
      errors[`variant.${variant.id}`] = `${variant.name} needs values for the current Color and Size option keys before those keys can be migrated.`;
    }
  }
  return errors;
}

function clampArea(area: TShirtDesignArea): TShirtDesignArea {
  const width = clamp(Number(area.width), 1, 100);
  const height = clamp(Number(area.height), 1, 100);
  return { ...area, x: clamp(Number(area.x), 0, 100 - width), y: clamp(Number(area.y), 0, 100 - height), width, height };
}

function finiteAtLeast(value: number, minimum: number) {
  return Number.isFinite(Number(value)) && Number(value) >= minimum;
}

function finiteGreaterThanZero(value: number) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
