ALTER TABLE users ALTER COLUMN account_id SET NOT NULL;

ALTER TABLE merchants ADD CONSTRAINT merchants_id_account_unique UNIQUE (id, account_id);
ALTER TABLE product_categories ADD CONSTRAINT product_categories_id_account_unique UNIQUE (id, account_id);
ALTER TABLE layout_categories ADD CONSTRAINT layout_categories_id_account_unique UNIQUE (id, account_id);
ALTER TABLE image_folders ADD CONSTRAINT image_folders_id_account_unique UNIQUE (id, account_id);
ALTER TABLE collages ADD CONSTRAINT collages_id_account_unique UNIQUE (id, account_id);
ALTER TABLE layout_templates ADD CONSTRAINT layout_templates_id_account_unique UNIQUE (id, account_id);
ALTER TABLE products ADD CONSTRAINT products_id_account_unique UNIQUE (id, account_id);
ALTER TABLE design_cart_items ADD CONSTRAINT design_cart_items_id_account_unique UNIQUE (id, account_id);

ALTER TABLE product_categories ADD CONSTRAINT product_categories_merchant_account_fk FOREIGN KEY (merchant_id, account_id) REFERENCES merchants (id, account_id);
ALTER TABLE layout_categories ADD CONSTRAINT layout_categories_merchant_account_fk FOREIGN KEY (merchant_id, account_id) REFERENCES merchants (id, account_id);
ALTER TABLE image_folders ADD CONSTRAINT image_folders_merchant_account_fk FOREIGN KEY (merchant_id, account_id) REFERENCES merchants (id, account_id);
ALTER TABLE image_folders ADD CONSTRAINT image_folders_parent_account_fk FOREIGN KEY (parent_folder_id, account_id) REFERENCES image_folders (id, account_id);
ALTER TABLE image_assets ADD CONSTRAINT image_assets_merchant_account_fk FOREIGN KEY (merchant_id, account_id) REFERENCES merchants (id, account_id);
ALTER TABLE image_assets ADD CONSTRAINT image_assets_folder_account_fk FOREIGN KEY (folder_id, account_id) REFERENCES image_folders (id, account_id);
ALTER TABLE collages ADD CONSTRAINT collages_merchant_account_fk FOREIGN KEY (merchant_id, account_id) REFERENCES merchants (id, account_id);
ALTER TABLE collages ADD CONSTRAINT collages_category_account_fk FOREIGN KEY (category_id, account_id) REFERENCES layout_categories (id, account_id);
ALTER TABLE layout_templates ADD CONSTRAINT layout_templates_merchant_account_fk FOREIGN KEY (merchant_id, account_id) REFERENCES merchants (id, account_id);
ALTER TABLE products ADD CONSTRAINT products_merchant_account_fk FOREIGN KEY (merchant_id, account_id) REFERENCES merchants (id, account_id);
ALTER TABLE products ADD CONSTRAINT products_category_account_fk FOREIGN KEY (category_id, account_id) REFERENCES product_categories (id, account_id);
ALTER TABLE design_cart_items ADD CONSTRAINT design_cart_items_merchant_account_fk FOREIGN KEY (merchant_id, account_id) REFERENCES merchants (id, account_id);
ALTER TABLE design_cart_items ADD CONSTRAINT design_cart_items_product_account_fk FOREIGN KEY (product_id, account_id) REFERENCES products (id, account_id);
ALTER TABLE design_projects ADD CONSTRAINT design_projects_merchant_account_fk FOREIGN KEY (merchant_id, account_id) REFERENCES merchants (id, account_id);
ALTER TABLE design_projects ADD CONSTRAINT design_projects_product_account_fk FOREIGN KEY (product_id, account_id) REFERENCES products (id, account_id);
ALTER TABLE design_projects ADD CONSTRAINT design_projects_cart_account_fk FOREIGN KEY (cart_item_id, account_id) REFERENCES design_cart_items (id, account_id);
ALTER TABLE design_processing_jobs ADD CONSTRAINT design_jobs_merchant_account_fk FOREIGN KEY (merchant_id, account_id) REFERENCES merchants (id, account_id);
ALTER TABLE design_processing_jobs ADD CONSTRAINT design_jobs_product_account_fk FOREIGN KEY (product_id, account_id) REFERENCES products (id, account_id);
ALTER TABLE design_processing_jobs ADD CONSTRAINT design_jobs_cart_account_fk FOREIGN KEY (cart_item_id, account_id) REFERENCES design_cart_items (id, account_id);

ALTER TABLE image_folders ADD CONSTRAINT image_folders_scope_merchant_check CHECK ((scope = 'shared' AND merchant_id IS NULL) OR (scope = 'merchant' AND merchant_id IS NOT NULL));
ALTER TABLE image_assets ADD CONSTRAINT image_assets_scope_merchant_check CHECK ((scope = 'shared' AND merchant_id IS NULL) OR (scope = 'merchant' AND merchant_id IS NOT NULL));
ALTER TABLE collages ADD CONSTRAINT collages_scope_merchant_check CHECK ((scope = 'shared' AND merchant_id IS NULL) OR (scope = 'merchant' AND merchant_id IS NOT NULL));
ALTER TABLE layout_templates ADD CONSTRAINT layout_templates_scope_merchant_check CHECK ((scope = 'shared' AND merchant_id IS NULL) OR (scope = 'merchant' AND merchant_id IS NOT NULL));
ALTER TABLE products ADD CONSTRAINT products_scope_merchant_check CHECK ((scope = 'shared' AND merchant_id IS NULL) OR (scope = 'merchant' AND merchant_id IS NOT NULL));

ALTER TABLE layout_template_pages ADD COLUMN account_id uuid;
UPDATE layout_template_pages AS page SET account_id = template.account_id FROM layout_templates AS template WHERE template.id = page.template_id;
ALTER TABLE layout_template_pages ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE layout_template_pages ADD CONSTRAINT template_pages_template_account_fk FOREIGN KEY (template_id, account_id) REFERENCES layout_templates (id, account_id) ON DELETE CASCADE;
ALTER TABLE layout_template_pages ADD CONSTRAINT template_pages_collage_account_fk FOREIGN KEY (collage_id, account_id) REFERENCES collages (id, account_id) ON DELETE RESTRICT;
