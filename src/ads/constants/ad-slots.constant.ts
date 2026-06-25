export const MAIN_PAGE_AD_SLOTS = [
  'main_hero',
  'main_side_left',
  'main_side_right',
] as const;

export type MainPageAdSlot = (typeof MAIN_PAGE_AD_SLOTS)[number];

export function isMainPageAdSlot(slotId: string): slotId is MainPageAdSlot {
  return MAIN_PAGE_AD_SLOTS.includes(slotId as MainPageAdSlot);
}
