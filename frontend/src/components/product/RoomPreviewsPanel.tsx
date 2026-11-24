import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { Input } from '../ui/Input';
import { ImageField } from '../gallery/ImageField';
import {
  ROOM_ORIENTATIONS,
  calculateSharedOverlay,
  clamp,
  createRoomPreview,
  roomPreviewKey,
  validateRoomPreview,
} from '../../lib/roomPreview';
import type { Product, ProductRoomPreview, ProductVariant, RoomOrientation } from '../../types';

interface Props {
  product: Product;
  orientation: RoomOrientation;
  variant?: ProductVariant;
  onSave: (product: Product) => void;
}

const orientationLabels: Record<RoomOrientation, string> = {
  square: 'Square',
  vertical: 'Vertical',
  horizontal: 'Horizontal',
  'pano-vertical': 'Pano Vertical',
  'pano-horizontal': 'Pano Horizontal',
};

export function RoomPreviewsPanel({ product, orientation, variant, onSave }: Props) {
  const rooms = useMemo(() => [...product.roomPreviews].filter((room) => room.orientations.includes(orientation)).sort((a, b) => a.sortOrder - b.sortOrder), [orientation, product.roomPreviews]);
  const [form, setForm] = useState<ProductRoomPreview | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const errors = useMemo(() => form ? validateRoomPreview(form) : {}, [form]);

  function startAdd() {
    const room = createRoomPreview(product._id, product.roomPreviews.length);
    room.orientations = [orientation];
    setEditingKey(null);
    setForm(room);
  }

  function startEdit(room: ProductRoomPreview) {
    setEditingKey(roomPreviewKey(room));
    setForm({ ...room, orientations: [...room.orientations], defaultOrientations: [...room.defaultOrientations] });
  }

  function saveRoom() {
    if (!form || Object.keys(errors).length > 0) return;
    const now = new Date().toISOString();
    const saved = { ...form, name: form.name.trim(), roomImageUrl: form.roomImageUrl.trim(), updatedAt: now };
    let next = editingKey
      ? product.roomPreviews.map((room) => roomPreviewKey(room) === editingKey ? saved : room)
      : [...product.roomPreviews, saved];
    if (saved.defaultOrientations.length > 0) {
      next = next.map((room) => roomPreviewKey(room) === roomPreviewKey(saved) ? room : {
        ...room,
        defaultOrientations: room.defaultOrientations.filter((item) => !saved.defaultOrientations.includes(item)),
      });
    }
    onSave({ ...product, roomPreviews: next, updatedAt: now });
    setForm(null);
    setEditingKey(null);
  }

  function duplicate(room: ProductRoomPreview) {
    const now = new Date().toISOString();
    onSave({
      ...product,
      roomPreviews: [...product.roomPreviews, {
        ...room,
        _id: '',
        clientId: crypto.randomUUID(),
        productId: product._id,
        name: `${room.name} Copy`,
        defaultOrientations: [],
        sortOrder: product.roomPreviews.length,
        createdAt: now,
        updatedAt: now,
      }],
      updatedAt: now,
    });
  }

  function remove(room: ProductRoomPreview) {
    if (!confirm(`Delete shared room preview "${room.name}"?`)) return;
    onSave({ ...product, roomPreviews: product.roomPreviews.filter((item) => roomPreviewKey(item) !== roomPreviewKey(room)), updatedAt: new Date().toISOString() });
  }

  return (
    <section className="border-t border-gray-200 pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Shared Room Previews</h3>
          <p className="mt-1 text-sm text-gray-500">Rooms are stored once on this product and filtered by orientation.</p>
        </div>
        <button type="button" onClick={startAdd} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> Add Shared Room</button>
      </div>

      <div className="mt-4 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700 ring-1 ring-gray-200">Selected orientation: <strong>{orientationLabels[orientation]}</strong></div>
      {rooms.length === 0 && <Warning>No shared room supports this orientation.</Warning>}

      {rooms.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-md ring-1 ring-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50"><tr><Header>Room</Header><Header>Orientations</Header><Header>Max region</Header><Header>Defaults</Header><Header><span className="sr-only">Actions</span></Header></tr></thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {rooms.map((room) => (
                <tr key={roomPreviewKey(room)}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><img src={room.roomImageUrl} alt="" className="h-12 w-20 rounded object-cover bg-gray-100" /><span className="font-medium text-gray-900">{room.name}</span></div></td>
                  <td className="px-4 py-3 text-gray-700"><BadgeList values={room.orientations.map((item) => orientationLabels[item])} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">{room.maxWidthPercent.toFixed(1)}% x {room.maxHeightPercent.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-gray-700"><BadgeList values={room.defaultOrientations.map((item) => orientationLabels[item])} icon /></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-1"><IconButton title="Edit" onClick={() => startEdit(room)}><Pencil className="h-4 w-4" /></IconButton><IconButton title="Duplicate" onClick={() => duplicate(room)}><Copy className="h-4 w-4" /></IconButton><IconButton title="Delete" onClick={() => remove(room)} danger><Trash2 className="h-4 w-4" /></IconButton></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && <SharedRoomModal product={product} variant={variant} room={form} errors={errors} onChange={setForm} onSave={saveRoom} onClose={() => { setForm(null); setEditingKey(null); }} />}
    </section>
  );
}

function SharedRoomModal({ product, variant, room, errors, onChange, onSave, onClose }: {
  product: Product;
  variant?: ProductVariant;
  room: ProductRoomPreview;
  errors: Record<string, string>;
  onChange: (room: ProductRoomPreview) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  function update<K extends keyof ProductRoomPreview>(key: K, value: ProductRoomPreview[K]) { onChange({ ...room, [key]: value }); }
  function toggleOrientation(value: RoomOrientation) {
    const orientations = room.orientations.includes(value) ? room.orientations.filter((item) => item !== value) : [...room.orientations, value];
    onChange({ ...room, orientations, defaultOrientations: room.defaultOrientations.filter((item) => orientations.includes(item)) });
  }
  function toggleDefault(value: RoomOrientation) {
    if (!room.orientations.includes(value)) return;
    update('defaultOrientations', room.defaultOrientations.includes(value) ? room.defaultOrientations.filter((item) => item !== value) : [...room.defaultOrientations, value]);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4"><div><h3 className="text-lg font-semibold text-gray-900">{room._id ? 'Edit' : 'Add'} Shared Room</h3><p className="mt-1 text-sm text-gray-500">Select the maximum placement rectangle directly on the room image.</p></div><IconButton title="Close" onClick={onClose}><X className="h-5 w-5" /></IconButton></div>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_380px]">
          <RectangleEditor product={product} variant={variant} room={room} onChange={onChange} />
          <aside className="space-y-5 border-l border-gray-200 p-5">
            <Input label="Preview Name" value={room.name} onChange={(event) => update('name', event.target.value)} error={errors.name} />
            <ImageField label="Room Image URL" url={room.roomImageUrl} assetId={room.roomImageAssetId} onChange={(url, assetId) => onChange({ ...room, roomImageUrl: url, roomImageAssetId: assetId })} error={errors.roomImageUrl} />
            <fieldset><legend className="text-sm font-medium text-gray-700">Supported orientations</legend><div className="mt-2 grid grid-cols-2 gap-2">{ROOM_ORIENTATIONS.map((value) => <Checkbox key={value} label={orientationLabels[value]} checked={room.orientations.includes(value)} onChange={() => toggleOrientation(value)} />)}</div>{errors.orientations && <p className="mt-1 text-sm text-red-600">{errors.orientations}</p>}</fieldset>
            <fieldset><legend className="text-sm font-medium text-gray-700">Default for orientation</legend><div className="mt-2 grid grid-cols-2 gap-2">{ROOM_ORIENTATIONS.map((value) => <Checkbox key={value} label={orientationLabels[value]} checked={room.defaultOrientations.includes(value)} disabled={!room.orientations.includes(value)} onChange={() => toggleDefault(value)} />)}</div>{errors.defaultOrientations && <p className="mt-1 text-sm text-red-600">{errors.defaultOrientations}</p>}</fieldset>
            <div className="grid grid-cols-2 gap-3"><Input label="Center X %" type="number" min="0" max="100" step="0.1" value={room.centerLeftPercent} onChange={(event) => update('centerLeftPercent', Number(event.target.value))} error={errors.centerLeftPercent} /><Input label="Center Y %" type="number" min="0" max="100" step="0.1" value={room.centerTopPercent} onChange={(event) => update('centerTopPercent', Number(event.target.value))} error={errors.centerTopPercent} /><Input label="Max Width %" type="number" min="1" max="100" step="0.1" value={room.maxWidthPercent} onChange={(event) => update('maxWidthPercent', Number(event.target.value))} error={errors.maxWidthPercent} /><Input label="Max Height %" type="number" min="1" max="100" step="0.1" value={room.maxHeightPercent} onChange={(event) => update('maxHeightPercent', Number(event.target.value))} error={errors.maxHeightPercent} /></div>
            <Input label="Sort Order" type="number" value={room.sortOrder} onChange={(event) => update('sortOrder', Number(event.target.value))} error={errors.sortOrder} />
          </aside>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4"><button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300">Cancel</button><button type="button" onClick={onSave} disabled={Object.keys(errors).length > 0} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300">Save Shared Room</button></div>
      </div>
    </div>
  );
}

type Interaction = { type: 'draw' | 'move' | 'resize'; startX: number; startY: number; initial: ProductRoomPreview; corner?: 'nw' | 'ne' | 'sw' | 'se' };

function RectangleEditor({ product, variant, room, onChange }: { product: Product; variant?: ProductVariant; room: ProductRoomPreview; onChange: (room: ProductRoomPreview) => void }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const interaction = useRef<Interaction | null>(null);
  const [metrics, setMetrics] = useState({ width: 0, height: 0 });
  const overlay = variant ? calculateSharedOverlay(variant, room, product.variants, metrics.width, metrics.height) : null;
  const previewUrl = variant?.previewImageUrl || variant?.thumbnailImageUrl || product.thumbnailUrl;

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const update = () => { const rect = wrapper.getBoundingClientRect(); setMetrics({ width: rect.width, height: rect.height }); };
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    update();
    return () => observer.disconnect();
  }, [room.roomImageUrl]);

  function point(event: React.PointerEvent) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return null;
    return { x: clamp((event.clientX - rect.left) / rect.width * 100, 0, 100), y: clamp((event.clientY - rect.top) / rect.height * 100, 0, 100) };
  }
  function capture(event: React.PointerEvent, next: Interaction) { interaction.current = next; wrapperRef.current?.setPointerCapture(event.pointerId); }
  function startDraw(event: React.PointerEvent<HTMLDivElement>) { if (event.target !== event.currentTarget && event.target !== wrapperRef.current?.querySelector('img')) return; const p = point(event); if (p) capture(event, { type: 'draw', startX: p.x, startY: p.y, initial: room }); }
  function startMove(event: React.PointerEvent) { event.stopPropagation(); const p = point(event); if (p) capture(event, { type: 'move', startX: p.x, startY: p.y, initial: room }); }
  function startResize(event: React.PointerEvent, corner: Interaction['corner']) { event.stopPropagation(); const p = point(event); if (p) capture(event, { type: 'resize', corner, startX: p.x, startY: p.y, initial: room }); }
  function move(event: React.PointerEvent<HTMLDivElement>) {
    const active = interaction.current; const p = point(event); if (!active || !p) return;
    if (active.type === 'draw') {
      const left = Math.min(active.startX, p.x); const right = Math.max(active.startX, p.x); const top = Math.min(active.startY, p.y); const bottom = Math.max(active.startY, p.y);
      onChange({ ...room, centerLeftPercent: (left + right) / 2, centerTopPercent: (top + bottom) / 2, maxWidthPercent: Math.max(1, right - left), maxHeightPercent: Math.max(1, bottom - top) });
      return;
    }
    if (active.type === 'move') {
      const halfW = active.initial.maxWidthPercent / 2; const halfH = active.initial.maxHeightPercent / 2;
      onChange({ ...room, centerLeftPercent: clamp(active.initial.centerLeftPercent + p.x - active.startX, halfW, 100 - halfW), centerTopPercent: clamp(active.initial.centerTopPercent + p.y - active.startY, halfH, 100 - halfH) });
      return;
    }
    const initialLeft = active.initial.centerLeftPercent - active.initial.maxWidthPercent / 2;
    const initialRight = active.initial.centerLeftPercent + active.initial.maxWidthPercent / 2;
    const initialTop = active.initial.centerTopPercent - active.initial.maxHeightPercent / 2;
    const initialBottom = active.initial.centerTopPercent + active.initial.maxHeightPercent / 2;
    const left = active.corner?.includes('w') ? clamp(p.x, 0, initialRight - 1) : initialLeft;
    const right = active.corner?.includes('e') ? clamp(p.x, initialLeft + 1, 100) : initialRight;
    const top = active.corner?.includes('n') ? clamp(p.y, 0, initialBottom - 1) : initialTop;
    const bottom = active.corner?.includes('s') ? clamp(p.y, initialTop + 1, 100) : initialBottom;
    onChange({ ...room, centerLeftPercent: (left + right) / 2, centerTopPercent: (top + bottom) / 2, maxWidthPercent: right - left, maxHeightPercent: bottom - top });
  }
  function end(event: React.PointerEvent<HTMLDivElement>) { interaction.current = null; if (wrapperRef.current?.hasPointerCapture(event.pointerId)) wrapperRef.current.releasePointerCapture(event.pointerId); }

  const rectangleStyle = { left: `${room.centerLeftPercent - room.maxWidthPercent / 2}%`, top: `${room.centerTopPercent - room.maxHeightPercent / 2}%`, width: `${room.maxWidthPercent}%`, height: `${room.maxHeightPercent}%` };
  return (
    <div className="flex min-h-[420px] items-center justify-center overflow-hidden bg-slate-50 p-5">
      {!room.roomImageUrl ? <p className="text-sm text-gray-500">Choose a room image to select its placement region.</p> : (
        <div ref={wrapperRef} onPointerDown={startDraw} onPointerMove={move} onPointerUp={end} onPointerCancel={end} className="relative inline-block max-h-[70vh] max-w-full touch-none select-none">
          <img src={room.roomImageUrl} alt="" className="block h-auto max-h-[70vh] w-auto max-w-full object-contain" />
          <div onPointerDown={startMove} className="absolute cursor-move border-2 border-cyan-500 bg-cyan-400/10" style={rectangleStyle}>
            {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => <button key={corner} type="button" aria-label={`Resize ${corner}`} onPointerDown={(event) => startResize(event, corner)} className={`absolute h-3 w-3 rounded-full border border-white bg-cyan-600 ${corner === 'nw' ? '-left-1.5 -top-1.5 cursor-nwse-resize' : corner === 'ne' ? '-right-1.5 -top-1.5 cursor-nesw-resize' : corner === 'sw' ? '-bottom-1.5 -left-1.5 cursor-nesw-resize' : '-bottom-1.5 -right-1.5 cursor-nwse-resize'}`} />)}
          </div>
          {overlay && <div className="pointer-events-none absolute box-border flex items-center justify-center overflow-hidden border-2 border-emerald-500 bg-white/75 shadow" style={overlay.style}>{previewUrl ? <img src={previewUrl} alt="" className="h-full w-full object-cover" /> : <span className="truncate px-1 text-[10px] font-semibold text-gray-700">{variant?.name}</span>}</div>}
        </div>
      )}
    </div>
  );
}

function Checkbox({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: () => void }) { return <label className={`flex items-center gap-2 text-sm ${disabled ? 'text-gray-400' : 'text-gray-700'}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="h-4 w-4 rounded border-gray-300" />{label}</label>; }
function BadgeList({ values, icon }: { values: string[]; icon?: boolean }) { return values.length ? <div className="flex flex-wrap gap-1">{values.map((value) => <span key={value} className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs ring-1 ring-gray-200">{icon && <Star className="h-3 w-3 text-amber-500" />}{value}</span>)}</div> : <span className="text-gray-400">None</span>; }
function Header({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{children}</th>; }
function Warning({ children }: { children: React.ReactNode }) { return <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">{children}</div>; }
function IconButton({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) { return <button type="button" title={title} onClick={onClick} className={`rounded-md p-2 ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-500 hover:bg-gray-100'}`}>{children}</button>; }
