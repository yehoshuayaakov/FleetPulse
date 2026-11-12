import { z } from 'zod';
import { routeSchema } from '../../globalSchemas/routeSchema';

export const routesSnapshotSchema = z.object({ routes: z.array(routeSchema) });
export const routeVersionConflictSchema = z.object({
  currentVersion: z.number().int().positive().optional(),
});

export const assignmentConflictSchema = z.object({
  currentRouteId: z.string().min(1).optional(),
  assignedBy: z.string().min(1).optional(),
});
