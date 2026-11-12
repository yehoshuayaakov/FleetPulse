import { describe, expect, it } from 'vitest';
import type { PositionFix } from '../../../globalSchemas/telemetrySchemas';
import { mergePositions, mergeSnapshotPositions, type FleetPositions } from './telemetry';

function fix(truckId: string, timestamp: number, lat = 32.08): PositionFix {
  return { truckId, timestamp, location: { lat, lng: 34.78 } };
}

describe('fleet GPS positions', () => {
  const empty: FleetPositions = new Map();

  it('keeps the newest position per truck across an unsorted 30-point batch', () => {
    const current = mergePositions(empty, [fix('truck_1', 30), fix('truck_2', 25)]);
    const batch = Array.from({ length: 30 }, (_, index) => fix('truck_1', 40 - index, 32.1));

    const updated = mergePositions(current, batch);
    expect(updated.size).toBe(2);
    expect(updated.get('truck_1')).toEqual(batch[0]);
    expect(updated.get('truck_2')).toBe(current.get('truck_2'));
    expect(current.get('truck_1')?.timestamp).toBe(30);
  });

  it('discards duplicate and out-of-order positions without changing the state reference', () => {
    const current = mergePositions(empty, [fix('truck_1', 40)]);
    const received = mergePositions(current, [
      fix('truck_1', 40, 32.09),
      fix('truck_1', 39.75, 32.1),
    ]);

    expect(received).toBe(current);
  });

  it('allows another truck to advance even if its timestamp is older than a peer’s', () => {
    const current = mergePositions(empty, [fix('truck_1', 40), fix('truck_2', 25)]);
    const newPosition = fix('truck_2', 30);
    const received = mergePositions(current, [fix('truck_1', 39), newPosition]);

    expect(received.get('truck_1')).toBe(current.get('truck_1'));
    expect(received.get('truck_2')).toBe(newPosition);
  });

  it('keeps newer live GPS and initializes other positions when the snapshot arrives late', () => {
    const live = fix('truck_1', 40, 32.12);
    const initial = mergePositions(empty, [live]);
    const olderLocation = { lat: 32.05, lng: 34.74 };
    const hydrated = mergeSnapshotPositions(initial, {
      timestamp: 30,
      fleet: [
        { id: 'truck_1', location: olderLocation },
        { id: 'truck_2', location: olderLocation },
      ],
    });

    expect(hydrated.get('truck_1')).toBe(live);
    expect(hydrated.get('truck_2')).toEqual({
      truckId: 'truck_2',
      timestamp: 30,
      location: olderLocation,
    });
  });

  it('keeps the snapshot position when a historical batch is older', () => {
    const current = mergeSnapshotPositions(empty, {
      timestamp: 40,
      fleet: [{ id: 'truck_1', location: { lat: 32.08, lng: 34.78 } }],
    });

    expect(mergePositions(current, [fix('truck_1', 39)])).toBe(current);
    expect(mergePositions(current, [fix('truck_1', 41)]).get('truck_1')?.timestamp).toBe(41);
  });
});
