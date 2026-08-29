import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { api } from '../../lib/api';
import { ALLOWED_IMAGE_TYPES, formatFileSize, readImageDimensions, sanitizeFilename, validateGalleryFile } from '../../lib/gallery';
import type { ImageAsset, ImageFolder, ProductScope } from '../../types';

interface Props {
  folderId: string | null;
  defaultScope?: ProductScope;
  folders: ImageFolder[];
  accountId: string;
  merchantId: string;
  onClose: () => void;
  onUploaded: (asset: ImageAsset) => void;
}

export function GalleryUploadModal({ folderId, defaultScope, folders, accountId, merchantId, onClose, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dimensions, setDimensions] = useState<{ width?: number; height?: number }>({});
  const [name, setName] = useState('');
  const [targetFolderId, setTargetFolderId] = useState(folderId ?? '');
  const [scope, setScope] = useState<ProductScope>(defaultScope ?? 'shared');
  const [altText, setAltText] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function selectFile(nextFile: File) {
    const validationError = validateGalleryFile(nextFile);
    if (validationError) { setError(validationError); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setName(nextFile.name.replace(/\.[^.]+$/, ''));
    try { setDimensions(await readImageDimensions(nextFile)); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not read image dimensions.'); }
  }

  async function upload() {
    if (!file || !name.trim()) { setError('Select a file and enter an image name.'); return; }
    setUploading(true);
    setError('');
    try {
      const metadata = {
        accountId, merchantId: scope === 'merchant' ? merchantId : null, scope,
        folderId: targetFolderId || null, name: name.trim(), filename: sanitizeFilename(file.name), originalFilename: file.name,
        mimeType: file.type, sizeBytes: file.size, width: dimensions.width, height: dimensions.height,
        altText: altText.trim(), tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      };
      onUploaded(await api.uploadImageAsset(file, metadata));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Upload failed.');
    } finally { setUploading(false); }
  }

  const compatibleFolders = folders.filter((folder) => folder.scope === scope);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4"><h2 className="text-lg font-semibold text-gray-900">Upload and Select Image</h2><button type="button" onClick={onClose} title="Close" className="rounded-md p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
        <div className="grid gap-5 p-5 sm:grid-cols-[180px_1fr]">
          <button type="button" onClick={() => inputRef.current?.click()} className="flex aspect-square items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-gray-300 bg-gray-50">{previewUrl ? <img src={previewUrl} alt="" className="h-full w-full object-cover" /> : <Upload className="h-8 w-8 text-gray-400" />}</button>
          <div className="space-y-4">
            <input ref={inputRef} type="file" accept={ALLOWED_IMAGE_TYPES.join(',')} onChange={(event) => event.target.files?.[0] && void selectFile(event.target.files[0])} className="block w-full text-sm" />
            {file && <p className="text-xs text-gray-500">{formatFileSize(file.size)} - {file.type}{dimensions.width && dimensions.height ? ` - ${dimensions.width} x ${dimensions.height}` : ''}</p>}
            <Input label="Image Name" value={name} onChange={(event) => setName(event.target.value)} />
            <Select label="Scope" value={scope} onChange={(event) => { setScope(event.target.value as ProductScope); setTargetFolderId(''); }} options={[{ value: 'shared', label: 'Shared' }, { value: 'merchant', label: 'Merchant Custom' }]} />
            <Select label="Folder" value={targetFolderId} onChange={(event) => setTargetFolderId(event.target.value)} options={[{ value: '', label: 'Image Library root' }, ...compatibleFolders.map((folder) => ({ value: folder._id, label: folder.name }))]} />
            <Input label="Alt Text" value={altText} onChange={(event) => setAltText(event.target.value)} />
            <Input label="Tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="room, canvas, modern" />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4"><button type="button" onClick={onClose} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300">Cancel</button><button type="button" onClick={upload} disabled={uploading || !file || !name.trim()} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-blue-300">{uploading && <Loader2 className="h-4 w-4 animate-spin" />}{uploading ? 'Uploading...' : 'Upload and Select'}</button></div>
      </div>
    </div>
  );
}
