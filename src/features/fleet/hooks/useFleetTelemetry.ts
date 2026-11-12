import { useCallback, useEffect, useState } from 'react';
import type { FleetSnapshot } from '../../../api/fleet/schemas';
import { subscribeToTelemetry, type TelemetryStatus } from '../../../realtime/telemetryStream';
import { mergePositions, mergeSnapshotPositions, type FleetPositions } from '../utils/telemetry';
import {
  breakFuelStreaks,
  describeTruck,
  mergeNormalReadings,
  mergeSnapshotHealth,
  signalDeadline,
  type FleetHealth,
  type TelemetryClock,
} from '../utils/telemetryHealth';

function readClock(): TelemetryClock {
  return { elapsed: performance.now(), wall: Date.now() };
}

export function useFleetTelemetry(snapshot: FleetSnapshot | null) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<TelemetryStatus>('connecting');
  const [firstOpenedAt, setFirstOpenedAt] = useState<number | null>(null);
  const [positions, setPositions] = useState<FleetPositions>(() => new Map());
  const [health, setHealth] = useState<FleetHealth>(() => new Map());
  const [clock, setClock] = useState(readClock);

  useEffect(() => subscribeToTelemetry({
    onUpdate: update => {
      const received = readClock();
      setPositions(previous => mergePositions(previous, update.positions));
      setHealth(previous => mergeNormalReadings(previous, update.readings, received));
      setClock(received);
    },
    onStatus: next => {
      const received = readClock();
      if (next === 'connected') {
        setFirstOpenedAt(previous => previous ?? received.elapsed);
      } else {
        setHealth(breakFuelStreaks);
      }
      setStatus(next);
      setClock(received);
    },
  }), [attempt]);

  useEffect(() => {
    if (firstOpenedAt === null) return;

    // Refresh age labels once a second and wake earlier at a truck's stale deadline.
    let wakeAt = clock.elapsed + 1000;
    for (const truck of snapshot?.fleet ?? []) {
      const deadline = signalDeadline(health.get(truck.id), firstOpenedAt);
      if (deadline !== null && deadline > clock.elapsed) wakeAt = Math.min(wakeAt, deadline);
    }
    const timer = setTimeout(() => setClock(readClock()), Math.max(0, Math.ceil(wakeAt - performance.now())));
    return () => clearTimeout(timer);
  }, [clock, firstOpenedAt, health, snapshot]);

  const acceptSnapshot = useCallback((next: FleetSnapshot) => {
    setPositions(previous => mergeSnapshotPositions(previous, next));
    setHealth(previous => mergeSnapshotHealth(previous, next));
  }, []);

  function reconnect() {
    setStatus('connecting');
    setAttempt(previous => previous + 1);
  }

  const trucks = snapshot?.fleet.map(truck =>
    describeTruck(truck, health.get(truck.id), positions.get(truck.id), firstOpenedAt, clock),
  );

  return { status, trucks, acceptSnapshot, reconnect };
}
