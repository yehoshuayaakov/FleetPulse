import { z } from 'zod';

export const registrationSchema = z.object({
  name: z.string().trim().min(1, 'Enter a display name.'),
});
