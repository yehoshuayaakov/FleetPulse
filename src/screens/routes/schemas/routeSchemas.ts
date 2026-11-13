import { z } from 'zod';

export const reassignmentSchema = z.object({
  newTruckId: z.string().min(1, 'Select a target truck.'),
});

export const assignmentSchema = z.object({
  truckId: z.string().min(1, 'Select a truck.'),
  destination: z.string().trim().min(1, 'Enter a destination.'),
  priority: z.enum(['normal', 'high']),
  notes: z.string().trim(),
});
