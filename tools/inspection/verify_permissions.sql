-- READ ONLY: confirms installed policies/configuration, without reading family work.
select jsonb_build_object(
  'captured_at',now(),
  'school_tables_with_rls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname in ('al_assignments','al_questions') and c.relrowsecurity),
  'expected_household_policies',(select count(*) from pg_policies
     where schemaname='public' and policyname in ('school_assignments_household_only','school_questions_household_only')
       and tablename in ('al_assignments','al_questions') and roles=ARRAY['authenticated']::name[]
       and cmd='ALL' and qual='(household_id = auth.uid())' and with_check='(household_id = auth.uid())'),
  'unrestricted_school_policies_remaining',(select count(*) from pg_policies
     where schemaname='public' and tablename in ('al_assignments','al_questions')
       and permissive='PERMISSIVE' and (qual='true' or with_check='true')),
  'school_policies',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from pg_policies p
     where schemaname='public' and tablename in ('al_assignments','al_questions')),
  'upload_policies',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from pg_policies p
     where schemaname='storage' and tablename='objects'),
  'uploads_public',(select b.public from storage.buckets b where b.id='lesson-uploads'),
  'limits','Metadata only. No child work, PIN values, uploaded files or database records are changed.'
) as permission_verification;
