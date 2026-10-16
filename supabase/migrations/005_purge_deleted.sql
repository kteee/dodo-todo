-- 005: 삭제한 지 30일 지난 할 일·카테고리를 매일 영구 삭제 (개인정보 처리방침 3항 "삭제 후 30일 보관 후 파기")
-- 실행 전: Supabase 대시보드 → Database → Extensions 에서 "pg_cron" 을 켜야 함

create extension if not exists pg_cron;

-- 매일 새벽 4시(UTC 19:00 = 한국 04:00)에 실행. 같은 이름의 예약이 있으면 덮어씀
select cron.schedule(
  'dodo-purge-deleted',
  '0 19 * * *',
  $$
    delete from public.todos      where deleted_at is not null and deleted_at < now() - interval '30 days';
    delete from public.categories where deleted_at is not null and deleted_at < now() - interval '30 days'
      -- 지운 카테고리를 가리키는 할 일은 삭제 시점에 이미 "카테고리 없음"으로 옮겨져 있음
      and not exists (select 1 from public.todos t where t.category_id = categories.id);
  $$
);

-- 확인: select * from cron.job;   실행 기록: select * from cron.job_run_details order by start_time desc limit 5;
