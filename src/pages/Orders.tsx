import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
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

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.listDesignCartItems({ accountId: account._id, merchantId: selectedMerchantId, status, printGenerationStatus: printStatus, limit: 200 })
      .then(setItems)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load orders.'))
      .finally(() => setLoading(false));
  }, [account._id, printStatus, selectedMerchantId, status]);

  useEffect(() => { load(); }, [load]);

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
                  <TableCell><FileLinks files={item.pagePreviews} /></TableCell>
                  <TableCell><FileLinks files={item.finalPrintFiles} /></TableCell>
                  <TableCell className="text-sm text-gray-500">{new Date(item.updatedAt).toLocaleString()}</TableCell>
                </tr>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
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

function Badge({ children, tone }: { children: React.ReactNode; tone: 'green' | 'red' | 'blue' | 'gray' }) {
  const classes = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    gray: 'bg-gray-50 text-gray-700 ring-gray-200',
  };
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ${classes[tone]}`}>{children}</span>;
}
