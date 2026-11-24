CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  name text GENERATED ALWAYS AS (payload->>'name') STORED,
  status text GENERATED ALWAYS AS (payload->>'status') STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  account_id uuid GENERATED ALWAYS AS (NULLIF(payload->>'accountId', '')::uuid) STORED REFERENCES accounts(id),
  email text GENERATED ALWAYS AS (lower(payload->>'email')) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email)
);

CREATE TABLE merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  account_id uuid GENERATED ALWAYS AS ((payload->>'accountId')::uuid) STORED NOT NULL REFERENCES accounts(id),
  slug text GENERATED ALWAYS AS (payload->>'slug') STORED NOT NULL,
  status text GENERATED ALWAYS AS (payload->>'status') STORED,
  api_key_hash text GENERATED ALWAYS AS (payload->>'apiPrivateKeyHash') STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, slug),
  UNIQUE (api_key_hash)
);

CREATE TABLE product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  account_id uuid GENERATED ALWAYS AS ((payload->>'accountId')::uuid) STORED NOT NULL REFERENCES accounts(id),
  merchant_id uuid GENERATED ALWAYS AS (NULLIF(payload->>'merchantId', '')::uuid) STORED REFERENCES merchants(id),
  scope text GENERATED ALWAYS AS (payload->>'scope') STORED NOT NULL,
  slug text GENERATED ALWAYS AS (payload->>'slug') STORED NOT NULL,
  status text GENERATED ALWAYS AS (payload->>'status') STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (account_id, scope, merchant_id, slug),
  CHECK (scope IN ('shared', 'merchant')),
  CHECK ((scope = 'shared' AND merchant_id IS NULL) OR (scope = 'merchant' AND merchant_id IS NOT NULL))
);

CREATE TABLE layout_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  account_id uuid GENERATED ALWAYS AS ((payload->>'accountId')::uuid) STORED NOT NULL REFERENCES accounts(id),
  merchant_id uuid GENERATED ALWAYS AS (NULLIF(payload->>'merchantId', '')::uuid) STORED REFERENCES merchants(id),
  scope text GENERATED ALWAYS AS (payload->>'scope') STORED NOT NULL,
  slug text GENERATED ALWAYS AS (payload->>'slug') STORED NOT NULL,
  status text GENERATED ALWAYS AS (payload->>'status') STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (account_id, scope, merchant_id, slug),
  CHECK (scope IN ('shared', 'merchant')),
  CHECK ((scope = 'shared' AND merchant_id IS NULL) OR (scope = 'merchant' AND merchant_id IS NOT NULL))
);

CREATE TABLE image_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  account_id uuid GENERATED ALWAYS AS ((payload->>'accountId')::uuid) STORED NOT NULL REFERENCES accounts(id),
  merchant_id uuid GENERATED ALWAYS AS (NULLIF(payload->>'merchantId', '')::uuid) STORED REFERENCES merchants(id),
  parent_folder_id uuid GENERATED ALWAYS AS (NULLIF(payload->>'parentFolderId', '')::uuid) STORED REFERENCES image_folders(id),
  scope text GENERATED ALWAYS AS (payload->>'scope') STORED NOT NULL,
  slug text GENERATED ALWAYS AS (payload->>'slug') STORED NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (account_id, merchant_id, scope, parent_folder_id, slug),
  CHECK (scope IN ('shared', 'merchant'))
);

CREATE TABLE image_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  account_id uuid GENERATED ALWAYS AS ((payload->>'accountId')::uuid) STORED NOT NULL REFERENCES accounts(id),
  merchant_id uuid GENERATED ALWAYS AS (NULLIF(payload->>'merchantId', '')::uuid) STORED REFERENCES merchants(id),
  folder_id uuid GENERATED ALWAYS AS (NULLIF(payload->>'folderId', '')::uuid) STORED REFERENCES image_folders(id),
  scope text GENERATED ALWAYS AS (payload->>'scope') STORED NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE collages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  account_id uuid GENERATED ALWAYS AS ((payload->>'accountId')::uuid) STORED NOT NULL REFERENCES accounts(id),
  merchant_id uuid GENERATED ALWAYS AS (NULLIF(payload->>'merchantId', '')::uuid) STORED REFERENCES merchants(id),
  category_id uuid GENERATED ALWAYS AS ((payload->>'categoryId')::uuid) STORED NOT NULL REFERENCES layout_categories(id),
  scope text GENERATED ALWAYS AS (payload->>'scope') STORED NOT NULL,
  slug text GENERATED ALWAYS AS (payload->>'slug') STORED NOT NULL,
  status text GENERATED ALWAYS AS (payload->>'status') STORED,
  orientation text GENERATED ALWAYS AS (payload->>'orientation') STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (account_id, scope, merchant_id, category_id, slug),
  CHECK (scope IN ('shared', 'merchant'))
);

CREATE TABLE layout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  account_id uuid GENERATED ALWAYS AS ((payload->>'accountId')::uuid) STORED NOT NULL REFERENCES accounts(id),
  merchant_id uuid GENERATED ALWAYS AS (NULLIF(payload->>'merchantId', '')::uuid) STORED REFERENCES merchants(id),
  scope text GENERATED ALWAYS AS (payload->>'scope') STORED NOT NULL,
  slug text GENERATED ALWAYS AS (payload->>'slug') STORED NOT NULL,
  status text GENERATED ALWAYS AS (payload->>'status') STORED,
  template_type text GENERATED ALWAYS AS (payload->>'templateType') STORED,
  orientation text GENERATED ALWAYS AS (payload->>'orientation') STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (account_id, scope, merchant_id, slug),
  CHECK (scope IN ('shared', 'merchant'))
);

CREATE TABLE layout_template_pages (
  id uuid PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES layout_templates(id) ON DELETE CASCADE,
  collage_id uuid REFERENCES collages(id) ON DELETE RESTRICT,
  page_number integer NOT NULL CHECK (page_number > 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (template_id, page_number)
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  account_id uuid GENERATED ALWAYS AS ((payload->>'accountId')::uuid) STORED NOT NULL REFERENCES accounts(id),
  merchant_id uuid GENERATED ALWAYS AS (NULLIF(payload->>'merchantId', '')::uuid) STORED REFERENCES merchants(id),
  category_id uuid GENERATED ALWAYS AS ((payload->>'categoryId')::uuid) STORED NOT NULL REFERENCES product_categories(id),
  scope text GENERATED ALWAYS AS (payload->>'scope') STORED NOT NULL,
  slug text GENERATED ALWAYS AS (payload->>'slug') STORED NOT NULL,
  product_type text GENERATED ALWAYS AS (payload->>'productType') STORED NOT NULL,
  status text GENERATED ALWAYS AS (payload->>'status') STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (account_id, scope, merchant_id, category_id, slug),
  CHECK (scope IN ('shared', 'merchant'))
);

CREATE TABLE design_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  account_id uuid GENERATED ALWAYS AS ((payload->>'accountId')::uuid) STORED NOT NULL REFERENCES accounts(id),
  merchant_id uuid GENERATED ALWAYS AS ((payload->>'merchantId')::uuid) STORED NOT NULL REFERENCES merchants(id),
  product_id uuid GENERATED ALWAYS AS ((payload->>'productId')::uuid) STORED NOT NULL REFERENCES products(id),
  project_id text GENERATED ALWAYS AS (payload->>'projectId') STORED,
  status text GENERATED ALWAYS AS (payload->>'status') STORED,
  product_type text GENERATED ALWAYS AS (payload->>'productType') STORED,
  order_id text GENERATED ALWAYS AS (payload->>'orderId') STORED,
  print_generation_status text GENERATED ALWAYS AS (payload->>'printGenerationStatus') STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE design_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  account_id uuid GENERATED ALWAYS AS ((payload->>'accountId')::uuid) STORED NOT NULL REFERENCES accounts(id),
  merchant_id uuid GENERATED ALWAYS AS ((payload->>'merchantId')::uuid) STORED NOT NULL REFERENCES merchants(id),
  product_id uuid GENERATED ALWAYS AS ((payload->>'productId')::uuid) STORED NOT NULL REFERENCES products(id),
  cart_item_id uuid GENERATED ALWAYS AS (NULLIF(payload->>'cartItemId', '')::uuid) STORED REFERENCES design_cart_items(id),
  project_id text GENERATED ALWAYS AS (payload->>'projectId') STORED NOT NULL UNIQUE,
  status text GENERATED ALWAYS AS (payload->>'status') STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE design_processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  account_id uuid GENERATED ALWAYS AS ((payload->>'accountId')::uuid) STORED NOT NULL REFERENCES accounts(id),
  merchant_id uuid GENERATED ALWAYS AS ((payload->>'merchantId')::uuid) STORED NOT NULL REFERENCES merchants(id),
  product_id uuid GENERATED ALWAYS AS ((payload->>'productId')::uuid) STORED NOT NULL REFERENCES products(id),
  cart_item_id uuid GENERATED ALWAYS AS ((payload->>'cartItemId')::uuid) STORED NOT NULL REFERENCES design_cart_items(id),
  status text GENERATED ALWAYS AS (payload->>'status') STORED,
  priority integer GENERATED ALWAYS AS (COALESCE((payload->>'priority')::integer, 0)) STORED,
  available_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_listing_idx ON products (account_id, merchant_id, status, product_type, updated_at DESC);
CREATE INDEX cart_items_listing_idx ON design_cart_items (account_id, merchant_id, status, product_type, updated_at DESC);
CREATE INDEX projects_lookup_idx ON design_projects (merchant_id, product_id, project_id);
CREATE INDEX jobs_claim_idx ON design_processing_jobs (status, available_at, priority DESC, created_at);
CREATE INDEX collages_listing_idx ON collages (account_id, merchant_id, status, orientation, updated_at DESC);
CREATE INDEX templates_listing_idx ON layout_templates (account_id, merchant_id, status, template_type, updated_at DESC);
