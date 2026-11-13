import { expect, it } from 'vitest';
import type { FleetRoute } from '../../../sharedSchemas/routeSchema';
import { actionsFor, latestRouteActor } from './routeActions';

const route: FleetRoute = {
  id: 'route_1', truckId: 'truck_2', destination: 'Stop A', status: 'assigned',
  priority: 'normal', notes: '', assignedBy: 'alice', assignedAt: 1, _version: 3,
  lastModifiedBy: 'charlie', lastModifiedAt: 20, reassignedBy: 'bob', reassignedAt: 30,
};

it('limits actions to the current route status', () => {
  expect(actionsFor('assigned')).toEqual(['start', 'cancel', 'reassign']);
  expect(actionsFor('in-progress')).toEqual(['complete', 'cancel', 'reassign']);
  expect(actionsFor('completed')).toEqual([]);
  expect(actionsFor('cancelled')).toEqual([]);
});

it('uses the latest mutation actor rather than the original assignment actor', () => {
  expect(latestRouteActor(route)).toBe('bob');
  expect(latestRouteActor({ ...route, lastModifiedAt: 40 })).toBe('charlie');
  expect(latestRouteActor({ ...route, lastModifiedAt: 30 })).toBeUndefined();
});
