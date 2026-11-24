ALTER TABLE accounts ADD CONSTRAINT accounts_name_required CHECK (NULLIF(btrim(payload->>'name'), '') IS NOT NULL);
ALTER TABLE accounts ADD CONSTRAINT accounts_status_valid CHECK (status IN ('active', 'draft'));

ALTER TABLE users ADD CONSTRAINT users_email_required CHECK (NULLIF(btrim(email), '') IS NOT NULL);
ALTER TABLE users ADD CONSTRAINT users_name_required CHECK (NULLIF(btrim(payload->>'name'), '') IS NOT NULL);
ALTER TABLE users ADD CONSTRAINT users_password_hash_required CHECK (NULLIF(btrim(payload->>'passwordHash'), '') IS NOT NULL);

ALTER TABLE merchants ADD CONSTRAINT merchants_name_required CHECK (NULLIF(btrim(payload->>'name'), '') IS NOT NULL);
ALTER TABLE merchants ADD CONSTRAINT merchants_slug_valid CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
ALTER TABLE merchants ADD CONSTRAINT merchants_status_valid CHECK (status IN ('active', 'draft'));

ALTER TABLE product_categories ADD CONSTRAINT product_categories_name_required CHECK (NULLIF(btrim(payload->>'name'), '') IS NOT NULL);
ALTER TABLE product_categories ADD CONSTRAINT product_categories_slug_valid CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
ALTER TABLE product_categories ADD CONSTRAINT product_categories_status_valid CHECK (status IN ('active', 'draft', 'archived'));

ALTER TABLE layout_categories ADD CONSTRAINT layout_categories_name_required CHECK (NULLIF(btrim(payload->>'name'), '') IS NOT NULL);
ALTER TABLE layout_categories ADD CONSTRAINT layout_categories_slug_valid CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
ALTER TABLE layout_categories ADD CONSTRAINT layout_categories_status_valid CHECK (status IN ('active', 'draft', 'archived'));

ALTER TABLE collages ADD CONSTRAINT collages_name_required CHECK (NULLIF(btrim(payload->>'name'), '') IS NOT NULL);
ALTER TABLE collages ADD CONSTRAINT collages_slug_valid CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
ALTER TABLE collages ADD CONSTRAINT collages_status_valid CHECK (status IN ('active', 'draft', 'archived'));

ALTER TABLE layout_templates ADD CONSTRAINT layout_templates_name_required CHECK (NULLIF(btrim(payload->>'name'), '') IS NOT NULL);
ALTER TABLE layout_templates ADD CONSTRAINT layout_templates_slug_valid CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
ALTER TABLE layout_templates ADD CONSTRAINT layout_templates_status_valid CHECK (status IN ('active', 'draft', 'archived'));

ALTER TABLE products ADD CONSTRAINT products_name_required CHECK (NULLIF(btrim(payload->>'name'), '') IS NOT NULL);
ALTER TABLE products ADD CONSTRAINT products_slug_valid CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
ALTER TABLE products ADD CONSTRAINT products_type_required CHECK (NULLIF(btrim(product_type), '') IS NOT NULL);
ALTER TABLE products ADD CONSTRAINT products_status_valid CHECK (status IN ('active', 'draft'));
