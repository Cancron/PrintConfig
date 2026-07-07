import type {
  LayoutElement,
  LayoutElementType,
  LayoutOrientation,
  LayoutStatus,
  LayoutTemplate,
  LayoutTemplatePage,
  LayoutTemplateType,
  ProductScope,
  ProductUnit,
} from "../../types";

export const templateTypeOptions: {
  value: LayoutTemplateType;
  label: string;
}[] = [
  { value: "photo_collage", label: "Photo Collage" },
  { value: "photo_book", label: "Photo Book" },
  { value: "calendar", label: "Calendar" },
  { value: "card", label: "Card" },
  { value: "poster", label: "Poster" },
  { value: "canvas", label: "Canvas" },
  { value: "custom", label: "Custom" },
];

export const orientationOptions: { value: LayoutOrientation; label: string }[] =
  [
    { value: "portrait", label: "Portrait" },
    { value: "landscape", label: "Landscape" },
    { value: "square", label: "Square" },
    { value: "custom", label: "Custom" },
  ];

export const statusOptions: { value: LayoutStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

export const unitOptions: { value: ProductUnit; label: string }[] = [
  { value: "inch", label: "Inch" },
  { value: "mm", label: "Millimeter" },
  { value: "px", label: "Pixel" },
];

export const scopeOptions: { value: ProductScope; label: string }[] = [
  { value: "shared", label: "Shared across all merchant sites" },
  { value: "merchant", label: "Only for selected merchant" },
];

export function createTemplate(
  accountId: string,
  _selectedMerchantId: string,
  categoryId: string,
): LayoutTemplate {
  const now = new Date().toISOString();
  return {
    _id: "",
    accountId,
    merchantId: null,
    scope: "shared",
    categoryId,
    name: "",
    slug: "",
    description: "",
    status: "draft",
    thumbnailUrl: "",
    templateType: "photo_collage",
    orientation: "square",
    pageCount: 1,
    canvasWidth: 12,
    canvasHeight: 12,
    unit: "inch",
    dpi: 300,
    backgroundColor: "#ffffff",
    tags: [],
    sortOrder: 0,
    pages: [createPage(1, 12, 12, "#ffffff")],
    createdAt: now,
    updatedAt: now,
  };
}

export function createPage(
  pageNumber: number,
  width: number,
  height: number,
  backgroundColor: string,
): LayoutTemplatePage {
  const now = new Date().toISOString();
  return {
    _id: "",
    clientId: crypto.randomUUID(),
    pageNumber,
    name: `Page ${pageNumber}`,
    width,
    height,
    backgroundColor,
    backgroundImageUrl: "",
    elements: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createElement(
  type: LayoutElementType,
  index: number,
): LayoutElement {
  const now = new Date().toISOString();
  return {
    _id: "",
    clientId: crypto.randomUUID(),
    type,
    name: formatLabel(type),
    x: 10,
    y: 10,
    width: type === "text_placeholder" ? 50 : 30,
    height: type === "text_placeholder" ? 12 : 30,
    rotation: 0,
    zIndex: index,
    locked: false,
    required: type === "photo_placeholder",
    editable: true,
    style: {},
    photoSettings: {
      fitMode: "cover",
      allowCrop: true,
      allowRotate: true,
      allowReplace: true,
      placeholderIndex: index,
      maskShape: "rectangle",
    },
    textSettings: {
      defaultText: type === "text_placeholder" ? "Your text here" : "",
      fontFamily: "Arial",
      fontSize: 24,
      fontWeight: "600",
      color: "#111827",
      textAlign: "center",
    },
    shapeSettings: {
      shapeType: "rectangle",
      fillColor: "#f3f4f6",
      strokeColor: "#111827",
      strokeWidth: 1,
      borderRadius: 4,
    },
    imageSettings: { imageUrl: "", opacity: 1 },
    createdAt: now,
    updatedAt: now,
  };
}

export function keyOf(value?: { _id?: string; clientId?: string }) {
  return value?._id || value?.clientId || "";
}
export function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
export function slugifyLocal(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
