// T14 디자인 검수용 스크린샷. 선택·브리핑·토론·반응·투표·결과 6장을 두 해상도(desktop-1080,
// desktop-720)로 캡처한다. UPDATE_SCREENSHOTS=1 일 때만 아래 경로에 저장하고 평소에는 test-results/에 둔다.
// desktop-720) 프로젝트마다 docs/screenshots/<project>/<screen>.png로 남긴다.
// DESIGN_SPEC.md 6장 "실제 토론은 시나리오의 P1~P6 체크 카드 6개와 300자 입력창을
// 제공하고, 안건 ② 대표 경로의 최종 조건 4개를 모두 표시한다"에 맞춰 실제 콘텐츠
// 분량(추천 문구 6개 표시·직접 입력 300자에 가까운 실문장·확정 조건 4개)을 채운
// 상태에서 캡처한다.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from './fixtures';

// P1~P4 문구를 그대로 이어 붙인 뒤, 실제 이사회 발언처럼 이어지는 문장을 더해
// 300자 제한에 가깝지만 넘지 않는 분량으로 만든다(축약 없이 실제 콘텐츠).
const DRAFT_TEXT =
  '한 게시판에서 먼저 시범 운영합시다. 게시 전 검수 절차를 두고 시작합시다. ' +
  '문제가 생기면 작성자를 확인할 수 있게 해 둡시다. 운영 효과를 측정한 뒤 전사로 넓힙시다. ' +
  '시범 기간에는 게시 건수와 신고 처리 결과를 함께 공유해 신뢰를 쌓고, 확대 여부는 이 기록을 근거로 ' +
  '다음 이사회에서 다시 판단하겠습니다. 신고 처리 담당자를 먼저 지정하고, 로그 보관 기간을 정한 뒤 ' +
  '순차로 넓혀가며 결과를 투명하게 공유하겠습니다.';

// 기본 실행에서는 커밋된 PNG를 덮어쓰지 않도록 임시 폴더에 저장한다.
// 문서용 스크린샷을 갱신할 때만 UPDATE_SCREENSHOTS=1 로 실행한다.
const OUTPUT_ROOT = process.env.UPDATE_SCREENSHOTS
  ? path.join('docs', 'screenshots')
  : path.join('test-results', 'screenshots');

async function capture(page: Page, projectName: string, screenName: string) {
  const dir = path.join(OUTPUT_ROOT, projectName);
  mkdirSync(dir, { recursive: true });
  // 화면 전환(220ms opacity/translate)이 끝난 상태로 캡처한다. 진행 중에 찍으면 반투명한
  // 캡처가 남는다(T38 결과 확인에서 발견).
  // 마운트 직후 캡처하면 screen-enter가 아직 시작되지 않아 반투명하게 남을 수 있어
  // (T40 반응 화면에서 발견) 진행 중인 애니메이션이 끝나기를 먼저 기다린다.
  await page
    .locator('.screen')
    .first()
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await page.screenshot({ path: path.join(dir, `${screenName}.png`), animations: 'disabled' });
}

test('선택·브리핑·임원 의견·토론·반응·투표·결과를 실제 콘텐츠로 채운 상태로 캡처한다', async ({ page }, testInfo) => {
  await page.goto('/?mode=scripted');
  await page.getByRole('button', { name: '체험 시작' }).click();

  // SELECT: 안건 카드 3열 중 활성 안건을 선택한 상태.
  await page.getByTestId('scenario-card-anon-board').click();
  await expect(page.getByTestId('scenario-card-anon-board')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await capture(page, testInfo.project.name, 'select');

  await page.getByRole('button', { name: '이사회 입장' }).click();

  // BRIEFING: 사건·결정 질문·현재 상황/제안/미정·할 일/최종 결정·자료 4장·CTA(T52).
  await expect(page.getByTestId('chair-briefing')).toBeVisible();
  await expect(page.getByTestId('briefing-status')).toBeVisible();
  await expect(page.getByTestId('briefing-role')).toBeVisible();
  await expect(page.getByTestId('evidence-card-E4')).toBeVisible();
  await capture(page, testInfo.project.name, 'briefing');

  await page.getByRole('button', { name: '의견 듣기' }).click();

  // OPINIONS: 임원 4명의 첫 의견 카드(오른쪽)와 무대 말풍선·회의록 패널(왼쪽). 말풍선
  // 등장 애니메이션이 끝난 뒤 캡처한다.
  await expect(page.locator('.opinion-card')).toHaveCount(4);
  await expect(page.getByTestId('minutes-panel')).toBeVisible();
  await capture(page, testInfo.project.name, 'opinions');

  await page.getByRole('button', { name: '내 의견 말하기' }).click();

  // DISCUSS: 추천 문구 6개가 모두 보이는 상태에서 4개(P1~P4)를 선택해 최종 조건
  // 4개(PILOT·SCREEN·TRACE·MEASURE)를 확정하고, 300자에 가까운 직접 입력으로
  // 덮어써 textarea 분량을 함께 보여준다.
  await expect(page.getByTestId('phrase-card-P6')).toBeVisible();
  await page.getByTestId('phrase-card-P1').click();
  await page.getByTestId('phrase-card-P2').click();
  await page.getByTestId('phrase-card-P3').click();
  await page.getByTestId('phrase-card-P4').click();

  const textarea = page.getByTestId('draft-editor-textarea');
  await textarea.fill(DRAFT_TEXT);
  await expect(page.getByTestId('condition-chip-PILOT')).toBeVisible();
  await expect(page.getByTestId('condition-chip-SCREEN')).toBeVisible();
  await expect(page.getByTestId('condition-chip-TRACE')).toBeVisible();
  await expect(page.getByTestId('condition-chip-MEASURE')).toBeVisible();

  const submitOpinion = page.getByTestId('submit-opinion');
  await expect(submitOpinion).toBeEnabled();
  await capture(page, testInfo.project.name, 'discuss');
  await submitOpinion.click();

  // REACTIONS(v0.9, T40): 답글형 임원 반응·"CAIO가 묻습니다" 질문·빠른 답 3개·접힌 직접 입력을
  // 캡처한 뒤, 후속 질문 없이 앞선 의견을 유지해 확정한 4개 조건을 그대로 넘긴다.
  await expect(page.getByRole('heading', { name: '이사님 의견에 대한 반응 — 한 가지만 더 여쭙겠습니다' })).toBeVisible();
  await expect(page.getByTestId('followup-open-editor')).toBeVisible();
  // T45부터는 페이지 자체가 스크롤되지 않아(무스크롤, DESIGN_SPEC.md v1.0 6절) 더는
  // 스크롤을 되돌릴 필요가 없다.
  await capture(page, testInfo.project.name, 'reactions');
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

  // RESULT: 왼쪽 열(게이지+체험 종료 CTA)과 오른쪽 열(결론·5석·기록)이 스크롤 없이
  // 한 화면에 모두 보인다(DESIGN_SPEC.md v1.0 6절 무스크롤). 표결 배지·결론 도장
  // (T43)이 다 나온 뒤에 캡처한다.
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await expect(page.getByTestId('result-seat-PARTICIPANT')).toBeVisible();
  await expect(page.getByTestId('result-stamp')).toBeVisible();
  await page
    .getByTestId('result-stamp')
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await expect(page.getByTestId('end-session')).toBeInViewport();
  await capture(page, testInfo.project.name, 'result');
});
