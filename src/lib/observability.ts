/**
 * Minimal structured logging + error capture.
 *
 * Emits single-line JSON so platform log pipelines (Cloudflare Workers
 * Logs / Logpush, Vercel, Datadog) can index fields without regex —
 * unlike the bare `console.error('...', err)` calls this replaces,
 * which serialize an `Error` to `{}` and drop the stack.
 *
 * Deliberately dependency-free. A real error tracker (Sentry, etc.) is
 * attached at runtime via `setErrorReporter` — no SDK, DSN, or adapter
 * wiring is baked in, and every call site stays unchanged when one is
 * added later. Until a reporter is set, capture is log-only (never a
 * no-op that silently drops the error).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

/** External sink for captured errors, e.g. `Sentry.captureException`. */
export type ErrorReporter = (error: unknown, context?: LogFields) => void;

let errorReporter: ErrorReporter | null = null;

/**
 * Register (or clear, with `null`) an external error tracker. Call once
 * at startup. Safe to leave unset — capture still logs structured JSON.
 */
export function setErrorReporter(reporter: ErrorReporter | null): void {
  errorReporter = reporter;
}

function serializeError(error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      error: { name: error.name, message: error.message, stack: error.stack },
    };
  }
  return { error };
}

function emit(level: LogLevel, message: string, fields?: LogFields): void {
  const line = JSON.stringify({
    level,
    msg: message,
    time: new Date().toISOString(),
    ...fields,
  });
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  sink(line);
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => emit('debug', msg, fields),
  info: (msg: string, fields?: LogFields) => emit('info', msg, fields),
  warn: (msg: string, fields?: LogFields) => emit('warn', msg, fields),
  error: (msg: string, fields?: LogFields) => emit('error', msg, fields),
};

/**
 * Log an error with structured context and forward it to the configured
 * reporter. Use at the boundary of fire-and-forget work (webhook
 * processing, cron sweeps) where a thrown error would otherwise vanish.
 *
 * @param event   stable, greppable event name, e.g. `webhook.process_failed`
 * @param error   the thrown value
 * @param context extra structured fields (ids, counts — never secrets/PII)
 */
export function captureError(
  event: string,
  error: unknown,
  context?: LogFields,
): void {
  logger.error(event, { ...context, ...serializeError(error) });
  try {
    errorReporter?.(error, { event, ...context });
  } catch {
    // A broken reporter must never mask the original error.
  }
}
