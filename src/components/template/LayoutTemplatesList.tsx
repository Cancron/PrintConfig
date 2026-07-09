import { Link, useNavigate } from "react-router-dom";
import { Copy, Download, Plus, Search, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../PageHeader";
import { EmptyState } from "../ui/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
} from "../ui/Table";
import { useLayouts } from "../../hooks/useLayouts";
import { api } from "../../lib/api";
import type { LayoutTemplate } from "../../types";
import { StatusBadge } from "../../pages/LayoutCategories";
import {
  Filter,
  ImportTemplateModal,
  Notice,
  ScopeBadge,
} from "./layoutTemplateShared";
import {
  downloadJson,
  formatLabel,
  orientationOptions,
  statusOptions,
  templateTypeOptions,
} from "./layoutTemplateUtils";

export function LayoutTemplatesList() {
  const navigate = useNavigate();
  const {
    categories,
    templates,
    deleteTemplate,
    duplicateTemplate,
    loading,
    error,
    reload,
  } = useLayouts({loadCollages: false});
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [templateType, setTemplateType] = useState("");
  const [orientation, setOrientation] = useState("");
  const [scope, setScope] = useState("");
  const [status, setStatus] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category._id, category])),
    [categories],
  );
  const filtered = templates.filter((template) => {
    const query = search.toLowerCase();
    return (
      (!query ||
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.tags.join(" ").toLowerCase().includes(query)) &&
      (!categoryId || template.categoryId === categoryId) &&
      (!templateType || template.templateType === templateType) &&
      (!orientation || template.orientation === orientation) &&
      (!scope || template.scope === scope) &&
      (!status || template.status === status)
    );
  });

  async function handleDuplicate(template: LayoutTemplate) {
    const copy = await duplicateTemplate(template._id);
    navigate(`/layouts/templates/${copy._id}`);
  }
  async function handleExport(template: LayoutTemplate) {
    downloadJson(
      `layout-template-${template.slug}.json`,
      await api.exportLayoutTemplate(template._id),
    );
  }

  return (
    <div>
      <PageHeader
        title="Layout Templates"
        description="Reusable placeholder layouts for collage, photo book, card, calendar, and multi-photo products."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" /> Import JSON
            </button>
            <Link
              to="/layouts/templates/new"
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" /> Create Template
            </Link>
          </div>
        }
      />
      {loading && <Notice tone="info">Loading layout templates...</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      <div className="rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <div className="grid gap-3 border-b border-gray-200 p-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search templates..."
              className="w-full rounded-md border-0 py-2 pl-9 pr-3 text-sm shadow-sm ring-1 ring-inset ring-gray-300"
            />
          </div>
          <Filter
            value={categoryId}
            onChange={setCategoryId}
            all="All Categories"
            options={categories.map((c) => ({ value: c._id, label: c.name }))}
          />
          <Filter
            value={templateType}
            onChange={setTemplateType}
            all="All Types"
            options={templateTypeOptions}
          />
          <Filter
            value={orientation}
            onChange={setOrientation}
            all="All Orientations"
            options={orientationOptions}
          />
          <Filter
            value={scope}
            onChange={setScope}
            all="All Scopes"
            options={[
              { value: "shared", label: "Shared" },
              { value: "merchant", label: "Merchant Custom" },
            ]}
          />
          <Filter
            value={status}
            onChange={setStatus}
            all="All Statuses"
            options={statusOptions}
          />
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title="No layout templates found"
            description="Create a layout template or adjust your filters."
          />
        ) : (
          <Table>
            <TableHead>
              <TableHeader>Thumbnail</TableHeader>
              <TableHeader>Template</TableHeader>
              <TableHeader>Category</TableHeader>
              <TableHeader>Type</TableHeader>
              <TableHeader>Orientation</TableHeader>
              <TableHeader>Pages</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Scope</TableHeader>
              <TableHeader className="text-right">Actions</TableHeader>
            </TableHead>
            <TableBody>
              {filtered.map((template) => (
                <tr key={template._id}>
                  <TableCell>
                    {template.thumbnailUrl ? (
                      <img
                        src={template.thumbnailUrl}
                        alt={template.name}
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-md bg-gray-100" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/layouts/templates/${template._id}`}
                      className="font-medium text-gray-900 hover:text-slate-700"
                    >
                      {template.name}
                    </Link>
                    <p className="mt-1 text-xs text-gray-500">
                      {template.canvasWidth} x {template.canvasHeight}{" "}
                      {template.unit}
                    </p>
                  </TableCell>
                  <TableCell>
                    {categoryById.get(template.categoryId)?.name ??
                      "Missing category"}
                  </TableCell>
                  <TableCell>{formatLabel(template.templateType)}</TableCell>
                  <TableCell>{formatLabel(template.orientation)}</TableCell>
                  <TableCell>
                    {template.pages.length || template.pageCount}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={template.status} />
                  </TableCell>
                  <TableCell>
                    <ScopeBadge scope={template.scope} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/layouts/templates/${template._id}`}
                        className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                      >
                        Open
                      </Link>
                      <button
                        onClick={() => handleDuplicate(template)}
                        className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleExport(template)}
                        className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
                        title="Export"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this layout template?"))
                            deleteTemplate(template._id);
                        }}
                        className="rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </tr>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      {importOpen && (
        <ImportTemplateModal
          categories={categories}
          onClose={() => setImportOpen(false)}
          onImported={async (template) => {
            setImportOpen(false);
            reload();
            navigate(`/layouts/templates/${template._id}`);
          }}
        />
      )}
    </div>
  );
}
