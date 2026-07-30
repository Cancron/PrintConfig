/* eslint-disable @typescript-eslint/no-explicit-any */
import { Canvas, Path2D, loadImage, type CanvasRenderingContext2D, type Image } from 'skia-canvas';

const EDITOR_PAGE_REFERENCE_WIDTH = 496;
const EMPTY_TEXT_VALUES = new Set(['Add text', 'Add heading', 'Add subtitle', 'Add caption']);
const CLIPART: Array<{ id: string; path: string; viewBox?: string }> = [
  { id: 'heart', path: 'M50 88 L14 52 C4 42 4 26 14 16 C24 6 40 6 50 16 C60 6 76 6 86 16 C96 26 96 42 86 52 Z' },
  { id: 'star', path: 'M50 6 L61 38 L95 38 L67 58 L78 90 L50 70 L22 90 L33 58 L5 38 L39 38 Z' },
  { id: 'circle', path: 'M50 10 a40 40 0 1 0 0.001 0 Z' },
  { id: 'flower', path: 'M50 20 C60 20 66 32 60 42 C72 36 84 46 78 58 C86 66 78 80 66 76 C66 88 54 92 46 84 C38 92 26 88 26 76 C14 80 6 66 14 58 C8 46 20 36 32 42 C26 32 32 20 42 20 Z' },
  { id: 'arrow', path: 'M10 45 H70 V30 L92 50 L70 70 V55 H10 Z' },
  { id: 'badge', path: 'M20 20 H80 V70 L50 88 L20 70 Z' },
  { id: 'sparkle', path: 'M50 8 L56 40 L88 46 L56 52 L50 84 L44 52 L12 46 L44 40 Z' },
  { id: 'camera', path: 'M15 30 H35 L40 22 H60 L65 30 H85 V78 H15 Z M50 55 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0' },
];
type SvgMaskElement =
  | { type: 'rect'; x: number; y: number; width: number; height: number; rx?: number }
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { type: 'polygon'; points: string }
  | { type: 'path'; d: string };

interface ImageMaskDefinition {
  id: string;
  label: string;
  viewBox: string;
  aspectRatio?: number;
  elements: SvgMaskElement[];
}

const IMAGE_MASKS: ImageMaskDefinition[] = [
  {
    id: 'rect',
    label: 'Rectangle',
    viewBox: '0 0 100 100',
    elements: [{ type: 'rect', x: 0, y: 0, width: 100, height: 100 }],
  },
  {
    id: 'circle',
    label: 'Circle',
    viewBox: '0 0 100 100',
    aspectRatio: 1,
    elements: [{ type: 'circle', cx: 50, cy: 50, r: 50 }],
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    viewBox: '0 0 100 68',
    aspectRatio: 100 / 68,
    elements: [{ type: 'ellipse', cx: 50, cy: 34, rx: 50, ry: 34 }],
  },
  {
    id: 'triangle',
    label: 'Triangle',
    viewBox: '0 0 100 100',
    aspectRatio: 1,
    elements: [{ type: 'polygon', points: '50,0 100,100 0,100' }],
  },
  {
    id: 'diamond',
    label: 'Diamond',
    viewBox: '0 0 100 100',
    aspectRatio: 1,
    elements: [{ type: 'polygon', points: '50,0 100,50 50,100 0,50' }],
  },
  {
    id: 'heart',
    label: 'Heart',
    viewBox: '0 0 1000 1330',
    aspectRatio: 1000 / 1330,
    elements: [
      {
        type: 'path',
        d: 'M510.69,673.08h370c28.08-51.11,44.06-103.69,47.35-153s-6.11-95.27-28.75-133.2a248,248,0,0,0-47.87-57.16c-23.16-20.42-53.66-39.36-91.83-48.27-33.71-7.86-64.65-5.86-90.14-.59s-45.54,13.82-57.46,19a323,323,0,0,0-60.59,35,299.31,299.31,0,0,0-40.74,35.59V673.08Z',
      },
      {
        type: 'path',
        d: 'M489.31,673.08V370.53a299.31,299.31,0,0,0-40.74-35.59,323,323,0,0,0-60.59-35c-11.92-5.22-32-13.76-57.46-19s-56.43-7.27-90.14.59c-38.17,8.91-68.67,27.85-91.83,48.27a248,248,0,0,0-47.87,57.16c-22.64,37.93-32,83.92-28.75,133.2s19.26,101.86,47.35,153h370Z',
      },
      {
        type: 'path',
        d: 'M510.69,694.47H131.78Q143.3,713,156.94,731.05t29.41,35.41L343.17,910.11,500,1053.75,656.83,910.11,813.65,766.46q15.76-17.34,29.41-35.41t25.16-36.58H510.69Z',
      },
    ],
  },
];

export interface RenderDesignPageInput {
  design: unknown;
  page: Record<string, any>;
  cartItem?: Record<string, any>;
  widthPx: number;
  heightPx: number;
  format?: 'png' | 'jpeg';
  quality?: number;
  transparentBackground?: boolean;
}

export async function renderDesignPageToImageBuffer(input: RenderDesignPageInput) {
  const canvas = new Canvas(input.widthPx, input.heightPx);
  const ctx = canvas.getContext('2d');
  const design = isRecord(input.design) ? input.design : {};
  const styleScale = input.widthPx / EDITOR_PAGE_REFERENCE_WIDTH;
  const photoUrlById = getPhotoUrlMap(design, input.cartItem);
  const transparentBackground = input.format !== 'jpeg' && input.transparentBackground === true;

  // JPEG has no alpha channel, so establish a white matte before page artwork.
  if (input.format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, input.widthPx, input.heightPx);
  }

  await drawPageBackground(
    ctx,
    input.page,
    design,
    input.widthPx,
    input.heightPx,
    styleScale,
    transparentBackground,
  );

  const elements = Array.isArray(input.page.elements) ? input.page.elements.filter(isRecord) : [];
  const sorted = elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => Number(a.element.zIndex ?? 0) - Number(b.element.zIndex ?? 0) || a.index - b.index)
    .map(({ element }) => element);

  for (const element of sorted) {
    if (isEmptyElement(element, photoUrlById)) continue;
    await drawElement(ctx, element, photoUrlById, input.widthPx, input.heightPx, styleScale);
  }

  if (input.format === 'jpeg') {
    return canvas.toBuffer('jpeg', { quality: clamp(input.quality ?? 0.94, 0.01, 1) });
  }
  return canvas.toBuffer('png');
}

async function drawPageBackground(
  ctx: CanvasRenderingContext2D,
  page: Record<string, any>,
  design: Record<string, any>,
  width: number,
  height: number,
  styleScale: number,
  transparentBackground: boolean,
) {
  const color = stringValue(page.backgroundColor, stringValue(design.backgroundColor, '#ffffff'));
  ctx.save();
  if (!transparentBackground) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  }

  const backgroundUrl = stringValue(page.backgroundImageUrl, stringValue(design.backgroundImageUrl, ''));
  if (backgroundUrl) {
    const background = await loadOptionalImage(backgroundUrl);
    if (background) drawImageFit(ctx, background, 0, 0, width, height, 'cover');
  }

  drawBackgroundPattern(ctx, stringValue(page.backgroundPattern, stringValue(design.backgroundPattern, 'none')), width, height, styleScale);
  ctx.restore();
}

function drawBackgroundPattern(ctx: CanvasRenderingContext2D, pattern: string, width: number, height: number, styleScale: number) {
  if (pattern === 'dots') {
    drawDotPattern(ctx, width, height, 16 * styleScale, 1 * styleScale, 'rgba(0,0,0,0.15)');
  } else if (pattern === 'grid') {
    const spacing = 20 * styleScale;
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1 * styleScale;
    for (let x = 0; x <= width; x += spacing) line(ctx, x, 0, x, height);
    for (let y = 0; y <= height; y += spacing) line(ctx, 0, y, width, y);
  } else if (pattern === 'diagonal') {
    drawDiagonalPattern(ctx, width, height, styleScale);
  } else if (pattern === 'paper') {
    drawDotPattern(ctx, width, height, 12 * styleScale, 1 * styleScale, 'rgba(120,90,60,0.08)');
    drawDotPattern(ctx, width, height, 20 * styleScale, 1 * styleScale, 'rgba(120,90,60,0.06)', 6 * styleScale, 6 * styleScale);
  }
}

async function drawElement(
  ctx: CanvasRenderingContext2D,
  element: Record<string, any>,
  photoUrlById: Record<string, string>,
  canvasWidth: number,
  canvasHeight: number,
  styleScale: number,
) {
  const box = {
    x: (numberValue(element.x, 0) / 100) * canvasWidth,
    y: (numberValue(element.y, 0) / 100) * canvasHeight,
    width: Math.max(1, (numberValue(element.width, 0) / 100) * canvasWidth),
    height: Math.max(1, (numberValue(element.height, 0) / 100) * canvasHeight),
  };

  ctx.save();
  ctx.translate(box.x + box.width / 2, box.y + box.height / 2);
  ctx.rotate((numberValue(element.rotation, 0) * Math.PI) / 180);
  ctx.translate(-box.width / 2, -box.height / 2);

  if (element.type === 'image') await drawPhotoBookImage(ctx, element, photoUrlById, box.width, box.height, styleScale);
  else if (element.type === 'text') drawPhotoBookText(ctx, element, box.width, box.height, styleScale);
  else if (element.type === 'clipart') drawClipart(ctx, element, box.width, box.height);
  else if (element.type === 'photo_placeholder') await drawLayoutPhoto(ctx, element, photoUrlById, box.width, box.height);
  else if (element.type === 'text_placeholder') drawLayoutText(ctx, element, box.width, box.height, canvasWidth);
  else if (element.type === 'shape') drawLayoutShape(ctx, element, box.width, box.height);
  else if (element.type === 'static_image') await drawLayoutStaticImage(ctx, element, box.width, box.height);

  ctx.restore();
}

async function drawPhotoBookImage(
  ctx: CanvasRenderingContext2D,
  element: Record<string, any>,
  photoUrlById: Record<string, string>,
  width: number,
  height: number,
  styleScale: number,
) {
  const content = isRecord(element.content) ? element.content : {};
  const style = isRecord(element.style) ? element.style : {};
  const url = stringValue(content.url, content.photoId ? photoUrlById[String(content.photoId)] : '');
  if (!url) return;
  const image = await loadOptionalImage(url);
  if (!image) return;

  const radius = numberValue(style.borderRadius, 0) * styleScale;
  const borderWidth = numberValue(style.borderWidth, 0) * styleScale;
  const mask = resolveImageMask(style);
  if (mask !== IMAGE_MASKS[0]) {
    const maskGeometry = createMaskGeometry(mask, width, height);
    ctx.save();
    ctx.globalAlpha *= numberValue(style.opacity, 1);
    if (style.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 24 * styleScale;
      ctx.shadowOffsetY = 8 * styleScale;
    }
    ctx.clip(maskGeometry.path);
    ctx.filter = stringValue(style.filter, 'none');
    const drawBox = getImageDrawBox(
      image.width,
      image.height,
      maskGeometry.width,
      maskGeometry.height,
      stringValue(style.objectFit, 'cover') as 'cover' | 'contain' | 'fill',
      numberValue(style.imageScale, 1),
      numberValue(style.objectPositionX, 50),
      numberValue(style.objectPositionY, 50),
    );
    ctx.drawImage(
      image,
      maskGeometry.x + drawBox.x,
      maskGeometry.y + drawBox.y,
      drawBox.width,
      drawBox.height,
    );
    ctx.restore();

    if (borderWidth > 0) {
      ctx.save();
      ctx.globalAlpha *= numberValue(style.opacity, 1);
      ctx.strokeStyle = stringValue(style.borderColor, '#000000');
      ctx.lineWidth = borderWidth;
      ctx.lineJoin = 'round';
      ctx.stroke(maskGeometry.path);
      ctx.restore();
    }
    return;
  }

  const contentX = borderWidth;
  const contentY = borderWidth;
  const contentWidth = Math.max(0, width - borderWidth * 2);
  const contentHeight = Math.max(0, height - borderWidth * 2);
  const contentRadius = Math.max(0, radius - borderWidth);

  ctx.save();
  ctx.globalAlpha *= numberValue(style.opacity, 1);
  if (style.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 24 * styleScale;
    ctx.shadowOffsetY = 8 * styleScale;
  }
  if (borderWidth > 0) {
    ctx.fillStyle = stringValue(style.borderColor, '#000000');
    roundedRect(ctx, 0, 0, width, height, radius);
    ctx.fill();
  }

  roundedRect(ctx, contentX, contentY, contentWidth, contentHeight, contentRadius);
  ctx.clip();
  ctx.filter = stringValue(style.filter, 'none');

  const drawBox = getImageDrawBox(
    image.width,
    image.height,
    contentWidth,
    contentHeight,
    stringValue(style.objectFit, 'cover') as 'cover' | 'contain' | 'fill',
    numberValue(style.imageScale, 1),
    numberValue(style.objectPositionX, 50),
    numberValue(style.objectPositionY, 50),
  );
  ctx.drawImage(image, contentX + drawBox.x, contentY + drawBox.y, drawBox.width, drawBox.height);
  ctx.restore();
}

function drawPhotoBookText(ctx: CanvasRenderingContext2D, element: Record<string, any>, width: number, height: number, styleScale: number) {
  const content = stringValue(element.content, '').trim();
  if (!content || EMPTY_TEXT_VALUES.has(content)) return;
  const style = isRecord(element.style) ? element.style : {};
  const opacity = clamp(numberValue(style.opacity, 1), 0, 1);
  const fontSize = numberValue(style.fontSize, 24) * styleScale;
  const lineHeight = fontSize * numberValue(style.lineHeight, 1.2);
  const fontWeight = style.bold ? '700' : stringValue(style.fontWeight, '400');
  const fontFamily = quoteFontFamily(stringValue(style.fontFamily, 'Arial'));
  const backgroundColor = stringValue(style.backgroundColor, '#ffffff');
  const backgroundOpacity = clamp(numberValue(style.backgroundOpacity, 0), 0, 1);
  const padding = Math.max(0, numberValue(style.backgroundPadding, 0) * styleScale);
  const radius = Math.max(0, numberValue(style.backgroundRadius, 0) * styleScale);
  const lines = content.split(/\r?\n/);
  const contentWidth = Math.max(0, width - padding * 2);
  const contentHeight = Math.max(0, height - padding * 2);
  const totalHeight = lines.length * lineHeight;
  const startY = padding + (contentHeight - totalHeight) / 2 + fontSize * 0.82;
  const align = normalizeTextAlign(stringValue(style.textAlign, 'left'));
  const textX = align === 'center' ? width / 2 : align === 'right' ? width - padding : padding;

  if (backgroundOpacity > 0) {
    ctx.save();
    ctx.globalAlpha *= opacity * backgroundOpacity;
    ctx.fillStyle = backgroundColor;
    roundedRect(ctx, 0, 0, width, height, radius);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.font = `${stringValue(style.fontStyle, 'normal')} ${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = stringValue(style.color, '#111827');
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (contentWidth > 0 && contentHeight > 0) {
    lines.forEach((lineText, index) => ctx.fillText(lineText, textX, startY + index * lineHeight, contentWidth));
  }
  ctx.restore();
}

function drawClipart(ctx: CanvasRenderingContext2D, element: Record<string, any>, width: number, height: number) {
  const style = isRecord(element.style) ? element.style : {};
  const content = isRecord(element.content) ? element.content : {};
  const clipart = resolveClipart(content, style);
  if (!clipart.path) return;
  const viewBox = parseViewBox(clipart.viewBox);
  const path = new Path2D(clipart.path);
  const scale = Math.min(width / viewBox.width, height / viewBox.height);
  const drawWidth = viewBox.width * scale;
  const drawHeight = viewBox.height * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  ctx.save();
  ctx.globalAlpha *= numberValue(style.opacity, 1);
  ctx.translate(style.flipX ? width : 0, style.flipY ? height : 0);
  ctx.scale(style.flipX ? -1 : 1, style.flipY ? -1 : 1);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.translate(-viewBox.x, -viewBox.y);
  ctx.fillStyle = stringValue(style.fill, '#111827');
  ctx.fill(path);
  if (style.stroke && style.stroke !== 'none') {
    ctx.strokeStyle = String(style.stroke);
    ctx.stroke(path);
  }
  ctx.restore();
}

function resolveClipart(content: Record<string, any>, style: Record<string, any>) {
  const svg = stringValue(content.svg, '');
  if (svg) {
    const parsed = parseSvgClipart(svg);
    if (parsed.path) return parsed;
    return { path: svg, viewBox: stringValue(content.viewBox, stringValue(style.viewBox, '0 0 100 100')) };
  }

  const explicitPath = stringValue(content.path, stringValue(style.path, ''));
  if (explicitPath) {
    return { path: explicitPath, viewBox: stringValue(content.viewBox, stringValue(style.viewBox, '0 0 100 100')) };
  }

  const icon = stringValue(content.icon, '');
  const definition = CLIPART.find((item) => item.id === icon);
  return {
    path: definition?.path ?? '',
    viewBox: stringValue(content.viewBox, stringValue(style.viewBox, definition?.viewBox ?? '0 0 100 100')),
  };
}

function parseSvgClipart(value: string) {
  if (!value.includes('<')) return { path: value, viewBox: '0 0 100 100' };
  const pathMatch = /<path\b[^>]*\sd=["']([^"']+)["'][^>]*>/i.exec(value);
  const viewBoxMatch = /\bviewBox=["']([^"']+)["']/i.exec(value);
  return {
    path: pathMatch?.[1] ?? '',
    viewBox: viewBoxMatch?.[1] ?? '0 0 100 100',
  };
}

async function drawLayoutPhoto(ctx: CanvasRenderingContext2D, element: Record<string, any>, photoUrlById: Record<string, string>, width: number, height: number) {
  const settings = isRecord(element.photoSettings) ? element.photoSettings : {};
  const url = stringValue(element.imageUrl, photoUrlById[String(settings.placeholderIndex ?? '')] ?? '');
  clipLayoutElementBounds(ctx, element, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const image = url ? await loadOptionalImage(url) : null;
  if (image) drawImageFit(ctx, image, 0, 0, width, height, normalizeFitMode(stringValue(settings.fitMode, 'cover')));
}

function drawLayoutText(ctx: CanvasRenderingContext2D, element: Record<string, any>, width: number, height: number, canvasWidth: number) {
  const settings = isRecord(element.textSettings) ? element.textSettings : {};
  const fontSize = Math.max(4, Math.min(height * 0.75, numberValue(settings.fontSize, 24) * (canvasWidth / 600)));
  const padding = Math.max(1, canvasWidth / 300);
  const text = stringValue(settings.defaultText, stringValue(element.name, ''));
  const align = normalizeTextAlign(stringValue(settings.textAlign, 'center'));

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.fillStyle = stringValue(settings.color, '#111827');
  ctx.font = `${stringValue(settings.fontWeight, '400')} ${fontSize}px ${quoteFontFamily(stringValue(settings.fontFamily, 'Arial'))}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = align;
  const maxTextWidth = Math.max(1, width - padding * 2);
  const lines = wrapText(ctx, text, maxTextWidth);
  const lineHeight = fontSize * 1.15;
  const totalHeight = lines.length * lineHeight;
  const textX = align === 'left' ? padding : align === 'right' ? width - padding : width / 2;
  let textY = Math.max(padding, (height - totalHeight) / 2);
  for (const lineText of lines) {
    if (textY > height - padding) break;
    ctx.fillText(lineText, textX, textY, maxTextWidth);
    textY += lineHeight;
  }
  ctx.restore();
}

function drawLayoutShape(ctx: CanvasRenderingContext2D, element: Record<string, any>, width: number, height: number) {
  const settings = isRecord(element.shapeSettings) ? element.shapeSettings : {};
  ctx.fillStyle = toCanvasPaint(settings.fillColor, 'transparent');
  ctx.strokeStyle = toCanvasPaint(settings.strokeColor, 'transparent');
  ctx.lineWidth = Math.max(0, numberValue(settings.strokeWidth, 0));
  if (settings.shapeType === 'circle') {
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (ctx.lineWidth > 0) ctx.stroke();
  } else if (settings.shapeType === 'line') {
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    if (ctx.lineWidth > 0) ctx.stroke();
  } else if (settings.shapeType === 'path' && settings.svgPath) {
    drawSvgPath(ctx, String(settings.svgPath), stringValue(settings.svgViewBox, '0 0 100 100'), width, height);
  } else {
    roundedRect(ctx, 0, 0, width, height, numberValue(settings.borderRadius, 0));
    ctx.fill();
    if (ctx.lineWidth > 0) ctx.stroke();
  }
}

async function drawLayoutStaticImage(ctx: CanvasRenderingContext2D, element: Record<string, any>, width: number, height: number) {
  const settings = isRecord(element.imageSettings) ? element.imageSettings : {};
  const url = stringValue(settings.imageUrl, '');
  if (!url) return;
  const image = await loadOptionalImage(url);
  if (!image) return;
  ctx.save();
  ctx.globalAlpha *= numberValue(settings.opacity, 1);
  drawImageFit(ctx, image, 0, 0, width, height, 'contain');
  ctx.restore();
}

function clipLayoutElementBounds(ctx: CanvasRenderingContext2D, element: Record<string, any>, width: number, height: number) {
  const settings = isRecord(element.photoSettings) ? element.photoSettings : {};
  if (settings.maskShape === 'circle') {
    ctx.beginPath();
    ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.clip();
  } else if (settings.maskShape === 'rounded_rectangle') {
    roundedRect(ctx, 0, 0, width, height, Math.min(width, height) * 0.08);
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
  }
}

function drawSvgPath(ctx: CanvasRenderingContext2D, svgPath: string, svgViewBox: string, width: number, height: number) {
  const viewBox = parseViewBox(svgViewBox);
  const path = new Path2D(svgPath);
  ctx.save();
  ctx.scale(width / viewBox.width, height / viewBox.height);
  ctx.translate(-viewBox.x, -viewBox.y);
  ctx.fill(path);
  if (ctx.lineWidth > 0) ctx.stroke(path);
  ctx.restore();
}

function isEmptyElement(element: Record<string, any>, photoUrlById: Record<string, string>) {
  if (element.type === 'image') {
    const content = isRecord(element.content) ? element.content : {};
    return !stringValue(content.url, content.photoId ? photoUrlById[String(content.photoId)] : '');
  }
  if (element.type === 'text') {
    const content = stringValue(element.content, '').trim();
    return !content || EMPTY_TEXT_VALUES.has(content);
  }
  return false;
}

function getPhotoUrlMap(design: Record<string, any>, cartItem?: Record<string, any>) {
  const map: Record<string, string> = {};
  const photos = Array.isArray(design.uploadedPhotos) ? design.uploadedPhotos : Array.isArray(design.photos) ? design.photos : [];
  for (const [index, photo] of photos.entries()) {
    if (!isRecord(photo)) continue;
    const url = stringValue(photo.url, stringValue(photo.publicUrl, ''));
    if (!url) continue;
    map[String(photo.id ?? photo._id ?? index + 1)] = url;
  }
  const imageUrl = stringValue(cartItem?.image?.publicUrl, stringValue(cartItem?.image?.url, ''));
  if (imageUrl) {
    map.default = imageUrl;
    map['1'] = map['1'] || imageUrl;
  }
  return map;
}

function getImageDrawBox(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  objectFit: 'cover' | 'contain' | 'fill',
  imageScale: number,
  objectPositionX: number,
  objectPositionY: number,
) {
  const positionX = objectPositionX / 100;
  const positionY = objectPositionY / 100;
  if (objectFit === 'fill') {
    const width = frameWidth * imageScale;
    const height = frameHeight * imageScale;
    return { x: (frameWidth - width) * positionX, y: (frameHeight - height) * positionY, width, height };
  }
  const coverScale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
  const containScale = Math.min(frameWidth / imageWidth, frameHeight / imageHeight);
  const baseScale = objectFit === 'contain' ? containScale : coverScale;
  const effectiveScale = objectFit === 'cover'
    ? Math.max(imageScale, containScale / coverScale)
    : imageScale;
  const width = imageWidth * baseScale * effectiveScale;
  const height = imageHeight * baseScale * effectiveScale;
  return { x: (frameWidth - width) * positionX, y: (frameHeight - height) * positionY, width, height };
}

function resolveImageMask(style: Record<string, any>): ImageMaskDefinition {
  const customMask = parseCustomMask(style.customMask);
  if (customMask) return customMask;
  const maskId = stringValue(style.maskId, 'rect');
  return IMAGE_MASKS.find((mask) => mask.id === maskId) ?? IMAGE_MASKS[0];
}

function parseCustomMask(value: unknown): ImageMaskDefinition | undefined {
  if (!isRecord(value) || !Array.isArray(value.elements) || value.elements.length === 0) return undefined;
  const viewBox = parseViewBox(stringValue(value.viewBox, '0 0 100 100'));
  if (!(viewBox.width > 0) || !(viewBox.height > 0)) return undefined;
  const elements = value.elements.filter(isSvgMaskElement);
  if (elements.length === 0) return undefined;
  return {
    id: stringValue(value.id, 'custom'),
    label: stringValue(value.label, 'Custom mask'),
    viewBox: `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
    aspectRatio: positiveNumber(value.aspectRatio, viewBox.width / viewBox.height),
    elements,
  };
}

function isSvgMaskElement(value: unknown): value is SvgMaskElement {
  if (!isRecord(value)) return false;
  if (value.type === 'rect') return hasFiniteNumbers(value, ['x', 'y', 'width', 'height']);
  if (value.type === 'circle') return hasFiniteNumbers(value, ['cx', 'cy', 'r']);
  if (value.type === 'ellipse') return hasFiniteNumbers(value, ['cx', 'cy', 'rx', 'ry']);
  if (value.type === 'polygon') return typeof value.points === 'string' && parsePolygonPoints(value.points).length >= 3;
  return value.type === 'path' && typeof value.d === 'string' && value.d.trim().length > 0;
}

function hasFiniteNumbers(value: Record<string, any>, keys: string[]) {
  return keys.every((key) => Number.isFinite(Number(value[key])));
}

function createMaskGeometry(mask: ImageMaskDefinition, frameWidth: number, frameHeight: number) {
  const viewBox = parseViewBox(mask.viewBox);
  const viewBoxAspect = viewBox.width / viewBox.height;
  const maskAspect = positiveNumber(mask.aspectRatio, viewBoxAspect);
  const frameAspect = frameWidth / frameHeight;
  const width = frameAspect > maskAspect ? frameHeight * maskAspect : frameWidth;
  const height = frameAspect > maskAspect ? frameHeight : frameWidth / maskAspect;
  const x = (frameWidth - width) / 2;
  const y = (frameHeight - height) / 2;
  const transform = {
    scaleX: width / viewBox.width,
    scaleY: height / viewBox.height,
    offsetX: x - viewBox.x * (width / viewBox.width),
    offsetY: y - viewBox.y * (height / viewBox.height),
  };
  const path = new Path2D();
  for (const shape of mask.elements) addMaskShapePath(path, shape, transform);
  return { path, x, y, width, height };
}

function addMaskShapePath(
  path: Path2D,
  shape: SvgMaskElement,
  transform: { scaleX: number; scaleY: number; offsetX: number; offsetY: number },
) {
  const pointX = (x: number) => x * transform.scaleX + transform.offsetX;
  const pointY = (y: number) => y * transform.scaleY + transform.offsetY;
  if (shape.type === 'rect') {
    const x = pointX(Number(shape.x));
    const y = pointY(Number(shape.y));
    const width = Number(shape.width) * transform.scaleX;
    const height = Number(shape.height) * transform.scaleY;
    const radius = Math.min(
      Number(shape.rx ?? 0) * Math.min(transform.scaleX, transform.scaleY),
      width / 2,
      height / 2,
    );
    if (radius > 0) roundedPath(path, x, y, width, height, radius);
    else path.rect(x, y, width, height);
    return;
  }
  if (shape.type === 'circle') {
    path.ellipse(
      pointX(Number(shape.cx)),
      pointY(Number(shape.cy)),
      Number(shape.r) * transform.scaleX,
      Number(shape.r) * transform.scaleY,
      0,
      0,
      Math.PI * 2,
    );
    return;
  }
  if (shape.type === 'ellipse') {
    path.ellipse(
      pointX(Number(shape.cx)),
      pointY(Number(shape.cy)),
      Number(shape.rx) * transform.scaleX,
      Number(shape.ry) * transform.scaleY,
      0,
      0,
      Math.PI * 2,
    );
    return;
  }
  if (shape.type === 'path') {
    path.addPath(new Path2D(shape.d), {
      a: transform.scaleX,
      b: 0,
      c: 0,
      d: transform.scaleY,
      e: transform.offsetX,
      f: transform.offsetY,
    });
    return;
  }
  const points = parsePolygonPoints(shape.points);
  points.forEach(([x, y], index) => {
    if (index === 0) path.moveTo(pointX(x), pointY(y));
    else path.lineTo(pointX(x), pointY(y));
  });
  path.closePath();
}

function parsePolygonPoints(points: string): Array<[number, number]> {
  const values = points.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
  const output: Array<[number, number]> = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    if (Number.isFinite(values[index]) && Number.isFinite(values[index + 1])) {
      output.push([values[index], values[index + 1]]);
    }
  }
  return output;
}

function roundedPath(path: Path2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  path.moveTo(x + r, y);
  path.lineTo(x + width - r, y);
  path.quadraticCurveTo(x + width, y, x + width, y + r);
  path.lineTo(x + width, y + height - r);
  path.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  path.lineTo(x + r, y + height);
  path.quadraticCurveTo(x, y + height, x, y + height - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  path.closePath();
}

function drawImageFit(ctx: CanvasRenderingContext2D, image: Image, x: number, y: number, width: number, height: number, fitMode: 'cover' | 'contain' | 'stretch') {
  if (fitMode === 'stretch') {
    ctx.drawImage(image, x, y, width, height);
    return;
  }
  const imageRatio = image.width / image.height;
  const targetRatio = width / height;
  const cover = fitMode === 'cover';
  const scaleByWidth = cover ? imageRatio < targetRatio : imageRatio > targetRatio;
  const drawWidth = scaleByWidth ? width : height * imageRatio;
  const drawHeight = scaleByWidth ? width / imageRatio : height;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawDotPattern(ctx: CanvasRenderingContext2D, width: number, height: number, spacing: number, radius: number, color: string, offsetX = 0, offsetY = 0) {
  ctx.fillStyle = color;
  for (let y = offsetY; y <= height + spacing; y += spacing) {
    for (let x = offsetX; x <= width + spacing; x += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawDiagonalPattern(ctx: CanvasRenderingContext2D, width: number, height: number, styleScale: number) {
  const stripe = 2 * styleScale;
  const gap = 10 * styleScale;
  const spacing = stripe + gap;
  const diagonalLength = Math.sqrt(width * width + height * height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let x = -diagonalLength; x <= diagonalLength; x += spacing) ctx.fillRect(x, -diagonalLength, stripe, diagonalLength * 2);
  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const sourceLine of text.split(/\r?\n/)) {
    const words = sourceLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
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

function parseViewBox(viewBox: string) {
  const [x = 0, y = 0, width = 100, height = 100] = viewBox.split(/[\s,]+/).map(Number);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    width: Number.isFinite(width) && width > 0 ? width : 100,
    height: Number.isFinite(height) && height > 0 ? height : 100,
  };
}

async function loadOptionalImage(url: string) {
  try {
    return await loadImage(url);
  } catch {
    return null;
  }
}

function quoteFontFamily(fontFamily: string) {
  return fontFamily.includes(' ') ? `"${fontFamily.replaceAll('"', '\\"')}"` : fontFamily;
}

function normalizeTextAlign(value: string) {
  return value === 'right' || value === 'center' || value === 'left' ? value : 'left';
}

function normalizeFitMode(value: string) {
  return value === 'contain' || value === 'stretch' ? value : 'cover';
}

function toCanvasPaint(value: unknown, fallback: string) {
  const paint = String(value ?? '').trim();
  if (!paint || paint.toLowerCase() === 'none') return fallback;
  return paint;
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function positiveNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
