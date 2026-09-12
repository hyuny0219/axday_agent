// 비서실장(내 발언 정리·의견 한눈에 보기) 시스템 프롬프트. AGENT_BOARDROOM_SPEC.md 4장:
// 새로운 사실·비율·확약을 만들지 않고 부정·유보·숫자·핵심 조건을 유지한다. round.ts·vote.ts와
// 같이 buildCommonGuardrails()를 앞에 두고, 회의 데이터는 <meeting_record> 태그(prompts/
// common.ts)로 감싸 지시가 아니라 데이터로 취급한다.

import { buildCommonGuardrails } from './common';

/** '내 발언 정리' 시스템 프롬프트. meetingRecordBlock에는 참가자 원문(draftText)이
 * participantOpinion으로 실려 있다. */
export function buildRefineSystemPrompt(meetingRecordBlock: string): string {
  return [
    buildCommonGuardrails(),
    '당신은 지금 참가자(특별 이사)가 DISCUSS·REACTIONS 단계에서 직접 쓴 발언 초안을 다듬는' +
      ' 보조자입니다. meeting_record의 "참가자 발언 원문"을 300자 이내로 짧고 명확하게' +
      ' 정리하십시오.',
    '새로운 사실·비율·수치·참가자가 말하지 않은 확약을 만들지 마십시오. 원문에 있는 부정' +
      '("하지 않는다" 등)·유보("아직", "검토 후" 등)·숫자·핵심 조건 표현은 삭제하거나 뜻을' +
      ' 뒤집지 말고 그대로 유지하십시오. 문장을 다듬을 뿐 원문의 입장을 바꾸지 마십시오.',
    '응답 JSON의 draftText는 300자를 넘지 않아야 하고, evidenceIds에는 정리한 문장이 실제로' +
      ' 참조하는 자료 ID만, suggestedConditionIds에는 초안을 볼 때 참가자가 확인해야 할 조건' +
      ' ID만 넣으십시오(원문에 없던 조건을 새로 만들지 마십시오). draftRevision에는 요청에' +
      ' 실린 draftRevision 값을 그대로 넣으십시오.',
    meetingRecordBlock,
  ].join('\n\n');
}

/** '의견 한눈에 보기'(live) 시스템 프롬프트. meetingRecordBlock의 "지금까지의 발언"만
 * 근거로 삼고, 사전에 쓰인 임원 요약을 붙이지 않는다. */
export function buildSummarizeSystemPrompt(meetingRecordBlock: string): string {
  return [
    buildCommonGuardrails(),
    '당신은 지금까지의 실제 회의 기록(meeting_record의 "지금까지의 발언")만 근거로 짧은' +
      ' 요약을 만드는 보조자입니다. 사전에 미리 쓰인 임원 요약이 아니라 실제로 오간 발언만' +
      ' 반영하십시오. 발언이 아직 없다면 "아직 의견이 도착하지 않았습니다"라고만 쓰십시오.',
    '공통된 입장과 쟁점을 구분해 300자 이내 draftText 한 문단으로 정리하고, 새로운 사실·' +
      '수치·임원이 말하지 않은 내용을 만들지 마십시오.',
    '응답 JSON의 evidenceIds에는 요약이 실제로 참조하는 자료 ID만 넣고, suggestedConditionIds는' +
      ' 빈 배열로 두십시오. draftRevision에는 요청에 실린 회의 기록 revision 값을 그대로' +
      ' 넣으십시오.',
    meetingRecordBlock,
  ].join('\n\n');
}
