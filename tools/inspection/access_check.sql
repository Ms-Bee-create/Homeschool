-- READ ONLY: metadata/privileges only. No child answers, PIN hashes or media are read.
-- Run this one SELECT in the Supabase SQL editor; download its result for review.
select jsonb_build_object(
 'captured_at',now(),
 'api_roles',(select jsonb_agg(jsonb_build_object(
   'role',r.rolname,'schema_usage',has_schema_privilege(r.oid,'public','USAGE'),
   'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,
      'select',has_table_privilege(r.oid,c.oid,'SELECT'),
      'insert',has_table_privilege(r.oid,c.oid,'INSERT'),
      'update',has_table_privilege(r.oid,c.oid,'UPDATE'),
      'delete',has_table_privilege(r.oid,c.oid,'DELETE')) order by c.relname)
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname in ('al_assignments','al_questions','al_kids','member_pins')),
   'storage_schema_usage',has_schema_privilege(r.oid,'storage','USAGE'),
   'storage_select',has_table_privilege(r.oid,'storage.objects','SELECT'),
   'storage_insert',has_table_privilege(r.oid,'storage.objects','INSERT')))
   from pg_roles r where r.rolname in ('anon','authenticated')),
 'upload_bucket',(select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'public',b.public,'file_size_limit',b.file_size_limit,'allowed_mime_types',b.allowed_mime_types)),'[]'::jsonb)
                  from storage.buckets b where b.id='lesson-uploads'),
 'missing_inspector_column',not exists(select 1 from information_schema.columns
                  where table_schema='public' and table_name='al_kids' and column_name='block_order'),
 'limits','Metadata only. Does not test live family-row access or change permissions.'
) as access_check;
