import { z } from 'zod';

export const truckStatusSchema = z.enum(['active', 'idle', 'maintenance']);
