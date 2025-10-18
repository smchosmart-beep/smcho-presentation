-- 기존 전역 UNIQUE 제약 조건 제거
ALTER TABLE public.attendees 
  DROP CONSTRAINT IF EXISTS attendees_phone_name_key;

-- 회차별 UNIQUE 제약 조건 추가
ALTER TABLE public.attendees 
  ADD CONSTRAINT attendees_session_phone_name_unique 
  UNIQUE (session_id, phone, name);

-- 제약 조건에 대한 설명
COMMENT ON CONSTRAINT attendees_session_phone_name_unique ON public.attendees 
  IS '같은 회차 내에서만 동일한 전화번호와 이름 조합을 방지합니다. 다른 회차에는 같은 참석자를 등록할 수 있습니다.';