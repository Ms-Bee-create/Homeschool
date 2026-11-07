-- DRAFT remediation for the policies in the owner's supplied inventory.
-- Run in isolation first. No production execution is included in this draft.
-- No rows/columns/lesson content are changed. Other apps and storage are untouched.
-- The owner must review API grants and signed-in household behavior before release.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='al_assignments' AND c.relrowsecurity) OR
     NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='al_questions' AND c.relrowsecurity) THEN
    RAISE EXCEPTION 'Expected school tables with RLS enabled; no changes applied';
  END IF;
END $$;

DROP POLICY IF EXISTS "Allow read" ON public.al_assignments;
DROP POLICY IF EXISTS "Allow update" ON public.al_assignments;
DROP POLICY IF EXISTS "Allow insert" ON public.al_assignments;
DROP POLICY IF EXISTS "Allow insert" ON public.al_questions;

DROP POLICY IF EXISTS school_assignments_household_only ON public.al_assignments;
CREATE POLICY school_assignments_household_only ON public.al_assignments
FOR ALL TO authenticated
USING (household_id=auth.uid()) WITH CHECK (household_id=auth.uid());

-- The inventory already has an own-household policy on al_questions. Add an explicit
-- authenticated policy too so rerunning this draft does not depend on that legacy name.
DROP POLICY IF EXISTS school_questions_household_only ON public.al_questions;
CREATE POLICY school_questions_household_only ON public.al_questions
FOR ALL TO authenticated
USING (household_id=auth.uid()) WITH CHECK (household_id=auth.uid());

-- Abort if another unconditional permissive policy would keep the hole open.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('al_assignments','al_questions') AND permissive='PERMISSIVE'
    AND (qual='true' OR with_check='true')) THEN
    RAISE EXCEPTION 'Unexpected unconditional school policy remains; transaction rolled back';
  END IF;
END $$;
COMMIT;
