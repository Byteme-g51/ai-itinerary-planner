-- The feasibility result the creator's editor produced at submission, so the
-- admin review page can show the score and suggestions. It is calculated in
-- the creator's browser, so it is informational, not a verified score.
ALTER TABLE public.travel_packages
  ADD COLUMN IF NOT EXISTS latest_feasibility JSONB;

COMMENT ON COLUMN public.travel_packages.latest_feasibility IS
  'Feasibility result the creator''s editor reported at submission (quality_score, is_feasible, hard_errors, soft_warnings, checked_at). Set only by submit_package_for_review; not verified by the server.';

-- Owners can UPDATE their own packages straight through PostgREST (RLS
-- "Owners and admins manage packages"), so the column is locked with a
-- trigger: only the service role (the API) may write it.
CREATE OR REPLACE FUNCTION public.protect_latest_feasibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.role(), '') IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.latest_feasibility := NULL;
    ELSIF NEW.latest_feasibility IS DISTINCT FROM OLD.latest_feasibility THEN
      NEW.latest_feasibility := OLD.latest_feasibility;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_latest_feasibility ON public.travel_packages;
CREATE TRIGGER trg_protect_latest_feasibility
  BEFORE INSERT OR UPDATE ON public.travel_packages
  FOR EACH ROW EXECUTE FUNCTION public.protect_latest_feasibility();

-- Submission now also stores the result in the same transaction as the status
-- change. A submission without a result clears the previous one, so a package
-- never carries a stale result from an earlier submission.
DROP FUNCTION IF EXISTS public.submit_package_for_review(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.submit_package_for_review(
  p_actor_id UUID,
  p_package_id UUID,
  p_note TEXT,
  p_feasibility JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status TEXT;
  v_base_price_aud BIGINT;
  v_hotel_count INT;
  v_activity_count INT;
  v_missing TEXT[] := '{}';
  v_failures TEXT[] := '{}';
BEGIN
  IF p_actor_id IS NULL OR p_package_id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  -- Lock before checking status and components so save cannot race submission.
  SELECT status, base_price_aud INTO v_status, v_base_price_aud
  FROM public.travel_packages
  WHERE package_id = p_package_id AND creator_id = p_actor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'not_found');
  END IF;

  IF v_status NOT IN ('draft', 'rejected') THEN
    v_failures := v_failures || format(
      'Package status is ''%s''; only ''draft'' or ''rejected'' packages may be submitted.',
      v_status
    );
  END IF;

  SELECT count(*) INTO v_hotel_count FROM public.package_hotels WHERE package_id = p_package_id;
  SELECT count(*) INTO v_activity_count FROM public.package_activities WHERE package_id = p_package_id;

  IF v_hotel_count = 0 THEN v_missing := array_append(v_missing, 'hotel'); END IF;
  IF v_activity_count = 0 THEN v_missing := array_append(v_missing, 'activity'); END IF;

  IF array_length(v_missing, 1) > 0 THEN
    v_failures := v_failures || (
      'Package must have at least one ' || array_to_string(v_missing, ', ') || '.'
    );
  END IF;

  IF COALESCE(v_base_price_aud, 0) <= 0 THEN
    v_failures := array_append(v_failures, 'base_price_aud must be greater than 0.');
  END IF;

  IF array_length(v_failures, 1) > 0 THEN
    RETURN jsonb_build_object(
      'outcome', 'precondition_failed',
      'details', jsonb_build_object(
        'failures', v_failures,
        'missing', to_jsonb(v_missing)
      )
    );
  END IF;

  UPDATE public.travel_packages SET
    status = 'pending_review',
    submitted_at = now(),
    submission_note = p_note,
    latest_feasibility = p_feasibility,
    updated_at = now()
  WHERE package_id = p_package_id;

  RETURN jsonb_build_object('outcome', 'ok', 'package_id', p_package_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_package_for_review(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_package_for_review(UUID, UUID, TEXT, JSONB) TO service_role;

NOTIFY pgrst, 'reload schema';
