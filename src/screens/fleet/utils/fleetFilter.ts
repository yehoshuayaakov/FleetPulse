import type { FleetRoute } from '../../../sharedSchemas/routeSchema';

export const STATUS_FILTERS = ['active', 'idle', 'maintenance'] as const;
export const FUEL_FILTERS = ['under-25', '25-50', 'over-50', 'unavailable'] as const;
export const REGION_FILTERS = ['northwest', 'northeast', 'southwest', 'southeast'] as const;
export const ASSIGNMENT_FILTERS = ['unassigned', 'assigned', 'in-progress'] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number];
export type FuelFilter = (typeof FUEL_FILTERS)[number];
export type RegionFilter = (typeof REGION_FILTERS)[number];
export type AssignmentFilter = (typeof ASSIGNMENT_FILTERS)[number];

export interface FleetFilter {
  status: ReadonlySet<StatusFilter>;
  fuel: ReadonlySet<FuelFilter>;
  region: ReadonlySet<RegionFilter>;
  assignment: ReadonlySet<AssignmentFilter>;
}

export const emptyFleetFilter: FleetFilter = {
  status: new Set(),
  fuel: new Set(),
  region: new Set(),
  assignment: new Set(),
};

export interface FilterableTruck {
  id: string;
  status: StatusFilter;
  fuel: number | null;
  location: { lat: number; lng: number };
}

// Center of the Tel Aviv window. Points on the center lines belong to the north and east.
const CENTER_LAT = 32.0853;
const CENTER_LNG = 34.7818;

export function isFleetFilterActive(filter: FleetFilter) {
  return filter.status.size + filter.fuel.size + filter.region.size + filter.assignment.size > 0;
}

export function visibleTrucks<T extends FilterableTruck>(
  trucks: readonly T[],
  assignments: ReadonlyMap<string, FleetRoute> | null,
  selectedId: string | null,
  filter: FleetFilter,
) {
  return trucks.filter(truck => truck.id === selectedId || matchesFilter(truck, assignments, filter));
}

function matchesFilter(truck: FilterableTruck, assignments: ReadonlyMap<string, FleetRoute> | null, filter: FleetFilter) {
  return matches(filter.status, truck.status)
    && matches(filter.fuel, fuelBand(truck.fuel))
    && matches(filter.region, regionOf(truck.location))
    && matches(filter.assignment, assignmentOf(assignments, truck.id));
}

function matches<T extends string>(selected: ReadonlySet<T>, value: T | null) {
  return selected.size === 0 || (value !== null && selected.has(value));
}

function fuelBand(fuel: number | null): FuelFilter {
  if (fuel === null) return 'unavailable';
  if (fuel < 25) return 'under-25';
  if (fuel <= 50) return '25-50';
  return 'over-50';
}

function regionOf(location: { lat: number; lng: number }): RegionFilter {
  const north = location.lat >= CENTER_LAT;
  const east = location.lng >= CENTER_LNG;
  if (north && east) return 'northeast';
  if (north) return 'northwest';
  if (east) return 'southeast';
  return 'southwest';
}

function assignmentOf(assignments: ReadonlyMap<string, FleetRoute> | null, truckId: string): AssignmentFilter | null {
  if (assignments === null) return null;
  const route = assignments.get(truckId);
  if (route?.status === 'assigned' || route?.status === 'in-progress') return route.status;
  return 'unassigned';
}
