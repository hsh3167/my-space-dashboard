# My Space — 개인 / 업무용 대시보드

다크 미니멀 디자인의 개인용 시작 페이지입니다. **정적 HTML, CSS, JavaScript**로 구성되어 빌드 단계나 별도 서버가 필요 없습니다.

## 포함된 기능

- 개인용 / 업무용 탭
- 개인용: 포털(네이버·구글), AI(ChatGPT·Claude·Gemini), 개발(GitHub·Supabase·Vercel), 개인 제작 사이트 빈 슬롯 5개, 소셜(Gmail·LinkedIn·네이버 카페), 미디어(Netflix·쿠팡플레이·YouTube), 저장소(Google Drive·네이버 MYBOX)
- 업무용: Slack, Google Calendar, Gmail, Google Drive
- 각 사이트 클릭 시 새 탭에서 열기
- 링크 추가·편집·삭제 및 개인 제작 사이트 빈 슬롯 등록
- 사이트/카테고리 실시간 검색 및 Ctrl+K 검색 바로가기
- 브라우저의 `localStorage`에 변경 사항 저장
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

**중요:** `localStorage`로 저장한 사용자 맞춤 링크는 해당 브라우저에만 반영됩니다. 다른 PC와 자동 동기화되지 않고, GitHub 저장소 파일도 자동으로 변경되지 않습니다. 기기 간 이동은 JSON 백업/불러오기를 사용하세요. 추후 계정 연동과 자동 동기화가 필요해지면 Supabase 등 백엔드를 추가할 수 있습니다.

**보안:** GitHub Pages에 공개된 파일은 누구나 볼 수 있습니다. 회사 내부 URL, 비밀번호, API 키, 기밀 자료 등을 코드/JSON 파일에 넣어 공개 저장소에 올리지 마세요. `localStorage` 역시 민감정보 저장용이 아닙니다.

## 편집 위치

- `app.js` → `defaults()`에서 초기 카테고리 및 링크 변경
- `app.js` → `CATEGORY_META`에서 카테고리 이름 변경
- `styles.css` → `:root`에서 색상 및 전체 테마 변경
- `index.html` → 기본 레이아웃·메타데이터 변경

## 라이선스 및 외부 의존성

자체 제작 데모. 웹 글꼴은 Google Fonts에서 불러옵니다(네트워크 문제 시 시스템 기본 글꼴 사용). 사이트 이름은 각 서비스 운영사의 상표입니다. 사용자 계정에 접근하는 기능은 포함하지 않습니다.
