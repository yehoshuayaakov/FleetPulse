import { z } from 'zod';

export const alertSchema = z.object({
  message: z.string().trim().min(1, 'Enter an alert message.'),
  severity: z.enum(['info', 'warning', 'critical']),
});
