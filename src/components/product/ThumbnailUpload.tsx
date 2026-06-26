import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props {
  value: string;
  onChange: (url: string) => void;
  productId: string;
}

const BUCKET = 'product-thumbnails';

export function ThumbnailUpload({ value, onChange, productId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  async function uploadFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, WebP, or GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.');
      return;
    }

    setError('');
    setUploading(true);

    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${productId}/thumbnail-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  async function handleRemove() {
    if (!value) return;
    onChange('');
    try {
      const url = new URL(value);
      const parts = url.pathname.split(`/object/public/${BUCKET}/`);
      if (parts[1]) {
        await supabase.storage.from(BUCKET).remove([parts[1]]);
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Thumbnail Image</label>

      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="Product thumbnail"
            className="h-40 w-40 rounded-lg object-cover ring-1 ring-gray-200"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 transition-colors"
            title="Remove image"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 transition-colors"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Replace image
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex h-40 w-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors ${
            dragOver
              ? 'border-slate-500 bg-slate-50'
              : 'border-gray-300 hover:border-slate-400 hover:bg-gray-50'
          }`}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6 text-gray-400" />
              <span className="text-center text-xs text-gray-500 px-2">
                Click or drag to upload
              </span>
            </>
          )}
        </div>
      )}

      {uploading && !value && (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
