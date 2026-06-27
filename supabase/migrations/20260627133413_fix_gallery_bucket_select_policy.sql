
/*
# Remove broad SELECT policy on gallery bucket

Public buckets serve files via CDN URL without requiring a SELECT RLS policy.
The `anon_select_gallery` policy was allowing clients to enumerate (list) all
files in the bucket, which exposes more data than intended.

INSERT, UPDATE, and DELETE policies are unchanged — uploads continue to work.
*/

DROP POLICY IF EXISTS "anon_select_gallery" ON storage.objects;
