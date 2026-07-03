import { describe, expect, it } from 'vitest';
import { detectOptOutIntent } from './opt-out';

describe('detectOptOutIntent', () => {
  it('detects STOP-family keywords regardless of case/whitespace/punctuation', () => {
    expect(detectOptOutIntent('STOP')).toBe('stop');
    expect(detectOptOutIntent('  stop  ')).toBe('stop');
    expect(detectOptOutIntent('Stop.')).toBe('stop');
    expect(detectOptOutIntent('unsubscribe')).toBe('stop');
    expect(detectOptOutIntent('STOPP')).toBe('stop'); // de
  });

  it('detects START-family opt-in keywords', () => {
    expect(detectOptOutIntent('START')).toBe('start');
    expect(detectOptOutIntent('subscribe')).toBe('start');
  });

  it('does not treat a bare "yes" as opt-in', () => {
    expect(detectOptOutIntent('yes')).toBeNull();
    expect(detectOptOutIntent('yes please')).toBeNull();
  });

  it('ignores keywords embedded in a longer message', () => {
    expect(detectOptOutIntent('please stop calling me')).toBeNull();
    expect(detectOptOutIntent('can you start the job monday?')).toBeNull();
  });

  it('returns null for empty / nullish input', () => {
    expect(detectOptOutIntent('')).toBeNull();
    expect(detectOptOutIntent(null)).toBeNull();
    expect(detectOptOutIntent(undefined)).toBeNull();
  });
});
