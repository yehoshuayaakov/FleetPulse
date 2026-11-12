import { routeSchema, type FleetRoute } from '../../globalSchemas/routeSchema';
import { HttpError, requestJson } from '../http';
import { assignmentConflictSchema, routeVersionConflictSchema } from './schemas';

export interface AssignmentInput {
  truckId: string;
  destination: string;
  priority: string;
  notes: string;
}

export class AssignmentConflict extends Error {
  constructor(readonly routeId?: string, readonly assignedBy?: string) {
    super('This truck already has a route.');
    this.name = 'AssignmentConflict';
  }
}

export async function createRoute(input: AssignmentInput, dispatcherId: string) {
  try {
    const response = await requestJson('/api/routes', {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/json', 'X-Dispatcher-Id': dispatcherId },
      body: JSON.stringify(input),
    });
    return routeSchema.parse(response);
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) {
      const details = assignmentConflictSchema.safeParse(error.body);
      throw details.success
        ? new AssignmentConflict(details.data.currentRouteId, details.data.assignedBy)
        : new AssignmentConflict();
    }
    throw error;
  }
}

export class RouteVersionConflict extends Error {
  constructor(readonly currentVersion?: number) {
    super('This route changed before the update could be saved.');
    this.name = 'RouteVersionConflict';
  }
}

export class ReassignmentConflict extends Error {
  constructor() {
    super('The target truck already has a route.');
    this.name = 'ReassignmentConflict';
  }
}

export async function changeRouteStatus(
  routeId: string,
  status: Exclude<FleetRoute['status'], 'assigned'>,
  version: number,
  dispatcherId: string,
) {
  try {
    const response = await requestJson(`/api/routes/${encodeURIComponent(routeId)}`, {
      method: 'PATCH',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/json',
        'X-Dispatcher-Id': dispatcherId,
        'If-Match': String(version),
      },
      body: JSON.stringify({ status }),
    });
    return routeSchema.parse(response);
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) {
      const details = routeVersionConflictSchema.safeParse(error.body);
      throw new RouteVersionConflict(details.success ? details.data.currentVersion : undefined);
    }
    throw error;
  }
}

export async function reassignRoute(routeId: string, newTruckId: string, dispatcherId: string) {
  try {
    const response = await requestJson(`/api/routes/${encodeURIComponent(routeId)}/reassign`, {
      method: 'PUT',
      signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/json', 'X-Dispatcher-Id': dispatcherId },
      body: JSON.stringify({ newTruckId }),
    });
    return routeSchema.parse(response);
  } catch (error) {
    if (error instanceof HttpError && error.status === 409) throw new ReassignmentConflict();
    throw error;
  }
}
