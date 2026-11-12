import { z } from 'zod';

const id = z.string().min(1);
const timestamp = z.number().nonnegative().max(8.64e15);

export const routeSchema = z.object({
  id,
  truckId: id,
  destination: z.string().min(1),
  status: z.enum(['assigned', 'in-progress', 'completed', 'cancelled']),
  priority: z.string().min(1),
  notes: z.string(),
  assignedBy: id,
  assignedAt: timestamp,
  _version: z.number().int().positive(),
  lastModifiedBy: id.optional(),
  lastModifiedAt: timestamp.optional(),
  reassignedBy: id.optional(),
  reassignedAt: timestamp.optional(),
});

const routeEvent = z.object({ route: routeSchema, timestamp });
export const routeEventSchema = z.discriminatedUnion('type', [
  routeEvent.extend({ type: z.literal('route_assigned'), assignedBy: id }),
  routeEvent.extend({ type: z.literal('route_updated'), updatedBy: id }),
  routeEvent.extend({ type: z.literal('route_reassigned'), reassignedBy: id }),
]);

export type FleetRoute = z.infer<typeof routeSchema>;
export type RouteEvent = z.infer<typeof routeEventSchema>;
