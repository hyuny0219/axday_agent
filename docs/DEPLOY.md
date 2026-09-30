# 무료 웹호스팅 배포 (테스트용)

이 문서는 **테스트·시연용** 배포 절차다. **행사 당일에는 무료 호스팅을 쓰지 않는다.**
무료 플랜은 무접속 시 잠들고(Render), 트래픽·모델 호출 비용에 상한이 있으며, 응답 지연이
현장 요구(스펙의 8초·5초 예산)를 보장하지 않는다. 행사 운영은 로컬 서버(`npm run booth`,
갱신·빌드·기동·모델 연결 확인을 한 번에 묶은 스크립트. README "부스 운영(로컬 서버)" 참고)로
한다.

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
5. **부스 개장 전 모델 연결 확인(T49).** 토큰이 붙은 URL로 접속해 우상단 **운영 → 모델 연결
   확인**을 누른다. "연결됨 · claude-sonnet-5 · ~ms"가 나오면 실제 임원 에이전트가 답하는
   상태다. "실패 · anthropic_api_error 401 …"처럼 나오면 `ANTHROPIC_API_KEY`를 다시 넣고
   재배포하거나, 당장 진행해야 하면 **운영 → scripted로 새 체험**으로 사전 구성 모드로
   돌린다(헤더 배지가 "사전 구성 시뮬레이션"으로 바뀐다). 확인 호출은 10초에 1회만 받는다.
6. 토큰이 유출된 것 같으면 Render 대시보드에서 `ACCESS_TOKEN` 값을 재생성(Regenerate 또는
   값을 직접 새 무작위 문자열로 교체)하고 서비스를 재배포한다. 재생성 즉시 이전 URL의
   `?key=...`는 더는 통하지 않는다.

## 세션 상한

시간당 새 세션(`sessionId`) 수가 `MAX_SESSIONS_PER_HOUR`(기본 30)를 넘으면 서버가 새 세션의
요청을 429 `session_limit`으로 거절한다(`server/sessionLimit.ts`). 등록된 세션도 무제한은
아니다: 마지막 요청 뒤 `SESSION_TTL_MINUTES`(기본 30분) 동안 요청이 없으면 `session_expired`(체험이 시간으로 끝나지 않으므로 첫 요청 기준이 아니라 슬라이딩), 엔드포인트별
호출 상한(라운드 6·최종표 2·정리 2·요약 4, T65 2026-09-30 결정 — 라운드는 OPINIONS·
REACTIONS·FOLLOWUP 기본 3회에 **라운드 단계마다 다시 요청 1회씩**(최대 3회)을 더한
값이다. 화면은 각 단계 버튼을 한 번 누르면 잠그므로 실제 소모량은 부스 상황에 따라
3~6회 사이다. 최종표도 "다시 요청" 1회를 포함한 값이다)을 넘으면 `call_limit`으로
거절한다. 요청 본문은
64KiB를 넘으면 413이다. 이미 시작된 세션은 시간당 상한과 무관하게 계속
진행할 수 있다. 행사 참가자 수에 맞춰 Render 환경변수에서 값을 조정할 수 있다.

## 라운드 타임아웃(T65)

`ROUND_TIMEOUT_MS`(기본 8000, OPINIONS·VOTE·모델 연결 확인 probe)와 `REACTION_TIMEOUT_MS`
(기본 12000, REACTIONS·FOLLOWUP — 프롬프트가 참가자 발언·동료 발언까지 실어 더 길다)로
서버의 임원 호출 타임아웃을 조정할 수 있다. `/api/health` 응답에 두 값이 실려 있어 클라이언트
(`src/services/boardAgents/live.ts`)가 이 값을 읽어 쓴다 — 값을 바꾸면 서버·클라이언트가
함께 새 상한을 따른다. 두 값은 **1 이상 120000 이하의 정수(ms)** 만 유효하고 소수·0·음수·문자열·120000 초과는 기본값으로 돌아간다(요청 스키마의 budgetMs가 정수만 받고, 32비트 타이머 한계를 넘는 값은 즉시 타임아웃이 난다 — PR #11 Codex 26·27차). 부스에서 응답이 자주 느리면(`logs/board-*.jsonl`로 확인) 이 값을
올리기보다 먼저 네트워크·모델 상태를 점검한다.

클라이언트의 fetch abort 타이머는 이 서버 타임아웃값 그대로가 아니라 `TRANSPORT_MARGIN_MS`
(1.5초, `src/services/transport/roundTimeouts.ts`에 하드코딩, `boardAgents/live.ts`가 재export)를
더한 값을 쓴다 — 서버가 자기 타이머로 일부 역할만 실패 처리한 응답을 돌려주기 직전에
클라이언트가 먼저 요청을 끊어버리지 않게 하는 여유다(PR #11 Codex 24차).

`src/services/orchestrator/runner.ts`의 최종표 최초 대기도 같은 두 값을 쓴다(PR #11 Codex
25차 P2): `ROUND_TIMEOUT_MS`(캐시된 `roundTimeoutMs`) + `TRANSPORT_MARGIN_MS`. `ROUND_TIMEOUT_MS`를
8000보다 크게 올리면(행사장 네트워크가 느릴 때) 이 최초 대기도 자동으로 함께 늘어나 늘린
값 안에 도착한 정상 표를 UNCAST로 잘못 확정하지 않는다 — 값을 하드코딩해 두면 서버·표결
대기가 어긋나 이 문제가 재발하므로, 새 타임아웃 관련 상수를 추가할 때도 항상
`getRoundTimeouts()`를 거치게 한다.
