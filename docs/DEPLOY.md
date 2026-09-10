# 무료 웹호스팅 배포 (테스트용)

이 문서는 **테스트·시연용** 배포 절차다. **행사 당일에는 무료 호스팅을 쓰지 않는다.**
무료 플랜은 무접속 시 잠들고(Render), 트래픽·모델 호출 비용에 상한이 있으며, 응답 지연이
현장 요구(스펙의 8초·5초 예산)를 보장하지 않는다. 행사 운영은 로컬 서버(`npm run server`
또는 `npm start`)로 한다.

두 가지 배포 대상이 있다.

- **GitHub Pages**: scripted(데모) 전용 정적 배포. 서버가 없으므로 임원 4명 live 판단·실제
  내 발언 정리는 쓸 수 없다.
- **Render 무료 웹서비스**: 서버 + 클라이언트를 한 URL로 배포하는 live 배포. 접속 토큰과
  세션 상한으로 공개 URL 남용을 막는다.

## GitHub Pages (scripted 전용)

1. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로
   설정한다.
2. `.github/workflows/pages.yml`을 `main`에 push하거나, **Actions** 탭에서 `Pages`
   워크플로를 **Run workflow**(workflow_dispatch)로 직접 실행한다.
3. 워크플로가 `VITE_BASE=/<저장소 이름>/ npm run build`로 빌드하고
   `actions/deploy-pages`로 올린다.
4. 완료되면 `https://<owner>.github.io/<저장소 이름>/` 형태의 URL이 생긴다. 서버가 없으므로
   `/api/health`가 애초에 없고, 화면은 항상 scripted 배지로 시작한다.

## Render (live, 접속 토큰 필요)

1. Render 대시보드에서 **New → Blueprint**를 선택하고 이 저장소를 연결한다.
   `render.yaml`이 자동으로 서비스 설정(`type: web`, `plan: free`, `buildCommand`,
   `startCommand: npm start`, `healthCheckPath: /api/health`)을 읽어온다.
2. 배포 전 환경변수를 입력한다.
   - `ANTHROPIC_API_KEY`: 실제 모델 호출에 쓸 키(`sync: false`라 Render가 직접 입력을
     요구한다). **저장소에는 절대 넣지 않는다.**
   - `ACCESS_TOKEN`: `generateValue: true`라 Render가 배포 시 무작위 값을 자동 생성한다.
     Render 대시보드 **Environment** 탭에서 생성된 값을 복사해 둔다.
   - 나머지(`MODEL_PROVIDER=anthropic`, `MODEL_ID=claude-sonnet-5`,
     `MAX_SESSIONS_PER_HOUR=30`, `NODE_VERSION=22`)는 `render.yaml`에 이미 고정돼 있다.
3. 배포가 끝나면 서비스 URL(`https://<서비스>.onrender.com`)이 생긴다. 참가자에게는
   토큰이 붙은 URL을 준다.

   ```
   https://<서비스>.onrender.com/?key=<ACCESS_TOKEN 값>
   ```

   클라이언트가 `?key=...`를 읽어 `sessionStorage`에 저장하고 주소창에서 지운 뒤, 이후
   모든 API 요청에 `x-access-token` 헤더로 실어 보낸다(`src/services/transport/accessToken.ts`).
   토큰 없이 접속하면 `/api/health`가 `mode:'scripted'`를 내려줘 화면은 자동으로
   scripted로 시작한다(체험 자체는 막지 않는다).

4. **무료 플랜은 15분 무접속 시 잠든다.** 깨어나는 데 30~60초 걸릴 수 있으므로, 테스트
   전에 먼저 헬스체크 URL(`https://<서비스>.onrender.com/api/health`)을 브라우저나
   `curl`로 한 번 열어 서버를 깨워 둔 뒤에 본 URL을 연다.
5. 토큰이 유출된 것 같으면 Render 대시보드에서 `ACCESS_TOKEN` 값을 재생성(Regenerate 또는
   값을 직접 새 무작위 문자열로 교체)하고 서비스를 재배포한다. 재생성 즉시 이전 URL의
   `?key=...`는 더는 통하지 않는다.

## 세션 상한

시간당 새 세션(`sessionId`) 수가 `MAX_SESSIONS_PER_HOUR`(기본 30)를 넘으면 서버가 새 세션의
요청을 429로 거절한다(`server/sessionLimit.ts`). 이미 시작된 세션은 상한과 무관하게 계속
진행할 수 있다. 행사 참가자 수에 맞춰 Render 환경변수에서 값을 조정할 수 있다.
