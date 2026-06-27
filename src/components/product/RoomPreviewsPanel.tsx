import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Image, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ImageField } from '../gallery/ImageField';
import { calculateRoomPreviewSize, getDefaultRoomPreviewPlacement, getOverlayStyle, roomPreviewKey, validateRoomPreview } from '../../lib/roomPreview';
import type { Product, ProductVariant, VariantRoomPreview } from '../../types';

interface Props {
  product: Product;
  variant?: ProductVariant;
  onSave: (product: Product) => void;
}

const yesNoOptions = [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }];

export function RoomPreviewsPanel({ product, variant, onSave }: Props) {
  const rooms = useMemo(() => [...(variant?.roomPreviews ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [variant]);
  const [form, setForm] = useState<VariantRoomPreview | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editorRoom, setEditorRoom] = useState<VariantRoomPreview | null>(null);
  const [copyTargetId, setCopyTargetId] = useState('');
  const [selectedRoomKey, setSelectedRoomKey] = useState('');
  const selectedRoom = rooms.find((room) => roomPreviewKey(room) === selectedRoomKey) ?? rooms[0];
  const errors = useMemo(() => form ? validateRoomPreview(form) : {}, [form]);

  function persistRooms(nextRooms: VariantRoomPreview[], targetVariantId = variant?._id) {
    if (!targetVariantId) return;
    const variants = product.variants.map((item) => item._id === targetVariantId ? { ...item, roomPreviews: nextRooms } : item);
    onSave({ ...product, variants, updatedAt: new Date().toISOString() });
  }

  function startAdd() {
    if (!variant) return;
    const now = new Date().toISOString();
    setEditingKey(null);
    setForm({
      _id: '', clientId: crypto.randomUUID(), variantId: variant._id, name: '', roomImageUrl: '', roomWidthMeters: 4,
      roomHeightMeters: undefined, ...getDefaultRoomPreviewPlacement(), isDefault: false, sortOrder: rooms.length,
      createdAt: now, updatedAt: now,
    });
  }

  function startEdit(room: VariantRoomPreview) {
    setEditingKey(roomPreviewKey(room));
    setForm({ ...room });
  }

  function saveForm() {
    if (!form || Object.keys(errors).length > 0) return;
    const now = new Date().toISOString();
    const saved = { ...form, name: form.name.trim(), roomImageUrl: form.roomImageUrl.trim(), updatedAt: now };
    let next = editingKey ? rooms.map((room) => roomPreviewKey(room) === editingKey ? saved : room) : [...rooms, saved];
    if (saved.isDefault) next = next.map((room) => ({ ...room, isDefault: roomPreviewKey(room) === roomPreviewKey(saved) }));
    persistRooms(next);
    setForm(null);
    setEditingKey(null);
  }

  function remove(room: VariantRoomPreview) {
    if (confirm('Delete this room preview?')) persistRooms(rooms.filter((item) => roomPreviewKey(item) !== roomPreviewKey(room)));
  }

  function duplicate(room: VariantRoomPreview) {
    const now = new Date().toISOString();
    persistRooms([...rooms, { ...room, _id: '', clientId: crypto.randomUUID(), variantId: variant?._id ?? '', name: `${room.name} Copy`, isDefault: false, sortOrder: rooms.length, createdAt: now, updatedAt: now }]);
  }

  function setDefault(room: VariantRoomPreview) {
    persistRooms(rooms.map((item) => ({ ...item, isDefault: roomPreviewKey(item) === roomPreviewKey(room) })));
  }

  function copyToVariant(room: VariantRoomPreview) {
    const target = product.variants.find((item) => item._id === copyTargetId);
    if (!target) return;
    const now = new Date().toISOString();
    const copy = { ...room, _id: '', clientId: crypto.randomUUID(), variantId: target._id, name: `${room.name} Copy`, isDefault: false, sortOrder: target.roomPreviews.length, createdAt: now, updatedAt: now };
    const variants = product.variants.map((item) => item._id === target._id ? { ...item, roomPreviews: [...item.roomPreviews, copy] } : item);
    onSave({ ...product, variants, updatedAt: now });
    setCopyTargetId('');
  }

  function saveEditorSettings(room: VariantRoomPreview) {
    persistRooms(rooms.map((item) => roomPreviewKey(item) === roomPreviewKey(room) ? { ...room, updatedAt: new Date().toISOString() } : item));
    setEditorRoom(null);
  }

  return (
    <section className="border-t border-gray-200 pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h3 className="text-base font-semibold text-gray-900">Real World Room Preview</h3><p className="mt-1 text-sm text-gray-500">Place this variant at a physical scale inside room images.</p></div>
        <button type="button" onClick={startAdd} disabled={!variant} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"><Plus className="h-4 w-4" /> Add Room Preview</button>
      </div>

      {!variant && <Warning>No variant selected.</Warning>}
      {variant && rooms.length === 0 && <Warning>Selected variant has no room previews.</Warning>}

      {variant && rooms.length > 0 && <div className="mt-4 overflow-x-auto rounded-md ring-1 ring-gray-200"><table className="min-w-full divide-y divide-gray-200 text-sm"><thead className="bg-gray-50"><tr><Header>Preview</Header><Header>Room width</Header><Header>Order</Header><Header>Status</Header><Header><span className="sr-only">Actions</span></Header></tr></thead><tbody className="divide-y divide-gray-200 bg-white">{rooms.map((room) => <tr key={roomPreviewKey(room)}><td className="px-4 py-3"><button type="button" onClick={() => setSelectedRoomKey(roomPreviewKey(room))} className={`flex items-center gap-3 text-left ${roomPreviewKey(selectedRoom ?? room) === roomPreviewKey(room) ? 'text-slate-900' : 'text-gray-700'}`}><span className={`h-3 w-3 rounded-full ring-1 ${roomPreviewKey(selectedRoom ?? room) === roomPreviewKey(room) ? 'bg-slate-900 ring-slate-900' : 'bg-white ring-gray-400'}`} /><img src={room.roomImageUrl} alt="" className="h-12 w-20 rounded object-cover bg-gray-100" /><span className="font-medium">{room.name}</span></button></td><td className="px-4 py-3 text-gray-700">{room.roomWidthMeters}m</td><td className="px-4 py-3 text-gray-700">{room.sortOrder}</td><td className="px-4 py-3">{room.isDefault && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200"><Star className="h-3 w-3" /> Default</span>}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><IconButton title="Edit" onClick={() => startEdit(room)}><Pencil className="h-4 w-4" /></IconButton><IconButton title="Duplicate" onClick={() => duplicate(room)}><Copy className="h-4 w-4" /></IconButton><IconButton title="Set as default" onClick={() => setDefault(room)}><Star className="h-4 w-4" /></IconButton><IconButton title="Open preview editor" onClick={() => setEditorRoom({ ...room })}><Image className="h-4 w-4" /></IconButton><IconButton title="Delete" onClick={() => remove(room)} danger><Trash2 className="h-4 w-4" /></IconButton></div></td></tr>)}</tbody></table></div>}

      {variant && rooms.length > 0 && product.variants.length > 1 && <div className="mt-4 flex flex-col gap-3 rounded-md bg-gray-50 p-4 ring-1 ring-gray-200 sm:flex-row sm:items-end"><Select label="Copy selected preview to variant" value={copyTargetId} onChange={(event) => setCopyTargetId(event.target.value)} options={[{ value: '', label: 'Choose target variant' }, ...product.variants.filter((item) => item._id !== variant._id).map((item) => ({ value: item._id, label: item.name }))]} /><button type="button" disabled={!copyTargetId || !selectedRoom} onClick={() => selectedRoom && copyToVariant(selectedRoom)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-100 disabled:opacity-40"><Copy className="h-4 w-4" /> Copy Room Preview</button></div>}

      {form && <RoomPreviewForm form={form} errors={errors} onChange={setForm} onSave={saveForm} onClose={() => setForm(null)} />}
      {variant && editorRoom && <RoomPreviewEditor product={product} variant={variant} room={editorRoom} onChange={setEditorRoom} onSave={saveEditorSettings} onClose={() => setEditorRoom(null)} />}
    </section>
  );
}

function RoomPreviewForm({ form, errors, onChange, onSave, onClose }: { form: VariantRoomPreview; errors: Record<string, string>; onChange: (room: VariantRoomPreview) => void; onSave: () => void; onClose: () => void }) {
  function update<K extends keyof VariantRoomPreview>(key: K, value: VariantRoomPreview[K]) { onChange({ ...form, [key]: value }); }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg bg-white shadow-xl"><div className="flex items-center justify-between border-b border-gray-200 px-5 py-4"><h3 className="text-lg font-semibold text-gray-900">{form._id ? 'Edit' : 'Add'} Room Preview</h3><IconButton title="Close" onClick={onClose}><X className="h-5 w-5" /></IconButton></div><div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2"><Input label="Preview Name" value={form.name} onChange={(e) => update('name', e.target.value)} error={errors.name} /><div className="sm:col-span-2"><ImageField label="Room Image URL" url={form.roomImageUrl} assetId={form.roomImageAssetId} onChange={(url, assetId) => onChange({ ...form, roomImageUrl: url, roomImageAssetId: assetId })} error={errors.roomImageUrl} /></div><Input label="Room Width (meters)" type="number" min="0.01" step="0.01" value={form.roomWidthMeters} onChange={(e) => update('roomWidthMeters', Number(e.target.value))} error={errors.roomWidthMeters} /><Input label="Room Height (meters, optional)" type="number" min="0.01" step="0.01" value={form.roomHeightMeters ?? ''} onChange={(e) => update('roomHeightMeters', e.target.value === '' ? undefined : Number(e.target.value))} error={errors.roomHeightMeters} /><Input label="Center Left %" type="number" min="0" max="100" value={form.centerLeftPercent} onChange={(e) => update('centerLeftPercent', Number(e.target.value))} error={errors.centerLeftPercent} /><Input label="Center Top %" type="number" min="0" max="100" value={form.centerTopPercent} onChange={(e) => update('centerTopPercent', Number(e.target.value))} error={errors.centerTopPercent} /><Input label="Zoom" type="number" min="0.25" max="3" step="0.05" value={form.zoom} onChange={(e) => update('zoom', Number(e.target.value))} error={errors.zoom} /><Input label="Sort Order" type="number" value={form.sortOrder} onChange={(e) => update('sortOrder', Number(e.target.value))} error={errors.sortOrder} /><Select label="Default Preview" value={form.isDefault ? 'yes' : 'no'} onChange={(e) => update('isDefault', e.target.value === 'yes')} options={yesNoOptions} /></div><div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4"><button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300">Cancel</button><button type="button" onClick={onSave} disabled={Object.keys(errors).length > 0} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300">Save Room Preview</button></div></div></div>;
}

function RoomPreviewEditor({ product, variant, room, onChange, onSave, onClose }: { product: Product; variant: ProductVariant; room: VariantRoomPreview; onChange: (room: VariantRoomPreview) => void; onSave: (room: VariantRoomPreview) => void; onClose: () => void }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageMetrics, setImageMetrics] = useState({ displayedWidth: 0, displayedHeight: 0, naturalWidth: 0, naturalHeight: 0 });
  const size = calculateRoomPreviewSize(variant, room);
  const style = getOverlayStyle(variant, room, imageMetrics.displayedWidth, imageMetrics.displayedHeight);
  const imageUrl = variant.previewImageUrl || product.thumbnailUrl;

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setImageMetrics({ displayedWidth: 0, displayedHeight: 0, naturalWidth: 0, naturalHeight: 0 });
  }, [room.roomImageUrl]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image || !imageLoaded) return;
    const measure = () => {
      const rect = image.getBoundingClientRect();
      setImageMetrics({ displayedWidth: rect.width, displayedHeight: rect.height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(image);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [imageLoaded]);

  function handleImageLoad() {
    setImageLoaded(true);
    setImageError(false);
    window.requestAnimationFrame(() => {
      const image = imageRef.current;
      if (!image) return;
      const rect = image.getBoundingClientRect();
      setImageMetrics({ displayedWidth: rect.width, displayedHeight: rect.height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight });
    });
  }

  function pointerPercent(event: React.PointerEvent) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    const point = pointerPercent(event);
    if (!point) return;
    dragOffset.current = { x: point.x - room.centerLeftPercent, y: point.y - room.centerTopPercent };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function drag(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const point = pointerPercent(event);
    if (!point) return;
    onChange({ ...room, centerLeftPercent: clamp(point.x - dragOffset.current.x, 0, 100), centerTopPercent: clamp(point.y - dragOffset.current.y, 0, 100) });
  }

  const orientation = imageMetrics.naturalWidth === imageMetrics.naturalHeight ? 'Square' : imageMetrics.naturalWidth > imageMetrics.naturalHeight ? 'Landscape' : 'Portrait';
  const variantAspectRatio = variant.height > 0 ? variant.width / variant.height : 0;
  const overlayShape = variant.width === variant.height ? 'Square' : variant.width > variant.height ? 'Landscape' : 'Portrait';
  const canRenderOverlay = imageLoaded && !imageError && imageMetrics.displayedWidth > 0 && imageMetrics.displayedHeight > 0 && !!style;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black/60 p-4">
      <div className="mx-auto w-full max-w-6xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div><h3 className="text-lg font-semibold text-gray-900">{room.name}</h3><p className="text-sm text-gray-500">Drag the product to position it in the room.</p></div>
          <IconButton title="Close" onClick={onClose}><X className="h-5 w-5" /></IconButton>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="relative flex h-auto min-h-64 max-h-[70vh] w-full items-center justify-center overflow-hidden rounded-md bg-slate-50 p-2 ring-1 ring-gray-300">
            {!room.roomImageUrl && <p className="py-24 text-sm text-gray-500">Room image URL is missing.</p>}
            {room.roomImageUrl && !imageLoaded && !imageError && <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50 text-sm text-gray-500">Loading room image...</div>}
            {imageError && <p className="py-24 text-sm text-red-600">The room image could not be loaded.</p>}
            {room.roomImageUrl && !imageError && (
              <div ref={wrapperRef} className="relative inline-block max-h-[70vh] max-w-full overflow-hidden leading-none">
                <img ref={imageRef} src={room.roomImageUrl} alt={room.name} onLoad={handleImageLoad} onError={() => { setImageError(true); setImageLoaded(false); }} className="block h-auto max-h-[70vh] w-auto max-w-full object-contain" />
                {canRenderOverlay && (
                  <div onPointerDown={startDrag} onPointerMove={drag} style={style ?? undefined} className="absolute box-border flex min-h-0 min-w-0 touch-none cursor-grab select-none items-center justify-center overflow-hidden border-2 border-slate-900/90 bg-white text-center text-slate-900/90 shadow-xl active:cursor-grabbing">
                    {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                    <div className="relative p-2 text-xs">
                      <strong className="block">{product.name}</strong>
                      <span>{variant.name}</span>
                      {/* <span className="block">{variant.width} x {variant.height} {variant.unit}</span>
                      <span className="block">{variant.dpi} DPI</span> */}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <aside className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700">Zoom: {room.zoom.toFixed(2)}x</label><input type="range" min="0.25" max="3" step="0.05" value={room.zoom} onChange={(e) => onChange({ ...room, zoom: Number(e.target.value) })} className="mt-2 w-full accent-slate-900" /></div>
            {variant.unit === 'px' && <Warning>This variant uses px unit, so real-world scaling cannot be calculated. Please use inch or mm for real-world preview.</Warning>}
            {!room.roomImageUrl && <Warning>Room image URL is missing.</Warning>}
            {!room.roomWidthMeters && <Warning>Room width is missing.</Warning>}
            {(!variant.width || !variant.height) && <Warning>Variant width or height is missing.</Warning>}
            {!variant.unit && <Warning>Variant unit is missing.</Warning>}
            {!variant.dpi && <Warning>Variant DPI is missing.</Warning>}
            <dl className="space-y-2 text-sm">
              <Row label="Image orientation" value={imageLoaded ? orientation : 'Loading'} />
              <Row label="Natural image size" value={imageLoaded ? `${imageMetrics.naturalWidth} x ${imageMetrics.naturalHeight}px` : 'Unavailable'} />
              <Row label="Displayed image size" value={imageLoaded ? `${Math.round(imageMetrics.displayedWidth)} x ${Math.round(imageMetrics.displayedHeight)}px` : 'Unavailable'} />
              <Row label="Variant aspect ratio" value={variantAspectRatio > 0 ? variantAspectRatio.toFixed(2) : 'Unavailable'} />
              <Row label="Overlay calculated size" value={size ? `${size.widthPercent.toFixed(2)}% x ${size.heightPercent.toFixed(2)}%` : 'Unavailable'} />
              <Row label="Overlay expected shape" value={overlayShape} />
              <Row label="Room width" value={`${room.roomWidthMeters}m`} />
              <Row label="Variant physical size" value={size ? `${size.widthMeters.toFixed(3)}m x ${size.heightMeters.toFixed(3)}m` : 'Unavailable'} />
              <Row label="Preview size in image" value={size ? `${size.widthPercent.toFixed(2)}% x ${size.heightPercent.toFixed(2)}%` : 'Unavailable'} />
              <Row label="Center position" value={`${room.centerLeftPercent.toFixed(1)}%, ${room.centerTopPercent.toFixed(1)}%`} />
              <Row label="Zoom" value={`${room.zoom.toFixed(2)}x`} />
            </dl>
            <button type="button" onClick={() => onSave(room)} className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Save Preview Settings</button>
          </aside>
        </div>
      </div>
    </div>
  );
}
function Header({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{children}</th>; }
function IconButton({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) { return <button type="button" title={title} onClick={onClick} className={`rounded-md p-2 ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>{children}</button>; }
function Warning({ children }: { children: React.ReactNode }) { return <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">{children}</div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-3"><dt className="text-gray-500">{label}</dt><dd className="text-right font-medium text-gray-900">{value}</dd></div>; }
function clamp(value: number, min: number, max: number) { return Math.min(Math.max(value, min), max); }