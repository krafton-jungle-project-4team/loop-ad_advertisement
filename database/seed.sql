INSERT INTO campaign (
  campaign_id,
  name,
  priority,
  status,
  target_category,
  target_age_groups,
  target_gender
) VALUES
  ('camp_fresh_01', '신선식품 프로모션', 10, 'active', 'fresh_food', ARRAY['30s', '40s'], NULL),
  ('camp_pet_01', '반려동물 용품 프로모션', 8, 'active', 'pet', ARRAY['20s', '30s'], NULL),
  ('camp_digital_01', '디지털/가전 기획전', 5, 'active', 'digital', NULL, NULL),
  ('camp_fashion_01', '패션 기획전', 5, 'active', 'fashion', ARRAY['20s', '30s'], 'female');

INSERT INTO creative (
  creative_id,
  campaign_id,
  variant,
  headline,
  image_url,
  target_url
) VALUES
  ('cr_fresh_A', 'camp_fresh_01', 'A', '신선한 닭가슴살 30% 할인', 'https://placehold.co/800x400?text=fresh-A', '/category/fresh_food'),
  ('cr_fresh_B', 'camp_fresh_01', 'B', '오늘의 신선특가 ✨', 'https://placehold.co/800x400?text=fresh-B', '/category/fresh_food'),
  ('cr_pet_A', 'camp_pet_01', 'A', '우리 냥이 간식 특가', 'https://placehold.co/800x400?text=pet-A', '/category/pet'),
  ('cr_pet_B', 'camp_pet_01', 'B', '반려동물 필수템 모음', 'https://placehold.co/800x400?text=pet-B', '/category/pet'),
  ('cr_digital_A', 'camp_digital_01', 'A', '신상 이어폰 입고', 'https://placehold.co/400x400?text=digital-A', '/category/digital'),
  ('cr_digital_B', 'camp_digital_01', 'B', '가전 최대 50%', 'https://placehold.co/400x400?text=digital-B', '/category/digital'),
  ('cr_fashion_A', 'camp_fashion_01', 'A', '지금 많이 보는 데일리룩', 'https://placehold.co/400x400?text=fashion-A', '/category/fashion'),
  ('cr_fashion_B', 'camp_fashion_01', 'B', '오늘의 패션 특가', 'https://placehold.co/400x400?text=fashion-B', '/category/fashion');

INSERT INTO placement (
  campaign_id,
  slot_id,
  weight
) VALUES
  ('camp_fresh_01', 'main_hero', 100),
  ('camp_pet_01', 'main_hero', 100),
  ('camp_digital_01', 'main_side_left', 100),
  ('camp_fashion_01', 'main_side_right', 100);
