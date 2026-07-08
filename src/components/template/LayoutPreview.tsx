import type { PointerEvent } from "react";
import type { LayoutElement, LayoutTemplatePage } from "../../types";
import previewImage from "../../assets/img-preview.jpeg";
import { formatLabel, keyOf } from "./layoutTemplateUtils";

interface LayoutPreviewProps {
  page?: LayoutTemplatePage;
  selectedElementId: string;
  onSelect: (id: string) => void;
  onChange: (
    id: string,
    updater: (element: LayoutElement) => LayoutElement,
  ) => void;
  previewMode: boolean;
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const resizeHandles: ResizeHandle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

export function LayoutPreview({
  page,
  selectedElementId,
  onSelect,
  onChange,
  previewMode,
}: LayoutPreviewProps) {
  if (!page)
    return (
      <div className="rounded-lg bg-white p-8 text-center text-sm text-gray-500 ring-1 ring-gray-200">
        No page selected.
      </div>
    );

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }
  function toPercent(event: PointerEvent, rect: DOMRect) {
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  function startDrag(
    event: PointerEvent<HTMLElement | SVGElement>,
    element: LayoutElement,
  ) {
    if (previewMode || element.locked) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(keyOf(element));
    const canvas = event.currentTarget.closest('[data-layout-canvas="true"]');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const start = toPercent(event, rect);
    const origin = { x: element.x, y: element.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    function move(moveEvent: globalThis.PointerEvent) {
      const current = {
        x: ((moveEvent.clientX - rect.left) / rect.width) * 100,
        y: ((moveEvent.clientY - rect.top) / rect.height) * 100,
      };
      const nextX = clamp(
        origin.x + current.x - start.x,
        0,
        100 - element.width,
      );
      const nextY = clamp(
        origin.y + current.y - start.y,
        0,
        100 - element.height,
      );
      onChange(keyOf(element), (item) => ({
        ...item,
        x: Number(nextX.toFixed(2)),
        y: Number(nextY.toFixed(2)),
      }));
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  function startResize(
    event: PointerEvent<HTMLButtonElement>,
    element: LayoutElement,
    handle: ResizeHandle,
  ) {
    if (previewMode || element.locked) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(keyOf(element));
    const canvas = event.currentTarget.closest('[data-layout-canvas="true"]');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const start = toPercent(event, rect);
    const origin = {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    function move(moveEvent: globalThis.PointerEvent) {
      const current = {
        x: ((moveEvent.clientX - rect.left) / rect.width) * 100,
        y: ((moveEvent.clientY - rect.top) / rect.height) * 100,
      };
      const dx = current.x - start.x;
      const dy = current.y - start.y;
      let nextX = origin.x;
      let nextY = origin.y;
      let nextWidth = origin.width;
      let nextHeight = origin.height;
      if (handle.includes("e"))
        nextWidth = clamp(origin.width + dx, 1, 100 - origin.x);
      if (handle.includes("s"))
        nextHeight = clamp(origin.height + dy, 1, 100 - origin.y);
      if (handle.includes("w")) {
        nextX = clamp(origin.x + dx, 0, origin.x + origin.width - 1);
        nextWidth = clamp(origin.width + origin.x - nextX, 1, 100 - nextX);
      }
      if (handle.includes("n")) {
        nextY = clamp(origin.y + dy, 0, origin.y + origin.height - 1);
        nextHeight = clamp(origin.height + origin.y - nextY, 1, 100 - nextY);
      }
      onChange(keyOf(element), (item) => ({
        ...item,
        x: Number(nextX.toFixed(2)),
        y: Number(nextY.toFixed(2)),
        width: Number(nextWidth.toFixed(2)),
        height: Number(nextHeight.toFixed(2)),
      }));
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <div className="mx-auto w-full max-w-[600px]">
        <div
          data-layout-canvas="true"
          className="relative mx-auto overflow-hidden rounded-md touch-none select-none ring-1 ring-gray-300"
          style={{
            aspectRatio: `${page.width} / ${page.height}`,
            backgroundColor: page.backgroundColor,
            backgroundImage: page.backgroundImageUrl
              ? `url(${page.backgroundImageUrl})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {[...page.elements]
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((element) => {
              const selected = keyOf(element) === selectedElementId;
              const pathShape =
                element.type === "shape" &&
                element.shapeSettings.shapeType === "path" &&
                Boolean(element.shapeSettings.svgPath);
              return (
                <div
                  key={keyOf(element)}
                  onPointerDown={
                    pathShape
                      ? undefined
                      : (event) => startDrag(event, element)
                  }
                  onClick={
                    pathShape ? undefined : () => onSelect(keyOf(element))
                  }
                  className={`absolute overflow-hidden text-xs ${pathShape ? "" : "border"} ${previewMode ? "cursor-default" : element.locked ? "cursor-not-allowed" : "cursor-move"} ${pathShape ? "" : selected ? "border-slate-900 ring-2 ring-slate-900" : "border-dashed border-slate-500"}`}
                  style={{
                    left: `${element.x}%`,
                    top: `${element.y}%`,
                    width: `${element.width}%`,
                    height: `${element.height}%`,
                    transform: `rotate(${element.rotation}deg)`,
                    zIndex: element.zIndex,
                    background:
                      element.type === "shape" &&
                      element.shapeSettings.shapeType !== "path"
                        ? element.shapeSettings.fillColor
                        : element.type === "text_placeholder"
                          ? "rgba(255,255,255,0.78)"
                          : element.type === "shape"
                            ? "transparent"
                            : "rgba(15,23,42,0.08)",
                    borderRadius:
                      element.type === "photo_placeholder" &&
                      element.photoSettings.maskShape === "circle"
                        ? "9999px"
                        : element.shapeSettings.borderRadius || 4,
                    pointerEvents: pathShape ? "none" : undefined,
                  }}
                >
                  {renderElement(element, {
                    selected,
                    previewMode,
                    onPathPointerDown: (event) => startDrag(event, element),
                  })}
                  {selected &&
                    !previewMode &&
                    !element.locked &&
                    resizeHandles.map((handle) => (
                      <button
                        key={handle}
                        type="button"
                        aria-label={`Resize ${handle}`}
                        onPointerDown={(event) =>
                          startResize(event, element, handle)
                        }
                        className={`absolute h-3 w-3 rounded-full border border-slate-900 bg-white shadow ${handleClass(handle)}`}
                        style={{ pointerEvents: "auto" }}
                      />
                    ))}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function renderElement(
  element: LayoutElement,
  options?: {
    selected?: boolean;
    previewMode?: boolean;
    onPathPointerDown?: (event: PointerEvent<SVGPathElement>) => void;
  },
) {
  if (element.type === "photo_placeholder")
    return (
      <div className="relative h-full w-full overflow-hidden">
        <img src={previewImage} alt="" className="h-full w-full object-cover" />
        {/* <span className="absolute inset-0 flex items-center justify-center bg-slate-900/10 p-1 text-center text-[11px] font-semibold leading-tight text-white drop-shadow">
          {element.name}
        </span> */}
      </div>
    );
  if (element.type === "text_placeholder") {
    const settings = element.textSettings;
    return (
      <div
        className="flex h-full w-full items-center overflow-hidden p-1 leading-tight"
        style={{
          color: settings.color,
          fontFamily: settings.fontFamily,
          fontSize: `${settings.fontSize}px`,
          fontWeight: settings.fontWeight,
        }}
      >
        <span
          className="block w-full whitespace-pre-wrap"
          style={{ textAlign: settings.textAlign }}
        >
          {settings.defaultText || element.name}
        </span>
      </div>
    );
  }
  if (
    (element.type === "static_image" || element.type === "clipart") &&
    element.imageSettings.imageUrl
  )
    return (
      <img
        src={element.imageSettings.imageUrl}
        alt=""
        className="h-full w-full object-contain"
        style={{ opacity: element.imageSettings.opacity }}
      />
    );
  if (
    element.type === "shape" &&
    element.shapeSettings.shapeType === "path" &&
    element.shapeSettings.svgPath
  ) {
    return (
      <svg
        className="h-full w-full overflow-visible"
        viewBox={element.shapeSettings.svgViewBox || "0 0 100 100"}
        preserveAspectRatio="none"
        aria-label={element.name}
        style={{ pointerEvents: "auto" }}
      >
        <path
          d={element.shapeSettings.svgPath}
          fill={element.shapeSettings.fillColor || "none"}
          stroke={element.shapeSettings.strokeColor || "none"}
          strokeWidth={element.shapeSettings.strokeWidth || 0}
          className={options?.previewMode ? "cursor-default" : "cursor-move"}
          style={{ pointerEvents: "visiblePainted" }}
          onPointerDown={
            options?.previewMode ? undefined : options?.onPathPointerDown
          }
        />
        {options?.selected && !options.previewMode && (
          <path
            d={element.shapeSettings.svgPath}
            fill="none"
            stroke="#0f172a"
            strokeWidth={Math.max(element.shapeSettings.strokeWidth || 1, 2)}
            strokeDasharray="6 4"
            pointerEvents="none"
          />
        )}
      </svg>
    );
  }
  return (
    <span className="flex h-full w-full items-center justify-center text-slate-700">
      {formatLabel(element.type)}
    </span>
  );
}

function handleClass(handle: ResizeHandle) {
  const classes: Record<ResizeHandle, string> = {
    nw: "-left-1.5 -top-1.5 cursor-nwse-resize",
    n: "left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize",
    ne: "-right-1.5 -top-1.5 cursor-nesw-resize",
    e: "-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize",
    se: "-bottom-1.5 -right-1.5 cursor-nwse-resize",
    s: "-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize",
    sw: "-bottom-1.5 -left-1.5 cursor-nesw-resize",
    w: "-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize",
  };
  return classes[handle];
}
