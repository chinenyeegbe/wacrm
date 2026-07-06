import { describe, expect, it } from 'vitest';
import {
  processDuePlaybooks,
  type DuePlaybook,
  type PlaybookStore,
} from './runner';

const base: DuePlaybook = {
  id: 'p1',
  user_id: 'u1',
  name: 'Boiler service reminders',
  audience_type: 'service_due',
  window_days: 14,
  cooldown_days: 30,
  template_name: 'service_due',
  template_language: 'en_US',
  template_variables: null,
};

function makeStore(opts: {
  due: DuePlaybook[];
  audience: Record<string, string[]>;
  suppressed?: Record<string, string[]>;
}) {
  const enqueued: { playbookId: string; contactIds: string[] }[] = [];
  const ran: string[] = [];
  const store: PlaybookStore = {
    async claimDuePlaybooks(_before, limit) {
      return opts.due.slice(0, limit);
    },
    async resolveAudienceContactIds(p) {
      return opts.audience[p.id] ?? [];
    },
    async recentlyMessagedContactIds(playbookId) {
      return new Set(opts.suppressed?.[playbookId] ?? []);
    },
    async enqueueBroadcast(p, contactIds) {
      enqueued.push({ playbookId: p.id, contactIds });
      return `b-${p.id}`;
    },
    async markRan(playbookId) {
      ran.push(playbookId);
    },
  };
  return { store, enqueued, ran };
}

describe('processDuePlaybooks', () => {
  it('enqueues a broadcast for the resolved audience and stamps the run', async () => {
    const { store, enqueued, ran } = makeStore({
      due: [base],
      audience: { p1: ['c1', 'c2', 'c3'] },
    });

    const summary = await processDuePlaybooks(store, { now: new Date('2026-07-01T09:00:00Z') });

    expect(summary).toMatchObject({ playbooks: 1, enqueued: 1, recipients: 3 });
    expect(enqueued).toEqual([{ playbookId: 'p1', contactIds: ['c1', 'c2', 'c3'] }]);
    expect(ran).toEqual(['p1']);
  });

  it('excludes contacts messaged within the cooldown', async () => {
    const { store, enqueued } = makeStore({
      due: [base],
      audience: { p1: ['c1', 'c2', 'c3'] },
      suppressed: { p1: ['c2'] },
    });

    const summary = await processDuePlaybooks(store);

    expect(summary.recipients).toBe(2);
    expect(enqueued[0].contactIds).toEqual(['c1', 'c3']);
  });

  it('still stamps last_run_at when nobody matches, and does not enqueue', async () => {
    const { store, enqueued, ran } = makeStore({
      due: [base],
      audience: { p1: [] },
    });

    const summary = await processDuePlaybooks(store);

    expect(summary).toMatchObject({ playbooks: 1, enqueued: 0, skippedNoAudience: 1 });
    expect(enqueued).toHaveLength(0);
    expect(ran).toEqual(['p1']); // marked ran so it isn't retried all day
  });

  it('does not enqueue when the whole audience is within cooldown', async () => {
    const { store, enqueued } = makeStore({
      due: [base],
      audience: { p1: ['c1', 'c2'] },
      suppressed: { p1: ['c1', 'c2'] },
    });

    const summary = await processDuePlaybooks(store);

    expect(summary.enqueued).toBe(0);
    expect(summary.skippedNoAudience).toBe(1);
    expect(enqueued).toHaveLength(0);
  });
});
