import { useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, Plus, RefreshCw, Save, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { ImageField } from '../components/gallery/ImageField';
import { useWorkspace } from '../hooks/useWorkspace';
import { api } from '../lib/api';
import type { Merchant, MerchantStatus } from '../types';

const statusOptions = [
  { value: 'Active', label: 'Active' },
  { value: 'Draft', label: 'Draft' },
];

export function MerchantSettings() {
  const { merchants, selectedMerchant, createMerchant, updateMerchant } = useWorkspace();
  const [form, setForm] = useState<Merchant | undefined>(() => selectedMerchant);
  const [createOpen, setCreateOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [revealedApiKey, setRevealedApiKey] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [rotatingApiKey, setRotatingApiKey] = useState(false);

  useEffect(() => {
    setForm(selectedMerchant);
    setRevealedApiKey('');
    setApiKeyError('');
    // setSaved(false);
  }, [selectedMerchant]);

  const errors = useMemo(() => (form ? validateMerchant(form) : {}), [form]);
  const isValid = Object.keys(errors).length === 0;
  const createButton = <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> Create Merchant</button>;
  const createDialog = createOpen && <CreateMerchantDialog merchants={merchants} onSave={createMerchant} onClose={() => setCreateOpen(false)} />;

  if (!selectedMerchant || !form) return (
    <div>
      <PageHeader title="Merchant Settings" description="Manage merchant sites and customer editor branding." action={createButton} />
      <EmptyState title="No merchant yet" description="Create a merchant to configure a store for this workspace." />
      {createDialog}
    </div>
  );

  function update<K extends keyof Merchant>(field: K, value: Merchant[K]) {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form || !isValid) return;
    updateMerchant({ ...form, name: form.name.trim(), slug: form.slug.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function rotateApiKey() {
    if (!form) return;
    if (form.apiPrivateKeyLastFour && !confirm('Replace the existing API private key? The current key will stop working immediately.')) return;
    setRotatingApiKey(true);
    setApiKeyError('');
    try {
      const result = await api.rotateMerchantApiKey(form.id);
      setForm(result.merchant);
      setRevealedApiKey(result.apiPrivateKey);
    } catch (error) {
      setApiKeyError(error instanceof Error ? error.message : 'Could not generate API private key.');
    } finally {
      setRotatingApiKey(false);
    }
  }

  return (
    <div>
      <PageHeader title="Merchant Settings" description="Edit the selected merchant site and customer editor branding." action={createButton} />
      {createDialog}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-5 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Merchant Name" value={form.name} onChange={(e) => update('name', e.target.value)} error={errors.name} />
            <Input label="Slug" value={form.slug} onChange={(e) => update('slug', e.target.value)} error={errors.slug} />
            <ImageField label="Logo URL" url={form.logoUrl} assetId={form.logoAssetId} onChange={(url, assetId) => setForm((prev) => (prev ? { ...prev, logoUrl: url, logoAssetId: assetId } : prev))} />
            <Select label="Status" value={form.status} onChange={(e) => update('status', e.target.value as MerchantStatus)} options={statusOptions} />
            <ColorField label="Editor Primary Color" value={form.editorPrimaryColor} error={errors.editorPrimaryColor} onChange={(value) => update('editorPrimaryColor', value)} />
            <ColorField label="Editor Secondary Color" value={form.editorSecondaryColor} error={errors.editorSecondaryColor} onChange={(value) => update('editorSecondaryColor', value)} />
            <ColorField label="Editor Accent Color" value={form.editorAccentColor} error={errors.editorAccentColor} onChange={(value) => update('editorAccentColor', value)} />
          </div>

          <section className="space-y-3 border-t border-gray-200 pt-5">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><KeyRound className="h-4 w-4" /> Editor API Private Key</h2>
              <p className="mt-1 text-sm text-gray-500">Authenticate product configuration requests made by this merchant's editor admin panel.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                label="Private key"
                value={revealedApiKey || (form.apiPrivateKeyLastFour ? `****************${form.apiPrivateKeyLastFour}` : 'Not configured')}
                readOnly
                className="font-mono"
              />
              <button type="button" onClick={rotateApiKey} disabled={rotatingApiKey} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${rotatingApiKey ? 'animate-spin' : ''}`} /> {form.apiPrivateKeyLastFour ? 'Rotate Key' : 'Generate Key'}
              </button>
              {revealedApiKey && (
                <button type="button" onClick={() => navigator.clipboard.writeText(revealedApiKey)} title="Copy private key" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                  <Copy className="h-4 w-4" />
                </button>
              )}
            </div>
            {revealedApiKey && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">Copy this key now. It will not be shown again after leaving this page.</p>}
            {apiKeyError && <p className="text-sm text-red-600">{apiKeyError}</p>}
            <p className="text-xs text-gray-500">Send the key in the <code className="rounded bg-gray-100 px-1 py-0.5">X-API-Key</code> header to <code className="rounded bg-gray-100 px-1 py-0.5">/api/products/editor/:productId/config</code>. Never expose it in customer-facing browser code.</p>
          </section>
          <Textarea label="Custom CSS" value={form.customCss} onChange={(e) => update('customCss', e.target.value)} rows={6} placeholder="/* Optional CSS for the future embedded editor */" />
          {/* <div>
            <Textarea label="Custom JavaScript" value={form.customJavascript} onChange={(e) => update('customJavascript', e.target.value)} rows={6} placeholder="// Stored only. Not executed in admin." />
            <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
              Custom JavaScript is stored as configuration only. It is not executed in this admin app and should only be used later in the embedded customer editor after sandboxing is implemented.
            </p>
          </div> */}

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

function CreateMerchantDialog({ merchants, onSave, onClose }: { merchants: Merchant[]; onSave: (input: Pick<Merchant, 'name' | 'slug' | 'status'>) => Promise<Merchant>; onClose: () => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [status, setStatus] = useState<MerchantStatus>('Active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nameError = name.trim() ? '' : 'Merchant name is required.';
  const slugError = !slug.trim()
    ? 'Slug is required.'
    : !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())
      ? 'Use lowercase letters, numbers, and hyphens only.'
      : merchants.some((merchant) => merchant.slug === slug.trim())
        ? 'This slug is already used by another merchant.'
        : '';

  function handleName(value: string) {
    setName(value);
    if (!slugEdited) setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (nameError || slugError || saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), slug: slug.trim(), status });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create merchant.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="create-merchant-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-md bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 id="create-merchant-title" className="text-lg font-semibold text-gray-900">Create Merchant</h2>
          <button type="button" title="Close" aria-label="Close" onClick={onClose} disabled={saving} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-5">
            <Input label="Merchant Name" value={name} onChange={(event) => handleName(event.target.value)} error={name ? nameError : undefined} autoFocus />
            <Input label="Slug" value={slug} onChange={(event) => { setSlug(event.target.value); setSlugEdited(true); }} error={slug ? slugError : undefined} />
            <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value as MerchantStatus)} options={statusOptions} />
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={Boolean(nameError || slugError) || saving} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">{saving ? 'Creating...' : 'Create Merchant'}</button>
          </div>
        </form>
      </div>
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
