import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Download, ImagePlus, Layers, Plus, Type } from "lucide-react";
import { PageHeader } from "../PageHeader";
import { EmptyState } from "../ui/EmptyState";
import { useLayouts } from "../../hooks/useLayouts";
import { useWorkspace } from "../../hooks/useWorkspace";
import { api } from "../../lib/api";
import { validateLayoutTemplate } from "../../lib/validation";
import type {
  LayoutElement,
  LayoutElementType,
  LayoutTemplate,
  LayoutTemplatePage,
} from "../../types";
import { CollapsibleSection, Notice } from "./layoutTemplateShared";
import {
  createElement,
  createPage,
  createTemplate,
  downloadJson,
  keyOf,
} from "./layoutTemplateUtils";
import { LayoutPreview } from "./LayoutPreview";
import {
  ElementSettings,
  PageSettings,
  TemplateSettings,
} from "./LayoutSettingsPanels";

export function LayoutTemplateEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const {
    account,
    selectedMerchantId,
    categories,
    allTemplates,
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    loading,
  } = useLayouts();
  const { selectedMerchant } = useWorkspace();
  const isNew = id === "new";
  const source = isNew
    ? null
    : templates.find((template) => template._id === id);
  const [template, setTemplate] = useState<LayoutTemplate>(
    () =>
      source ??
      createTemplate(
        account._id,
        selectedMerchantId,
        params.get("categoryId") || categories[0]?._id || "",
      ),
  );
  const [selectedPageId, setSelectedPageId] = useState(() =>
    keyOf(template.pages[0]),
  );
  const [selectedElementId, setSelectedElementId] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [openPanels, setOpenPanels] = useState({
    template: true,
    page: true,
    element: false,
  });

  useEffect(() => {
    if (!isNew && source) {
      setTemplate(source);
      setSelectedPageId(keyOf(source.pages[0]));
      setSelectedElementId("");
    }
  }, [isNew, source]);

  useEffect(() => {
    if (isNew && !template.categoryId && categories[0])
      setTemplate((prev) => ({
        ...prev,
        categoryId: params.get("categoryId") || categories[0]._id,
      }));
  }, [categories, isNew, params, template.categoryId]);

  const selectedPage =
    template.pages.find((page) => keyOf(page) === selectedPageId) ??
    template.pages[0];
  const selectedElement =
    selectedPage?.elements.find(
      (element) => keyOf(element) === selectedElementId,
    ) ?? null;
  const errors = useMemo(
    () => validateLayoutTemplate(template, allTemplates, selectedMerchantId),
    [allTemplates, selectedMerchantId, template],
  );
  const isValid = Object.keys(errors).length === 0;

  if (loading && !isNew && !source)
    return <Notice tone="info">Loading layout template...</Notice>;
  if (!isNew && !source)
    return (
      <EmptyState
        title="Layout template not found"
        description="The selected template is not available for this merchant."
        action={
          <button
            onClick={() => navigate("/layouts/templates")}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Back to Layout Templates
          </button>
        }
      />
    );

  function selectElement(elementId: string) {
    setSelectedElementId(elementId);
    setOpenPanels({ template: false, page: false, element: true });
  }
  function togglePanel(panel: keyof typeof openPanels) {
    setOpenPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  }
  function update<K extends keyof LayoutTemplate>(
    field: K,
    value: LayoutTemplate[K],
  ) {
    setTemplate((prev) => ({ ...prev, [field]: value }));
  }
  function updatePage(
    pageId: string,
    updater: (page: LayoutTemplatePage) => LayoutTemplatePage,
  ) {
    setTemplate((prev) => ({
      ...prev,
      pages: prev.pages.map((page) =>
        keyOf(page) === pageId ? updater(page) : page,
      ),
    }));
  }
  function updateElement(
    elementId: string,
    updater: (element: LayoutElement) => LayoutElement,
  ) {
    if (!selectedPage) return;
    updatePage(keyOf(selectedPage), (page) => ({
      ...page,
      elements: page.elements.map((element) =>
        keyOf(element) === elementId ? updater(element) : element,
      ),
    }));
  }
  function addPage() {
    const page = createPage(
      template.pages.length + 1,
      template.canvasWidth,
      template.canvasHeight,
      template.backgroundColor,
    );
    setTemplate((prev) => ({
      ...prev,
      pageCount: prev.pages.length + 1,
      pages: [...prev.pages, page],
    }));
    setSelectedPageId(keyOf(page));
    setSelectedElementId("");
  }
  function duplicatePage() {
    if (!selectedPage) return;
    const page = {
      ...selectedPage,
      _id: "",
      clientId: crypto.randomUUID(),
      pageNumber: template.pages.length + 1,
      name: `${selectedPage.name} Copy`,
      elements: selectedPage.elements.map((element) => ({
        ...element,
        _id: "",
        clientId: crypto.randomUUID(),
      })),
    };
    setTemplate((prev) => ({
      ...prev,
      pageCount: prev.pages.length + 1,
      pages: [...prev.pages, page],
    }));
    setSelectedPageId(keyOf(page));
  }
  function deletePage() {
    if (!selectedPage || template.pages.length <= 1) return;
    const pages = template.pages
      .filter((page) => keyOf(page) !== keyOf(selectedPage))
      .map((page, index) => ({ ...page, pageNumber: index + 1 }));
    setTemplate((prev) => ({ ...prev, pageCount: pages.length, pages }));
    setSelectedPageId(keyOf(pages[0]));
    setSelectedElementId("");
  }
  function addElement(type: LayoutElementType) {
    if (!selectedPage) return;
    const element = createElement(type, selectedPage.elements.length + 1);
    updatePage(keyOf(selectedPage), (page) => ({
      ...page,
      elements: [...page.elements, element],
    }));
    selectElement(keyOf(element));
  }
  function duplicateElement() {
    if (!selectedElement || !selectedPage) return;
    const element = {
      ...selectedElement,
      _id: "",
      clientId: crypto.randomUUID(),
      name: `${selectedElement.name} Copy`,
      x: Math.min(95, selectedElement.x + 3),
      y: Math.min(95, selectedElement.y + 3),
    };
    updatePage(keyOf(selectedPage), (page) => ({
      ...page,
      elements: [...page.elements, element],
    }));
    selectElement(keyOf(element));
  }
  function deleteElement() {
    if (!selectedElement || !selectedPage) return;
    updatePage(keyOf(selectedPage), (page) => ({
      ...page,
      elements: page.elements.filter(
        (element) => keyOf(element) !== keyOf(selectedElement),
      ),
    }));
    setSelectedElementId("");
  }

  async function save() {
    if (!isValid) return;
    const payload = {
      ...template,
      merchantContextId: selectedMerchantId,
      merchantId: template.scope === "merchant" ? selectedMerchantId : null,
      pageCount: template.pages.length || template.pageCount,
    };
    const saved = isNew
      ? await addTemplate(payload)
      : await updateTemplate(payload);
    setMessage("Layout template saved.");
    navigate(`/layouts/templates/${saved._id}`);
  }
  async function remove() {
    if (!template._id || !confirm("Delete this layout template?")) return;
    await deleteTemplate(template._id);
    navigate("/layouts/templates");
  }
  async function exportJson() {
    const data = template._id
      ? await api.exportLayoutTemplate(template._id)
      : { template };
    downloadJson(`layout-template-${template.slug || "draft"}.json`, data);
  }

  return (
    <div>
      <PageHeader
        title={isNew ? "Create Layout Template" : template.name}
        description="Configure reusable pages and placeholders with normalized percentage coordinates."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPreviewMode((value) => !value)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              {previewMode ? "Edit" : "Preview"}
            </button>
            <button
              onClick={exportJson}
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              <Download className="h-4 w-4" /> Export
            </button>
            {!isNew && (
              <button
                onClick={remove}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50"
              >
                Delete
              </button>
            )}
            <button
              onClick={save}
              disabled={!isValid}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Save
            </button>
          </div>
        }
      />
      {message && <Notice tone="success">{message}</Notice>}
      <div className="grid gap-6 xl:grid-cols-[240px_1fr_360px]">
        <aside className="space-y-4 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Pages</h2>
          <div className="space-y-2">
            {template.pages.map((page) => (
              <button
                key={keyOf(page)}
                onClick={() => {
                  setSelectedPageId(keyOf(page));
                  setSelectedElementId("");
                }}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ring-1 ${keyOf(page) === keyOf(selectedPage) ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50"}`}
              >
                {page.pageNumber}. {page.name}
              </button>
            ))}
          </div>
          <div className="grid gap-2">
            <button
              onClick={addPage}
              className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Add Page
            </button>
            <button
              onClick={duplicatePage}
              className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Duplicate Page
            </button>
            <button
              onClick={deletePage}
              disabled={template.pages.length <= 1}
              className="rounded-md bg-white px-3 py-2 text-sm font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:text-gray-300 disabled:ring-gray-200"
            >
              Delete Page
            </button>
          </div>
        </aside>
        <main className="space-y-4">
          <Toolbar onAdd={addElement} />
          <LayoutPreview
            page={selectedPage}
            selectedElementId={selectedElementId}
            onSelect={selectElement}
            onChange={updateElement}
            previewMode={previewMode}
          />
        </main>
        <aside className="space-y-1 rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <CollapsibleSection
            title="Template Settings"
            open={openPanels.template}
            onToggle={() => togglePanel("template")}
          >
            <TemplateSettings
              template={template}
              categories={categories}
              selectedMerchantName={selectedMerchant?.name}
              errors={errors}
              onUpdate={update}
            />
          </CollapsibleSection>
          {selectedPage && (
            <CollapsibleSection
              title="Page Settings"
              open={openPanels.page}
              onToggle={() => togglePanel("page")}
            >
              <PageSettings
                page={selectedPage}
                onUpdate={(field, value) =>
                  updatePage(keyOf(selectedPage), (page) => ({
                    ...page,
                    [field]: value,
                  }))
                }
              />
            </CollapsibleSection>
          )}
          <CollapsibleSection
            title="Element Settings"
            open={openPanels.element}
            onToggle={() => togglePanel("element")}
          >
            {selectedElement ? (
              <ElementSettings
                element={selectedElement}
                onUpdate={(updater) =>
                  updateElement(keyOf(selectedElement), updater)
                }
                onDuplicate={duplicateElement}
                onDelete={deleteElement}
              />
            ) : (
              <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                Select an element on the canvas to edit its settings.
              </div>
            )}
          </CollapsibleSection>
          <pre className="max-h-72 overflow-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">
            {JSON.stringify(template, null, 2)}
          </pre>
        </aside>
      </div>
    </div>
  );
}

function Toolbar({ onAdd }: { onAdd: (type: LayoutElementType) => void }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
      <button
        onClick={() => onAdd("photo_placeholder")}
        className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
      >
        <ImagePlus className="h-4 w-4" /> Photo Placeholder
      </button>
      <button
        onClick={() => onAdd("text_placeholder")}
        className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300"
      >
        <Type className="h-4 w-4" /> Text Placeholder
      </button>
      <button
        onClick={() => onAdd("shape")}
        className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300"
      >
        <Layers className="h-4 w-4" /> Shape
      </button>
      <button
        onClick={() => onAdd("static_image")}
        className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300"
      >
        <Plus className="h-4 w-4" /> Static Image
      </button>
    </div>
  );
}
