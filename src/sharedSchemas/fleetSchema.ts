import { z } from 'zod';
import { locationSchema } from './locationSchema';
import { truckStatusSchema } from './truckStatusSchema';

export const truckSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: truckStatusSchema,
  location: locationSchema,
  speed: z.number().nonnegative(),
  fuel: z.number().min(0).max(100),
  engineTemp: z.number(),
  heading: z.number(),
  currentRouteId: z.string().nullable(),
  _version: z.number().int().positive(),
});

export const fleetSnapshotSchema = z.object({
  fleet: z.array(truckSchema).refine(
    trucks => new Set(trucks.map(truck => truck.id)).size === trucks.length,
    'Truck IDs must be unique',
  ),
  timestamp: z.number().int().nonnegative().max(8.64e15),
});

export type Truck = z.infer<typeof truckSchema>;
export type FleetSnapshot = z.infer<typeof fleetSnapshotSchema>;
