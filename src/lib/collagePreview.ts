import previewImageUrl from "../assets/img-preview.jpg";
import { api } from "./api";
import type { Collage, ImageAsset, LayoutElement, ProductScope } from "../types";

const TARGET_BYTES = 10 * 1024;
const MAX_PREVIEW_SIZE = 200;

export interface GeneratedCollagePreview {
  asset: ImageAsset;
  blob: Blob;
  width: number;
  height: number;
}

export async function generateAndUploadCollagePreview(input: {
  collage: Collage;
  accountId: string;
  selectedMerchantId: string;
}): Promise<GeneratedCollagePreview> {
  const { collage, accountId, selectedMerchantId } = input;
  if (!collage._id) throw new Error("Save the collage before generating a preview image.");
  const rendered = await renderCollagePreview(collage);
  const filename = `${collage._id}-preview.webp`;
  const scope: ProductScope = collage.scope;
  const merchantId = scope === "merchant" ? (collage.merchantId || selectedMerchantId) : null;
  const file = new File([rendered.blob], filename, { type: rendered.blob.type || "image/webp" });
  const metadata = {
    accountId,
    merchantId,
    scope,
    folderId: null,
    name: `${collage.name || "Collage"} Preview`,
    filename,
    originalFilename: filename,
    thumbnailUrl: "",
    mimeType: file.type,
    sizeBytes: file.size,
    width: rendered.width,
    height: rendered.height,
    altText: `${collage.name || "Collage"} preview`,
    tags: ["collage-preview"],
  };
  const uploaded = await api.uploadImageAsset(file, metadata, collage.thumbnailAssetId);
  const versionedUrl = `${uploaded.publicUrl.split('?')[0]}?v=${Date.now()}`;
  const asset: ImageAsset = { ...uploaded, url: versionedUrl, publicUrl: versionedUrl, thumbnailUrl: versionedUrl };
  if (collage.thumbnailAssetId) await api.updateImageAsset(asset);
  return { ...rendered, asset };
}

async function renderCollagePreview(collage: Collage) {
  const sourceWidth = Math.max(1, Number(collage.canvasWidth) || 1);
  const sourceHeight = Math.max(1, Number(collage.canvasHeight) || 1);
  const ratio = sourceWidth / sourceHeight;
  const maxSizes = [MAX_PREVIEW_SIZE, 180, 160, 140, 120, 100, 80, 64];
  const photoPreview = await loadImage(previewImageUrl).catch(() => null);

  for (const maxSize of maxSizes) {
    const width = ratio >= 1 ? maxSize : Math.max(1, Math.round(maxSize * ratio));
    const height = ratio >= 1 ? Math.max(1, Math.round(maxSize / ratio)) : maxSize;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas preview generation is not supported in this browser.");
    await drawCollage(ctx, collage, width, height, photoPreview);
    const blob = await compactCanvas(canvas);
    if (blob.size <= TARGET_BYTES || maxSize === maxSizes[maxSizes.length - 1]) return { blob, width, height };
  }
  throw new Error("Could not generate a collage preview.");
}

async function drawCollage(
  ctx: CanvasRenderingContext2D,
  collage: Collage,
  width: number,
  height: number,
  photoPreview: HTMLImageElement | null,
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = collage.backgroundColor || "#ffffff";
  ctx.fillRect(0, 0, width, height);
  if (collage.backgroundImageUrl) {
    const background = await loadImage(collage.backgroundImageUrl).catch(() => null);
    if (background) drawImageFit(ctx, background, 0, 0, width, height, "cover");
  }
  const elements = [...collage.elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const element of elements) await drawElement(ctx, element, width, height, photoPreview);
}

async function drawElement(
  ctx: CanvasRenderingContext2D,
  element: LayoutElement,
  canvasWidth: number,
  canvasHeight: number,
  photoPreview: HTMLImageElement | null,
) {
  const x = (element.x / 100) * canvasWidth;
  const y = (element.y / 100) * canvasHeight;
  const width = Math.max(1, (element.width / 100) * canvasWidth);
  const height = Math.max(1, (element.height / 100) * canvasHeight);
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(((element.rotation || 0) * Math.PI) / 180);
  ctx.translate(-width / 2, -height / 2);
  clipElementBounds(ctx, element, width, height);

  if (element.type === "photo_placeholder") drawPhotoPlaceholder(ctx, element, width, height, photoPreview);
  else if (element.type === "text_placeholder") drawTextPlaceholder(ctx, element, width, height, canvasWidth);
  else if (element.type === "shape") drawShape(ctx, element, width, height);
  else if ((element.type === "static_image" || element.type === "clipart") && element.imageSettings.imageUrl) {
    const drewImage = await drawAsyncImage(ctx, element.imageSettings.imageUrl, width, height, element.imageSettings.opacity);
    if (!drewImage) drawImageFallback(ctx, width, height);
  } else {
    drawImageFallback(ctx, width, height);
  }

  ctx.restore();
}

function clipElementBounds(ctx: CanvasRenderingContext2D, element: LayoutElement, width: number, height: number) {
  if (element.type === "photo_placeholder" && element.photoSettings.maskShape === "circle") {
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    return;
  }
  if (element.type === "photo_placeholder" && element.photoSettings.maskShape === "rounded_rectangle") {
    roundedRect(ctx, 0, 0, width, height, Math.min(width, height) * 0.08);
    ctx.clip();
    return;
  }
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
}

function drawPhotoPlaceholder(
  ctx: CanvasRenderingContext2D,
  element: LayoutElement,
  width: number,
  height: number,
  photoPreview: HTMLImageElement | null,
) {
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(0, 0, width, height);
  if (photoPreview) drawImageFit(ctx, photoPreview, 0, 0, width, height, element.photoSettings.fitMode);
}

function drawTextPlaceholder(ctx: CanvasRenderingContext2D, element: LayoutElement, width: number, height: number, canvasWidth: number) {
  const settings = element.textSettings;
  const fontSize = Math.max(4, Math.min(height * 0.75, settings.fontSize * (canvasWidth / 600)));
  const padding = Math.max(1, canvasWidth / 300);
  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = toCanvasPaint(settings.color, "#111827");
  ctx.font = `${settings.fontWeight || "400"} ${fontSize}px ${settings.fontFamily || "Arial"}`;
  ctx.textBaseline = "top";
  ctx.textAlign = settings.textAlign;
  const maxTextWidth = Math.max(1, width - padding * 2);
  const lines = wrapText(ctx, settings.defaultText || element.name, maxTextWidth);
  const lineHeight = fontSize * 1.15;
  const totalHeight = lines.length * lineHeight;
  const textX = settings.textAlign === "left" ? padding : settings.textAlign === "right" ? width - padding : width / 2;
  let textY = Math.max(padding, (height - totalHeight) / 2);
  for (const line of lines) {
    if (textY > height - padding) break;
    ctx.fillText(line, textX, textY, maxTextWidth);
    textY += lineHeight;
  }
}

function drawShape(ctx: CanvasRenderingContext2D, element: LayoutElement, width: number, height: number) {
  const settings = element.shapeSettings;
  ctx.fillStyle = toCanvasPaint(settings.fillColor, "transparent");
  ctx.strokeStyle = toCanvasPaint(settings.strokeColor, "transparent");
  ctx.lineWidth = previewStrokeWidth(settings.strokeWidth);
  if (settings.shapeType === "circle") {
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  } else if (settings.shapeType === "line") {
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
  } else if (settings.shapeType === "path" && settings.svgPath) {
    drawSvgPath(ctx, settings.svgPath, settings.svgViewBox, width, height);
    return;
  } else {
    roundedRect(ctx, 0, 0, width, height, settings.borderRadius || 0);
  }
  if (settings.shapeType !== "line") ctx.fill();
  if (ctx.lineWidth > 0) ctx.stroke();
}

function drawSvgPath(ctx: CanvasRenderingContext2D, svgPath: string, svgViewBox: string | undefined, width: number, height: number) {
  if (typeof Path2D === "undefined") return;
  const [x, y, viewWidth, viewHeight] = parseViewBox(svgViewBox);
  ctx.save();
  ctx.scale(width / viewWidth, height / viewHeight);
  ctx.translate(-x, -y);
  const path = new Path2D(svgPath);
  ctx.fill(path);
  if (ctx.lineWidth > 0) ctx.stroke(path);
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const sourceLine of text.split(/\r?\n/)) {
    const words = sourceLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = words[0];
    for (const word of words.slice(1)) {
      const next = `${current} ${word}`;
      if (ctx.measureText(next).width <= maxWidth) current = next;
      else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
}

function previewStrokeWidth(strokeWidth: number) {
  if (!strokeWidth || strokeWidth <= 0) return 0;
  return Math.max(0.5, strokeWidth);
}

function toCanvasPaint(value: string | undefined, fallback: string) {
  const paint = (value || "").trim();
  if (!paint || paint.toLowerCase() === "none") return fallback;
  return paint;
}

function drawImageFallback(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = "rgba(15, 23, 42, 0.08)";
  ctx.fillRect(0, 0, width, height);
}

async function drawAsyncImage(ctx: CanvasRenderingContext2D, imageUrl: string, width: number, height: number, opacity = 1) {
  const image = await loadImage(imageUrl).catch(() => null);
  if (!image) return false;
  ctx.save();
  ctx.globalAlpha = opacity;
  drawImageFit(ctx, image, 0, 0, width, height, "contain");
  ctx.restore();
  return true;
}

function drawImageFit(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  fitMode: "cover" | "contain" | "stretch",
) {
  if (fitMode === "stretch") {
    ctx.drawImage(image, x, y, width, height);
    return;
  }
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  const cover = fitMode === "cover";
  const scaleByWidth = cover ? imageRatio < targetRatio : imageRatio > targetRatio;
  const drawWidth = scaleByWidth ? width : height * imageRatio;
  const drawHeight = scaleByWidth ? width / imageRatio : height;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function parseViewBox(value?: string) {
  const parts = (value || "0 0 100 100").split(/[\s,]+/).map(Number);
  return [
    Number.isFinite(parts[0]) ? parts[0] : 0,
    Number.isFinite(parts[1]) ? parts[1] : 0,
    Number.isFinite(parts[2]) && parts[2] > 0 ? parts[2] : 100,
    Number.isFinite(parts[3]) && parts[3] > 0 ? parts[3] : 100,
  ] as const;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be loaded."));
    image.src = src;
  });
}

async function compactCanvas(canvas: HTMLCanvasElement) {
  for (const quality of [0.72, 0.55, 0.42, 0.32, 0.24, 0.16, 0.1]) {
    const blob = await canvasToBlob(canvas, "image/webp", quality);
    if (blob.size <= TARGET_BYTES || quality === 0.1) return blob;
  }
  return canvasToBlob(canvas, "image/jpeg", 0.45);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create preview image."));
    }, type, quality);
  });
}
