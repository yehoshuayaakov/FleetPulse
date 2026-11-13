import { z } from 'zod';

const dispatcherId = z.string().min(1);

export const fleetResetSchema = z.object({
  type: z.literal('fleet_reset'),
  timestamp: z.number(),
});

export const dispatcherEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('registered'), dispatcherId }),
  z.object({ type: z.literal('dispatcher_joined'), dispatcherId, name: z.string().min(1) }),
  z.object({ type: z.literal('dispatcher_left'), dispatcherId }),
  z.object({ type: z.literal('dispatcher_viewing'), dispatcherId, name: z.string().min(1).optional(), truckId: z.string().min(1).nullable() }),
]);

export type DispatcherPeerEvent = Exclude<z.infer<typeof dispatcherEventSchema>, { type: 'registered' }>;
