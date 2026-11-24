/* eslint-disable @typescript-eslint/no-explicit-any */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { galleryBucket, getSupabaseAdmin } from '../config/supabase.js';
import { headObject, r2Bucket, r2PublicUrl, uploadObject } from '../config/storage.js';
import { ImageAssetModel } from '../models/ImageAsset.js';
import { DesignCartItemModel } from '../models/DesignCartItem.js';
import { ProductModel } from '../models/Product.js';
import { ProductCategoryModel } from '../models/ProductCategory.js';
import { MerchantModel } from '../models/Merchant.js';
import { CollageModel } from '../models/Collage.js';
import { LayoutCategoryModel } from '../models/LayoutCategory.js';
import { LayoutTemplateModel } from '../models/LayoutTemplate.js';

type SourceObject = { bucket: string; path: string; destinationPath: string; size: number; contentType?: string };

const apply = process.argv.includes('--apply');
const verifyOnly = process.argv.includes('--verify');
const sourceBuckets = [...new Set([galleryBucket, process.env.SUPABASE_PRODUCT_THUMBNAILS_BUCKET || 'product-thumbnails'])];

async function main() {
  await connectDb();
  const objects: SourceObject[] = [];
  for (const bucket of sourceBuckets) await listSupabaseFolder(bucket, '', objects);
  console.log(`Found ${objects.length} Supabase objects. Mode: ${verifyOnly ? 'verify' : apply ? 'apply' : 'dry-run'}.`);

  let copied = 0;
  let existing = 0;
  const failures: Array<{ object: SourceObject; error: string }> = [];
  for (const [index, object] of objects.entries()) {
    try {
      const destination = await headObject(object.destinationPath, r2Bucket).catch(() => null);
      const rewrittenJson = object.path.endsWith('/design.json') || object.path === 'design.json';
      if (destination && (rewrittenJson || object.size === 0 || Number(destination.ContentLength ?? -1) === object.size)) {
        existing += 1;
      } else if (verifyOnly) {
        throw new Error(destination ? `size mismatch (${destination.ContentLength} != ${object.size})` : 'missing');
      } else if (apply) {
        const { data, error } = await getSupabaseAdmin().storage.from(object.bucket).download(object.path);
        if (error || !data) throw error ?? new Error('Source object is empty.');
        let body: Uint8Array = new Uint8Array(await data.arrayBuffer());
        if (object.path.endsWith('/design.json') || object.path === 'design.json') body = rewriteDesignJson(body);
        await uploadObject({
          storagePath: object.destinationPath,
          body,
          contentType: object.contentType || contentTypeFor(object.path),
          cacheControl: object.path.includes('/designs/') || object.path.startsWith('designs/') ? '0' : '31536000',
          upsert: true,
        });
        const uploaded = await headObject(object.destinationPath, r2Bucket);
        if (Number(uploaded.ContentLength ?? -1) !== body.length) throw new Error('R2 verification failed after upload.');
        copied += 1;
      }
      if ((index + 1) % 100 === 0) console.log(`Checked ${index + 1}/${objects.length} objects.`);
    } catch (error) {
      failures.push({ object, error: error instanceof Error ? error.message : String(error) });
    }
  }

  console.log(`Objects copied: ${copied}; already present: ${existing}; failures: ${failures.length}.`);
  if (failures.length) {
    for (const failure of failures.slice(0, 25)) console.error(`${failure.object.bucket}/${failure.object.path}: ${failure.error}`);
    throw new Error('Object migration did not complete. Database records were not changed.');
  }
  if (apply) await migrateDatabaseReferences();
}

async function listSupabaseFolder(bucket: string, folder: string, output: SourceObject[]) {
  let offset = 0;
  while (true) {
    const { data, error } = await getSupabaseAdmin().storage.from(bucket).list(folder, { limit: 1000, offset });
    if (error) {
      if (folder === '' && /not found/i.test(error.message)) return;
      throw error;
    }
    const items = data ?? [];
    for (const item of items) {
      const path = folder ? `${folder}/${item.name}` : item.name;
      if ((item as any).id || (item as any).metadata) {
        const metadata = (item as any).metadata ?? {};
        output.push({
          bucket,
          path,
          destinationPath: bucket === galleryBucket ? path : `${bucket}/${path}`,
          size: Number(metadata.size ?? 0),
          contentType: String(metadata.mimetype ?? metadata.contentType ?? '') || undefined,
        });
      } else {
        await listSupabaseFolder(bucket, path, output);
      }
    }
    if (items.length < 1000) break;
    offset += items.length;
  }
}

async function migrateDatabaseReferences() {
  const assets = await ImageAssetModel.find({ storageProvider: 'supabase' });
  for (const asset of assets) {
    const oldBucket = String(asset.bucket || galleryBucket);
    const destinationPath = oldBucket === galleryBucket ? String(asset.storagePath) : `${oldBucket}/${asset.storagePath}`;
    const publicUrl = r2PublicUrl(destinationPath);
    asset.storageProvider = 'r2';
    asset.bucket = r2Bucket;
    asset.storagePath = destinationPath;
    asset.url = withExistingQuery(publicUrl, asset.url);
    asset.publicUrl = withExistingQuery(publicUrl, asset.publicUrl);
    if (asset.thumbnailUrl) asset.thumbnailUrl = rewriteUrl(asset.thumbnailUrl);
    await asset.save();
  }

  const cartItems = await DesignCartItemModel.find({});
  for (const item of cartItems) {
    if (item.image && item.image.storageProvider === 'supabase') rewriteStorageFile(item.image as any);
    for (const file of item.pagePreviews ?? []) if (file.storageProvider === 'supabase') rewriteStorageFile(file as any);
    for (const file of item.finalPrintFiles ?? []) if (file.storageProvider === 'supabase') rewriteStorageFile(file as any);
    item.designPublicBaseUrl = item.designPublicBaseUrl ? rewriteUrl(item.designPublicBaseUrl) : '';
    item.designPublicUrl = item.designPublicUrl ? rewriteUrl(item.designPublicUrl) : '';
    await item.save();
  }

  const models: any[] = [ProductModel, ProductCategoryModel, MerchantModel, CollageModel, LayoutCategoryModel, LayoutTemplateModel];
  for (const model of models) {
    const documents = await model.find({});
    for (const document of documents) {
      const source = document.toObject();
      const rewritten = rewriteValue(source);
      document.set(rewritten);
      await document.save();
    }
  }
  console.log(`Updated ${assets.length} image assets and ${cartItems.length} design cart items.`);
}

function rewriteStorageFile(file: any) {
  const oldBucket = String(file.bucket || galleryBucket);
  const destinationPath = oldBucket === galleryBucket ? String(file.storagePath) : `${oldBucket}/${file.storagePath}`;
  const publicUrl = r2PublicUrl(destinationPath);
  file.storageProvider = 'r2';
  file.bucket = r2Bucket;
  file.storagePath = destinationPath;
  file.url = withExistingQuery(publicUrl, String(file.url ?? ''));
  file.publicUrl = withExistingQuery(publicUrl, String(file.publicUrl ?? ''));
}

function rewriteDesignJson(body: Uint8Array): Uint8Array {
  try {
    return Buffer.from(JSON.stringify(rewriteValue(JSON.parse(Buffer.from(body).toString('utf8'))), null, 2), 'utf8');
  } catch {
    return body;
  }
}

function rewriteValue(value: any): any {
  if (typeof value === 'string') return rewriteUrl(value);
  if (Array.isArray(value)) return value.map(rewriteValue);
  if (!value || typeof value !== 'object' || value.constructor !== Object) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewriteValue(child)]));
}

function rewriteUrl(value: string) {
  const match = value.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.*?)([?#].*)?$/i);
  if (!match) return value;
  const bucket = decodeURIComponent(match[1]);
  const path = decodeURIComponent(match[2]);
  const destinationPath = bucket === galleryBucket ? path : `${bucket}/${path}`;
  return `${r2PublicUrl(destinationPath)}${match[3] ?? ''}`;
}

function withExistingQuery(baseUrl: string, oldUrl: string) {
  const suffix = oldUrl.match(/[?#].*$/)?.[0] ?? '';
  return `${baseUrl}${suffix}`;
}

function contentTypeFor(path: string) {
  const extension = path.split('.').pop()?.toLowerCase();
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', json: 'application/json' } as Record<string, string>)[extension ?? ''] || 'application/octet-stream';
}

main()
  .then(async () => { await mongoose.disconnect(); })
  .catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exitCode = 1; });
