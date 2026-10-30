// T149: DISCUSS는 '발언 정리'를 한 번 해야 '의견 전달'이 열린다. submit-opinion을 누르는 모든
// 흐름이 문구 선택 뒤·전달 전에 이 헬퍼를 부른다(이름은 그대로 두고 동작만 맞췄다). 결과가
// 뜨든 실패·연결 지연 안내가 뜨든 사용으로 세어지므로 둘 중 먼저 보이는 쪽을 닫는다.
import { expect, type Page } from '@playwright/test';

// live 어댑터의 5초 시간 제한 뒤 실패 안내가 뜨는 경우까지 기다린다.
const REFINE_TIMEOUT_MS = 15_000;

export async function tryAllAssistantFeatures(page: Page): Promise<void> {
  await page.getByTestId('assistant-toggle').click();
  // 팝업 없이 바로 내 발언에 적용된다. 정리가 끝나(성공/실패) 의견 전달이 열릴 때까지 기다린다.
  await expect(page.getByTestId('submit-opinion')).toBeEnabled({ timeout: REFINE_TIMEOUT_MS });
}
