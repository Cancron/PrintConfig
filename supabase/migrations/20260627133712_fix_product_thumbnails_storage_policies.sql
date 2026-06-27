
/*
# Fix product-thumbnails storage policies

The bucket `product-thumbnails` had no working policies because:
- The previous INSERT policy targeted `public-thumbnails` (wrong bucket id).
- No SELECT, UPDATE, or DELETE policies existed for this bucket.
- The frontend uses the anon key (no auth session), so policies must include the `anon` role.

## Changes
- Drop the stale policy targeting the wrong bucket id.
- Create correct SELECT, INSERT, UPDATE, DELETE policies for `product-thumbnails`
  scoped to both `anon` and `authenticated` roles.
*/

-- Remove stale policy with wrong bucket reference
DROP POLICY IF EXISTS "Allow authenticated uploads to thumbnails" ON storage.objects;

-- SELECT: needed for public URL resolution and image display
DROP POLICY IF EXISTS "anon_select_product_thumbnails" ON storage.objects;
CREATE POLICY "anon_select_product_thumbnails"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-thumbnails');

-- INSERT: allow uploads
DROP POLICY IF EXISTS "anon_insert_product_thumbnails" ON storage.objects;
CREATE POLICY "anon_insert_product_thumbnails"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'product-thumbnails');

-- UPDATE: allow upsert/replace
DROP POLICY IF EXISTS "anon_update_product_thumbnails" ON storage.objects;
CREATE POLICY "anon_update_product_thumbnails"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'product-thumbnails')
WITH CHECK (bucket_id = 'product-thumbnails');

-- DELETE: allow removal when replacing or clearing thumbnail
DROP POLICY IF EXISTS "anon_delete_product_thumbnails" ON storage.objects;
CREATE POLICY "anon_delete_product_thumbnails"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'product-thumbnails');
