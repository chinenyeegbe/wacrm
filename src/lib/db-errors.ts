/**
 * Small helpers for reasoning about Postgres/PostgREST errors returned
 * by supabase-js. supabase-js surfaces the underlying Postgres SQLSTATE
 * on the error object's `code` field.
 */

/** Postgres `unique_violation` SQLSTATE. */
const UNIQUE_VIOLATION = '23505'

/**
 * True when the error is a Postgres unique-constraint violation.
 *
 * Used to make writes idempotent: e.g. a re-delivered WhatsApp webhook
 * that tries to insert an already-stored message hits the partial
 * unique index on (conversation_id, message_id) and can be treated as
 * an already-processed no-op instead of an error.
 */
export function isUniqueViolation(
  error: { code?: string | null } | null | undefined,
): boolean {
  return error?.code === UNIQUE_VIOLATION
}
