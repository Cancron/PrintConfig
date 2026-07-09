import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Copy, Download, Eye, ImagePlus, Layers, Pencil, Plus, Trash2, Type, Upload } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader } from "../components/ui/Table";
import { Textarea } from "../components/ui/Textarea";
import { ImageField } from "../components/gallery/ImageField";
import { useLayouts } from "../hooks/useLayouts";
import { useWorkspace } from "../hooks/useWorkspace";
import { api } from "../lib/api";
import type { Collage, LayoutElement, LayoutElementType, LayoutOrientation, LayoutStatus, ProductScope, ProductUnit } from "../types";
import { LayoutPreview } from "../components/template/LayoutPreview";
import { ElementSettings } from "../components/template/LayoutSettingsPanels";
import { CollapsibleSection, Notice } from "../components/template/layoutTemplateShared";
import { createElement, downloadJson, keyOf, orientationOptions, scopeOptions, slugifyLocal, statusOptions, unitOptions, formatLabel } from "../components/template/layoutTemplateUtils";

export function Collages() {
  const { categories, duplicateCollage, deleteCollage, listPagedCollages, invalidateCollageCache } = useLayouts({ loadCollages: false });
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [orientation, setOrientation] = useState("");
  const [scope, setScope] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagedCollages, setPagedCollages] = useState<Collage[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, pageCount: 1 });
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const currentPage = pagination.page;
  const pageCount = pagination.pageCount;
  const rangeStart = pagination.total === 0 ? 0 : (currentPage - 1) * pagination.pageSize + 1;
  const rangeEnd = Math.min(pagination.total, currentPage * pagination.pageSize);

  useEffect(() => {
    setPage(1);
  }, [categoryId, orientation, pageSize, scope, search, status]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const loadPagedCollages = useCallback((force = false) => {
    let active = true;
    setListLoading(true);
    setListError("");
    listPagedCollages({
      categoryId,
      scope,
      status,
      orientation,
      search,
      page,
      pageSize,
    }, force)
      .then((result) => {
        if (!active) return;
        setPagedCollages(result.items);
        setPagination(result.pagination);
      })
      .catch((error) => {
        if (!active) return;
        setListError(error instanceof Error ? error.message : "Could not load collages.");
      })
      .finally(() => {
        if (active) setListLoading(false);
      });
    return () => {
      active = false;
    };
  }, [categoryId, listPagedCollages, orientation, page, pageSize, scope, search, status]);

  useEffect(() => loadPagedCollages(), [loadPagedCollages]);

  async function handleDuplicate(collage: Collage) {
    await duplicateCollage(collage._id);
    setMessage("Collage duplicated.");
    loadPagedCollages(true);
  }
  async function handleExport(collage: Collage) {
    downloadJson(`collage-${collage.slug || collage._id}.json`, await api.exportCollage(collage._id));
  }
  async function handleImport() {
    try {
      await api.importCollage(JSON.parse(importJson));
      setImportOpen(false);
      setImportJson("");
      setMessage("Collage imported.");
      invalidateCollageCache();
      loadPagedCollages(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    }
  }

  return <div>
    <PageHeader title="Collages" description="Reusable one-page designs for templates, photo books, and collage products." action={<div className="flex gap-2"><button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"><Upload className="h-4 w-4" /> Import</button><Link to="/layouts/collages/new" className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> New Collage</Link></div>} />
    {message && <Notice tone={message.includes("failed") || message.includes("required") ? "warning" : "success"}>{message}</Notice>}
    {listError && <Notice tone="warning">{listError}</Notice>}
    <div className="mb-4 grid gap-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200 md:grid-cols-5">
      <Input label="Search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search collages" />
      <Select label="Category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} options={[{ value: "", label: "All categories" }, ...categories.map((category) => ({ value: category._id, label: category.name }))]} />
      <Select label="Status" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ value: "", label: "All statuses" }, ...statusOptions]} />
      <Select label="Orientation" value={orientation} onChange={(event) => setOrientation(event.target.value)} options={[{ value: "", label: "All orientations" }, ...orientationOptions]} />
      <Select label="Scope" value={scope} onChange={(event) => setScope(event.target.value)} options={[{ value: "", label: "All scopes" }, ...scopeOptions]} />
    </div>
    {listLoading && pagedCollages.length === 0 ? <Notice tone="info">Loading collages...</Notice> : pagination.total === 0 ? <EmptyState title="No collages found" description="Create a reusable one-page collage layout." /> : <><Table><TableHead><TableHeader>Thumbnail</TableHeader><TableHeader>Collage</TableHeader><TableHeader>Category</TableHeader><TableHeader>Orientation</TableHeader><TableHeader>Elements</TableHeader><TableHeader>Status</TableHeader><TableHeader>Scope</TableHeader><TableHeader className="text-right">Actions</TableHeader></TableHead><TableBody>{pagedCollages.map((collage) => <tr key={collage._id}><TableCell>{collage.thumbnailUrl ? <img src={collage.thumbnailUrl} alt={collage.name} className="h-12 w-12 rounded-md object-cover" /> : <div className="h-12 w-12 rounded-md bg-gray-100" />}</TableCell><TableCell><Link to={`/layouts/collages/${collage._id}`} className="font-medium text-gray-900 hover:text-slate-700">{collage.name}</Link><p className="mt-1 line-clamp-1 max-w-sm text-xs text-gray-500">{collage.description}</p></TableCell><TableCell>{categories.find((category) => category._id === collage.categoryId)?.name ?? "-"}</TableCell><TableCell>{formatLabel(collage.orientation)}</TableCell><TableCell>{collage.elements.length}</TableCell><TableCell><StatusBadge status={collage.status} /></TableCell><TableCell>{collage.scope === "shared" ? "Shared" : "Merchant"}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Link to={`/layouts/collages/${collage._id}`} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title="Open"><Eye className="h-4 w-4" /></Link><Link to={`/layouts/collages/${collage._id}`} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title="Edit"><Pencil className="h-4 w-4" /></Link><button onClick={() => handleDuplicate(collage)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title="Duplicate"><Copy className="h-4 w-4" /></button><button onClick={() => handleExport(collage)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" title="Export"><Download className="h-4 w-4" /></button><button onClick={() => { if (confirm("Delete this collage?")) deleteCollage(collage._id).then(() => loadPagedCollages(true)).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Delete failed.")); }} className="rounded-md p-2 text-red-600 hover:bg-red-50" title="Delete"><Trash2 className="h-4 w-4" /></button></div></TableCell></tr>)}</TableBody></Table><PaginationControls loading={listLoading} page={currentPage} pageCount={pageCount} pageSize={pageSize} total={pagination.total} rangeStart={rangeStart} rangeEnd={rangeEnd} onPageChange={setPage} onPageSizeChange={setPageSize} /></>}
    {importOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl"><h2 className="text-lg font-semibold text-gray-900">Import Collage JSON</h2><Textarea className="mt-4 font-mono" rows={12} value={importJson} onChange={(event) => setImportJson(event.target.value)} placeholder="Paste collage JSON" /><div className="mt-4 flex justify-end gap-3"><button onClick={() => setImportOpen(false)} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300">Cancel</button><button onClick={handleImport} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">Import</button></div></div></div>}
  </div>;
}

export function CollageEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { account, selectedMerchantId, categories, collages, addCollage, updateCollage, deleteCollage, loading } = useLayouts();
  const { selectedMerchant } = useWorkspace();
  const isNew = id === "new";
  const source = isNew ? null : collages.find((collage) => collage._id === id);
  const [collage, setCollage] = useState<Collage>(() => source ?? createCollage(account._id, params.get("categoryId") || categories[0]?._id || ""));
  const [selectedElementId, setSelectedElementId] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [message, setMessage] = useState("");
  const [openPanels, setOpenPanels] = useState({ collage: true, element: false });

  useEffect(() => { if (!isNew && source) { setCollage(source); setSelectedElementId(""); } }, [isNew, source]);
  useEffect(() => { if (isNew && !collage.categoryId && categories[0]) setCollage((prev) => ({ ...prev, categoryId: params.get("categoryId") || categories[0]._id })); }, [categories, collage.categoryId, isNew, params]);

  const selectedElement = collage.elements.find((element) => keyOf(element) === selectedElementId) ?? null;
  const errors = validateCollage(collage, collages, selectedMerchantId);
  const isValid = Object.keys(errors).length === 0;
  const page = collageToPage(collage);

  if (loading && !isNew && !source) return <Notice tone="info">Loading collage...</Notice>;
  if (!isNew && !source) return <EmptyState title="Collage not found" description="The selected collage is not available for this merchant." action={<button onClick={() => navigate("/layouts/collages")} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">Back to Collages</button>} />;

  function update<K extends keyof Collage>(field: K, value: Collage[K]) { setCollage((prev) => ({ ...prev, [field]: value })); }
  function updateElement(elementId: string, updater: (element: LayoutElement) => LayoutElement) { setCollage((prev) => ({ ...prev, elements: prev.elements.map((element) => keyOf(element) === elementId ? updater(element) : element) })); }
  function selectElement(elementId: string) { setSelectedElementId(elementId); setOpenPanels({ collage: false, element: true }); }
  function addElement(type: LayoutElementType) { const element = createElement(type, collage.elements.length + 1); setCollage((prev) => ({ ...prev, elements: [...prev.elements, element] })); selectElement(keyOf(element)); }
  async function importSvgFile(file: File) {
    try {
      const result = parseSvgDesign(await file.text(), collage.elements.length);
      setCollage((prev) => ({
        ...prev,
        canvasHeight: Number((prev.canvasWidth * (result.viewBox.height / result.viewBox.width)).toFixed(3)),
        orientation: result.viewBox.width === result.viewBox.height ? "square" : result.viewBox.width > result.viewBox.height ? "landscape" : "portrait",
        elements: [...prev.elements, ...result.elements],
      }));
      setSelectedElementId(result.elements[0] ? keyOf(result.elements[0]) : "");
      setOpenPanels({ collage: false, element: true });
      setMessage(`Imported ${result.elements.length} SVG element${result.elements.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "SVG import failed.");
    }
  }
  function duplicateElement() { if (!selectedElement) return; const copy = { ...selectedElement, _id: "", clientId: crypto.randomUUID(), name: `${selectedElement.name} Copy`, x: Math.min(95, selectedElement.x + 3), y: Math.min(95, selectedElement.y + 3) }; setCollage((prev) => ({ ...prev, elements: [...prev.elements, copy] })); selectElement(keyOf(copy)); }
  function deleteElement() { if (!selectedElement) return; setCollage((prev) => ({ ...prev, elements: prev.elements.filter((element) => keyOf(element) !== keyOf(selectedElement)) })); setSelectedElementId(""); }
  async function save() { if (!isValid) return; const payload = { ...collage, merchantContextId: selectedMerchantId, merchantId: collage.scope === "merchant" ? selectedMerchantId : null }; const saved = isNew ? await addCollage(payload) : await updateCollage(payload); setMessage("Collage saved."); navigate(`/layouts/collages/${saved._id}`); }
  async function remove() { if (!collage._id || !confirm("Delete this collage?")) return; await deleteCollage(collage._id); navigate("/layouts/collages"); }
  async function exportJson() { downloadJson(`collage-${collage.slug || "draft"}.json`, collage._id ? await api.exportCollage(collage._id) : { collage }); }

  return <div><PageHeader title={isNew ? "Create Collage" : collage.name} description="Edit one reusable collage layout with normalized percentage coordinates." action={<div className="flex flex-wrap gap-2"><button onClick={() => setPreviewMode((value) => !value)} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">{previewMode ? "Edit" : "Preview"}</button><button onClick={exportJson} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"><Download className="h-4 w-4" /> Export</button>{!isNew && <button onClick={remove} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50">Delete</button>}<button onClick={save} disabled={!isValid} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">Save</button></div>} />{message && <Notice tone="success">{message}</Notice>}<div className="grid gap-6 xl:grid-cols-[1fr_380px]"><main className="space-y-4"><Toolbar onAdd={addElement} onImportSvg={importSvgFile} /><LayoutPreview page={page} selectedElementId={selectedElementId} onSelect={selectElement} onChange={updateElement} previewMode={previewMode} /></main><aside className="space-y-1 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"><CollapsibleSection title="Collage Settings" open={openPanels.collage} onToggle={() => setOpenPanels((prev) => ({ ...prev, collage: !prev.collage }))}><CollageSettings collage={collage} categories={categories} selectedMerchantName={selectedMerchant?.name} errors={errors} onUpdate={update} /></CollapsibleSection><CollapsibleSection title="Element Settings" open={openPanels.element} onToggle={() => setOpenPanels((prev) => ({ ...prev, element: !prev.element }))}>{selectedElement ? <ElementSettings element={selectedElement} onUpdate={(updater) => updateElement(keyOf(selectedElement), updater)} onDuplicate={duplicateElement} onDelete={deleteElement} /> : <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">Select an element on the canvas to edit its settings.</div>}</CollapsibleSection><pre className="max-h-72 overflow-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">{JSON.stringify(collage, null, 2)}</pre></aside></div></div>;
}

function CollageSettings({ collage, categories, selectedMerchantName, errors, onUpdate }: { collage: Collage; categories: { _id: string; name: string }[]; selectedMerchantName?: string; errors: Record<string, string>; onUpdate: <K extends keyof Collage>(field: K, value: Collage[K]) => void }) {
  return <section className="space-y-3"><Input label="Name" value={collage.name} onChange={(event) => { onUpdate("name", event.target.value); if (!collage._id) onUpdate("slug", slugifyLocal(event.target.value)); }} error={errors.name} /><Input label="Slug" value={collage.slug} onChange={(event) => onUpdate("slug", event.target.value)} error={errors.slug} /><Select label="Category" value={collage.categoryId} onChange={(event) => onUpdate("categoryId", event.target.value)} options={categories.map((category) => ({ value: category._id, label: category.name }))} error={errors.categoryId} /><Textarea label="Description" value={collage.description} onChange={(event) => onUpdate("description", event.target.value)} rows={2} /><Select label="Status" value={collage.status} onChange={(event) => onUpdate("status", event.target.value as LayoutStatus)} options={statusOptions} error={errors.status} /><Select label="Scope" value={collage.scope} onChange={(event) => onUpdate("scope", event.target.value as ProductScope)} options={scopeOptions} error={errors.scope} />{collage.scope === "merchant" && <p className="rounded-md bg-purple-50 p-2 text-xs text-purple-700 ring-1 ring-purple-200">This collage belongs only to {selectedMerchantName ?? "the selected merchant"}.</p>}<ImageField label="Thumbnail Image URL" url={collage.thumbnailUrl} assetId={collage.thumbnailAssetId} onChange={(url, assetId) => { onUpdate("thumbnailUrl", url); onUpdate("thumbnailAssetId", assetId); }} /><Select label="Orientation" value={collage.orientation} onChange={(event) => onUpdate("orientation", event.target.value as LayoutOrientation)} options={orientationOptions} error={errors.orientation} /><div className="grid grid-cols-2 gap-3"><Input label="Canvas Width" type="number" value={collage.canvasWidth} onChange={(event) => onUpdate("canvasWidth", Number(event.target.value))} error={errors.canvasWidth} /><Input label="Canvas Height" type="number" value={collage.canvasHeight} onChange={(event) => onUpdate("canvasHeight", Number(event.target.value))} error={errors.canvasHeight} /><Select label="Unit" value={collage.unit} onChange={(event) => onUpdate("unit", event.target.value as ProductUnit)} options={unitOptions} error={errors.unit} /><Input label="DPI" type="number" value={collage.dpi} onChange={(event) => onUpdate("dpi", Number(event.target.value))} error={errors.dpi} /><Input label="Sort Order" type="number" value={collage.sortOrder} onChange={(event) => onUpdate("sortOrder", Number(event.target.value))} error={errors.sortOrder} /><Input label="Background" type="color" value={collage.backgroundColor} onChange={(event) => onUpdate("backgroundColor", event.target.value)} /></div><ImageField label="Background Image URL" url={collage.backgroundImageUrl} assetId={collage.backgroundImageAssetId} onChange={(url, assetId) => { onUpdate("backgroundImageUrl", url); onUpdate("backgroundImageAssetId", assetId); }} /><Input label="Tags" value={collage.tags.join(", ")} onChange={(event) => onUpdate("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} /></section>;
}

function Toolbar({ onAdd, onImportSvg }: { onAdd: (type: LayoutElementType) => void; onImportSvg: (file: File) => void }) {
  const svgInputRef = useRef<HTMLInputElement>(null);
  return <div className="flex flex-wrap gap-2 rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200"><button onClick={() => onAdd("photo_placeholder")} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"><ImagePlus className="h-4 w-4" /> Photo Placeholder</button><button onClick={() => onAdd("text_placeholder")} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300"><Type className="h-4 w-4" /> Text Placeholder</button><button onClick={() => onAdd("shape")} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300"><Layers className="h-4 w-4" /> Shape</button><button onClick={() => onAdd("static_image")} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300"><Plus className="h-4 w-4" /> Static Image</button><button type="button" onClick={() => svgInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300"><Upload className="h-4 w-4" /> Import SVG</button><input ref={svgInputRef} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportSvg(file); event.currentTarget.value = ""; }} /></div>;
}

function createCollage(accountId: string, categoryId: string): Collage {
  const now = new Date().toISOString();
  return { _id: "", accountId, merchantId: null, scope: "shared", categoryId, name: "", slug: "", description: "", status: "draft", thumbnailUrl: "", orientation: "square", canvasWidth: 12, canvasHeight: 12, unit: "inch", dpi: 300, backgroundColor: "#ffffff", backgroundImageUrl: "", tags: [], sortOrder: 0, elements: [], createdAt: now, updatedAt: now };
}

function collageToPage(collage: Collage) {
  return { _id: collage._id, clientId: collage._id || "collage-preview", pageNumber: 1, name: collage.name || "Collage", width: collage.canvasWidth, height: collage.canvasHeight, backgroundColor: collage.backgroundColor, backgroundImageUrl: collage.backgroundImageUrl, backgroundImageAssetId: collage.backgroundImageAssetId, elements: collage.elements, createdAt: collage.createdAt, updatedAt: collage.updatedAt };
}

function validateCollage(collage: Collage, existing: Collage[], selectedMerchantId: string) {
  const errors: Record<string, string> = {};
  const slug = collage.slug.trim().toLowerCase();
  const effectiveMerchantId = collage.merchantId || selectedMerchantId || null;
  if (!collage.name.trim()) errors.name = "Collage name is required.";
  if (!slug) errors.slug = "Slug is required.";
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.slug = "Use lowercase letters, numbers, and hyphens only.";
  else if (existing.some((item) => item._id !== collage._id && item.slug.toLowerCase() === slug && item.categoryId === collage.categoryId && item.scope === collage.scope && (item.scope === "shared" || item.merchantId === effectiveMerchantId))) errors.slug = "Slug must be unique in this category and scope.";
  if (!collage.categoryId) errors.categoryId = "Layout category is required.";
  if (collage.scope === "merchant" && !effectiveMerchantId) errors.scope = "Select a merchant for merchant collages.";
  if (collage.canvasWidth <= 0 || !Number.isFinite(collage.canvasWidth)) errors.canvasWidth = "Canvas width must be greater than zero.";
  if (collage.canvasHeight <= 0 || !Number.isFinite(collage.canvasHeight)) errors.canvasHeight = "Canvas height must be greater than zero.";
  if (collage.dpi <= 0 || !Number.isFinite(collage.dpi)) errors.dpi = "DPI must be greater than zero.";
  if (Number.isNaN(Number(collage.sortOrder))) errors.sortOrder = "Sort order must be numeric.";
  return errors;
}

function parseSvgDesign(svgText: string, existingElementCount: number) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (doc.querySelector("parsererror")) throw new Error("SVG file could not be parsed.");
  const svg = doc.querySelector("svg");
  if (!svg) throw new Error("SVG file does not contain an <svg> root.");
  const viewBox = parseViewBox(svg);
  const classStyles = parseSvgClassStyles(svg);
  const placeholderBoxes = [
    ...Array.from(svg.querySelectorAll("polygon, polyline")).map((node) => boxFromPoints(node.getAttribute("points") ?? "")),
    ...Array.from(svg.querySelectorAll("rect")).map((node) => boxFromRect(node)),
  ].filter((box): box is SvgBox => Boolean(box && box.width > 0 && box.height > 0));
  const pathShapes = Array.from(svg.querySelectorAll("path"))
    .map((node) => shapeFromPath(node, viewBox, classStyles))
    .filter((path): path is SvgPathBox => Boolean(path && path.box.width > 0 && path.box.height > 0));
  if (placeholderBoxes.length === 0 && pathShapes.length === 0) throw new Error("No polygon, polyline, rect, or path elements were found in the SVG.");
  const placeholderElements = placeholderBoxes.map((box, index) => {
    const element = createElement("photo_placeholder", existingElementCount + index + 1);
    return {
      ...element,
      name: `Photo Placeholder ${existingElementCount + index + 1}`,
      x: clampPercent(((box.x - viewBox.x) / viewBox.width) * 100),
      y: clampPercent(((box.y - viewBox.y) / viewBox.height) * 100),
      width: clampPercent((box.width / viewBox.width) * 100, 0.01),
      height: clampPercent((box.height / viewBox.height) * 100, 0.01),
      photoSettings: { ...element.photoSettings, placeholderIndex: existingElementCount + index + 1 },
    };
  });
  const shapeElements = pathShapes.map((pathShape, index) => {
    const sequence = existingElementCount + placeholderElements.length + index + 1;
    const element = createElement("shape", sequence);
    const box = pathShape.box;
    return {
      ...element,
      name: `SVG Shape ${sequence}`,
      x: clampPercent(((box.x - viewBox.x) / viewBox.width) * 100),
      y: clampPercent(((box.y - viewBox.y) / viewBox.height) * 100),
      width: clampPercent((box.width / viewBox.width) * 100, 0.01),
      height: clampPercent((box.height / viewBox.height) * 100, 0.01),
      shapeSettings: {
        ...element.shapeSettings,
        shapeType: "path" as const,
        fillColor: pathShape.fill,
        strokeColor: pathShape.stroke,
        strokeWidth: pathShape.strokeWidth,
        borderRadius: 0,
        svgPath: pathShape.d,
        svgViewBox: `${box.x} ${box.y} ${box.width} ${box.height}`,
      },
    };
  });
  const elements = [...placeholderElements, ...shapeElements];
  return { viewBox, elements };
}

interface SvgBox { x: number; y: number; width: number; height: number }
interface SvgPathBox { box: SvgBox; d: string; fill: string; stroke: string; strokeWidth: number }

function parseViewBox(svg: SVGSVGElement | Element) {
  const rawViewBox = svg.getAttribute("viewBox")?.trim();
  if (rawViewBox) {
    const values = rawViewBox.split(/[\s,]+/).map(Number);
    if (values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0) {
      return { x: values[0], y: values[1], width: values[2], height: values[3] };
    }
  }
  const width = parseSvgNumber(svg.getAttribute("width"));
  const height = parseSvgNumber(svg.getAttribute("height"));
  if (width > 0 && height > 0) return { x: 0, y: 0, width, height };
  throw new Error("SVG needs a valid viewBox or width and height.");
}

function boxFromPoints(points: string): SvgBox | null {
  const values = points.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
  if (values.length < 4) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < values.length - 1; i += 2) {
    xs.push(values[i]);
    ys.push(values[i + 1]);
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function boxFromRect(rect: Element): SvgBox | null {
  const x = parseSvgNumber(rect.getAttribute("x"));
  const y = parseSvgNumber(rect.getAttribute("y"));
  const width = parseSvgNumber(rect.getAttribute("width"));
  const height = parseSvgNumber(rect.getAttribute("height"));
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}
function shapeFromPath(path: Element, viewBox: SvgBox, classStyles: Map<string, Record<string, string>>): SvgPathBox | null {
  const d = path.getAttribute("d");
  if (!d?.trim()) return null;

  const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const pathNode = document.createElementNS("http://www.w3.org/2000/svg", "path");
  svgNode.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  svgNode.style.position = "absolute";
  svgNode.style.left = "-99999px";
  svgNode.style.top = "-99999px";
  svgNode.style.width = "0";
  svgNode.style.height = "0";
  svgNode.style.overflow = "hidden";
  pathNode.setAttribute("d", d);
  svgNode.appendChild(pathNode);
  document.body.appendChild(svgNode);
  try {
    const box = pathNode.getBBox();
    const pathBox = box.width > 0 && box.height > 0
      ? { x: box.x, y: box.y, width: box.width, height: box.height }
      : null;
    if (!pathBox) return null;
    const stroke = svgPaintValue(path, classStyles, "stroke", "none");
    return {
      box: pathBox,
      d,
      fill: svgPaintValue(path, classStyles, "fill", "#f3f4f6"),
      stroke,
      strokeWidth: stroke === "none" ? 0 : parseSvgNumber(svgStyleValue(path, classStyles, "stroke-width", "1")),
    };
  } finally {
    svgNode.remove();
  }
}

function parseSvgClassStyles(svg: Element) {
  const styles = new Map<string, Record<string, string>>();
  const styleText = Array.from(svg.querySelectorAll("style")).map((node) => node.textContent ?? "").join("\n");
  const rulePattern = /([^{}]+)\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(styleText))) {
    const declarations = parseStyleDeclarations(match[2]);
    const classNames = Array.from(match[1].matchAll(/\.([A-Za-z0-9_-]+)/g)).map((classMatch) => classMatch[1]);
    classNames.forEach((className) => styles.set(className, { ...(styles.get(className) ?? {}), ...declarations }));
  }
  return styles;
}

function parseStyleDeclarations(value: string) {
  return value.split(";").reduce<Record<string, string>>((styles, declaration) => {
    const [property, ...rawValue] = declaration.split(":");
    const key = property?.trim().toLowerCase();
    const styleValue = rawValue.join(":").trim();
    if (key && styleValue) styles[key] = styleValue;
    return styles;
  }, {});
}

function svgStyleValue(path: Element, classStyles: Map<string, Record<string, string>>, property: string, fallback: string) {
  const key = property.toLowerCase();
  const inlineValue = parseStyleDeclarations(path.getAttribute("style") ?? "")[key];
  if (inlineValue) return inlineValue;
  const attrValue = path.getAttribute(property);
  if (attrValue) return attrValue;
  for (const className of (path.getAttribute("class") ?? "").split(/\s+/).filter(Boolean)) {
    const classValue = classStyles.get(className)?.[key];
    if (classValue) return classValue;
  }
  return fallback;
}

function svgPaintValue(path: Element, classStyles: Map<string, Record<string, string>>, property: "fill" | "stroke", fallback: string) {
  const value = svgStyleValue(path, classStyles, property, fallback).trim();
  return value || fallback;
}

function parseSvgNumber(value: string | null) {
  const match = String(value ?? "").match(/-?\d*\.?\d+/);
  return match ? Number(match[0]) : 0;
}

function clampPercent(value: number, min = 0) {
  return Number(Math.min(100, Math.max(min, value)).toFixed(4));
}

function PaginationControls({
  loading,
  page,
  pageCount,
  pageSize,
  total,
  rangeStart,
  rangeEnd,
  onPageChange,
  onPageSizeChange,
}: {
  loading?: boolean;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg bg-white px-4 py-3 text-sm text-gray-600 shadow-sm ring-1 ring-gray-200 sm:flex-row sm:items-center sm:justify-between">
      <div>
        Showing <span className="font-medium text-gray-900">{rangeStart}</span> to{" "}
        <span className="font-medium text-gray-900">{rangeEnd}</span> of{" "}
        <span className="font-medium text-gray-900">{total}</span> collages
        {loading && <span className="ml-2 text-gray-400">Loading...</span>}
      </div>
      <div className="flex items-center gap-3">
        <Select
          // label="Rows"
          value={String(pageSize)}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          options={[
            { value: "10", label: "10" },
            { value: "25", label: "25" },
            { value: "50", label: "50" },
            { value: "100", label: "100" },
          ]}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            Previous
          </button>
          <span className="min-w-24 text-center text-sm text-gray-600">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            disabled={page >= pageCount}
            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${status === "active" ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : status === "archived" ? "bg-gray-50 text-gray-600 ring-gray-500/20" : "bg-amber-50 text-amber-700 ring-amber-600/20"}`}>{formatLabel(status)}</span>;
}
