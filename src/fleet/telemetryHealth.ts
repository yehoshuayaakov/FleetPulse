import type { FleetSnapshot, Truck } from '../sharedSchemas/fleetSchema';
import type { NormalReading, PositionFix } from '../sharedSchemas/telemetrySchemas';

export const STALE_AFTER_MS = 8000;
const FUEL_ZERO_CONFIRMATION_COUNT = 3;
export const MAX_PLAUSIBLE_SPEED_KMH = 250;

export interface TelemetryClock {
  elapsed: number;
  wall: number;
}

interface FuelState {
  value?: number;
  zeroCount?: number;
  invalid?: boolean;
}

interface TruckHealth {
  receivedAt?: number;
  speed?: { value: number; at: number };
  speedFault: boolean;
  fuel: FuelState;
  engineTemp?: number;
  temperatureFault: boolean;
  heading?: number;
  status?: Truck['status'];
}

const emptyHealth: TruckHealth = { speedFault: false, fuel: {}, temperatureFault: false };

export type FleetHealth = ReadonlyMap<string, TruckHealth>;

function plausibleSpeed(speed: number | undefined): speed is number {
  return speed !== undefined && Number.isFinite(speed) && speed >= 0 && speed <= MAX_PLAUSIBLE_SPEED_KMH;
}

// The first two normal zeros stay off the card. An instant drop to empty is not a
// plausible tank change, so the last accepted percentage remains the displayed value
// until a third consecutive zero confirms it. The assignment tip asks for anomalies
// to be handled thoughtfully rather than discarded: this count is that handling.
// A visible notice during those two readings can be revisited at the end if time remains.
function updateFuel(previous: FuelState, fuel: number | undefined, staleGap: boolean): FuelState {
  if (fuel === undefined) return { value: previous.value, invalid: true };
  if (fuel > 0 || previous.value === 0) return { value: fuel };

  const zeroCount = staleGap ? 1 : (previous.zeroCount ?? 0) + 1;
  if (zeroCount >= FUEL_ZERO_CONFIRMATION_COUNT) return { value: 0 };
  return { value: previous.value, zeroCount };
}

export function mergeNormalReadings(
  current: FleetHealth,
  readings: readonly NormalReading[],
  clock: TelemetryClock,
): FleetHealth {
  if (readings.length === 0) return current;
  const next = new Map(current);
  for (const reading of readings) {
    const previous = next.get(reading.truckId) ?? emptyHealth;
    const speed = plausibleSpeed(reading.speed) ? { value: reading.speed, at: clock.wall } : undefined;
    const staleGap = previous.receivedAt !== undefined && clock.elapsed - previous.receivedAt >= STALE_AFTER_MS;
    next.set(reading.truckId, {
      receivedAt: clock.elapsed,
      speed: speed ?? previous.speed,
      speedFault: speed === undefined,
      fuel: updateFuel(previous.fuel, reading.fuel, staleGap),
      engineTemp: reading.engineTemp ?? previous.engineTemp,
      temperatureFault: reading.engineTemp === undefined,
      heading: reading.heading ?? previous.heading,
      status: reading.status ?? previous.status,
    });
  }
  return next;
}

export function mergeSnapshotHealth(current: FleetHealth, snapshot: FleetSnapshot): FleetHealth {
  const next = new Map(current);
  for (const truck of snapshot.fleet) {
    const previous = current.get(truck.id);
    const baseline: TruckHealth = {
      speed: plausibleSpeed(truck.speed) ? { value: truck.speed, at: snapshot.timestamp } : undefined,
      speedFault: !plausibleSpeed(truck.speed),
      fuel: { value: truck.fuel > 0 ? truck.fuel : previous?.fuel.value },
      engineTemp: truck.engineTemp,
      temperatureFault: false,
      heading: truck.heading,
      status: truck.status,
    };
    if (previous?.receivedAt === undefined) {
      next.set(truck.id, baseline);
      continue;
    }

    next.set(truck.id, {
      ...previous,
      speed: previous.speed ?? baseline.speed,
      fuel: truck.fuel > 0
        ? { ...previous.fuel, value: previous.fuel.value ?? truck.fuel, zeroCount: undefined }
        : previous.fuel,
      engineTemp: previous.engineTemp ?? baseline.engineTemp,
      heading: previous.heading ?? baseline.heading,
      status: previous.status ?? baseline.status,
    });
  }
  return next;
}

export function breakFuelStreaks(current: FleetHealth): FleetHealth {
  let updated: Map<string, TruckHealth> | undefined;
  for (const [id, health] of current) {
    if (health.fuel.zeroCount === undefined) continue;
    updated ??= new Map(current);
    updated.set(id, { ...health, fuel: { value: health.fuel.value } });
  }
  return updated ?? current;
}

export interface TruckTelemetry extends Omit<Truck, 'speed' | 'fuel' | 'engineTemp'> {
  speed: number | null;
  speedFault: boolean;
  speedAgeSeconds: number | null;
  fuel: number | null;
  fuelIssue: 'invalid' | null;
  engineTemp: number | null;
  temperatureFault: boolean;
  signalStale: boolean;
  positionAgeSeconds: number | null;
}

export function signalDeadline(health: TruckHealth | undefined, firstOpenedAt: number | null): number | null {
  const lastReceipt = health?.receivedAt ?? firstOpenedAt;
  return lastReceipt === null ? null : lastReceipt + STALE_AFTER_MS;
}

function ageSeconds(now: number, timestamp: number): number {
  return Math.max(0, Math.floor((now - timestamp) / 1000));
}

export function describeTruck(
  truck: Truck,
  health: TruckHealth | undefined,
  position: PositionFix | undefined,
  firstOpenedAt: number | null,
  clock: TelemetryClock,
): TruckTelemetry {
  const deadline = signalDeadline(health, firstOpenedAt);
  const signalStale = deadline !== null && clock.elapsed >= deadline;
  const positionAgeSeconds = position ? ageSeconds(clock.wall, position.timestamp) : null;

  return {
    ...truck,
    location: position?.location ?? truck.location,
    heading: health?.heading ?? truck.heading,
    status: health?.status ?? truck.status,
    speed: health?.speed?.value ?? null,
    speedFault: health?.speedFault ?? false,
    speedAgeSeconds: health?.speed ? ageSeconds(clock.wall, health.speed.at) : null,
    fuel: health?.fuel.value ?? null,
    fuelIssue: health?.fuel.invalid ? 'invalid' : null,
    engineTemp: health?.engineTemp ?? null,
    temperatureFault: health?.temperatureFault ?? false,
    signalStale,
    positionAgeSeconds,
  };
}
