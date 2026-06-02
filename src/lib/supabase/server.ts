import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Cookie that carries the agency-mode active workspace (see migration 018). */
export const ACTIVE_WORKSPACE_COOKIE = 'wacrm_active_workspace'

export async function createClient() {
  const cookieStore = await cookies()

  // Forward the active workspace to PostgREST as a request header so RLS
  // (in_active_workspace, migration 018) can narrow tenant rows to the
  // workspace the user is currently in. No header -> no narrowing, i.e.
  // identical to pre-agency behaviour.
  const activeWorkspace = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: activeWorkspace
        ? { headers: { 'x-workspace-id': activeWorkspace } }
        : undefined,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}
