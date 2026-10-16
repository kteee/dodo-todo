-- 007: 남용 방지 상한 + 누락 인덱스
-- 이미 schema.sql을 실행한 프로젝트에 한 번만 실행. (새 프로젝트는 schema.sql에 반영돼 있음)
--
-- 배경: 공개 키 + 구글 계정만 있으면 누구나 행을 넣을 수 있다. 한 계정이 수백 MB를 밀어 넣어
-- 무료 플랜(500MB)을 채우지 못하도록, 정렬 키 길이와 사용자당 행 수에 상한을 둔다.
-- (정상 사용 범위보다 훨씬 넉넉하게: 할 일 20,000 / 카테고리 100 / 메모 3,000)

-- 정렬 키(fractional indexing)는 보통 수 자 ~ 수십 자. 256자면 극단적인 반복 끼워넣기에도 충분
alter table public.todos      add constraint todos_rank_len      check (char_length(rank) <= 256);
alter table public.categories add constraint categories_rank_len check (char_length(rank) <= 256);

-- 사용자당 행 수 상한 (삭제 대기 중인 행 포함 — 지웠다 넣기를 반복해도 늘지 않게)
create or replace function public.enforce_row_limit() returns trigger
language plpgsql set search_path = '' as $$
declare
  lim int := tg_argv[0]::int;
  n   int;
begin
  execute format('select count(*) from %I.%I where user_id = $1', tg_table_schema, tg_table_name)
    into n using new.user_id;
  if n >= lim then
    raise exception '사용자당 최대 % 개까지 저장할 수 있습니다', lim using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger todos_limit      before insert on public.todos      for each row execute function public.enforce_row_limit('20000');
create trigger categories_limit before insert on public.categories for each row execute function public.enforce_row_limit('100');
create trigger memos_limit      before insert on public.memos      for each row execute function public.enforce_row_limit('3000');

-- 위 count 와 아래 작업들이 전체 스캔을 하지 않도록
create index if not exists todos_user_idx          on public.todos (user_id);
create index if not exists categories_user_all_idx on public.categories (user_id);
create index if not exists memos_user_idx          on public.memos (user_id);
-- delete_category 의 "할 일 옮기기", purge 의 "참조 남았는지" 검사용
create index if not exists todos_category_idx on public.todos (category_id) where category_id is not null;
-- 매일 돌아가는 30일 파기 작업용 (삭제된 행만 담는 작은 인덱스)
create index if not exists todos_deleted_idx      on public.todos (deleted_at)      where deleted_at is not null;
create index if not exists categories_deleted_idx on public.categories (deleted_at) where deleted_at is not null;
