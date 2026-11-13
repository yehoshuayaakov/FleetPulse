import { describe, expect, it } from 'vitest';
import type { FleetRoute } from '../../../sharedSchemas/routeSchema';
import { activeAssignments, emptyRouteState, mergeRouteEvent, mergeRouteSnapshot } from './routeState';

const route: FleetRoute = {
  id: 'route_1', truckId: 'truck_1', destination: 'Stop A',
  status: 'assigned', priority: 'normal', notes: '', assignedBy: 'dispatcher_a',
  assignedAt: 1000, _version: 1,
};

describe('route state', () => {
  it('deduplicates a create response and its socket echo', () => {
    const event = { type: 'route_assigned', route, assignedBy: route.assignedBy, timestamp: 1000 } as const;
    const once = mergeRouteEvent(emptyRouteState, event);
    expect(mergeRouteEvent(once, { ...event, timestamp: 1001 })).toBe(once);
    expect(once.activity.get(route.id)?.size).toBe(1);
  });

  it('keeps newer events and routes omitted by a late snapshot', () => {
    const newer = { ...route, truckId: 'truck_2', _version: 2 };
    const current = mergeRouteEvent(emptyRouteState, {
      type: 'route_reassigned', route: newer, timestamp: 2000, reassignedBy: 'dispatcher_b',
    });
    expect(mergeRouteSnapshot(current, [route])).toBe(current);
    expect(mergeRouteSnapshot(current, [])).toBe(current);

    const late = mergeRouteEvent(current, {
      type: 'route_assigned', route, timestamp: 1000, assignedBy: route.assignedBy,
    });
    expect(late.routes.get(route.id)).toBe(newer);
    expect(late.activity.get(route.id)?.size).toBe(2);
    expect(activeAssignments(late.routes.values()).has('truck_1')).toBe(false);
    expect(activeAssignments(late.routes.values()).get('truck_2')).toBe(newer);
  });

  it.each(['completed', 'cancelled'] as const)('releases the truck when a route is %s', status => {
    const current = mergeRouteSnapshot(emptyRouteState, [route]);
    const updated = mergeRouteSnapshot(current, [{ ...route, status, _version: 2 }]);
    expect(activeAssignments(updated.routes.values()).size).toBe(0);
  });
});
