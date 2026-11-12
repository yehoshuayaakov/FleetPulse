import { afterEach, expect, it, vi } from 'vitest';
import { loadRoutes } from './queries';

afterEach(() => vi.unstubAllGlobals());

it('distinguishes a successful empty route snapshot from a failed read', async () => {
  const fetchMock = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ routes: [] }))
    .mockResolvedValueOnce(Response.json({ error: 'Unavailable' }, { status: 503 }));
  vi.stubGlobal('fetch', fetchMock);
  const { signal } = new AbortController();

  await expect(loadRoutes(signal)).resolves.toEqual([]);
  await expect(loadRoutes(signal)).rejects.toMatchObject({ status: 503 });
  expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/routes', expect.objectContaining({ signal }));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('rejects a snapshot containing a malformed route without treating it as empty', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ routes: [{ id: 'route_1' }] }));
  vi.stubGlobal('fetch', fetchMock);

  await expect(loadRoutes(new AbortController().signal)).rejects.toMatchObject({ name: 'ZodError' });
  expect(fetchMock).toHaveBeenCalledOnce();
});
