# 다른 PC에서 로컬로 띄우기

BECOME A BOARD를 새 PC(부스 PC·노트북)에 설치해 그 PC에서 띄우는 절차입니다. 인터넷 공개 배포(Render 등)는 [DEPLOY.md](DEPLOY.md)를 보세요.

## 1. 미리 준비할 것

| 항목 | 내용 |
|---|---|
| Node.js | **22 이상**. https://nodejs.org 에서 LTS 설치 후 `node -v`로 확인 |
| Git | Mac은 기본 설치(없으면 `xcode-select --install`), Windows는 **Git for Windows**(Git Bash 포함) https://git-scm.com/install/windows |
| API 키 | Anthropic API 키(`sk-ant-…`). 실제 AI 임원(live)을 쓸 때만 필요. 없으면 사전 구성(scripted)으로만 동작 |
| 인터넷 | 설치·갱신과 live 모드에 필요. scripted만 쓸 때는 설치 뒤 인터넷 없이도 동작 |
| 화면 | 1920×1080 또는 1280×720 권장(그 밖의 크기는 자동으로 맞춤) |

## 2. 처음 설치 (한 번만)

```bash
git clone https://github.com/hyuny0219/axday_agent.git
cd axday_agent
```

**어느 브랜치를 쓸지** — `main`이 기본입니다. 아직 main에 합치지 않은 최신 작업(예: 열린 PR)을 띄워야 하면 그 브랜치로 바꿉니다.

```bash
git checkout main                       # 기본
# git checkout claude/night-2026-10-07  # 최신 통합 브랜치를 띄울 때
```

**API 키 파일** — 저장소 맨 위에 `.env` 파일을 만들고 한 줄을 넣습니다. 이 파일은 git에 올라가지 않으니 PC마다 직접 만듭니다. 키를 다른 곳(채팅·문서·스크린샷)에 붙이지 마세요.

```
ANTHROPIC_API_KEY=sk-ant-여기에키
```

## 3. 띄우기

### Mac

```bash
npm run booth
```

한 번에 갱신(`git pull`) → 설치(`npm ci`, 바뀐 경우만) → 빌드 → 서버 기동 → 모델 연결 확인까지 합니다. 성공하면 이렇게 나옵니다.

```
[booth] LIVE · claude-sonnet-5 · 1953ms
[booth] 참가자 화면: http://localhost:8787/
```

인터넷이 없거나 갱신하고 싶지 않으면:

```bash
npm run booth -- --skip-pull
```

> `npm run booth`는 갱신 단계에서 **`main`을 받아 옵니다**(`git pull --ff-only origin main`). 다른 브랜치를 띄웠다면 `--skip-pull`로 실행하세요.

### Windows

`npm run booth`는 bash 스크립트라 **Git Bash** 창에서 실행합니다(시작 메뉴 → Git Bash → `cd` 로 저장소 폴더 이동 → `npm run booth`).

PowerShell에서 직접 띄우려면 아래 순서로 합니다. **`MODEL_PROVIDER`를 빼먹으면 실제 AI 대신 가짜 응답(mock)으로 돌아가니** 꼭 넣으세요.

```powershell
npm ci
npm run build
$env:ANTHROPIC_API_KEY="sk-ant-여기에키"; $env:MODEL_PROVIDER="anthropic"; npm start
```

키 없이(scripted만) 띄울 때:

```powershell
npm ci
npm run build
npm run preview -- --port 8787
# 같은 와이파이의 다른 기기에서도 보려면: npm run preview -- --port 8787 --host 0.0.0.0
```

### 접속

- 그 PC 브라우저(Chrome 권장)에서 **http://localhost:8787/**
- 같은 와이파이의 다른 기기에서 보려면 **http://<그 PC의 IP>:8787/** (Mac: 시스템 설정 → 네트워크, Windows: `ipconfig`). 처음 실행할 때 방화벽 허용 창이 뜨면 "허용"을 누릅니다.
  - 이 주소는 **API 키가 있는 live 서버**(`npm run booth` 또는 `npm start`)일 때 됩니다. 키 없이 띄운 사전 구성(scripted) 정적 서버는 기본으로 그 PC 안에서만 받습니다 — PowerShell 명령에 `--host 0.0.0.0`을 붙인 경우에만 다른 기기에서 열립니다(`npm run booth`의 키 없는 경로는 그 PC 전용).

## 4. 시작 전 점검

1. 화면 오른쪽 위 **운영 → 모델 연결 확인** → "연결됨 · claude-sonnet-5 · …ms"가 나오면 실제 AI가 답하는 상태입니다. 실패하면 키를 확인하거나 **운영 → scripted로 새 체험**으로 사전 구성 모드로 진행합니다.
2. **운영 → 소리**: BGM(기본 랜덤)·효과음·음량. 부스가 시끄러우면 BGM 20~30.
3. 전체화면: Windows **F11** 또는 **Ctrl+Shift+F**, Mac **Command+Shift+K**, 나올 때 **Esc**. 전체화면에서는 운영 버튼이 숨으니 설정은 먼저 해 둡니다.
4. 진행 방법은 [FACILITATOR_GUIDE.md](FACILITATOR_GUIDE.md)를 보세요.

## 5. 끄기·다시 띄우기·갱신

- 끄기: 서버를 띄운 터미널에서 **Ctrl+C**.
- 다시 띄우기: 위 3번을 그대로 반복합니다.
- 코드 갱신: Mac/Git Bash는 `npm run booth`가 알아서 받아 옵니다. PowerShell은 `git pull` 뒤 `npm ci`·`npm run build`·`npm start`를 다시 합니다.

## 6. 자주 막히는 곳

| 증상 | 원인과 해결 |
|---|---|
| `[booth] 포트 8787가 이미 사용 중` | 이전 서버가 남아 있습니다. 그 터미널에서 Ctrl+C, 또는 Mac `lsof -nP -iTCP:8787 -sTCP:LISTEN`로 PID 확인 후 종료. 다른 포트로 띄우려면 `.env`에 `PORT=9000` |
| `[booth] 작업 트리에 손댄 파일이 있어 중단` | 저장소 파일을 고친 상태입니다. `git status`로 확인하고 되돌리거나(`git checkout -- <파일>`) 필요한 변경이면 따로 보관하세요 |
| 모델 연결 확인 실패 `401` | API 키가 틀렸습니다. `.env`의 키 확인 |
| 모델 연결 확인 실패 `credit balance is too low` | Anthropic 계정 크레딧이 바닥났습니다. Plans & Billing에서 충전(반영까지 1분 안팎) |
| 화면에 임원이 "미리 써 둔 대사"로만 답함 | 키 없이 띄웠거나 PowerShell에서 `MODEL_PROVIDER=anthropic`을 빠뜨렸습니다 |
| `node: command not found` 또는 버전 오류 | Node 22 이상을 설치하고 터미널을 새로 엽니다 |
| 소리가 안 남 | 브라우저는 첫 클릭 전에는 소리를 막습니다. '체험 시작'을 누른 뒤부터 납니다. 운영 → 소리에서 꺼져 있지 않은지 확인 |

## 7. 기록

서버는 호출마다 한 줄씩 `logs/board-<날짜>.jsonl`에 남깁니다(참가자·임원 발언 본문과 키는 남기지 않습니다). 응답 실패를 나중에 확인할 때 씁니다.
