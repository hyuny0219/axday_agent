// T149: DISCUSS는 '발언 정리'를 한 번 해야 '의견 전달'이 열린다. submit-opinion을 누르는 모든
// 흐름이 문구 선택 뒤·전달 전에 이 헬퍼를 부른다(이름은 그대로 두고 동작만 맞췄다). 결과가
// 뜨든 실패·연결 지연 안내가 뜨든 사용으로 세어지므로 둘 중 먼저 보이는 쪽을 닫는다.
import { expect, type Page } from '@playwright/test';

// live 어댑터의 5초 시간 제한 뒤 실패 안내가 뜨는 경우까지 기다린다.
const REFINE_TIMEOUT_MS = 15_000;

export async function tryAllAssistantFeatures(page: Page): Promise<void> {
  await page.getByTestId('assistant-toggle').click();
  const panel = page.getByTestId('assistant-panel');
  await expect(panel).toBeVisible();

  const keepOriginal = page.getByTestId('assistant-keep-original');
  const failure = page.getByTestId('assistant-error');
  await expect(keepOriginal.or(failure)).toBeVisible({ timeout: REFINE_TIMEOUT_MS });
  if (await keepOriginal.isVisible()) {
    // 기존 테스트의 본문 기대값을 바꾸지 않도록 정리한 초안은 적용하지 않는다('원문 유지'는 팝업을 닫는다).
    await keepOriginal.click();
  } else {
    await page.getByTestId('assistant-close').click();
  }
  await expect(panel).toBeHidden();
}
