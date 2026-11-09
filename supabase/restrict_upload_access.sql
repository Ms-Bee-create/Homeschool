-- DRAFT: household-scoped file listing/uploads. Rehearse first; no data is deleted.
-- Existing public file URLs keep working. This does NOT make downloads private.
-- App upload paths must start with the authenticated household UUID followed by /.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='storage' AND c.relname='objects' AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'Storage RLS is not configured as expected; no changes applied';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND permissive='PERMISSIVE' AND cmd IN ('ALL','SELECT','INSERT')
    AND policyname NOT IN ('Allow read','Allow uploads','forge_uploads_household_read','forge_uploads_household_insert')) THEN
    RAISE EXCEPTION 'Unexpected storage policy; review it without changing other apps';
  END IF;
END $$;
DROP POLICY IF EXISTS "Allow read" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads" ON storage.objects;
DROP POLICY IF EXISTS forge_uploads_household_read ON storage.objects;
DROP POLICY IF EXISTS forge_uploads_household_insert ON storage.objects;
CREATE POLICY forge_uploads_household_read ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id='lesson-uploads' AND split_part(name,'/',1)=auth.uid()::text);
CREATE POLICY forge_uploads_household_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id='lesson-uploads' AND split_part(name,'/',1)=auth.uid()::text);
COMMIT;
