# DoDo — 주간 투두 보드

한 주를 한 화면에. 7일 칸 + **언젠가 할 일** 칸 사이로 할 일을 끌어서 옮기는 투두 서비스.

- 프론트: Vite + React + TypeScript (서버 없음, 정적 파일만 배포)
- 데이터·인증: Supabase (Postgres + 구글 로그인 + RLS)
- 환경변수가 없으면 **로컬 모드**: 이 브라우저 localStorage에만 저장. 로그인 없이 바로 써볼 수 있음

## 바로 실행 (로컬 모드)

```bash
npm install
npm run dev
```

http://localhost:5175

## Supabase 연결 (실서비스 모드)

1. [supabase.com](https://supabase.com)에서 프로젝트 생성 (리전: Northeast Asia (Seoul))
2. **SQL Editor**에 `supabase/schema.sql` 전체를 붙여넣고 Run
3. **Authentication → Providers → Google** 켜기
   - Google Cloud Console → API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션) 생성
   - 승인된 리디렉션 URI에 Supabase가 보여주는 Callback URL(`https://<프로젝트>.supabase.co/auth/v1/callback`)을 넣음
   - 받은 Client ID / Secret을 Supabase에 입력
4. **Authentication → URL Configuration**
   - Site URL: 배포 주소 (예: `https://dodo.pages.dev`)
   - Redirect URLs에 `http://localhost:5175` 추가 (개발용)
5. `.env.example`을 `.env`로 복사하고 채움
   - `VITE_SUPABASE_URL`: Project Settings → Data API → Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Project Settings → API Keys → Publishable key (`sb_publishable_...`)
6. `npm run dev` → 우측 상단 "Google로 로그인"

> Publishable key는 브라우저에 노출돼도 되는 키야. 보안은 RLS가 담당하고, `schema.sql`이 "본인 행만" 규칙을 건다.
> **Secret key(`sb_secret_...`)나 레거시 service_role 키는 절대 `.env`에 넣지 말 것.**

## 배포 (Cloudflare Workers, 정적 사이트)

GitHub `main`에 푸시하면 Cloudflare가 자동으로 빌드·배포한다. 설정은 `wrangler.jsonc`.

1. Cloudflare 대시보드 → Workers & Pages → GitHub 저장소 연결
2. Build command `npm run build`, Deploy command `npx wrangler deploy`
3. **빌드용** 환경변수(Settings → Build → Variables and secrets): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `NODE_VERSION=22`
   - Vite는 빌드할 때 값을 코드에 넣으므로, 바꾼 뒤엔 다시 배포해야 반영됨
   - 값이 빠지면 배포판은 "서비스 설정 오류" 화면을 띄움 (조용히 로컬 모드로 가지 않게)
4. Supabase → Authentication → URL Configuration
   - Site URL = 배포 주소, Redirect URLs = 배포 주소 + `http://localhost:5175`
   - 이걸 안 하면 구글 로그인 후 localhost로 튕김

## 안정성 설계 메모

| 위험 | 대응 |
|---|---|
| 할 일이 사라짐 | DB는 **소프트 삭제만**(delete 정책 자체가 없음). 화면엔 "실행 취소" 토스트 |
| 드래그 후 저장 실패 → 새로고침하면 원위치 | 화면 먼저 반영 → 실패하면 빨간 토스트 + 서버 상태로 다시 맞춤 (`src/data/useDodo.ts`) |
| 순서 바꿀 때 행 수십 개 갱신 | 문자열 정렬 키(fractional indexing). 옮긴 카드 **한 행만** 갱신. DB 컬럼은 `collate "C"` |
| 시간대 때문에 하루 밀림 | 날짜는 `date` 타입(`YYYY-MM-DD`), timestamp 안 씀 |
| 남의 데이터 접근 | RLS + `(category_id, user_id)` 복합 FK |
| 카테고리 삭제 중간 실패 | 할 일 이동 + 삭제를 DB 함수 하나(`delete_category`)로 원자 처리 |
| 할 일 1000개 넘는 사용자 | Supabase 기본 1000행 제한 → 페이지 나눠 전부 읽음 |
| 다른 기기에서 바꾼 내용 | 탭에 돌아올 때 다시 불러옴 (저장 중이면 덮어쓰지 않음) |
| 탭 켜둔 채 자정 지남 | 1분마다 "오늘" 갱신 |
| 저장 중 창 닫기 | `beforeunload` 경고 |
| 데이터 갇힘 | 계정 메뉴 → 데이터 내보내기 (JSON) |

## 출시 전 남은 것

- [ ] Supabase **Pro 플랜** (무료는 비활성 시 일시정지 + 자동 백업 없음)
- [ ] 백업 **복원 리허설** 한 번
- [ ] Sentry 연결 (프론트 에러 수집)
- [ ] 가동 감시 (UptimeRobot / Better Stack)
- [ ] 30일 지난 소프트 삭제 행 정리 (pg_cron)
- [ ] 개인정보처리방침 페이지 (구글 로그인 쓰니까 필요)
- [ ] Google OAuth 동의 화면 **"프로덕션으로 게시"** (테스트 상태면 등록한 테스트 사용자만 로그인됨)
- [ ] PWA 매니페스트 (폰 홈 화면에 추가)
