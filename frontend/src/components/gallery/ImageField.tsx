import { useState } from "react";
import { Images, X } from "lucide-react";
import { ImagePicker } from "./ImagePicker";
import type { ImagePickerValue } from "../../types";

export function ImageField({ label, url, assetId, onChange, error, placeholder = 'https://...' }: { label: string; url: string; assetId?: string; onChange: (url: string, assetId?: string) => void; error?: string; placeholder?: string }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  function selected(value: ImagePickerValue) {
    onChange(value.url, value.assetId);
    setPickerOpen(false);
  }
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => onChange(e.target.value, undefined)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-md border-0 px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-slate-600"
        />
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
        >
          <Images className="h-4 w-4" /> Choose from Library
        </button>
      </div>
      {assetId && <p className="text-xs text-blue-700">Linked library asset</p>}
      {url && (
        <div className="relative w-fit">
          <img
            src={url}
            alt=""
            className="h-20 w-28 rounded object-cover bg-gray-100 ring-1 ring-gray-200"
          />
          <button
            type="button"
            onClick={() => onChange("", undefined)}
            title="Clear image"
            className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-gray-600 shadow ring-1 ring-gray-200"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {pickerOpen && (
        <ImagePicker onSelect={selected} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}
