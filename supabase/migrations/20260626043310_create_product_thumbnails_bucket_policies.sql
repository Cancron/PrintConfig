
/*
# Product Thumbnails Storage Policies

Creates RLS policies for the product-thumbnails storage bucket so that
the anon-key frontend can upload, read, and delete thumbnail images.

1. Security
  - Allow anon + authenticated users to SELECT (read) objects in product-thumbnails.
  - Allow anon + authenticated users to INSERT (upload) objects.
  - Allow anon + authenticated users to DELETE objects.
  - Allow anon + authenticated users to UPDATE objects.
*/

DROP POLICY IF EXISTS "anon_select_gallery" ON storage.objects;
CREATE POLICY "anon_select_gallery"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'gallery');

DROP POLICY IF EXISTS "anon_insert_gallery" ON storage.objects;
CREATE POLICY "anon_insert_gallery"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'gallery');

DROP POLICY IF EXISTS "anon_update_gallery" ON storage.objects;
CREATE POLICY "anon_update_gallery"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'gallery')
WITH CHECK (bucket_id = 'gallery');

DROP POLICY IF EXISTS "anon_delete_gallery" ON storage.objects;
CREATE POLICY "anon_delete_gallery"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'gallery');

DROP POLICY IF EXISTS "anon_select_thumbnails" ON storage.objects;
CREATE POLICY "anon_select_thumbnails"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-thumbnails');

DROP POLICY IF EXISTS "anon_insert_thumbnails" ON storage.objects;
CREATE POLICY "anon_insert_thumbnails"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'product-thumbnails');

DROP POLICY IF EXISTS "anon_update_thumbnails" ON storage.objects;
CREATE POLICY "anon_update_thumbnails"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'product-thumbnails')
WITH CHECK (bucket_id = 'product-thumbnails');

DROP POLICY IF EXISTS "anon_delete_thumbnails" ON storage.objects;
CREATE POLICY "anon_delete_thumbnails"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'product-thumbnails');
