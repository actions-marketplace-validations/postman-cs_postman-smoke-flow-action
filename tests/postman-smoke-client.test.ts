import { describe, expect, it, vi } from 'vitest';

import { PostmanSmokeClient } from '../src/postman/postman-smoke-client.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('PostmanSmokeClient', () => {
  it('retries collection updates while Postman deepupdate is still modifying the resource', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        error: {
          name: 'conflict',
          message: 'Resource collection-123 is currently being modified by deepupdate. Please wait for it to complete.'
        }
      }, 409))
      .mockResolvedValueOnce(jsonResponse({ collection: { id: 'collection-123' } }));
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const client = new PostmanSmokeClient('PMAK-test', 'https://api.getpostman.com', fetchImpl, sleepImpl);

    await client.updateCollection('collection-123', { info: { name: 'Smoke' }, item: [] });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenCalledWith(5000);
  });

  it('does not retry unrelated update conflicts', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({
        error: {
          name: 'conflict',
          message: 'A different conflict occurred.'
        }
      }, 409));
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const client = new PostmanSmokeClient('PMAK-test', 'https://api.getpostman.com', fetchImpl, sleepImpl);

    await expect(client.updateCollection('collection-123', { info: { name: 'Smoke' }, item: [] }))
      .rejects.toThrow('A different conflict occurred');
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(sleepImpl).not.toHaveBeenCalled();
  });
});
