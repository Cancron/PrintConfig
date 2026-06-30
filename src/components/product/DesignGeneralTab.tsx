import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { sanitizeProductHtml } from '../../lib/frontendContent';
import type {
  FrontendLayoutStyle,
  PrecheckStatus,
  Product,
  ProductFrontendContent,
  ProductTrustBadge,
} from '../../types';

interface Props {
  product: Product;
  onSave: (product: Product) => void;
}

const yesNoOptions = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];
const precheckOptions = ['success', 'warning', 'info', 'error'].map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }));
const layoutOptions = ['standard', 'compact', 'premium'].map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }));

export function DesignGeneralTab({ product, onSave }: Props) {
  const [content, setContent] = useState<ProductFrontendContent>(() => structuredClone(product.frontendContent));
  const [htmlMode, setHtmlMode] = useState<'edit' | 'preview'>('edit');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setContent(structuredClone(product.frontendContent));
  }, [product.frontendContent]);
  const errors = useMemo(() => validateContent(content), [content]);
  const sanitizedHtml = useMemo(() => sanitizeProductHtml(content.productDetailHtml), [content.productDetailHtml]);
  const valid = Object.keys(errors).length === 0;

  function update<K extends keyof ProductFrontendContent>(key: K, value: ProductFrontendContent[K]) {
    setContent((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function updateBadge(index: number, patch: Partial<ProductTrustBadge>) {
    update('trustBadges', content.trustBadges.map((badge, badgeIndex) => badgeIndex === index ? { ...badge, ...patch, updatedAt: new Date().toISOString() } : badge));
  }

  function addBadge() {
    const now = new Date().toISOString();
    update('trustBadges', [...content.trustBadges, {
      _id: '',
      clientId: crypto.randomUUID(),
      icon: '',
      text: '',
      sortOrder: content.trustBadges.length + 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }]);
  }

  function removeBadge(index: number) {
    update('trustBadges', content.trustBadges.filter((_, badgeIndex) => badgeIndex !== index).map((badge, badgeIndex) => ({ ...badge, sortOrder: badgeIndex + 1 })));
  }

  function moveBadge(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= content.trustBadges.length) return;
    const badges = [...content.trustBadges];
    [badges[index], badges[target]] = [badges[target], badges[index]];
    update('trustBadges', badges.map((badge, badgeIndex) => ({ ...badge, sortOrder: badgeIndex + 1 })));
  }

  function save() {
    if (!valid) return;
    onSave({ ...product, frontendContent: content, updatedAt: new Date().toISOString() });
    setSaved(true);
  }

  return (
    <div className="grid grid-cols-1 gap-6 py-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h2 className="text-lg font-semibold text-gray-900">Design / General</h2><p className="mt-1 text-sm text-gray-500">Customer-facing editor text, trust content, support details, and display preferences.</p></div>
          <div className="flex items-center gap-3"><button type="button" onClick={save} disabled={!valid} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"><Check className="h-4 w-4" /> Save Content</button>{saved && <span className="text-sm font-medium text-emerald-600">Saved</span>}</div>
        </div>

        <Section title="Header / CTA Content">
          <Grid>
            <Input label="Top CTA Label" value={content.topCtaLabel} onChange={(event) => update('topCtaLabel', event.target.value)} />
            <Input label="Product Title Override" value={content.productTitleOverride} onChange={(event) => update('productTitleOverride', event.target.value)} placeholder={product.name} />
            <Input label="Review Rating" type="number" min="0" max="5" step="0.1" value={content.reviewRating} onChange={(event) => update('reviewRating', Number(event.target.value))} error={errors.reviewRating} />
            <Input label="Review Count" type="number" min="0" value={content.reviewCount} onChange={(event) => update('reviewCount', Number(event.target.value))} error={errors.reviewCount} />
            <Input label="Review Label" value={content.reviewLabel} onChange={(event) => update('reviewLabel', event.target.value)} />
            <BooleanSelect label="Show Reviews" value={content.showReviews} onChange={(value) => update('showReviews', value)} />
          </Grid>
        </Section>

        <Section title="Editor Messages and Labels">
          <Grid>
            <BooleanSelect label="Show Pre-check Message" value={content.showPrecheckMessage} onChange={(value) => update('showPrecheckMessage', value)} />
            <Select label="Pre-check Status" value={content.precheckStatus} onChange={(event) => update('precheckStatus', event.target.value as PrecheckStatus)} options={precheckOptions} />
            <Input label="Pre-check Title" value={content.precheckTitle} onChange={(event) => update('precheckTitle', event.target.value)} />
            <div className="sm:col-span-2"><Textarea label="Pre-check Message" rows={3} value={content.precheckMessage} onChange={(event) => update('precheckMessage', event.target.value)} /></div>
          </Grid>
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Input label="Resize Label" value={content.resizeLabel} onChange={(event) => update('resizeLabel', event.target.value)} />
            <Input label="Rotate Label" value={content.rotateLabel} onChange={(event) => update('rotateLabel', event.target.value)} />
            <Input label="Reset Label" value={content.resetLabel} onChange={(event) => update('resetLabel', event.target.value)} />
            <Input label="Crop Label" value={content.cropLabel} onChange={(event) => update('cropLabel', event.target.value)} />
            <Input label="Change Photo Label" value={content.changePhotoLabel} onChange={(event) => update('changePhotoLabel', event.target.value)} />
            <Input label="Preview Label" value={content.previewLabel} onChange={(event) => update('previewLabel', event.target.value)} />
          </div>
        </Section>

        <Section title="Option Section Labels">
          <Grid>
            <Input label="Size Section Label" value={content.sizeSectionLabel} onChange={(event) => update('sizeSectionLabel', event.target.value)} />
            <Input label="Show All Sizes Label" value={content.showAllSizesLabel} onChange={(event) => update('showAllSizesLabel', event.target.value)} />
          </Grid>
        </Section>

        <Section title="Quantity and Order Section">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Input label="Quantity Label" value={content.quantityLabel} onChange={(event) => update('quantityLabel', event.target.value)} />
            <Input label="Price Label" value={content.priceLabel} onChange={(event) => update('priceLabel', event.target.value)} />
            <Input label="Sale Price Label" value={content.salePriceLabel} onChange={(event) => update('salePriceLabel', event.target.value)} />
            <Input label="Savings Label" value={content.savingsLabel} onChange={(event) => update('savingsLabel', event.target.value)} />
            <Input label="Order Button Text" value={content.orderButtonText} onChange={(event) => update('orderButtonText', event.target.value)} />
            <Input label="Add Another Image Text" value={content.addAnotherImageText} onChange={(event) => update('addAnotherImageText', event.target.value)} />
          </div>
        </Section>

        <Section title="Trust Badges">
          <div className="space-y-3">
            {content.trustBadges.map((badge, index) => (
              <div key={badge._id || badge.clientId} className="grid grid-cols-[72px_minmax(0,1fr)_90px_100px_auto] items-start gap-3 border-b border-gray-200 pb-3 last:border-0 last:pb-0">
                <Input label="Icon" value={badge.icon} onChange={(event) => updateBadge(index, { icon: event.target.value })} />
                <Input label="Text" value={badge.text} onChange={(event) => updateBadge(index, { text: event.target.value })} error={errors[`trustBadges.${index}.text`]} />
                <Input label="Sort Order" type="number" value={badge.sortOrder} onChange={(event) => updateBadge(index, { sortOrder: Number(event.target.value) })} error={errors[`trustBadges.${index}.sortOrder`]} />
                <BooleanSelect label="Active" value={badge.isActive} onChange={(value) => updateBadge(index, { isActive: value })} />
                <div className="flex gap-1 pt-6">
                  <IconButton title="Move up" disabled={index === 0} onClick={() => moveBadge(index, -1)}><ArrowUp className="h-4 w-4" /></IconButton>
                  <IconButton title="Move down" disabled={index === content.trustBadges.length - 1} onClick={() => moveBadge(index, 1)}><ArrowDown className="h-4 w-4" /></IconButton>
                  <IconButton title="Delete" danger onClick={() => removeBadge(index)}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addBadge} className="mt-4 inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300"><Plus className="h-4 w-4" /> Add Badge</button>
        </Section>

        <Section title="Support Box">
          <Grid>
            <BooleanSelect label="Show Support Box" value={content.showSupportBox} onChange={(value) => update('showSupportBox', value)} />
            <Input label="Support Label" value={content.supportLabel} onChange={(event) => update('supportLabel', event.target.value)} />
            <Input label="Support Phone" value={content.supportPhone} onChange={(event) => update('supportPhone', event.target.value)} />
            <Input label="Support Email" type="email" value={content.supportEmail} onChange={(event) => update('supportEmail', event.target.value)} error={errors.supportEmail} />
            <Input label="Support Icon" value={content.supportIcon} onChange={(event) => update('supportIcon', event.target.value)} />
            <Input label="Support Message" value={content.supportMessage} onChange={(event) => update('supportMessage', event.target.value)} />
          </Grid>
        </Section>

        <Section title="Product Detail HTML Description">
          <div className="mb-4 inline-flex rounded-md ring-1 ring-gray-300">
            <button type="button" onClick={() => setHtmlMode('edit')} className={`px-3 py-2 text-sm ${htmlMode === 'edit' ? 'bg-slate-900 text-white' : 'text-gray-700'}`}>Edit HTML</button>
            <button type="button" onClick={() => setHtmlMode('preview')} className={`px-3 py-2 text-sm ${htmlMode === 'preview' ? 'bg-slate-900 text-white' : 'text-gray-700'}`}>Preview</button>
          </div>
          {htmlMode === 'edit'
            ? <Textarea rows={12} className="font-mono" value={content.productDetailHtml} onChange={(event) => update('productDetailHtml', event.target.value)} placeholder="<h2>About this product</h2>" />
            : <HtmlPreview html={sanitizedHtml} emptyText="No product detail HTML." />}
          <p className="mt-2 text-sm text-gray-500">Scripts, iframes, inline event handlers, and dangerous URLs are removed from previews and public output.</p>
        </Section>

        <Section title="Frontend Display Settings">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <BooleanSelect label="Show Top CTA" value={content.showTopCta} onChange={(value) => update('showTopCta', value)} />
            <BooleanSelect label="Show Review Block" value={content.showReviewBlock} onChange={(value) => update('showReviewBlock', value)} />
            <BooleanSelect label="Show Trust Badges" value={content.showTrustBadges} onChange={(value) => update('showTrustBadges', value)} />
            <BooleanSelect label="Show Support Box" value={content.showSupportBox} onChange={(value) => update('showSupportBox', value)} />
            <BooleanSelect label="Show Product Detail" value={content.showProductDetailDescription} onChange={(value) => update('showProductDetailDescription', value)} />
            <Select label="Frontend Layout Style" value={content.frontendLayoutStyle} onChange={(event) => update('frontendLayoutStyle', event.target.value as FrontendLayoutStyle)} options={layoutOptions} />
          </div>
        </Section>
      </div>

      <LivePreview product={product} content={content} html={sanitizedHtml} />
    </div>
  );
}

function LivePreview({ product, content, html }: { product: Product; content: ProductFrontendContent; html: string }) {
  const activeBadges = [...content.trustBadges].filter((badge) => badge.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const statusTone = content.precheckStatus === 'success' ? 'bg-emerald-50 text-emerald-800' : content.precheckStatus === 'warning' ? 'bg-amber-50 text-amber-800' : content.precheckStatus === 'error' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800';
  return (
    <aside className="h-fit space-y-5 rounded-lg bg-white p-5 ring-1 ring-gray-200 xl:sticky xl:top-6">
      <div><p className="text-sm font-semibold text-gray-900">Live Preview</p><p className="mt-1 text-xs text-gray-500">{content.frontendLayoutStyle} layout</p></div>
      <div className="space-y-4">
        {content.showTopCta && <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">{content.topCtaLabel}</span>}
        <div><h3 className="text-xl font-semibold text-gray-900">{content.productTitleOverride || product.name}</h3>{content.showReviews && content.showReviewBlock && <p className="mt-1 text-sm text-amber-600">★★★★★ <span className="text-gray-700">{content.reviewRating.toFixed(1)} · {content.reviewCount.toLocaleString()} {content.reviewLabel}</span></p>}</div>
        {content.showPrecheckMessage && <div className={`rounded-md p-3 text-sm ${statusTone}`}><p className="font-semibold">{content.precheckTitle}</p><p className="mt-1">{content.precheckMessage}</p></div>}
        <div className="flex flex-wrap gap-2">{[content.resizeLabel, content.rotateLabel, content.resetLabel, content.cropLabel, content.changePhotoLabel, content.previewLabel].map((label) => <span key={label} className="rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-700 ring-1 ring-gray-200">{label}</span>)}</div>
        <button type="button" className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white">{content.orderButtonText}</button>
        {content.showTrustBadges && activeBadges.length > 0 && <div className="flex flex-wrap gap-x-3 gap-y-2 border-y border-gray-200 py-3">{activeBadges.map((badge) => <span key={badge._id || badge.clientId} className="text-xs text-gray-700">{badge.icon} {badge.text}</span>)}</div>}
        {content.showSupportBox && <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-900"><p className="font-semibold">{content.supportIcon} {content.supportLabel}</p><p className="mt-1">{content.supportPhone}</p>{content.supportEmail && <p>{content.supportEmail}</p>}{content.supportMessage && <p className="mt-1">{content.supportMessage}</p>}</div>}
        {content.showProductDetailDescription && <HtmlPreview html={html} emptyText="Product description preview" />}
      </div>
    </aside>
  );
}

function validateContent(content: ProductFrontendContent) {
  const errors: Record<string, string> = {};
  if (!Number.isFinite(content.reviewRating) || content.reviewRating < 0 || content.reviewRating > 5) errors.reviewRating = 'Use a rating between 0 and 5.';
  if (!Number.isFinite(content.reviewCount) || content.reviewCount < 0) errors.reviewCount = 'Review count must be zero or greater.';
  if (content.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.supportEmail)) errors.supportEmail = 'Enter a valid email address.';
  content.trustBadges.forEach((badge, index) => {
    if (!badge.text.trim()) errors[`trustBadges.${index}.text`] = 'Badge text is required.';
    if (!Number.isFinite(Number(badge.sortOrder))) errors[`trustBadges.${index}.sortOrder`] = 'Sort order must be numeric.';
  });
  return errors;
}

function BooleanSelect({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <Select label={label} value={value ? 'yes' : 'no'} onChange={(event) => onChange(event.target.value === 'yes')} options={yesNoOptions} />;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-lg bg-white p-5 ring-1 ring-gray-200"><h3 className="mb-4 text-sm font-semibold text-gray-900">{title}</h3>{children}</section>; }
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>; }
function IconButton({ title, disabled, danger, onClick, children }: { title: string; disabled?: boolean; danger?: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" title={title} disabled={disabled} onClick={onClick} className={`rounded-md p-2 disabled:opacity-30 ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-500 hover:bg-gray-100'}`}>{children}</button>; }
function HtmlPreview({ html, emptyText }: { html: string; emptyText: string }) { return html ? <div className="prose prose-sm max-w-none rounded-md bg-white p-4 ring-1 ring-gray-200" dangerouslySetInnerHTML={{ __html: html }} /> : <div className="rounded-md bg-gray-50 p-4 text-sm text-gray-500 ring-1 ring-gray-200">{emptyText}</div>; }
