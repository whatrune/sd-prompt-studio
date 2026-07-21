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
const baselineContents = new Map(files.map((file) => [file, readFileSync(resolve(root, file), 'utf8')]));

const expectedOwners = new Map(Object.entries({
  role_taxonomy: '00',
  precedence: '00',
  decision_ownership: '00',
  git_lifecycle: '05',
  integrated_lead_routing: '08',
  development_routing: '09',
  research_routing: '10',
  assignment_shape: '11',
  result_handoff_shape: '11',
  handoff_status: '11',
  shared_admission: '13',
  canonical_record_admission: '13',
  protected_actions: '13',
  terminal_stop_reason: '13',
  same_task_correction: '13',
  resume_authority: '13',
  completion_evidence: '13',
  finding_closure_authority: '13',
  context_resistance_matrix: '13',
  review_admission: '14',
  review_finding: '14',
  review_decision_record: '14',
}));

const sharedRuleSignatures = new Map([
  ['protected_actions', /Task Assignmentに明示的なauthorityがない限り、すべてのRoleで次を禁止する。/g],
  ['same_task_correction', /Review correctionとArchitecture gap closureは、原則として同じ`task_id`、branch、worktree、PRを維持する。/g],
  ['resume_authority', /Integrated LeadだけがResume Dispatchを記録する。/g],
  ['completion_evidence', /^## Completion Evidence$/gm],
  ['canonical_record_admission', /migration後のlive Taskでは、Task Assignment、Architecture Amendment、Resume Dispatch、Review Decision \/ Amendment、Result Handoffの`canonical_record`/g],
  ['finding_closure_authority', /同じreview authorityを持つRole[^。\n]*finding[^。\n]*close/g],
]);

function parseList(value) {
  if (!value || value === 'none') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
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

function parseMetadata(contents, failures) {
  const records = new Map();
  const allowedKinds = new Set(['entry_guard', 'operating_model', 'role_charter', 'contract', 'routing_contract', 'template']);

  for (const [file, content] of contents) {
    const matches = [...content.matchAll(/<!-- role-contract-meta\r?\n([\s\S]*?)\r?\n-->/g)];
    if (matches.length !== 1) {
      failures.push(`${file}: expected exactly one role-contract-meta block; found ${matches.length}`);
      continue;
    }

    const fields = new Map();
    for (const line of matches[0][1].split(/\r?\n/)) {
      const match = line.match(/^([a-z_]+):\s*(.*)$/);
      if (!match) {
        failures.push(`${file}: malformed metadata line ${line}`);
        continue;
      }
      if (fields.has(match[1])) failures.push(`${file}: duplicate metadata field ${match[1]}`);
      fields.set(match[1], match[2].trim());
    }

    for (const field of ['id', 'kind', 'owns', 'uses']) {
      if (!fields.has(field)) failures.push(`${file}: missing metadata field ${field}`);
    }
    const id = fields.get('id');
    const kind = fields.get('kind');
    if (!id || !kind) continue;
    if (records.has(id)) failures.push(`${file}: duplicate document id ${id}`);
    if (!allowedKinds.has(kind)) failures.push(`${file}: unknown document kind ${kind}`);
    const owns = parseList(fields.get('owns'));
    const uses = parseList(fields.get('uses'));
    if (kind === 'template' && owns.length) failures.push(`${file}: template must not become a normative owner (${owns.join(', ')})`);
    records.set(id, { file, id, kind, owns, uses });
  }
  return records;
}

function validateNormativeDeclarations(contents) {
  const failures = [];
  const records = parseMetadata(contents, failures);
  const concernOwners = new Map();

  for (const record of records.values()) {
    for (const concern of record.owns) {
      if (!concernOwners.has(concern)) concernOwners.set(concern, []);
      concernOwners.get(concern).push(record.id);
    }
  }

  for (const [concern, owners] of concernOwners) {
    if (owners.length !== 1) failures.push(`duplicate normative owner for ${concern}: ${owners.join(', ')}`);
  }
  for (const [concern, expectedOwner] of expectedOwners) {
    const owners = concernOwners.get(concern) ?? [];
    if (owners.length === 0) failures.push(`missing normative owner for ${concern}; expected ${expectedOwner}`);
    else if (owners.length === 1 && owners[0] !== expectedOwner) failures.push(`reversed normative ownership for ${concern}: expected ${expectedOwner}, found ${owners[0]}`);
  }

  const graph = new Map([...records.keys()].map((id) => [id, new Set()]));
  const edges = new Set();
  for (const record of records.values()) {
    for (const concern of record.uses) {
      const owners = concernOwners.get(concern) ?? [];
      if (owners.length === 0) {
        failures.push(`${record.file}: undeclared owner reference ${concern}`);
        continue;
      }
      if (owners.length !== 1) continue;
      const owner = owners[0];
      if (owner === record.id) {
        failures.push(`${record.file}: self dependency through ${concern}`);
        continue;
      }
      graph.get(record.id).add(owner);
      edges.add(`${record.id}->${owner}`);
    }
  }
  for (const cycle of findCycles(graph)) failures.push(`normative dependency graph cycle: ${cycle}`);

  for (const [concern, signature] of sharedRuleSignatures) {
    const owner = expectedOwners.get(concern);
    let ownerMatches = 0;
    for (const record of records.values()) {
      const matches = [...contents.get(record.file).matchAll(new RegExp(signature.source, signature.flags))].length;
      if (record.id === owner) ownerMatches += matches;
      else if (matches) failures.push(`${record.file}: redefines ${concern} owned by ${owner}`);
    }
    if (ownerMatches === 0) failures.push(`owner ${owner} is missing normative rule text for ${concern}`);
  }

  return { failures, records, concernOwners, edges };
}

function validateLiteralLinks(contents, failures) {
  const graph = new Map(files.map((file) => [file, new Set()]));
  let edges = 0;
  for (const [file, content] of contents) {
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
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
      if (graph.has(target)) {
        graph.get(file).add(target);
        edges += 1;
      }
    }
  }
  for (const cycle of findCycles(graph)) failures.push(`literal Markdown graph cycle: ${cycle}`);
  return edges;
}

function validateDocumentContent(contents, failures) {
  const requiredMetadata = ['task_id', 'record_type', 'authoring_role', 'authority_source', 'canonical_record'];
  for (const file of ['docs/team/06-handoff-template.md', 'docs/team/07-task-assignment-template.md', 'docs/team/11-delegation-and-result-contract.md', 'docs/team/13-shared-role-execution-contract.md', 'docs/team/14-review-execution-contract.md']) {
    for (const field of requiredMetadata) {
      if (!contents.get(file).includes(field)) failures.push(`${file}: missing authority metadata ${field}`);
    }
  }
  for (const file of ['docs/team/06-handoff-template.md', 'docs/team/07-task-assignment-template.md', 'docs/team/11-delegation-and-result-contract.md']) {
    if (!/canonical_record[^\n]*(?:GitHub|Issue|PR)/i.test(contents.get(file))) failures.push(`${file}: canonical_record must require a direct GitHub record URL`);
    if (!(/supporting_record/i.test(contents.get(file)) && /40-character|40文字|40-char/i.test(contents.get(file)))) failures.push(`${file}: supporting record must bind repository path to a full commit SHA`);
  }

  const assignment = contents.get('docs/team/07-task-assignment-template.md');
  if (!assignment.includes('Role: Architect Team | Backend Implementer | Frontend Implementer | Worker')) failures.push('Task Assignment role list must include Architect Team');
  if (assignment.includes('Role: Frontend Architect')) failures.push('Task Assignment must not add a Frontend Architect role');

  const shared = contents.get('docs/team/13-shared-role-execution-contract.md');
  for (const status of ['completed', 'completed_with_warnings', 'needs_followup', 'not_applicable']) {
    if (!shared.includes(`\`${status}\``)) failures.push(`shared execution mapping is missing completed -> ${status}`);
  }
  if (!/architecture_gap[^\n]*blocked/.test(shared)) failures.push('architecture_gap must map to blocked');
  if (!/external_blocker[^\n]*blocked[^\n]*failed/.test(shared)) failures.push('external_blocker must map to blocked or failed');

  const expectedMatrix = new Map([
    ['CR-01', ['architecture_gap', 'blocked']], ['CR-02', ['architecture_gap', 'blocked']],
    ['CR-03', ['completed', 'needs_followup']], ['CR-04', ['completed', 'needs_followup']],
    ['CR-05', ['external_blocker', 'blocked']], ['CR-06', ['continue', 'not_terminal']],
    ['CR-07', ['architecture_gap', 'blocked']], ['CR-08', ['continue', 'in_progress']],
    ['CR-09', ['continue', 'not_terminal']], ['CR-10', ['external_blocker', 'blocked']],
    ['CR-11', ['completed', 'needs_followup']], ['CR-12', ['external_blocker', 'blocked']],
  ]);
  const matrixRows = new Map();
  for (const line of shared.split(/\r?\n/)) {
    const match = line.match(/^\| `?(CR-\d{2})`? \|/);
    if (!match) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim().replaceAll('`', ''));
    if (cells.length !== 10) failures.push(`${match[1]} must have 10 matrix columns; found ${cells.length}`);
    if (matrixRows.has(match[1])) failures.push(`${match[1]} is duplicated`);
    matrixRows.set(match[1], cells);
  }
  for (const [id, [reason, status]] of expectedMatrix) {
    const row = matrixRows.get(id);
    if (!row) {
      failures.push(`${id} is missing from the regression matrix`);
      continue;
    }
    if (row[4] !== reason) failures.push(`${id}: expected execution_stop_reason ${reason}; found ${row[4]}`);
    if (row[5] !== status) failures.push(`${id}: expected Result Handoff status ${status}; found ${row[5]}`);
    if (!row[8]) failures.push(`${id}: required canonical record is empty`);
    if (!row[9]) failures.push(`${id}: resume condition is empty`);
  }
  if (matrixRows.size !== 12) failures.push(`regression matrix must contain exactly 12 scenarios; found ${matrixRows.size}`);
  for (const marker of ['Issue #163', 'Amendment 007', 'Amendment 002', 'external_blocker']) {
    if (!shared.includes(marker)) failures.push(`Issue #163 walkthrough is missing ${marker}`);
  }
  if (readFileSync(resolve(root, 'package.json'), 'utf8').includes('test-role-execution-contracts')) failures.push('package.json must not register the documentation validation script');
  return matrixRows.size;
}

function applyFixture(contents, fixture) {
  const mutated = new Map(contents);
  for (const mutation of fixture.mutations) {
    const current = mutated.get(mutation.file);
    if (current === undefined) throw new Error(`${fixture.name}: unknown fixture file ${mutation.file}`);
    if (mutation.type === 'append_metadata_value') {
      const pattern = new RegExp(`^${mutation.field}: (.*)$`, 'm');
      const match = current.match(pattern);
      if (!match) throw new Error(`${fixture.name}: missing metadata field ${mutation.field}`);
      const next = match[1] === 'none' ? mutation.value : `${match[1]}, ${mutation.value}`;
      mutated.set(mutation.file, current.replace(pattern, `${mutation.field}: ${next}`));
    } else if (mutation.type === 'set_metadata_value') {
      const pattern = new RegExp(`^${mutation.field}: (.*)$`, 'm');
      if (!pattern.test(current)) throw new Error(`${fixture.name}: missing metadata field ${mutation.field}`);
      mutated.set(mutation.file, current.replace(pattern, `${mutation.field}: ${mutation.value}`));
    } else if (mutation.type === 'append_text') {
      mutated.set(mutation.file, `${current}\n${mutation.value}\n`);
    } else {
      throw new Error(`${fixture.name}: unknown mutation type ${mutation.type}`);
    }
  }
  return mutated;
}

const failures = [];
const normative = validateNormativeDeclarations(baselineContents);
failures.push(...normative.failures);
const literalEdges = validateLiteralLinks(baselineContents, failures);
const matrixSize = validateDocumentContent(baselineContents, failures);

const fixtures = JSON.parse(readFileSync(resolve(root, 'scripts/fixtures/role-execution-contracts-negative.json'), 'utf8'));
let negativeFixturesPassed = 0;
for (const fixture of fixtures) {
  const result = validateNormativeDeclarations(applyFixture(baselineContents, fixture));
  const matched = fixture.expected_failures.every((expected) => result.failures.some((failure) => failure.includes(expected)));
  if (!result.failures.length) failures.push(`negative fixture ${fixture.name} unexpectedly passed`);
  else if (!matched) failures.push(`negative fixture ${fixture.name} missed expected failures: ${fixture.expected_failures.join(', ')}; actual: ${result.failures.join(' | ')}`);
  else negativeFixturesPassed += 1;
}

if (failures.length) {
  console.error(`Role execution contract validation failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Role execution contract validation passed: ${files.length} documents, ${normative.concernOwners.size} declared concerns, ${normative.edges.size} derived normative edges, 0 duplicate owners, 0 undeclared owner references, 0 reversed owners, 0 normative cycles, ${literalEdges} literal edges, 0 broken links, 0 literal cycles, ${matrixSize} scenarios, ${negativeFixturesPassed} negative fixtures.`);
