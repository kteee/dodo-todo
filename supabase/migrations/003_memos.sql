-- 003: 일간·주간·월간 메모
-- 이미 schema.sql을 실행한 프로젝트에 한 번만 실행. (새 프로젝트는 schema.sql에 반영돼 있음)
-- 기간 하나에 메모 하나. 빈 메모는 body = '' 로 남음 (행을 지우지 않음)

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
