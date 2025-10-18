-- 기존 row_label 단독 제약 조건 제거하고 session별 제약 조건으로 변경
ALTER TABLE public.seat_layout 
  DROP CONSTRAINT IF EXISTS seat_layout_row_label_key;

-- 회차별로 row_label이 고유하도록 제약 조건 추가
ALTER TABLE public.seat_layout 
  ADD CONSTRAINT seat_layout_session_row_label_unique 
  UNIQUE (session_id, row_label);

-- 2회차에 좌석 레이아웃 생성 (A~L행, 각 20석)
INSERT INTO public.seat_layout (session_id, row_label, seat_count, is_active, display_order)
SELECT 
  'c244c10e-9884-44d9-ba14-78c8ecbc0e50'::uuid as session_id,
  row_label,
  20 as seat_count,
  true as is_active,
  display_order
FROM (
  VALUES 
    ('A', 1), ('B', 2), ('C', 3), ('D', 4),
    ('E', 5), ('F', 6), ('G', 7), ('H', 8),
    ('I', 9), ('J', 10), ('K', 11), ('L', 12)
) AS rows(row_label, display_order);