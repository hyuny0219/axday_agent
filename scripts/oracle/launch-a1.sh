#!/usr/bin/env bash
# Oracle Cloud Always Free ARM(VM.Standard.A1.Flex) 서버를 "재고 없음(Out of host capacity)"이면
# 잠시 쉬었다가 성공할 때까지 다시 만들어 본다.
#
# 준비(사용자가 직접): OCI CLI 설치 → `oci setup config`로 API 키 등록(공개 키를 콘솔
# 사용자 설정 → API 키에 업로드) → 콘솔에서 VCN 마법사로 "인터넷 연결이 있는 VCN" 생성.
#
# 사용법: bash scripts/oracle/launch-a1.sh
#   환경변수(모두 선택):
#     OCPUS=2 MEMORY_GB=12      Always Free ARM 상한(2026-08 기준 2 OCPU·12GB)
#     BOOT_GB=50                부트 볼륨 크기(Always Free 블록 스토리지 합계 200GB 안)
#     NAME=boardroom-a1         서버 이름(같은 이름이 이미 있으면 새로 만들지 않는다)
#     SSH_KEY=~/.ssh/id_ed25519.pub
#     SUBNET_ID=...             비우면 공개 IP를 받을 수 있는 첫 서브넷을 고른다
#     INTERVAL=60               재고 없음일 때 다음 시도까지 기다릴 초(요청 과다면 두 배)
#     NOTIFY=/path/tg.sh        성공·중단 시 한 줄 알림을 보낼 스크립트(인자 1개)
set -uo pipefail

OCPUS="${OCPUS:-2}"
MEMORY_GB="${MEMORY_GB:-12}"
BOOT_GB="${BOOT_GB:-50}"
NAME="${NAME:-boardroom-a1}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519.pub}"
INTERVAL="${INTERVAL:-60}"
NOTIFY="${NOTIFY:-}"
SHAPE="VM.Standard.A1.Flex"

log() { printf '[%s] %s\n' "$(date '+%m-%d %H:%M:%S')" "$*"; }
notify() { log "$1"; [ -n "${NOTIFY}" ] && bash "${NOTIFY}" "$1" >/dev/null 2>&1 || true; }

command -v oci >/dev/null || { log "oci CLI가 없습니다(brew install oci-cli)"; exit 1; }
[ -f "$HOME/.oci/config" ] || { log "~/.oci/config가 없습니다. 먼저 'oci setup config'를 실행하세요"; exit 1; }
[ -f "${SSH_KEY}" ] || { log "SSH 공개 키가 없습니다: ${SSH_KEY}"; exit 1; }

TENANCY="$(awk -F= '/^tenancy[[:space:]]*=/{gsub(/[[:space:]]/,"",$2); print $2; exit}' "$HOME/.oci/config")"
REGION="$(awk -F= '/^region[[:space:]]*=/{gsub(/[[:space:]]/,"",$2); print $2; exit}' "$HOME/.oci/config")"
COMPARTMENT_ID="${COMPARTMENT_ID:-$TENANCY}"
log "리전 ${REGION} · 구획(루트) 확인"

# 이미 만들어진(또는 만드는 중인) 같은 이름의 서버가 있으면 중복 생성하지 않는다.
existing="$(oci compute instance list --compartment-id "${COMPARTMENT_ID}" --display-name "${NAME}" \
  --query "data[?\"lifecycle-state\"!='TERMINATED' && \"lifecycle-state\"!='TERMINATING'].id | [0]" --raw-output 2>/dev/null || true)"
if [ -n "${existing}" ] && [ "${existing}" != "null" ]; then
  log "이미 '${NAME}' 서버가 있습니다: ${existing}"
  exit 0
fi

ADS="$(oci iam availability-domain list --compartment-id "${COMPARTMENT_ID}" --query 'data[].name' --raw-output | tr -d '[]",' | xargs)"
[ -n "${ADS}" ] || { log "가용성 도메인을 읽지 못했습니다(API 키 설정 확인)"; exit 1; }

IMAGE_ID="$(oci compute image list --compartment-id "${COMPARTMENT_ID}" --operating-system "Canonical Ubuntu" \
  --operating-system-version "24.04" --shape "${SHAPE}" --sort-by TIMECREATED --sort-order DESC --limit 1 \
  --query 'data[0].id' --raw-output)"
[ -n "${IMAGE_ID}" ] && [ "${IMAGE_ID}" != "null" ] || { log "Ubuntu 24.04 ARM 이미지를 찾지 못했습니다"; exit 1; }

if [ -z "${SUBNET_ID:-}" ]; then
  SUBNET_ID="$(oci network subnet list --compartment-id "${COMPARTMENT_ID}" \
    --query "data[?\"prohibit-public-ip-on-vnic\"==\`false\`].id | [0]" --raw-output)"
fi
[ -n "${SUBNET_ID}" ] && [ "${SUBNET_ID}" != "null" ] || { log "공개 서브넷이 없습니다. 콘솔에서 VCN 마법사로 '인터넷 연결이 있는 VCN'을 먼저 만드세요"; exit 1; }

log "모양 ${SHAPE} ${OCPUS} OCPU · ${MEMORY_GB}GB · 부트 ${BOOT_GB}GB · 도메인: ${ADS}"
attempt=0
while true; do
  for AD in ${ADS}; do
    attempt=$((attempt + 1))
    out="$(oci compute instance launch --compartment-id "${COMPARTMENT_ID}" --availability-domain "${AD}" \
      --shape "${SHAPE}" --shape-config "{\"ocpus\":${OCPUS},\"memoryInGBs\":${MEMORY_GB}}" \
      --image-id "${IMAGE_ID}" --subnet-id "${SUBNET_ID}" --assign-public-ip true \
      --boot-volume-size-in-gbs "${BOOT_GB}" --display-name "${NAME}" \
      --ssh-authorized-keys-file "${SSH_KEY}" --query 'data.id' --raw-output 2>&1)"
    if [[ "${out}" == ocid1.instance.* ]]; then
      INSTANCE_ID="${out}"
      log "생성 요청 성공(${attempt}번째 시도): ${INSTANCE_ID}"
      oci compute instance get --instance-id "${INSTANCE_ID}" --wait-for-state RUNNING \
        --max-wait-seconds 900 >/dev/null 2>&1 || true
      IP="$(oci compute instance list-vnics --instance-id "${INSTANCE_ID}" --query 'data[0]."public-ip"' --raw-output 2>/dev/null)"
      notify "Oracle ARM 서버 생성 성공(${attempt}번째 시도) · ${REGION} · 공개 IP ${IP:-확인 필요} · ssh ubuntu@${IP:-<IP>}"
      exit 0
    fi
    if grep -qiE 'out of host capacity|InternalError|Out of capacity' <<<"${out}"; then
      wait_s="${INTERVAL}"; why="재고 없음"
    elif grep -qiE 'TooManyRequests|429' <<<"${out}"; then
      wait_s=$((INTERVAL * 2)); why="요청 과다"
    else
      notify "Oracle ARM 생성 중단(${attempt}번째 시도): $(tr '\n' ' ' <<<"${out}" | cut -c1-300)"
      exit 1
    fi
    log "${attempt}번째 시도 · ${AD} · ${why} → ${wait_s}초 뒤 다시"
    sleep "${wait_s}"
  done
done
