import { describe, expect, it } from 'vitest';
import type { FleetRoute } from '../../../sharedSchemas/routeSchema';
import { emptyFleetFilter, visibleTrucks, type FilterableTruck, type FleetFilter } from './fleetFilter';

const center = { lat: 32.0853, lng: 34.7818 };

function truck(id: string, patch: Partial<FilterableTruck> = {}): FilterableTruck {
  return { id, status: 'active', fuel: 60, location: center, ...patch };
}

function route(truckId: string, status: FleetRoute['status']): FleetRoute {
  return {
    id: `route_${truckId}`, truckId, destination: 'Harbor', status, priority: 'normal', notes: '',
    assignedBy: 'dispatcher_a', assignedAt: 1, _version: 1,
  };
}

function filter(patch: Partial<{ [K in keyof FleetFilter]: FleetFilter[K] extends ReadonlySet<infer V> ? V[] : never }> = {}): FleetFilter {
  return {
    status: new Set(patch.status),
    fuel: new Set(patch.fuel),
    region: new Set(patch.region),
    assignment: new Set(patch.assignment),
  };
}

describe('fleet filter', () => {
  const trucks = [
    truck('alpha', { status: 'active', fuel: 24.9, location: { lat: 32.09, lng: 34.77 } }),
    truck('bravo', { status: 'idle', fuel: 25, location: { lat: 32.09, lng: 34.79 } }),
    truck('charlie', { status: 'maintenance', fuel: 50, location: { lat: 32.08, lng: 34.79 } }),
    truck('delta', { status: 'active', fuel: 50.1, location: { lat: 32.08, lng: 34.77 } }),
    truck('echo', { status: 'idle', fuel: null, location: center }),
  ];

  it('shows the whole fleet when every group is empty', () => {
    expect(visibleTrucks(trucks, new Map(), null, emptyFleetFilter).map(item => item.id)).toEqual([
      'alpha', 'bravo', 'charlie', 'delta', 'echo',
    ]);
  });

  it('keeps a truck that matches any selected status and every active group', () => {
    const shown = visibleTrucks(trucks, new Map(), null, filter({ status: ['active', 'idle'], fuel: ['under-25'] }));
    expect(shown.map(item => item.id)).toEqual(['alpha']);
  });

  it('places fuel on the band boundaries and treats missing fuel as unavailable', () => {
    expect(visibleTrucks(trucks, new Map(), null, filter({ fuel: ['under-25'] })).map(item => item.id)).toEqual(['alpha']);
    expect(visibleTrucks(trucks, new Map(), null, filter({ fuel: ['25-50'] })).map(item => item.id)).toEqual(['bravo', 'charlie']);
    expect(visibleTrucks(trucks, new Map(), null, filter({ fuel: ['over-50'] })).map(item => item.id)).toEqual(['delta']);
    expect(visibleTrucks(trucks, new Map(), null, filter({ fuel: ['unavailable'] })).map(item => item.id)).toEqual(['echo']);
  });

  it('splits the window at the center and counts the center lines as north and east', () => {
    expect(visibleTrucks(trucks, new Map(), null, filter({ region: ['northwest'] })).map(item => item.id)).toEqual(['alpha']);
    expect(visibleTrucks(trucks, new Map(), null, filter({ region: ['northeast'] })).map(item => item.id)).toEqual(['bravo', 'echo']);
    expect(visibleTrucks(trucks, new Map(), null, filter({ region: ['southeast'] })).map(item => item.id)).toEqual(['charlie']);
    expect(visibleTrucks(trucks, new Map(), null, filter({ region: ['southwest'] })).map(item => item.id)).toEqual(['delta']);
  });

  it('uses the route list for assignment and waits while that list is unknown', () => {
    const assignments = new Map([
      ['alpha', route('alpha', 'assigned')],
      ['bravo', route('bravo', 'in-progress')],
      ['charlie', route('charlie', 'cancelled')],
    ]);

    expect(visibleTrucks(trucks, assignments, null, filter({ assignment: ['unassigned'] })).map(item => item.id))
      .toEqual(['charlie', 'delta', 'echo']);
    expect(visibleTrucks(trucks, assignments, null, filter({ assignment: ['assigned', 'in-progress'] })).map(item => item.id))
      .toEqual(['alpha', 'bravo']);
    expect(visibleTrucks(trucks, null, null, filter({ assignment: ['unassigned'] }))).toEqual([]);
  });

  it('keeps the open truck visible when it misses the filter', () => {
    expect(visibleTrucks(trucks, new Map(), 'delta', filter({ status: ['maintenance'] })).map(item => item.id))
      .toEqual(['charlie', 'delta']);
  });
});
