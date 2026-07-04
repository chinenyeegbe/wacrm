import { describe, expect, it } from 'vitest';
import {
  isSmartAudience,
  smartWindowDays,
  SMART_AUDIENCES,
  type AudienceConfig,
} from './audience';

describe('isSmartAudience', () => {
  it('is true only for playbook audience types', () => {
    expect(isSmartAudience('service_due')).toBe(true);
    expect(isSmartAudience('recently_completed')).toBe(true);
    expect(isSmartAudience('dormant')).toBe(true);
    expect(isSmartAudience('all')).toBe(false);
    expect(isSmartAudience('tags')).toBe(false);
    expect(isSmartAudience('csv')).toBe(false);
  });
});

describe('smartWindowDays', () => {
  it('uses the explicit window when set and positive', () => {
    const cfg: AudienceConfig = { type: 'dormant', smartWindowDays: 90 };
    expect(smartWindowDays(cfg)).toBe(90);
  });

  it('falls back to the type default when unset or invalid', () => {
    const def = SMART_AUDIENCES.find((a) => a.type === 'service_due')!;
    expect(smartWindowDays({ type: 'service_due' })).toBe(def.defaultWindowDays);
    expect(smartWindowDays({ type: 'service_due', smartWindowDays: 0 })).toBe(
      def.defaultWindowDays,
    );
  });
});
