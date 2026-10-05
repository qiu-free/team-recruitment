import { describe, expect, it, vi } from 'vitest';
import { api } from '../frontend/src/api';

describe('frontend API request headers', () => {
  it('does not advertise a JSON body for logout requests without a body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.logout();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(Array.from(new Headers(init.headers).entries())).toEqual([]);
    expect(init.body).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
