import { z } from 'zod';
import { MAIN_PAGE_AD_SLOTS } from '../constants/ad-slots.constant';

export const adDecisionRequestSchema = z.object({
  project_id: z.string().min(1),
  user_id: z.string().min(1),
  session_id: z.string().min(1),
  slots: z.array(z.enum(MAIN_PAGE_AD_SLOTS)).min(1),
  context: z.object({
    page_url: z.string().optional(),
    device: z.string().optional(),
    category: z.string().nullable().optional(),
    age_group: z.string().nullable().optional(),
    gender: z.string().nullable().optional(),
  }),
});

export type AdDecisionRequestDto = z.infer<typeof adDecisionRequestSchema>;
