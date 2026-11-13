import { loadFleet } from '../api/fleet/queries';
import { subscribeToTelemetry, type TelemetryStatus } from '../realtime/telemetryStream';
import type { FleetSnapshot, Truck } from '../sharedSchemas/fleetSchema';
import { mergePositions, mergeSnapshotPositions, type FleetPositions } from './telemetry';
import {
  breakFuelStreaks,
  describeTruck,
  mergeNormalReadings,
  mergeSnapshotHealth,
  signalDeadline,
  type FleetHealth,
  type TelemetryClock,
  type TruckTelemetry,
} from './telemetryHealth';

type CatalogTruck = Readonly<Pick<Truck, 'id' | 'name' | 'status'>>;

interface FleetView {
  readonly status: 'loading' | 'ready' | 'error';
  readonly snapshot: FleetSnapshot | null;
  readonly telemetryStatus: TelemetryStatus;
  readonly trucks: readonly TruckTelemetry[] | undefined;
}

function readClock(): TelemetryClock {
  return { elapsed: performance.now(), wall: Date.now() };
}

export function createFleetStore() {
  const listeners = new Set<() => void>();
  let view: FleetView = {
    status: 'loading', snapshot: null, telemetryStatus: 'connecting', trucks: undefined,
  };
  let catalog: readonly CatalogTruck[] | null = null;
  let positions: FleetPositions = new Map();
  let health: FleetHealth = new Map();
  let firstOpenedAt: number | null = null;
  let freshnessTimer: ReturnType<typeof setTimeout> | undefined;
  let request: AbortController | undefined;
  let closeStream: (() => void) | undefined;
  let streamGeneration = 0;
  let active = false;

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  function publish(changes?: Partial<Omit<FleetView, 'trucks'>>, clock = readClock()) {
    const snapshot = changes?.snapshot ?? view.snapshot;
    const trucks = snapshot?.fleet.map(truck =>
      describeTruck(truck, health.get(truck.id), positions.get(truck.id), firstOpenedAt, clock),
    );
    if (trucks && (
      !catalog || catalog.length !== trucks.length || trucks.some((truck, index) => {
        const current = catalog?.[index];
        return current?.id !== truck.id || current.name !== truck.name || current.status !== truck.status;
      })
    )) {
      catalog = trucks.map(({ id, name, status }) => ({ id, name, status }));
    }
    view = { ...view, ...changes, trucks };

    clearTimeout(freshnessTimer);
    if (active && firstOpenedAt !== null) {
      let wakeAt = clock.elapsed + 1000;
      for (const truck of snapshot?.fleet ?? []) {
        const deadline = signalDeadline(health.get(truck.id), firstOpenedAt);
        if (deadline !== null && deadline > clock.elapsed) wakeAt = Math.min(wakeAt, deadline);
      }
      freshnessTimer = setTimeout(() => publish(), Math.max(0, Math.ceil(wakeAt - performance.now())));
    }
    listeners.forEach(listener => listener());
  }

  async function refresh() {
    if (!active) return;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    publish({ status: 'loading' });

    try {
      const snapshot = await loadFleet(controller.signal);
      if (controller.signal.aborted) return;
      positions = mergeSnapshotPositions(positions, snapshot);
      health = mergeSnapshotHealth(health, snapshot);
      publish({ status: 'ready', snapshot });
    } catch {
      if (!controller.signal.aborted) publish({ status: 'error' });
    } finally {
      if (request === controller) request = undefined;
    }
  }

  function reconnect() {
    if (!active) return;
    const generation = ++streamGeneration;
    closeStream?.();
    health = breakFuelStreaks(health);
    publish({ telemetryStatus: 'connecting' });

    closeStream = subscribeToTelemetry({
      onUpdate: update => {
        if (generation !== streamGeneration) return;
        const received = readClock();
        positions = mergePositions(positions, update.positions);
        health = mergeNormalReadings(health, update.readings, received);
        publish(undefined, received);
      },
      onStatus: status => {
        if (generation !== streamGeneration) return;
        const received = readClock();
        if (status === 'connected') firstOpenedAt ??= received.elapsed;
        else health = breakFuelStreaks(health);
        publish({ telemetryStatus: status }, received);
      },
    });
  }

  function start() {
    active = true;
    reconnect();
    void refresh();
    return () => {
      active = false;
      streamGeneration += 1;
      closeStream?.();
      closeStream = undefined;
      request?.abort();
      request = undefined;
      clearTimeout(freshnessTimer);
    };
  }

  return {
    subscribe,
    getCatalogSnapshot: () => catalog,
    getFleetSnapshot: () => view,
    start,
    refresh,
    reconnect,
  };
}