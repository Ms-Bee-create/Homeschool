-- READ ONLY. Run privately in Supabase's SQL editor and save the result locally.
-- Describes installed structure, not a complete schema dump or a data backup.
begin transaction read only;
select jsonb_build_object(
  'captured_at', now(),
  'tables', (select coalesce(jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'name',c.relname,'kind',c.relkind,'rls',c.relrowsecurity,
    'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull) order by a.attnum)
               from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
    'constraints',(select coalesce(jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid))), '[]'::jsonb)
                   from pg_constraint k where k.conrelid=c.oid)
  ) order by n.nspname,c.relname),'[]'::jsonb)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p','v','m')),
  'policies',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from pg_policies p where schemaname in ('public','storage')),
  'functions',(select coalesce(jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'security_definer',p.prosecdef)),'[]'::jsonb)
               from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
  'limits','Inventory only. Does not export data, auth users, secrets, full function definitions or complete restorable schema.'
) as recovery_inventory;
rollback;
