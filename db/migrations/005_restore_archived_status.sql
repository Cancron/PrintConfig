ALTER TABLE accounts DROP CONSTRAINT accounts_status_valid;
ALTER TABLE accounts ADD CONSTRAINT accounts_status_valid CHECK (status IN ('active', 'draft', 'archived'));

ALTER TABLE merchants DROP CONSTRAINT merchants_status_valid;
ALTER TABLE merchants ADD CONSTRAINT merchants_status_valid CHECK (status IN ('active', 'draft', 'archived'));

ALTER TABLE products DROP CONSTRAINT products_status_valid;
ALTER TABLE products ADD CONSTRAINT products_status_valid CHECK (status IN ('active', 'draft', 'archived'));
