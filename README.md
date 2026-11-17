# My Space — 개인 / 업무용 대시보드

다크 미니멀 디자인의 개인용 시작 페이지입니다. **정적 HTML, CSS, JavaScript**로 구성되어 빌드 단계나 별도 서버가 필요 없습니다.

## 포함된 기능

- 개인용 / 업무용 탭
- 개인용: 포털(네이버·구글), AI(ChatGPT·Claude·Gemini), 개발(GitHub·Supabase·Vercel), 개인 제작 사이트 빈 슬롯 5개, 소셜(Gmail·LinkedIn·네이버 카페), 미디어(Netflix·쿠팡플레이·YouTube), 저장소(Google Drive·네이버 MYBOX)
- 업무용: Slack, Google Calendar, Gmail, Google Drive
- 각 사이트 클릭 시 새 탭에서 열기
- 링크 추가·편집·삭제 및 개인 제작 사이트 빈 슬롯 등록
- 사이트/카테고리 실시간 검색 및 Ctrl+K 검색 바로가기
- 우측 상단에서 본인 계정으로 한 번 로그인하면 개인 제작 사이트·프로젝트·내 자산 공통 이용
- 개인 제작 사이트: Supabase 본인 계정으로 기기 간 동기화 (기존 로컬 링크는 첫 로그인 시 이전)
- 나머지 일반 링크: 브라우저의 `localStorage`에 변경 사항 저장
- JSON으로 데이터 백업/복원
- 반응형 레이아웃과 접근 가능한 입력 폼

## 내 컴퓨터에서 실행

`index.html`을 브라우저로 열면 됩니다. 개발용 간이 서버를 원하면 다음을 실행하세요.

```bash
python -m http.server 8000
```

이후 http://localhost:8000 접속.

## GitHub Pages 배포

1. GitHub에서 새 저장소 `my-space-dashboard`를 생성합니다. 기존 프로젝트 저장소와 분리하는 것을 권장합니다.
2. 이 폴더의 **파일을 저장소 루트에** 올립니다. (ZIP 파일 자체를 올리는 게 아니라 압축을 풀어 파일을 업로드)
3. GitHub 저장소 **Settings → Pages → Build and deployment**에서 `Deploy from a branch`를 고르고 `main` 브랜치의 `/ (root)`를 선택합니다.
4. 공개 저장소라면 보통 `https://<username>.github.io/my-space-dashboard/` 형태로 접속합니다. 배포 주소는 GitHub Pages 설정에 표시되는 값을 확인하세요.
5. 이후 `index.html`, `styles.css`, `app.js`를 수정하고 push하면 배포가 갱신됩니다.

CLI를 사용한다면:

```bash
git init
git add .
git commit -m "feat: initial personal dashboard"
git branch -M main
git remote add origin https://github.com/<username>/my-space-dashboard.git
git push -u origin main
```

**중요:** **개인 제작 사이트** 링크는 로그인 후 Supabase에 저장되어 다른 PC에서도 본인 계정으로 로그인하면 표시됩니다. 기존 PC의 저장 링크는 첫 로그인에서 업로드합니다. 자산관리·개인 프로젝트와 같은 본인 계정을 사용하며 세션은 최대 20분 유지됩니다. `supabase/migrations/004_personal_sites.sql`이 서버에 적용되어야 합니다. 포털/AI/개발/업무용 등 나머지 링크는 로컬 저장이므로 다른 PC로 옮기려면 JSON 백업/가져오기를 사용하세요.

**보안:** GitHub Pages에 공개된 파일은 누구나 볼 수 있습니다. 회사 내부 URL, 비밀번호, API 키, 기밀 자료 등을 코드/JSON 파일에 넣어 공개 저장소에 올리지 마세요. `localStorage` 역시 민감정보 저장용이 아닙니다.

## 편집 위치

- `app.js` → `defaults()`에서 초기 카테고리 및 링크 변경
- `app.js` → `CATEGORY_META`에서 카테고리 이름 변경
- `styles.css` → `:root`에서 색상 및 전체 테마 변경
- `index.html` → 기본 레이아웃·메타데이터 변경

## 자산관리 작업 공간

사이드바의 **자산관리**에서 총자산·순자산, 계좌 구성, 투자 포트폴리오, 월별 자산 추이, 주택자금 납부 일정을 확인할 수 있습니다. 초기 화면은 가상 샘플이며 기존 링크 작업 공간은 로그인 없이 사용할 수 있습니다. 자금 확보 시뮬레이터는 포함하지 않습니다.

**우측 상단 로그인**은 개인 제작 사이트·프로젝트·자산관리에 공통 적용됩니다. 한 번 로그인한 뒤 자산관리 탭을 누르면 본인 자산을 조회할 수 있습니다. 세션은 최대 20분이며 새로고침하면 다시 로그인해야 합니다. Supabase 프로젝트에 본인 계정 한 명이 등록되어 있어야 실제 데이터를 사용할 수 있습니다. 금융정보와 증권사 원본 파일은 GitHub에 저장하지 않습니다. 실제 금융정보는 인증·RLS·업로드·배포 검증을 모두 마친 뒤 사용하세요.

- [Supabase 생성·인증·RLS 설정](docs/supabase-setup.md)
- [삼성증권 CSV/XLSX 가져오기 및 GitHub Pages 배포](docs/import-and-deploy.md)
- [개발 계획과 단계별 검증 기록](docs/asset-development-plan.md)

개발 테스트는 Node 22 이상에서 `npm ci && npm test`로 실행합니다. 정적 페이지는 빌드 없이 실행할 수 있고, XLSX Worker를 수정한 경우 `npm run build`로 재생성합니다.

## 라이선스 및 외부 의존성

웹 글꼴은 Google Fonts에서 불러옵니다(네트워크 문제 시 시스템 기본 글꼴 사용). 사이트 이름은 각 서비스 운영사의 상표입니다. 링크로 연결한 외부 서비스의 계정에는 접근하지 않습니다. 자산관리 로그인에는 Supabase Auth를 사용합니다. XLSX 처리 의존성의 라이선스는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 참고하세요.
