import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Textarea } from '../ui/Textarea';
import { api } from '../../lib/api';
import type { LayoutTemplate, ProductScope } from '../../types';

export function CollapsibleSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return <section className="rounded-lg border border-gray-200 bg-white"><button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"><span>{title}</span>{open ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}</button>{open && <div className="border-t border-gray-200 p-3">{children}</div>}</section>;
}

export function Bool({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-2 rounded-md bg-gray-50 p-2 text-xs text-gray-700"><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

export function Filter({ value, all, options, onChange }: { value: string; all: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border-0 px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-gray-300"><option value="">{all}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

export function ScopeBadge({ scope }: { scope: ProductScope }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${scope === 'shared' ? 'bg-blue-50 text-blue-700 ring-blue-600/20' : 'bg-purple-50 text-purple-700 ring-purple-600/20'}`}>{scope === 'shared' ? 'Shared' : 'Merchant Custom'}</span>;
}

export function Notice({ tone, children }: { tone: 'info' | 'warning' | 'success'; children: ReactNode }) {
  const styles = tone === 'info' ? 'bg-blue-50 text-blue-700 ring-blue-200' : tone === 'success' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200';
  return <div className={`mb-4 rounded-md p-3 text-sm ring-1 ring-inset ${styles}`}>{children}</div>;
}

export function ImportTemplateModal({ onClose, onImported }: { onClose: () => void; onImported: (template: LayoutTemplate) => void }) {
  const [json, setJson] = useState('');
  const [error, setError] = useState('');
  async function submit() {
    try {
      setError('');
      const saved = await api.importLayoutTemplate(JSON.parse(json));
      onImported(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import template JSON.');
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl ring-1 ring-gray-200">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Import Layout Template JSON
          </h2>
        </div>
        <div className="space-y-4 p-5">
          <Textarea
            label="JSON"
            value={json}
            onChange={(event) => setJson(event.target.value)}
            rows={12}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!json.trim()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
