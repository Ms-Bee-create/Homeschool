-- Read-only login recovery inventory. Share the counts, never auth table rows.
-- Restricted to accounts referenced by the existing household records.
WITH household_accounts AS (
  SELECT u.* FROM auth.users u
  WHERE EXISTS (SELECT 1 FROM public.households h WHERE h.id = u.id)
)
SELECT jsonb_build_object(
  'check', 'Login recovery inventory',
  'households', (SELECT count(*) FROM public.households),
  'matching_login_accounts', (SELECT count(*) FROM household_accounts),
  'accounts_with_email', (SELECT count(*) FROM household_accounts WHERE nullif(email, '') IS NOT NULL),
  'accounts_with_password', (SELECT count(*) FROM household_accounts WHERE nullif(encrypted_password, '') IS NOT NULL),
  'unconfirmed_email_accounts', (SELECT count(*) FROM household_accounts WHERE nullif(email, '') IS NOT NULL AND email_confirmed_at IS NULL),
  'identity_records', (SELECT count(*) FROM auth.identities i WHERE EXISTS (SELECT 1 FROM household_accounts u WHERE u.id = i.user_id)),
  'mfa_factors', (SELECT count(*) FROM auth.mfa_factors f WHERE EXISTS (SELECT 1 FROM household_accounts u WHERE u.id = f.user_id))
) AS login_recovery_inventory;
