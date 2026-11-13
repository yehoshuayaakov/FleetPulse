import { describe, expect, it } from 'vitest';
import type { Truck } from '../sharedSchemas/fleetSchema';
import type { NormalReading } from '../sharedSchemas/telemetrySchemas';
import { decodeTelemetry } from '../realtime/telemetryStream';
import { mergePositions, mergeSnapshotPositions } from './telemetry';
import {
  breakFuelStreaks,
  describeTruck,
  mergeNormalReadings,
  mergeSnapshotHealth,
  type FleetHealth,
} from './telemetryHealth';

const started = 1_800_000_000_000;
const truck: Truck = {
  id: 'truck_1',
  name: 'Truck Alpha',
  status: 'active',
  location: { lat: 32.08, lng: 34.78 },
  speed: 48,
  fuel: 60,
  engineTemp: 80,
  heading: 30,
  currentRouteId: null,
  _version: 1,
};
const snapshot = { fleet: [truck], timestamp: started };
const baseline = mergeSnapshotHealth(new Map(), snapshot);
const positions = mergeSnapshotPositions(new Map(), snapshot);
const clock = (elapsed: number) => ({ elapsed, wall: started + elapsed });

function reading(changes: Partial<NormalReading>): NormalReading {
  return {
    truckId: truck.id,
    timestamp: started,
    speed: 48,
    fuel: 60,
    engineTemp: 80,
    ...changes,
  };
}

function receive(current: FleetHealth, elapsed: number, changes: Partial<NormalReading>) {
  return mergeNormalReadings(current, [reading(changes)], clock(elapsed));
}

function view(health: FleetHealth, now: number, firstOpenedAt: number | null = 0) {
  return describeTruck(truck, health.get(truck.id), positions.get(truck.id), firstOpenedAt, clock(now));
}

describe('signal freshness', () => {
  it('starts at first stream open and becomes stale at exactly eight seconds', () => {
    expect(view(baseline, 20_000, null).signalStale).toBe(false);
    expect(view(baseline, 8_999, 1000).signalStale).toBe(false);
    expect(view(baseline, 9_000, 1000).signalStale).toBe(true);
  });

  it('keeps the signal stale when a batch advances its position', () => {
    const batch = decodeTelemetry(JSON.stringify({
      type: 'gps_batch',
      readings: [reading({ location: { lat: 32.1, lng: 34.78 }, timestamp: started + 4000, speed: 5 })],
    }))!;
    const moved = mergePositions(positions, batch.positions);
    const health = mergeNormalReadings(baseline, batch.readings, clock(9000));

    expect(describeTruck(truck, health.get(truck.id), moved.get(truck.id), 0, clock(9000))).toMatchObject({
      location: { lat: 32.1, lng: 34.78 },
      positionAgeSeconds: 5,
      signalStale: true,
      speed: 48,
    });
  });

  it('recovers on receipt of an older normal fix and still applies its valid sensors', () => {
    const packet = decodeTelemetry(JSON.stringify({
      type: 'telemetry',
      readings: [reading({
        timestamp: started - 1000.25,
        location: { lat: 32.11, lng: 34.78 },
        speed: 42,
        fuel: 57,
        engineTemp: 91,
        status: 'idle',
      })],
    }))!;
    const health = mergeNormalReadings(baseline, packet.readings, clock(9000));

    expect(mergePositions(positions, packet.positions)).toBe(positions);
    expect(view(health, 9000)).toMatchObject({
      speed: 42, fuel: 57, engineTemp: 91, status: 'idle', signalStale: false,
    });
  });

  it('keeps live values and the receipt deadline through a late snapshot', () => {
    const current = receive(baseline, 2000, { speed: 80, fuel: 55, engineTemp: 85 });
    const afterSnapshot = mergeSnapshotHealth(current, { ...snapshot, timestamp: started + 9000 });

    expect(view(afterSnapshot, 10_000)).toMatchObject({
      speed: 80, fuel: 55, engineTemp: 85, signalStale: true,
    });
  });
});

describe('speed plausibility', () => {
  it.each([0, 250])('accepts %s km/h', speed => {
    expect(view(receive(baseline, 2000, { speed }), 2000)).toMatchObject({ speed, speedFault: false });
  });

  it.each([250.1, 999, -1, undefined])('holds only the speed field when it receives %s', speed => {
    const health = receive(baseline, 2000, { speed, fuel: 55, engineTemp: 90 });
    expect(view(health, 2000)).toMatchObject({
      speed: 48, speedFault: true, speedAgeSeconds: 2, fuel: 55, engineTemp: 90, signalStale: false,
    });
  });

  it('holds 48 through repeated 999 readings and clears the fault on a valid normal speed', () => {
    const firstFault = receive(baseline, 2000, { speed: 999 });
    const repeated = receive(firstFault, 4000, { speed: 999 });
    const batch = decodeTelemetry(JSON.stringify({
      type: 'gps_batch',
      readings: [reading({ speed: 30, timestamp: started + 3000, location: truck.location })],
    }))!;
    const afterBatch = mergeNormalReadings(repeated, batch.readings, clock(5000));
    expect(view(afterBatch, 5000)).toMatchObject({ speed: 48, speedFault: true, speedAgeSeconds: 5 });
    expect(view(receive(afterBatch, 6000, { speed: 44, timestamp: started - 1 }), 6000))
      .toMatchObject({ speed: 44, speedFault: false, speedAgeSeconds: 0 });
  });

  it('shows no speed when the first sample is faulty and no valid value exists', () => {
    const health = receive(new Map(), 2000, { speed: 999 });
    expect(view(health, 2000)).toMatchObject({ speed: null, speedFault: true });
  });
});

describe('zero fuel confirmation', () => {
  it.each([1001, 6000])('silently holds the first two zeros and confirms the third (second receipt at %s ms)', secondAt => {
    const first = receive(baseline, 1000, { fuel: 0 });
    const second = receive(first, secondAt, { fuel: 0 });
    const third = receive(second, secondAt + 1, { fuel: 0 });

    expect(view(first, 1000)).toMatchObject({ fuel: 60, fuelIssue: null });
    expect(view(second, secondAt)).toMatchObject({ fuel: 60, fuelIssue: null });
    expect(view(third, secondAt + 1)).toMatchObject({ fuel: 0, fuelIssue: null });
  });

  it('ends a transient zero on the next nonzero reading', () => {
    const first = receive(baseline, 1000, { fuel: 0 });
    expect(view(receive(first, 3000, { fuel: 58 }), 3000)).toMatchObject({ fuel: 58, fuelIssue: null });
  });

  it('restarts the count after disconnect or an eight-second gap', () => {
    const first = receive(baseline, 1000, { fuel: 0 });
    const second = receive(first, 2000, { fuel: 0 });
    const afterDisconnect = receive(breakFuelStreaks(second), 3000, { fuel: 0 });
    const afterGap = receive(second, 10_000, { fuel: 0 });

    expect(view(afterDisconnect, 3000)).toMatchObject({ fuel: 60, fuelIssue: null });
    expect(view(afterGap, 10_000)).toMatchObject({ fuel: 60, fuelIssue: null });
  });

  it('starts again after a missing fuel field and preserves other accepted fields', () => {
    const first = receive(baseline, 1000, { fuel: 0 });
    const second = receive(first, 2000, { fuel: 0 });
    const invalid = receive(second, 3000, { fuel: undefined, engineTemp: 91 });
    const next = receive(invalid, 4000, { fuel: 0 });

    expect(view(invalid, 3000)).toMatchObject({ fuel: 60, fuelIssue: 'invalid', engineTemp: 91 });
    expect(view(next, 4000)).toMatchObject({ fuel: 60, fuelIssue: null });
  });

  it.each([
    { initial: new Map(), expected: 60 },
    { initial: mergeSnapshotHealth(new Map(), { ...snapshot, fleet: [{ ...truck, fuel: 55 }] }), expected: 55 },
  ])('clears two pending zeros when a positive snapshot arrives', ({ initial, expected }) => {
    const first = receive(initial, 1000, { fuel: 0 });
    const second = receive(first, 2000, { fuel: 0 });
    const afterSnapshot = mergeSnapshotHealth(second, snapshot);
    const nextZero = receive(afterSnapshot, 3000, { fuel: 0 });
    const secondNewZero = receive(nextZero, 4000, { fuel: 0 });
    const thirdNewZero = receive(secondNewZero, 5000, { fuel: 0 });

    expect(view(afterSnapshot, 2000).fuel).toBe(expected);
    expect(view(nextZero, 3000).fuel).toBe(expected);
    expect(view(secondNewZero, 4000).fuel).toBe(expected);
    expect(view(thirdNewZero, 5000).fuel).toBe(0);
    expect(view(mergeSnapshotHealth(thirdNewZero, snapshot), 5000).fuel).toBe(0);
  });

  it('preserves two pending normal zeros when a late snapshot reports zero', () => {
    const first = receive(baseline, 1000, { fuel: 0 });
    const second = receive(first, 2000, { fuel: 0 });
    const afterSnapshot = mergeSnapshotHealth(second, { ...snapshot, fleet: [{ ...truck, fuel: 0 }] });

    expect(view(afterSnapshot, 2000).fuel).toBe(60);
    expect(view(receive(afterSnapshot, 3000, { fuel: 0 }), 3000).fuel).toBe(0);
  });

  it('holds unavailable through two leading zeros, even if the REST snapshot also contains zero', () => {
    const zeroSnapshot = mergeSnapshotHealth(new Map(), {
      ...snapshot, fleet: [{ ...truck, fuel: 0 }],
    });
    const first = receive(zeroSnapshot, 1000, { fuel: 0 });
    const second = receive(first, 2000, { fuel: 0 });
    const third = receive(second, 3000, { fuel: 0 });

    expect(view(zeroSnapshot, 0).fuel).toBeNull();
    expect(view(first, 1000)).toMatchObject({ fuel: null, fuelIssue: null });
    expect(view(second, 2000)).toMatchObject({ fuel: null, fuelIssue: null });
    expect(view(third, 3000)).toMatchObject({ fuel: 0, fuelIssue: null });
  });

  it('holds confirmed zero across a disconnect and stale gap until a nonzero reading', () => {
    const first = receive(baseline, 1000, { fuel: 0 });
    const second = receive(first, 2000, { fuel: 0 });
    const confirmed = receive(second, 3000, { fuel: 0 });
    const afterGap = receive(breakFuelStreaks(confirmed), 15_000, { fuel: 0 });

    expect(view(afterGap, 15_000)).toMatchObject({ fuel: 0, fuelIssue: null });
    expect(view(receive(afterGap, 16_000, { fuel: 7 }), 16_000)).toMatchObject({ fuel: 7, fuelIssue: null });
  });

  it('leaves the count alone when a GPS batch contains fuel', () => {
    const first = receive(baseline, 1000, { fuel: 0 });
    const batch = decodeTelemetry(JSON.stringify({
      type: 'gps_batch',
      readings: [reading({ fuel: 95, location: truck.location })],
    }))!;
    const afterBatch = mergeNormalReadings(first, batch.readings, clock(2000));
    const second = receive(afterBatch, 3000, { fuel: 0 });
    const third = receive(second, 4000, { fuel: 0 });

    expect(view(second, 3000)).toMatchObject({ fuel: 60, fuelIssue: null });
    expect(view(third, 4000)).toMatchObject({ fuel: 0, fuelIssue: null });
  });

  it('preserves valid fuel and temperature through malformed fields', () => {
    const health = receive(baseline, 2000, { fuel: undefined, engineTemp: undefined });
    expect(view(health, 2000)).toMatchObject({
      fuel: 60, fuelIssue: 'invalid', engineTemp: 80, temperatureFault: true,
    });
  });
});
