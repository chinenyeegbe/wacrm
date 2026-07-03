import { NextResponse } from 'next/server';
import type { z } from 'zod';

/**
 * Parse and validate a request's JSON body against a zod schema at the
 * trust boundary. Returns either the typed data or a ready-to-return
 * 400 `NextResponse` — so routes stop hand-checking nested payloads
 * (`template_params`, recipient arrays, …) and reject malformed input
 * before it reaches Supabase or the Meta API.
 *
 * Usage:
 *   const parsed = await parseJsonBody(request, schema);
 *   if (!parsed.ok) return parsed.response;
 *   const { ... } = parsed.data;
 */
export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<
  { ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }
> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Invalid request body',
          details: result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: result.data };
}
