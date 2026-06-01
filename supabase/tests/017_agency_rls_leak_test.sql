-- ============================================================
-- 017 — Agency mode RLS leak test (TWO-ACCOUNT ISOLATION)
-- ============================================================
-- THE SAFETY GATE for migration 017. Run this against a real database
-- that has migration 017 applied. It:
--
--   1. Creates two users (→ two agencies, two workspaces via the
--      signup bootstrap trigger).
--   2. Seeds one row in every tenant table for each workspace.
--   3. Impersonates user A, then user B, as the `authenticated` role
--      with a matching JWT `sub`, and asserts — across EVERY tenant
--      table — that each user sees ONLY their own workspace's row and
--      NONE of the other's (no read leak), and is also a positive
--      control (they DO see their own row, so the policy isn't just
--      denying everything).
--   4. Asserts user A cannot UPDATE or INSERT into user B's workspace
--      (no write leak).
--
-- The whole thing runs in a transaction and ROLLBACKs at the end, so it
-- leaves no residue. Any leak raises an exception and aborts with a
-- clear message; a clean run prints "RLS LEAK TEST PASSED".
--
-- HOW TO RUN (local Supabase / throwaway project):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/tests/017_agency_rls_leak_test.sql
--
-- Do NOT run against production — it inserts (and rolls back)
-- auth.users rows. Identifiers are passed to the PL/pgSQL blocks via
-- session GUCs (test.*) because psql does not interpolate :'vars'
-- inside dollar-quoted bodies.
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

-- Fixed UUIDs so we control identity end-to-end.
\set uidA '11111111-1111-1111-1111-111111111111'
\set uidB '22222222-2222-2222-2222-222222222222'

-- ------------------------------------------------------------
-- 1. Two users. The on_auth_user_created trigger (migration 017)
--    bootstraps an agency + default workspace + owner membership for
--    each. We provide the columns GoTrue marks NOT NULL across common
--    versions; adjust if your auth.users schema differs.
-- ------------------------------------------------------------
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
VALUES
  (:'uidA', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'agency-a@example.test', '', NOW(), NOW(), '{}'::jsonb, '{"full_name":"Agency A"}'::jsonb),
  (:'uidB', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'agency-b@example.test', '', NOW(), NOW(), '{}'::jsonb, '{"full_name":"Agency B"}'::jsonb);

-- Capture each user's bootstrapped workspace, then stash every
-- identifier as a session GUC for the DO blocks below.
-- Default to empty so :'wsa'/:'wsb' stay defined even if \gset sees a
-- NULL (bootstrap failure) — the $chk$ block then reports it cleanly.
\set wsa ''
\set wsb ''
SELECT public.default_workspace_for(:'uidA'::uuid) AS wsa,
       public.default_workspace_for(:'uidB'::uuid) AS wsb \gset

SELECT set_config('test.uida', :'uidA', false);
SELECT set_config('test.uidb', :'uidB', false);
SELECT set_config('test.wsa', COALESCE(:'wsa', ''), false);
SELECT set_config('test.wsb', COALESCE(:'wsb', ''), false);

DO $chk$
DECLARE
  wsa text := current_setting('test.wsa', true);
  wsb text := current_setting('test.wsb', true);
BEGIN
  IF wsa IS NULL OR wsa = '' OR wsb IS NULL OR wsb = '' THEN
    RAISE EXCEPTION 'bootstrap failed: a user has no default workspace (wsa=%, wsb=%)', wsa, wsb;
  END IF;
  IF wsa = wsb THEN
    RAISE EXCEPTION 'bootstrap broken: both users resolved to the same workspace %', wsa;
  END IF;
END
$chk$;

-- ------------------------------------------------------------
-- 2. Probe ledger + seed one row per tenant table per workspace.
--    A plain table (rolled back with the txn) so the `authenticated`
--    role can read it during verification.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS _rls_leak_probe;
CREATE TABLE _rls_leak_probe (tbl text NOT NULL, owner text NOT NULL, id uuid NOT NULL);
GRANT SELECT ON _rls_leak_probe TO authenticated;

DO $seed$
DECLARE
  uidA uuid := current_setting('test.uida')::uuid;
  uidB uuid := current_setting('test.uidb')::uuid;
  wsa  uuid := current_setting('test.wsa')::uuid;
  wsb  uuid := current_setting('test.wsb')::uuid;
  rec record;
  o text; ws uuid; uid uuid;
  v_contact uuid; v_tag uuid; v_cf uuid; v_conv uuid; v_msg uuid;
  v_pipeline uuid; v_stage uuid; v_broadcast uuid; v_automation uuid;
  v_flow uuid; v_flowrun uuid; v_id uuid;
BEGIN
  FOR rec IN SELECT 'A' AS owner, wsa AS ws, uidA AS uid
             UNION ALL SELECT 'B', wsb, uidB LOOP
    o := rec.owner; ws := rec.ws; uid := rec.uid;

    -- profiles already created by the bootstrap; record for isolation check
    INSERT INTO _rls_leak_probe SELECT 'profiles', o, id FROM profiles WHERE user_id = uid;

    INSERT INTO contacts (user_id, workspace_id, phone, name)
      VALUES (uid, ws, '+100000000'||o, 'Contact '||o) RETURNING id INTO v_contact;
    INSERT INTO _rls_leak_probe VALUES ('contacts', o, v_contact);

    INSERT INTO tags (user_id, workspace_id, name)
      VALUES (uid, ws, 'tag-'||o) RETURNING id INTO v_tag;
    INSERT INTO _rls_leak_probe VALUES ('tags', o, v_tag);

    INSERT INTO custom_fields (user_id, workspace_id, field_name)
      VALUES (uid, ws, 'cf-'||o) RETURNING id INTO v_cf;
    INSERT INTO _rls_leak_probe VALUES ('custom_fields', o, v_cf);

    INSERT INTO contact_notes (contact_id, user_id, workspace_id, note_text)
      VALUES (v_contact, uid, ws, 'note '||o) RETURNING id INTO v_id;
    INSERT INTO _rls_leak_probe VALUES ('contact_notes', o, v_id);

    INSERT INTO contact_tags (contact_id, tag_id)
      VALUES (v_contact, v_tag) RETURNING id INTO v_id;
    INSERT INTO _rls_leak_probe VALUES ('contact_tags', o, v_id);

    INSERT INTO contact_custom_values (contact_id, custom_field_id, value)
      VALUES (v_contact, v_cf, 'val '||o) RETURNING id INTO v_id;
    INSERT INTO _rls_leak_probe VALUES ('contact_custom_values', o, v_id);

    INSERT INTO conversations (user_id, workspace_id, contact_id)
      VALUES (uid, ws, v_contact) RETURNING id INTO v_conv;
    INSERT INTO _rls_leak_probe VALUES ('conversations', o, v_conv);

    INSERT INTO messages (conversation_id, sender_type, content_text)
      VALUES (v_conv, 'agent', 'secret message '||o) RETURNING id INTO v_msg;
    INSERT INTO _rls_leak_probe VALUES ('messages', o, v_msg);

    INSERT INTO message_reactions (message_id, conversation_id, actor_type, actor_id, emoji)
      VALUES (v_msg, v_conv, 'agent', uid, '👍') RETURNING id INTO v_id;
    INSERT INTO _rls_leak_probe VALUES ('message_reactions', o, v_id);

    INSERT INTO whatsapp_config (user_id, workspace_id, phone_number_id, access_token)
      VALUES (uid, ws, 'pnid-'||o, 'TOP-SECRET-TOKEN-'||o) RETURNING id INTO v_id;
    INSERT INTO _rls_leak_probe VALUES ('whatsapp_config', o, v_id);

    INSERT INTO message_templates (user_id, workspace_id, name, body_text)
      VALUES (uid, ws, 'tpl-'||o, 'body '||o) RETURNING id INTO v_id;
    INSERT INTO _rls_leak_probe VALUES ('message_templates', o, v_id);

    INSERT INTO pipelines (user_id, workspace_id, name)
      VALUES (uid, ws, 'pipeline '||o) RETURNING id INTO v_pipeline;
    INSERT INTO _rls_leak_probe VALUES ('pipelines', o, v_pipeline);

    INSERT INTO pipeline_stages (pipeline_id, name)
      VALUES (v_pipeline, 'stage '||o) RETURNING id INTO v_stage;
    INSERT INTO _rls_leak_probe VALUES ('pipeline_stages', o, v_stage);

    INSERT INTO deals (user_id, workspace_id, pipeline_id, stage_id, contact_id, title)
      VALUES (uid, ws, v_pipeline, v_stage, v_contact, 'deal '||o) RETURNING id INTO v_id;
    INSERT INTO _rls_leak_probe VALUES ('deals', o, v_id);

    INSERT INTO broadcasts (user_id, workspace_id, name, template_name)
      VALUES (uid, ws, 'bcast '||o, 'tpl-'||o) RETURNING id INTO v_broadcast;
    INSERT INTO _rls_leak_probe VALUES ('broadcasts', o, v_broadcast);

    INSERT INTO broadcast_recipients (broadcast_id, contact_id)
      VALUES (v_broadcast, v_contact) RETURNING id INTO v_id;
    INSERT INTO _rls_leak_probe VALUES ('broadcast_recipients', o, v_id);

    INSERT INTO automations (user_id, workspace_id, name, trigger_type)
      VALUES (uid, ws, 'auto '||o, 'message_received') RETURNING id INTO v_automation;
    INSERT INTO _rls_leak_probe VALUES ('automations', o, v_automation);

    INSERT INTO automation_steps (automation_id, step_type, position)
      VALUES (v_automation, 'send_message', 0) RETURNING id INTO v_id;
    INSERT INTO _rls_leak_probe VALUES ('automation_steps', o, v_id);

    INSERT INTO automation_logs (automation_id, user_id, workspace_id, trigger_event, status)
      VALUES (v_automation, uid, ws, 'message_received', 'success') RETURNING id INTO v_id;
    INSERT INTO _rls_leak_probe VALUES ('automation_logs', o, v_id);

    INSERT INTO flows (user_id, workspace_id, name, trigger_type)
      VALUES (uid, ws, 'flow '||o, 'manual') RETURNING id INTO v_flow;
    INSERT INTO _rls_leak_probe VALUES ('flows', o, v_flow);

    INSERT INTO flow_nodes (flow_id, node_key, node_type)
      VALUES (v_flow, 'start', 'start') RETURNING id INTO v_id;
    INSERT INTO _rls_leak_probe VALUES ('flow_nodes', o, v_id);

    INSERT INTO flow_runs (flow_id, user_id, workspace_id)
      VALUES (v_flow, uid, ws) RETURNING id INTO v_flowrun;
    INSERT INTO _rls_leak_probe VALUES ('flow_runs', o, v_flowrun);

    INSERT INTO flow_run_events (flow_run_id, event_type)
      VALUES (v_flowrun, 'started') RETURNING id INTO v_id;
    INSERT INTO _rls_leak_probe VALUES ('flow_run_events', o, v_id);
  END LOOP;
END
$seed$;

-- ------------------------------------------------------------
-- 3. Generic read-isolation verifier. Runs as the `authenticated`
--    role for one subject (A or B): every probe row owned by the
--    subject MUST be visible (count = 1); every row owned by the other
--    MUST be invisible (count = 0). Any deviation raises.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.verify_isolation(subject text)
RETURNS void
LANGUAGE plpgsql
AS $verify$
DECLARE
  p record;
  cnt int;
  expected int;
BEGIN
  FOR p IN SELECT tbl, owner, id FROM _rls_leak_probe ORDER BY tbl, owner LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE id = $1', p.tbl)
      INTO cnt USING p.id;
    expected := CASE WHEN p.owner = subject THEN 1 ELSE 0 END;
    IF cnt <> expected THEN
      IF expected = 0 THEN
        RAISE EXCEPTION
          'RLS LEAK: subject % can see %.(owner %) row % belonging to the OTHER tenant',
          subject, p.tbl, p.owner, p.id;
      ELSE
        RAISE EXCEPTION
          'RLS OVER-RESTRICTION: subject % cannot see its OWN row in % (row %)',
          subject, p.tbl, p.id;
      END IF;
    END IF;
  END LOOP;
  RAISE NOTICE 'read isolation OK for subject %', subject;
END
$verify$;

-- ---- Verify as user A ----
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', current_setting('test.uida'), 'role', 'authenticated')::text,
                  false);
SELECT set_config('request.jwt.claim.sub', current_setting('test.uida'), false);
SELECT pg_temp.verify_isolation('A');

-- ---- Write isolation: A must not be able to touch B's workspace ----
DO $write$
DECLARE
  wsb uuid := current_setting('test.wsb')::uuid;
  uidA uuid := current_setting('test.uida')::uuid;
  affected int;
  blocked boolean;
  bcontact uuid;
BEGIN
  SELECT id INTO bcontact FROM _rls_leak_probe WHERE tbl = 'contacts' AND owner = 'B';

  -- UPDATE of B's row: RLS hides it, so zero rows should be affected.
  EXECUTE 'UPDATE contacts SET name = ''hijacked'' WHERE id = $1' USING bcontact;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'WRITE LEAK: A updated % row(s) of tenant B''s contacts', affected;
  END IF;

  -- INSERT into B's workspace: WITH CHECK must reject it.
  blocked := false;
  BEGIN
    INSERT INTO contacts (user_id, workspace_id, phone, name)
      VALUES (uidA, wsb, '+1999', 'smuggled');
  EXCEPTION WHEN OTHERS THEN
    blocked := true;  -- expected: row-level security policy violation
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION 'WRITE LEAK: A inserted a contact into tenant B''s workspace';
  END IF;

  RAISE NOTICE 'write isolation OK for subject A';
END
$write$;

-- ---- Verify as user B ----
SELECT set_config('request.jwt.claims',
                  json_build_object('sub', current_setting('test.uidb'), 'role', 'authenticated')::text,
                  false);
SELECT set_config('request.jwt.claim.sub', current_setting('test.uidb'), false);
SELECT pg_temp.verify_isolation('B');

-- ------------------------------------------------------------
-- Done. Reset and roll back — no data persists.
-- ------------------------------------------------------------
RESET ROLE;
SELECT set_config('request.jwt.claims', '', false);
SELECT set_config('request.jwt.claim.sub', '', false);

DO $done$ BEGIN
  RAISE NOTICE '✅ RLS LEAK TEST PASSED — two-account isolation holds across all tenant tables';
END $done$;

ROLLBACK;
