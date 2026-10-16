-- 002: 카테고리 없는 할 일 허용
-- 이미 schema.sql을 실행한 프로젝트에 한 번만 실행. (새 프로젝트는 schema.sql에 반영돼 있음)

-- 1) category_id를 비워둘 수 있게.
--    (category_id, user_id) 복합 FK는 category_id가 null이면 검사하지 않음(MATCH SIMPLE) → 그대로 둬도 됨
alter table public.todos alter column category_id drop not null;

-- 2) 카테고리 삭제 시 할 일을 다른 카테고리로 옮기지 않고 "카테고리 없음"으로
drop function if exists public.delete_category(uuid, uuid);

create or replace function public.delete_category(p_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.todos set category_id = null where category_id = p_id;
  update public.categories set deleted_at = now() where id = p_id and deleted_at is null;
end $$;

revoke all on function public.delete_category(uuid) from public, anon;
grant execute on function public.delete_category(uuid) to authenticated;
