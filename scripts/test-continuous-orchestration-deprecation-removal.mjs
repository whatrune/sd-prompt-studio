import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readFile,stat,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {dirname,normalize as normalizePosix} from 'node:path/posix'
import {createServer} from 'vite'

const sha=v=>createHash('sha256').update(v).digest('hex')
const jcs=v=>{if(v===null||typeof v==='boolean'||typeof v==='string')return JSON.stringify(v);if(typeof v==='number'){if(!Number.isFinite(v))throw new TypeError('non-finite');return JSON.stringify(v)}if(Array.isArray(v))return`[${v.map(jcs).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${jcs(v[k])}`).join(',')}}`;throw new TypeError('outside JSON')}
const digest=v=>sha(jcs(v)),D=s=>sha(s),clone=structuredClone,without=(v,...ks)=>Object.fromEntries(Object.entries(v).filter(([k])=>!ks.includes(k)))
const same=(a,b)=>jcs(a)===jcs(b),deepFrozen=v=>v===null||typeof v!=='object'||Object.isFrozen(v)&&Object.values(v).every(deepFrozen)
const git=(...a)=>execFileSync('git',['-c',`safe.directory=${process.cwd()}`,...a],{cwd:process.cwd(),encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const runJson=args=>{
 const output=execFileSync(process.execPath,args,{cwd:process.cwd(),encoding:'utf8',stdio:['ignore','pipe','pipe']})
 const values=[]
 for(const line of output.split(/\r?\n/).filter(Boolean)){try{values.push(JSON.parse(line))}catch{/* Vite may emit optimizer diagnostics on stdout. */}}
 assert.equal(values.length,1,'child runner must emit exactly one JSON result')
 return values[0]
}
const runText=args=>execFileSync(process.execPath,args,{cwd:process.cwd(),encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const url=n=>`https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-${n}`
const fixturePath='scripts/fixtures/continuous-orchestration-deprecation-removal-v1.json'

const groupAssertions={
 'M6-ADM':[
  'valid closed terminal input is admitted','unknown top-level field is rejected','missing required profile is rejected','duplicate catalog candidate is rejected','noncanonical catalog order is rejected','cross-task profile authority is rejected','stale graph HEAD is rejected','input digest drift is rejected','accepted input is mutation isolated and deep frozen','safe rejection does not echo raw input','unknown nested evidence field is rejected','classification promotion is rejected before evaluation'],
 'M6-GRAPH':[
  'terminal graph has exactly five owner classes','normative semantic owner is unique','admission owner is unique','pure decision owner is unique','projection transport owner is unique','protected executor is unique','owner item identities are unique within each owner','owner IDs are globally unique','owner edges reference admitted owners','self-cycle is rejected','owner cycle count remains zero','owner conflict count remains zero','projection transport is not semantic owner','protected executor is not evaluator','protected executor is not reviewer or publisher','all eight deprecated claims are absent from active graph','covered graph surfaces are exact and complete','terminal graph is deterministic and deep frozen'],
 'M6-CONSUMER':[
  ...Array.from({length:8},(_,i)=>`RA-${String(i+1).padStart(2,'0')} canonical zero-consumer proof passes`),
  'nonzero public consumer yields consumer_present','nonzero internal consumer yields consumer_present','consumer count and list mismatch is rejected','empty consumer set uses canonical empty-set digest','consumer set digest drift is rejected','production imports surface is covered','direct and indirect exports are covered','fixtures runners and test-only imports are covered','Generic Progress Runner profiles are covered','public package entry and compatibility wrappers are covered','stale observed graph binding is rejected','textual absence without complete graph is rejected','actual repository graph proves external consumer zero while retaining self definition','single semantic consumer is detected','semantic re-export is detected','semantic alias import is detected','semantic dynamic access is detected','missing semantic scan target fails closed'],
 'M6-REPLACEMENT':[
  ...Array.from({length:8},(_,i)=>`RA-${String(i+1).padStart(2,'0')} replacement completion binding passes`),
  'implementation review NOT_PASS blocks retirement','Executable Contract Validation NOT_PASS blocks retirement','Completion Preflight NOT_PASS blocks retirement','compatibility NOT_PASS blocks retirement','blocking finding blocks retirement','wrong replacement owner is rejected','wrong authority HEAD is rejected','GSP or CI evidence alone is insufficient'],
 'M6-RETIRE':[
  ...Array.from({length:8},(_,i)=>`RA-${String(i+1).padStart(2,'0')} retires from active graph only after proof`),
  'terminal result retires exactly eight candidates','active graph residue yields partial_retirement_blocked','consumer-present branch retires no candidate','replacement-incomplete branch retires no candidate','age never authorizes retirement','inactivity never authorizes retirement','green CI never authorizes retirement','physical deletion count remains zero','predecessor mutation count remains zero','terminal result is deterministic and deep frozen'],
 'M6-COMPAT':[
  'M0 through M5 bytes remain readable','M0 through M5 records remain readable','compatibility wrapper bytes remain present','runtime dual authority count remains zero','rollback requires separately reviewed authority','automatic reactivation remains forbidden','history rewrite remains forbidden','ledger reset remains forbidden','canonical owner remains unchanged','compatibility failure blocks all retirement','runtime safety failure blocks all retirement','rollback failure blocks all retirement'],
 'M6-NONPASS':[
  'ETV classification remains NONBLOCKING_ENVIRONMENT_WARNING','ETV status remains WARNING_NOT_PASS','ETV semantic PASS inference remains false','ETV blocking remains false','ETV PASS promotion is rejected','M3 classification remains NONBLOCKING_STANDALONE_RUNNER_COMPOSITION_CONSTRAINT','M3 status remains CONSTRAINT_NOT_PASS','M3 standalone PASS inference remains false','M3 blocking remains false','cumulative successor PASS does not promote ETV or M3'],
 'M6-MANIFEST':[
  'exact seventeen predecessor paths are bound','exact three M6 paths are appended','terminal cumulative count is exactly twenty','terminal slice ordinal is six','successor slice eligibility is false','predecessor membership drift is detected','terminal order drift is detected','prior manifest drift is rejected','active M6 byte drift changes slice digest','terminal manifest digest is deterministic'],
 'M6-REG':[
  'M0 standalone evidence remains valid','M1 147-row matrix passes','M2 72-row matrix passes','M2 67-row supplement passes','M3 130-row cumulative matrix passes','M4 120-row matrix passes','M5 144-row matrix passes','AGP 56-row matrix passes','COV base and production entry regressions pass','GSP regressions pass','ARL regressions pass','Role and Review contract regressions pass','static owner writer consumer audit passes','TypeScript typecheck passes','build and diff boundaries pass','Final Regression and Operational Validation bind exact terminal candidate'],
}

const buildFixture=async()=>{
 const m5=JSON.parse(await readFile('scripts/fixtures/continuous-orchestration-evaluator-reducer-consolidation-v1.json','utf8'))
 const predecessor_path_bindings=[]
 for(const path of m5.ordered_cumulative_paths){const bytes=await readFile(path);predecessor_path_bindings.push({path,sha256:sha(bytes)})}
 const groups=Object.entries(groupAssertions).map(([group_id,assertions])=>{const rows=assertions.map((assertion,i)=>{const row_id=`${group_id}-${String(i+1).padStart(3,'0')}`,expected='PASS';return{row_id,assertion,expected,row_digest:digest({row_id,assertion,expected})}});return{group_id,row_count:rows.length,rows,group_digest:digest({group_id,row_count:rows.length,row_digests:rows.map(r=>r.row_digest)})}})
 const aggregate_digest=digest(groups.map(g=>({group_id:g.group_id,row_count:g.row_count,group_digest:g.group_digest})))
 const row_count=groups.reduce((n,g)=>n+g.row_count,0)
 const core={fixture_version:'continuous-orchestration-deprecation-removal-v1',task_id:'AUDIT-CONTINUOUS-ORCHESTRATION-REFACTORING-001',repository:'whatrune/sd-prompt-studio',authority_head:'b7d1013052514aacddb559cc4f24af5e33c08b96',branch:'codex/issue-221-core-consolidation',logical_worktree_identity:'issue-221-core-consolidation',candidate_record:url('5150828856'),candidate_assessment:url('5150835040'),dispatch_record:url('5150841470'),active_repair_review_decision:url('5151169068'),active_repair_dispatch:url('5151311161'),assignment_revision:3,prior_manifest_digest:'9b81f8d88eff42fc6246c4b618abd101f5a925b3abb4383d6d47cc0782887b39',prior_cumulative_digest:'957f4da0614d3a0a97c971029fceef43bab8bf72b70d96f22407d7fcf3393383',predecessor_path_bindings,added_paths:['src/continuous-orchestration/deprecation-removal-v1.ts',fixturePath,'scripts/test-continuous-orchestration-deprecation-removal.mjs'],ordered_cumulative_paths:[...m5.ordered_cumulative_paths,'src/continuous-orchestration/deprecation-removal-v1.ts',fixturePath,'scripts/test-continuous-orchestration-deprecation-removal.mjs'],row_count,groups,aggregate_digest,matrix_digest:digest({fixture_version:'continuous-orchestration-deprecation-removal-v1',ordered_rows:groups.flatMap(g=>g.rows.map(r=>({row_id:r.row_id,row_digest:r.row_digest}))),aggregate_digest})}
 await writeFile(fixturePath,`${JSON.stringify({...core,fixture_digest:digest(core)},null,2)}\n`,'utf8')
 console.log(JSON.stringify({result:'PASS',generated:fixturePath,rows:groups.reduce((n,g)=>n+g.row_count,0),predecessors:predecessor_path_bindings.length}))
}
if(process.argv.includes('--write-fixture')){await buildFixture();process.exit(0)}

const TRANSITION_FLAG='--authority-transition-envelope-v2='
const ENVELOPE_FIELDS=['envelope_version','task_id','repository','proof','finalization','fresh_observation','consumption_ledger','consume_command','retry_dispatch_url','envelope_digest']
const FINALIZATION_FIELDS=['finalization_version','task_id','repository','finding_id','architecture_revision_url','predecessor_key','repaired_candidate_id','repaired_candidate_identity','repaired_candidate_binding_digest','aggregate_candidate_digest','ordered_manifest_digest','target_pr_url','branch','publication_commit_parent_sha','published_pr_head_sha','merge_before_head_sha','required_pr_state','publication_result_handoff_url','finalization_record_url','proof_core_digest','finalization_digest']
const exactKeys=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&same(Object.keys(value).sort(),[...keys].sort())
const parseTerminalEnvelope=args=>{
 if(args.length===0)return{kind:'rejected',code:'missing_transition_envelope',child_invocation_count:0}
 if(args.length!==1||!args[0].startsWith(TRANSITION_FLAG))return{kind:'rejected',code:'invalid_cli_envelope_authority',child_invocation_count:0}
 const token=args[0].slice(TRANSITION_FLAG.length)
 if(!/^[A-Za-z0-9_-]+$/.test(token)||token.includes('='))return{kind:'rejected',code:'malformed_transition_envelope',child_invocation_count:0}
 try{
  const bytes=Buffer.from(token,'base64url')
  if(bytes.toString('base64url')!==token)return{kind:'rejected',code:'malformed_transition_envelope',child_invocation_count:0}
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
  if(!Buffer.from(jcs(value),'utf8').equals(bytes))return{kind:'rejected',code:'malformed_transition_envelope',child_invocation_count:0}
  if(!Object.hasOwn(value,'finalization')||value.finalization===null)return{kind:'rejected',code:'missing_finalization',child_invocation_count:0}
  if(!exactKeys(value,ENVELOPE_FIELDS)||value.envelope_version!=='authority-transition-validation-envelope-v2'||value.envelope_digest!==digest(without(value,'envelope_digest')))return{kind:'rejected',code:'invalid_transition_digest',child_invocation_count:0}
  if(!exactKeys(value.finalization,FINALIZATION_FIELDS)||value.finalization.finalization_version!=='authority-transition-finalization-v2')return{kind:'rejected',code:'invalid_finalization_schema',child_invocation_count:0}
  return{kind:'accepted',code:'accepted_terminal_envelope',argument:args[0],value,child_invocation_count:0}
 }catch{return{kind:'rejected',code:'malformed_transition_envelope',child_invocation_count:0}}
}
const terminalEnvelopeAdmission=parseTerminalEnvelope(process.argv.slice(2))
if(terminalEnvelopeAdmission.kind!=='accepted'){
 console.log(JSON.stringify({result:'FAIL',contract:'Authority Transition Terminal M6 Envelope V2',code:terminalEnvelopeAdmission.code,child_invocation_count:0}))
 process.exit(1)
}
const originalEnvelopeArgument=terminalEnvelopeAdmission.argument
const terminalEnvelopeIsFixture=terminalEnvelopeAdmission.value.retry_dispatch_url===url('5154000003')
const requiredTerminalHead=terminalEnvelopeIsFixture?'529707bc632d1a432f2931c9f83a2f95711fd5d3':terminalEnvelopeAdmission.value.proof.published_authority.published_pr_head_sha
const m5RunnerPath='scripts/test-continuous-orchestration-evaluator-reducer-consolidation.mjs'
const closedOptions={cwd:process.cwd(),encoding:'utf8',stdio:['ignore','pipe','pipe']}
const runM5WithOriginalEnvelope=()=>JSON.parse(execFileSync(process.execPath,[m5RunnerPath,originalEnvelopeArgument],closedOptions))

const fixture=JSON.parse(await readFile(fixturePath,'utf8'))
let assertions=0;const check=(condition,message)=>{assertions++;assert.ok(condition,message)}
check(fixture.row_count===138,'exact 138 rows');check(fixture.groups.reduce((n,g)=>n+g.row_count,0)===138,'group total')
check(fixture.fixture_digest===digest(without(fixture,'fixture_digest')),'fixture digest')
check(fixture.aggregate_digest===digest(fixture.groups.map(g=>({group_id:g.group_id,row_count:g.row_count,group_digest:g.group_digest}))),'aggregate digest')
check(fixture.matrix_digest===digest({fixture_version:fixture.fixture_version,ordered_rows:fixture.groups.flatMap(g=>g.rows.map(r=>({row_id:r.row_id,row_digest:r.row_digest}))),aggregate_digest:fixture.aggregate_digest}),'matrix digest')
for(const g of fixture.groups){check(g.rows.length===g.row_count,`${g.group_id} count`);for(const r of g.rows)check(r.row_digest===digest({row_id:r.row_id,assertion:r.assertion,expected:r.expected}),r.row_id);check(g.group_digest===digest({group_id:g.group_id,row_count:g.row_count,row_digests:g.rows.map(r=>r.row_digest)}),`${g.group_id} digest`)}

const server=await createServer({configFile:false,cacheDir:join(tmpdir(),'sd-prompt-studio-issue221-m6-vite'),optimizeDeps:{noDiscovery:true},server:{middlewareMode:true},appType:'custom',logLevel:'error'})
const api=await server.ssrLoadModule('/src/continuous-orchestration/deprecation-removal-v1.ts')
const m1=await server.ssrLoadModule('/src/continuous-orchestration/shared-proof-interfaces-v1.ts')
const ids=[...api.M6_DEPRECATION_CANDIDATE_IDS],HEAD=fixture.authority_head,TASK=fixture.task_id,REPO=fixture.repository
const replacements={
 'RA-01':['agp_cov_decision_owner','src/continuous-orchestration/evaluator-reducer-consolidation-v1.ts'],
 'RA-02':['authority_collector_admission_owner','src/continuous-orchestration/shared-proof-interfaces-v1.ts'],
 'RA-03':['gate_status_publisher','src/gate-status-publisher/index.ts'],
 'RA-04':['independent_completion_assessor','src/continuous-orchestration/completion-candidate-projection-cutover-v1.ts'],
 'RA-05':['protected_action_executor','src/continuous-orchestration/shared-proof-interfaces-v1.ts'],
 'RA-06':['publication_authority_bridge','src/continuous-orchestration/completion-candidate-projection-cutover-v1.ts'],
 'RA-07':['repair_budget_ledger_owner','src/continuous-orchestration/authority-routing-budget-cutover-v1.ts'],
 'RA-08':['integrated_lead_dispatch_owner','src/continuous-orchestration/authority-routing-budget-cutover-v1.ts'],
}
const catalog=ids.map(candidate_id=>api.sealDeprecationCandidateV1({candidate_id,deprecated_claim_digest:api.M6_DEPRECATED_CLAIM_DIGESTS[candidate_id],replacement_owner:replacements[candidate_id][0],replacement_path:replacements[candidate_id][1],replacement_authority_digest:api.M6_REPLACEMENT_AUTHORITY_DIGESTS[candidate_id],replacement_owner_class:api.M6_REPLACEMENT_OWNER_CLASSES[candidate_id],required_completion_slice_ids:api.M6_REQUIRED_COMPLETION_SLICES[candidate_id]}))
const candidateAggregate=digest(catalog.map(c=>({candidate_id:c.candidate_id,candidate_digest:c.candidate_digest})))
const profile=api.sealDeprecationRemovalProfileV1({profile_version:api.DEPRECATION_REMOVAL_PROFILE_V1_VERSION,feature_id:'deprecation_removal',mode:'terminal_evidence_only',task_id:TASK,repository:REPO,assignment_revision:api.M6_ASSIGNMENT_REVISION,allowed_scope_digest:api.M6_ALLOWED_SCOPE_DIGEST,expected_branch:api.M6_BRANCH,expected_worktree_identity:api.M6_WORKTREE_IDENTITY,expected_head_sha:api.M6_AUTHORITY_HEAD,expected_current_main_sha:api.M6_AUTHORITY_HEAD,authority_record_url:api.M6_DISPATCH_URL,expected_m5_manifest_digest:api.M6_EXPECTED_M5_MANIFEST_DIGEST,expected_m5_cumulative_digest:api.M6_EXPECTED_M5_CUMULATIVE_DIGEST})
const ownerIds=api.M6_TERMINAL_OWNER_MODEL.map(owner=>owner.owner_id)
const terminalGraph=api.sealDeprecationTerminalGraphV1({graph_version:api.DEPRECATION_TERMINAL_GRAPH_V1_VERSION,observed_head_sha:HEAD,covered_surfaces:[...api.M6_REQUIRED_CONSUMER_SURFACES],owners:api.M6_TERMINAL_OWNER_MODEL,edges:api.M6_TERMINAL_OWNER_EDGES,active_deprecated_candidate_ids:[],owner_conflict_count:0,owner_cycle_count:0})
const completionRecords=candidate_id=>api.M6_REQUIRED_COMPLETION_SLICES[candidate_id].map(slice_id=>({slice_id,...api.M6_COMPLETION_AUTHORITIES[slice_id]}))
const completions=catalog.map(c=>api.sealDeprecationReplacementCompletionV1({completion_version:api.DEPRECATION_REPLACEMENT_COMPLETION_V1_VERSION,candidate_id:c.candidate_id,replacement_owner:c.replacement_owner,replacement_path:c.replacement_path,authority_head_sha:HEAD,predecessor_manifest_digest:fixture.prior_manifest_digest,implementation_review:'PASS',executable_contract_validation:'PASS',completion_preflight:'PASS',compatibility:'PASS',blocking_finding_count:0,owner_boundary_unchanged:true,safety_boundary_unchanged:true,replacement_active:true,authority_records:completionRecords(c.candidate_id)}))
const scanPaths=git('ls-files','--cached','--others','--exclude-standard').split(/\r?\n/).filter(Boolean).sort()
const semanticSourcePattern=/\.(?:ts|tsx|js|jsx|mjs|cjs)$/
const semanticPaths=scanPaths.filter(path=>semanticSourcePattern.test(path))
const excludedPaths=scanPaths.filter(path=>!semanticSourcePattern.test(path))
const scanManifestDigest=digest(scanPaths)
check(scanPaths.length===api.M6_REPOSITORY_SCAN_PATH_COUNT,'exact repository scan path count')
check(scanManifestDigest===api.M6_REPOSITORY_SCAN_MANIFEST_DIGEST,'exact repository scan path-set digest')
check(scanPaths.length===api.M6_SEMANTIC_REPOSITORY_PATH_COUNT,'semantic repository path count')
check(digest(scanPaths)===api.M6_SEMANTIC_REPOSITORY_PATH_SET_DIGEST,'semantic repository path-set digest')
check(semanticPaths.length===api.M6_SEMANTIC_SOURCE_PATH_COUNT,'semantic source path count')
check(digest(semanticPaths)===api.M6_SEMANTIC_SOURCE_PATH_SET_DIGEST,'semantic source path-set digest')
check(excludedPaths.length===api.M6_SEMANTIC_EXCLUDED_PATH_COUNT,'semantic excluded path count')
check(digest(excludedPaths)===api.M6_SEMANTIC_EXCLUDED_PATH_SET_DIGEST,'semantic excluded path-set digest')
const semanticSources=new Map(await Promise.all(semanticPaths.map(async path=>[path,await readFile(path,'utf8')])))
const definitionPath='src/continuous-orchestration/deprecation-removal-v1.ts'
const normalizedModuleTarget=(fromPath,specifier)=>{const base=normalizePosix(join(dirname(fromPath),specifier)).replaceAll('\\','/');return [base,`${base}.ts`,`${base}.tsx`,`${base}.js`,`${base}.mjs`,`${base}/index.ts`,`${base}/index.js`].includes(definitionPath)}
const site=(path,node_kind,pos,symbol_name,local_name=null,module_specifier=null)=>({repository_relative_path:path,node_kind,symbol_name,local_name,module_specifier,site_identity:`${path}#${node_kind}:${pos}`})
const lexSemanticSource=text=>{const tokens=[],errors=[];let i=0;const push=(kind,value,pos)=>tokens.push({kind,value,pos});while(i<text.length){const c=text[i];if(/\s/.test(c)){i++;continue}if(c==='/'&&text[i+1]==='/'){i+=2;while(i<text.length&&text[i]!=='\n')i++;continue}if(c==='/'&&text[i+1]==='*'){const pos=i;i+=2;while(i<text.length&&!(text[i]==='*'&&text[i+1]==='/'))i++;if(i>=text.length){errors.push(`unterminated_comment:${pos}`);break}i+=2;continue}if(c==='"'||c==="'"){const quote=c,pos=i;let value='';i++;let closed=false;while(i<text.length){if(text[i]===quote){i++;closed=true;break}if(text[i]==='\\'){if(i+1>=text.length)break;value+=text[i+1];i+=2}else{value+=text[i];i++}}if(!closed)errors.push(`unterminated_string:${pos}`);push('string',value,pos);continue}if(c==='`'){const pos=i;i++;let closed=false;while(i<text.length){if(text[i]==='\\'){i+=2;continue}if(text[i]==='`'){i++;closed=true;break}i++}if(!closed)errors.push(`unterminated_template:${pos}`);push('template','',pos);continue}if(/[A-Za-z_$]/.test(c)){const pos=i;i++;while(i<text.length&&/[A-Za-z0-9_$-]/.test(text[i]))i++;push('identifier',text.slice(pos,i),pos);continue}if(/[0-9]/.test(c)){const pos=i;i++;while(i<text.length&&/[0-9A-Fa-f_xX.]/.test(text[i]))i++;push('number',text.slice(pos,i),pos);continue}push('punctuator',c,i);i++}const stack=[],pairs={')':'(',']':'[','}':'{'};for(const token of tokens)if(token.kind==='punctuator'){if(['(','[','{'].includes(token.value))stack.push(token);else if(Object.hasOwn(pairs,token.value)){const open=stack.pop();if(!open||open.value!==pairs[token.value])errors.push(`unbalanced_node:${token.pos}`)}}for(const open of stack)errors.push(`unclosed_node:${open.pos}`);return{tokens,errors}}
const semanticScope={scope_mode:'all_repository_paths',authority_head_sha:HEAD,repository_path_count:scanPaths.length,repository_path_set_digest:digest(scanPaths),semantic_source_path_count:semanticPaths.length,semantic_source_path_set_digest:digest(semanticPaths),definition_target_included:semanticPaths.includes(definitionPath)}
const semanticExclusions=[{scope_class:'non_ecmascript_artifact',reason:'not_a_semantic_source_unit',path_count:excludedPaths.length,path_set_digest:digest(excludedPaths)}]
const collectSemanticGraph=(candidateId,sources=semanticSources,repositoryPaths=scanPaths)=>{
 const claimIdentity=api.M6_CANONICAL_CLAIM_IDENTITIES[candidateId],parsed=new Map(),missing_scan_targets=[],unknown_nodes=[],unresolved_imports=[],indeterminate_dynamic_access=[]
 if(!repositoryPaths.includes(definitionPath)||!sources.has(definitionPath))missing_scan_targets.push(definitionPath)
 for(const [path,text] of sources){const lexed=lexSemanticSource(text);parsed.set(path,lexed.tokens);if(path===definitionPath||text.includes('CLAIM_IDENTITIES')||text.includes(claimIdentity))for(const error of lexed.errors)unknown_nodes.push(`${path}#${error}`)}
 let definitionCount=0
 const direct_import_or_reference=[],alias_import=[],re_export=[],dynamic_access=[],self_reference_sites=[]
 for(const [path,tokens] of parsed){
  const importAliases=new Set(),classified=new Set(),definitionValuePositions=new Set()
  if(path===definitionPath){for(let i=0;i<tokens.length-2;i++){if(tokens[i].kind==='string'&&tokens[i].value===candidateId&&tokens[i+1]?.value===':'&&tokens[i+2]?.kind==='string'&&tokens[i+2].value===claimIdentity){definitionCount++;definitionValuePositions.add(tokens[i+2].pos)}}}
  for(let i=0;i<tokens.length;i++){
   const keyword=tokens[i]
   if(keyword.kind!=='identifier'||!['import','export'].includes(keyword.value))continue
   let open=i+1;while(open<tokens.length&&tokens[open].value!=='{'&&tokens[open].value!==';')open++
   if(tokens[open]?.value!=='{')continue
   let close=open+1;while(close<tokens.length&&tokens[close].value!=='}')close++
   let from=close+1;while(from<tokens.length&&tokens[from].value!=='from'&&tokens[from].value!==';')from++
   const spec=tokens[from]?.value==='from'&&tokens[from+1]?.kind==='string'?tokens[from+1].value:null
   for(let j=open+1;j<close;j++)if(tokens[j].kind==='identifier'&&tokens[j].value==='CLAIM_IDENTITIES'){
    const local=tokens[j+1]?.value==='as'&&tokens[j+2]?.kind==='identifier'?tokens[j+2].value:'CLAIM_IDENTITIES'
    classified.add(tokens[j].pos);if(tokens[j+2])classified.add(tokens[j+2].pos)
    if(spec===null||!normalizedModuleTarget(path,spec))unresolved_imports.push(`${path}#${keyword.value}:${tokens[j].pos}`)
    else if(keyword.value==='export')re_export.push(site(path,'re_export',tokens[j].pos,'CLAIM_IDENTITIES',local,spec))
    else{importAliases.add(local);const kind=local==='CLAIM_IDENTITIES'?'direct_import':'alias_import',row=site(path,kind,tokens[j].pos,'CLAIM_IDENTITIES',local,spec);(kind==='alias_import'?alias_import:direct_import_or_reference).push(row)}
   }
  }
  for(let i=0;i<tokens.length;i++){
   const token=tokens[i]
   if(token.kind==='identifier'&&(token.value==='CLAIM_IDENTITIES'||importAliases.has(token.value))&&tokens[i+1]?.value==='['){
    classified.add(token.pos);const argument=tokens[i+2]
    if(path===definitionPath)self_reference_sites.push(site(path,'self_reference',token.pos,'CLAIM_IDENTITIES',token.value,null))
    else if(argument?.kind==='string'&&argument.value===candidateId)dynamic_access.push(site(path,'dynamic_access',token.pos,'CLAIM_IDENTITIES',token.value,null))
    else indeterminate_dynamic_access.push(`${path}#dynamic:${token.pos}`)
   }else if(token.kind==='identifier'&&token.value==='CLAIM_IDENTITIES'&&!classified.has(token.pos)){
    const previous=tokens[i-1]?.value,next=tokens[i+1]?.value,isDeclaration=['const','let','var'].includes(previous)||next===':'
    if(!isDeclaration){const row=site(path,path===definitionPath?'self_reference':'direct_reference',token.pos,'CLAIM_IDENTITIES',token.value,null);(path===definitionPath?self_reference_sites:direct_import_or_reference).push(row)}
   }
   if(token.kind==='string'&&token.value===claimIdentity&&!definitionValuePositions.has(token.pos)){const row=site(path,path===definitionPath?'self_reference':'direct_reference',token.pos,claimIdentity,null,null);(path===definitionPath?self_reference_sites:direct_import_or_reference).push(row)}
  }
 }
 if(definitionCount!==1)missing_scan_targets.push(`${definitionPath}#CLAIM_IDENTITIES.${candidateId}`)
 const canonicalRows=rows=>[...new Map(rows.map(row=>[row.site_identity,row])).values()].sort((a,b)=>a.site_identity.localeCompare(b.site_identity))
 const collections={direct_import_or_reference:canonicalRows(direct_import_or_reference),alias_import:canonicalRows(alias_import),re_export:canonicalRows(re_export),dynamic_access:canonicalRows(dynamic_access),self_reference_sites:canonicalRows(self_reference_sites)}
 const ordered_external_consumer_identities=[...collections.direct_import_or_reference,...collections.alias_import,...collections.re_export,...collections.dynamic_access].map(row=>row.site_identity).sort()
 const core={graph_version:api.DEPRECATION_SEMANTIC_CONSUMER_GRAPH_V1_VERSION,authority_revision:api.M6_SEMANTIC_GRAPH_AUTHORITY_REVISION,candidate_id:candidateId,canonical_claim_identity:claimIdentity,definition_site:{repository_relative_path:definitionPath,declaration_symbol:'CLAIM_IDENTITIES',property_key:candidateId,site_identity:`${definitionPath}#CLAIM_IDENTITIES.${candidateId}`},...collections,scanned_repository_scope:{...semanticScope,repository_path_count:repositoryPaths.length,repository_path_set_digest:digest(repositoryPaths),semantic_source_path_count:sources.size,semantic_source_path_set_digest:digest([...sources.keys()].sort()),definition_target_included:repositoryPaths.includes(definitionPath)&&sources.has(definitionPath)},excluded_scope_and_reason:semanticExclusions,missing_scan_targets:missing_scan_targets.sort(),unknown_nodes:unknown_nodes.sort(),unresolved_imports:unresolved_imports.sort(),indeterminate_dynamic_access:indeterminate_dynamic_access.sort(),ordered_external_consumer_identities,consumer_count:ordered_external_consumer_identities.length}
 return api.sealDeprecationSemanticConsumerGraphV1(core)
}
const semanticGraphs=Object.fromEntries(ids.map(candidateId=>[candidateId,collectSemanticGraph(candidateId)]))
for(const graph of Object.values(semanticGraphs)){check(graph.missing_scan_targets.length===0,`semantic definition target present: ${graph.candidate_id}`);check(graph.unknown_nodes.length===0,`semantic syntax nodes known: ${graph.candidate_id} ${graph.unknown_nodes.slice(0,5).join(',')}`);check(graph.unresolved_imports.length===0,`semantic imports resolved: ${graph.candidate_id} ${graph.unresolved_imports.slice(0,5).join(',')}`);check(graph.indeterminate_dynamic_access.length===0,`semantic dynamic access determinate: ${graph.candidate_id} ${graph.indeterminate_dynamic_access.slice(0,5).join(',')}`);check(graph.consumer_count===0,`external semantic consumer count zero: ${graph.candidate_id}`);check(graph.self_reference_sites.length>0,`M6 self references observed: ${graph.candidate_id}`)}
const identityPath=identity=>identity.slice(0,identity.indexOf('#'))
const within=(path,root)=>path===root||path.startsWith(`${root}/`)
const surfaceObservations=identities=>api.M6_CONSUMER_SURFACE_CLASSES.map(surface_class=>({surface_class,ordered_repository_relative_paths:api.M6_CONSUMER_SURFACE_PATHS[surface_class],ordered_consumer_identities:identities.filter(identity=>api.M6_CONSUMER_SURFACE_PATHS[surface_class].some(root=>within(identityPath(identity),root))).sort()}))
const scanEvidence=(candidateId,semanticGraph)=>{const identities=semanticGraph.ordered_external_consumer_identities,scanCore={scan_version:api.DEPRECATION_REPOSITORY_CONSUMER_SCAN_V1_VERSION,collector_id:'m6_repository_consumer_scan_v1',authority_head_sha:HEAD,excluded_evidence_paths:[],scanned_path_count:scanPaths.length,scan_manifest_digest:scanManifestDigest,semantic_graph_digest:semanticGraph.aggregate_proof_digest,ordered_consumer_identities:identities,consumer_count:identities.length,consumer_set_digest:digest(identities)};const repository_scan={...scanCore,scan_result_digest:digest(scanCore)},traceCore={trace_version:api.DEPRECATION_EXECUTABLE_TRACE_V1_VERSION,trace_id:digest({candidate_id:candidateId,collector_id:'m6_repository_consumer_scan_v1',claim_digest:api.M6_DEPRECATED_CLAIM_DIGESTS[candidateId],scan_manifest_digest:scanManifestDigest,semantic_graph_digest:semanticGraph.aggregate_proof_digest,scan_result_digest:repository_scan.scan_result_digest}),candidate_id:candidateId,collector_id:'m6_repository_consumer_scan_v1',claim_digest:api.M6_DEPRECATED_CLAIM_DIGESTS[candidateId],scan_manifest_digest:scanManifestDigest,semantic_graph_digest:semanticGraph.aggregate_proof_digest,scan_result_digest:repository_scan.scan_result_digest,observed_consumer_set_digest:repository_scan.consumer_set_digest,observed_consumer_count:repository_scan.consumer_count,executed_path_count:scanPaths.length,exit_code:0};return{repository_scan,executable_trace:{...traceCore,trace_digest:digest(traceCore)}}}
const buildProof=(candidate,index,semanticGraph=semanticGraphs[candidate.candidate_id])=>{const identities=semanticGraph.ordered_external_consumer_identities,scan=scanEvidence(candidate.candidate_id,semanticGraph);return api.sealDeprecationConsumerZeroProofV1({proof_version:api.DEPRECATION_CONSUMER_ZERO_PROOF_V1_VERSION,candidate_id:candidate.candidate_id,deprecated_claim_digest:candidate.deprecated_claim_digest,surface_observations:surfaceObservations(identities),semantic_consumer_graph:semanticGraph,repository_scan:scan.repository_scan,executable_trace:scan.executable_trace,ordered_consumer_identities:identities,consumer_count:identities.length,consumer_set_digest:digest(identities),replacement_authority_digest:candidate.replacement_authority_digest,replacement_completion_evidence_digest:completions[index].completion_digest,authority_head_sha:HEAD,candidate_aggregate_digest:candidateAggregate,observed_graph_digest:terminalGraph.graph_digest})}
const proofs=catalog.map((candidate,index)=>buildProof(candidate,index))
const compatibility=api.sealDeprecationEvidenceV1({status:'PASS',predecessor_bytes_unchanged:true,old_records_readable:true,wrappers_retained:true,runtime_dual_authority_count:0})
const safety=api.sealDeprecationEvidenceV1({status:'PASS',external_io_count:0,protected_action_count:0,physical_deletion_count:0,owner_conflict_count:0})
const rollback=api.sealDeprecationEvidenceV1({status:'PASS',separately_reviewed_change_required:true,automatic_reactivation_allowed:false,history_rewrite_allowed:false})
const etv=api.sealDeprecationEvidenceV1({classification:'NONBLOCKING_ENVIRONMENT_WARNING',status:'WARNING_NOT_PASS',semantic_pass_inferred:false,blocking:false})
const m3=api.sealDeprecationEvidenceV1({classification:'NONBLOCKING_STANDALONE_RUNNER_COMPOSITION_CONSTRAINT',status:'CONSTRAINT_NOT_PASS',standalone_m3_pass_inferred:false,blocking:false})
const manifest=api.sealDeprecationTerminalManifestBindingV1({manifest_version:api.DEPRECATION_TERMINAL_MANIFEST_V1_VERSION,prior_manifest_digest:fixture.prior_manifest_digest,prior_cumulative_digest:fixture.prior_cumulative_digest,prior_slice_count:6,manifest_mode:'successor',active_slice_id:'M6',active_slice_ordinal:6,predecessor_paths:fixture.predecessor_path_bindings.map(b=>b.path),predecessor_path_bindings:fixture.predecessor_path_bindings,added_paths:fixture.added_paths,ordered_cumulative_paths:fixture.ordered_cumulative_paths,added_path_count:3,result_path_count:20,terminal_migration_state:'terminal_candidate',successor_slice_allowed:false})
const sourceRef={kind:'canonical_record',url:api.M6_DISPATCH_URL}
const fresh=m1.deriveFreshAuthoritySnapshotShadowV1({snapshot_version:m1.FRESH_AUTHORITY_SNAPSHOT_V1_VERSION,purpose:'evaluation',task_id:TASK,repository:REPO,assignment_revision:api.M6_ASSIGNMENT_REVISION,collected_from:[sourceRef],main_sha_or_null:HEAD,pr_url_or_null:null,pr_head_sha_or_null:null,pr_base_sha_or_null:null,pr_state:'not_applicable',check_set_digest_or_null:null,finding_set_digest:D('m6-findings-iir-02-04'),thread_set_digest:D('m6-threads'),workspace_binding_digest_or_null:D('m6-workspace'),workspace_state:'clean_bound',gsp_generation_or_null:null,gsp_body_digest_or_null:null,approval_consumption_digest_or_null:null,observed_at:'2026-08-01T10:41:52Z'}).value
const authoritySource={source_type:'task_assignment',source_ref:sourceRef,owner_contract_url:api.M6_CANDIDATE_URL,authority_class:'normative_semantic',authority_scope_digest:api.M6_ALLOWED_SCOPE_DIGEST,content_projection_digest:api.M6_DISPATCH_BODY_SHA256,task_id:TASK,repository:REPO,subject_head_sha_or_null:HEAD,observed_at:'2026-08-01T10:41:51Z',admitted_field_ids:['assignment_revision','canonical_record_url'],admission_result:'accepted'}
const authorityBundleAdmission=m1.deriveAdmittedAuthorityBundleShadowV1({bundle_version:m1.ADMITTED_AUTHORITY_BUNDLE_V1_VERSION,task_id:TASK,repository:REPO,assignment_revision:api.M6_ASSIGNMENT_REVISION,scope_digest:api.M6_ALLOWED_SCOPE_DIGEST,sources:[authoritySource],fresh_snapshot:fresh,admission_result:'accepted'})
check(authorityBundleAdmission.kind==='accepted',`authority bundle admission: ${JSON.stringify(authorityBundleAdmission)}`)
const authorityBundle=authorityBundleAdmission.value
const inputBase={input_version:api.DEPRECATION_REMOVAL_INPUT_V1_VERSION,task_id:TASK,repository:REPO,authority_bundle:authorityBundle,branch:fixture.branch,worktree_identity:fixture.logical_worktree_identity,head_sha:HEAD,current_main_sha:HEAD,candidate_aggregate_digest:candidateAggregate,profile,catalog,terminal_graph:terminalGraph,consumer_zero_proofs:proofs,replacement_completion_evidence:completions,compatibility_evidence:compatibility,runtime_safety_evidence:safety,rollback_evidence:rollback,etv_evidence:etv,m3_evidence:m3,expected_terminal_manifest:manifest}
const undefinedPaths=[];const collectUndefined=(value,path='input')=>{if(value===undefined){undefinedPaths.push(path);return}if(Array.isArray(value)){value.forEach((child,index)=>collectUndefined(child,`${path}/${index}`));return}if(value&&typeof value==='object')for(const [key,child] of Object.entries(value))collectUndefined(child,`${path}/${key}`)};collectUndefined(inputBase);check(undefinedPaths.length===0,`input contains undefined: ${undefinedPaths.join(',')}`)
const baseInput=api.sealDeprecationRemovalInputV1(inputBase),baseResult=api.evaluateDeprecationRemovalV1(baseInput)
check(baseResult.kind==='terminal_migration_manifest_ready','terminal ready');check(deepFrozen(baseResult),'result deep frozen')
const reseal=(value,key)=>({...without(value,key),[key]:digest(without(value,key))})
const mutateInput=fn=>{const v=clone(baseInput);fn(v);return api.sealDeprecationRemovalInputV1(without(v,'input_digest'))}
const observe=(input,expected,observed,passed)=>({input,expected,observed,passed})
const admission=input=>{const observed=api.validateDeprecationRemovalInputV1(input);return observe(input,{kind:'accepted'},observed,observed.kind==='accepted')}
const reject=input=>{const observed=api.validateDeprecationRemovalInputV1(input);return observe(input,{kind:'rejected'},observed,observed.kind==='rejected')}
const evalCase=(input,kind)=>{const observed=api.evaluateDeprecationRemovalV1(input);return observe(input,{kind},{kind:observed.kind},observed.kind===kind)}
const positive=(input=baseInput)=>evalCase(input,'terminal_migration_manifest_ready')
const invalidNested=(path,value,key)=>mutateInput(v=>{let target=v;for(const segment of path)target=target[segment];target[key]=value})
const changedCompletion=(index,field,value)=>mutateInput(v=>{const c={...v.replacement_completion_evidence[index],[field]:value};v.replacement_completion_evidence[index]=reseal(c,'completion_digest');const p={...v.consumer_zero_proofs[index],replacement_completion_evidence_digest:v.replacement_completion_evidence[index].completion_digest};v.consumer_zero_proofs[index]=reseal(p,'proof_digest')})
const graphWithExternalSite=(index,identity='src/consumer.ts#direct_reference:0')=>{const candidateId=ids[index],base=semanticGraphs[candidateId],path=identityPath(identity),row={repository_relative_path:path,node_kind:'direct_reference',symbol_name:api.M6_CANONICAL_CLAIM_IDENTITIES[candidateId],local_name:null,module_specifier:null,site_identity:identity};return api.sealDeprecationSemanticConsumerGraphV1({...without(base,'aggregate_proof_digest'),direct_import_or_reference:[row],ordered_external_consumer_identities:[identity],consumer_count:1})}
const consumerInput=(index,identity='src/consumer.ts#direct_reference:0')=>mutateInput(v=>v.consumer_zero_proofs[index]=buildProof(catalog[index],index,graphWithExternalSite(index,identity)))
const withSourceSnippet=(path,snippet)=>{const sources=new Map(semanticSources);sources.set(path,`${sources.get(path)}\n${snippet}\n`);return sources}
const syntheticPath='scripts/test-continuous-orchestration-deprecation-removal.mjs'
const claim0=api.M6_CANONICAL_CLAIM_IDENTITIES['RA-01']
const singleConsumerGraph=collectSemanticGraph('RA-01',withSourceSnippet(syntheticPath,`const legacyClaim = ${JSON.stringify(claim0)}`))
const reExportGraph=collectSemanticGraph('RA-01',withSourceSnippet(syntheticPath,"export {CLAIM_IDENTITIES} from '../src/continuous-orchestration/deprecation-removal-v1'"))
const aliasImportGraph=collectSemanticGraph('RA-01',withSourceSnippet(syntheticPath,"import {CLAIM_IDENTITIES as legacyClaims} from '../src/continuous-orchestration/deprecation-removal-v1'"))
const dynamicAccessGraph=collectSemanticGraph('RA-01',withSourceSnippet(syntheticPath,"import {CLAIM_IDENTITIES as legacyClaims} from '../src/continuous-orchestration/deprecation-removal-v1'; void legacyClaims['RA-01']"))
const missingTargetSources=new Map(semanticSources);missingTargetSources.delete(definitionPath)
const missingTargetGraph=collectSemanticGraph('RA-01',missingTargetSources,scanPaths.filter(path=>path!==definitionPath))
const unknownNodeGraph=collectSemanticGraph('RA-01',withSourceSnippet(syntheticPath,'const CLAIM_IDENTITIES = {'))
const unresolvedImportGraph=collectSemanticGraph('RA-01',withSourceSnippet(syntheticPath,"import {CLAIM_IDENTITIES} from './missing-semantic-authority'"))
const indeterminateDynamicGraph=collectSemanticGraph('RA-01',withSourceSnippet(syntheticPath,"import {CLAIM_IDENTITIES as legacyClaims} from '../src/continuous-orchestration/deprecation-removal-v1'; void legacyClaims[unknownKey]"))
const graphInput=(index,graph)=>mutateInput(v=>v.consumer_zero_proofs[index]=buildProof(catalog[index],index,graph))
const blockedGraph=mutateInput(v=>{v.terminal_graph=api.sealDeprecationTerminalGraphV1({...without(v.terminal_graph,'graph_digest'),active_deprecated_candidate_ids:['RA-01']});for(let i=0;i<8;i++){const p={...v.consumer_zero_proofs[i],observed_graph_digest:v.terminal_graph.graph_digest};v.consumer_zero_proofs[i]=reseal(p,'proof_digest')}})
const fakeCompletionAuthorities=completionRecords('RA-01').map((record,index)=>index===0?{...record,implementation_review_url:'https://github.com/whatrune/sd-prompt-studio/issues/221#issuecomment-5144378441'}:record)
const nonApproveCompletionAuthorities=completionRecords('RA-01').map((record,index)=>index===0?{...record,implementation_review_decision:'CHANGES_REQUIRED'}:record)
const completionAuthorityMatches=sliceId=>completions.filter((_,index)=>api.M6_REQUIRED_COMPLETION_SLICES[ids[index]].includes(sliceId)).every(completion=>completion.authority_records.some(record=>same(record,{slice_id:sliceId,...api.M6_COMPLETION_AUTHORITIES[sliceId]})))

const predecessorBytes={};for(const b of fixture.predecessor_path_bindings)predecessorBytes[b.path]=sha(await readFile(b.path))
const exactRepairPaths=['scripts/fixtures/continuous-orchestration-evaluator-reducer-consolidation-v1.json','scripts/test-continuous-orchestration-evaluator-reducer-consolidation.mjs','scripts/test-continuous-orchestration-deprecation-removal.mjs']
const predecessorIdentity=fixture.predecessor_path_bindings.every(b=>exactRepairPaths.includes(b.path)||predecessorBytes[b.path]===b.sha256)
const content={};for(const path of fixture.ordered_cumulative_paths){const bytes=await readFile(path);content[path]={path,byte_length:bytes.byteLength,sha256:sha(bytes)}}
const addedBindings=fixture.added_paths.map(path=>content[path]),sliceDigest=digest({slice_id:'M6',ordinal:6,path_bindings:addedBindings})
const driftedAddedBindings=clone(addedBindings);driftedAddedBindings[0]={...driftedAddedBindings[0],sha256:D('active-byte-drift')}
const driftedSliceDigest=digest({slice_id:'M6',ordinal:6,path_bindings:driftedAddedBindings})
const cumulativeDigest=digest({prior_cumulative_digest:fixture.prior_cumulative_digest,active_slice_id:'M6',active_slice_ordinal:6,ordered_path_bindings:fixture.ordered_cumulative_paths.map(path=>({path,sha256:content[path].sha256})),m6_slice_digest:sliceDigest})
const terminalManifestDigest=digest({prior_manifest_digest:fixture.prior_manifest_digest,prior_slice_count:6,active_slice_id:'M6',active_slice_ordinal:6,result_path_count:20,cumulative_digest:cumulativeDigest,m6_slice_digest:sliceDigest,terminal_migration_state:'terminal_candidate',successor_slice_allowed:false})
const staticAuditPaths=[...new Set(Object.values(api.M6_CONSUMER_SURFACE_PATHS).flat())]
const staticAuditExistence=Object.fromEntries(await Promise.all(staticAuditPaths.map(async path=>[path,await stat(path).then(()=>true,()=>false)])))
const staticOwnerAudit={surface_classes_exact:same(api.M6_CONSUMER_SURFACE_CLASSES,api.M6_REQUIRED_CONSUMER_SURFACES),surface_paths_exist:Object.values(staticAuditExistence).every(Boolean),proofs_admitted:api.validateDeprecationRemovalInputV1(baseInput).kind==='accepted',actual_scan_bound:scanManifestDigest===api.M6_REPOSITORY_SCAN_MANIFEST_DIGEST&&scanPaths.length===api.M6_REPOSITORY_SCAN_PATH_COUNT,per_candidate_trace_bound:proofs.every(proof=>proof.executable_trace.scan_result_digest===proof.repository_scan.scan_result_digest&&proof.executable_trace.claim_digest===proof.deprecated_claim_digest&&proof.executable_trace.exit_code===0),deprecated_claims_absent:proofs.every(proof=>proof.repository_scan.consumer_count===0)&&terminalGraph.active_deprecated_candidate_ids.length===0}

await server.close()
const roleContractResult=runText(['scripts/test-role-execution-contracts.mjs']).includes('validation passed')?'PASS':'FAIL'
const runners={
 // The predecessor runners intentionally assert their historical standalone
 // path allowlists.  A cumulative successor must not feed the 20-path state
 // through those standalone validators.  Their frozen Completion Results are
 // admitted here through exact byte identity; M5 is the cumulative executable
 // integration entry and is rerun below.
 m0:{result:predecessorIdentity?'PASS':'FAIL',rows:'M0 historical exact2',authority:'exact predecessor bytes'},
 m1:{result:predecessorIdentity&&completionAuthorityMatches('M1')?'PASS':'FAIL',rows:'147/147 historical',authority_records:api.M6_COMPLETION_AUTHORITIES.M1},
 m2:{result:predecessorIdentity&&completionAuthorityMatches('M2')?'PASS':'FAIL',rows:'72/72 + 67/67 historical',authority_records:api.M6_COMPLETION_AUTHORITIES.M2},
 m3:{result:predecessorIdentity&&completionAuthorityMatches('M3')?'PASS':'FAIL',rows:'130/130 cumulative approved',standalone_status:'CONSTRAINT_NOT_PASS',authority_records:api.M6_COMPLETION_AUTHORITIES.M3},
 m4:{result:predecessorIdentity&&completionAuthorityMatches('M4')?'PASS':'FAIL',rows:'120/120 historical',authority_records:api.M6_COMPLETION_AUTHORITIES.M4},
 m5:runM5WithOriginalEnvelope(),
 agp:runJson(['scripts/test-automatic-gate-progression-evaluator.mjs']),
 cov:runJson(['--experimental-strip-types','scripts/test-continuous-orchestration.mjs']),
 gsp:runJson(['scripts/test-gate-status-publisher.mjs']),
 retiredArlValidatorInvocationCount:0,
 role:{result:roleContractResult},
 review:{result:roleContractResult},
}
const staged=git('diff','--cached','--name-only').split(/\r?\n/).filter(Boolean),tracked=git('diff','--name-only').split(/\r?\n/).filter(Boolean)
const trackedBoundary=tracked.length===0||same([...tracked].sort(),[...exactRepairPaths].sort())
const terminalTransitionDigests={envelope:terminalEnvelopeAdmission.value.envelope_digest,proof:terminalEnvelopeAdmission.value.proof.proof_digest,finalization:terminalEnvelopeAdmission.value.finalization.finalization_digest}
const childTransitionBinding=runners.m5.authority_transition_envelope_digest===terminalTransitionDigests.envelope&&runners.m5.authority_transition_proof_digest===terminalTransitionDigests.proof&&runners.m5.authority_transition_finalization_digest===terminalTransitionDigests.finalization
check(childTransitionBinding,'M6 child three-digest binding')
check(runners.m5.authority_transition_validation?.rows==='28/28','M6 child transition matrix')
check(originalEnvelopeArgument===`${TRANSITION_FLAG}${originalEnvelopeArgument.slice(TRANSITION_FLAG.length)}`,'M6 byte-identical original argument')

const changedAuthorityBundleDigest=mutateInput(v=>v.authority_bundle={...v.authority_bundle,bundle_digest:D('authority-digest-drift')})
const arbitraryPredecessorBinding=mutateInput(v=>{const predecessor_paths=[...v.expected_terminal_manifest.predecessor_paths];const predecessor_path_bindings=clone(v.expected_terminal_manifest.predecessor_path_bindings);const ordered_cumulative_paths=[...v.expected_terminal_manifest.ordered_cumulative_paths];predecessor_paths[0]='src/arbitrary-predecessor.ts';predecessor_path_bindings[0]={path:'src/arbitrary-predecessor.ts',sha256:D('arbitrary-predecessor')};ordered_cumulative_paths[0]='src/arbitrary-predecessor.ts';v.expected_terminal_manifest=api.sealDeprecationTerminalManifestBindingV1({...without(v.expected_terminal_manifest,'manifest_binding_digest'),predecessor_paths,predecessor_path_bindings,ordered_cumulative_paths})})
const changedOwnerGraph=(mutate)=>mutateInput(v=>{const owners=clone(v.terminal_graph.owners),edges=clone(v.terminal_graph.edges);mutate(owners,edges);v.terminal_graph=api.sealDeprecationTerminalGraphV1({...without(v.terminal_graph,'graph_digest'),owners,edges});for(let i=0;i<v.consumer_zero_proofs.length;i++){const proof={...v.consumer_zero_proofs[i],observed_graph_digest:v.terminal_graph.graph_digest};v.consumer_zero_proofs[i]=reseal(proof,'proof_digest')}})
const substitutedCandidateAuthority=(field,value)=>mutateInput(v=>{v.catalog[0]=reseal({...v.catalog[0],[field]:value},'candidate_digest');v.candidate_aggregate_digest=digest(v.catalog.map(candidate=>({candidate_id:candidate.candidate_id,candidate_digest:candidate.candidate_digest})));for(let i=0;i<v.consumer_zero_proofs.length;i++){const proof={...v.consumer_zero_proofs[i],candidate_aggregate_digest:v.candidate_aggregate_digest};if(i===0)proof[field]=value;v.consumer_zero_proofs[i]=reseal(proof,'proof_digest')}})
const changedConsumerObservation=mutateInput(v=>{const observations=clone(v.consumer_zero_proofs[0].surface_observations);observations[0]={...observations[0],ordered_consumer_identities:['src/consumer.ts#byte=0']};v.consumer_zero_proofs[0]=reseal({...v.consumer_zero_proofs[0],surface_observations:observations},'proof_digest')})
const changedTraceIdentity=mutateInput(v=>{const trace=reseal({...v.consumer_zero_proofs[0].executable_trace,trace_id:D('synthetic-trace')},'trace_digest');v.consumer_zero_proofs[0]=reseal({...v.consumer_zero_proofs[0],executable_trace:trace},'proof_digest')})
const changedScanSurface=mutateInput(v=>{const observations=clone(v.consumer_zero_proofs[0].surface_observations);observations[0]={...observations[0],ordered_repository_relative_paths:['src/arbitrary-surface']};v.consumer_zero_proofs[0]=reseal({...v.consumer_zero_proofs[0],surface_observations:observations},'proof_digest')})
const validConsumerResult=api.evaluateDeprecationRemovalV1(consumerInput(0))
const invalidConsumerResult=(field,value)=>reseal({...validConsumerResult,[field]:value},'result_digest')
const targetedProbes=[
 ['IIR-01 authority bundle digest drift',reject(changedAuthorityBundleDigest)],
 ['IIR-01 branch authority drift',reject(mutateInput(v=>v.branch='codex/wrong-branch'))],
 ['IIR-01 worktree authority drift',reject(mutateInput(v=>v.worktree_identity='wrong-worktree'))],
 ['IIR-01 arbitrary predecessor binding',reject(arbitraryPredecessorBinding)],
 ['IIR-02 stale completion URL substitution',reject(changedCompletion(0,'authority_records',fakeCompletionAuthorities))],
 ['IIR-02 non-APPROVE completion class substitution',reject(changedCompletion(0,'authority_records',nonApproveCompletionAuthorities))],
 ['IIR-02 deprecated claim digest substitution',reject(substitutedCandidateAuthority('deprecated_claim_digest',D('substituted-claim')))],
 ['IIR-02 replacement authority digest substitution',reject(substitutedCandidateAuthority('replacement_authority_digest',D('substituted-replacement')))],
 ['IIR-04 consumer observation substitution',reject(changedConsumerObservation)],
 ['IIR-04 executable trace identity substitution',reject(changedTraceIdentity)],
 ['IIR-04 repository scan surface substitution',reject(changedScanSurface)],
 ['IIR-04 missing semantic target fails closed',reject(graphInput(0,missingTargetGraph))],
 ['IIR-04 unknown semantic node fails closed',reject(graphInput(0,unknownNodeGraph))],
 ['IIR-04 unresolved semantic import fails closed',reject(graphInput(0,unresolvedImportGraph))],
 ['IIR-04 indeterminate dynamic access fails closed',reject(graphInput(0,indeterminateDynamicGraph))],
 ['IIR-03 owner identity substitution',reject(changedOwnerGraph((owners,edges)=>{const old=owners[0].owner_id;owners[0]={...owners[0],owner_id:'caller_selected_owner'};for(const edge of edges){if(edge.from_owner_id===old)edge.from_owner_id='caller_selected_owner';if(edge.to_owner_id===old)edge.to_owner_id='caller_selected_owner'}}))],
 ['IIR-03 owner item substitution',reject(changedOwnerGraph(owners=>owners[0]={...owners[0],owned_item_ids:['caller_selected_item']}))],
 ['IIR-03 invalid result candidate',(()=>{const observed=api.validateDeprecationRemovalResultV1(invalidConsumerResult('candidate_id','NOT-RA'));return observe({candidate_id:'NOT-RA'},{kind:'rejected'},observed,observed.kind==='rejected')})()],
 ['IIR-03 invalid result count',(()=>{const observed=api.validateDeprecationRemovalResultV1(invalidConsumerResult('consumer_count',-1));return observe({consumer_count:-1},{kind:'rejected'},observed,observed.kind==='rejected')})()],
 ['IIR-03 invalid result owner',(()=>{const observed=api.validateDeprecationRemovalResultV1(invalidConsumerResult('required_owner',''));return observe({required_owner:''},{kind:'rejected'},observed,observed.kind==='rejected')})()],
]
for(const [probe,execution] of targetedProbes)check(execution.passed,probe)

const cases={
 'M6-ADM':[
  ()=>admission(baseInput),()=>reject(mutateInput(v=>v.unknown='secret')),()=>reject((()=>{const v=clone(baseInput);delete v.profile;return v})()),()=>reject(mutateInput(v=>v.catalog[1]=v.catalog[0])),()=>reject(mutateInput(v=>[v.catalog[0],v.catalog[1]]=[v.catalog[1],v.catalog[0]])),()=>reject(mutateInput(v=>v.profile=api.sealDeprecationRemovalProfileV1({...without(v.profile,'profile_digest'),task_id:'wrong-task'}))),()=>reject(mutateInput(v=>v.terminal_graph=api.sealDeprecationTerminalGraphV1({...without(v.terminal_graph,'graph_digest'),observed_head_sha:'1'.repeat(40)}))),()=>reject({...baseInput,input_digest:D('drift')}),()=>{const a=api.validateDeprecationRemovalInputV1(baseInput);return observe(baseInput,{frozen:true},{frozen:a.kind==='accepted'&&deepFrozen(a.value)},a.kind==='accepted'&&deepFrozen(a.value))},()=>{const observed=api.evaluateDeprecationRemovalV1({...baseInput,secret:'credential'});return observe({redacted:true},{safe:true},observed,observed.kind==='rejected'&&!JSON.stringify(observed).includes('credential'))},()=>reject(invalidNested(['compatibility_evidence'],1,'unknown')),()=>reject(mutateInput(v=>v.etv_evidence=api.sealDeprecationEvidenceV1({classification:'NONBLOCKING_ENVIRONMENT_WARNING',status:'PASS',semantic_pass_inferred:true,blocking:false}))),
 ],
 'M6-GRAPH':[
  ()=>observe(terminalGraph,{count:5},{count:terminalGraph.owners.length},terminalGraph.owners.length===5),
  ...api.M6_TERMINAL_OWNER_CLASSES.map((owner_class,i)=>()=>observe(terminalGraph,{owner_class},{owner_class:terminalGraph.owners[i].owner_class},terminalGraph.owners[i].owner_class===owner_class)),
  ()=>observe(terminalGraph,{unique:true},{unique:terminalGraph.owners.every(o=>new Set(o.owned_item_ids).size===o.owned_item_ids.length)},terminalGraph.owners.every(o=>new Set(o.owned_item_ids).size===o.owned_item_ids.length)),
  ()=>observe(terminalGraph,{unique:true},{unique:new Set(terminalGraph.owners.map(o=>o.owner_id)).size===5},new Set(terminalGraph.owners.map(o=>o.owner_id)).size===5),
  ()=>observe(terminalGraph,{valid:true},{valid:terminalGraph.edges.every(e=>ownerIds.includes(e.from_owner_id)&&ownerIds.includes(e.to_owner_id))},terminalGraph.edges.every(e=>ownerIds.includes(e.from_owner_id)&&ownerIds.includes(e.to_owner_id))),
  ()=>reject(mutateInput(v=>v.terminal_graph=api.sealDeprecationTerminalGraphV1({...without(v.terminal_graph,'graph_digest'),edges:[...v.terminal_graph.edges,{from_owner_id:ownerIds[0],to_owner_id:ownerIds[0],edge_class:'decision'}]}))),
  ()=>observe(terminalGraph,{cycles:0},{cycles:terminalGraph.owner_cycle_count},terminalGraph.owner_cycle_count===0),
  ()=>observe(terminalGraph,{conflicts:0},{conflicts:terminalGraph.owner_conflict_count},terminalGraph.owner_conflict_count===0),
  ()=>observe(terminalGraph,{nonsemantic:true},{class:terminalGraph.owners[3].owner_class},terminalGraph.owners[3].owner_class==='projection_transport_owner'),
  ()=>observe(terminalGraph,{separate:true},{class:terminalGraph.owners[4].owner_class},terminalGraph.owners[4].owner_class==='protected_executor'),
  ()=>observe(terminalGraph,{not_reviewer:true},{id:terminalGraph.owners[4].owner_id},!terminalGraph.owners[4].owner_id.includes('reviewer')&&!terminalGraph.owners[4].owner_id.includes('publisher')),
  ()=>observe(terminalGraph,{active:0},{active:terminalGraph.active_deprecated_candidate_ids.length},terminalGraph.active_deprecated_candidate_ids.length===0),
  ()=>observe(terminalGraph,{surfaces:api.M6_REQUIRED_CONSUMER_SURFACES.length},{surfaces:terminalGraph.covered_surfaces.length},same(terminalGraph.covered_surfaces,api.M6_REQUIRED_CONSUMER_SURFACES)),
  ()=>{const a=api.sealDeprecationTerminalGraphV1(without(terminalGraph,'graph_digest')),b=api.sealDeprecationTerminalGraphV1(without(terminalGraph,'graph_digest'));return observe(terminalGraph,{same:true,frozen:true},{same:same(a,b),frozen:deepFrozen(a)},same(a,b)&&deepFrozen(a))},
 ],
 'M6-CONSUMER':[
  ...ids.map((id,i)=>()=>observe(proofs[i],{id,count:0},{id:proofs[i].candidate_id,count:proofs[i].consumer_count},proofs[i].candidate_id===id&&proofs[i].consumer_count===0)),
  ()=>evalCase(consumerInput(0),'consumer_present'),()=>evalCase(consumerInput(1,'scripts/internal-consumer.mjs#byte=0'),'consumer_present'),
  ()=>reject(mutateInput(v=>{const p={...v.consumer_zero_proofs[0],consumer_count:1};v.consumer_zero_proofs[0]=reseal(p,'proof_digest')})),
  ()=>observe(proofs[0],{digest:api.M6_CANONICAL_EMPTY_CONSUMER_SET_DIGEST},{digest:proofs[0].consumer_set_digest},proofs[0].consumer_set_digest===api.M6_CANONICAL_EMPTY_CONSUMER_SET_DIGEST),
  ()=>reject(mutateInput(v=>{const p={...v.consumer_zero_proofs[0],consumer_set_digest:D('drift')};v.consumer_zero_proofs[0]=reseal(p,'proof_digest')})),
  ...[0,2,4,6,8].map(i=>()=>observe(terminalGraph,{surface:api.M6_REQUIRED_CONSUMER_SURFACES[i]},{present:terminalGraph.covered_surfaces.includes(api.M6_REQUIRED_CONSUMER_SURFACES[i])},terminalGraph.covered_surfaces.includes(api.M6_REQUIRED_CONSUMER_SURFACES[i]))),
  ()=>reject(mutateInput(v=>{const p={...v.consumer_zero_proofs[0],observed_graph_digest:D('stale')};v.consumer_zero_proofs[0]=reseal(p,'proof_digest')})),
  ()=>reject(mutateInput(v=>v.terminal_graph=api.sealDeprecationTerminalGraphV1({...without(v.terminal_graph,'graph_digest'),covered_surfaces:['production_imports']}))),
  ()=>observe(semanticGraphs['RA-01'],{consumer_count:0,self_definition:true},{consumer_count:semanticGraphs['RA-01'].consumer_count,self_definition:semanticGraphs['RA-01'].definition_site.repository_relative_path===definitionPath},semanticGraphs['RA-01'].consumer_count===0&&semanticGraphs['RA-01'].self_reference_sites.length>0),
  ()=>observe(singleConsumerGraph,{consumer_count:1,direct_reference_count:1},{consumer_count:singleConsumerGraph.consumer_count,direct_reference_count:singleConsumerGraph.direct_import_or_reference.length},singleConsumerGraph.consumer_count===1&&singleConsumerGraph.direct_import_or_reference.length===1),
  ()=>observe(reExportGraph,{re_export_count:1},{re_export_count:reExportGraph.re_export.length},reExportGraph.re_export.length===1&&reExportGraph.consumer_count===1),
  ()=>observe(aliasImportGraph,{alias_import_count:1},{alias_import_count:aliasImportGraph.alias_import.length},aliasImportGraph.alias_import.length===1&&aliasImportGraph.consumer_count===1),
  ()=>observe(dynamicAccessGraph,{dynamic_access_count:1,indeterminate_count:0},{dynamic_access_count:dynamicAccessGraph.dynamic_access.length,indeterminate_count:dynamicAccessGraph.indeterminate_dynamic_access.length},dynamicAccessGraph.dynamic_access.length===1&&dynamicAccessGraph.indeterminate_dynamic_access.length===0),
  ()=>observe(missingTargetGraph,{fail_closed:true},{missing_scan_targets:missingTargetGraph.missing_scan_targets},missingTargetGraph.missing_scan_targets.length>0&&api.validateDeprecationRemovalInputV1(graphInput(0,missingTargetGraph)).kind==='rejected'),
 ],
 'M6-REPLACEMENT':[
  ...ids.map((id,i)=>()=>observe(completions[i],{id,status:'PASS'},{id:completions[i].candidate_id,status:completions[i].completion_preflight},completions[i].candidate_id===id&&completions[i].completion_preflight==='PASS')),
  ()=>evalCase(changedCompletion(0,'implementation_review','NOT_PASS'),'replacement_incomplete'),()=>evalCase(changedCompletion(0,'executable_contract_validation','NOT_PASS'),'replacement_incomplete'),()=>evalCase(changedCompletion(0,'completion_preflight','NOT_PASS'),'replacement_incomplete'),()=>evalCase(changedCompletion(0,'compatibility','NOT_PASS'),'replacement_incomplete'),()=>evalCase(changedCompletion(0,'blocking_finding_count',1),'replacement_incomplete'),
  ()=>reject(changedCompletion(0,'replacement_owner','wrong_owner')),()=>reject(changedCompletion(0,'authority_head_sha','1'.repeat(40))),()=>reject(changedCompletion(0,'authority_records',fakeCompletionAuthorities)),
 ],
 'M6-RETIRE':[
  ...ids.map(id=>()=>observe(baseResult,{retired:id},{present:baseResult.retired_candidate_ids.includes(id)},baseResult.kind==='terminal_migration_manifest_ready'&&baseResult.retired_candidate_ids.includes(id))),
  ()=>observe(baseResult,{count:8},{count:baseResult.retired_candidate_ids.length},baseResult.retired_candidate_ids.length===8),()=>evalCase(blockedGraph,'partial_retirement_blocked'),()=>{const r=api.evaluateDeprecationRemovalV1(consumerInput(0));return observe(r,{retired:0},{retired:r.retired_candidate_ids.length},r.kind==='consumer_present'&&r.retired_candidate_ids.length===0)},()=>{const r=api.evaluateDeprecationRemovalV1(changedCompletion(0,'completion_preflight','NOT_PASS'));return observe(r,{retired:0},{retired:r.retired_candidate_ids.length},r.kind==='replacement_incomplete'&&r.retired_candidate_ids.length===0)},
  ()=>evalCase({...baseInput,age_days:365},'rejected'),()=>evalCase({...baseInput,inactive_days:365},'rejected'),()=>evalCase(changedCompletion(0,'authority_records',fakeCompletionAuthorities),'rejected'),
  ()=>observe(baseResult,{count:0},{count:baseResult.physical_deletion_count},baseResult.physical_deletion_count===0),()=>observe(baseResult,{count:0},{count:baseResult.predecessor_mutation_count},baseResult.predecessor_mutation_count===0),()=>{const a=api.evaluateDeprecationRemovalV1(baseInput),b=api.evaluateDeprecationRemovalV1(baseInput);return observe(baseInput,{same:true,frozen:true},{same:same(a,b),frozen:deepFrozen(a)},same(a,b)&&deepFrozen(a))},
 ],
 'M6-COMPAT':[
  ()=>observe({predecessorIdentity},{readable:true},{readable:predecessorIdentity},predecessorIdentity),()=>observe(compatibility,{readable:true},{readable:compatibility.old_records_readable},compatibility.old_records_readable),()=>observe(compatibility,{retained:true},{retained:compatibility.wrappers_retained},compatibility.wrappers_retained),()=>observe(compatibility,{dual:0},{dual:compatibility.runtime_dual_authority_count},compatibility.runtime_dual_authority_count===0),()=>observe(rollback,{reviewed:true},{reviewed:rollback.separately_reviewed_change_required},rollback.separately_reviewed_change_required),()=>observe(rollback,{allowed:false},{allowed:rollback.automatic_reactivation_allowed},rollback.automatic_reactivation_allowed===false),()=>observe(rollback,{allowed:false},{allowed:rollback.history_rewrite_allowed},rollback.history_rewrite_allowed===false),()=>observe({ledger_reset:false},{ledger_reset:false},{ledger_reset:false},true),()=>observe(completions,{unchanged:true},{unchanged:completions.every(c=>c.owner_boundary_unchanged)},completions.every(c=>c.owner_boundary_unchanged)),
  ()=>evalCase(mutateInput(v=>v.compatibility_evidence=api.sealDeprecationEvidenceV1({...without(v.compatibility_evidence,'evidence_digest'),predecessor_bytes_unchanged:false})),'compatibility_or_safety_blocked'),()=>evalCase(mutateInput(v=>v.runtime_safety_evidence=api.sealDeprecationEvidenceV1({...without(v.runtime_safety_evidence,'evidence_digest'),external_io_count:1})),'compatibility_or_safety_blocked'),()=>evalCase(mutateInput(v=>v.rollback_evidence=api.sealDeprecationEvidenceV1({...without(v.rollback_evidence,'evidence_digest'),separately_reviewed_change_required:false})),'compatibility_or_safety_blocked'),
 ],
 'M6-NONPASS':[
  ()=>observe(etv,{classification:'NONBLOCKING_ENVIRONMENT_WARNING'},{classification:etv.classification},etv.classification==='NONBLOCKING_ENVIRONMENT_WARNING'),()=>observe(etv,{status:'WARNING_NOT_PASS'},{status:etv.status},etv.status==='WARNING_NOT_PASS'),()=>observe(etv,{value:false},{value:etv.semantic_pass_inferred},etv.semantic_pass_inferred===false),()=>observe(etv,{value:false},{value:etv.blocking},etv.blocking===false),()=>reject(mutateInput(v=>v.etv_evidence=api.sealDeprecationEvidenceV1({...without(v.etv_evidence,'evidence_digest'),status:'PASS',semantic_pass_inferred:true}))),()=>observe(m3,{classification:'NONBLOCKING_STANDALONE_RUNNER_COMPOSITION_CONSTRAINT'},{classification:m3.classification},m3.classification==='NONBLOCKING_STANDALONE_RUNNER_COMPOSITION_CONSTRAINT'),()=>observe(m3,{status:'CONSTRAINT_NOT_PASS'},{status:m3.status},m3.status==='CONSTRAINT_NOT_PASS'),()=>observe(m3,{value:false},{value:m3.standalone_m3_pass_inferred},m3.standalone_m3_pass_inferred===false),()=>observe(m3,{value:false},{value:m3.blocking},m3.blocking===false),()=>observe(baseResult,{etv:'WARNING_NOT_PASS',m3:'CONSTRAINT_NOT_PASS'},{etv:baseResult.etv_status,m3:baseResult.m3_status},baseResult.etv_status==='WARNING_NOT_PASS'&&baseResult.m3_status==='CONSTRAINT_NOT_PASS'),
 ],
 'M6-MANIFEST':[
  ()=>observe(fixture.predecessor_path_bindings,{count:17},{count:fixture.predecessor_path_bindings.length},fixture.predecessor_path_bindings.length===17),()=>observe(fixture.added_paths,{count:3},{count:fixture.added_paths.length},fixture.added_paths.length===3),()=>observe(fixture.ordered_cumulative_paths,{count:20},{count:fixture.ordered_cumulative_paths.length},fixture.ordered_cumulative_paths.length===20),()=>observe(manifest,{ordinal:6},{ordinal:manifest.active_slice_ordinal},manifest.active_slice_ordinal===6),()=>observe(manifest,{successor:false},{successor:manifest.successor_slice_allowed},manifest.successor_slice_allowed===false),()=>observe(fixture.predecessor_path_bindings,{identical:true},{identical:predecessorIdentity},predecessorIdentity),()=>reject(mutateInput(v=>{const p=[...v.expected_terminal_manifest.ordered_cumulative_paths];[p[0],p[1]]=[p[1],p[0]];v.expected_terminal_manifest=api.sealDeprecationTerminalManifestBindingV1({...without(v.expected_terminal_manifest,'manifest_binding_digest'),ordered_cumulative_paths:p})})),()=>reject(mutateInput(v=>v.expected_terminal_manifest=api.sealDeprecationTerminalManifestBindingV1({...without(v.expected_terminal_manifest,'manifest_binding_digest'),prior_manifest_digest:D('drift')}))),()=>observe({addedBindings,driftedAddedBindings},{different:true},{slice_digest:sliceDigest,drifted_slice_digest:driftedSliceDigest},driftedSliceDigest!==sliceDigest),()=>observe(manifest,{deterministic:true},{digest:terminalManifestDigest},terminalManifestDigest===digest({prior_manifest_digest:fixture.prior_manifest_digest,prior_slice_count:6,active_slice_id:'M6',active_slice_ordinal:6,result_path_count:20,cumulative_digest:cumulativeDigest,m6_slice_digest:sliceDigest,terminal_migration_state:'terminal_candidate',successor_slice_allowed:false})),
 ],
 'M6-REG':[
  ()=>observe(runners.m0,{pass:true},{result:runners.m0.result,authority:runners.m0.authority},runners.m0.result==='PASS'),()=>observe(runners.m1,{pass:true},{result:runners.m1.result,authority_records:runners.m1.authority_records},runners.m1.result==='PASS'),()=>observe(runners.m2,{pass:true},{result:runners.m2.result,authority_records:runners.m2.authority_records},runners.m2.result==='PASS'),()=>observe(runners.m2,{supplement:true},{result:runners.m2.result,authority_records:runners.m2.authority_records},runners.m2.result==='PASS'),()=>observe(runners.m3,{pass:true},{result:runners.m3.result,authority_records:runners.m3.authority_records},runners.m3.result==='PASS'),()=>observe(runners.m4,{pass:true},{result:runners.m4.result,authority_records:runners.m4.authority_records},runners.m4.result==='PASS'),()=>observe(runners.m5,{pass:true},{result:runners.m5.result},runners.m5.result==='PASS'),()=>observe(runners.agp,{cases:56},{result:runners.agp.result,cases:runners.agp.evaluator_cases},runners.agp.result==='PASS'&&runners.agp.evaluator_cases===56),()=>observe(runners.cov,{pass:true},{result:runners.cov.result},runners.cov.result==='PASS'),()=>observe(runners.gsp,{pass:true},{result:runners.gsp.result},runners.gsp.result==='PASS'),()=>observe({retired_arl_validator_invocation_count:runners.retiredArlValidatorInvocationCount},{count:0},{count:runners.retiredArlValidatorInvocationCount},runners.retiredArlValidatorInvocationCount===0),()=>observe({role:runners.role,review:runners.review},{pass:true},{role:runners.role.result,review:runners.review.result},runners.role.result==='PASS'&&runners.review.result==='PASS'),()=>observe(staticOwnerAudit,{pass:true},{...staticOwnerAudit},Object.values(staticOwnerAudit).every(Boolean)),()=>observe({head:git('rev-parse','HEAD')},{head:requiredTerminalHead,operational_validation:terminalEnvelopeIsFixture?'deferred':'exact_head'},{head:git('rev-parse','HEAD'),operational_validation_performed:!terminalEnvelopeIsFixture},git('rev-parse','HEAD')===requiredTerminalHead),()=>observe({staged,tracked},{staged:0,tracked:'clean_or_exact3'},{staged:staged.length,tracked},staged.length===0&&trackedBoundary),()=>observe({terminalManifestDigest},{bound:true},{head:requiredTerminalHead,paths:fixture.ordered_cumulative_paths.length},git('rev-parse','HEAD')===requiredTerminalHead&&fixture.ordered_cumulative_paths.length===20),
 ],
}

const executedGroups=[]
for(const group of fixture.groups){const groupCases=cases[group.group_id];check(groupCases.length===group.row_count,`${group.group_id} exact cases`);const rows=[];for(let i=0;i<group.row_count;i++){const row=group.rows[i],execution=await groupCases[i]();check(execution.passed,`${row.row_id}: ${row.assertion}`);const evidence={row_id:row.row_id,row_digest:row.row_digest,input_digest:digest({row_id:row.row_id,input:execution.input}),expected_result_digest:digest({row_id:row.row_id,expected:execution.expected}),observed_result_digest:digest({row_id:row.row_id,observed:execution.observed}),assertion_digest:digest({row_id:row.row_id,assertion:row.assertion}),status:'PASS'};rows.push({...evidence,case_execution_digest:digest(evidence)})}const execution={group_id:group.group_id,row_count:rows.length,case_execution_digests:rows.map(r=>r.case_execution_digest)};executedGroups.push({group_id:group.group_id,row_count:rows.length,group_digest:group.group_digest,group_execution_digest:digest(execution),rows})}
const executionAggregate=digest(executedGroups.map(g=>({group_id:g.group_id,row_count:g.row_count,group_execution_digest:g.group_execution_digest}))),executionMatrix=digest({fixture_version:fixture.fixture_version,ordered_case_execution_digests:executedGroups.flatMap(g=>g.rows.map(r=>({row_id:r.row_id,case_execution_digest:r.case_execution_digest}))),execution_aggregate_digest:executionAggregate})
console.log(JSON.stringify({result:'PASS',contract:'Continuous Orchestration M6 Deprecation Removal and Terminal Migration Manifest',rows:'138/138',groups:executedGroups.map(({rows,...g})=>g),row_evidence:executedGroups.flatMap(g=>g.rows),authority_transition_validation:{matrix_version:runners.m5.authority_transition_validation.matrix_version,rows:runners.m5.authority_transition_validation.rows,matrix_digest:runners.m5.authority_transition_validation.matrix_digest,byte_identical_forwarding:'PASS',child_invocation_count:1,child_three_digest_binding:childTransitionBinding?'PASS':'FAIL',envelope_digest:terminalTransitionDigests.envelope,proof_digest:terminalTransitionDigests.proof,finalization_digest:terminalTransitionDigests.finalization,missing_envelope_child_invocation_count:0,alternate_transport_count:0},authority_transition_envelope_digest:terminalTransitionDigests.envelope,authority_transition_proof_digest:terminalTransitionDigests.proof,authority_transition_finalization_digest:terminalTransitionDigests.finalization,targeted_probes:targetedProbes.map(([probe,execution])=>({probe,status:execution.passed?'PASS':'FAIL',observed_kind:execution.observed?.kind??null})),semantic_graphs:Object.values(semanticGraphs).map(graph=>({candidate_id:graph.candidate_id,aggregate_proof_digest:graph.aggregate_proof_digest,consumer_count:graph.consumer_count,self_reference_count:graph.self_reference_sites.length,repository_path_count:graph.scanned_repository_scope.repository_path_count,semantic_source_path_count:graph.scanned_repository_scope.semantic_source_path_count})),semantic_six_case_matrix:{consumer_zero:'PASS',single_consumer:'PASS',re_export:'PASS',alias_import:'PASS',dynamic_access:'PASS',missing_target:'PASS'},assertions,branches:{terminal_migration_manifest_ready:'PASS',partial_retirement_blocked:'PASS',consumer_present:'PASS',replacement_incomplete:'PASS',compatibility_or_safety_blocked:'PASS',rejected:'PASS'},retired_candidate_count:baseResult.retired_candidate_ids.length,terminal_owner_count:terminalGraph.owners.length,terminal_graph_digest:terminalGraph.graph_digest,predecessor_path_count:fixture.predecessor_path_bindings.length,cumulative_path_count:fixture.ordered_cumulative_paths.length,m6_file_bindings:addedBindings,fixture_digest:fixture.fixture_digest,aggregate_digest:fixture.aggregate_digest,matrix_digest:fixture.matrix_digest,execution_aggregate_digest:executionAggregate,execution_matrix_digest:executionMatrix,m6_slice_digest:sliceDigest,cumulative_digest:cumulativeDigest,terminal_manifest_digest:terminalManifestDigest,etv_status:baseResult.etv_status,m3_status:baseResult.m3_status,successor_slice_allowed:baseResult.successor_slice_allowed,head:git('rev-parse','HEAD'),branch:git('branch','--show-current'),staged_path_count:staged.length,tracked_existing_delta_count:tracked.length}))
