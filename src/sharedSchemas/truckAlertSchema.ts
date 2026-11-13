import { z } from 'zod';

export const truckAlertSchema = z.object({
  id: z.string().min(1),
  truckId: z.string().min(1),
  message: z.string().min(1),
  severity: z.string().min(1),
  sentBy: z.string().min(1).optional(),
  timestamp: z.number().nonnegative().max(8.64e15),
  acknowledged: z.boolean(),
});

export const truckAlertEventSchema = z.object({
  type: z.literal('truck_alert'),
  alert: truckAlertSchema,
});

export type TruckAlert = z.infer<typeof truckAlertSchema>;
