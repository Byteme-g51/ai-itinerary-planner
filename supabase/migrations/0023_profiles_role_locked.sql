-- ============================================================
-- profiles.role can only be changed by the service role (review
-- finding KI-02). RLS "Users can update own profile" (migration 0002)
-- has no column limit, so a signed-in user could set their own role to
-- 'admin', and both is_admin() and the API's require_admin_ctx trust it.
-- Same pattern as migration 0022's latest_feasibility lock: the policy
-- stays (users still edit their own name and avatar), and a trigger
-- rejects a role change made as a signed-in or anonymous user. Roles are
-- set by the service role (the API, seeds, SQL), which this leaves alone.
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IN ('authenticated', 'anon')
     AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only an administrator can change an account''s role.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();
