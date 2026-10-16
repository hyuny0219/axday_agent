// T128 소리: 코드 합성이라 실제 음은 들을 수 없으므로 AudioContext 생성 시점·오실레이터 시작 수·콘솔 오류로
// 확인한다. 운영 메뉴 '소리' 구역 조작·설정 기억·1080/720 무스크롤도 함께 본다.

import { test, expect, type Page } from './fixtures';
import { tryAllAssistantFeatures } from './helpers/assistant';

declare global {
  interface Window {
    __audio: { contexts: number; oscillators: number };
  }
}

async function instrument(page: Page, stored?: object) {
  await page.addInitScript((settings) => {
    window.__audio = { contexts: 0, oscillators: 0 };
    const Original = window.AudioContext;
    class Counting extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        window.__audio.contexts += 1;
      }
    }
    window.AudioContext = Counting;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args: [number?]) {
      window.__audio.oscillators += 1;
      return start.apply(this, args);
    };
    if (settings && !localStorage.getItem('boardroom.sound.v2')) {
      localStorage.setItem('boardroom.sound.v2', JSON.stringify(settings));
    }
  }, stored ?? null);
}

const audioState = (page: Page) => page.evaluate(() => window.__audio);

async function noPageScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement!;
    return { v: el.scrollHeight - el.clientHeight, h: el.scrollWidth - el.clientWidth };
  });
  expect(overflow.v).toBeLessThanOrEqual(1);
  expect(overflow.h).toBeLessThanOrEqual(1);
}

test('첫 클릭 전에는 AudioContext가 없고, 끝까지 가도 하나만 쓰며 콘솔 오류가 없다', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await instrument(page);
  await page.goto('/?mode=scripted&coach=off');
  expect((await audioState(page)).contexts).toBe(0);

  await page.getByRole('button', { name: '체험 시작' }).click();
  await expect.poll(async () => (await audioState(page)).oscillators).toBeGreaterThan(0);
  expect((await audioState(page)).contexts).toBe(1);

  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();
  await page.getByTestId('phrase-card-P1').click();
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();
  await page.getByTestId('keep-previous-answer').click();
  await page.getByTestId('freeze-motion').click();
  await page.getByTestId('vote-radio-YES').check();
  await page.getByTestId('confirm-vote').click();
  await expect(page.getByTestId('result-conclusion')).toBeVisible();
  await page.getByTestId('result-finish').click();
  await expect(page.getByTestId('ending')).toBeVisible();
  await page.getByTestId('ending-home').click();
  await expect(page.getByRole('heading', { name: 'BECOME A BOARD' })).toBeVisible();

  expect((await audioState(page)).contexts).toBe(1);
  expect(errors).toEqual([]);
});

test('운영 메뉴 소리 구역: 곡 고르기·끄기·효과음 토글·음량이 기억되고 스크롤이 생기지 않는다', async ({ page }) => {
  await instrument(page);
  await page.goto('/?mode=scripted&coach=off');
  await page.getByTestId('operator-menu-button').click();
  await page.getByTestId('operator-sound').click();
  await expect(page.getByTestId('operator-sound-panel')).toBeInViewport({ ratio: 1 });
  await noPageScroll(page);
  await expect(page.getByTestId('operator-bgm-random')).toBeChecked(); // T130: 기본은 랜덤

  await page.getByTestId('operator-bgm-piano').check();
  await page.getByTestId('operator-sfx-on').uncheck();
  await page.getByTestId('operator-bgm-volume').fill('20');
  await expect(page.getByTestId('operator-sfx-volume')).toBeDisabled();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('boardroom.sound.v2') ?? '{}'));
  expect(saved).toMatchObject({ bgm: 'piano', sfxOn: false, bgmVolume: 20 });

  await page.reload();
  await page.getByTestId('operator-menu-button').click();
  await page.getByTestId('operator-sound').click();
  await expect(page.getByTestId('operator-bgm-piano')).toBeChecked();
  await expect(page.getByTestId('operator-sfx-on')).not.toBeChecked();
  await expect(page.getByTestId('operator-bgm-volume')).toHaveValue('20');
  await page.getByTestId('operator-bgm-off').check();
  await page.getByTestId('operator-sound-back').click();
  await expect(page.getByTestId('operator-menu-panel')).toBeVisible();
});

test('지난 화면 보기에서는 버튼 클릭음만 나고 전환음은 없다', async ({ page }) => {
  await instrument(page, { bgm: 'off', bgmVolume: 45, sfxOn: true, sfxVolume: 80 });
  await page.goto('/?mode=scripted&coach=off');
  await page.getByRole('button', { name: '체험 시작' }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByTestId('scenario-card-ai-approval').click();
  await page.getByTestId('open-evidence').click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '의견 듣기' }).click();
  await page.getByRole('button', { name: '내 의견 쓰러 가기' }).click();
  await page.getByTestId('discuss-side-for').click();
  await page.getByTestId('phrase-card-P1').click();
  await tryAllAssistantFeatures(page);
  await page.getByTestId('submit-opinion').click();
  await expect(page.getByTestId('reactions-advance')).toBeVisible();
  await page.waitForTimeout(800);

  const before = (await audioState(page)).oscillators;
  await page.getByTestId('view-prev').click();
  await expect(page.getByTestId('view-banner')).toBeVisible();
  await page.waitForTimeout(800);
  // 이전 버튼 클릭음(오실레이터 1개)만 허용한다. 도착음이면 2개 이상 늘어난다.
  expect((await audioState(page)).oscillators - before).toBeLessThanOrEqual(1);
});
