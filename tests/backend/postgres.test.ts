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

  const categoryResponse = await fetch(`${baseUrl}/api/categories`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, scope: 'shared', name: 'Test Prints', status: 'active' }),
  });
  assert.equal(categoryResponse.status, 201, await categoryResponse.clone().text());
  const category = await categoryResponse.json();
  assert.equal(category.id.length, 36);

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
  assert.equal((await fetch(`${baseUrl}/api/products?accountId=${accountId}`)).status, 401);
  const otherAccount = await fetch(`${baseUrl}/api/categories?accountId=${randomUUID()}`, { headers });
  assert.equal(otherAccount.status, 403);

  const layoutCategoryResponse = await fetch(`${baseUrl}/api/layout-categories`, {
    method: 'POST', headers,
    body: JSON.stringify({ accountId, scope: 'shared', name: 'Photo Layouts', slug: `layouts-${randomUUID()}`, status: 'active' }),
  });
  assert.equal(layoutCategoryResponse.status, 201, await layoutCategoryResponse.clone().text());
  const layoutCategory = await layoutCategoryResponse.json();
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
