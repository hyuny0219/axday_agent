// T34 고정 평가 세트 실행기. scripts/eval-set.json(12케이스 = 안건② 네 경로 × 참가자
// 발언 변형 3개)을 server/handlers/round.ts·vote.ts로 직접 실행해 라운드별 비교(전/후)에
// 쓸 원시 기록(jsonl)을 만든다. scripts/live-eval.ts(T32, 4경로×1변형, npm run eval:live의
// 공개 동작)는 건드리지 않는다 — docs/LIVE_EVAL.md가 그 스크립트의 48/144 호출 수를
// 문서화하고 있어서다. 이 스크립트는 별도 산출물이다.
//
// 실행: `npx tsx scripts/eval-set-run.ts --out docs/eval/tuning-v1-before.jsonl`
//   - MODEL_PROVIDER=mock 이면 mock으로 실행한다(modelId는 서버와 같이 항상 'mock-model' —
//     MODEL_ID는 무시. 산출물 행의 modelId만으로 실제 평가와 구별하기 위해서다).
//   - 그 외에는 실제 모델(anthropic) 평가를 시도하고, 키가 없으면 안내 후 종료 코드 0으로
//     스킵한다(scripts/live-eval.ts와 동일한 정책).

import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { CONDITION_IDS, type ExecRoleId } from '../server/validate';

type ConditionId = (typeof CONDITION_IDS)[number];
import { getScenarioMaterials } from '../server/scenario-data';
import { handleRound, type RoundRequest, type RoundRoleResult } from '../server/handlers/round';
import { handleVote, type VoteRequest, type VoteRoleResult } from '../server/handlers/vote';
import { handleProbe } from '../server/handlers/probe';
import { MOCK_MODEL_ID, createMockProvider } from '../server/providers/mock';
import { createAnthropicProvider } from '../server/providers/anthropic';
import type {
  ModelCompleteRequest,
  ModelCompleteResult,
  ModelProvider,
} from '../server/providers/types';
import { DEFAULT_MODEL_ID, PROMPT_VERSION } from '../server/config';

/** 평가 실행에 쓸 제공자·modelId. mock이면 서버(server/index.ts)와 같이 MODEL_ID와 무관하게 항상
 * MOCK_MODEL_ID다 — 예전에는 MODEL_ID 기본값(claude-sonnet-5)을 mock에도 넘겨 mock 실행의 모든
 * JSONL 행이 실제 모델 ID를 달고 나왔고, EvalRow에 provider 필드가 없어 산출물만으로는 실제
 * 평가와 구별할 수 없었다(PR #10 Codex 30차 검토 P2). */
export function resolveEvalModel(env: NodeJS.ProcessEnv): { useMock: boolean; modelId: string } {
  const useMock = env.MODEL_PROVIDER === 'mock';
  return { useMock, modelId: useMock ? MOCK_MODEL_ID : env.MODEL_ID?.trim() || DEFAULT_MODEL_ID };
}
import { systemClock, type Clock } from '../server/clock';

const SCENARIO_ID = 'anon-board';
const BUDGET_MS = 8000;

export interface EvalCase {
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

export interface EvalRow {
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

// --- provider.complete() 계측: handleVote()는 라운드 핸들러와 달리 latencyMs를 돌려주지 않아
// VOTE 행이 전부 0으로 기록됐다(PR #10 Codex 18차 검토 P2). live-eval.ts와 같은 방식으로
// 호출 봉투(kind·roleId)를 읽어 역할별 지연을 기록한다.
export interface CallRecord {
  kind: string;
  roleId?: string;
  latencyMs: number;
  modelId: string;
}

function parseUserEnvelope(user: string): { kind?: string; roleId?: string } {
  try {
    const parsed: unknown = JSON.parse(user);
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      return {
        kind: typeof obj.kind === 'string' ? obj.kind : undefined,
        roleId: typeof obj.roleId === 'string' ? obj.roleId : undefined,
      };
    }
  } catch {
    // envelope가 아니면 무시한다.
  }
  return {};
}

function instrumentProvider(base: ModelProvider, clock: Clock, sink: CallRecord[]): ModelProvider {
  return {
    async complete(req: ModelCompleteRequest): Promise<ModelCompleteResult> {
      const envelope = parseUserEnvelope(req.user);
      const start = clock.now();
      try {
        const result = await base.complete(req);
        sink.push({
          kind: envelope.kind ?? 'unknown',
          roleId: envelope.roleId,
          latencyMs: clock.now() - start,
          modelId: result.modelId,
        });
        return result;
      } catch (err) {
        sink.push({
          kind: envelope.kind ?? 'unknown',
          roleId: envelope.roleId,
          latencyMs: clock.now() - start,
          modelId: '',
        });
        throw err;
      }
    },
  };
}

/** sink[fromIndex..] 가운데 역할별 마지막 호출 기록. */
export function callRecordsByRole(sink: CallRecord[], fromIndex: number): Map<string, CallRecord> {
  const byRole = new Map<string, CallRecord>();
  for (let i = fromIndex; i < sink.length; i += 1) {
    const record = sink[i];
    if (record?.roleId) {
      byRole.set(record.roleId, record);
    }
  }
  return byRole;
}

/**
 * VOTE 행. 역할별 provider 호출 기록이 있으면 그 지연을, 없으면(제공자가 AbortSignal을 무시해
 * handleVote()의 withTimeout()이 먼저 끝난 경우 등) 핸들러가 관측한 대기 시간(observedMs)을 쓴다 —
 * 타임아웃 실패가 0ms로 남으면 즉시 실패로 오인된다(PR #10 Codex 19차 검토 P2).
 */
export function toVoteRows(
  results: VoteRoleResult[],
  evalCase: EvalCase,
  sink: CallRecord[],
  fromIndex: number,
  observedMs: number,
): EvalRow[] {
  const calls = callRecordsByRole(sink, fromIndex);
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
    latencyMs: calls.get(result.roleId)?.latencyMs ?? observedMs,
    modelId: calls.get(result.roleId)?.modelId || result.modelId,
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
  const sink: CallRecord[] = [];
  const voteFrom = sink.length;
  const voteStart = clock.now();
  const voteResults = await handleVote(voteRequest, {
    provider: instrumentProvider(provider, clock, sink),
  });
  const voteObservedMs = clock.now() - voteStart;
  const voteRows = toVoteRows(voteResults, evalCase, sink, voteFrom, voteObservedMs);

  return [...opinionsRows, ...reactionsRows, ...voteRows];
}

function hasAnthropicCredential(): boolean {
  return (
    (process.env.ANTHROPIC_API_KEY ?? '').trim().length > 0 ||
    (process.env.ANTHROPIC_AUTH_TOKEN ?? '').trim().length > 0
  );
}

// --- 문체 검사: 튜닝 항목 (4) "존댓말 종결"을 문자열 몇 개가 아니라 문장 종결 단위로 센다.
// PR #10 Codex 검토 P2: v2 라운드는 "하자/한다/해라" 같은 명시 문자열만 세어 기준선을 3건으로
// 과소 집계했고(실제 187건), after의 0건 판정도 원시 데이터와 어긋났다(실제 1건). 이제 판정
// 근거를 코드로 남긴다. `--check <파일.jsonl>`로 API 호출 없이 기존 기록을 재집계할 수 있다.

/**
 * 존댓말 종결로 인정하는 어미. 합쇼체(-습니다/-니까/-십시오)뿐 아니라 해요체(-해요/-이에요/
 * -예요/-죠 등)도 정상 존댓말이므로 인정한다 — 규칙 문구가 "존댓말(-습니다/-합니다 등)"이지
 * 격식체 한정이 아니다(PR #10 Codex 6차 검토 P2: "괜찮아요."·"필요합니까?"를 위반으로 오집계).
 * 다만 맨끝 "요" 하나만 보고 통과시키지는 않는다 — "…지정 필요."의 명사형 종결(위반)이
 * 해요체로 오인된다. 그래서 해요체는 "-아/-어 + 요"의 음절 구조로 판정한다(아래 isContractedHaeyo).
 */
// -니까는 통째로 두면 "없으니까."(반말 연결형)까지 통과하므로 합쇼체 의문형(-습니까/-ㅂ니까)만
// 인정한다. -ㅂ니까는 앞 음절을 열거할 수 없으므로("책임집니까"·"바꿉니까"·"압니까"·"씁니까")
// 앞 음절의 종성이 ㅂ인지 유니코드로 판정한다(isFormalQuestion, PR #10 Codex 7·8차 검토 P2).
// -ㄴ데요는 자모 'ㄴ'으로 쓰면 완성형 음절("인데요")과 맞지 않으므로 "데요"로 본다.
// 해요체 축약 활용("맡겨요"·"알려요"·"둬요"·"써요")도 앞 음절을 열거할 수 없다(PR #10 Codex 13차
// 검토 P2). -아/-어가 어간과 융합된 음절은 중성이 ㅏ·ㅐ·ㅓ·ㅔ·ㅕ·ㅖ·ㅘ·ㅙ·ㅝ·ㅞ이고 종성이 없으므로
// 유니코드로 판정한다(isContractedHaeyo). "필요"·"중요"·"수요" 같은 명사는 중성이 ㅣ·ㅜ거나 종성이
// 있어 여전히 위반이다. "개요."처럼 중성이 맞는 명사는 통과하지만 임원 발언에서 문장을 그 명사로
// 끝내는 경우는 없었다(기존 기록 재집계 187/1/0 동일).
const HONORIFIC_ENDING = /(니다|십시오|이에요|죠|지요|군요|거든요|데요)$/;

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JONG_BIEUP = 17; // 종성 ㅂ의 인덱스(28진)
// 중성 인덱스(21진): ㅏ0 ㅐ1 ㅓ4 ㅔ5 ㅕ6 ㅖ7 ㅘ9 ㅙ10 ㅝ14 ㅞ15
const JUNG_HAEYO = new Set([0, 1, 4, 5, 6, 7, 9, 10, 14, 15]);

/** 해요체 "-아요/-어요"(축약 포함): 끝이 "요"이고 바로 앞 음절이 종성 없이 위 중성으로 끝나야 한다. */
function isContractedHaeyo(ending: string): boolean {
  if (!ending.endsWith('요') || ending.length < 2) {
    return false;
  }
  const code = ending.codePointAt(ending.length - 2) ?? 0;
  if (code < HANGUL_BASE || code > HANGUL_LAST) {
    return false;
  }
  const offset = code - HANGUL_BASE;
  return offset % 28 === 0 && JUNG_HAEYO.has(Math.floor(offset / 28) % 21);
}

/** 합쇼체 의문형 "-ㅂ니까/-습니까": 끝이 "니까"이고 바로 앞 음절의 종성이 ㅂ이어야 한다. */
function isFormalQuestion(ending: string): boolean {
  if (!ending.endsWith('니까') || ending.length < 3) {
    return false;
  }
  const code = ending.codePointAt(ending.length - 3) ?? 0;
  if (code < HANGUL_BASE || code > HANGUL_LAST) {
    return false;
  }
  return (code - HANGUL_BASE) % 28 === JONG_BIEUP;
}

function isHonorificEnding(ending: string): boolean {
  return HONORIFIC_ENDING.test(ending) || isFormalQuestion(ending) || isContractedHaeyo(ending);
}

/**
 * 문장 끝에 붙은 **인용** 괄호만 종결 판정에서 제외한다 — "…입니다(E3,E4)", "…동의합니다(st-2-op-0,3)".
 * 괄호 안에 자료 ID(E1~)나 발언 ID(st-…/op-…)가 하나라도 있어야 인용으로 본다. 모든 말미 괄호를
 * 제거하면 "검토합니다(권한 확인 필요)."처럼 설명성 괄호에 들어간 금지 종결이 가려진다
 * (PR #10 Codex 2차 검토). 반대로 ID만 정확히 일치하도록 좁히면 "(E3, E4 참조)"·"(op-0~3)" 같은
 * 실제 인용이 위반으로 잘못 잡히므로, ID 포함 여부로 판단한다.
 */
const TRAILING_PAREN = /[([]([^)\]]*)[)\]]\s*$/;
const CITATION_TOKEN = /\bE\d+\b|\b(?:st|op|re)-/i;

export interface StyleViolation {
  line: number;
  caseId: string;
  roleId: string;
  stage: string;
  field: 'message' | 'reason';
  sentence: string;
}

/**
 * 문장 경계: 문장부호 뒤 공백·줄바꿈뿐 아니라 **공백 없이 다음 문장이 붙는 경우**도 나눈다
 * ("권한 확인 필요.검토하겠습니다." → 2문장). 응답 스키마가 이런 문자열을 막지 않으므로 공백을
 * 요구하면 앞 문장의 위반을 놓친다(PR #10 Codex 2차 검토). 소수점(1.5)은 뒤가 숫자라 나뉘지 않는다.
 */
function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?])\s+|\n|(?<=[.!?])(?=[가-힣A-Za-z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 종결 판정에 쓰는 어미 부분: 말미 문장부호와 근거 괄호를 반복 제거한다. */
function sentenceEnding(sentence: string): string {
  let core = sentence.replace(/[.!?\s"']+$/, '');
  for (let prev = ''; prev !== core; ) {
    prev = core;
    const match = TRAILING_PAREN.exec(core);
    if (!match || !CITATION_TOKEN.test(match[1] ?? '')) {
      break;
    }
    core = core.slice(0, match.index).replace(/[.!?\s]+$/, '');
  }
  return core;
}

/** 존댓말로 끝나지 않는 문장을 모두 돌려준다(명사형 종결 "…필요", "…아님"도 위반으로 본다). */
export function findStyleViolations(rows: EvalRow[]): StyleViolation[] {
  const violations: StyleViolation[] = [];
  rows.forEach((row, index) => {
    for (const field of ['message', 'reason'] as const) {
      const text = row[field];
      if (!text) continue;
      for (const sentence of splitSentences(text)) {
        const ending = sentenceEnding(sentence);
        if (ending.length > 0 && !isHonorificEnding(ending)) {
          violations.push({
            line: index + 1,
            caseId: row.caseId,
            roleId: row.roleId,
            stage: row.stage,
            field,
            sentence,
          });
        }
      }
    }
  });
  return violations;
}

function readRows(file: string): EvalRow[] {
  return readFileSync(file, 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as EvalRow);
}

/** `--check` 모드: 기록 파일마다 위반 수를 찍는다(모델 호출 없음). */
function runCheck(files: string[]): void {
  for (const file of files) {
    const rows = readRows(file);
    const violations = findStyleViolations(rows);
    const affectedRows = new Set(violations.map((v) => v.line)).size;
    const promptVersions = [...new Set(rows.map((r) => r.promptVersion))].join(',');
    console.log(
      `[eval-set-run] ${file} · promptVersion=${promptVersions} · ${rows.length}행` +
        ` · 비존댓말 종결 ${violations.length}건(해당 행 ${affectedRows}개)`,
    );
    for (const v of violations) {
      console.log(`    ${v.line} ${v.caseId}/${v.roleId}/${v.stage}.${v.field}: ${v.sentence}`);
    }
  }
}

function parseArgs(argv: string[]): { out: string; check: string[] } {
  let out = '';
  const check: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out' && argv[i + 1] !== undefined) {
      out = argv[i + 1] as string;
      i += 1;
    } else if (argv[i] === '--check' && argv[i + 1] !== undefined) {
      check.push(argv[i + 1] as string);
      i += 1;
    }
  }
  if (!out && check.length === 0) {
    throw new Error('usage: eval-set-run.ts --out <path.jsonl> | --check <path.jsonl> [--check ...]');
  }
  return { out, check };
}

async function main(): Promise<void> {
  const { out, check } = parseArgs(process.argv.slice(2));
  if (check.length > 0) {
    runCheck(check);
    if (!out) {
      return;
    }
  }
  const useMock = process.env.MODEL_PROVIDER === 'mock';

  if (!useMock && !hasAnthropicCredential()) {
    console.log(
      '[eval-set-run] 실제 모델 키가 없어 건너뜁니다. ANTHROPIC_API_KEY 환경변수를 설정하십시오.',
    );
    process.exit(0);
    return;
  }

  const { modelId } = resolveEvalModel(process.env);
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
  runCheck([out]);
}

// 직접 실행할 때만 main()을 돌린다. 테스트가 findStyleViolations()를 import할 때 실행되면 안 된다.
const isDirectRun =
  typeof process.argv[1] === 'string' && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) main().catch((err) => {
  console.error('[eval-set-run] 실행 중 오류:', err);
  process.exitCode = 1;
});
