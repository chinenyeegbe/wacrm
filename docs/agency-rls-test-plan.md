# Agency RLS cutover, test plan (do this before trusting migration 022)

Migration `022_agency_rls_cutover.sql` lets a workspace member read and
write the owner's data. That is exactly the power that, if a policy is
wrong, leaks one business's WhatsApp chats to another. **Run this test on a
real Supabase project before you rely on it.** It is safe to leave 022
unapplied until you have.

## What "correct" means

1. **Owner still sees their own data** (no regression).
2. **A member of an owner's workspace sees that owner's data** (the feature).
3. **A total stranger (member of nobody) sees nothing of the owner's data**
   (the leak test, the one that matters).

## Setup (Supabase dashboard)

1. Apply migrations `001` through `022` in order (SQL Editor).
2. Create three auth users (Authentication, Add user): `owner@test`,
   `operator@test`, `stranger@test`. Note each user's UUID.
3. As the owner, sign into the app (or insert directly) and create a couple
   of rows: a contact and a conversation. Confirm migration 019 gave the
   owner a personal `workspaces` row (`owner_id = owner uuid`).
4. Add the operator to the owner's workspace:
   ```sql
   insert into workspace_members (workspace_id, user_id, role)
   select w.id, '<operator-uuid>', 'operator'
   from workspaces w where w.owner_id = '<owner-uuid>' and w.kind = 'personal';
   ```
   Do **not** add the stranger to anything.

## The tests (run as each user)

The reliable way to test RLS is as the actual user, because `auth.uid()`
must resolve. Two options:

- **App way:** log in as each user and load `/contacts` and `/inbox`.
- **SQL way (more rigorous):** use Supabase's "Run as user" / set the
  request JWT, or from the app's SQL with `set local role authenticated;
  set local request.jwt.claims = '{"sub":"<uuid>"}';` then `select` the
  tables. (The helper reads `auth.uid()`, which derives from that claim.)

Check each table touched by 022 (`contacts`, `conversations`, `messages`,
`deals`, `broadcasts`, `automations`, `ai_settings`, `payment_config`,
`payment_requests`, and the child tables):

| As | Expected on the owner's rows |
| --- | --- |
| `owner@test` | sees + can edit them (PASS = visible) |
| `operator@test` | sees + can edit them (PASS = visible) |
| `stranger@test` | sees **zero** rows (PASS = empty; FAIL = any row) |

Also confirm a write path: as `operator@test`, send a message / add a
contact under the owner's account and confirm it saves with the owner's
`user_id`. As `stranger@test`, the same write must be rejected.

## If the stranger sees anything

Stop. Do not deploy. The most likely causes:
- `can_access_user_data` matched too broadly (re-read the workspace join).
- a child-table policy referenced the wrong parent/owner column.
Fix the policy, re-run, re-test. Only ship when the stranger column is
empty for **every** table.

## After it passes

- Update `docs/legal/LIABILITY.md` row "Tenant A reading tenant B's data"
  from "pending DB test" to verified.
- Then it is safe to invite operators in production.

## Known v1 limitation

A member currently gets the **same** access as the owner (read + write),
regardless of their role (`viewer` behaves like an editor). Role-based
restriction is a planned follow-up; until then only add people you trust as
members.
