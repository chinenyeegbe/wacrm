-- ============================================================
-- 019 — Insert into the active workspace
-- ============================================================
-- Idempotent. Builds on 017 (the fill trigger) and 018 (the header).
--
-- PROBLEM
--   017's wacrm_fill_workspace_id() derived workspace_id from the row's
--   user_id -> the owner's *personal* default workspace. That's correct
--   for single-tenant installs and for service-role writes, but once a
--   team member is invited into someone else's workspace (migration 020
--   UI), their inserts would silently land in their OWN personal
--   workspace instead of the shared one they're working in.
--
-- FIX
--   Prefer the active workspace from the x-workspace-id request header
--   (the same one 018 uses for reads) when the caller can access it.
--   Service-role writes (webhook / automation / flow engines) send no
--   header, so they keep falling back to the owner's default — unchanged.
--
-- SAFE
--   The chosen workspace is still gated by can_access_workspace(), and
--   the INSERT is independently re-checked by the in_active_workspace()
--   WITH CHECK policy from 018. A spoofed header can't place a row in a
--   workspace the caller can't access.
-- ============================================================

CREATE OR REPLACE FUNCTION public.wacrm_fill_workspace_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user uuid;
  header_ws uuid;
  raw_header text;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    -- 1. Prefer the active workspace from the request header, when the
    --    caller can access it.
    BEGIN
      raw_header := nullif(
        current_setting('request.headers', true)::json ->> 'x-workspace-id', ''
      );
      IF raw_header IS NOT NULL THEN
        header_ws := raw_header::uuid;
      END IF;
    EXCEPTION WHEN others THEN
      header_ws := NULL;  -- malformed header -> ignore, fall through
    END;

    IF header_ws IS NOT NULL AND public.can_access_workspace(header_ws) THEN
      NEW.workspace_id := header_ws;
    ELSE
      -- 2. Fall back to the row owner's personal default workspace.
      target_user := COALESCE(NEW.user_id, auth.uid());
      NEW.workspace_id := public.default_workspace_for(target_user);
    END IF;

    IF NEW.workspace_id IS NULL THEN
      RAISE EXCEPTION
        'wacrm_fill_workspace_id: cannot resolve a workspace on table %',
        TG_TABLE_NAME;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.wacrm_fill_workspace_id() OWNER TO postgres;
