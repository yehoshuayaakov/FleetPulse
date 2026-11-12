import { z } from 'zod';
import { locationSchema } from './locationSchema';
import { truckStatusSchema } from './truckStatusSchema';

const readingIdentitySchema = z.object({
  truckId: z.string().min(1),
  timestamp: z.number().nonnegative().max(8.64e15),
});

export const positionFixSchema = readingIdentitySchema.extend({
  location: locationSchema,
});

export const normalReadingSchema = readingIdentitySchema.extend({
  location: locationSchema.optional().catch(undefined),
  speed: z.number().optional().catch(undefined),
  fuel: z.number().min(0).max(100).optional().catch(undefined),
  engineTemp: z.number().optional().catch(undefined),
  heading: z.number().optional().catch(undefined),
  status: truckStatusSchema.optional().catch(undefined),
}).refine(reading =>
  reading.location !== undefined || reading.speed !== undefined || reading.fuel !== undefined
  || reading.engineTemp !== undefined || reading.heading !== undefined || reading.status !== undefined,
);

export type PositionFix = z.infer<typeof positionFixSchema>;
export type NormalReading = z.infer<typeof normalReadingSchema>;

export interface TelemetryUpdate {
  positions: PositionFix[];
  readings: NormalReading[];
}
