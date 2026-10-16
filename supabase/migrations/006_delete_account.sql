-- 006: 회원 탈퇴 — 로그인한 본인 계정을 즉시 영구 삭제
-- 이미 schema.sql을 실행한 프로젝트에 한 번만 실행. (새 프로젝트는 schema.sql에 반영돼 있음)
--
-- auth.users 행을 지우면 categories·todos·memos 가 user_id 외래키(on delete cascade)로 함께 지워짐.
-- 브라우저용 키로는 auth.users 를 지울 수 없어서 security definer 함수로 감싸고,
-- 함수 안에서 auth.uid() 로 "본인"만 지우도록 고정함 (남의 계정은 지울 방법이 없음).

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
