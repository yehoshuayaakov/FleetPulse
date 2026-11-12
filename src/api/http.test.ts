import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError, requestJson } from './http';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestJson', () => {
  it('keeps the conflict payload and forwards the route version', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ currentVersion: 2 }, { status: 409 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const init = { method: 'PATCH', headers: { 'If-Match': '1' } };
    await expect(requestJson('/api/routes/route_1', init)).rejects.toMatchObject({
      name: 'HttpError',
      status: 409,
      body: { currentVersion: 2 },
    });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/routes/route_1', init);
  });

  it('keeps Retry-After even when a proxy returns a plain-text 503', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(
      new Response('Service unavailable', {
        status: 503,
        headers: { 'Retry-After': '3' },
      }),
    ));

    const result = await requestJson('/api/fleet').catch((error: unknown) => error);
    expect(result).toBeInstanceOf(HttpError);
    if (!(result instanceof HttpError)) throw new Error('Expected an HTTP error');
    expect(result.status).toBe(503);
    expect(result.headers.get('Retry-After')).toBe('3');
    expect(result.body).toBe('Service unavailable');
  });

  it('passes cancellation through to the caller', async () => {
    const signal = AbortSignal.abort();
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(signal.reason);
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestJson('/api/fleet/truck_1', { signal })).rejects.toBe(signal.reason);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/fleet/truck_1', { signal });
  });
});
