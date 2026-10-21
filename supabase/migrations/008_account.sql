-- 008: 두두 계정 — "서비스 그만두기"(이 서비스 기록만 삭제)와 "계정 탈퇴"(모든 서비스 + 계정) 분리
-- 이미 schema.sql을 실행한 프로젝트에 한 번만 실행. (새 프로젝트는 schema.sql에 반영돼 있음)
--
-- 두두 시리즈(투두·북로그·블로그)는 Supabase 프로젝트·계정 하나를 같이 쓴다.
--   delete_todo_data()   투두 기록만 삭제 (카테고리·할 일·메모). 계정과 다른 서비스는 그대로
--   delete_books_data()  북로그 저장소(001_books.sql)가 만듦
--   delete_blog_data()   블로그 저장소(001_blog.sql)가 만듦
--   delete_my_account()  위 함수 중 "있는 것"을 전부 부른 뒤 계정(auth.users)을 지움 — 이 파일이 원본.
--                        다른 서비스의 schema.sql 은 이 함수를 다시 정의하지 않는다.
-- 모두 security definer + auth.uid() 고정이라 본인 것만 지울 수 있고, 클라이언트 키로 직접 하드 삭제는 여전히 불가.

create or replace function public.delete_todo_data() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.memos where user_id = uid;
  delete from public.todos where user_id = uid;
  delete from public.categories where user_id = uid;
end $$;

revoke all on function public.delete_todo_data() from public, anon;
grant execute on function public.delete_todo_data() to authenticated;

-- 계정 탈퇴: 서비스별 삭제 함수가 있으면 차례로 부르고(없는 서비스는 건너뜀), 마지막에 계정 삭제.
-- auth.users 를 지우면 남은 행도 외래키 cascade 로 정리되지만, Storage 파일처럼 cascade 가 안 닿는 것은
-- 각 서비스 함수가 책임진다.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  f text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  foreach f in array array['delete_todo_data', 'delete_books_data', 'delete_blog_data'] loop
    if to_regprocedure('public.' || f || '()') is not null then
      execute format('select public.%I()', f);
    end if;
  end loop;
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
