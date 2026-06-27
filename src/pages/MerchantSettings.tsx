import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { ImageField } from '../components/gallery/ImageField';
import { useWorkspace } from '../hooks/useWorkspace';
import type { Merchant, MerchantStatus } from '../types';

const statusOptions = [
  { value: 'Active', label: 'Active' },
  { value: 'Draft', label: 'Draft' },
];

export function MerchantSettings() {
  const { selectedMerchant, updateMerchant } = useWorkspace();
  const [form, setForm] = useState<Merchant>(() => selectedMerchant);
  const [saved, setSaved] = useState(false);

  const errors = useMemo(() => validateMerchant(form), [form]);
  const isValid = Object.keys(errors).length === 0;

  if (!selectedMerchant) return <div className="text-sm text-gray-500">No merchant selected.</div>;

  function update<K extends keyof Merchant>(field: K, value: Merchant[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid) return;
    updateMerchant({ ...form, name: form.name.trim(), slug: form.slug.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <PageHeader title="Merchant Settings" description="Edit the selected merchant site and customer editor branding." />
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-5 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Merchant Name" value={form.name} onChange={(e) => update('name', e.target.value)} error={errors.name} />
            <Input label="Slug" value={form.slug} onChange={(e) => update('slug', e.target.value)} error={errors.slug} />
            <ImageField label="Logo URL" url={form.logoUrl} assetId={form.logoAssetId} onChange={(url, assetId) => setForm((prev) => ({ ...prev, logoUrl: url, logoAssetId: assetId }))} />
            <Select label="Status" value={form.status} onChange={(e) => update('status', e.target.value as MerchantStatus)} options={statusOptions} />
            <ColorField label="Editor Primary Color" value={form.editorPrimaryColor} error={errors.editorPrimaryColor} onChange={(value) => update('editorPrimaryColor', value)} />
            <ColorField label="Editor Secondary Color" value={form.editorSecondaryColor} error={errors.editorSecondaryColor} onChange={(value) => update('editorSecondaryColor', value)} />
            <ColorField label="Editor Accent Color" value={form.editorAccentColor} error={errors.editorAccentColor} onChange={(value) => update('editorAccentColor', value)} />
          </div>

          <Textarea label="Custom CSS" value={form.customCss} onChange={(e) => update('customCss', e.target.value)} rows={6} placeholder="/* Optional CSS for the future embedded editor */" />
          <div>
            <Textarea label="Custom JavaScript" value={form.customJavascript} onChange={(e) => update('customJavascript', e.target.value)} rows={6} placeholder="// Stored only. Not executed in admin." />
            <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
              Custom JavaScript is stored as configuration only. It is not executed in this admin app and should only be used later in the embedded customer editor after sandboxing is implemented.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={!isValid} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
              <Save className="h-4 w-4" /> Save Settings
            </button>
            {saved && <span className="text-sm font-medium text-emerald-600">Saved!</span>}
          </div>
        </div>

        <BrandingPreview merchant={form} />
      </form>
    </div>
  );
}

function ColorField({ label, value, error, onChange }: { label: string; value: string; error?: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <input type="color" value={isHex(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-10 w-10 rounded-md border-0 p-0 cursor-pointer" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} error={error} />
      </div>
    </div>
  );
}

function BrandingPreview({ merchant }: { merchant: Merchant }) {
  return (
    <aside className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <h2 className="text-sm font-semibold text-gray-900">Live Branding Preview</h2>
      <div className="mt-4 overflow-hidden rounded-lg ring-1 ring-gray-200" style={{ backgroundColor: merchant.editorSecondaryColor }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: merchant.editorPrimaryColor, color: '#ffffff' }}>
          <div className="flex items-center gap-2">
            {merchant.logoUrl ? <img src={merchant.logoUrl} alt="" className="h-7 w-7 rounded object-cover bg-white" /> : <div className="h-7 w-7 rounded bg-white/20" />}
            <span className="text-sm font-semibold">{merchant.name || 'Merchant Editor'}</span>
          </div>
          <span className="rounded-full px-2 py-1 text-xs" style={{ backgroundColor: merchant.editorAccentColor }}>Preview</span>
        </div>
        <div className="p-4">
          <div className="rounded-md bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: merchant.editorAccentColor }}>Design Tools</p>
            <p className="mt-2 text-sm text-gray-600">A customer editor card using this merchant's colors.</p>
            <button type="button" className="mt-4 rounded-md px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: merchant.editorAccentColor }}>Add Image</button>
          </div>
        </div>
      </div>
      {merchant.customJavascript && <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-50"><code>{merchant.customJavascript}</code></pre>}
    </aside>
  );
}

function validateMerchant(merchant: Merchant) {
  const errors: Record<string, string> = {};
  if (!merchant.name.trim()) errors.name = 'Merchant name is required.';
  if (!merchant.slug.trim()) errors.slug = 'Slug is required.';
  if (merchant.slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(merchant.slug.trim())) errors.slug = 'Use lowercase letters, numbers, and hyphens only.';
  if (!isHex(merchant.editorPrimaryColor)) errors.editorPrimaryColor = 'Use a valid hex color.';
  if (!isHex(merchant.editorSecondaryColor)) errors.editorSecondaryColor = 'Use a valid hex color.';
  if (!isHex(merchant.editorAccentColor)) errors.editorAccentColor = 'Use a valid hex color.';
  return errors;
}

function isHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}
