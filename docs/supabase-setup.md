# Supabase 연결 (사용자가 진행할 외부 작업)

프로젝트가 없어도 자산관리의 **샘플 보기**와 기존 개인용/업무용/AI 사무실은 사용할 수 있습니다. 프로젝트가 만들어지기 전에는 실제 로그인·호스팅 DB·네트워크·RLS의 종단 간 검증이 완료된 상태가 아닙니다. 전체 검증이 끝날 때까지 실제 금융정보를 사용하지 마세요.

## 프로젝트와 본인 계정

1. Supabase 대시보드에서 새 프로젝트를 생성합니다. DB 비밀번호는 비밀 저장소에 보관하고 저장소·채팅·브라우저 코드에 넣지 않습니다.
2. Authentication → Users에서 본인의 이메일 계정 하나를 생성하고 이메일 확인 및 강한 비밀번호를 설정합니다. 자동 가입(Allow new users to sign up)은 비활성화합니다. 앱은 가입·OAuth·인증 리디렉션을 사용하지 않는 이메일/비밀번호 방식입니다. Auth 사용자의 UUID를 복사합니다.
3. SQL Editor에서 `supabase/migrations/001_assets.sql`, `002_import_holdings.sql`을 순서대로 실행합니다. 두 번째 파일은 업로드 기능 단계에서 추가됩니다. 마이그레이션은 한 번만 실행하며, 실패 시 트랜잭션 전체가 롤백되는지 확인합니다.
4. 다음 SQL의 UUID를 본인 Auth 사용자 UUID로 바꿔 **SQL Editor에서만** 실행합니다. 실제 UUID를 저장소에 커밋할 필요가 없습니다.

   ```sql
   insert into private.asset_owner(singleton, user_id)
   values (true, '본인-Auth-사용자-UUID'::uuid)
   on conflict (singleton) do update set user_id = excluded.user_id;
   ```

   허용 사용자는 DB에 한 명만 등록할 수 있습니다. 등록되지 않은 인증 사용자는 모든 금융 테이블에서 0행을 보며 쓰기도 거부됩니다. 등록을 비우면 모두 차단됩니다. `private` 스키마는 Data API의 exposed schemas에 추가하지 않습니다. RLS는 `asset_accounts`, `asset_holdings`, `asset_snapshots`, `asset_payments`, `asset_imports`에 적용됩니다.

## 공개 연결 정보

프로젝트 Settings → API에서 프로젝트 URL과 **publishable 키**(또는 legacy anon 키)를 확인합니다. 이 키는 공개 클라이언트용이며 RLS가 실제 접근 권한을 제한합니다. **secret / service_role 키는 앱에서 절대 사용하지 않습니다.**

- 간단한 연결: 자산관리 → 내 자산 로그인 → Supabase 공개 연결 설정에서 URL과 공개 키를 입력합니다. 공개 정보만 이 브라우저의 localStorage에 저장됩니다. 비밀번호·access token·refresh token·금융 데이터는 localStorage에 저장하지 않습니다.
- 공용 기본 설정: `assets/public-config.mjs`에 공개 URL/키만 지정할 수도 있습니다. CI 배포 시에는 GitHub repository variables `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`로 아티팩트에 주입할 수 있습니다. 저장소에 비밀 키를 넣지 마세요.
- 네트워크가 제한된 클라우드에서는 실제 프로젝트의 `<project-ref>.supabase.co`를 환경 설정의 허용 도메인에 추가해야 합니다. 프로젝트가 없으므로 현재는 특정 호스트가 등록되지 않았습니다.

로그인은 자산관리 화면에서 사용자가 요청할 때만 실행합니다. Auth의 `/user` 확인과 `asset_access_allowed` RPC가 모두 성공한 뒤에만 금융 테이블을 읽습니다. access token은 메모리에만 유지하며 최대 1시간 후 잠깁니다. 새로고침하면 다시 로그인합니다. 로그아웃/만료 시 보유 데이터와 업로드 미리보기를 화면에서 지우고 진행 중인 요청을 취소합니다. 공유 기기에서는 사용 후 로그아웃하고 브라우저를 닫으세요.

## 검증과 운영 전 확인

- `npm ci && npm test`: 합성 Auth 응답을 사용하는 인증 경계 및 PGlite(PostgreSQL 엔진)의 실제 RLS 정책 테스트. Supabase의 네트워크/GoTrue 설정을 대신 검증하지 않습니다.
- 본인 계정으로 빈 DB 접속 → 합성 계좌·납부일정 생성 → 합성 업로드 → 대시보드 갱신을 확인합니다.
- 관리자 도구로 만든 다른 합성 테스트 사용자는 접근 거부되어야 합니다. anon 키만으로 금융 테이블 읽기/쓰기/RPC도 거부되어야 합니다.
- 로그아웃 직후/세션 만료/응답 지연 중 탭 이동에서 이전 금융 데이터가 다시 표시되지 않는지 확인합니다.
- `python3 scripts/browser-smoke.py`로 Chromium 브라우저 검증을 재현할 수 있습니다. 먼저 정적 서버를 시작하고 `requirements-browser.txt`의 Playwright와 Chromium을 준비합니다. 이 검증의 Supabase HTTP는 합성 응답이며 실제 프로젝트 검증을 대신하지 않습니다. GitHub Pages 배포 주소에서도 기존 탭, 링크 편집·저장·JSON 백업/복원과 자산 화면을 검증합니다.
- 검증이 끝나기 전 실제 증권사 파일을 사용하지 마세요. 데이터 백업/삭제 정책은 Supabase 프로젝트에서 별도로 관리합니다.
