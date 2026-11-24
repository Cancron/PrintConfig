import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, Download, ExternalLink, Eye, Loader2, RefreshCw } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Select } from '../components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '../components/ui/Table';
import { api } from '../lib/api';
import { useWorkspace } from '../hooks/useWorkspace';
import type { DesignCartItem, DesignCartItemSummary } from '../types';

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

const productTypeOptions = [
  { value: '', label: 'All product types' },
  { value: 'Canvas Print', label: 'Canvas Print' },
  { value: 'Framed Print', label: 'Framed Print' },
  { value: 'Metal Print', label: 'Metal Print' },
  { value: 'Photo Print', label: 'Photo Print' },
  { value: 'Photo Book Print', label: 'Photo Book Print' },
  { value: 'Photo Collage Print', label: 'Photo Collage Print' },
  { value: 'Pillow Print', label: 'Pillow Print' },
  { value: 'Mug Print', label: 'Mug Print' },
  { value: 'T-Shirt Print', label: 'T-Shirt Print' },
  { value: 'AI Art Generation', label: 'AI Art Generation' },
  { value: 'Art Print', label: 'Art Print' },
  { value: 'Business Card', label: 'Business Card' },
  { value: 'Sticker', label: 'Sticker' },
];

export function Orders() {
  const { account, selectedMerchantId } = useWorkspace();
  const [items, setItems] = useState<DesignCartItemSummary[]>([]);
  const [status, setStatus] = useState('ordered');
  const [printStatus, setPrintStatus] = useState('');
  const [productType, setProductType] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, pageCount: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.listDesignCartItems({ accountId: account.id, merchantId: selectedMerchantId, status, printGenerationStatus: printStatus, productType, page, pageSize })
      .then((result) => {
        setItems(result.items);
        setPagination(result.pagination);
        if (result.pagination.page !== page) setPage(result.pagination.page);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load orders.'))
      .finally(() => setLoading(false));
  }, [account.id, page, pageSize, printStatus, productType, selectedMerchantId, status]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, printStatus, productType, selectedMerchantId, status]);

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
        <Select label="Product Type" value={productType} onChange={(event) => setProductType(event.target.value)} options={productTypeOptions} />
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
              {items.map((item) => {
                const progress = getPrintProgress(item);
                return (
                <tr key={item.id}>
                  <TableCell>
                    <p className="font-medium text-gray-900">{item.orderId || 'No order yet'}</p>
                    <p className="mt-1 max-w-40 truncate text-xs text-gray-500">{item.id}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-gray-900">{item.product?.name ?? item.productId}</p>
                    <p className="text-xs text-gray-500">{item.product?.productType}</p>
                    <p className="mt-1 max-w-44 truncate text-xs text-gray-400">{item.userKey}</p>
                  </TableCell>
                  <TableCell><Badge tone={item.status === 'ordered' ? 'green' : item.status === 'abandoned' ? 'red' : 'gray'}>{item.status}</Badge></TableCell>
                  <TableCell>
                    <Badge tone={item.printGenerationStatus === 'complete' ? 'green' : item.printGenerationStatus === 'failed' ? 'red' : item.printGenerationStatus === 'processing' ? 'blue' : 'gray'}>{item.printGenerationStatus}</Badge>
                    {progress.total > 0 && <p className="mt-1 text-xs text-gray-500">{progress.completed}/{progress.total} pages</p>}
                    {item.latestJob && <p className="mt-1 text-xs text-gray-500">Attempts: {item.latestJob.attempts}</p>}
                    {item.printGenerationError && <p className="mt-1 max-w-56 text-xs text-red-600">{item.printGenerationError}</p>}
                  </TableCell>
                  <TableCell><PreviewSummary files={item.pagePreviews} totalCount={item.pagePreviewCount} /></TableCell>
                  <TableCell><PreviewSummary files={item.finalPrintFiles} totalCount={item.finalPrintCount} emptyLabel="None" moreLabel="final prints" /></TableCell>
                  <TableCell className="text-sm text-gray-500">{new Date(item.updatedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Link to={`/orders/${item.id}`} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">
                      <Eye className="h-4 w-4" /> View
                    </Link>
                  </TableCell>
                </tr>
              );})}
            </TableBody>
          </Table>
          {pagination.total > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing <span className="font-medium text-gray-900">{(pagination.page - 1) * pagination.pageSize + 1}</span> to{' '}
                <span className="font-medium text-gray-900">{Math.min(pagination.total, pagination.page * pagination.pageSize)}</span> of{' '}
                <span className="font-medium text-gray-900">{pagination.total}</span> orders
              </p>
              <div className="flex items-center gap-3">
                <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="Orders per page" className="rounded-md border-0 px-3 py-2 shadow-sm ring-1 ring-inset ring-gray-300">
                  {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} per page</option>)}
                </select>
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={pagination.page <= 1 || loading} className="rounded-md px-3 py-2 font-medium ring-1 ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300">Previous</button>
                <span className="min-w-24 text-center">Page {pagination.page} of {pagination.pageCount}</span>
                <button type="button" onClick={() => setPage((current) => Math.min(pagination.pageCount, current + 1))} disabled={pagination.page >= pagination.pageCount || loading} className="rounded-md px-3 py-2 font-medium ring-1 ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<DesignCartItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [markingOrdered, setMarkingOrdered] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    api.getDesignCartItem(id)
      .then(setItem)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load order detail.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function generateFinalPrints() {
    if (!item) return;
    setProcessing(true);
    setError('');
    try {
      await api.processDesignCartItem(item.id, {
        orderId: item.orderId || item.id,
        force: item.printGenerationStatus === 'complete',
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start final print generation.');
    } finally {
      setProcessing(false);
    }
  }

  async function markAsOrdered() {
    if (!item) return;
    setMarkingOrdered(true);
    setError('');
    try {
      await api.markDesignCartItemOrdered(item.id, {
        orderId: item.orderId || item.id,
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not mark cart item as ordered.');
    } finally {
      setMarkingOrdered(false);
    }
  }

  if (loading && !item) {
    return (
      <div>
        <PageHeader title="Order Detail" description="Loading order detail..." />
        <div className="rounded-lg bg-white p-6 text-sm text-gray-500 shadow-sm ring-1 ring-gray-200">Loading...</div>
      </div>
    );
  }

  if (error && !item) {
    return (
      <div>
        <button type="button" onClick={() => navigate('/orders')} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft className="h-4 w-4" />Back to Orders</button>
        <EmptyState title="Order not found" description={error} />
      </div>
    );
  }

  if (!item) return null;

  return (
    <div>
      <button type="button" onClick={() => navigate('/orders')} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft className="h-4 w-4" />Back to Orders</button>
      <PageHeader
        title="Order Detail"
        description={`${item.orderId || 'No order yet'} - ${item.product?.name ?? item.productId}`}
        action={<button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>}
      />
      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
      <OrderDetailContent item={item} processing={processing} markingOrdered={markingOrdered} onGenerate={generateFinalPrints} onMarkOrdered={markAsOrdered} />
    </div>
  );
}

function PreviewSummary({ files, totalCount = files.length, emptyLabel = 'None', moreLabel = 'previews' }: { files: Array<{ publicUrl?: string; url?: string; filename?: string }>; totalCount?: number; emptyLabel?: string; moreLabel?: string }) {
  if (!files || files.length === 0) return <span className="text-sm text-gray-400">{emptyLabel}</span>;
  const first = files[0];
  const url = first.publicUrl || first.url || '';
  const remaining = Math.max(0, totalCount - 1);
  return (
    <div className="flex items-center gap-3">
      <a href={url} target="_blank" rel="noreferrer" className="block h-16 w-16 overflow-hidden rounded-md bg-gray-100 ring-1 ring-gray-200">
        <img src={url} alt={first.filename || 'Preview'} className="h-full w-full object-cover" />
      </a>
      <div>
        <p className="max-w-40 truncate text-xs font-medium text-gray-700">{first.filename || 'Preview 1'}</p>
        {remaining > 0 && <p className="mt-1 text-xs text-gray-500">+{remaining} {moreLabel}</p>}
      </div>
    </div>
  );
}

function getPrintProgress(item: DesignCartItem | DesignCartItemSummary) {
  const finalCount = 'finalPrintCount' in item ? item.finalPrintCount : item.finalPrintFiles?.length ?? 0;
  const previewCount = 'pagePreviewCount' in item ? item.pagePreviewCount : item.pagePreviews?.length ?? 0;
  const total = item.printGenerationTotalPages || (item.printGenerationStatus === 'complete' && finalCount > 0 ? finalCount : Math.max(finalCount, previewCount));
  const completed = item.printGenerationCompletedPages || finalCount;
  return { completed, total };
}

function OrderDetailContent({ item, processing, markingOrdered, onGenerate, onMarkOrdered }: { item: DesignCartItem; processing: boolean; markingOrdered: boolean; onGenerate: () => void; onMarkOrdered: () => void }) {
  const progress = getPrintProgress(item);
  const [downloadingZip, setDownloadingZip] = useState(false);
  async function downloadAllPrintImages() {
    if (!item.finalPrintFiles?.length) return;
    setDownloadingZip(true);
    try {
      const result = await api.createFinalPrintsDownloadToken(item.id);
      window.location.href = result.url;
    } finally {
      setDownloadingZip(false);
    }
  }
  return (
      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="p-5">
          <div className="grid gap-4 md:grid-cols-4">
            <Info label="Cart Item" value={item.id} />
            <Info label="Project" value={item.projectId} />
            <Info label="User Key" value={item.userKey} />
            <Info label="Status" value={item.status} />
            <Info label="Generation" value={item.printGenerationStatus} />
            <Info label="Progress" value={progress.total > 0 ? `${progress.completed}/${progress.total} pages` : 'Not started'} />
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
          {item.status !== 'ordered' && (
            <button type="button" onClick={onMarkOrdered} disabled={markingOrdered} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300">
              {markingOrdered ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Mark As Ordered
            </button>
          )}
          <button type="button" onClick={downloadAllPrintImages} disabled={!item.finalPrintFiles?.length || downloadingZip} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400">
            {downloadingZip ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloadingZip ? 'Preparing ZIP...' : 'Download All Print Images'}
          </button>
          <button type="button" onClick={onGenerate} disabled={processing || item.printGenerationStatus === 'processing'} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
            {processing && <Loader2 className="h-4 w-4 animate-spin" />}
            {item.printGenerationStatus === 'complete' ? 'Regenerate Final Print Images' : 'Generate Final Print Images'}
          </button>
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
