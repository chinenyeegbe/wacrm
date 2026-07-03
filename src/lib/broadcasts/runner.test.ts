import { describe, expect, it } from 'vitest';
import {
  processDueBroadcasts,
  type BroadcastSender,
  type BroadcastStore,
  type DueBroadcast,
  type PendingRecipient,
} from './runner';
import type { Contact } from '@/types';

type RecipientState = {
  id: string;
  broadcast_id: string;
  contact: Contact | null;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
};

function contact(id: string, phone: string | null): Contact {
  return {
    id,
    user_id: 'u1',
    phone: phone ?? '',
    created_at: '',
    updated_at: '',
  } as Contact;
}

function makeFakeStore(opts: {
  broadcasts: DueBroadcast[];
  recipients: RecipientState[];
  optedOut?: Record<string, string[]>;
}) {
  const finalized: string[] = [];
  const find = (id: string) => opts.recipients.find((r) => r.id === id)!;

  const store: BroadcastStore = {
    async claimDueBroadcasts(_now, limit) {
      return opts.broadcasts.slice(0, limit);
    },
    async loadOptedOutPhones(userId) {
      return new Set(opts.optedOut?.[userId] ?? []);
    },
    async fetchPendingRecipients(broadcastId, limit) {
      return opts.recipients
        .filter((r) => r.broadcast_id === broadcastId && r.status === 'pending')
        .slice(0, limit)
        .map((r): PendingRecipient => ({ id: r.id, contact: r.contact }));
    },
    async fetchCustomValues() {
      return new Map();
    },
    async markSkipped(id) {
      find(id).status = 'skipped';
    },
    async markSent(id) {
      find(id).status = 'sent';
    },
    async markFailed(id) {
      find(id).status = 'failed';
    },
    async countPending(broadcastId) {
      return opts.recipients.filter(
        (r) => r.broadcast_id === broadcastId && r.status === 'pending',
      ).length;
    },
    async finalizeBroadcast(broadcastId) {
      finalized.push(broadcastId);
    },
  };
  return { store, finalized, recipients: opts.recipients };
}

const okSender: BroadcastSender = {
  async prepare() {
    let n = 0;
    return async () => ({ ok: true, messageId: `m${n++}` });
  },
};

const nullSender: BroadcastSender = {
  async prepare() {
    return null;
  },
};

const broadcast: DueBroadcast = {
  id: 'b1',
  user_id: 'u1',
  template_name: 'reactivation',
  template_language: 'en_US',
  template_variables: null,
};

describe('processDueBroadcasts', () => {
  it('sends every pending recipient and finalizes the broadcast', async () => {
    const { store, finalized, recipients } = makeFakeStore({
      broadcasts: [broadcast],
      recipients: [
        { id: 'r1', broadcast_id: 'b1', contact: contact('c1', '+441111111111'), status: 'pending' },
        { id: 'r2', broadcast_id: 'b1', contact: contact('c2', '+442222222222'), status: 'pending' },
      ],
    });

    const summary = await processDueBroadcasts(store, okSender);

    expect(summary).toMatchObject({ broadcasts: 1, sent: 2, failed: 0, skipped: 0 });
    expect(recipients.every((r) => r.status === 'sent')).toBe(true);
    expect(finalized).toEqual(['b1']);
  });

  it('skips opted-out contacts and still sends the rest', async () => {
    const { store, finalized, recipients } = makeFakeStore({
      broadcasts: [broadcast],
      recipients: [
        { id: 'r1', broadcast_id: 'b1', contact: contact('c1', '+441111111111'), status: 'pending' },
        { id: 'r2', broadcast_id: 'b1', contact: contact('c2', '+442222222222'), status: 'pending' },
      ],
      optedOut: { u1: ['442222222222'] },
    });

    const summary = await processDueBroadcasts(store, okSender);

    expect(summary).toMatchObject({ sent: 1, skipped: 1 });
    expect(recipients.find((r) => r.id === 'r2')!.status).toBe('skipped');
    expect(finalized).toEqual(['b1']);
  });

  it('fails a recipient with no phone number', async () => {
    const { store, recipients } = makeFakeStore({
      broadcasts: [broadcast],
      recipients: [
        { id: 'r1', broadcast_id: 'b1', contact: contact('c1', null), status: 'pending' },
      ],
    });

    const summary = await processDueBroadcasts(store, okSender);

    expect(summary).toMatchObject({ sent: 0, failed: 1 });
    expect(recipients[0].status).toBe('failed');
  });

  it('fails all recipients when the broadcast is not configured to send', async () => {
    const { store, finalized, recipients } = makeFakeStore({
      broadcasts: [broadcast],
      recipients: [
        { id: 'r1', broadcast_id: 'b1', contact: contact('c1', '+441111111111'), status: 'pending' },
      ],
    });

    const summary = await processDueBroadcasts(store, nullSender);

    expect(summary).toMatchObject({ failed: 1 });
    expect(recipients[0].status).toBe('failed');
    // No pending remain → still finalizes (as 'failed' downstream).
    expect(finalized).toEqual(['b1']);
  });

  it('respects the per-tick send budget and leaves the rest pending', async () => {
    const { store, finalized, recipients } = makeFakeStore({
      broadcasts: [broadcast],
      recipients: [
        { id: 'r1', broadcast_id: 'b1', contact: contact('c1', '+441111111111'), status: 'pending' },
        { id: 'r2', broadcast_id: 'b1', contact: contact('c2', '+442222222222'), status: 'pending' },
      ],
    });

    const summary = await processDueBroadcasts(store, okSender, {
      maxSendsPerTick: 1,
    });

    expect(summary.sent).toBe(1);
    // One still pending → not finalized this tick.
    expect(recipients.filter((r) => r.status === 'pending')).toHaveLength(1);
    expect(finalized).toEqual([]);
  });
});
