# axday_agent

삼성화재 AX Day 2026 · BOARDROOM 2026: 4분 이사회

참가자는 특별 이사로 가상 임원 4명과 토론하고 마지막에 한 표를 행사합니다. 현재 저장소는 기획·디자인·개발 인계 자료이며 앱 구현 전입니다.

## Claude Code 시작점

[CLAUDE_IMPLEMENTATION.md](CLAUDE_IMPLEMENTATION.md)를 읽고 안건 ② 프로토타입부터 구현합니다. 문서 마지막의 시작 프롬프트를 그대로 전달할 수 있습니다.

- [기획서 v0.6](AX_Day_2026_Boardroom_Plan.md)
- [안건 ① 상세 시나리오·표결 분기](docs/SCENARIO_CUSTOMER_SUPPORT.md)
- [안건 ③ 상세 시나리오·표결 분기](docs/SCENARIO_PREVENTION.md)
- [안건 ② 상세 시나리오·표결 분기](docs/SCENARIO_AI_ASSISTANT.md)
- [디자인 명세·화면 이미지](docs/design/DESIGN_SPEC.md)
- [CSS 디자인 토큰](docs/design/tokens.css)
- [개정 PPT · 16장](docs/reference/AX_Day_2026_Boardroom_Proposal.pptx)

## 반드시 유지할 체험

토론은 추천 문구 복수 선택 또는 직접 입력·수정 → 의견 전달 → 임원 반응입니다. 투표는 최종 안건 확인 이후 마지막에만 합니다. CFO·CAIO는 한 사람이며 참가자를 포함해 총 5석입니다.

모든 안건·인물·자료·의결 규칙은 체험용 가상 설정입니다. 이미지들은 AI로 생성된 콘셉트 목업이며 실제 서비스 캡처나 실제 임원 사진이 아닙니다.

2026-09-09 검토 반영: AI 자동 정리 상시 표시, 찬성·반대 양방향 결정 경로, 세 안건 구조화, 무입력90초 복귀와 현장 검수 기준. 최신 구현 지시서는 v1.3입니다. PPT·이미지는 시각 레퍼런스이며 최신 문서의 동작·수량·비실사 아바타 기준을 우선합니다.

현장 입력 확정(2026-09-09): 기본 조작은 PC 마우스 한 번 클릭입니다. 직접 입력은 물리 키보드를 사용하며 추천 문구만으로도 완주합니다. 이전 터치 키보드·롱프레스 필수 요건은 대체되었고 운영 메뉴는 화면의 ‘운영’ 버튼 클릭으로 엽니다.

최신 v0.6: [검토 반영표](docs/REVISION_DECISIONS_v0.6.md) · [진행 요원 가이드](docs/FACILITATOR_GUIDE.md) · [규칙 검증](docs/VALIDATION_v0.6.md). 안건③은 원안 기본절차를 유지한 확대/선검증 판단으로 개정했습니다. 기존 PPT·result.png는 v0.5 시각 참고로만 보존하며 표결 숫자를 최신 예시로 사용하지 않습니다.
