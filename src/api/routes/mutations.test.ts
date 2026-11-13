import { afterEach, expect, it, vi } from 'vitest';
import { changeRouteStatus, createRoute, reassignRoute } from './mutations';

const input = { truckId: 'truck_4', destination: 'Stop A', priority: 'high', notes: '' };

afterEach(() => vi.unstubAllGlobals());

it('sends the selected truck and dispatcher and validates the returned version', async () => {
  const response = { ...input, id: 'route_1', status: 'assigned', _version: 1, assignedBy: 'dispatcher_a', assignedAt: 1000 };
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(response, { status: 201 }));
  vi.stubGlobal('fetch', fetchMock);

  await expect(createRoute(input, 'dispatcher_a')).resolves.toEqual(response);
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/routes', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Dispatcher-Id': 'dispatcher_a' },
    body: JSON.stringify(input),
  }));
});

it('returns the existing assignment and dispatcher from a 409 without replaying the write', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
    currentRouteId: 'route_1', assignedBy: 'dispatcher_b',
  }, { status: 409 }));
  vi.stubGlobal('fetch', fetchMock);

  await expect(createRoute(input, 'dispatcher_a')).rejects.toMatchObject({
    name: 'AssignmentConflict', routeId: 'route_1', assignedBy: 'dispatcher_b',
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('sends the captured route version in If-Match and reports a 409 without an actor', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
    error: 'Route was modified during processing', currentVersion: 8,
  }, { status: 409 }));
  vi.stubGlobal('fetch', fetchMock);

  await expect(changeRouteStatus('route_1', 'completed', 7, 'dispatcher_a')).rejects.toMatchObject({
    name: 'RouteVersionConflict', currentVersion: 8,
  });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/routes/route_1', expect.objectContaining({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Dispatcher-Id': 'dispatcher_a', 'If-Match': '7' },
    body: JSON.stringify({ status: 'completed' }),
  }));
});

it('sends a PUT with the target truck and surfaces occupied-target conflicts', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
    error: 'Target truck already has an assigned route',
  }, { status: 409 }));
  vi.stubGlobal('fetch', fetchMock);

  await expect(reassignRoute('route_1', 'truck_2', 2, 'dispatcher_a')).rejects.toHaveProperty('name', 'ReassignmentConflict');
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/routes/route_1/reassign', expect.objectContaining({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Dispatcher-Id': 'dispatcher_a', 'If-Match': '2' },
    body: JSON.stringify({ newTruckId: 'truck_2' }),
  }));
});

it('reports a stale reassignment as a route version conflict', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
    error: 'Route is no longer active', currentVersion: 3,
  }, { status: 409 }));
  vi.stubGlobal('fetch', fetchMock);

  await expect(reassignRoute('route_1', 'truck_2', 2, 'dispatcher_a')).rejects.toMatchObject({
    name: 'RouteVersionConflict', currentVersion: 3,
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
