import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Eye, Loader2, RefreshCw, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Select } from '../components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '../components/ui/Table';
import { api } from '../lib/api';
import { useWorkspace } from '../hooks/useWorkspace';
import type { DesignCartItem } from '../types';

const statusOptions = [
  { value: '', label: 'All order statuses' },
  { value: 'cart', label: 'Cart' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'abandoned', label: 'Abandoned' },
];

const printStatusOptions = [
  { value: '', label: 'All job statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'complete', label: 'Complete' },
  { value: 'failed', label: 'Failed' },
];

export function Orders() {
  const { account, selectedMerchantId } = useWorkspace();
  const [items, setItems] = useState<DesignCartItem[]>([]);
  const [status, setStatus] = useState('');
  const [printStatus, setPrintStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState<DesignCartItem | null>(null);
  const [processingId, setProcessingId] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.listDesignCartItems({ accountId: account._id, merchantId: selectedMerchantId, status, printGenerationStatus: printStatus, limit: 200 })
      .then(setItems)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load orders.'))
      .finally(() => setLoading(false));
  }, [account._id, printStatus, selectedMerchantId, status]);

  useEffect(() => { load(); }, [load]);

  async function generateFinalPrints(item: DesignCartItem) {
    setProcessingId(item._id);
    setError('');
    try {
      await api.processDesignCartItem(item._id, {
        orderId: item.orderId || item._id,
        force: item.printGenerationStatus === 'complete',
      });
      await load();
      setSelectedItem((current) => current ? { ...current, printGenerationStatus: 'processing' } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start final print generation.');
    } finally {
      setProcessingId('');
    }
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Design cart items, generation jobs, and final print files."
        action={<button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>}
      />
      <div className="mb-4 grid gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:grid-cols-2 lg:grid-cols-4">
        <Select label="Order Status" value={status} onChange={(event) => setStatus(event.target.value)} options={statusOptions} />
        <Select label="Generation Status" value={printStatus} onChange={(event) => setPrintStatus(event.target.value)} options={printStatusOptions} />
      </div>
      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
      {items.length === 0 && !loading ? <EmptyState title="No orders found" description="Saved cart designs and processed jobs will appear here." /> : (
        <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <Table>
            <TableHead>
              <TableHeader>Order</TableHeader>
              <TableHeader>Product</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Job</TableHeader>
              <TableHeader>Previews</TableHeader>
              <TableHeader>Final Prints</TableHeader>
              <TableHeader>Updated</TableHeader>
              <TableHeader>Action</TableHeader>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <tr key={item._id}>
                  <TableCell>
                    <p className="font-medium text-gray-900">{item.orderId || 'No order yet'}</p>
                    <p className="mt-1 max-w-40 truncate text-xs text-gray-500">{item._id}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-gray-900">{item.product?.name ?? item.productId}</p>
                    <p className="text-xs text-gray-500">{item.product?.productType}</p>
                    <p className="mt-1 max-w-44 truncate text-xs text-gray-400">{item.userKey}</p>
                  </TableCell>
                  <TableCell><Badge tone={item.status === 'ordered' ? 'green' : item.status === 'abandoned' ? 'red' : 'gray'}>{item.status}</Badge></TableCell>
                  <TableCell>
                    <Badge tone={item.printGenerationStatus === 'complete' ? 'green' : item.printGenerationStatus === 'failed' ? 'red' : item.printGenerationStatus === 'processing' ? 'blue' : 'gray'}>{item.printGenerationStatus}</Badge>
                    {item.latestJob && <p className="mt-1 text-xs text-gray-500">Attempts: {item.latestJob.attempts}</p>}
                    {item.printGenerationError && <p className="mt-1 max-w-56 text-xs text-red-600">{item.printGenerationError}</p>}
                  </TableCell>
                  <TableCell><PreviewSummary files={item.pagePreviews} /></TableCell>
                  <TableCell><FileLinks files={item.finalPrintFiles} /></TableCell>
                  <TableCell className="text-sm text-gray-500">{new Date(item.updatedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <button type="button" onClick={() => setSelectedItem(item)} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">
                      <Eye className="h-4 w-4" /> View
                    </button>
                  </TableCell>
                </tr>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {selectedItem && (
        <OrderDetailModal
          item={selectedItem}
          processing={processingId === selectedItem._id}
          onClose={() => setSelectedItem(null)}
          onGenerate={() => generateFinalPrints(selectedItem)}
        />
      )}
    </div>
  );
}

function PreviewSummary({ files }: { files: Array<{ publicUrl?: string; url?: string; filename?: string }> }) {
  if (!files || files.length === 0) return <span className="text-sm text-gray-400">None</span>;
  const first = files[0];
  const url = first.publicUrl || first.url || '';
  const remaining = files.length - 1;
  return (
    <div className="flex items-center gap-3">
      <a href={url} target="_blank" rel="noreferrer" className="block h-16 w-16 overflow-hidden rounded-md bg-gray-100 ring-1 ring-gray-200">
        <img src={url} alt={first.filename || 'Preview'} className="h-full w-full object-cover" />
      </a>
      <div>
        <p className="max-w-40 truncate text-xs font-medium text-gray-700">{first.filename || 'Preview 1'}</p>
        {remaining > 0 && <p className="mt-1 text-xs text-gray-500">+{remaining} previews</p>}
      </div>
    </div>
  );
}

function FileLinks({ files }: { files: Array<{ publicUrl?: string; url?: string; filename?: string }> }) {
  if (!files || files.length === 0) return <span className="text-sm text-gray-400">None</span>;
  return (
    <div className="flex max-w-64 flex-wrap gap-2">
      {files.map((file, index) => {
        const url = file.publicUrl || file.url || '';
        return (
          <a key={`${file.filename ?? index}-${url}`} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100">
            {file.filename || `File ${index + 1}`} <ExternalLink className="h-3 w-3" />
          </a>
        );
      })}
    </div>
  );
}

function OrderDetailModal({ item, processing, onClose, onGenerate }: { item: DesignCartItem; processing: boolean; onClose: () => void; onGenerate: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-xl ring-1 ring-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Order Detail</h2>
            <p className="mt-1 text-sm text-gray-500">{item.orderId || 'No order yet'} - {item.product?.name ?? item.productId}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">
          <div className="grid gap-4 md:grid-cols-4">
            <Info label="Cart Item" value={item._id} />
            <Info label="User Key" value={item.userKey} />
            <Info label="Status" value={item.status} />
            <Info label="Generation" value={item.printGenerationStatus} />
          </div>
          {item.printGenerationError && <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{item.printGenerationError}</div>}
          <section className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900">Page Previews</h3>
            <ImageGrid files={item.pagePreviews} />
          </section>
          <section className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900">Final Print Images</h3>
            <ImageGrid files={item.finalPrintFiles} />
          </section>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">Close</button>
          <button type="button" onClick={onGenerate} disabled={processing || item.printGenerationStatus === 'processing'} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
            {processing && <Loader2 className="h-4 w-4 animate-spin" />}
            {item.printGenerationStatus === 'complete' ? 'Regenerate Final Print Images' : 'Generate Final Print Images'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-gray-50 p-3 ring-1 ring-gray-200">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className="mt-1 truncate text-sm text-gray-900">{value || '-'}</p>
    </div>
  );
}

function ImageGrid({ files }: { files: Array<{ publicUrl?: string; url?: string; filename?: string }> }) {
  if (!files || files.length === 0) return <p className="mt-3 text-sm text-gray-400">None</p>;
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {files.map((file, index) => {
        const url = file.publicUrl || file.url || '';
        return (
          <a key={`${file.filename ?? index}-${url}`} href={url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-md bg-gray-50 ring-1 ring-gray-200 hover:ring-slate-400">
            <div className="aspect-square bg-gray-100">
              <img src={url} alt={file.filename || `File ${index + 1}`} className="h-full w-full object-cover" />
            </div>
            <div className="flex items-center gap-1 px-2 py-2 text-xs font-medium text-gray-700">
              <span className="min-w-0 flex-1 truncate">{file.filename || `File ${index + 1}`}</span>
              <ExternalLink className="h-3 w-3 shrink-0 text-gray-400 group-hover:text-gray-700" />
            </div>
          </a>
        );
      })}
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'green' | 'red' | 'blue' | 'gray' }) {
  const classes = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    gray: 'bg-gray-50 text-gray-700 ring-gray-200',
  };
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${classes[tone]}`}>{children}</span>;
}
