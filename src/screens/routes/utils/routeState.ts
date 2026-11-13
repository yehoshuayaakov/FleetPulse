import type { FleetRoute, RouteEvent } from '../../../sharedSchemas/routeSchema';

export interface RouteActivity {
  version: number;
  actor: string;
  action: string;
  timestamp: number;
}

interface RouteState {
  routes: ReadonlyMap<string, FleetRoute>;
  activity: ReadonlyMap<string, ReadonlyMap<number, RouteActivity>>;
}

export const emptyRouteState: RouteState = { routes: new Map(), activity: new Map() };

export function mergeRouteSnapshot(state: RouteState, routes: readonly FleetRoute[]): RouteState {
  let updated: Map<string, FleetRoute> | undefined;
  for (const route of routes) {
    const current = (updated ?? state.routes).get(route.id);
    if (current && current._version >= route._version) continue;
    updated ??= new Map(state.routes);
    updated.set(route.id, route);
  }
  return updated ? { ...state, routes: updated } : state;
}

export function mergeRouteEvent(state: RouteState, event: RouteEvent): RouteState {
  const { route, timestamp } = event;
  const updated = mergeRouteSnapshot(state, [route]);
  const observed = state.activity.get(route.id);
  if (observed?.has(route._version)) return updated;

  const details = event.type === 'route_assigned'
    ? { actor: event.assignedBy, action: 'Route assigned' }
    : event.type === 'route_reassigned'
      ? { actor: event.reassignedBy, action: 'Truck reassigned' }
      : { actor: event.updatedBy, action: 'Route updated' };
  const activity = new Map(observed);
  activity.set(route._version, { ...details, version: route._version, timestamp });
  return { ...updated, activity: new Map(state.activity).set(route.id, activity) };
}

export function activeAssignments(routes: Iterable<FleetRoute>) {
  const assignments = new Map<string, FleetRoute>();
  for (const route of routes) {
    if (route.status === 'assigned' || route.status === 'in-progress') {
      assignments.set(route.truckId, route);
    }
  }
  return assignments;
}
