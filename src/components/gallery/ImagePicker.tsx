import { useMemo, useState } from 'react';
import { ArrowLeft, Folder, Grid2X2, Image as ImageIcon, List, Loader2, Search, X } from 'lucide-react';
import { useImageLibrary } from '../../hooks/useImageLibrary';
import type { ImageAsset, ImagePickerValue } from '../../types';

export function ImagePicker({ onSelect, onClose }: { onSelect: (value: ImagePickerValue) => void; onClose: () => void }) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [foldersFirst, setFoldersFirst] = useState(true);
  const [selected, setSelected] = useState<ImageAsset | null>(null);
  const library = useImageLibrary(folderId, search);
  const currentFolder = library.allFolders.find((folder) => folder._id === folderId);
  const items = useMemo(() => {
    const result = [...library.folders.map((value) => ({ kind: 'folder' as const, value })), ...library.assets.map((value) => ({ kind: 'asset' as const, value }))];
    return result.sort((a, b) => foldersFirst && a.kind !== b.kind ? (a.kind === 'folder' ? -1 : 1) : a.value.name.localeCompare(b.value.name));
  }, [foldersFirst, library.assets, library.folders]);

  function choose(asset: ImageAsset) {
    onSelect({
      assetId: asset._id,
      url: asset.url,
      thumbnailUrl: asset.thumbnailUrl,
      name: asset.name,
      altText: asset.altText,
      storagePath: asset.storagePath,
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Choose from Image Library
            </h2>
            <p className="text-sm text-gray-500">
              {currentFolder?.name ?? "Image Library"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center">
          <button
            onClick={() => {
              setFolderId(currentFolder?.parentFolderId ?? null);
              setSelected(null);
            }}
            disabled={!folderId}
            title="Back"
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search images and folders"
              className="w-full rounded-md border-0 py-2 pl-9 pr-3 text-sm ring-1 ring-gray-300"
            />
          </div>
          <div className="inline-flex rounded-md ring-1 ring-gray-300">
            <button
              onClick={() => setView("grid")}
              title="Grid"
              className={`p-2 ${view === "grid" ? "bg-slate-900 text-white" : ""}`}
            >
              <Grid2X2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              title="List"
              className={`p-2 ${view === "list" ? "bg-slate-900 text-white" : ""}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={foldersFirst}
              onChange={(e) => setFoldersFirst(e.target.checked)}
            />{" "}
            Folders first
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {library.loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : library.error ? (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {library.error}
            </p>
          ) : items.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-gray-500">
              <ImageIcon className="h-10 w-10 text-gray-300" />
              <p className="mt-2 text-sm">No images in this folder.</p>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {items.map((item) =>
                item.kind === "folder" ? (
                  <button
                    key={item.value._id}
                    onDoubleClick={() => setFolderId(item.value._id)}
                    onClick={() => setFolderId(item.value._id)}
                    className="flex aspect-square flex-col items-center justify-center rounded-md bg-gray-50 ring-1 ring-gray-200 hover:bg-gray-100"
                  >
                    <Folder className="h-14 w-14 fill-amber-300 text-amber-500" />
                    <span className="mt-2 max-w-[90%] truncate text-sm font-medium">
                      {item.value.name}
                    </span>
                  </button>
                ) : (
                  <button
                    key={item.value._id}
                    onDoubleClick={() => choose(item.value)}
                    onClick={() => setSelected(item.value)}
                    className={`overflow-hidden rounded-md text-left ring-1 ${selected?._id === item.value._id ? "ring-2 ring-blue-600" : "ring-gray-200"}`}
                  >
                    <div className="aspect-square bg-gray-100">
                      <img
                        src={item.value.thumbnailUrl || item.value.url}
                        alt={item.value.altText || item.value.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="truncate p-2 text-sm font-medium">
                      {item.value.name}
                    </p>
                  </button>
                ),
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 border-y border-gray-200">
              {items.map((item) =>
                item.kind === "folder" ? (
                  <button
                    key={item.value._id}
                    onClick={() => setFolderId(item.value._id)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-gray-50"
                  >
                    <Folder className="h-8 w-8 fill-amber-300 text-amber-500" />
                    <span className="font-medium">{item.value.name}</span>
                  </button>
                ) : (
                  <button
                    key={item.value._id}
                    onClick={() => setSelected(item.value)}
                    onDoubleClick={() => choose(item.value)}
                    className={`flex w-full items-center gap-3 px-3 py-3 text-left ${selected?._id === item.value._id ? "border-l-4 border-blue-600 bg-blue-50" : ""}`}
                  >
                    <img
                      src={item.value.thumbnailUrl || item.value.url}
                      alt=""
                      className="h-10 w-14 rounded object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.value.name}</p>
                      <p className="truncate text-sm text-gray-500">
                        {item.value.filename}
                      </p>
                    </div>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => selected && choose(selected)}
            disabled={!selected}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-blue-300"
          >
            Select Image
          </button>
        </div>
      </div>
    </div>
  );
}
