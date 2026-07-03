/**
 * Detect marketing opt-out / opt-in intent from an inbound WhatsApp
 * message. Mirrors the STOP/START keyword convention customers already
 * expect from SMS and that WhatsApp's policies reference.
 *
 * Conservative on the opt-IN side: only unambiguous re-subscribe words
 * count, never a bare "yes" (which people send for countless reasons).
 * The whole message must be just the keyword — "please stop calling me
 * about X" is a conversation for a human, not an automated opt-out.
 */

export type OptOutIntent = 'stop' | 'start' | null;

// Includes common English + a couple of DE/ES/FR spellings, since the
// audit's beachhead markets are UK-first with EU expansion.
const STOP_KEYWORDS = new Set([
  'STOP',
  'STOPP', // de
  'UNSUBSCRIBE',
  'UNSUB',
  'CANCEL',
  'END',
  'QUIT',
  'OPTOUT',
  'OPT-OUT',
  'ARRET', // fr
  'BAJA', // es
]);

const START_KEYWORDS = new Set([
  'START',
  'UNSTOP',
  'SUBSCRIBE',
  'OPTIN',
  'OPT-IN',
]);

/**
 * Returns 'stop' / 'start' when the message is exactly an opt-out /
 * opt-in keyword, otherwise null. Case-, whitespace-, and trailing-
 * punctuation-insensitive.
 */
export function detectOptOutIntent(
  text: string | null | undefined,
): OptOutIntent {
  if (!text) return null;
  const normalized = text
    .trim()
    .toUpperCase()
    .replace(/[.!?]+$/, '')
    .trim();
  if (STOP_KEYWORDS.has(normalized)) return 'stop';
  if (START_KEYWORDS.has(normalized)) return 'start';
  return null;
}
