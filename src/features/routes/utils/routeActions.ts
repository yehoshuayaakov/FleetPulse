import type { FleetRoute } from '../../../globalSchemas/routeSchema';

export const routeActions = {
  start: { label: 'Start route', success: 'Route started', status: 'in-progress' },
  complete: { label: 'Complete route', success: 'Route completed', status: 'completed' },
  cancel: { label: 'Cancel route', success: 'Route cancelled', status: 'cancelled' },
  reassign: { label: 'Reassign route', success: 'Route reassigned' },
} as const;

export type RouteAction = keyof typeof routeActions;

const allowedActions: Record<FleetRoute['status'], readonly RouteAction[]> = {
  assigned: ['start', 'cancel', 'reassign'],
  'in-progress': ['complete', 'cancel', 'reassign'],
  completed: [],
  cancelled: [],
};

export function actionsFor(status: FleetRoute['status']) {
  return allowedActions[status];
}

export function latestRouteActor(route: FleetRoute): string | undefined {
  const { lastModifiedAt, lastModifiedBy, reassignedAt, reassignedBy } = route;
  if (lastModifiedAt !== undefined && reassignedAt !== undefined) {
    if (lastModifiedAt > reassignedAt) return lastModifiedBy;
    if (reassignedAt > lastModifiedAt) return reassignedBy;
    return lastModifiedBy === reassignedBy ? lastModifiedBy : undefined;
  }
  if (lastModifiedAt !== undefined) return lastModifiedBy;
  if (reassignedAt !== undefined) return reassignedBy;
  return route._version === 1 ? route.assignedBy : undefined;
}
