import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseJsonBody } from './validation';

const schema = z.object({
  conversation_id: z.string().min(1),
  params: z.array(z.string()).optional(),
});

function req(body: string) {
  return new Request('http://test.local/api', { method: 'POST', body });
}

describe('parseJsonBody', () => {
  it('returns typed data for a valid body', async () => {
    const result = await parseJsonBody(
      req(JSON.stringify({ conversation_id: 'c1', params: ['a'] })),
      schema,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.conversation_id).toBe('c1');
      expect(result.data.params).toEqual(['a']);
    }
  });

  it('rejects invalid JSON with a 400', async () => {
    const result = await parseJsonBody(req('{ not json'), schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const json = (await result.response.json()) as { error: string };
      expect(json.error).toMatch(/invalid json/i);
    }
  });

  it('rejects a schema violation with 400 + field details', async () => {
    const result = await parseJsonBody(
      req(JSON.stringify({ conversation_id: '', params: 'nope' })),
      schema,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const json = (await result.response.json()) as {
        error: string;
        details: { path: string; message: string }[];
      };
      expect(json.error).toMatch(/invalid request body/i);
      const paths = json.details.map((d) => d.path);
      expect(paths).toContain('conversation_id');
      expect(paths).toContain('params');
    }
  });
});
