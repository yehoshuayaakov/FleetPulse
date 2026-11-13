import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadFleet } from '../api/fleet/queries';
import { subscribeToTelemetry } from '../realtime/telemetryStream';
import type { FleetSnapshot } from '../sharedSchemas/fleetSchema';
import { createFleetStore } from './fleetStore';

vi.mock('../api/fleet/queries', () => ({ loadFleet: vi.fn() }));
vi.mock('../realtime/telemetryStream', () => ({ subscribeToTelemetry: vi.fn() }));

const snapshot: FleetSnapshot = {
  timestamp: 1000,
  fleet: [{
    id: 'truck_1', name: 'Truck Alpha', status: 'active',
    location: { lat: 32.08, lng: 34.78 }, speed: 48, fuel: 60, engineTemp: 80,
    heading: 30, currentRouteId: null, _version: 1,
  }],
};

const position = { truckId: 'truck_1', timestamp: 2000, location: { lat: 32.09, lng: 34.79 } };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(complete => { resolve = complete; });
  return { promise, resolve };
}

function stream(index = 0) {
  return vi.mocked(subscribeToTelemetry).mock.calls[index][0];
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(snapshot.timestamp);
  vi.mocked(loadFleet).mockReset().mockResolvedValue(snapshot);
  vi.mocked(subscribeToTelemetry).mockReset().mockImplementation(() => vi.fn());
});

afterEach(() => vi.useRealTimers());

it('publishes live telemetry and freshness while preserving the catalog until live status changes', async () => {
  const store = createFleetStore();
  const stop = store.start();
  await Promise.resolve();

  const catalog = store.getCatalogSnapshot();
  const firstView = store.getFleetSnapshot();
  expect(store.getFleetSnapshot()).toBe(firstView);
  expect(catalog).toEqual([{ id: 'truck_1', name: 'Truck Alpha', status: 'active' }]);

  stream().onStatus('connected');
  stream().onUpdate({ positions: [position], readings: [] });
  expect(store.getFleetSnapshot().trucks?.[0].location).toEqual(position.location);
  expect(store.getCatalogSnapshot()).toBe(catalog);

  const received = vi.fn(store.getFleetSnapshot);
  const unsubscribe = store.subscribe(received);
  stream().onUpdate({
    positions: [],
    readings: [{ truckId: 'truck_1', timestamp: 1500, speed: 54, fuel: 60, engineTemp: 80 }],
  });
  expect(received).toHaveBeenCalledOnce();
  expect(received.mock.results[0].value.trucks?.[0]).toMatchObject({ speed: 54, location: position.location });
  expect(store.getCatalogSnapshot()).toBe(catalog);

  vi.advanceTimersByTime(7999);
  expect(store.getFleetSnapshot().trucks?.[0].signalStale).toBe(false);
  vi.advanceTimersByTime(1);
  expect(store.getFleetSnapshot().trucks?.[0].signalStale).toBe(true);
  expect(store.getCatalogSnapshot()).toBe(catalog);

  unsubscribe();
  const notifications = received.mock.calls.length;
  stream().onUpdate({
    positions: [],
    readings: [{ truckId: 'truck_1', timestamp: 3000, speed: 0, fuel: 60, engineTemp: 80, status: 'maintenance' }],
  });
  expect(received).toHaveBeenCalledTimes(notifications);
  expect(store.getCatalogSnapshot()).not.toBe(catalog);
  expect(store.getCatalogSnapshot()?.[0].status).toBe('maintenance');
  expect(store.getFleetSnapshot().trucks?.[0].signalStale).toBe(false);
  stop();
});

it('ignores a superseded load and merges the current response with readings received while waiting', async () => {
  const superseded = deferred<FleetSnapshot>();
  const current = deferred<FleetSnapshot>();
  vi.mocked(loadFleet).mockReturnValueOnce(superseded.promise).mockReturnValueOnce(current.promise);
  const store = createFleetStore();
  const stop = store.start();
  const refresh = store.refresh();
  expect(vi.mocked(loadFleet).mock.calls[0][0].aborted).toBe(true);

  stream().onStatus('connected');
  stream().onUpdate({ positions: [position], readings: [{ truckId: 'truck_1', timestamp: 2000, speed: 54 }] });
  current.resolve(snapshot);
  await refresh;
  const view = store.getFleetSnapshot();
  expect(view.trucks?.[0]).toMatchObject({ speed: 54, location: position.location, fuel: 60 });
  superseded.resolve({ ...snapshot, fleet: [] });
  await Promise.resolve();
  expect(store.getFleetSnapshot()).toBe(view);
  stop();
});

it('closes replaced streams and clears timers and pending requests during effect cleanup', async () => {
  const store = createFleetStore();
  const stop = store.start();
  await Promise.resolve();
  stream().onStatus('connected');
  expect(vi.getTimerCount()).toBe(1);

  store.reconnect();
  expect(vi.mocked(subscribeToTelemetry).mock.results[0].value).toHaveBeenCalledOnce();
  const reconnecting = store.getFleetSnapshot();
  stream().onStatus('connected');
  expect(store.getFleetSnapshot()).toBe(reconnecting);
  stream(1).onStatus('connected');

  const pending = deferred<FleetSnapshot>();
  vi.mocked(loadFleet).mockReturnValueOnce(pending.promise);
  const refresh = store.refresh();
  const signal = vi.mocked(loadFleet).mock.calls[1][0];
  stop();
  expect(signal.aborted).toBe(true);
  expect(vi.mocked(subscribeToTelemetry).mock.results[1].value).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);

  const restart = store.start();
  await Promise.resolve();
  stream(2).onStatus('connected');
  const restarted = store.getFleetSnapshot();
  pending.resolve({ ...snapshot, fleet: [] });
  await refresh;
  stream(1).onStatus('unavailable');
  expect(store.getFleetSnapshot()).toBe(restarted);
  expect(vi.getTimerCount()).toBe(1);
  restart();
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps last-known fleet data visible after a refresh fails', async () => {
  const store = createFleetStore();
  const stop = store.start();
  await Promise.resolve();
  const catalog = store.getCatalogSnapshot();
  vi.mocked(loadFleet).mockRejectedValueOnce(new Error('Unavailable'));

  await store.refresh();
  expect(store.getFleetSnapshot()).toMatchObject({ status: 'error', snapshot, trucks: [expect.objectContaining({ id: 'truck_1' })] });
  expect(store.getCatalogSnapshot()).toBe(catalog);
  stop();
});
