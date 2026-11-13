import type { FleetSnapshot, Truck } from '../sharedSchemas/fleetSchema';
import type { PositionFix } from '../sharedSchemas/telemetrySchemas';

export type FleetPositions = ReadonlyMap<string, PositionFix>;

export function mergePositions(positions: FleetPositions, fixes: readonly PositionFix[]): FleetPositions {
  let updated: Map<string, PositionFix> | undefined;

  for (const fix of fixes) {
    const current = (updated ?? positions).get(fix.truckId);
    if (current && current.timestamp >= fix.timestamp) continue;

    updated ??= new Map(positions);
    updated.set(fix.truckId, fix);
  }

  return updated ?? positions;
}

export function mergeSnapshotPositions(
  positions: FleetPositions,
  snapshot: { fleet: readonly Pick<Truck, 'id' | 'location'>[]; timestamp: FleetSnapshot['timestamp'] },
): FleetPositions {
  const fixes = snapshot.fleet.map(truck => ({
    truckId: truck.id,
    location: truck.location,
    timestamp: snapshot.timestamp,
  }));
  return mergePositions(positions, fixes);
}
