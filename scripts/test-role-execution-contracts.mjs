import { readFileSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const teamDocs = Array.from({ length: 15 }, (_, index) => {
  const prefix = String(index).padStart(2, '0');
  const names = {
    '00': 'operating-model',
    '01': 'architect-team-charter',
    '02': 'backend-implementer-charter',
    '03': 'frontend-implementer-charter',
    '04': 'worker-charter',
    '05': 'worktree-and-branch-rules',
    '06': 'handoff-template',
    '07': 'task-assignment-template',
    '08': 'integrated-lead-charter',
    '09': 'development-routing-contract',
    '10': 'research-operations-routing-contract',
    '11': 'delegation-and-result-contract',
    '12': 'integrated-completion-report-template',
    '13': 'shared-role-execution-contract',
    '14': 'review-execution-contract',
  };
  return `docs/team/${prefix}-${names[prefix]}.md`;
});
const files = ['AGENTS.md', ...teamDocs];
const contents = new Map(files.map((file) => [file, readFileSync(resolve(root, file), 'utf8')]));
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function findCycles(graph) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];

  function visit(node) {
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      cycles.push([...stack.slice(start), node].join(' -> '));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const target of graph.get(node) ?? []) visit(target);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) visit(node);
  return [...new Set(cycles)];
}

const literalGraph = new Map(files.map((file) => [file, new Set()]));
let literalEdges = 0;
for (const [file, content] of contents) {
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of content.matchAll(linkPattern)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, '');
    if (/^(?:https?:|mailto:|#)/i.test(rawTarget)) continue;
    const pathPart = rawTarget.split('#', 1)[0];
    if (!pathPart) continue;
    const absoluteTarget = resolve(root, dirname(file), decodeURIComponent(pathPart));
    let isFile = false;
    try {
      isFile = statSync(absoluteTarget).isFile();
    } catch {
      failures.push(`${file}: broken relative Markdown link ${rawTarget}`);
      continue;
    }
    if (!isFile) {
      failures.push(`${file}: relative Markdown link is not a file ${rawTarget}`);
      continue;
    }
    if (extname(absoluteTarget).toLowerCase() !== '.md') continue;
    const target = relative(root, absoluteTarget).replaceAll('\\', '/');
    if (literalGraph.has(target)) {
      literalGraph.get(file).add(target);
      literalEdges += 1;
    }
  }
}
const literalCycles = findCycles(literalGraph);
for (const cycle of literalCycles) failures.push(`literal Markdown graph cycle: ${cycle}`);

const normativeEdges = [
  ['01', '00'], ['01', '13'], ['01', '14'],
  ['02', '00'], ['02', '13'],
  ['03', '00'], ['03', '13'],
  ['04', '00'], ['04', '13'],
  ['05', '13'],
  ['06', '11'], ['06', '13'],
  ['07', '11'], ['07', '13'],
  ['08', '00'], ['08', '11'], ['08', '13'],
  ['09', '11'], ['09', '13'], ['09', '14'],
  ['10', '11'], ['10', '13'], ['10', '14'],
  ['12', '11'], ['12', '13'], ['12', '14'],
  ['13', '11'],
  ['14', '11'], ['14', '13'],
];
const normativeGraph = new Map();
for (const [from, to] of normativeEdges) {
  if (!normativeGraph.has(from)) normativeGraph.set(from, new Set());
  if (!normativeGraph.has(to)) normativeGraph.set(to, new Set());
  normativeGraph.get(from).add(to);
}
const normativeCycles = findCycles(normativeGraph);
for (const cycle of normativeCycles) failures.push(`normative dependency graph cycle: ${cycle}`);

const uniqueOwners = [
  ['## Closed Terminal Stop Reason', 'docs/team/13-shared-role-execution-contract.md'],
  ['## Context-Resistance Regression Matrix', 'docs/team/13-shared-role-execution-contract.md'],
  ['## Status Vocabulary', 'docs/team/11-delegation-and-result-contract.md'],
  ['## Review Decision Canonical Record', 'docs/team/14-review-execution-contract.md'],
];
for (const [marker, owner] of uniqueOwners) {
  const matches = [...contents].filter(([, content]) => content.includes(marker)).map(([file]) => file);
  check(matches.length === 1 && matches[0] === owner, `${marker} must be owned only by ${owner}; found ${matches.join(', ') || 'none'}`);
}

const requiredMetadata = ['task_id', 'record_type', 'authoring_role', 'authority_source', 'canonical_record'];
for (const file of ['docs/team/06-handoff-template.md', 'docs/team/07-task-assignment-template.md', 'docs/team/11-delegation-and-result-contract.md', 'docs/team/13-shared-role-execution-contract.md', 'docs/team/14-review-execution-contract.md']) {
  for (const field of requiredMetadata) check(contents.get(file).includes(field), `${file}: missing authority metadata ${field}`);
}
for (const file of ['docs/team/06-handoff-template.md', 'docs/team/07-task-assignment-template.md', 'docs/team/11-delegation-and-result-contract.md']) {
  check(/canonical_record[^\n]*(?:GitHub|Issue|PR)/i.test(contents.get(file)), `${file}: canonical_record must require a direct GitHub record URL`);
  check(/supporting_record/i.test(contents.get(file)) && /40-character|40文字|40-char/i.test(contents.get(file)), `${file}: supporting record must bind repository path to a full commit SHA`);
}

const assignment = contents.get('docs/team/07-task-assignment-template.md');
check(assignment.includes('Role: Architect Team | Backend Implementer | Frontend Implementer | Worker'), 'Task Assignment role list must include Architect Team');
check(!assignment.includes('Role: Frontend Architect'), 'Task Assignment must not add a Frontend Architect role');

const shared = contents.get('docs/team/13-shared-role-execution-contract.md');
for (const status of ['completed', 'completed_with_warnings', 'needs_followup', 'not_applicable']) {
  check(shared.includes(`\`${status}\``), `shared execution mapping is missing completed -> ${status}`);
}
check(/architecture_gap[^\n]*blocked/.test(shared), 'architecture_gap must map to blocked');
check(/external_blocker[^\n]*blocked[^\n]*failed/.test(shared), 'external_blocker must map to blocked or failed');

const expectedMatrix = new Map([
  ['CR-01', ['architecture_gap', 'blocked']],
  ['CR-02', ['architecture_gap', 'blocked']],
  ['CR-03', ['completed', 'needs_followup']],
  ['CR-04', ['completed', 'needs_followup']],
  ['CR-05', ['external_blocker', 'blocked']],
  ['CR-06', ['continue', 'not_terminal']],
  ['CR-07', ['architecture_gap', 'blocked']],
  ['CR-08', ['continue', 'in_progress']],
  ['CR-09', ['continue', 'not_terminal']],
  ['CR-10', ['external_blocker', 'blocked']],
  ['CR-11', ['completed', 'needs_followup']],
  ['CR-12', ['external_blocker', 'blocked']],
]);
const matrixRows = new Map();
for (const line of shared.split(/\r?\n/)) {
  const match = line.match(/^\| `?(CR-\d{2})`? \|/);
  if (!match) continue;
  const cells = line.split('|').slice(1, -1).map((cell) => cell.trim().replaceAll('`', ''));
  check(cells.length === 10, `${match[1]} must have 10 matrix columns; found ${cells.length}`);
  check(!matrixRows.has(match[1]), `${match[1]} is duplicated`);
  matrixRows.set(match[1], cells);
}
for (const [id, [reason, status]] of expectedMatrix) {
  const row = matrixRows.get(id);
  check(Boolean(row), `${id} is missing from the regression matrix`);
  if (!row) continue;
  check(row[4] === reason, `${id}: expected execution_stop_reason ${reason}; found ${row[4]}`);
  check(row[5] === status, `${id}: expected Result Handoff status ${status}; found ${row[5]}`);
  check(Boolean(row[8]), `${id}: required canonical record is empty`);
  check(Boolean(row[9]), `${id}: resume condition is empty`);
}
check(matrixRows.size === 12, `regression matrix must contain exactly 12 scenarios; found ${matrixRows.size}`);

for (const marker of ['Issue #163', 'Amendment 007', 'Amendment 002', 'external_blocker']) {
  check(shared.includes(marker), `Issue #163 walkthrough is missing ${marker}`);
}
check(!readFileSync(resolve(root, 'package.json'), 'utf8').includes('test-role-execution-contracts'), 'package.json must not register the documentation validation script');

if (failures.length) {
  console.error(`Role execution contract validation failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Role execution contract validation passed: ${files.length} markdown files, ${literalEdges} literal edges, 0 broken links, 0 literal cycles, 0 normative cycles, ${matrixRows.size} scenarios.`);
