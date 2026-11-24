import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool } from 'pg';
import { withTransaction, closePostgresPool } from '../../src/config/postgres.js';
import { ProductModel } from '../../src/models/Product.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== '/printconfig_test') {
  throw new Error('Schema tests require TEST_DATABASE_URL pointing to printconfig_test.');
}
process.env.DATABASE_URL = databaseUrl;

test('PostgreSQL rejects cross-account references and invalid scope ownership', async () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, 'printconfig_test');
    await client.query('BEGIN');
    const accountA = randomUUID();
    const accountB = randomUUID();
    const merchantB = randomUUID();
    const categoryB = randomUUID();
    const productA = randomUUID();
    await client.query('INSERT INTO accounts (id, payload) VALUES ($1, $2), ($3, $4)', [accountA, JSON.stringify({ name: 'A', status: 'active' }), accountB, JSON.stringify({ name: 'B', status: 'active' })]);
    await client.query('INSERT INTO merchants (id, payload) VALUES ($1, $2)', [merchantB, JSON.stringify({ accountId: accountB, name: 'Store B', slug: 'store-b', status: 'active' })]);
    const archivedMerchant = await client.query('INSERT INTO merchants (payload) VALUES ($1) RETURNING status', [JSON.stringify({ accountId: accountA, name: 'Archived Store', slug: 'archived-store', status: 'archived' })]);
    assert.equal(archivedMerchant.rows[0].status, 'archived');
    await client.query('INSERT INTO product_categories (id, payload) VALUES ($1, $2)', [categoryB, JSON.stringify({ accountId: accountB, scope: 'shared', name: 'Category B', slug: 'category-b', status: 'active' })]);

    const reject = async (sql: string, params: unknown[], code: string) => {
      await client.query('SAVEPOINT invalid_write');
      await assert.rejects(client.query(sql, params), (error: any) => error.code === code);
      await client.query('ROLLBACK TO SAVEPOINT invalid_write');
      await client.query('RELEASE SAVEPOINT invalid_write');
    };

    await reject('INSERT INTO product_categories (payload) VALUES ($1)', [JSON.stringify({ accountId: accountA, merchantId: merchantB, scope: 'merchant', name: 'Foreign', slug: 'foreign-store', status: 'active' })], '23503');
    await reject('INSERT INTO product_categories (payload) VALUES ($1)', [JSON.stringify({ accountId: accountA, merchantId: merchantB, scope: 'shared', name: 'Shared', slug: 'bad-shared', status: 'active' })], '23514');
    await reject('INSERT INTO products (id, payload) VALUES ($1, $2)', [productA, JSON.stringify({ accountId: accountA, categoryId: categoryB, scope: 'shared', name: 'Foreign Product', slug: 'foreign-category', productType: 'Canvas Print', status: 'draft' })], '23503');
    await reject('INSERT INTO users (payload) VALUES ($1)', [JSON.stringify({ accountId: accountA, email: `${randomUUID()}@example.test`, name: 'No Password' })], '23514');
    await reject('INSERT INTO merchants (payload) VALUES ($1)', [JSON.stringify({ accountId: accountA, name: 'Bad Slug', slug: 'invalid slug', status: 'active' })], '23514');
    await reject('INSERT INTO merchants (payload) VALUES ($1)', [JSON.stringify({ accountId: accountA, name: 'No Status', slug: 'no-status' })], '23502');

    const layoutCategoryB = randomUUID();
    const collageB = randomUUID();
    const templateA = randomUUID();
    await client.query('INSERT INTO layout_categories (id, payload) VALUES ($1, $2)', [layoutCategoryB, JSON.stringify({ accountId: accountB, scope: 'shared', name: 'Layouts B', slug: 'layouts-b', status: 'active' })]);
    await client.query('INSERT INTO collages (id, payload) VALUES ($1, $2)', [collageB, JSON.stringify({ accountId: accountB, categoryId: layoutCategoryB, scope: 'shared', name: 'Collage B', slug: 'collage-b', status: 'active' })]);
    await client.query('INSERT INTO layout_templates (id, payload) VALUES ($1, $2)', [templateA, JSON.stringify({ accountId: accountA, scope: 'shared', name: 'Template A', slug: 'template-a', status: 'active' })]);
    await reject('INSERT INTO layout_template_pages (id, template_id, account_id, collage_id, page_number) VALUES ($1,$2,$3,$4,1)', [randomUUID(), templateA, accountA, collageB], '23503');
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});

test('record model cannot overwrite a product belonging to another account', async () => {
  const rollback = new Error('rollback fixture');
  try {
    await assert.rejects(withTransaction(async (client) => {
      const accountA = randomUUID();
      const accountB = randomUUID();
      const categoryA = randomUUID();
      const categoryB = randomUUID();
      const productId = randomUUID();
      await client.query('INSERT INTO accounts (id, payload) VALUES ($1,$2),($3,$4)', [accountA, JSON.stringify({ name: 'A', status: 'active' }), accountB, JSON.stringify({ name: 'B', status: 'active' })]);
      await client.query('INSERT INTO product_categories (id, payload) VALUES ($1,$2),($3,$4)', [categoryA, JSON.stringify({ accountId: accountA, scope: 'shared', name: 'A', slug: 'category-a', status: 'active' }), categoryB, JSON.stringify({ accountId: accountB, scope: 'shared', name: 'B', slug: 'category-b', status: 'active' })]);
      await client.query('INSERT INTO products (id, payload) VALUES ($1,$2)', [productId, JSON.stringify({ accountId: accountA, categoryId: categoryA, scope: 'shared', name: 'Original', slug: 'original', productType: 'Canvas Print', status: 'draft' })]);
      await assert.rejects(ProductModel.create({ id: productId, accountId: accountB, categoryId: categoryB, scope: 'shared', name: 'Takeover', slug: 'takeover', productType: 'Canvas Print' }), (error: any) => error.statusCode === 403);
      throw rollback;
    }), (error: unknown) => error === rollback);
  } finally {
    await closePostgresPool();
  }
});
