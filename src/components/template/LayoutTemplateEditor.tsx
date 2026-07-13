import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download } from "lucide-react";
import { PageHeader } from "../PageHeader";
import { EmptyState } from "../ui/EmptyState";
import { useLayouts } from "../../hooks/useLayouts";
import { useWorkspace } from "../../hooks/useWorkspace";
import { api } from "../../lib/api";
import { validateLayoutTemplate } from "../../lib/validation";
import type { LayoutTemplate, LayoutTemplatePage } from "../../types";
import { CollapsibleSection, Notice } from "./layoutTemplateShared";
import { createPage, createTemplate, downloadJson, keyOf } from "./layoutTemplateUtils";
import { LayoutPreview } from "./LayoutPreview";
import { PageSettings, TemplateSettings } from "./LayoutSettingsPanels";

export function LayoutTemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { account, selectedMerchantId, collages, allTemplates, templates, addTemplate, updateTemplate, deleteTemplate, loading } = useLayouts();
  const { selectedMerchant } = useWorkspace();
  const isNew = id === "new";
  const source = isNew ? null : templates.find((template) => template._id === id);
  const [template, setTemplate] = useState<LayoutTemplate>(() => source ?? createTemplate(account._id, selectedMerchantId));
  const [selectedPageId, setSelectedPageId] = useState(() => keyOf(template.pages[0]));
  const [message, setMessage] = useState<string | null>(null);
  const [openPanels, setOpenPanels] = useState({ template: true, page: true });

  useEffect(() => {
    if (!isNew && source) {
      setTemplate(source);
      setSelectedPageId(keyOf(source.pages[0]));
    }
  }, [isNew, source]);

  const selectedPage = template.pages.find((page) => keyOf(page) === selectedPageId) ?? template.pages[0];
  const selectedCollage = selectedPage?.collageId ? collages.find((collage) => collage._id === selectedPage.collageId) : null;
  const previewPage = selectedPage ? pageWithCollage(selectedPage, selectedCollage) : undefined;
  const errors = useMemo(() => validateLayoutTemplate(template, allTemplates, selectedMerchantId), [allTemplates, selectedMerchantId, template]);
  const isValid = Object.keys(errors).length === 0;

  if (loading && !isNew && !source) return <Notice tone="info">Loading layout template...</Notice>;
  if (!isNew && !source) return <EmptyState title="Layout template not found" description="The selected template is not available for this merchant." action={<button onClick={() => navigate("/layouts/templates")} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">Back to Layout Templates</button>} />;

  function togglePanel(panel: keyof typeof openPanels) { setOpenPanels((prev) => ({ ...prev, [panel]: !prev[panel] })); }
  function update<K extends keyof LayoutTemplate>(field: K, value: LayoutTemplate[K]) { setTemplate((prev) => ({ ...prev, [field]: value })); }
  function updatePage(pageId: string, updater: (page: LayoutTemplatePage) => LayoutTemplatePage) {
    setTemplate((prev) => ({ ...prev, pages: prev.pages.map((page) => keyOf(page) === pageId ? updater(page) : page) }));
  }
  function addPage() {
    const page = createPage(template.pages.length + 1, template.canvasWidth, template.canvasHeight, template.backgroundColor);
    setTemplate((prev) => ({ ...prev, pageCount: prev.pages.length + 1, pages: [...prev.pages, page] }));
    setSelectedPageId(keyOf(page));
  }
  function duplicatePage() {
    if (!selectedPage) return;
    const page = { ...selectedPage, _id: "", clientId: crypto.randomUUID(), pageNumber: template.pages.length + 1, name: `${selectedPage.name} Copy`, elements: [] };
    setTemplate((prev) => ({ ...prev, pageCount: prev.pages.length + 1, pages: [...prev.pages, page] }));
    setSelectedPageId(keyOf(page));
  }
  function deletePage() {
    if (!selectedPage || template.pages.length <= 1) return;
    const pages = template.pages.filter((page) => keyOf(page) !== keyOf(selectedPage)).map((page, index) => ({ ...page, pageNumber: index + 1 }));
    setTemplate((prev) => ({ ...prev, pageCount: pages.length, pages }));
    setSelectedPageId(keyOf(pages[0]));
  }
  async function save() {
    if (!isValid) return;
    const payload = { ...template, merchantContextId: selectedMerchantId, merchantId: template.scope === "merchant" ? selectedMerchantId : null, pageCount: template.pages.length || template.pageCount };
    const saved = isNew ? await addTemplate(payload) : await updateTemplate(payload);
    setMessage("Layout template saved.");
    navigate(`/layouts/templates/${saved._id}`);
  }
  async function remove() {
    if (!template._id || !confirm("Delete this layout template?")) return;
    await deleteTemplate(template._id);
    navigate("/layouts/templates");
  }
  async function exportJson() {
    const data = template._id ? await api.exportLayoutTemplate(template._id) : { template };
    downloadJson(`layout-template-${template.slug || "draft"}.json`, data);
  }

  return <div>
    <PageHeader title={isNew ? "Create Layout Template" : template.name} description="Configure multi-page templates by assigning reusable collages to pages." action={<div className="flex flex-wrap gap-2"><button onClick={exportJson} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"><Download className="h-4 w-4" /> Export</button>{!isNew && <button onClick={remove} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50">Delete</button>}<button onClick={save} disabled={!isValid} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">Save</button></div>} />
    {message && <Notice tone="success">{message}</Notice>}
    <div className="grid gap-6 xl:grid-cols-[240px_1fr_360px]">
      <aside className="space-y-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"><h2 className="text-sm font-semibold text-gray-900">Pages</h2><div className="space-y-2">{template.pages.map((page) => <button key={keyOf(page)} onClick={() => setSelectedPageId(keyOf(page))} className={`w-full rounded-md px-3 py-2 text-left text-sm ring-1 ${keyOf(page) === keyOf(selectedPage) ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50"}`}>{page.pageNumber}. {page.name}</button>)}</div><div className="grid gap-2"><button onClick={addPage} className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">Add Page</button><button onClick={duplicatePage} className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">Duplicate Page</button><button onClick={deletePage} disabled={template.pages.length <= 1} className="rounded-md bg-white px-3 py-2 text-sm font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:text-gray-300 disabled:ring-gray-200">Delete Page</button></div></aside>
      <main className="space-y-4">{selectedPage?.collageId && !selectedCollage && <Notice tone="warning">The selected collage is not available for this merchant.</Notice>}{!selectedPage?.collageId && selectedPage.elements.length > 0 && <Notice tone="info">Legacy embedded page elements are shown for compatibility. New template pages should select a reusable collage.</Notice>}<LayoutPreview page={previewPage} selectedElementId="" onSelect={() => undefined} onChange={() => undefined} previewMode /></main>
      <aside className="space-y-1 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"><CollapsibleSection title="Template Settings" open={openPanels.template} onToggle={() => togglePanel("template")}><TemplateSettings template={template} selectedMerchantName={selectedMerchant?.name} errors={errors} onUpdate={update} /></CollapsibleSection>{selectedPage && <CollapsibleSection title="Page Settings" open={openPanels.page} onToggle={() => togglePanel("page")}><PageSettings page={selectedPage} collages={collages} onUpdate={(field, value) => updatePage(keyOf(selectedPage), (page) => ({ ...page, [field]: value }))} /></CollapsibleSection>}<pre className="max-h-72 overflow-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">{JSON.stringify(template, null, 2)}</pre></aside>
    </div>
  </div>;
}

function pageWithCollage(page: LayoutTemplatePage, collage?: { elements: LayoutTemplatePage["elements"]; backgroundColor: string; backgroundImageUrl: string; backgroundImageAssetId?: string } | null): LayoutTemplatePage {
  if (!collage) return page;
  return { ...page, backgroundColor: page.backgroundColor || collage.backgroundColor, backgroundImageUrl: page.backgroundImageUrl || collage.backgroundImageUrl, backgroundImageAssetId: page.backgroundImageAssetId || collage.backgroundImageAssetId, elements: collage.elements };
}
