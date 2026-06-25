import { z } from 'zod';

export const adClickRequestSchema = z.object({
  tracking_token: z.string().min(1),
});

export type AdClickRequestDto = z.infer<typeof adClickRequestSchema>;
