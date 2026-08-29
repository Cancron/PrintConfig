import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import { galleryBucket, getSupabaseAdmin } from './supabase.js';

export type StorageProvider = 'supabase' | 'r2';

export const r2Bucket = process.env.CLOUDFLARE_R2_BUCKET || 'canadaprintstudio';

let r2Client: S3Client | undefined;

export function getR2Client() {
  if (r2Client) return r2Client;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, and CLOUDFLARE_R2_SECRET_ACCESS_KEY are required.');
  }
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return r2Client;
}

export function r2PublicUrl(storagePath: string) {
  const baseUrl = String(process.env.CLOUDFLARE_PUBLIC_DEV_URL ?? '').replace(/\/+$/, '');
  if (!baseUrl) throw new Error('CLOUDFLARE_PUBLIC_DEV_URL is required.');
  const encodedPath = cleanStoragePath(storagePath).split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}/${encodedPath}`;
}

export async function uploadObject(input: {
  storagePath: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
  bucket?: string;
}) {
  const bucket = input.bucket || r2Bucket;
  const storagePath = cleanStoragePath(input.storagePath);
  if (!input.upsert && await objectExists(storagePath, bucket)) throw new Error(`Storage object already exists: ${storagePath}`);
  await getR2Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: storagePath,
    Body: input.body,
    ContentType: input.contentType,
    CacheControl: input.cacheControl,
  }));
  return { storageProvider: 'r2' as const, bucket, storagePath, publicUrl: r2PublicUrl(storagePath) };
}

export async function downloadObject(storagePath: string, options: { provider?: StorageProvider; bucket?: string; legacyFallback?: boolean } = {}) {
  const provider = options.provider ?? 'r2';
  if (provider === 'supabase') return downloadSupabaseObject(storagePath, options.bucket);
  try {
    const response = await getR2Client().send(new GetObjectCommand({ Bucket: options.bucket || r2Bucket, Key: cleanStoragePath(storagePath) }));
    if (!response.Body) throw new Error('Storage object is empty.');
    return Buffer.from(await response.Body.transformToByteArray());
  } catch (error) {
    if (options.legacyFallback === false || !hasSupabaseConfig()) throw error;
    return downloadSupabaseObject(storagePath, options.bucket);
  }
}

export async function getObjectStream(storagePath: string, options: { provider?: StorageProvider; bucket?: string } = {}) {
  if (options.provider === 'supabase') return Readable.from(await downloadSupabaseObject(storagePath, options.bucket));
  const response = await getR2Client().send(new GetObjectCommand({ Bucket: options.bucket || r2Bucket, Key: cleanStoragePath(storagePath) }));
  if (!response.Body) throw new Error('Storage object is empty.');
  return response.Body as Readable;
}

export async function objectExists(storagePath: string, bucket = r2Bucket) {
  try {
    await getR2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: cleanStoragePath(storagePath) }));
    return true;
  } catch (error: unknown) {
    const storageError = error as { $metadata?: { httpStatusCode?: number }; name?: string };
    if (storageError.$metadata?.httpStatusCode === 404 || storageError.name === 'NotFound') return false;
    throw error;
  }
}

export async function headObject(storagePath: string, bucket = r2Bucket) {
  return getR2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: cleanStoragePath(storagePath) }));
}

export async function deleteObjects(storagePaths: string[], options: { provider?: StorageProvider; bucket?: string } = {}) {
  const paths = [...new Set(storagePaths.map(cleanStoragePath).filter(Boolean))];
  if (paths.length === 0) return;
  if (options.provider === 'supabase') {
    const { error } = await getSupabaseAdmin().storage.from(options.bucket || galleryBucket).remove(paths);
    if (error) throw error;
    return;
  }
  for (let index = 0; index < paths.length; index += 1000) {
    await getR2Client().send(new DeleteObjectsCommand({
      Bucket: options.bucket || r2Bucket,
      Delete: { Objects: paths.slice(index, index + 1000).map((Key) => ({ Key })), Quiet: true },
    }));
  }
}

export async function copyObject(sourcePath: string, destinationPath: string, bucket = r2Bucket) {
  await getR2Client().send(new CopyObjectCommand({
    Bucket: bucket,
    Key: cleanStoragePath(destinationPath),
    CopySource: `${bucket}/${cleanStoragePath(sourcePath).split('/').map(encodeURIComponent).join('/')}`,
  }));
}

export async function listObjects(prefix: string, bucket = r2Bucket) {
  const output: Array<{ key: string; size: number; etag?: string; lastModified?: Date }> = [];
  let continuationToken: string | undefined;
  do {
    const response = await getR2Client().send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: cleanStoragePath(prefix),
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));
    for (const item of response.Contents ?? []) {
      if (item.Key) output.push({ key: item.Key, size: Number(item.Size ?? 0), etag: item.ETag, lastModified: item.LastModified });
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  return output;
}

export async function listLegacySupabaseObjects(prefix: string, bucket = galleryBucket) {
  const output: string[] = [];
  await listSupabaseFolder(cleanStoragePath(prefix), bucket, output);
  return output;
}

export async function createPresignedUploadUrl(input: { storagePath: string; contentType: string; expiresInSeconds?: number; bucket?: string }) {
  const bucket = input.bucket || r2Bucket;
  const storagePath = cleanStoragePath(input.storagePath);
  const expiresInSeconds = clampExpiry(input.expiresInSeconds ?? Number(process.env.R2_SIGNED_UPLOAD_TTL_SECONDS ?? 900));
  const uploadUrl = await getSignedUrl(getR2Client(), new PutObjectCommand({
    Bucket: bucket,
    Key: storagePath,
    ContentType: input.contentType,
  }), { expiresIn: expiresInSeconds });
  return { uploadUrl, storagePath, bucket, publicUrl: r2PublicUrl(storagePath), expiresInSeconds, requiredHeaders: { 'Content-Type': input.contentType } };
}

function cleanStoragePath(value: string) {
  return String(value ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function clampExpiry(value: number) {
  return Math.max(1, Math.min(604800, Number.isFinite(value) ? Math.floor(value) : 900));
}

function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function downloadSupabaseObject(storagePath: string, bucket?: string) {
  const { data, error } = await getSupabaseAdmin().storage.from(bucket || galleryBucket).download(cleanStoragePath(storagePath));
  if (error || !data) throw error ?? new Error('Supabase storage object is empty.');
  return Buffer.from(await data.arrayBuffer());
}

async function listSupabaseFolder(folder: string, bucket: string, output: string[]) {
  let offset = 0;
  while (true) {
    const { data, error } = await getSupabaseAdmin().storage.from(bucket).list(folder, { limit: 1000, offset });
    if (error) throw error;
    const items = data ?? [];
    for (const item of items) {
      const fullPath = `${folder}/${item.name}`;
      const storedItem = item as typeof item & { id?: string; metadata?: unknown };
      if (storedItem.id || storedItem.metadata) output.push(fullPath);
      else await listSupabaseFolder(fullPath, bucket, output);
    }
    if (items.length < 1000) break;
    offset += items.length;
  }
}
