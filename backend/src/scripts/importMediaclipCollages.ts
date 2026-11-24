import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { CollageModel } from '../models/Collage.js';
import { createCollage } from '../services/layout.service.js';
import { slugify } from '../utils/slug.js';

type LayoutOrientation = 'portrait' | 'landscape' | 'square' | 'custom';
type ProductScope = 'shared' | 'merchant';
type ProductUnit = 'inch' | 'mm' | 'px';

interface ImportOptions {
  url: string;
  accountId: string;
  categoryId: string;
  merchantId?: string;
  scope: ProductScope;
  canvasWidth?: number;
  canvasHeight?: number;
  unit: ProductUnit;
  dpi: number;
  orientation?: LayoutOrientation;
  namePrefix: string;
  limit?: number;
  dryRun: boolean;
}

interface ThirdPartyLayout {
  urlThumb?: string;
  urlWeb?: string;
  collage?: {
    elements?: ThirdPartyElement[];
    staticElements?: ThirdPartyElement[];
    width?: number;
    height?: number;
  };
}

interface ThirdPartyElement {
  '$type'?: string;
  tag?: string;
  text?: string;
  required?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  opacity?: number;
  photoFitting?: number;
  textStyle?: {
    color?: string;
    fontFamily?: string;
    bold?: boolean;
    fontSize?: number;
    hAlign?: number;
  };
  url?: string;
  imageUrl?: string;
}

interface LayoutElementPayload {
  type: 'photo_placeholder' | 'text_placeholder' | 'shape' | 'background' | 'clipart' | 'static_image';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  required: boolean;
  editable: boolean;
  style: Record<string, unknown>;
  photoSettings?: Record<string, unknown>;
  textSettings?: Record<string, unknown>;
  imageSettings?: Record<string, unknown>;
}

const args = loadOptions(parseArgs(process.argv.slice(2)));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect();
});

async function main() {
  if (args.help) {
    printHelp();
    return;
  }

  const options = parseOptions(args);
  if (!options.dryRun) await connectDb();

  const response = await fetch(options.url);
  if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  const json = await response.json() as unknown;
  const layouts = normalizeLayouts(json).slice(0, options.limit ?? undefined);
  if (layouts.length === 0) throw new Error('No layouts found in the third-party response.');

  const created: { _id: unknown; name: string; slug: string; elements: number }[] = [];
  const skipped: { name: string; slug: string; reason: string }[] = [];
  const seenSlugs = new Set<string>();
  for (const [index, layout] of layouts.entries()) {
    console.log(index);
    const payload = convertLayout(layout, options, index);
    const slug = String(payload.slug);
    if (seenSlugs.has(slug)) {
      skipped.push({ name: String(payload.name), slug, reason: 'Duplicate slug in source response' });
      continue;
    }
    seenSlugs.add(slug);
    if (options.dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      continue;
    }
    if (await collageSlugExists(payload)) {
      skipped.push({ name: String(payload.name), slug, reason: 'Slug already exists' });
      continue;
    }
    const collage = await createCollage(payload);
    created.push({
      _id: collage._id,
      name: collage.name,
      slug: collage.slug,
      elements: collage.elements.length,
    });
  }

  if (!options.dryRun) {
    console.log(`Imported ${created.length} collage${created.length === 1 ? '' : 's'}.`);
    console.table(created.map((item) => ({
      id: String(item._id),
      name: item.name,
      slug: item.slug,
      elements: item.elements,
    })));
    if (skipped.length > 0) {
      console.log(`Skipped ${skipped.length} collage${skipped.length === 1 ? '' : 's'}.`);
      console.table(skipped);
    }
  }
}

function convertLayout(layout: ThirdPartyLayout, options: ImportOptions, index: number) {
  const sourceWidth = positiveNumber(layout.collage?.width, `Layout ${index + 1} source width`);
  const sourceHeight = positiveNumber(layout.collage?.height, `Layout ${index + 1} source height`);
  const identity = identityFromUrlWeb(layout.urlWeb) ?? fallbackIdentity(options.namePrefix, index);
  const elements = [
    ...(layout.collage?.elements ?? []),
    ...(layout.collage?.staticElements ?? []),
  ].map((element, elementIndex) => convertElement(element, sourceWidth, sourceHeight, elementIndex))
    .filter((element): element is LayoutElementPayload => Boolean(element));

  return {
    accountId: options.accountId,
    merchantId: options.scope === 'merchant' ? options.merchantId : null,
    merchantContextId: options.merchantId,
    scope: options.scope,
    categoryId: options.categoryId,
    name: identity.name,
    slug: identity.slug,
    description: `Imported from MC`,
    status: 'draft',
    thumbnailUrl: layout.urlThumb ?? '',
    orientation: options.orientation ?? deriveOrientation(sourceWidth, sourceHeight),
    canvasWidth: options.canvasWidth ?? sourceWidth,
    canvasHeight: options.canvasHeight ?? sourceHeight,
    unit: options.unit,
    dpi: options.dpi,
    backgroundColor: '#ffffff',
    backgroundImageUrl: '',
    tags: [],
    sortOrder: index,
    elements,
  };
}

async function collageSlugExists(payload: Record<string, unknown>) {
  return Boolean(await CollageModel.exists({
    accountId: payload.accountId,
    categoryId: payload.categoryId,
    scope: payload.scope,
    merchantId: payload.scope === 'shared' ? null : payload.merchantId,
    slug: payload.slug,
  }));
}

function identityFromUrlWeb(urlWeb?: string) {
  if (!urlWeb) return null;
  try {
    const pathname = new URL(urlWeb).pathname;
    const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const layoutIndex = parts.lastIndexOf('layouts');
    const rawSlug = layoutIndex >= 0 ? parts[layoutIndex + 1] : '';
    const slug = slugify(rawSlug);
    if (!slug) return null;
    return { slug, name: nameFromSlug(slug) };
  } catch {
    return null;
  }
}

function fallbackIdentity(namePrefix: string, index: number) {
  const name = `${namePrefix} ${index + 1}`.trim();
  return { name, slug: slugify(name) || `mediaclip-collage-${index + 1}` };
}

function nameFromSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function convertElement(element: ThirdPartyElement, sourceWidth: number, sourceHeight: number, index: number): LayoutElementPayload | null {
  const type = String(element.$type ?? '').toLowerCase();
  const base = {
    name: cleanTag(element.tag) || `Element ${index + 1}`,
    x: percent(element.x, sourceWidth),
    y: percent(element.y, sourceHeight),
    width: positivePercent(element.width, sourceWidth),
    height: positivePercent(element.height, sourceHeight),
    rotation: Number(element.rotation ?? 0),
    zIndex: index,
    locked: false,
    required: element.required === true,
    editable: true,
    style: { opacity: normalizeOpacity(element.opacity) },
  };

  if (type.includes('textelement')) {
    const style = element.textStyle ?? {};
    return {
      ...base,
      type: 'text_placeholder',
      textSettings: {
        defaultText: element.text ?? '',
        fontFamily: style.fontFamily || 'Arial',
        fontSize: Number(style.fontSize ?? 24),
        fontWeight: style.bold ? '700' : '400',
        color: style.color || '#111827',
        textAlign: alignFromMediaclip(style.hAlign)
      },
    };
  }

  if (type.includes('photoelement')) {
    return {
      ...base,
      type: 'photo_placeholder',
      photoSettings: {
        fitMode: fitModeFromMediaclip(element.photoFitting),
        allowCrop: true,
        allowRotate: true,
        allowReplace: true,
        placeholderIndex: index + 1,
        maskShape: 'rectangle',
      },
    };
  }

  const imageUrl = element.url || element.imageUrl;
  if (imageUrl) {
    return {
      ...base,
      type: 'static_image',
      imageSettings: {
        imageUrl,
        opacity: normalizeOpacity(element.opacity),
      },
    };
  }

  console.warn(`Skipping unsupported element ${index + 1}: ${element.$type ?? 'unknown type'}`);
  return null;
}

function normalizeLayouts(json: unknown): ThirdPartyLayout[] {
  if (Array.isArray(json)) return json.filter(isObject) as ThirdPartyLayout[];
  if (isObject(json) && Array.isArray(json.layouts)) return json.layouts.filter(isObject) as ThirdPartyLayout[];
  if (isObject(json)) return [json as ThirdPartyLayout];
  return [];
}

function parseOptions(raw: Record<string, unknown>): ImportOptions {
  const url = resolveUrl(raw);
  const accountId = stringArg(raw.accountId, '--accountId');
  const categoryId = stringArg(raw.categoryId, '--categoryId');
  const scope = raw.scope === 'merchant' ? 'merchant' : 'shared';
  const merchantId = optionalStringArg(raw.merchantId);
  if (scope === 'merchant' && !merchantId) throw new Error('--merchantId is required when --scope=merchant.');

  return {
    url,
    accountId,
    categoryId,
    merchantId,
    scope,
    canvasWidth: optionalNumberArg(raw.canvasWidth),
    canvasHeight: optionalNumberArg(raw.canvasHeight),
    unit: unitArg(raw.unit),
    dpi: numberArg(raw.dpi, 300),
    orientation: orientationArg(raw.orientation),
    namePrefix: optionalStringArg(raw.namePrefix) ?? 'Imported Collage',
    limit: optionalNumberArg(raw.limit),
    dryRun: raw.dryRun === true,
  };
}

function parseArgs(values: string[]) {
  const parsed: Record<string, string | boolean> = {};
  for (const value of values) {
    if (value === '--help' || value === '-h') {
      parsed.help = true;
      continue;
    }
    if (!value.startsWith('--')) continue;
    const [key, ...rest] = value.slice(2).split('=');
    parsed[key] = rest.length > 0 ? rest.join('=') : true;
  }
  return parsed;
}

function loadOptions(cliArgs: Record<string, string | boolean>) {
  const optionsFile = optionalStringArg(cliArgs.optionsFile);
  if (!optionsFile) return cliArgs;
  const fileOptions = JSON.parse(readTextFile(optionsFile)) as unknown;
  if (!isObject(fileOptions)) throw new Error('--optionsFile must contain a JSON object.');
  const { optionsFile: _optionsFile, ...overrides } = cliArgs;
  return { ...fileOptions, ...overrides };
}

function printHelp() {
  console.log(`Import Mediaclip collages as PrintConfig draft collages.

Required:
  --url=<third-party-json-url>
  --accountId=<mongo-account-id>
  --categoryId=<layout-category-id>

Options:
  --optionsFile=<path>             JSON file containing all options below
  --scope=shared|merchant          Default: shared
  --merchantId=<merchant-id>       Required for merchant scope
  --canvasWidth=<number>           Saved collage canvas width. Defaults to source pixel width
  --canvasHeight=<number>          Saved collage canvas height. Defaults to source pixel height
  --unit=inch|mm|px                Default: inch
  --dpi=<number>                   Default: 300
  --orientation=portrait|landscape|square|custom
  --namePrefix="Square Collage"    Default: Imported Collage
  --limit=<number>
  --dryRun                         Print converted payloads without saving

Example:
  npm --prefix backend run import:mediaclip-collages -- --url=https://example.com/layouts.json --accountId=... --categoryId=... --canvasWidth=12 --canvasHeight=12 --orientation=square

Options file example:
  npm --prefix backend run import:mediaclip-collages -- --optionsFile=.\\mediaclip.json

mediaclip.json:
  {
    "url": "https://example.com/layouts.json?x=1&y=2",
    "accountId": "...",
    "categoryId": "...",
    "scope": "merchant",
    "merchantId": "...",
    "canvasWidth": 12,
    "canvasHeight": 12,
    "orientation": "square",
    "unit": "inch",
    "dpi": 300,
    "namePrefix": "Square Collage",
    "dryRun": true
  }
`);
}

function resolveUrl(raw: Record<string, unknown>) {
  const directUrl = optionalStringArg(raw.url);
  if (directUrl) return directUrl;
  throw new Error('Missing required script option: --url.');
}

function readTextFile(filePath: string) {
  if (path.isAbsolute(filePath) || existsSync(filePath)) return readFileSync(filePath, 'utf8');
  const initCwd = process.env.INIT_CWD;
  if (initCwd) {
    const fromInitialCwd = path.resolve(initCwd, filePath);
    if (existsSync(fromInitialCwd)) return readFileSync(fromInitialCwd, 'utf8');
  }
  return readFileSync(filePath, 'utf8');
}

function stringArg(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing required script option: ${label}.`);
  return value.trim();
}

function optionalStringArg(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberArg(value: unknown, fallback: number) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`Invalid numeric option: ${String(value)}`);
  return number;
}

function optionalNumberArg(value: unknown) {
  if (value === undefined) return undefined;
  return numberArg(value, 0);
}

function unitArg(value: unknown): ProductUnit {
  if (value === undefined) return 'inch';
  if (value === 'inch' || value === 'mm' || value === 'px') return value;
  throw new Error('--unit must be inch, mm, or px.');
}

function orientationArg(value: unknown): LayoutOrientation | undefined {
  if (value === undefined) return undefined;
  if (value === 'portrait' || value === 'landscape' || value === 'square' || value === 'custom') return value;
  throw new Error('--orientation must be portrait, landscape, square, or custom.');
}

function positiveNumber(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be greater than zero.`);
  return number;
}

function percent(value: unknown, total: number) {
  return Number(Math.min(100, Math.max(0, (Number(value ?? 0) / total) * 100)).toFixed(4));
}

function positivePercent(value: unknown, total: number) {
  return Number(Math.min(100, Math.max(0.01, (Number(value ?? 0) / total) * 100)).toFixed(4));
}

function normalizeOpacity(value: unknown) {
  const number = Number(value ?? 100);
  return Number(Math.min(1, Math.max(0, number > 1 ? number / 100 : number)).toFixed(4));
}

function cleanTag(value: unknown) {
  return String(value ?? '').replace(/[{}]/g, '').trim();
}

function alignFromMediaclip(value: unknown) {
  const align = Number(value ?? 1);
  if (align === 0) return 'left';
  if (align === 2) return 'right';
  return 'center';
}

function fitModeFromMediaclip(value: unknown) {
  const mode = Number(value ?? 0);
  if (mode === 1) return 'contain';
  if (mode === 2) return 'stretch';
  return 'cover';
}

function deriveOrientation(width: number, height: number): LayoutOrientation {
  if (width === height) return 'square';
  return width > height ? 'landscape' : 'portrait';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
