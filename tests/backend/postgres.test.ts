import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { app } from '../../src/app.js';
import { closePostgresPool, getPostgresPool, withTransaction } from '../../src/config/postgres.js';
import { DesignCartItemModel } from '../../src/models/DesignCartItem.js';
import { DesignProjectModel } from '../../src/models/DesignProject.js';
import { DesignProcessingJobModel } from '../../src/models/DesignProcessingJob.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/printconfig_test') {
  throw new Error('PostgreSQL API tests require TEST_DATABASE_URL pointing to printconfig_test.');
}
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_SECRET = 'postgres-test-secret';

let server: ReturnType<typeof app.listen>;
let baseUrl: string;
let accountId = '';

before(async () => {
  const database = await getPostgresPool().query('SELECT current_database() AS name');
  assert.equal(database.rows[0].name, 'printconfig_test');
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (accountId) {
    const db = getPostgresPool();
    await db.query('DELETE FROM design_processing_jobs WHERE account_id = $1', [accountId]);
    await db.query('DELETE FROM design_projects WHERE account_id = $1', [accountId]);
    await db.query('DELETE FROM design_cart_items WHERE account_id = $1', [accountId]);
    await db.query('DELETE FROM layout_templates WHERE account_id = $1', [accountId]);
    await db.query('DELETE FROM collages WHERE account_id = $1', [accountId]);
    await db.query('DELETE FROM layout_categories WHERE account_id = $1', [accountId]);
    await db.query('DELETE FROM products WHERE account_id = $1', [accountId]);
    await db.query('DELETE FROM product_categories WHERE account_id = $1', [accountId]);
    await db.query('DELETE FROM merchants WHERE account_id = $1', [accountId]);
    await db.query('DELETE FROM users WHERE account_id = $1', [accountId]);
    await db.query('DELETE FROM accounts WHERE id = $1', [accountId]);
  }
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await closePostgresPool();
});

test('sign-up, sign-in, scoped catalogue and UUID responses use PostgreSQL', async () => {
  const email = `${randomUUID()}@example.test`;
  const signup = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'strong-password', name: 'Test Admin' }),
  });
  assert.equal(signup.status, 201, await signup.clone().text());
  const auth = await signup.json();
  accountId = auth.user.accountId;
  assert.match(accountId, /^[0-9a-f-]{36}$/);
  assert.equal(auth.user.id.length, 36);
  assert.equal(auth.user._id, undefined);
  await getPostgresPool().query("UPDATE users SET payload = jsonb_set(payload, '{isActive}', 'false'::jsonb) WHERE id = $1", [auth.user.id]);
  const inactiveRequest = await fetch(`${baseUrl}/api/merchants?accountId=${accountId}`, { headers: { Authorization: `Bearer ${auth.token}` } });
  assert.equal(inactiveRequest.status, 401);
  await getPostgresPool().query("UPDATE users SET payload = jsonb_set(payload, '{isActive}', 'true'::jsonb) WHERE id = $1", [auth.user.id]);

  const badSignIn = await fetch(`${baseUrl}/api/auth/signin`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'wrong-password' }),
  });
  assert.equal(badSignIn.status, 401);
  const signIn = await fetch(`${baseUrl}/api/auth/signin`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'strong-password' }),
  });
  assert.equal(signIn.status, 200);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` };
  const merchantResponse = await fetch(`${baseUrl}/api/merchants`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, name: 'Test Store', slug: `test-${randomUUID()}`, status: 'active' }),
  });
  assert.equal(merchantResponse.status, 201, await merchantResponse.clone().text());
  const merchant = await merchantResponse.json();
  assert.equal(merchant.id.length, 36);
  assert.equal(merchant._id, undefined);
  const invalidMerchant = await fetch(`${baseUrl}/api/merchants`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, name: 'Bad Slug', slug: 'not a slug', status: 'active' }),
  });
  assert.equal(invalidMerchant.status, 400, await invalidMerchant.clone().text());

  const categoryResponse = await fetch(`${baseUrl}/api/categories`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, scope: 'shared', name: 'Test Prints', status: 'active' }),
  });
  assert.equal(categoryResponse.status, 201, await categoryResponse.clone().text());
  const category = await categoryResponse.json();
  assert.equal(category.id.length, 36);
  const privateCategoryResponse = await fetch(`${baseUrl}/api/categories`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, merchantId: merchant.id, scope: 'merchant', name: 'Private Prints', status: 'active' }),
  });
  assert.equal(privateCategoryResponse.status, 201, await privateCategoryResponse.clone().text());
  const privateCategory = await privateCategoryResponse.json();
  const invalidProductScope = await fetch(`${baseUrl}/api/products`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, categoryId: privateCategory.id, scope: 'shared', name: 'Invalid Shared Product', productType: 'Canvas Print' }),
  });
  assert.equal(invalidProductScope.status, 400, await invalidProductScope.clone().text());

  const productResponse = await fetch(`${baseUrl}/api/products`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, categoryId: category.id, scope: 'shared', name: 'Sample Canvas', productType: 'Canvas Print', status: 'draft', basePrice: 20, variants: [{ name: '8x10', sku: 'CAN-8X10', price: 20, width: 8, height: 10, unit: 'inch', dpi: 300, options: {} }] }),
  });
  assert.equal(productResponse.status, 201, await productResponse.clone().text());
  const product = await productResponse.json();
  assert.equal(product.id.length, 36);
  assert.equal(product.variants[0].id.length, 36);
  const products = await fetch(`${baseUrl}/api/products?accountId=${accountId}&merchantId=${merchant.id}&summary=true`, { headers });
  assert.equal(products.status, 200, await products.clone().text());
  const productList = await products.json();
  assert.equal(productList.pagination.total, 1);
  assert.equal(productList.items[0].variantCount, 1);
  const productUpdate = await fetch(`${baseUrl}/api/products/${product.id}`, {
    method: 'PUT', headers,
    body: JSON.stringify({ ...product, status: 'active', variants: product.variants.map((variant: { id: string }) => ({ ...variant, status: 'active' })) }),
  });
  assert.equal(productUpdate.status, 200, await productUpdate.clone().text());
  const publicConfig = await fetch(`${baseUrl}/api/products/public/${product.id}/config?merchantId=${merchant.id}`);
  assert.equal(publicConfig.status, 200, await publicConfig.clone().text());
  const configuration = await publicConfig.json();
  assert.equal(configuration.id, product.id);
  assert.equal(configuration.variants[0].id, product.variants[0].id);
  assert.equal(configuration._id, undefined);
  const privateProductResponse = await fetch(`${baseUrl}/api/products`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, categoryId: privateCategory.id, merchantId: merchant.id, scope: 'merchant', name: 'Private Product', productType: 'Canvas Print', status: 'draft' }),
  });
  assert.equal(privateProductResponse.status, 201, await privateProductResponse.clone().text());
  const privateProduct = await privateProductResponse.json();
  const unscopedSearch = await fetch(`${baseUrl}/api/products?accountId=${accountId}&summary=true&search=Private%20Product`, { headers });
  assert.equal(unscopedSearch.status, 200, await unscopedSearch.clone().text());
  assert.equal((await unscopedSearch.json()).pagination.total, 0);
  const scopedSearch = await fetch(`${baseUrl}/api/products?accountId=${accountId}&merchantId=${merchant.id}&summary=true&search=Private%20Product`, { headers });
  assert.equal(scopedSearch.status, 200, await scopedSearch.clone().text());
  assert.equal((await scopedSearch.json()).pagination.total, 1);
  const invalidDuplicate = await fetch(`${baseUrl}/api/products/${privateProduct.id}/duplicate`, {
    method: 'POST', headers, body: JSON.stringify({ scope: 'shared' }),
  });
  assert.equal(invalidDuplicate.status, 400, await invalidDuplicate.clone().text());
  const validDuplicate = await fetch(`${baseUrl}/api/products/${privateProduct.id}/duplicate`, {
    method: 'POST', headers, body: JSON.stringify({ scope: 'merchant', merchantId: merchant.id }),
  });
  assert.equal(validDuplicate.status, 201, await validDuplicate.clone().text());
  const duplicate = await validDuplicate.json();
  assert.equal(duplicate.categoryId, privateCategory.id);
  assert.equal(duplicate.merchantId, merchant.id);
  const invalidSharedSelection = await fetch(`${baseUrl}/api/products/${product.id}`, {
    method: 'PUT', headers,
    body: JSON.stringify({ ...product, status: 'active', editorProductSelection: { mode: 'specific', specificProductIds: [privateProduct.id] } }),
  });
  assert.equal(invalidSharedSelection.status, 400, await invalidSharedSelection.clone().text());
  const privateTemplateResponse = await fetch(`${baseUrl}/api/layout-templates`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, merchantId: merchant.id, scope: 'merchant', name: 'Private Template', slug: `private-template-${randomUUID()}`, status: 'active', templateType: 'photo_collage', orientation: 'square', pageCount: 1, canvasWidth: 10, canvasHeight: 10, unit: 'inch', dpi: 300, pages: [{ pageNumber: 1, name: 'Page 1', width: 10, height: 10 }] }),
  });
  assert.equal(privateTemplateResponse.status, 201, await privateTemplateResponse.clone().text());
  const privateTemplate = await privateTemplateResponse.json();
  const invalidSharedTemplateSelection = await fetch(`${baseUrl}/api/products/${product.id}`, {
    method: 'PUT', headers,
    body: JSON.stringify({ ...product, status: 'active', layoutSettings: { enabled: true, mode: 'specific', allowedTemplateIds: [privateTemplate.id] } }),
  });
  assert.equal(invalidSharedTemplateSelection.status, 400, await invalidSharedTemplateSelection.clone().text());
  const typeCases = [
    { type: 'Photo Book Print', product: {}, variant: {}, check: (config: any) => assert.equal(config.photoBook.enabled, true) },
    { type: 'Photo Collage Print', product: {}, variant: {}, check: (config: any) => assert.equal(config.photoBook.enabled, false) },
    {
      type: 'Pillow Print', product: { pillow: { enabled: true, minimumDesignedSides: 2 } },
      variant: { pillow: { mockups: { front: { imageUrl: 'https://example.test/front.png' }, back: { imageUrl: 'https://example.test/back.png' } } } },
      check: (config: any) => { assert.equal(config.pillow.enabled, true); assert.equal(config.variants[0].pillow.mockups.back.imageUrl, 'https://example.test/back.png'); },
    },
    {
      type: 'Mug Print', product: { mug: { enabled: true } },
      variant: { mug: { model: { url: 'https://example.test/mug.glb', printableMaterialName: 'Print_Area' } } },
      check: (config: any) => { assert.equal(config.mug.enabled, true); assert.equal(config.variants[0].mug.model.printableMaterialName, 'Print_Area'); },
    },
    {
      type: 'T-Shirt Print',
      product: { tshirt: { enabled: true, placements: [{ id: 'front', label: 'Front', printArea: { width: 12, height: 16, unit: 'inch' } }], colors: [{ value: 'White', label: 'White', mockups: { front: { imageUrl: 'https://example.test/shirt.png' } } }] } },
      variant: { options: { Color: 'White', Size: 'M' } },
      check: (config: any) => { assert.equal(config.tshirt.enabled, true); assert.equal(config.tshirt.placements[0].id, 'front'); assert.equal(config.tshirt.colors[0].mockups.front.imageUrl, 'https://example.test/shirt.png'); },
    },
  ];
  for (const [index, typeCase] of typeCases.entries()) {
    const created = await fetch(`${baseUrl}/api/products`, {
      method: 'POST', headers,
      body: JSON.stringify({ accountId, categoryId: category.id, scope: 'shared', name: `Type Case ${index}`, slug: `type-case-${randomUUID()}`, productType: typeCase.type, status: 'active', variants: [{ name: 'Sample', sku: `TYPE-${randomUUID()}`, status: 'active', price: 10, width: 10, height: 10, unit: 'inch', dpi: 300, options: {}, ...typeCase.variant }], ...typeCase.product }),
    });
    assert.equal(created.status, 201, `${typeCase.type}: ${await created.clone().text()}`);
    const saved = await created.json();
    const response = await fetch(`${baseUrl}/api/products/public/${saved.id}/config?merchantId=${merchant.id}`);
    assert.equal(response.status, 200, `${typeCase.type}: ${await response.clone().text()}`);
    const config = await response.json();
    assert.equal(config.id, saved.id);
    assert.equal(config.productType, typeCase.type);
    assert.equal(config.variants[0].id, saved.variants[0].id);
    typeCase.check(config);
  }
  assert.equal((await fetch(`${baseUrl}/api/products?accountId=${accountId}`)).status, 401);
  const otherAccount = await fetch(`${baseUrl}/api/categories?accountId=${randomUUID()}`, { headers });
  assert.equal(otherAccount.status, 403);

  const layoutCategoryResponse = await fetch(`${baseUrl}/api/layout-categories`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, scope: 'shared', name: 'Photo Layouts', slug: `layouts-${randomUUID()}`, status: 'active' }),
  });
  assert.equal(layoutCategoryResponse.status, 201, await layoutCategoryResponse.clone().text());
  const layoutCategory = await layoutCategoryResponse.json();
  const privateLayoutCategoryResponse = await fetch(`${baseUrl}/api/layout-categories`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, merchantId: merchant.id, scope: 'merchant', name: 'Private Layouts', slug: `private-layouts-${randomUUID()}`, status: 'active' }),
  });
  assert.equal(privateLayoutCategoryResponse.status, 201, await privateLayoutCategoryResponse.clone().text());
  const privateLayoutCategory = await privateLayoutCategoryResponse.json();
  const invalidSharedCollage = await fetch(`${baseUrl}/api/collages`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, merchantContextId: merchant.id, categoryId: privateLayoutCategory.id, scope: 'shared', name: 'Invalid Shared Collage', slug: `invalid-shared-${randomUUID()}`, status: 'draft', orientation: 'square', canvasWidth: 10, canvasHeight: 10, unit: 'inch', dpi: 300, elements: [] }),
  });
  assert.equal(invalidSharedCollage.status, 400, await invalidSharedCollage.clone().text());
  const privateCollageResponse = await fetch(`${baseUrl}/api/collages`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, merchantId: merchant.id, categoryId: privateLayoutCategory.id, scope: 'merchant', name: 'Private Collage', slug: `private-collage-${randomUUID()}`, status: 'active', orientation: 'square', canvasWidth: 10, canvasHeight: 10, unit: 'inch', dpi: 300, elements: [] }),
  });
  assert.equal(privateCollageResponse.status, 201, await privateCollageResponse.clone().text());
  const privateCollage = await privateCollageResponse.json();
  const invalidSharedTemplate = await fetch(`${baseUrl}/api/layout-templates`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, merchantContextId: merchant.id, scope: 'shared', name: 'Invalid Shared Template', slug: `invalid-template-${randomUUID()}`, status: 'draft', templateType: 'photo_collage', orientation: 'square', pageCount: 1, canvasWidth: 10, canvasHeight: 10, unit: 'inch', dpi: 300, pages: [{ pageNumber: 1, name: 'Page 1', width: 10, height: 10, collageId: privateCollage.id }] }),
  });
  assert.equal(invalidSharedTemplate.status, 400, await invalidSharedTemplate.clone().text());
  const collageResponse = await fetch(`${baseUrl}/api/collages`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, categoryId: layoutCategory.id, scope: 'shared', name: 'One Photo', slug: `one-photo-${randomUUID()}`, status: 'active', orientation: 'square', canvasWidth: 10, canvasHeight: 10, unit: 'inch', dpi: 300, elements: [{ type: 'photo_placeholder', name: 'Photo 1', x: 5, y: 5, width: 90, height: 90 }] }),
  });
  assert.equal(collageResponse.status, 201, await collageResponse.clone().text());
  const collage = await collageResponse.json();
  assert.equal(collage.elements[0].id.length, 36);
  const templateResponse = await fetch(`${baseUrl}/api/layout-templates`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, scope: 'shared', name: 'One Page', slug: `one-page-${randomUUID()}`, status: 'active', templateType: 'photo_collage', orientation: 'square', pageCount: 1, canvasWidth: 10, canvasHeight: 10, unit: 'inch', dpi: 300, pages: [{ pageNumber: 1, name: 'Page 1', width: 10, height: 10, collageId: collage.id }] }),
  });
  assert.equal(templateResponse.status, 201, await templateResponse.clone().text());
  const template = await templateResponse.json();
  assert.equal(template.pages[0].collageId, collage.id);
  const templateReload = await fetch(`${baseUrl}/api/layout-templates/${template.id}`, { headers });
  assert.equal((await templateReload.json()).pages[0].collageId, collage.id);
  const blockedDelete = await fetch(`${baseUrl}/api/collages/${collage.id}`, { method: 'DELETE', headers });
  assert.equal(blockedDelete.status, 409);
  const editedTemplate = await fetch(`${baseUrl}/api/layout-templates/${template.id}`, {
    method: 'PUT', headers,
    body: JSON.stringify({ ...template, pages: [{ ...template.pages[0], collageId: null }] }),
  });
  assert.equal(editedTemplate.status, 200, await editedTemplate.clone().text());
  const reloadedTemplate = await fetch(`${baseUrl}/api/layout-templates/${template.id}`, { headers });
  assert.equal((await reloadedTemplate.json()).pages[0].collageId, null);
  const availableDelete = await fetch(`${baseUrl}/api/collages/${collage.id}`, { method: 'DELETE', headers });
  assert.equal(availableDelete.status, 200, await availableDelete.clone().text());
  const privateCollageExport = await fetch(`${baseUrl}/api/collages/${privateCollage.id}/export`, { headers });
  assert.equal(privateCollageExport.status, 200, await privateCollageExport.clone().text());
  const exportedCollage = await privateCollageExport.json();
  assert.equal(exportedCollage.collage.id, privateCollage.id);
  const importedCollageResponse = await fetch(`${baseUrl}/api/collages/import`, {
    method: 'POST', headers, body: JSON.stringify(exportedCollage),
  });
  assert.equal(importedCollageResponse.status, 201, await importedCollageResponse.clone().text());
  const importedCollage = await importedCollageResponse.json();
  assert.notEqual(importedCollage.id, privateCollage.id);
  assert.equal(importedCollage.categoryId, privateLayoutCategory.id);
  assert.equal(importedCollage.status, 'draft');
  const duplicatedCollageResponse = await fetch(`${baseUrl}/api/collages/${privateCollage.id}/duplicate`, { method: 'POST', headers });
  assert.equal(duplicatedCollageResponse.status, 201, await duplicatedCollageResponse.clone().text());
  const duplicatedCollage = await duplicatedCollageResponse.json();
  assert.equal(duplicatedCollage.categoryId, privateLayoutCategory.id);
  assert.equal(duplicatedCollage.merchantId, merchant.id);
  const pagedCollages = await fetch(`${baseUrl}/api/collages?accountId=${accountId}&merchantId=${merchant.id}&page=1&pageSize=1`, { headers });
  assert.equal(pagedCollages.status, 200, await pagedCollages.clone().text());
  const collagePage = await pagedCollages.json();
  assert.equal(collagePage.items.length, 1);
  assert.equal(collagePage.pagination.total, 3);
  const hiddenPrivateCollages = await fetch(`${baseUrl}/api/collages?accountId=${accountId}&page=1&pageSize=10`, { headers });
  assert.equal((await hiddenPrivateCollages.json()).pagination.total, 0);
  const privateTemplateExport = await fetch(`${baseUrl}/api/layout-templates/${privateTemplate.id}/export`, { headers });
  assert.equal(privateTemplateExport.status, 200, await privateTemplateExport.clone().text());
  const importedTemplateResponse = await fetch(`${baseUrl}/api/layout-templates/import`, {
    method: 'POST', headers, body: JSON.stringify(await privateTemplateExport.json()),
  });
  assert.equal(importedTemplateResponse.status, 201, await importedTemplateResponse.clone().text());
  const importedTemplate = await importedTemplateResponse.json();
  assert.notEqual(importedTemplate.id, privateTemplate.id);
  assert.equal(importedTemplate.pages.length, 1);
  assert.equal(importedTemplate.status, 'draft');
  const duplicatedTemplateResponse = await fetch(`${baseUrl}/api/layout-templates/${privateTemplate.id}/duplicate`, { method: 'POST', headers });
  assert.equal(duplicatedTemplateResponse.status, 201, await duplicatedTemplateResponse.clone().text());
  const duplicatedTemplate = await duplicatedTemplateResponse.json();
  assert.equal(duplicatedTemplate.merchantId, merchant.id);
  assert.notEqual(duplicatedTemplate.pages[0].id, privateTemplate.pages[0].id);
  const categoryExport = await fetch(`${baseUrl}/api/layout-categories/${layoutCategory.id}/export`, { headers });
  assert.equal(categoryExport.status, 200, await categoryExport.clone().text());
  const importedCategoryResponse = await fetch(`${baseUrl}/api/layout-categories/import`, {
    method: 'POST', headers, body: JSON.stringify(await categoryExport.json()),
  });
  assert.equal(importedCategoryResponse.status, 201, await importedCategoryResponse.clone().text());
  assert.equal((await importedCategoryResponse.json()).category.status, 'draft');

  const projectId = `prj-${randomUUID()}`;
  const cart = await DesignCartItemModel.create({ accountId, merchantId: merchant.id, productId: product.id, projectId, userKey: 'test-user', status: 'cart' });
  await DesignProjectModel.create({ accountId, merchantId: merchant.id, productId: product.id, projectId, userKey: 'test-user', cartItemId: cart.id, status: 'cart' });
  const job = await DesignProcessingJobModel.create({ accountId, merchantId: merchant.id, productId: product.id, cartItemId: cart.id, status: 'pending', availableAt: new Date(Date.now() - 1000) });
  const claimed = await DesignProcessingJobModel.findOneAndUpdate({ id: job.id, status: 'pending', availableAt: { $lte: new Date() } }, { $set: { status: 'processing', lockedBy: 'test-worker' }, $inc: { attempts: 1 } }, { new: true });
  assert.equal(claimed?.status, 'processing');
  assert.equal(claimed?.attempts, 1);
  assert.equal(await DesignProcessingJobModel.findOneAndUpdate({ id: job.id, status: 'pending' }, { $set: { status: 'processing' } }, { new: true }), null);
  const orderList = await fetch(`${baseUrl}/api/products/cart-items?accountId=${accountId}&summary=true`, { headers });
  assert.equal(orderList.status, 200, await orderList.clone().text());
  assert.equal((await orderList.json()).pagination.total, 1);
  const rollbackProjectId = `prj-${randomUUID()}`;
  await assert.rejects(withTransaction(async () => {
    await DesignCartItemModel.create({ accountId, merchantId: merchant.id, productId: product.id, projectId: rollbackProjectId, userKey: 'test-user' });
    await DesignProjectModel.create({ accountId, merchantId: merchant.id, productId: product.id, projectId, userKey: 'test-user' });
  }));
  assert.equal(await DesignCartItemModel.countDocuments({ projectId: rollbackProjectId }), 0);

  const list = await fetch(`${baseUrl}/api/categories?accountId=${accountId}&merchantId=${merchant.id}`, { headers });
  assert.equal(list.status, 200, await list.clone().text());
  assert.ok((await list.json()).some((item: { id: string }) => item.id === category.id));
});
