import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import {
  CopyObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand,
  ListObjectsV2Command, PutObjectCommand,
} from '@aws-sdk/client-s3';
import { loadImage } from '@napi-rs/canvas';
import { app } from '../../src/app.js';
import { closePostgresPool, getPostgresPool } from '../../src/config/postgres.js';
import { getR2Client } from '../../src/config/storage.js';
import { DesignProcessingJobModel } from '../../src/models/DesignProcessingJob.js';
import { DesignCartItemModel } from '../../src/models/DesignCartItem.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/printconfig_test') {
  throw new Error('Design workflow tests require TEST_DATABASE_URL pointing to printconfig_test.');
}
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_SECRET = 'design-workflow-test-secret';
process.env.CLOUDFLARE_ACCOUNT_ID = 'local-test';
process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'local-test';
process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'local-test';
process.env.CLOUDFLARE_PUBLIC_DEV_URL = 'https://storage.example.test';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';

const objects = new Map<string, Buffer>();
let failNextGetPath = '';
const storageClient = getR2Client() as any;
const originalSend = storageClient.send;
storageClient.send = async (command: any) => {
  const input = command.input;
  const key = String(input.Key ?? '');
  if (command instanceof HeadObjectCommand) {
    if (!objects.has(key)) throw Object.assign(new Error('NotFound'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
    return { ContentLength: objects.get(key)!.length, ContentType: 'image/png' };
  }
  if (command instanceof PutObjectCommand) {
    objects.set(key, Buffer.from(input.Body));
    return {};
  }
  if (command instanceof GetObjectCommand) {
    if (key === failNextGetPath) {
      failNextGetPath = '';
      throw Object.assign(new Error('Storage temporarily unavailable'), { $metadata: { httpStatusCode: 503 } });
    }
    const body = objects.get(key);
    if (!body) throw Object.assign(new Error('NotFound'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
    const stream = Readable.from(body);
    return { Body: Object.assign(stream, {
      transformToByteArray: async () => {
        if (key.includes('/final-')) throw new Error('Final print files must be streamed into the ZIP.');
        return body;
      },
    }) };
  }
  if (command instanceof ListObjectsV2Command) {
    const prefix = String(input.Prefix ?? '');
    return { Contents: [...objects].filter(([stored]) => stored.startsWith(prefix)).map(([Key, body]) => ({ Key, Size: body.length })), IsTruncated: false };
  }
  if (command instanceof CopyObjectCommand) {
    const source = decodeURIComponent(String(input.CopySource).replace(/^[^/]+\//, ''));
    const body = objects.get(source);
    if (!body) throw new Error(`Missing copy source: ${source}`);
    objects.set(key, Buffer.from(body));
    return {};
  }
  if (command instanceof DeleteObjectsCommand) {
    for (const entry of input.Delete.Objects) objects.delete(String(entry.Key));
    return {};
  }
  throw new Error(`Unexpected storage command: ${command.constructor.name}`);
};

let server: ReturnType<typeof app.listen>;
let baseUrl = '';
let accountId = '';

before(async () => {
  const database = await getPostgresPool().query('SELECT current_database() AS name');
  assert.equal(database.rows[0].name, 'printconfig_test');
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  storageClient.send = originalSend;
  if (accountId) {
    const db = getPostgresPool();
    for (const table of ['design_processing_jobs', 'design_projects', 'design_cart_items', 'products', 'product_categories', 'image_assets', 'merchants', 'users']) {
      await db.query(`DELETE FROM ${table} WHERE account_id = $1`, [accountId]);
    }
    await db.query('DELETE FROM accounts WHERE id = $1', [accountId]);
  }
  objects.clear();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await closePostgresPool();
});

async function json(path: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  return { response, data };
}

test('customer design save/load and two same-product checkout jobs stay isolated', async () => {
  const signup = await json('/api/auth/signup', 'POST', { email: `${randomUUID()}@example.test`, password: 'strong-password', name: 'Workflow Admin' });
  assert.equal(signup.response.status, 201, JSON.stringify(signup.data));
  accountId = signup.data.user.accountId;
  const admin = { Authorization: `Bearer ${signup.data.token}` };

  const imageMetadata = {
    accountId, scope: 'shared', merchantId: null, folderId: null,
    name: 'Test Asset', filename: 'test.png', originalFilename: 'test.png',
    mimeType: 'image/png', sizeBytes: 8, tags: [],
  };
  const intent = await json('/api/image-assets/upload-intent', 'POST', imageMetadata, admin);
  assert.equal(intent.response.status, 200, JSON.stringify(intent.data));
  assert.ok(intent.data.uploadUrl.includes('X-Amz-Signature='));
  assert.ok(intent.data.storagePath.startsWith(`accounts/${accountId}/shared/`));
  objects.set(intent.data.storagePath, Buffer.from('PNG-data'));
  const completedAsset = await json('/api/image-assets/upload-complete', 'POST', {
    ...imageMetadata, storagePath: intent.data.storagePath, bucket: intent.data.bucket,
  }, admin);
  assert.equal(completedAsset.response.status, 201, JSON.stringify(completedAsset.data));
  assert.equal(completedAsset.data.storageProvider, 'r2');
  assert.equal(completedAsset.data.id.length, 36);
  const wrongScopeCompletion = await json('/api/image-assets/upload-complete', 'POST', {
    ...imageMetadata, scope: 'merchant', merchantId: randomUUID(), storagePath: intent.data.storagePath,
  }, admin);
  assert.equal(wrongScopeCompletion.response.status, 403, JSON.stringify(wrongScopeCompletion.data));
  const wrongScopeOverwrite = await json('/api/image-assets/upload-intent', 'POST', {
    ...imageMetadata, scope: 'merchant', merchantId: randomUUID(), overwriteAssetId: completedAsset.data.id,
  }, admin);
  assert.equal(wrongScopeOverwrite.response.status, 404, JSON.stringify(wrongScopeOverwrite.data));
  const overwriteIntent = await json('/api/image-assets/upload-intent', 'POST', {
    ...imageMetadata, overwriteAssetId: completedAsset.data.id,
  }, admin);
  assert.equal(overwriteIntent.response.status, 200, JSON.stringify(overwriteIntent.data));
  assert.equal(overwriteIntent.data.storagePath, intent.data.storagePath);
  const overwrittenAsset = await json('/api/image-assets/upload-complete', 'POST', {
    ...imageMetadata, overwriteAssetId: completedAsset.data.id, storagePath: intent.data.storagePath,
  }, admin);
  assert.equal(overwrittenAsset.response.status, 201, JSON.stringify(overwrittenAsset.data));
  assert.equal(overwrittenAsset.data.id, completedAsset.data.id);
  const assetList = await json(`/api/image-assets?accountId=${accountId}`, 'GET', undefined, admin);
  assert.equal(assetList.response.status, 200);
  assert.ok(assetList.data.some((asset: { id: string }) => asset.id === completedAsset.data.id));
  const deletedAsset = await json(`/api/image-assets/${completedAsset.data.id}`, 'DELETE', undefined, admin);
  assert.equal(deletedAsset.response.status, 200, JSON.stringify(deletedAsset.data));
  assert.equal(objects.has(intent.data.storagePath), false);

  const merchant = await json('/api/merchants', 'POST', { accountId, name: 'Workflow Store', slug: `store-${randomUUID()}`, status: 'active' }, admin);
  assert.equal(merchant.response.status, 201, JSON.stringify(merchant.data));
  const merchantId = merchant.data.id;
  const keyResult = await json(`/api/merchants/${merchantId}/api-key`, 'POST', {}, admin);
  assert.equal(keyResult.response.status, 200, JSON.stringify(keyResult.data));
  const apiKey = keyResult.data.apiPrivateKey as string;
  const merchantConfig = await json('/api/merchants/public-config', 'GET', undefined, { 'x-api-key': apiKey });
  assert.equal(merchantConfig.response.status, 200, JSON.stringify(merchantConfig.data));
  assert.equal(merchantConfig.data.id, merchantId);
  assert.equal(merchantConfig.data.apiPrivateKeySecret, undefined);

  const category = await json('/api/categories', 'POST', { accountId, name: 'Prints', scope: 'shared', status: 'active' }, admin);
  assert.equal(category.response.status, 201, JSON.stringify(category.data));
  const product = await json('/api/products', 'POST', {
    accountId, categoryId: category.data.id, scope: 'shared', name: 'Small Collage',
    productType: 'Photo Collage Print', status: 'active', basePrice: 10,
    variants: [{ name: '1x1', sku: `COL-${randomUUID()}`, status: 'active', price: 10, width: 1, height: 1, unit: 'inch', dpi: 72, options: {} }],
  }, admin);
  assert.equal(product.response.status, 201, JSON.stringify(product.data));
  const productId = product.data.id;
  const userKey = `user-${randomUUID()}`;
  const expires = Math.floor(Date.now() / 1000) + 300;
  const tokenData = `${userKey}:${merchantId}:${productId}|${expires}`;
  const designToken = `${Buffer.from(tokenData).toString('base64')}.${createHmac('sha256', apiKey).update(tokenData).digest('hex')}`;
  const editor = { Authorization: `Bearer ${designToken}` };

  const missing = await json(`/api/products/public/${productId}/design`, 'GET', undefined, editor);
  assert.equal(missing.response.status, 200, JSON.stringify(missing.data));
  assert.equal(missing.data.designExists, false);
  const firstProjectId = missing.data.projectId as string;
  assert.ok(firstProjectId.startsWith('prj-'));
  const prematureCartForm = new FormData();
  prematureCartForm.set('projectId', firstProjectId);
  prematureCartForm.set('addToCart', 'true');
  prematureCartForm.set('image', new Blob([Buffer.from('test-image')], { type: 'image/png' }), 'source.png');
  const prematureCart = await fetch(`${baseUrl}/api/products/public/${productId}/design-upload`, { method: 'POST', headers: editor, body: prematureCartForm });
  assert.equal(prematureCart.status, 400);

  const upload = async (projectId: string | undefined, content: string) => {
    const form = new FormData();
    if (projectId) form.set('projectId', projectId);
    form.set('productType', 'Photo Book Print');
    form.set('designData', JSON.stringify({ pages: [{ pageNumber: 1, elements: [{ type: 'text', x: 10, y: 10, width: 80, height: 20, content, style: { fontSize: 12, backgroundColor: '#777777', backgroundOpacity: 1 } }] }] }));
    form.set('image', new Blob([Buffer.from('test-image')], { type: 'image/png' }), 'source.png');
    form.set('pagePreviews', new Blob([Buffer.from('test-preview')], { type: 'image/png' }), 'preview-page-1.png');
    form.set('pagePreviewMeta', JSON.stringify([{ pageNumber: 1, filename: 'preview-page-1.png' }]));
    form.set('addToCart', 'true');
    const response = await fetch(`${baseUrl}/api/products/public/${productId}/design-upload`, { method: 'POST', headers: editor, body: form });
    const data = await response.json();
    assert.equal(response.status, 201, JSON.stringify(data));
    return data;
  };

  const first = await upload(firstProjectId, 'First');
  assert.equal(first.projectId, firstProjectId);
  assert.equal(first.cartItem.status, 'cart');
  assert.equal(first.cartItem.productType, 'Photo Collage Print');
  assert.equal(first.image.storageProvider, 'r2');
  const otherMerchant = await json('/api/merchants', 'POST', {
    accountId, name: 'Other Workflow Store', slug: `other-store-${randomUUID()}`, status: 'active',
  }, admin);
  assert.equal(otherMerchant.response.status, 201, JSON.stringify(otherMerchant.data));
  const otherKeyResult = await json(`/api/merchants/${otherMerchant.data.id}/api-key`, 'POST', {}, admin);
  assert.equal(otherKeyResult.response.status, 200, JSON.stringify(otherKeyResult.data));
  const otherKey = otherKeyResult.data.apiPrivateKey as string;
  const wrongMerchantCheckout = await json(`/api/products/cart-items/${first.cartItem.id}/process`, 'POST',
    { orderId: 'cross-merchant-order' }, { 'x-api-key': otherKey });
  assert.equal(wrongMerchantCheckout.response.status, 404, JSON.stringify(wrongMerchantCheckout.data));
  const wrongMerchantPrint = await json(`/api/products/public/${productId}/final-print`, 'POST',
    { cartItemId: first.cartItem.id }, { 'x-api-key': otherKey });
  assert.equal(wrongMerchantPrint.response.status, 404, JSON.stringify(wrongMerchantPrint.data));
  const noKeyPrint = await json(`/api/products/public/${productId}/final-print`, 'POST',
    { cartItemId: first.cartItem.id });
  assert.equal(noKeyPrint.response.status, 401, JSON.stringify(noKeyPrint.data));
  const pendingJob = await DesignProcessingJobModel.create({
    accountId, merchantId, productId, cartItemId: first.cartItem.id,
    status: 'pending', availableAt: new Date(),
  });
  const forcedWhilePending = await json(`/api/products/cart-items/${first.cartItem.id}/process-admin`, 'POST', { force: true }, admin);
  assert.equal(forcedWhilePending.response.status, 202, JSON.stringify(forcedWhilePending.data));
  assert.equal(forcedWhilePending.data.job.id, pendingJob.id);
  assert.equal(await DesignProcessingJobModel.countDocuments({ cartItemId: first.cartItem.id }), 1);
  await DesignProcessingJobModel.deleteOne({ id: pendingJob.id });
  const restored = await json(`/api/products/public/${productId}/design?projectId=${firstProjectId}`, 'GET', undefined, editor);
  assert.equal(restored.response.status, 200, JSON.stringify(restored.data));
  assert.equal(restored.data.designExists, true);
  assert.equal(restored.data.design.pages[0].elements[0].content, 'First');
  const repeatForm = new FormData();
  repeatForm.set('projectId', firstProjectId);
  repeatForm.set('designData', JSON.stringify(restored.data.design));
  repeatForm.set('addToCart', 'true');
  const repeatResponse = await fetch(`${baseUrl}/api/products/public/${productId}/design-upload`, { method: 'POST', headers: editor, body: repeatForm });
  assert.equal(repeatResponse.status, 201, await repeatResponse.clone().text());
  const repeated = await repeatResponse.json();
  assert.equal(repeated.cartItem.id, first.cartItem.id);
  assert.equal(repeated.cartItem.image.storagePath, first.cartItem.image.storagePath);
  assert.equal(repeated.cartItem.pagePreviews[0].storagePath, first.cartItem.pagePreviews[0].storagePath);
  failNextGetPath = first.cartItem.designStoragePath;
  const interruptedRead = await json(`/api/products/public/${productId}/design?projectId=${firstProjectId}`, 'GET', undefined, editor);
  assert.equal(interruptedRead.response.status, 200, JSON.stringify(interruptedRead.data));
  assert.equal(interruptedRead.data.designExists, false);
  assert.equal(interruptedRead.data.projectResolutionReason, 'design_read_failed');
  assert.notEqual(interruptedRead.data.projectId, firstProjectId);

  const secondProject = await json(`/api/products/public/${productId}/design?projectId=prj-missing-${randomUUID()}`, 'GET', undefined, editor);
  assert.equal(secondProject.response.status, 200);
  const [second, concurrentSecond] = await Promise.all([
    upload(secondProject.data.projectId, 'Second'),
    upload(secondProject.data.projectId, 'Second'),
  ]);
  assert.equal(concurrentSecond.cartItem.id, second.cartItem.id);
  assert.equal(await DesignCartItemModel.countDocuments({ projectId: second.projectId }), 1);
  assert.notEqual(second.projectId, first.projectId);
  assert.notEqual(second.cartItem.id, first.cartItem.id);

  const waitForCompletion = async (id: string) => {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const result = await json(`/api/products/cart-items/${id}`, 'GET', undefined, admin);
      assert.equal(result.response.status, 200, JSON.stringify(result.data));
      if (result.data.printGenerationStatus === 'complete') return result.data;
      if (result.data.printGenerationStatus === 'failed') assert.fail(result.data.printGenerationError);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.fail('Print generation did not complete.');
  };
  const manualGeneration = await json(`/api/products/cart-items/${first.cartItem.id}/process-admin`, 'POST', { orderId: 'same-store-order' }, admin);
  assert.equal(manualGeneration.response.status, 202, JSON.stringify(manualGeneration.data));
  const manuallyRendered = await waitForCompletion(first.cartItem.id);
  assert.equal(manuallyRendered.status, 'cart');
  const stillEditable = await json(`/api/products/public/${productId}/design?projectId=${firstProjectId}`, 'GET', undefined, editor);
  assert.equal(stillEditable.response.status, 200);
  assert.equal(stillEditable.data.projectLocked, false);
  assert.equal(stillEditable.data.projectId, firstProjectId);
  const markedOrdered = await json(`/api/products/cart-items/${first.cartItem.id}/mark-ordered`, 'POST', { orderId: 'same-store-order' }, admin);
  assert.equal(markedOrdered.response.status, 202, JSON.stringify(markedOrdered.data));
  const checkout = await json(`/api/products/cart-items/${second.cartItem.id}/process`, 'POST', { orderId: 'same-store-order' }, { 'x-api-key': apiKey });
  assert.equal(checkout.response.status, 202, JSON.stringify(checkout.data));
  const firstOrder = await waitForCompletion(first.cartItem.id);
  const secondOrder = await waitForCompletion(second.cartItem.id);
  assert.equal(firstOrder.status, 'ordered');
  assert.equal(secondOrder.status, 'ordered');
  assert.equal(firstOrder.finalPrintFiles.length, 1);
  assert.equal(secondOrder.finalPrintFiles.length, 1);
  assert.notEqual(firstOrder.orderStoragePrefix, secondOrder.orderStoragePrefix);
  assert.notEqual(firstOrder.finalPrintFiles[0].storagePath, secondOrder.finalPrintFiles[0].storagePath);
  assert.ok(objects.has(firstOrder.finalPrintFiles[0].storagePath));
  assert.ok(objects.has(secondOrder.finalPrintFiles[0].storagePath));
  assert.ok(objects.get(firstOrder.finalPrintFiles[0].storagePath)!.subarray(0, 2).equals(Buffer.from([0xff, 0xd8])));
  const collageArtwork = await loadImage(objects.get(firstOrder.finalPrintFiles[0].storagePath)!);
  assert.equal(collageArtwork.width, 72);
  assert.equal(collageArtwork.height, 72);
  const downloadToken = await json(`/api/products/cart-items/${first.cartItem.id}/final-prints-download-token`, 'POST', {}, admin);
  assert.equal(downloadToken.response.status, 200, JSON.stringify(downloadToken.data));
  const zipResponse = await fetch(downloadToken.data.url);
  assert.equal(zipResponse.status, 200, await zipResponse.clone().text());
  assert.match(zipResponse.headers.get('content-type') ?? '', /application\/zip/);
  const zipBytes = Buffer.from(await zipResponse.arrayBuffer());
  assert.equal(zipBytes.subarray(0, 4).toString('hex'), '504b0304');
  assert.ok(zipBytes.includes(Buffer.from(firstOrder.finalPrintFiles[0].filename)));
  const noTokenZip = await fetch(`${baseUrl}/api/products/cart-items/${first.cartItem.id}/final-prints.zip`);
  assert.equal(noTokenZip.status, 401);
  const mismatchedZip = await fetch(`${baseUrl}/api/products/cart-items/${second.cartItem.id}/final-prints.zip?downloadToken=${encodeURIComponent(new URL(downloadToken.data.url).searchParams.get('downloadToken') ?? '')}`);
  assert.equal(mismatchedZip.status, 401);

  const locked = await json(`/api/products/public/${productId}/design?projectId=${firstProjectId}`, 'GET', undefined, editor);
  assert.equal(locked.response.status, 200);
  assert.equal(locked.data.projectLocked, true);
  assert.notEqual(locked.data.projectId, firstProjectId);

  const canvasProduct = await json('/api/products', 'POST', {
    accountId, categoryId: category.data.id, scope: 'shared', name: 'One Page Canvas',
    productType: 'Canvas Print', status: 'active',
    variants: [{ name: '1x1', sku: `CAN-${randomUUID()}`, status: 'active', price: 10, width: 1, height: 1, unit: 'inch', dpi: 72, options: {} }],
  }, admin);
  assert.equal(canvasProduct.response.status, 201, JSON.stringify(canvasProduct.data));
  const canvasTokenData = `${userKey}:${merchantId}:${canvasProduct.data.id}|${expires}`;
  const canvasToken = `${Buffer.from(canvasTokenData).toString('base64')}.${createHmac('sha256', apiKey).update(canvasTokenData).digest('hex')}`;
  const canvasForm = new FormData();
  canvasForm.set('productType', 'Photo Book Print');
  canvasForm.set('designData', JSON.stringify({ pages: [{ pageNumber: 1, elements: [{ type: 'text', x: 10, y: 10, width: 80, height: 20, content: 'Canvas', style: { fontSize: 12 } }] }] }));
  canvasForm.set('addToCart', 'true');
  const canvasUploadResponse = await fetch(`${baseUrl}/api/products/public/${canvasProduct.data.id}/design-upload`, {
    method: 'POST', headers: { Authorization: `Bearer ${canvasToken}` }, body: canvasForm,
  });
  assert.equal(canvasUploadResponse.status, 201, await canvasUploadResponse.clone().text());
  const canvasUpload = await canvasUploadResponse.json();
  assert.equal(canvasUpload.cartItem.productType, 'Canvas Print');
  const canvasProcess = await json(`/api/products/cart-items/${canvasUpload.cartItem.id}/process`, 'POST', { orderId: 'canvas-order' }, { 'x-api-key': apiKey });
  assert.equal(canvasProcess.response.status, 202, JSON.stringify(canvasProcess.data));
  const canvasOrder = await waitForCompletion(canvasUpload.cartItem.id);
  assert.equal(canvasOrder.finalPrintFiles.length, 1);
  assert.equal(canvasOrder.finalPrintFiles[0].filename, 'final-page-1.jpg');
  const canvasArtwork = await loadImage(objects.get(canvasOrder.finalPrintFiles[0].storagePath)!);
  assert.equal(canvasArtwork.width, 72);
  assert.equal(canvasArtwork.height, 72);
  const canvasOrders = await json(`/api/products/cart-items?accountId=${accountId}&summary=true&pageSize=1&productType=${encodeURIComponent('Canvas Print')}`, 'GET', undefined, admin);
  assert.equal(canvasOrders.response.status, 200, JSON.stringify(canvasOrders.data));
  assert.equal(canvasOrders.data.pagination.total, 1);
  assert.equal(canvasOrders.data.items[0].id, canvasUpload.cartItem.id);
  assert.equal(canvasOrders.data.items[0].productType, 'Canvas Print');
  const repeatedPublicPrint = await json(`/api/products/public/${productId}/final-print`, 'POST',
    { cartItemId: first.cartItem.id }, { 'x-api-key': apiKey });
  assert.equal(repeatedPublicPrint.response.status, 202, JSON.stringify(repeatedPublicPrint.data));
  assert.equal(repeatedPublicPrint.data.queued, false);
  const rotatedKey = await json(`/api/merchants/${merchantId}/api-key`, 'POST', {}, admin);
  assert.equal(rotatedKey.response.status, 200, JSON.stringify(rotatedKey.data));
  const oldKeyConfig = await json('/api/merchants/public-config', 'GET', undefined, { 'x-api-key': apiKey });
  assert.equal(oldKeyConfig.response.status, 401);
  const newKeyConfig = await json('/api/merchants/public-config', 'GET', undefined,
    { 'x-api-key': rotatedKey.data.apiPrivateKey });
  assert.equal(newKeyConfig.response.status, 200);
  const oldDesignToken = await json(`/api/products/public/${productId}/design`, 'GET', undefined, editor);
  assert.equal(oldDesignToken.response.status, 401);
});
