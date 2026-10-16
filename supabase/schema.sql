-- DoDo 스키마. Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 실행.
-- 원칙: (1) 내 행만 보인다(RLS)  (2) 클라이언트는 하드 삭제를 못 한다(소프트 삭제만)
--       (3) 정렬 키는 바이트 순서로 비교한다(collate "C")

-- ── 테이블 ────────────────────────────────────────────
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 14),
  color       text not null check (color ~ '^--cat-([1-9]|1[0-6])$'),
  rank        text collate "C" not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (id, user_id)
);

create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid,               -- null = 카테고리 없음
  text        text not null check (char_length(text) between 1 and 500),
  date        date,              -- null = 날짜 없음("언젠가 할 일"). timestamp가 아니라 date라서 시간대 때문에 하루 밀리지 않음
  done        boolean not null default false,
  rank        text collate "C" not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  -- 남의 카테고리에 내 할 일을 붙이는 걸 DB 차원에서 막음
  foreign key (category_id, user_id) references public.categories (id, user_id)
);

create index if not exists todos_user_date_idx on public.todos (user_id, date) where deleted_at is null;
create index if not exists categories_user_idx on public.categories (user_id) where deleted_at is null;

-- ── updated_at 자동 갱신 ───────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists todos_touch on public.todos;
create trigger todos_touch before update on public.todos
  for each row execute function public.touch_updated_at();
drop trigger if exists categories_touch on public.categories;
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();

-- ── RLS: 로그인한 본인 행만. delete 정책은 일부러 없음 ───
alter table public.categories enable row level security;
alter table public.todos      enable row level security;

drop policy if exists "own select" on public.categories;
drop policy if exists "own insert" on public.categories;
drop policy if exists "own update" on public.categories;
create policy "own select" on public.categories for select to authenticated using (user_id = (select auth.uid()));
create policy "own insert" on public.categories for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own update" on public.categories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own select" on public.todos;
drop policy if exists "own insert" on public.todos;
drop policy if exists "own update" on public.todos;
create policy "own select" on public.todos for select to authenticated using (user_id = (select auth.uid()));
create policy "own insert" on public.todos for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own update" on public.todos for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── 카테고리 삭제: 그 안의 할 일은 "카테고리 없음"으로 + 카테고리 소프트 삭제를 한 트랜잭션으로 ──
-- security invoker 라서 RLS가 그대로 적용됨 (남의 데이터는 안 건드려짐)
create or replace function public.delete_category(p_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.todos set category_id = null where category_id = p_id;
  update public.categories set deleted_at = now() where id = p_id and deleted_at is null;
end $$;

revoke all on function public.delete_category(uuid) from public, anon;
grant execute on function public.delete_category(uuid) to authenticated;

-- ── 일간·주간·월간 메모 (기간 하나에 메모 하나) ──────────
create table if not exists public.memos (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope      text not null check (scope in ('day', 'week', 'month')),
  -- day: 'YYYY-MM-DD' / week: 그 주 월요일 'YYYY-MM-DD' / month: 'YYYY-MM'
  period     text not null check (period ~ '^\d{4}-\d{2}(-\d{2})?$'),
  body       text not null default '' check (char_length(body) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, scope, period)
);

drop trigger if exists memos_touch on public.memos;
create trigger memos_touch before update on public.memos
  for each row execute function public.touch_updated_at();

alter table public.memos enable row level security;

drop policy if exists "own select" on public.memos;
drop policy if exists "own insert" on public.memos;
drop policy if exists "own update" on public.memos;
create policy "own select" on public.memos for select to authenticated using (user_id = (select auth.uid()));
create policy "own insert" on public.memos for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own update" on public.memos for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── 회원 탈퇴: 본인 계정 즉시 삭제 (데이터는 외래키 cascade로 함께 삭제) ──
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
