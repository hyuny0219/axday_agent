#!/usr/bin/env bash
# 부스 PC 갱신·기동(T60). main에 새 PR이 병합될 때마다 부스 PC에서 손으로 반복하던
# git pull → npm ci → npm run build → 기동 → 모델 연결 확인을 한 번에 묶는다.
# 서버(server/config.ts)는 .env를 읽지 않으므로 키를 셸에 export하는 것도 이 스크립트가
# 맡는다.
#
# 사용법: npm run booth [-- --skip-pull]
#   --skip-pull  부스 회선이 없을 때, 이미 받아 둔 코드로 git pull 없이 기동한다.
#
# 키가 있으면 live 서버(npm start)를 띄우고 실제 모델 probe(POST /api/ops/probe)로 인증까지
# 확인한 뒤에만 LIVE라고 안내한다. 키가 없으면 API 없는 정적 서버(vite preview)만 띄운다 —
# 화면은 /api/health가 없으니 자동으로 scripted(사전 구성)로 시작하고, mock 제공자가 LIVE
# 배지를 달고 답하는 일이 없다(PR #11 Codex 검토 P1: /api/health의 mode는 ACCESS_TOKEN
# 승인 여부만 반영하고 모델 키 유효성과 무관하다).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

SKIP_PULL=""
for arg in "$@"; do
  case "${arg}" in
    --skip-pull)
      SKIP_PULL=1
      ;;
    *)
      echo "[booth] 알 수 없는 옵션: ${arg}" >&2
      exit 1
      ;;
  esac
done

echo "[booth] 1/6 환경 읽기"
# .env는 source하지 않는다. 잘못된 줄(예: `KEY= 값`)을 셸이 명령으로 실행해 값이 오류
# 메시지로 stderr에 찍힌다(PR #11 Astra 검토). KEY=VALUE 꼴의 줄만 데이터로 읽어 export하고,
# 값은 어떤 로그에도 쓰지 않는다. PORT도 여기서 읽으므로 확인 주소는 이 뒤에 계산한다.
load_env_file() {
  local file="$1" line key value
  while IFS= read -r line || [ -n "${line}" ]; do
    line="${line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"
    case "${line}" in
      '' | '#'*) continue ;;
    esac
    line="${line#export }"
    if [[ "${line}" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      # 앞 공백을 걷어낸 뒤: 따옴표로 시작하면 짝이 맞는 따옴표까지만 값이고 그 뒤는 버린다
      # (따옴표 안의 #은 보존). 따옴표가 없으면 공백 뒤 #부터를 인라인 주석으로 보고 잘라낸
      # 뒤 뒤 공백을 걷어낸다(`PORT=9000 # booth`, `KEY=sk-... # local`, PR #11 Codex 2차).
      value="${value#"${value%%[![:space:]]*}"}"
      if [[ "${value}" =~ ^\"([^\"]*)\" ]] || [[ "${value}" =~ ^\'([^\']*)\' ]]; then
        value="${BASH_REMATCH[1]}"
      else
        value="${value%%[[:space:]]#*}"
        if [[ "${value}" == '#'* ]]; then value=""; fi
        value="${value%"${value##*[![:space:]]}"}"
      fi
      export "${key}=${value}"
    else
      echo "[booth] .env에 KEY=VALUE 꼴이 아닌 줄이 있어 건너뛴다(값은 표시하지 않는다)" >&2
    fi
  done <"${file}"
}
if [ -f .env ]; then
  load_env_file .env
fi
PORT="${PORT:-8787}"
BASE_URL="http://localhost:${PORT}"
HAS_KEY=""
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  HAS_KEY=1
  # 키의 글자는 한 자도 찍지 않는다 — 길이와 접두어 여부만 안내한다.
  if [[ "${ANTHROPIC_API_KEY}" == sk-ant-* ]]; then KEY_PREFIX="sk-ant- 접두어 있음"; else KEY_PREFIX="sk-ant- 접두어 없음(형식 확인 필요)"; fi
  echo "[booth] ANTHROPIC_API_KEY 있음(길이 ${#ANTHROPIC_API_KEY}, ${KEY_PREFIX})"
else
  echo "[booth] 키 없음 → API 없는 정적 서버만 띄워 scripted(사전 구성)로 운영한다"
fi

echo "[booth] 2/6 작업 트리 검사"
DIRTY="$(git status --porcelain)"
if [ -n "${DIRTY}" ]; then
  echo "[booth] 작업 트리에 손댄 파일이 있어 중단한다(자동으로 되돌리거나 stash하지 않는다):" >&2
  echo "${DIRTY}" >&2
  exit 1
fi

echo "[booth] 3/6 갱신"
if [ -n "${SKIP_PULL}" ]; then
  echo "[booth] --skip-pull: git pull 생략"
else
  git pull --ff-only origin main
fi

echo "[booth] 4/6 의존성"
# 마지막으로 설치에 성공한 package-lock.json 해시를 node_modules 안에 남겨 두고 비교한다.
# HEAD 변화나 디렉터리 유무로 판단하면, npm ci가 중간에 실패해 불완전한 node_modules가
# 남았을 때 다음 실행이 설치를 건너뛴다(PR #11 Astra 검토).
LOCK_HASH="$(node -e "const c=require('crypto'),f=require('fs');process.stdout.write(c.createHash('sha256').update(f.readFileSync('package-lock.json')).digest('hex'))")"
LOCK_STAMP="node_modules/.booth-lockfile-sha256"
if [ -d node_modules ] && [ -f "${LOCK_STAMP}" ] && [ "$(cat "${LOCK_STAMP}")" = "${LOCK_HASH}" ]; then
  echo "[booth] package-lock.json이 마지막 설치 성공 시점과 같음 → npm ci 생략"
else
  echo "[booth] node_modules 없음 또는 package-lock.json 변경 → npm ci"
  npm ci
  printf '%s' "${LOCK_HASH}" >"${LOCK_STAMP}"
fi

echo "[booth] 5/6 빌드"
npm run build

echo "[booth] 6/6 기동·확인"
# npm이 실제 서버 프로세스(tsx server/index.ts)를 자식으로 fork하므로, 종료 시 npm의
# PID만 죽이면 서버가 고아로 남는다. `set -m`으로 백그라운드 잡을 별도 프로세스 그룹으로
# 두고, 그룹 전체(음수 PID)에 신호를 보내 정리한다(offline-check.sh와 같은 원칙 — 종료 시
# 자식 프로세스를 남기지 않는다).
set -m
SERVER_PID=""
cleanup() {
  if [ -n "${SERVER_PID}" ] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill -TERM "-${SERVER_PID}" 2>/dev/null || kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

json_field() {
  # stdin의 JSON에서 필드 하나를 문자열로 꺼낸다(없거나 JSON이 아니면 빈 문자열).
  node -e "
let d='';
process.stdin.on('data',(c)=>{d+=c;});
process.stdin.on('end',()=>{
  try { const v=JSON.parse(d)['$1']; process.stdout.write(v==null?'':String(v)); }
  catch { process.stdout.write(''); }
});
"
}

if [ -n "${HAS_KEY}" ]; then
  MODEL_PROVIDER="${MODEL_PROVIDER:-anthropic}" npm start &
  SERVER_PID=$!
  READY_URL="${BASE_URL}/api/health"
else
  node_modules/.bin/vite preview --port "${PORT}" --strictPort &
  SERVER_PID=$!
  READY_URL="${BASE_URL}/"
fi

READY=""
for _ in $(seq 1 20); do
  if curl -fsS -o /dev/null "${READY_URL}" 2>/dev/null; then
    READY=1
    break
  fi
  sleep 1
done
if [ -z "${READY}" ]; then
  echo "[booth] ${READY_URL}가 20초 안에 응답하지 않는다" >&2
  exit 1
fi

if [ -n "${HAS_KEY}" ]; then
  # /api/health의 mode는 모델 키를 검증하지 않는다. 실제 모델에 짧은 호출 1회(운영 메뉴
  # "모델 연결 확인"과 같은 probe)를 보내 인증까지 확인한 뒤에만 LIVE라고 안내한다.
  # ACCESS_TOKEN이 설정된 운영 환경이면 /api/ops/*도 토큰을 요구한다(server/auth.ts) — probe에
  # 같은 헤더를 싣는다(PR #11 Codex 2차). 토큰 값은 로그에 찍지 않는다.
  PROBE_AUTH=()
  if [ -n "${ACCESS_TOKEN:-}" ]; then
    PROBE_AUTH=(-H "x-access-token: ${ACCESS_TOKEN}")
  fi
  # 빈 배열을 "${arr[@]}"로 펼치면 bash 4.4 미만(macOS 기본 3.2)에서 set -u에 걸린다 — ${arr[@]+"${arr[@]}"} 꼴로 쓴다.
  PROBE_BODY="$(curl -sS -X POST -H 'content-type: application/json' ${PROBE_AUTH[@]+"${PROBE_AUTH[@]}"} -d '{}' "${BASE_URL}/api/ops/probe" 2>/dev/null || true)"
  PROBE_OK="$(printf '%s' "${PROBE_BODY}" | json_field ok)"
  if [ "${PROBE_OK}" = "true" ]; then
    echo "[booth] LIVE · $(printf '%s' "${PROBE_BODY}" | json_field modelId) · $(printf '%s' "${PROBE_BODY}" | json_field latencyMs)ms"
  else
    PROBE_ERR="$(printf '%s' "${PROBE_BODY}" | json_field error)"
    echo "[booth] 모델 인증 실패: ${PROBE_ERR:-응답 없음}" >&2
    echo "[booth] 서버를 내린다. .env의 ANTHROPIC_API_KEY를 고쳐 다시 실행하거나, 키를 지우고 실행하면 scripted로 기동한다" >&2
    exit 1
  fi
else
  echo "[booth] SCRIPTED(사전 구성) · 정적 서버 · 모델 호출 없음"
fi

# ACCESS_TOKEN이 설정돼 있으면 참가자 URL에 ?key=<토큰>이 있어야 live로 열린다(docs/DEPLOY.md).
# 토큰은 참가자에게 건네는 값이므로 URL에 그대로 보여주되, 값 자체는 따로 찍지 않는다.
if [ -n "${HAS_KEY}" ] && [ -n "${ACCESS_TOKEN:-}" ]; then
  # 토큰에 + & # 같은 쿼리 예약 문자가 있으면 브라우저가 다르게 해석하므로 percent-encode한다
  # (PR #11 Codex 3차). 클라이언트는 URLSearchParams.get('key')로 디코딩해 원문을 쓴다.
  TOKEN_ENC="$(ACCESS_TOKEN="${ACCESS_TOKEN}" node -e 'process.stdout.write(encodeURIComponent(process.env.ACCESS_TOKEN))')"
  echo "[booth] 참가자 화면: ${BASE_URL}/?key=${TOKEN_ENC}  (ACCESS_TOKEN 설정됨 — 이 주소로만 live)"
else
  echo "[booth] 참가자 화면: ${BASE_URL}/"
fi
if [ -n "${HAS_KEY}" ]; then
  echo "[booth] 개장 전 운영 메뉴 → 모델 연결 확인을 한 번 더 누른다"
fi

wait "${SERVER_PID}"
