-- 004: 카테고리 색 8개 → 16개 (--cat-1 ~ --cat-16)
-- 이미 schema.sql을 실행한 프로젝트에 한 번만 실행. (새 프로젝트는 schema.sql에 반영돼 있음)
-- 기존 카테고리 색 값(--cat-1~8)은 그대로 유효함 — 화면에서 새 파스텔 색으로 보일 뿐

alter table public.categories drop constraint if exists categories_color_check;
alter table public.categories add constraint categories_color_check
  check (color ~ '^--cat-([1-9]|1[0-6])$');
