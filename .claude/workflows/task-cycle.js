export const meta = {
  name: 'task-cycle',
  description: 'Build one task card from docs/TASKS.md, review it, fix findings, repeat up to maxRounds',
  whenToUse: 'Run one BOARDROOM 2026 task (T01..T24) through builder → reviewer → fix loop. args: {task:"T04", maxRounds:2}',
  phases: [
    { title: 'Build', detail: 'builder implements the card and commits' },
    { title: 'Review', detail: 'reviewer checks acceptance list and runs checks' },
    { title: 'Fix', detail: 'builder resolves must/should findings only' },
  ],
}

const taskId = typeof args === 'string' ? args : args && args.task
if (!taskId || !/^T\d{2}$/.test(taskId)) {
  throw new Error('args.task is required, e.g. {task:"T01", maxRounds:2}')
}
const maxRounds = (args && Number.isInteger(args.maxRounds)) ? args.maxRounds : 2
const buildModel = args && args.buildModel
const reviewModel = args && args.reviewModel
const attribution = (args && args.attribution) || ''

const CARD_CMD = `awk '/^## ${taskId} /{p=1;print;next} /^## T[0-9][0-9] /{p=0} p' docs/TASKS.md`

const REPORT = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'blocked'] },
    summary: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } },
    checks: { type: 'array', items: { type: 'string' } },
    questions: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'summary', 'checks'],
}

const REVIEW = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'FIX', 'BLOCKED'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['must', 'should', 'nit'] },
          file: { type: 'string' },
          line: { type: 'integer' },
          issue: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'file', 'issue', 'fix'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['verdict', 'findings'],
}

const buildOpts = (label, phaseName) => {
  const o = { agentType: 'builder', schema: REPORT, label, phase: phaseName }
  if (buildModel) o.model = buildModel
  return o
}
const reviewOpts = (label) => {
  const o = { agentType: 'reviewer', schema: REVIEW, label, phase: 'Review' }
  if (reviewModel) o.model = reviewModel
  return o
}

phase('Build')
log(`${taskId}: build`)
let build = await agent(
  `Implement task ${taskId}.
Read your task card with: ${CARD_CMD}
Follow .claude/agents/builder.md. Commit with prefix "${taskId}: ".
${attribution ? 'End each commit message body with these lines:\n' + attribution : ''}
Return the report only.`,
  buildOpts(`build:${taskId}`, 'Build'),
)
if (!build) return { task: taskId, status: 'agent-lost', stage: 'build' }
if (build.status === 'blocked') return { task: taskId, status: 'blocked', build }

let review = null
let round = 0
while (true) {
  const prior = review ? `Previous findings to re-check (fix round ${round}): ${JSON.stringify(review.findings)}` : ''
  review = await agent(
    `Review task ${taskId}.
Read the task card with: ${CARD_CMD}
Follow .claude/agents/reviewer.md.
Builder report: ${JSON.stringify({ summary: build.summary, commits: build.commits || [], checks: build.checks })}
${prior}
Return the verdict only.`,
    reviewOpts(`review:${taskId}#${round + 1}`),
  )
  if (!review) return { task: taskId, status: 'agent-lost', stage: 'review', round, build }
  const actionable = review.findings.filter((f) => f.severity !== 'nit')
  if (review.verdict !== 'FIX' || actionable.length === 0 || round >= maxRounds) break

  round += 1
  log(`${taskId}: fix round ${round} (${actionable.length} findings)`)
  build = await agent(
    `Fix round ${round} for task ${taskId}. Fix ONLY these findings, then re-run the card's checks and commit with prefix "${taskId}: ".
Findings: ${JSON.stringify(actionable)}
Read the task card with: ${CARD_CMD}
Follow .claude/agents/builder.md.
${attribution ? 'End each commit message body with these lines:\n' + attribution : ''}
Return the report only.`,
    buildOpts(`fix:${taskId}#${round}`, 'Fix'),
  )
  if (!build) return { task: taskId, status: 'agent-lost', stage: 'fix', round, review }
  if (build.status === 'blocked') return { task: taskId, status: 'blocked', round, build, review }
}

const open = review.findings.filter((f) => f.severity !== 'nit')
return {
  task: taskId,
  status: review.verdict === 'PASS' ? 'pass' : review.verdict === 'BLOCKED' ? 'blocked' : 'needs-attention',
  rounds: round,
  verdict: review.verdict,
  openFindings: open,
  nits: review.findings.filter((f) => f.severity === 'nit'),
  lastBuild: build,
  notes: review.notes || '',
}
