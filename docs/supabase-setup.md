# Supabase 연결 (사용자가 진행할 외부 작업)

프로젝트가 없어도 자산관리의 **샘플 보기**와 기존 개인용/업무용/AI 사무실은 사용할 수 있습니다. 프로젝트가 만들어지기 전에는 실제 로그인·호스팅 DB·네트워크·RLS의 종단 간 검증이 완료된 상태가 아닙니다. 전체 검증이 끝날 때까지 실제 금융정보를 사용하지 마세요.

## 프로젝트와 본인 계정

1. Supabase 대시보드에서 새 프로젝트를 생성합니다. DB 비밀번호는 비밀 저장소에 보관하고 저장소·채팅·브라우저 코드에 넣지 않습니다.
2. Authentication → Users에서 본인의 이메일 계정 하나를 생성하고 이메일 확인 및 강한 비밀번호를 설정합니다. 자동 가입(Allow new users to sign up)은 비활성화합니다. 앱은 가입·OAuth·인증 리디렉션을 사용하지 않는 이메일/비밀번호 방식입니다. Auth 사용자의 UUID를 복사합니다.
3. 개발 환경에서 `npm run prepare:supabase -- 본인-Auth-사용자-UUID`를 실행합니다. 두 마이그레이션과 본인 등록을 하나의 트랜잭션으로 합친 `private/supabase-setup.sql`이 생성됩니다. 이 파일은 Git에서 제외됩니다. 기존 자산 테이블이 있으면 초기화를 거부하므로 이미 설정한 DB에는 다시 실행하지 않습니다.
4. 생성된 파일을 열고 **Ctrl+A → Ctrl+C**로 전체를 복사합니다. Supabase SQL Editor의 새 쿼리에 붙여 넣고, 글자 선택을 해제한 뒤 **Run**을 누릅니다. `Asset database setup complete` 결과가 나오면 완료입니다. 실제 UUID를 저장소에 커밋하지 마세요.

   SQL Editor가 RLS 경고를 표시하면 **Run and enable RLS**를 선택합니다. SQL 자체도 모든 금융 테이블에 RLS를 적용하지만, 편집기의 정적 검사가 반복문으로 적용하는 부분을 인식하지 못할 수 있습니다. `LINE 1: owner_id ...` 구문 오류는 테이블 정의 중간부터 실행했다는 뜻입니다. 새 쿼리에 파일 전체를 붙여 넣고 일부 선택 영역 없이 실행하세요.

   허용 사용자는 DB에 한 명만 등록할 수 있습니다. 등록되지 않은 인증 사용자는 모든 금융 테이블에서 0행을 보며 쓰기도 거부됩니다. 등록을 비우면 모두 차단됩니다. `private` 스키마는 Data API의 exposed schemas에 추가하지 않습니다. RLS는 `asset_accounts`, `asset_holdings`, `asset_snapshots`, `asset_payments`, `asset_imports`에 적용됩니다.

## 공개 연결 정보

프로젝트 Settings → API에서 프로젝트 URL과 **publishable 키**(또는 legacy anon 키)를 확인합니다. 이 키는 공개 클라이언트용이며 RLS가 실제 접근 권한을 제한합니다. **secret / service_role 키는 앱에서 절대 사용하지 않습니다.**

- 간단한 연결: 자산관리 → 내 자산 로그인 → Supabase 공개 연결 설정에서 URL과 공개 키를 입력합니다. 공개 정보만 이 브라우저의 localStorage에 저장됩니다. 비밀번호·access token·refresh token·금융 데이터는 localStorage에 저장하지 않습니다.
- 공용 기본 설정: `assets/public-config.mjs`에 공개 URL/키만 지정할 수도 있습니다. CI 배포 시에는 GitHub repository variables `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`로 아티팩트에 주입할 수 있습니다. 저장소에 비밀 키를 넣지 마세요.
- 네트워크가 제한된 클라우드에서는 실제 프로젝트의 `<project-ref>.supabase.co`를 환경 설정의 허용 도메인에 추가해야 합니다. 환경 초안 저장만으로 현재 런타임에 적용되지는 않습니다.

로그인은 자산관리 화면에서 사용자가 요청할 때만 실행합니다. Auth의 `/user` 확인과 `asset_access_allowed` RPC가 모두 성공한 뒤에만 금융 테이블을 읽습니다. access token은 메모리에만 유지하며 최대 1시간 후 잠깁니다. 새로고침하면 다시 로그인합니다. 로그아웃/만료 시 보유 데이터와 업로드 미리보기를 화면에서 지우고 진행 중인 요청을 취소합니다. 공유 기기에서는 사용 후 로그아웃하고 브라우저를 닫으세요.

## 검증과 운영 전 확인

- `npm ci && npm test`: 합성 Auth 응답을 사용하는 인증 경계 및 PGlite(PostgreSQL 엔진)의 실제 RLS 정책 테스트. Supabase의 네트워크/GoTrue 설정을 대신 검증하지 않습니다.
- `node scripts/check-supabase-connection.mjs --auth-only`: 공개 URL/키와 실제 인증 서버 및 Pages 로그인 CORS를 확인합니다. SQL 설정 후에는 `--auth-only` 없이 실행하여 익명 테이블/RPC 접근 거부도 확인합니다. 금융 레코드·비밀번호·로그인 토큰은 읽지 않습니다. 이 검사는 본인 로그인 검증을 대신하지 않습니다. `Verify deployed My Space` 워크플로의 `supabase_check`를 `auth` 또는 `schema`로 선택해 GitHub Actions에서도 실행할 수 있습니다.
- 본인 계정으로 빈 DB 접속 → 합성 계좌·납부일정 생성 → 합성 업로드 → 대시보드 갱신을 확인합니다.
- 관리자 도구로 만든 다른 합성 테스트 사용자는 접근 거부되어야 합니다. anon 키만으로 금융 테이블 읽기/쓰기/RPC도 거부되어야 합니다.
- 로그아웃 직후/세션 만료/응답 지연 중 탭 이동에서 이전 금융 데이터가 다시 표시되지 않는지 확인합니다.
- `python3 scripts/browser-smoke.py`로 Chromium 브라우저 검증을 재현할 수 있습니다. 먼저 정적 서버를 시작하고 `requirements-browser.txt`의 Playwright와 Chromium을 준비합니다. 이 검증의 Supabase HTTP는 합성 응답이며 실제 프로젝트 검증을 대신하지 않습니다. GitHub Pages 배포 주소에서도 기존 탭, 링크 편집·저장·JSON 백업/복원과 자산 화면을 검증합니다.
- 검증이 끝나기 전 실제 증권사 파일을 사용하지 마세요. 데이터 백업/삭제 정책은 Supabase 프로젝트에서 별도로 관리합니다.
