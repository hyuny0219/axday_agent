// T97: DISCUSS는 AI 비서실장 세 기능(의견 한눈에 보기·조건 추천·내 발언 정리)을 한 번씩
// 써야 '의견 전달'이 열린다. submit-opinion을 누르는 모든 흐름이 문구 선택 뒤·전달 전에
// 이 헬퍼를 부른다. 결과가 뜨든 실패·연결 지연 안내가 뜨든 "완료" 표시(assistant-done-*)가
// 생기면 다음 기능으로 넘어간다 — 실제 앱의 게이팅 기준과 같다.
import { expect, type Page } from '@playwright/test';

const FEATURES = ['summary', 'compare', 'refine'] as const;
// live 어댑터의 5초 시간 제한 뒤 실패 안내가 뜨는 경우까지 기다린다.
const FEATURE_TIMEOUT_MS = 15_000;

export async function tryAllAssistantFeatures(page: Page): Promise<void> {
  await page.getByTestId('assistant-toggle').click();
  const panel = page.getByTestId('assistant-panel');
  await expect(panel).toBeVisible();

  for (const feature of FEATURES) {
    const mark = page.getByTestId(`assistant-done-${feature}`);
    if (await mark.isVisible()) {
      continue;
    }
    await page.getByTestId(`assistant-action-${feature}`).click();
    await expect(mark).toBeVisible({ timeout: FEATURE_TIMEOUT_MS });
    if (feature === 'refine') {
      // 기존 테스트의 본문 기대값을 바꾸지 않도록 정리한 초안은 적용하지 않는다.
      const keepOriginal = page.getByTestId('assistant-keep-original');
      if (await keepOriginal.isVisible()) {
        await keepOriginal.click();
      }
    }
  }

  await page.getByTestId('assistant-close').click();
  await expect(panel).toBeHidden();
}
