// T14 디자인 검수용 스크린샷. 선택·토론·투표·결과 4장을 두 해상도(desktop-1080,
// desktop-720)로 캡처한다. UPDATE_SCREENSHOTS=1 일 때만 아래 경로에 저장하고 평소에는 test-results/에 둔다.
// desktop-720) 프로젝트마다 docs/screenshots/<project>/<screen>.png로 남긴다.
// DESIGN_SPEC.md 6장 "실제 토론은 시나리오의 P1~P6 체크 카드 6개와 300자 입력창을
// 제공하고, 안건 ② 대표 경로의 최종 조건 4개를 모두 표시한다"에 맞춰 실제 콘텐츠
// 분량(추천 문구 6개 표시·직접 입력 300자에 가까운 실문장·확정 조건 4개)을 채운
// 상태에서 캡처한다.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

// P1~P4 문구를 그대로 이어 붙인 뒤, 실제 이사회 발언처럼 이어지는 문장을 더해
// 300자 제한에 가깝지만 넘지 않는 분량으로 만든다(축약 없이 실제 콘텐츠).
const DRAFT_TEXT =
  '주간 보고 초안부터 작은 범위로 시작합시다. 출처와 기준일을 표시하고 담당자가 검토한 뒤 공유합시다. ' +
  '사용자 권한과 공유 범위를 확인한 자료만 사용합시다. 준비시간과 수정량을 확인한 뒤 확대합시다. ' +
  '파일럿 기간에는 매주 처리 건수와 수정 비율을 함께 공유해 신뢰를 쌓고, 확대 여부는 이 데이터를 근거로 ' +
  '다음 이사회에서 다시 판단하겠습니다. 권한이 확인되지 않은 부서 자료는 이번 파일럿 범위에서 제외하고, ' +
  '검토 담당자 지정과 접근 로그 확인을 먼저 마친 뒤 순차로 넓혀가며 결과를 투명하게 공유하겠습니다.';

// 기본 실행에서는 커밋된 PNG를 덮어쓰지 않도록 임시 폴더에 저장한다.
// 문서용 스크린샷을 갱신할 때만 UPDATE_SCREENSHOTS=1 로 실행한다.
const OUTPUT_ROOT = process.env.UPDATE_SCREENSHOTS
  ? path.join('docs', 'screenshots')
  : path.join('test-results', 'screenshots');

async function capture(page: Page, projectName: string, screenName: string) {
  const dir = path.join(OUTPUT_ROOT, projectName);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${screenName}.png`) });
}

test('선택·토론·투표·결과를 실제 콘텐츠로 채운 상태로 캡처한다', async ({ page }, testInfo) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();

  // SELECT: 안건 카드 3열 중 활성 안건을 선택한 상태.
  await page.getByTestId('scenario-card-ai-assistant').click();
  await expect(page.getByTestId('scenario-card-ai-assistant')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await capture(page, testInfo.project.name, 'select');

  await page.getByRole('button', { name: '이사회 입장' }).click();
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 말하기' }).click();

  // DISCUSS: 추천 문구 6개가 모두 보이는 상태에서 4개(P1~P4)를 선택해 최종 조건
  // 4개(PILOT·REVIEW·ACCESS·MEASURE)를 확정하고, 300자에 가까운 직접 입력으로
  // 덮어써 textarea 분량을 함께 보여준다.
  await expect(page.getByTestId('phrase-card-P6')).toBeVisible();
  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('phrase-card-P2').click();
  await page.getByTestId('phrase-card-P3').click();
  await page.getByTestId('phrase-card-P4').click();

  const textarea = page.getByTestId('draft-editor-textarea');
  await textarea.fill(DRAFT_TEXT);
  await expect(page.getByTestId('condition-chip-PILOT')).toBeVisible();
  await expect(page.getByTestId('condition-chip-REVIEW')).toBeVisible();
  await expect(page.getByTestId('condition-chip-ACCESS')).toBeVisible();
  await expect(page.getByTestId('condition-chip-MEASURE')).toBeVisible();

  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await capture(page, testInfo.project.name, 'discuss');
  await submitOpinion.click();

  // REACTIONS: 후속 질문 없이 앞선 의견을 유지해 확정한 4개 조건을 그대로 넘긴다.
  await expect(page.getByRole('heading', { name: '임원들의 반응' })).toBeVisible();
  await page.getByTestId('followup-option-2').click();

  // MOTION: 확정 조건 4개가 반영된 최종 안건으로 표결을 건다.
  await expect(page.getByTestId('motion-card')).toBeVisible();
  await expect(page.getByTestId('motion-conditions')).toBeVisible();
  await page.getByTestId('freeze-motion').click();

  // VOTE: 안건 카드 아래 3열 radio와 별도 확정 CTA가 함께 보이는 초기 상태를 캡처한다.
  await expect(page.getByTestId('vote-motion-card')).toBeVisible();
  await capture(page, testInfo.project.name, 'vote');

  await page.getByTestId('vote-radio-YES').check();
  const confirmVote = page.getByTestId('confirm-vote');
  await expect(confirmVote).toBeEnabled();
  await confirmVote.click();

  // RESULT: 5석·내 의견·기록까지 합치면 한 화면보다 길어질 수 있어, 체험 종료
  // CTA를 스크롤로 보이게 한 뒤 캡처해 CTA가 잘리지 않는 상태를 확인한다.
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-seat-PARTICIPANT')).toBeVisible();
  await page.getByTestId('end-session').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('end-session')).toBeInViewport();
  await capture(page, testInfo.project.name, 'result');
});
