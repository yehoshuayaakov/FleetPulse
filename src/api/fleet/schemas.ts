import { z } from 'zod';

export const truckMileageSchema = z.object({
  id: z.string().min(1),
  mileage: z.number().nonnegative(),
});
