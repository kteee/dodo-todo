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

## 백업과 복구

Supabase 무료 플랜엔 자동 백업이 없어서, GitHub Actions가 매일 백업한다 (`.github/workflows/backup.yml`).

- 매일 03:30(한국) DB를 떠서 **AES-256으로 암호화** → 그 실행의 Artifact로 **30일 보관**
- 실패하면 GitHub가 메일로 알림. Actions 탭 → "DB 백업" → **Run workflow**로 직접 실행 가능
- 저장소 Secrets (Settings → Secrets and variables → Actions):
  - `SUPABASE_DB_URL`: Supabase → **Connect** → **Session pooler** 연결 문자열 (`[YOUR-PASSWORD]` 자리에 DB 비밀번호)
  - `BACKUP_PASSPHRASE`: 백업 암호. **잃어버리면 복구 불가** → 비밀번호 관리자에 따로 보관

### 복구 (새 Supabase 프로젝트로)

```bash
gpg --decrypt dodo-db-YYYYMMDD-HHMM.tar.gz.gpg | tar -xzf -
psql "<새 프로젝트 Session pooler URL>" -v ON_ERROR_STOP=1 -f auth.sql     # 계정 먼저 (할 일이 계정을 참조)
psql "<새 프로젝트 Session pooler URL>" -v ON_ERROR_STOP=1 -f public.sql   # 테이블·함수·RLS·데이터
```

그다음 `supabase/migrations/005_purge_deleted.sql`(파기 예약 작업)과 `schema.sql` 끝의 `revoke/grant` 줄(백업은 권한을 담지 않음)을 다시 실행하고, 구글 로그인·URL 설정과 `.env`/Cloudflare 변수를 새 프로젝트 값으로 바꾼다.

## 에러 알림 (Sentry)

배포판 + `VITE_SENTRY_DSN`(Cloudflare 빌드 변수)이 있을 때만 켜진다 (`src/lib/monitoring.ts`).
할 일·메모 내용과 사용자 정보는 보내지 않도록 클릭 기록·요청 쿼리·DB 오류 상세를 걸러낸다.
Sentry 프로젝트 설정에서 **Security & Privacy → Prevent Storing of IP Addresses**도 켜 둘 것.

## 폰 화면

가로 640px 이하면 폰 레이아웃 (`src/hooks/usePhone.ts`, `styles.css` 맨 아래 블록).

- 처음 열면 **일간** 보기 (시작 화면을 정해 두면 그걸 따름). 보드를 **좌우로 쓸어 넘기면** 이전·다음 날/주/달
- 주간은 7일을 세로로 쌓고, 월간은 숫자 달력(점 = 할 일) → 날짜를 누르면 그날로
- 달력·카테고리는 날짜 줄 왼쪽 📅 버튼의 서랍. 카드를 꾹 눌러 끌면(0.3초) 화면 끝에서 자동 스크롤
- 홈 화면에 추가 가능 (`public/manifest.webmanifest`, 아이콘은 `favicon.svg`와 같은 모양). 서비스 워커는 두지 않음 — 오프라인 캐시가 구버전을 붙잡는 사고를 피하려고

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
| 오프라인·연결 끊김 중 편집 | 저장 큐에 남겨 두고 연결이 돌아오면 자동 재전송. 화면 위 배너로 대기 건수 표시 |
| 삭제→실행 취소, 연속 드래그 요청이 뒤바뀜 | 모든 저장을 큐에서 순서대로 하나씩 보냄 |
| 메모 자동저장(0.5초) 전에 탭 닫음 | 닫기 경고 + beforeunload 에서 즉시 저장 + fetch keepalive |
| 한 계정이 DB 용량을 다 채움 | 사용자당 상한(할 일 2만/카테고리 100/메모 3천) + 정렬 키 길이 제한 (`007_limits.sql`) |
| XSS → 토큰 탈취 | `public/_headers` CSP(스크립트는 우리 것만) + HSTS |
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
