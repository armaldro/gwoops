-- ============================================================================
-- Hardening, from Supabase's database linter.
--
-- Applied after the fact rather than folded into the earlier migrations, so
-- that a database already created from those files converges on the same
-- state as a fresh one.
-- ============================================================================

-- These two were the only functions written without a pinned search_path;
-- everything else already sets it. A mutable search_path lets a caller who can
-- create objects earlier in the path shadow a built-in the function relies on.
alter function public.item_search_text(text, text, jsonb)
  set search_path = public, pg_temp;

alter function public.touch_updated_at()
  set search_path = public, pg_temp;

-- handle_new_user is a trigger function with no business being callable over
-- the REST API. It is SECURITY DEFINER and writes to household_members, so
-- leaving it at /rest/v1/rpc/ is needless surface. The trigger keeps firing —
-- trigger execution does not go through the caller's EXECUTE privilege.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- The four auth_* helpers stay callable on purpose. RLS policy expressions are
-- evaluated as the querying role, so revoking EXECUTE would make every policy
-- fail. They are safe to expose: each derives entirely from auth.uid(), so an
-- anonymous caller gets an empty set or false, and a signed-in caller only
-- learns their own membership, which they can already read.
--
-- Two linter warnings are knowingly left alone: citext and pg_trgm live in the
-- public schema. Moving them would mean rewriting allowed_emails.email's type
-- and rebuilding the trigram index, for no change in exposure.
