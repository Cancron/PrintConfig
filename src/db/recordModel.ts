import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPostgresClient, withTransaction } from '../config/postgres.js';
import { currentAccountId } from './accountContext.js';
import { ApiError } from '../middleware/errorHandler.js';

type Data = Record<string, any>;
type Sort = Record<string, number>;
type Client = Pick<PoolClient, 'query'>;

const tables = new Set([
  'accounts', 'users', 'merchants', 'product_categories', 'layout_categories',
  'image_folders', 'image_assets', 'collages', 'layout_templates', 'products',
  'design_cart_items', 'design_projects', 'design_processing_jobs',
]);
const numericFields = new Set(['sortOrder', 'priority', 'pageNumber', 'price']);
const dateFields = new Set(['createdAt', 'updatedAt', 'availableAt', 'lastActivityAt']);
const nestedIds = new Set(['variants', 'variantOptionDefinitions', 'optionGroups', 'values', 'roomPreviews', 'styles', 'trustBadges', 'pages', 'elements', 'colors', 'placements']);
const accountScopedTables = new Set([...tables].filter((table) => table !== 'accounts'));

function scopedQuery(table: string, query: Data): Data {
  const accountId = currentAccountId();
  if (!accountId) return query;
  if (table === 'accounts') return { ...query, id: accountId };
  if (accountScopedTables.has(table)) return { ...query, accountId };
  return query;
}

function addNestedIds(value: unknown, parentKey = ''): unknown {
  if (Array.isArray(value)) return value.map((item) => {
    const next = addNestedIds(item, parentKey) as Data;
    if (nestedIds.has(parentKey) && next && typeof next === 'object' && !Array.isArray(next)) next.id ??= randomUUID();
    return next;
  });
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, addNestedIds(child, key)]));
  }
  return value;
}

function defaults(table: string): Data {
  switch (table) {
    case 'users': return { role: 'admin', isActive: true };
    case 'accounts': case 'merchants': return { status: 'active' };
    case 'design_projects': return { status: 'draft', lastActivityAt: new Date() };
    case 'design_cart_items': return { status: 'cart', productType: 'Photo Book Print', pagePreviews: [], finalPrintFiles: [], printGenerationStatus: 'pending', printGenerationTotalPages: 0, printGenerationCompletedPages: 0, printGenerationCurrentPage: 0, lastActivityAt: new Date() };
    case 'design_processing_jobs': return { type: 'final-print-generation', status: 'pending', priority: 0, attempts: 0, maxAttempts: 3, markOrdered: false, availableAt: new Date() };
    case 'products': return {
      status: 'draft', basePrice: 0, variants: [], optionGroups: [], roomPreviews: [],
      variantOptionDefinitions: ['Size', 'Orientation', 'Ratio'].map((name, index) => ({ name, key: name, required: false, groupBy: false, sortOrder: index + 1 })),
      editorRules: {
        allowImageUpload: true, allowCustomSize: false, allowAddText: true, allowClipart: false,
        allowBackgroundColor: true, allowBackgroundImage: false, allowCrop: true, allowRotate: true,
        allowDeleteObjects: true, allowLayersPanel: true, maxImageCount: 10, maxTextCount: 20,
        minimumDpiWarning: 150, minimumDpiBlock: 72, requirePlaceholdersFilled: true,
      },
      exportRules: {
        format: 'PDF', dpi: 300, rasterQuality: 94, includeBleed: true, flattenOutput: true,
        transparentBackground: false, backgroundColor: '#ffffff', filenameTemplate: '{orderId}_{sku}_{surface}', colorMode: 'RGB',
      },
    };
    case 'collages': case 'layout_templates': return { status: 'draft', tags: [], sortOrder: 0 };
    case 'image_assets': return { storageProvider: 'r2', tags: [] };
    default: return { status: 'draft', sortOrder: 0 };
  }
}

function dbValue(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function typedField(table: string, field: string): string | undefined {
  if (field === 'id') return 'id';
  if (field === 'accountId' && table !== 'accounts') return 'account_id';
  if (field === 'merchantId' && !['accounts', 'users', 'merchants'].includes(table)) return 'merchant_id';
  if (field === 'status' && table !== 'users' && table !== 'image_folders' && table !== 'image_assets') return 'status';
  if (field === 'slug' && ['merchants', 'product_categories', 'layout_categories', 'image_folders', 'collages', 'layout_templates', 'products'].includes(table)) return 'slug';
  if (field === 'categoryId' && ['products', 'collages'].includes(table)) return 'category_id';
  if (field === 'productId' && ['design_projects', 'design_cart_items', 'design_processing_jobs'].includes(table)) return 'product_id';
  if (field === 'cartItemId' && ['design_projects', 'design_processing_jobs'].includes(table)) return 'cart_item_id';
  if (field === 'projectId' && ['design_projects', 'design_cart_items'].includes(table)) return 'project_id';
  if (field === 'productType' && ['products', 'design_cart_items'].includes(table)) return 'product_type';
  if (field === 'orientation' && ['collages', 'layout_templates'].includes(table)) return 'orientation';
  if (field === 'templateType' && table === 'layout_templates') return 'template_type';
  if (field === 'printGenerationStatus' && table === 'design_cart_items') return 'print_generation_status';
  if (field === 'orderId' && table === 'design_cart_items') return 'order_id';
  if (field === 'apiPrivateKeyHash' && table === 'merchants') return 'api_key_hash';
  if (field === 'parentFolderId' && table === 'image_folders') return 'parent_folder_id';
  if (field === 'folderId' && table === 'image_assets') return 'folder_id';
  if (field === 'priority' && table === 'design_processing_jobs') return 'priority';
  if (field === 'availableAt' && table === 'design_processing_jobs') return 'available_at';
  return undefined;
}

function uuidField(table: string, field: string) {
  const column = typedField(table, field);
  return Boolean(column && ['id', 'account_id', 'merchant_id', 'category_id', 'product_id', 'cart_item_id', 'parent_folder_id', 'folder_id'].includes(column));
}

function fieldSql(table: string, field: string, args: unknown[]): string {
  const typed = typedField(table, field);
  if (typed) return typed;
  if (field === 'createdAt') return 'created_at';
  if (field === 'updatedAt') return 'updated_at';
  args.push(field.split('.'));
  const path = `$${args.length}::text[]`;
  const value = `(payload #>> ${path})`;
  if (numericFields.has(field)) return `NULLIF(${value}, '')::numeric`;
  if (dateFields.has(field)) return `NULLIF(${value}, '')::timestamptz`;
  return value;
}

function predicate(table: string, query: Data, args: unknown[]): string {
  const clauses: string[] = [];
  for (const [field, wanted] of Object.entries(query)) {
    if (field === '$or' || field === '$and') {
      const pieces = (wanted as Data[]).map((part) => `(${predicate(table, part, args)})`);
      clauses.push(pieces.length ? `(${pieces.join(field === '$or' ? ' OR ' : ' AND ')})` : 'TRUE');
      continue;
    }
    if (field === 'pages.collageId') {
      args.push(wanted);
      clauses.push(`EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'pages', '[]'::jsonb)) AS page WHERE page->>'collageId' = $${args.length})`);
      continue;
    }
    if (field === 'tags' && typeof wanted === 'object' && wanted && '$in' in wanted) {
      args.push((wanted.$in as unknown[]).map(String));
      clauses.push(`EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(payload->'tags', '[]'::jsonb)) AS tag WHERE tag.value = ANY($${args.length}::text[]))`);
      continue;
    }
    const column = fieldSql(table, field, args);
    if (wanted === null || wanted === undefined) { clauses.push(`${column} IS NULL`); continue; }
    if (wanted instanceof RegExp) {
      args.push(wanted.source);
      clauses.push(`${column} ${wanted.ignoreCase ? '~*' : '~'} $${args.length}`);
      continue;
    }
    if (typeof wanted === 'object' && !(wanted instanceof Date) && !Array.isArray(wanted)) {
      const ops = wanted as Data;
      if ('$in' in ops) {
        const values = (ops.$in as unknown[]).map((value) => String(value));
        args.push(values);
        if (field === 'tags') {
          clauses.push(`EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(payload->'tags', '[]'::jsonb)) AS tag WHERE tag.value = ANY($${args.length}::text[]))`);
        } else {
        clauses.push(`${column} = ANY($${args.length}::${uuidField(table, field) ? 'uuid' : 'text'}[])`);
        }
      }
      if ('$ne' in ops) {
        args.push(dbValue(ops.$ne));
        clauses.push(`${column} IS DISTINCT FROM $${args.length}`);
      }
      for (const [op, symbol] of [['$lte', '<='], ['$lt', '<'], ['$gte', '>='], ['$gt', '>']] as const) {
        if (op in ops) { args.push(dbValue(ops[op])); clauses.push(`${column} ${symbol} $${args.length}`); }
      }
      if ('$regex' in ops) {
        const pattern = ops.$regex instanceof RegExp ? ops.$regex.source : String(ops.$regex);
        args.push(pattern);
        clauses.push(`${column} ${String(ops.$options ?? '').includes('i') ? '~*' : '~'} $${args.length}`);
      }
      continue;
    }
    args.push(dbValue(wanted));
    clauses.push(`${column} = $${args.length}`);
  }
  return clauses.length ? clauses.join(' AND ') : 'TRUE';
}

function fromRow(row: Data): Data {
  return { ...row.payload, id: row.id, createdAt: row.created_at, updatedAt: row.updated_at };
}

function stripSystemFields(value: Data) {
  const { id: id, createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = value;
  return payload;
}

function copyProjected(target: Data, source: Data, keys: string[]) {
  const [key, ...rest] = keys;
  if (!rest.length) { target[key] = source?.[key]; return; }
  if (Array.isArray(source?.[key])) {
    const existing = Array.isArray(target[key]) ? target[key] : [];
    target[key] = source[key].map((item: Data, index: number) => {
      const next = existing[index] ?? {};
      copyProjected(next, item, rest);
      return next;
    });
    return;
  }
  target[key] ??= {};
  copyProjected(target[key], source?.[key] ?? {}, rest);
}

function projectedPayload(table: string, projection?: string): string {
  if (!projection || projection.startsWith('+')) return 'payload';
  const fields = projection.split(/\s+/).filter(Boolean);
  if (fields.some((field) => !/^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)?$/.test(field))) return 'payload';
  if (fields.some((field) => field.includes('.') && !(table === 'products' && (field === 'variants.id' || field === 'optionGroups.id')))) return 'payload';
  const parts: string[] = [];
  for (const field of fields) {
    if (field === 'id' || field === 'createdAt' || field === 'updatedAt') continue;
    if (field === 'variants.id' || field === 'optionGroups.id') {
      const key = field.split('.')[0];
      parts.push(`'${key}', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', entry->'id')), '[]'::jsonb) FROM jsonb_array_elements(COALESCE(payload->'${key}', '[]'::jsonb)) entry)`);
    } else {
      parts.push(`'${field}', payload->'${field}'`);
    }
  }
  return parts.length ? `jsonb_build_object(${parts.join(', ')})` : "'{}'::jsonb";
}

async function syncPages(client: Client, template: Data) {
  await client.query('DELETE FROM layout_template_pages WHERE template_id = $1', [template.id]);
  for (const [index, page] of (template.pages ?? []).entries()) {
    page.id ??= randomUUID();
    await client.query(
      'INSERT INTO layout_template_pages (id, template_id, collage_id, page_number, payload) VALUES ($1,$2,$3,$4,$5)',
      [page.id, template.id, page.collageId || null, index + 1, JSON.stringify(page)],
    );
  }
}

export function recordModel(table: string) {
  if (!tables.has(table)) throw new Error(`Unknown PostgreSQL table: ${table}`);
  return class RecordModel {
    [key: string]: any;
    constructor(data: Data = {}) { Object.assign(this, data); }

    async save() {
      const saved = await RecordModel.upsert(this as Data);
      Object.assign(this, saved);
      return this;
    }
    toObject() { return { ...this }; }
    toJSON() {
      const value = { ...this };
      if (table === 'users') delete value.passwordHash;
      if (table === 'merchants') { delete value.apiPrivateKeyHash; delete value.apiPrivateKeySecret; }
      return value;
    }
    static async upsert(input: Data) {
      const data = addNestedIds({ ...defaults(table), ...input }) as Data;
      if (table === 'products') {
        const productDefaults = defaults(table);
        data.editorRules = { ...productDefaults.editorRules, ...(data.editorRules ?? {}) };
        data.exportRules = { ...productDefaults.exportRules, ...(data.exportRules ?? {}) };
        data.variants = (data.variants ?? []).map((variant: Data) => ({ status: 'draft', options: {}, previewImageUrl: '', thumbnailImageUrl: '', roomPreviews: [], ...variant }));
      }
      const accountId = currentAccountId();
      if (accountId && table !== 'accounts') {
        if (data.accountId && data.accountId !== accountId) throw new ApiError(403, 'Account does not match your session.');
        data.accountId = accountId;
      }
      data.id ??= randomUUID();
      const write = async (client: Client) => {
        const job = table === 'design_processing_jobs';
        const result = await client.query(
          `INSERT INTO ${table} (id, payload${job ? ', available_at' : ''}) VALUES ($1, $2::jsonb${job ? ', $3::timestamptz' : ''})
           ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()${job ? ', available_at = EXCLUDED.available_at' : ''}
           RETURNING *`,
          job ? [data.id, JSON.stringify(stripSystemFields(data)), data.availableAt ?? new Date()] : [data.id, JSON.stringify(stripSystemFields(data))],
        );
        const saved = fromRow(result.rows[0]);
        if (table === 'layout_templates') await syncPages(client, saved);
        return new RecordModel(saved);
      };
      return table === 'layout_templates' ? withTransaction(write) : write(getPostgresClient());
    }
    static create(data: Data) { return RecordModel.upsert(data); }
    static async insertMany(items: Data[]) { const result = []; for (const item of items) result.push(await RecordModel.create(item)); return result; }
    static find(query: Data = {}) { return new RecordQuery(table, scopedQuery(table, query), 'many'); }
    static findOne(query: Data = {}) { return new RecordQuery(table, scopedQuery(table, query), 'one'); }
    static findById(id: unknown) { return new RecordQuery(table, scopedQuery(table, { id: String(id) }), 'one'); }
    static async countDocuments(query: Data = {}) {
      const args: unknown[] = [];
      const where = predicate(table, scopedQuery(table, query), args);
      const result = await getPostgresClient().query(`SELECT count(*)::int AS count FROM ${table} WHERE ${where}`, args);
      return result.rows[0].count as number;
    }
    static async exists(query: Data = {}) { return (await RecordModel.findOne(query).lean()) ? { id: true } : null; }
    static async findOneAndUpdate(query: Data, update: Data, options: Data = {}) {
      return withTransaction(async (client) => {
        const args: unknown[] = [];
        const where = predicate(table, scopedQuery(table, query), args);
        const found = await client.query(`SELECT * FROM ${table} WHERE ${where} ORDER BY created_at LIMIT 1 FOR UPDATE`, args);
        if (!found.rows.length && !options.upsert) return null;
        const current = found.rows.length ? fromRow(found.rows[0]) : { ...defaults(table), ...scopedQuery(table, query) };
        const { $set, $inc, ...plain } = update;
        const next = addNestedIds({ ...current, ...plain, ...($set ?? {}) }) as Data;
        for (const [key, delta] of Object.entries($inc ?? {})) next[key] = Number(next[key] ?? 0) + Number(delta);
        const accountId = currentAccountId();
        if (accountId && table !== 'accounts' && next.accountId !== accountId) throw new ApiError(403, 'Account does not match your session.');
        next.id = current.id ?? randomUUID();
        const job = table === 'design_processing_jobs';
        const saved = await client.query(
          `INSERT INTO ${table} (id, payload${job ? ', available_at' : ''}) VALUES ($1,$2::jsonb${job ? ', $3::timestamptz' : ''}) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()${job ? ', available_at = EXCLUDED.available_at' : ''} RETURNING *`,
          job ? [next.id, JSON.stringify(stripSystemFields(next)), next.availableAt ?? new Date()] : [next.id, JSON.stringify(stripSystemFields(next))],
        );
        const record = fromRow(saved.rows[0]);
        if (table === 'layout_templates') await syncPages(client, record);
        return new RecordModel(record);
      });
    }
    static findByIdAndUpdate(id: unknown, update: Data, options: Data = {}) { return RecordModel.findOneAndUpdate({ id: String(id) }, update, options); }
    static async findByIdAndDelete(id: unknown) {
      const accountId = currentAccountId();
      const scoped = accountId && table !== 'accounts' ? ' AND account_id = $2' : accountId ? ' AND id = $2' : '';
      const result = await getPostgresClient().query(`DELETE FROM ${table} WHERE id = $1${scoped} RETURNING *`, accountId ? [String(id), accountId] : [String(id)]);
      return result.rows[0] ? new RecordModel(fromRow(result.rows[0])) : null;
    }
    static async deleteOne(query: Data) {
      const found = await RecordModel.findOne(query).lean();
      if (!found) return { deletedCount: 0 };
      await RecordModel.findByIdAndDelete(found.id);
      return { deletedCount: 1 };
    }
  };
}

class RecordQuery implements PromiseLike<any> {
  private order: Sort = {};
  private offset = 0;
  private cap: number | undefined;
  private projection: string | undefined;
  private plain = false;
  constructor(private table: string, private filter: Data, private mode: 'many' | 'one') {}
  sort(value: Sort) { this.order = value; return this; }
  skip(value: number) { this.offset = value; return this; }
  limit(value: number) { this.cap = value; return this; }
  select(value: string) { this.projection = value; return this; }
  lean() { this.plain = true; return this; }
  private async execute() {
    const args: unknown[] = [];
    const where = predicate(this.table, this.filter, args);
    const order = Object.entries(this.order).map(([field, direction]) => `${fieldSql(this.table, field, args)} ${direction < 0 ? 'DESC' : 'ASC'}`).join(', ');
    let sql = `SELECT id, created_at, updated_at, ${projectedPayload(this.table, this.projection)} AS payload FROM ${this.table} WHERE ${where}`;
    if (order) sql += ` ORDER BY ${order}`;
    if (this.mode === 'one') sql += ' LIMIT 1';
    else {
      if (this.cap !== undefined) { args.push(this.cap); sql += ` LIMIT $${args.length}`; }
      if (this.offset) { args.push(this.offset); sql += ` OFFSET $${args.length}`; }
    }
    const result = await getPostgresClient().query(sql, args);
    const rows = result.rows.map((row) => {
      const item = fromRow(row);
      if (this.projection) {
        const allowed = this.projection.split(/\s+/).filter((field) => field && !field.startsWith('+'));
        if (allowed.length && !this.projection.startsWith('+')) {
          const selected: Data = { id: item.id };
          for (const field of allowed) copyProjected(selected, item, field.split('.'));
          return this.plain ? selected : selected;
        }
      }
      if (this.table === 'users' && this.projection !== '+passwordHash') delete item.passwordHash;
      if (this.table === 'merchants' && this.projection !== '+apiPrivateKeySecret') { delete item.apiPrivateKeyHash; delete item.apiPrivateKeySecret; }
      return this.plain ? item : new (recordModel(this.table))(item);
    });
    return this.mode === 'one' ? (rows[0] ?? null) : rows;
  }
  then<TResult1 = any, TResult2 = never>(onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
