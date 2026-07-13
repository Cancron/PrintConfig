import { Copy, Trash2 } from "lucide-react";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { ImageField } from "../gallery/ImageField";
import type {
  Collage,
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
import { Bool } from "./layoutTemplateShared";
import {
  orientationOptions,
  scopeOptions,
  statusOptions,
  templateTypeOptions,
  unitOptions,
  slugifyLocal,
  fontFamilyOptions,
} from "./layoutTemplateUtils";

export function TemplateSettings({
  template,
  selectedMerchantName,
  errors,
  onUpdate,
}: {
  template: LayoutTemplate;
  selectedMerchantName?: string;
  errors: Record<string, string>;
  onUpdate: <K extends keyof LayoutTemplate>(
    field: K,
    value: LayoutTemplate[K],
  ) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Template Settings</h2>
      <Input
        label="Name"
        value={template.name}
        onChange={(event) => {
          onUpdate("name", event.target.value);
          if (!template._id) onUpdate("slug", slugifyLocal(event.target.value));
        }}
        error={errors.name}
      />
      <Input
        label="Slug"
        value={template.slug}
        onChange={(event) => onUpdate("slug", event.target.value)}
        error={errors.slug}
      />
      <Textarea
        label="Description"
        value={template.description}
        onChange={(event) => onUpdate("description", event.target.value)}
        rows={2}
      />
      <Select
        label="Status"
        value={template.status}
        onChange={(event) =>
          onUpdate("status", event.target.value as LayoutStatus)
        }
        options={statusOptions}
        error={errors.status}
      />
      <Select
        label="Scope"
        value={template.scope}
        onChange={(event) =>
          onUpdate("scope", event.target.value as ProductScope)
        }
        options={scopeOptions}
        error={errors.scope}
      />
      {template.scope === "merchant" && (
        <p className="rounded-md bg-purple-50 p-2 text-xs text-purple-700 ring-1 ring-purple-200">
          This template belongs only to{" "}
          {selectedMerchantName ?? "the selected merchant"}.
        </p>
      )}
      <ImageField
        label="Thumbnail Image URL"
        url={template.thumbnailUrl}
        assetId={template.thumbnailAssetId}
        onChange={(url, assetId) => {
          onUpdate("thumbnailUrl", url);
          onUpdate("thumbnailAssetId", assetId);
        }}
      />
      <Select
        label="Template Type"
        value={template.templateType}
        onChange={(event) =>
          onUpdate("templateType", event.target.value as LayoutTemplateType)
        }
        options={templateTypeOptions}
        error={errors.templateType}
      />
      <Select
        label="Orientation"
        value={template.orientation}
        onChange={(event) =>
          onUpdate("orientation", event.target.value as LayoutOrientation)
        }
        options={orientationOptions}
        error={errors.orientation}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Canvas Width"
          type="number"
          value={template.canvasWidth}
          onChange={(event) =>
            onUpdate("canvasWidth", Number(event.target.value))
          }
          error={errors.canvasWidth}
        />
        <Input
          label="Canvas Height"
          type="number"
          value={template.canvasHeight}
          onChange={(event) =>
            onUpdate("canvasHeight", Number(event.target.value))
          }
          error={errors.canvasHeight}
        />
        <Select
          label="Unit"
          value={template.unit}
          onChange={(event) =>
            onUpdate("unit", event.target.value as ProductUnit)
          }
          options={unitOptions}
          error={errors.unit}
        />
        <Input
          label="DPI"
          type="number"
          value={template.dpi}
          onChange={(event) => onUpdate("dpi", Number(event.target.value))}
          error={errors.dpi}
        />
        <Input
          label="Sort Order"
          type="number"
          value={template.sortOrder}
          onChange={(event) =>
            onUpdate("sortOrder", Number(event.target.value))
          }
          error={errors.sortOrder}
        />
        <Input
          label="Background"
          type="color"
          value={template.backgroundColor}
          onChange={(event) => onUpdate("backgroundColor", event.target.value)}
        />
      </div>
      <Input
        label="Tags"
        value={template.tags.join(", ")}
        onChange={(event) =>
          onUpdate(
            "tags",
            event.target.value
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          )
        }
      />
    </section>
  );
}

export function PageSettings({
  page,
  collages = [],
  onUpdate,
}: {
  page: LayoutTemplatePage;
  collages?: Collage[];
  onUpdate: <K extends keyof LayoutTemplatePage>(
    field: K,
    value: LayoutTemplatePage[K],
  ) => void;
}) {
  return (
    <section className="space-y-3 pt-4">
      <h2 className="text-sm font-semibold text-gray-900">Page Settings</h2>
      <Input
        label="Page Name"
        value={page.name}
        onChange={(event) => onUpdate("name", event.target.value)}
      />
      <Select
        label="Collage"
        value={page.collageId ?? ""}
        onChange={(event) => onUpdate("collageId", event.target.value || null)}
        options={[{ value: "", label: "No collage selected" }, ...collages.map((collage) => ({ value: collage._id, label: collage.name }))]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Width"
          type="number"
          value={page.width}
          onChange={(event) => onUpdate("width", Number(event.target.value))}
        />
        <Input
          label="Height"
          type="number"
          value={page.height}
          onChange={(event) => onUpdate("height", Number(event.target.value))}
        />
        <Input
          label="Background"
          type="color"
          value={page.backgroundColor}
          onChange={(event) => onUpdate("backgroundColor", event.target.value)}
        />
      </div>
      <ImageField
        label="Background Image URL"
        url={page.backgroundImageUrl}
        assetId={page.backgroundImageAssetId}
        onChange={(url, assetId) => {
          onUpdate("backgroundImageUrl", url);
          onUpdate("backgroundImageAssetId", assetId);
        }}
      />
    </section>
  );
}

export function ElementSettings({
  element,
  onUpdate,
  onDuplicate,
  onDelete,
}: {
  element: LayoutElement;
  onUpdate: (updater: (element: LayoutElement) => LayoutElement) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const set = <K extends keyof LayoutElement>(
    field: K,
    value: LayoutElement[K],
  ) => onUpdate((item) => ({ ...item, [field]: value }));
  return (
    <section className="space-y-3 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Element Settings
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onDuplicate}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-md p-2 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <Input
        label="Name"
        value={element.name}
        onChange={(event) => set("name", event.target.value)}
      />
      <Select
        label="Type"
        value={element.type}
        onChange={(event) =>
          set("type", event.target.value as LayoutElementType)
        }
        options={[
          { value: "photo_placeholder", label: "Photo Placeholder" },
          { value: "text_placeholder", label: "Text Placeholder" },
          { value: "shape", label: "Shape" },
          { value: "background", label: "Background" },
          { value: "clipart", label: "Clipart" },
          { value: "static_image", label: "Static Image" },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="X %"
          type="number"
          value={element.x}
          onChange={(event) => set("x", Number(event.target.value))}
        />
        <Input
          label="Y %"
          type="number"
          value={element.y}
          onChange={(event) => set("y", Number(event.target.value))}
        />
        <Input
          label="Width %"
          type="number"
          value={element.width}
          onChange={(event) => set("width", Number(event.target.value))}
        />
        <Input
          label="Height %"
          type="number"
          value={element.height}
          onChange={(event) => set("height", Number(event.target.value))}
        />
        <Input
          label="Rotation"
          type="number"
          value={element.rotation}
          onChange={(event) => set("rotation", Number(event.target.value))}
        />
        <Input
          label="Z Index"
          type="number"
          value={element.zIndex}
          onChange={(event) => set("zIndex", Number(event.target.value))}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Bool
          label="Locked"
          value={element.locked}
          onChange={(value) => set("locked", value)}
        />
        <Bool
          label="Required"
          value={element.required}
          onChange={(value) => set("required", value)}
        />
        <Bool
          label="Editable"
          value={element.editable}
          onChange={(value) => set("editable", value)}
        />
      </div>
      {element.type === "photo_placeholder" && (
        <PhotoSettings element={element} onUpdate={onUpdate} />
      )}
      {element.type === "text_placeholder" && (
        <TextSettings element={element} onUpdate={onUpdate} />
      )}
      {element.type === "shape" && (
        <ShapeSettings element={element} onUpdate={onUpdate} />
      )}
      {(element.type === "static_image" || element.type === "clipart") && (
        <ImageField
          label="Image URL"
          url={element.imageSettings.imageUrl}
          assetId={element.imageSettings.imageAssetId}
          onChange={(url, assetId) =>
            onUpdate((item) => ({
              ...item,
              imageSettings: {
                ...item.imageSettings,
                imageUrl: url,
                imageAssetId: assetId,
              },
            }))
          }
        />
      )}
    </section>
  );
}

function PhotoSettings({
  element,
  onUpdate,
}: {
  element: LayoutElement;
  onUpdate: (updater: (element: LayoutElement) => LayoutElement) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Select
        label="Fit Mode"
        value={element.photoSettings.fitMode}
        onChange={(event) =>
          onUpdate((item) => ({
            ...item,
            photoSettings: {
              ...item.photoSettings,
              fitMode: event.target
                .value as LayoutElement["photoSettings"]["fitMode"],
            },
          }))
        }
        options={[
          { value: "cover", label: "Cover" },
          { value: "contain", label: "Contain" },
          { value: "stretch", label: "Stretch" },
        ]}
      />
      <Select
        label="Mask Shape"
        value={element.photoSettings.maskShape}
        onChange={(event) =>
          onUpdate((item) => ({
            ...item,
            photoSettings: {
              ...item.photoSettings,
              maskShape: event.target
                .value as LayoutElement["photoSettings"]["maskShape"],
            },
          }))
        }
        options={[
          { value: "rectangle", label: "Rectangle" },
          { value: "circle", label: "Circle" },
          { value: "rounded_rectangle", label: "Rounded Rectangle" },
          { value: "custom", label: "Custom" },
        ]}
      />
      <Input
        label="Placeholder Index"
        type="number"
        value={element.photoSettings.placeholderIndex}
        onChange={(event) =>
          onUpdate((item) => ({
            ...item,
            photoSettings: {
              ...item.photoSettings,
              placeholderIndex: Number(event.target.value),
            },
          }))
        }
      />
      <Bool
        label="Crop"
        value={element.photoSettings.allowCrop}
        onChange={(value) =>
          onUpdate((item) => ({
            ...item,
            photoSettings: { ...item.photoSettings, allowCrop: value },
          }))
        }
      />
      <Bool
        label="Rotate"
        value={element.photoSettings.allowRotate}
        onChange={(value) =>
          onUpdate((item) => ({
            ...item,
            photoSettings: { ...item.photoSettings, allowRotate: value },
          }))
        }
      />
      <Bool
        label="Replace"
        value={element.photoSettings.allowReplace}
        onChange={(value) =>
          onUpdate((item) => ({
            ...item,
            photoSettings: { ...item.photoSettings, allowReplace: value },
          }))
        }
      />
    </div>
  );
}

function TextSettings({
  element,
  onUpdate,
}: {
  element: LayoutElement;
  onUpdate: (updater: (element: LayoutElement) => LayoutElement) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Textarea
        label="Default Text"
        value={element.textSettings.defaultText}
        onChange={(event) =>
          onUpdate((item) => ({
            ...item,
            textSettings: {
              ...item.textSettings,
              defaultText: event.target.value,
            },
          }))
        }
        rows={2}
      />
      <Select
        label="Font Family"
        value={element.textSettings.fontFamily}
        onChange={(event) =>
          onUpdate((item) => ({
            ...item,
            textSettings: {
              ...item.textSettings,
              fontFamily: event.target.value,
            },
          }))
        }
        options={fontFamilyOptions}
      />
      <Input
        label="Font Size"
        type="number"
        value={element.textSettings.fontSize}
        onChange={(event) =>
          onUpdate((item) => ({
            ...item,
            textSettings: {
              ...item.textSettings,
              fontSize: Number(event.target.value),
            },
          }))
        }
      />
      <Input
        label="Font Weight"
        value={element.textSettings.fontWeight}
        onChange={(event) =>
          onUpdate((item) => ({
            ...item,
            textSettings: {
              ...item.textSettings,
              fontWeight: event.target.value,
            },
          }))
        }
      />
      <Input
        label="Color"
        type="color"
        value={element.textSettings.color}
        onChange={(event) =>
          onUpdate((item) => ({
            ...item,
            textSettings: { ...item.textSettings, color: event.target.value },
          }))
        }
      />
      <Select
        label="Text Align"
        value={element.textSettings.textAlign}
        onChange={(event) =>
          onUpdate((item) => ({
            ...item,
            textSettings: {
              ...item.textSettings,
              textAlign: event.target
                .value as LayoutElement["textSettings"]["textAlign"],
            },
          }))
        }
        options={[
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ]}
      />
      <Input
        label="Max Characters"
        type="number"
        value={element.textSettings.maxCharacters ?? ""}
        onChange={(event) =>
          onUpdate((item) => ({
            ...item,
            textSettings: {
              ...item.textSettings,
              maxCharacters: event.target.value
                ? Number(event.target.value)
                : undefined,
            },
          }))
        }
      />
    </div>
  );
}

function ShapeSettings({
  element,
  onUpdate,
}: {
  element: LayoutElement;
  onUpdate: (updater: (element: LayoutElement) => LayoutElement) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Select
        label="Shape Type"
        value={element.shapeSettings.shapeType}
        onChange={(event) =>
          onUpdate((item) => ({
            ...item,
            shapeSettings: {
              ...item.shapeSettings,
              shapeType: event.target
                .value as LayoutElement["shapeSettings"]["shapeType"],
            },
          }))
        }
        options={[
          { value: "rectangle", label: "Rectangle" },
          { value: "circle", label: "Circle" },
          { value: "line", label: "Line" },
          { value: "path", label: "SVG Path" },
        ]}
      />
      <Input
        label="Fill"
        type={element.shapeSettings.shapeType === "path" ? "text" : "color"}
        value={element.shapeSettings.fillColor}
        onChange={(event) =>
          onUpdate((item) => ({
            ...item,
            shapeSettings: {
              ...item.shapeSettings,
              fillColor: event.target.value,
            },
          }))
        }
      />
      <Input
        label="Stroke"
        type={element.shapeSettings.shapeType === "path" ? "text" : "color"}
        value={element.shapeSettings.strokeColor}
        onChange={(event) =>
          onUpdate((item) => ({
            ...item,
            shapeSettings: {
              ...item.shapeSettings,
              strokeColor: event.target.value,
            },
          }))
        }
      />
      <Input
        label="Stroke Width"
        type="number"
        value={element.shapeSettings.strokeWidth}
        onChange={(event) =>
          onUpdate((item) => ({
            ...item,
            shapeSettings: {
              ...item.shapeSettings,
              strokeWidth: Number(event.target.value),
            },
          }))
        }
      />
      <Input
        label="Border Radius"
        type="number"
        value={element.shapeSettings.borderRadius}
        onChange={(event) =>
          onUpdate((item) => ({
            ...item,
            shapeSettings: {
              ...item.shapeSettings,
              borderRadius: Number(event.target.value),
            },
          }))
        }
      />
      {element.shapeSettings.shapeType === "path" && (
        <>
          <Textarea
            label="SVG Path"
            className="col-span-2 font-mono"
            rows={4}
            value={element.shapeSettings.svgPath ?? ""}
            onChange={(event) =>
              onUpdate((item) => ({
                ...item,
                shapeSettings: {
                  ...item.shapeSettings,
                  svgPath: event.target.value,
                },
              }))
            }
          />
          <Input
            label="SVG ViewBox"
            className="col-span-2 font-mono"
            value={element.shapeSettings.svgViewBox ?? ""}
            onChange={(event) =>
              onUpdate((item) => ({
                ...item,
                shapeSettings: {
                  ...item.shapeSettings,
                  svgViewBox: event.target.value,
                },
              }))
            }
          />
        </>
      )}
    </div>
  );
}
