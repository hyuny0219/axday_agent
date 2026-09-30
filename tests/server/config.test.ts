// server/config.ts: 타임아웃 환경변수는 양의 정수만 받고, 아니면 기본값(PR #11 Codex 26차).
import { describe, expect, it } from 'vitest';
import { DEFAULT_REACTION_TIMEOUT_MS, DEFAULT_ROUND_TIMEOUT_MS, loadConfig } from '../../server/config';

describe('loadConfig 타임아웃 환경변수', () => {
  it('양의 정수는 그대로 쓴다', () => {
    const cfg = loadConfig({ ROUND_TIMEOUT_MS: '9000', REACTION_TIMEOUT_MS: '15000' } as NodeJS.ProcessEnv);
    expect(cfg.roundTimeoutMs).toBe(9000);
    expect(cfg.reactionTimeoutMs).toBe(15000);
  });

  it('소수·0·음수·문자열은 기본값으로 돌아간다(요청 스키마 budgetMs가 정수만 받는다)', () => {
    for (const bad of ['8000.5', '0', '-1', 'abc', '']) {
      const cfg = loadConfig({ ROUND_TIMEOUT_MS: bad, REACTION_TIMEOUT_MS: bad } as NodeJS.ProcessEnv);
      expect(cfg.roundTimeoutMs, `ROUND_TIMEOUT_MS=${bad}`).toBe(DEFAULT_ROUND_TIMEOUT_MS);
      expect(cfg.reactionTimeoutMs, `REACTION_TIMEOUT_MS=${bad}`).toBe(DEFAULT_REACTION_TIMEOUT_MS);
    }
  });
});
