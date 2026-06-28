import { z } from 'zod';

export const adDecisionRequestSchema = z
  .object({
    project_id: z.string().min(1),
    user_id: z.string().min(1),
    slot_id: z.string().min(1).optional(),
    page_url: z.string().optional(),
    category: z.string().nullable().optional(),
    device: z.string().nullable().optional(),
  })
  .strict();

export type AdDecisionRequestDto = z.infer<typeof adDecisionRequestSchema>;
