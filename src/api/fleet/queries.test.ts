import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadFleet, loadTruckMileage } from './queries';

const snapshot = { fleet: [], timestamp: Date.UTC(2026, 10, 12) };

function unavailable(retryAfter?: string) {
  return new Response('Service unavailable', {
    status: 503,
    headers: retryAfter === undefined ? {} : { 'Retry-After': retryAfter },
  });
}

describe('loadFleet', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(snapshot.timestamp);
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(['3', 'Thu, 12 Nov 2026 00:00:03 GMT'])('honors Retry-After %s', async header => {
    fetchMock.mockResolvedValueOnce(unavailable(header)).mockResolvedValueOnce(Response.json(snapshot));
    const result = loadFleet(new AbortController().signal);

    await vi.advanceTimersByTimeAsync(2999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(await result).toEqual(snapshot);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses a one-second fallback and stops after two retries', async () => {
    fetchMock
      .mockResolvedValueOnce(unavailable())
      .mockResolvedValueOnce(unavailable('invalid'))
      .mockResolvedValueOnce(unavailable());
    const result = loadFleet(new AbortController().signal);
    const failure = expect(result).rejects.toMatchObject({ status: 503 });

    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await failure;
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('cancels a scheduled retry and sends no further request', async () => {
    fetchMock.mockResolvedValueOnce(unavailable('3'));
    const controller = new AbortController();
    const result = loadFleet(controller.signal);
    const failure = expect(result).rejects.toHaveProperty('name', 'AbortError');

    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    await failure;
    await vi.advanceTimersByTimeAsync(3000);

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/fleet', { signal: controller.signal });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects an invalid snapshot without retrying', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ fleet: null, timestamp: 0 }));
    await expect(loadFleet(new AbortController().signal)).rejects.toHaveProperty('name', 'ZodError');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not automatically retry other HTTP failures', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(loadFleet(new AbortController().signal)).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('loadTruckMileage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads only mileage and forwards the selection abort signal', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({
      id: 'truck/1', mileage: 12345, speed: 999, location: { lat: -1, lng: -1 },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { signal } = new AbortController();

    await expect(loadTruckMileage('truck/1', signal)).resolves.toBe(12345);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/fleet/truck%2F1', { signal });
  });

  it('rejects mileage for a different truck', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({ id: 'truck_2', mileage: 12345 }),
    ));

    await expect(loadTruckMileage('truck_1', new AbortController().signal))
      .rejects.toThrow('Truck detail does not match the requested truck');
  });

  it('rejects malformed mileage', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json({ id: 'truck_1', mileage: -1 }),
    ));

    await expect(loadTruckMileage('truck_1', new AbortController().signal))
      .rejects.toHaveProperty('name', 'ZodError');
  });
});
