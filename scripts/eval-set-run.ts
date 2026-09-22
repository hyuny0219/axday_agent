// T34 고정 평가 세트 실행기. scripts/eval-set.json(12케이스 = 안건② 네 경로 × 참가자
// 발언 변형 3개)을 server/handlers/round.ts·vote.ts로 직접 실행해 라운드별 비교(전/후)에
// 쓸 원시 기록(jsonl)을 만든다. scripts/live-eval.ts(T32, 4경로×1변형, npm run eval:live의
// 공개 동작)는 건드리지 않는다 — docs/LIVE_EVAL.md가 그 스크립트의 48/144 호출 수를
// 문서화하고 있어서다. 이 스크립트는 별도 산출물이다.
//
// 실행: `npx tsx scripts/eval-set-run.ts --out docs/eval/tuning-v1-before.jsonl`
//   - MODEL_PROVIDER=mock 이면 mock으로 실행한다.
//   - 그 외에는 실제 모델(anthropic) 평가를 시도하고, 키가 없으면 안내 후 종료 코드 0으로
//     스킵한다(scripts/live-eval.ts와 동일한 정책).

import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { CONDITION_IDS, type ExecRoleId } from '../server/validate';

type ConditionId = (typeof CONDITION_IDS)[number];
import { getScenarioMaterials } from '../server/scenario-data';
import { handleRound, type RoundRequest, type RoundRoleResult } from '../server/handlers/round';
import { handleVote, type VoteRequest, type VoteRoleResult } from '../server/handlers/vote';
import { handleProbe } from '../server/handlers/probe';
import { createMockProvider } from '../server/providers/mock';
import { createAnthropicProvider } from '../server/providers/anthropic';
import type { ModelProvider } from '../server/providers/types';
import { DEFAULT_MODEL_ID, PROMPT_VERSION } from '../server/config';
import { systemClock, type Clock } from '../server/clock';

const SCENARIO_ID = 'ai-assistant';
const BUDGET_MS = 8000;

interface EvalCase {
  id: string;
  pathId: string;
  pathLabel: string;
  variant: string;
  effectiveConditionIds: ConditionId[];
  participantOpinion: string;
}

interface EvalSetFile {
  scenarioId: string;
  cases: EvalCase[];
}

function loadEvalSet(): EvalCase[] {
  const filePath = path.resolve(import.meta.dirname, 'eval-set.json');
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as EvalSetFile;
  if (parsed.scenarioId !== SCENARIO_ID) {
    throw new Error(`eval-set.json scenarioId mismatch: ${parsed.scenarioId}`);
  }
  return parsed.cases;
}

interface EvalRow {
  caseId: string;
  pathId: string;
  pathLabel: string;
  variant: string;
  stage: 'OPINIONS' | 'REACTIONS' | 'VOTE';
  roleId: ExecRoleId;
  status: 'answered' | 'failed';
  failReason?: string;
  vote?: string;
  reason?: string;
  message?: string;
  evidenceIds?: string[];
  referencedStatementIds?: string[];
  concernCount?: number;
  latencyMs: number;
  modelId: string;
  promptVersion: string;
}

function toRoundRows(
  results: RoundRoleResult[],
  evalCase: EvalCase,
  stage: 'OPINIONS' | 'REACTIONS',
): EvalRow[] {
  return results.map((result) => ({
    caseId: evalCase.id,
    pathId: evalCase.pathId,
    pathLabel: evalCase.pathLabel,
    variant: evalCase.variant,
    stage,
    roleId: result.roleId,
    status: result.status,
    failReason: result.failReason,
    message: result.statement?.message,
    evidenceIds: result.statement?.evidenceIds,
    referencedStatementIds: result.statement?.referencedStatementIds,
    concernCount: result.statement?.concerns.length,
    latencyMs: result.latencyMs,
    modelId: result.modelId,
    promptVersion: result.promptVersion,
  }));
}

function toVoteRows(results: VoteRoleResult[], evalCase: EvalCase): EvalRow[] {
  return results.map((result) => ({
    caseId: evalCase.id,
    pathId: evalCase.pathId,
    pathLabel: evalCase.pathLabel,
    variant: evalCase.variant,
    stage: 'VOTE',
    roleId: result.roleId,
    status: result.status,
    failReason: result.failReason,
    vote: result.ballot?.vote,
    reason: result.ballot?.reason,
    evidenceIds: result.ballot?.evidenceIds,
    latencyMs: 0,
    modelId: result.modelId,
    promptVersion: result.promptVersion,
  }));
}

async function runCase(
  evalCase: EvalCase,
  provider: ModelProvider,
  clock: Clock,
): Promise<EvalRow[]> {
  const materials = getScenarioMaterials(SCENARIO_ID);
  if (!materials) {
    throw new Error(`unknown_scenario:${SCENARIO_ID}`);
  }
  const sessionId = `evalset-${evalCase.id}`;

  const opinionsRequest: RoundRequest = {
    sessionId,
    requestId: randomUUID(),
    mode: 'live',
    stage: 'OPINIONS',
    transcript: { revision: 0, statements: [] },
    scenarioId: SCENARIO_ID,
    budgetMs: BUDGET_MS,
  };
  const opinionsResults = await handleRound(opinionsRequest, { provider, clock });
  const opinionsRows = toRoundRows(opinionsResults, evalCase, 'OPINIONS');

  const opinionsStatements = opinionsResults
    .filter((r) => r.status === 'answered' && r.statement)
    .map((r, idx) => ({
      id: `st-${evalCase.id}-op-${idx}`,
      roleId: r.roleId,
      message: r.statement!.message,
    }));

  const reactionsRequest: RoundRequest = {
    sessionId,
    requestId: randomUUID(),
    mode: 'live',
    stage: 'REACTIONS',
    transcript: { revision: 1, statements: opinionsStatements },
    participantOpinion: evalCase.participantOpinion,
    scenarioId: SCENARIO_ID,
    budgetMs: BUDGET_MS,
  };
  const reactionsResults = await handleRound(reactionsRequest, { provider, clock });
  const reactionsRows = toRoundRows(reactionsResults, evalCase, 'REACTIONS');

  const reactionsStatements = reactionsResults
    .filter((r) => r.status === 'answered' && r.statement)
    .map((r, idx) => ({
      id: `st-${evalCase.id}-re-${idx}`,
      roleId: r.roleId,
      message: r.statement!.message,
    }));

  const voteRequest: VoteRequest = {
    sessionId,
    requestId: randomUUID(),
    mode: 'live',
    scenarioId: SCENARIO_ID,
    budgetMs: BUDGET_MS,
    transcript: { revision: 2, statements: [...opinionsStatements, ...reactionsStatements] },
    motion: {
      id: `evalset-motion-${evalCase.id}`,
      hash: `evalset-hash-${evalCase.id}`,
      text: materials.originalMotionText,
      effectiveConditionIds: evalCase.effectiveConditionIds,
      executionMode: 'DEFAULT',
    },
  };
  const voteResults = await handleVote(voteRequest, { provider });
  const voteRows = toVoteRows(voteResults, evalCase);

  return [...opinionsRows, ...reactionsRows, ...voteRows];
}

function hasAnthropicCredential(): boolean {
  return (
    (process.env.ANTHROPIC_API_KEY ?? '').trim().length > 0 ||
    (process.env.ANTHROPIC_AUTH_TOKEN ?? '').trim().length > 0
  );
}

function parseArgs(argv: string[]): { out: string } {
  let out = '';
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out' && argv[i + 1] !== undefined) {
      out = argv[i + 1] as string;
      i += 1;
    }
  }
  if (!out) {
    throw new Error('usage: eval-set-run.ts --out <path.jsonl>');
  }
  return { out };
}

async function main(): Promise<void> {
  const { out } = parseArgs(process.argv.slice(2));
  const useMock = process.env.MODEL_PROVIDER === 'mock';

  if (!useMock && !hasAnthropicCredential()) {
    console.log(
      '[eval-set-run] 실제 모델 키가 없어 건너뜁니다. ANTHROPIC_API_KEY 환경변수를 설정하십시오.',
    );
    process.exit(0);
    return;
  }

  const modelId = process.env.MODEL_ID?.trim() || DEFAULT_MODEL_ID;
  const providerName = useMock ? 'mock' : 'anthropic';
  const provider = useMock ? createMockProvider(modelId) : createAnthropicProvider({ modelId });

  const probe = await handleProbe({ provider, config: { provider: providerName, modelId }, clock: systemClock });
  if (!probe.ok) {
    console.error(`[eval-set-run] 연결 확인 실패: ${probe.error ?? 'unknown'}`);
    process.exit(1);
    return;
  }
  console.log(`[eval-set-run] 연결 확인 OK · ${probe.modelId} · ${probe.latencyMs}ms`);

  const cases = loadEvalSet();
  const allRows: EvalRow[] = [];
  for (const evalCase of cases) {
    const rows = await runCase(evalCase, provider, systemClock);
    allRows.push(...rows);
    console.log(`[eval-set-run] ${evalCase.id} 완료 (${rows.length}건)`);
  }

  writeFileSync(out, allRows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
  console.log(`[eval-set-run] provider=${providerName} modelId=${modelId} promptVersion=${PROMPT_VERSION} rows=${allRows.length}`);
  console.log(`[eval-set-run] 기록 파일: ${out}`);
}

main().catch((err) => {
  console.error('[eval-set-run] 실행 중 오류:', err);
  process.exitCode = 1;
});
