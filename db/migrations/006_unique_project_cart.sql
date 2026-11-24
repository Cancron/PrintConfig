CREATE UNIQUE INDEX design_cart_items_project_unique
  ON design_cart_items (project_id)
  WHERE project_id IS NOT NULL;
