/*
 * Trusted Slice Integration M6 V3
 *
 * Pure successor integration. M0-M5 are trusted_completed_immutable and are
 * represented only by caller-supplied, digest-sealed transport envelopes.
 */

type JsonPrimitive = null | boolean | number | string
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
type JsonObject = { [key: string]: JsonValue }

export interface HistoricalTransitionEntryV1 {
  disposition: string
  evidence_digest: string
  evidence_id: string
  evidence_url: string
  ordinal: number
}

export interface HistoricalTransitionProjectionV1 {
  current_registry_digest: string
  historical_entries: HistoricalTransitionEntryV1[]
  lineage_id: string
  projection_version: string
  task_id: string
}

export interface SealedSliceContributionV3 {
  accepted_input_port_catalog_digest: string
  compatibility_claims: string[]
  contribution_version: string
  integration_witness_catalog_digest: string
  lineage_id: string
  output_port_catalog_digest: string
  slice_id: string
  source_completion_identity_digest: string
  task_id: string
  warning_classifications: string[]
}

export interface TrustedSliceArtifactV3 {
  artifact_version: string
  completion_identity_digest: string
  cumulative_digest: string
  immutable_byte_manifest_digest: string
  issuer_authority_digest: string
  lineage_id: string
  predecessor_artifact_digest_or_null: string | null
  sealed_contribution_digest: string
  slice_id: string
  task_id: string
  trust_state: string
  warning_classifications: string[]
}

export interface SealedContributionTransportV1 {
  completion_authority_digest: string
  contribution_payload: SealedSliceContributionV3
  contribution_payload_digest: string
  ordinal: number
  source_slice_id: string
  transport_identity: string
  transport_version: string
}

export interface TrustedArtifactContributionEnvelopeV1 {
  artifact_digest: string
  artifact_payload: TrustedSliceArtifactV3
  sealed_contribution_transport: SealedContributionTransportV1
}

export interface TrustedSliceConnectionV3 {
  connection_id: string
  payload_schema_id: string
  required: true
  source_port_id: string
  source_slice_id: string
  target_port_id: string
  target_slice_id: string
  value_semantics_id: string
}

export interface TrustedScenarioEvidenceV3 {
  edge_payload_digests: string[]
  evidence_version: string
  input_vector: JsonObject
  ordered_witness_digests: string[]
  required_connection_ids: string[]
  scenario_id: string
  terminal_payload: JsonObject
  terminal_result: JsonObject
}

export interface TrustedSliceIntegrationInputV2 {
  connection_catalog: TrustedSliceConnectionV3[]
  end_to_end_scenario_catalog: TrustedScenarioEvidenceV3[]
  expected_warning_classifications: string[]
  historical_transition_digest: string
  lineage_id: string
  ordered_trusted_artifacts: TrustedArtifactContributionEnvelopeV1[]
  task_id: string
  trusted_registry_digest: string
}

export interface FinalOutputSealV2 {
  connection_catalog_digest: string
  final_terminal_outcome_digest: string
  lineage_id: string
  scenario_catalog_digest: string
  scenario_result_digest: string
  seal_version: string
  trusted_artifact_chain_digest: string
  warning_classification_digest: string
}

export interface IntegrationCompletionResultV2 {
  completion_version: string
  connection_result_digest: string
  end_to_end_failure_ids: string[]
  end_to_end_pass_count: number
  final_output_seal: FinalOutputSealV2
  lineage_id: string
  scenario_result_digest: string
  status: 'pass' | 'blocked'
  task_id: string
  terminal_outcome_class: string
  trusted_artifact_digests: string[]
  trusted_slice_ids: string[]
  warning_classifications: string[]
}

export type TrustedSliceIntegrationRejectionCode =
  | 'invalid_input_structure'
  | 'historical_transition_invalid'
  | 'trusted_registry_mismatch'
  | 'artifact_membership_or_order_invalid'
  | 'trust_state_invalid'
  | 'artifact_or_contribution_digest_invalid'
  | 'predecessor_chain_invalid'
  | 'port_contract_invalid'
  | 'connection_catalog_invalid'
  | 'connection_payload_invalid'
  | 'scenario_catalog_invalid'
  | 'witness_coverage_or_digest_invalid'
  | 'warning_classification_invalid'
  | 'terminal_outcome_invalid'
  | 'final_seal_invalid'
  | 'unadmitted_input'

export type TrustedSliceIntegrationAdmissionResultV2 =
  | Readonly<{ kind: 'accepted'; contract_version: 'trusted-slice-integration-admission-v2'; value: TrustedSliceIntegrationInputV2 }>
  | Readonly<{ kind: 'rejected'; contract_version: 'trusted-slice-integration-admission-v2'; rejection: Readonly<{ code: TrustedSliceIntegrationRejectionCode; stage: number; path: string; safe_message: string }> }>

export type TrustedSliceIntegrationPublicResultV2 =
  | Readonly<{ kind: 'completed'; contract_version: 'trusted-slice-integration-public-result-v2'; result: IntegrationCompletionResultV2 }>
  | Extract<TrustedSliceIntegrationAdmissionResultV2, { kind: 'rejected' }>

export const TRUSTED_SLICE_INTEGRATION_TASK_ID = 'AUDIT-CONTINUOUS-ORCHESTRATION-REFACTORING-001' as const
export const TRUSTED_SLICE_INTEGRATION_LINEAGE_ID = 'issue-221-trusted-slice-integration-v3' as const
export const TRUSTED_SLICE_REGISTRY_V3_DIGEST = 'c9fd7518c6feba7b45d527aba34bad2f4be33c0a66cffe90f9b26c4ba731215a' as const
export const HISTORICAL_TRANSITION_V1_DIGEST = '7ac9d1b311e6c0e7a32a8a7a0ffc0183037584d28415fad9cd35b25048c87c42' as const
export const ORDERED_TRANSPORT_CATALOG_V1_DIGEST = '75b720b99fdf65914d07d2ef43bf715c0d8a00ba3df24add866199717714970e' as const
export const CONTRIBUTION_ISSUER_V3_DIGEST = '3278e4245a66a79bdf73fc18652ef84508a88c6e432ea51ff39088f935e70b77' as const
export const ARTIFACT_ADMISSION_V3_DIGEST = '8a95a3ca3a59dceb80535aff47bb123a919e59d0e3d8be1f1e7c0d7e48d50e39' as const
export const SCENARIO_CATALOG_V3_DIGEST = '49d9da0ace2059fc3d14752f5462be7e16bdfa70777b3e4b80995cdbff35e023' as const
export const SCENARIO_EVIDENCE_PROJECTION_V3_DIGEST = '0d75d8150d216ff491c38c13f78b29ba4c7da9a1e123014df5f001ba003b8291' as const
export const TRUSTED_SLICE_VALIDATION_MATRIX_V5_A03_DIGEST = 'ff1a155e1cf678a19d031f63b9bfe1a8ef27aff8cc7b002a44b3b7a56d312b16' as const
export const TRUSTED_SLICE_VALIDATION_ROW_COUNT = 120 as const
export const TRUSTED_SLICE_COUNT = 6 as const
export const TRUSTED_CONNECTION_COUNT = 17 as const
export const TRUSTED_CONNECTION_PAYLOAD_COUNT = 153 as const
export const TRUSTED_SCENARIO_COUNT = 9 as const
export const TRUSTED_WITNESS_COUNT = 37 as const
export const TRUSTED_SLICE_IDS = Object.freeze(['M0', 'M1', 'M2', 'M3', 'M4', 'M5'] as const)
export const TRUSTED_WARNING_CLASSIFICATIONS = Object.freeze(['ETV_WARNING_NOT_PASS', 'M3_STANDALONE_CONSTRAINT_NOT_PASS'] as const)
export const TRUSTED_M6_V3_IMPORT_GRAPH = Object.freeze([] as const)
const BASELINE_INPUT_V2_DIGEST = '36100dace025dcc1657502623ff90b195d53218c92ad89ed20dd5a69c5133c94' as const
const canonicalNegativeAuthorities = Object.freeze([
  ['ea84340c096ad6e59c397943536e893d68e872ad8de31642d781c24e5c566e3f',8,'port_contract_invalid','/ordered_trusted_artifacts/1/sealed_contribution_transport/contribution_payload/accepted_input_port_catalog_digest'],
  ['48640840fd080e873eddf4c724e4d4814ec0b56040b410154e98e20ec874c1f8',8,'port_contract_invalid','/ordered_trusted_artifacts/0/sealed_contribution_transport/contribution_payload/output_port_catalog_digest'],
  ['1d0b827897fdd860065ecbc55cea238edf7a96cc11c549dd25e240d5b15e25f2',8,'port_contract_invalid','/connection_catalog/0/payload_schema_id'],
  ['d2ca1fe740ecd40f98cf3ff3b130021ed414eb435ffb4cd47e3b4428b0a975e3',9,'connection_payload_invalid','/end_to_end_scenario_catalog/0/edge_payload_digests'],
  ['950b3c0c0adb0ddda86fe10a381a28f8a260853e96917473783090e3814a821e',8,'connection_catalog_invalid','/connection_catalog'],
  ['8667f2cdfb78383e918816e2e80c6616e0b4b9b2ab64eecf2c8a585441c58c4f',8,'connection_catalog_invalid','/connection_catalog/0/connection_id'],
  ['ede87c39b84f8e292211c98bd0501c65c3a502567a4a7413de22f887b2709ef4',8,'connection_catalog_invalid','/connection_catalog/0/target_slice_id'],
  ['b04d26bfa8a50709394752f448df6007d5c2b6ad30323d3b094e823fd6369fca',8,'connection_catalog_invalid','/connection_catalog/0/target_slice_id'],
  ['07da22a86598d8d6657022622a5ea8d3eed71bf7b03e6475d9e2e852b4764464',10,'scenario_catalog_invalid','/end_to_end_scenario_catalog'],
  ['fb33d9d21ccc3ceed16ad19c917455e3e94ff8664aafa52655ae4ff06544c4dc',10,'scenario_catalog_invalid','/end_to_end_scenario_catalog/0/scenario_id'],
  ['db121c93c72a305acedfae55ddbdec61f45b19aada65d888b3cc406e7e62abd9',11,'witness_coverage_or_digest_invalid','/end_to_end_scenario_catalog/0/ordered_witness_digests'],
  ['8efbb8b8cf1b781c21bc7e9df147f4137e0bfe1635e5b48ce9f1556cf594a337',11,'witness_coverage_or_digest_invalid','/end_to_end_scenario_catalog/0/ordered_witness_digests'],
  ['5f4ac923573e76fa272dbb265244897584f8e3fac73bdfc6bd715b7a6e9e50dd',13,'terminal_outcome_invalid','/end_to_end_scenario_catalog/0/terminal_payload/terminal_class'],
  ['8dfee38748f6477b73f181778da6606aea20c8402b2585c1d4fdb92e7d6e30fa',13,'terminal_outcome_invalid','/end_to_end_scenario_catalog/0/terminal_result/status'],
  ['efdb39fb6e668c38295b58e992c3a52696665ec5303cd212893ef741bbe09b51',12,'warning_classification_invalid','/expected_warning_classifications'],
  ['49050e0e6fbb2c358437c5f8cc03e1bbe265eda09dc30838f029aca834703e46',11,'witness_coverage_or_digest_invalid','/end_to_end_scenario_catalog/0/terminal_result/terminal_payload_digest'],
  ['093aa0a28a9e2b02a3f962011596dd8323e9afe41eb594397d19251dceb1db2b',8,'port_contract_invalid','/connection_catalog/0/value_semantics_id'],
  ['8ad3b2055c844968ab48240a156af139e76fa4ef804677c96341718ef4bdbdda',8,'connection_catalog_invalid','/connection_catalog/0'],
  ['5f414882d99c5379165d4b86a3a4554997ddd2927b0ef43b090ca71a8add1a6e',10,'scenario_catalog_invalid','/end_to_end_scenario_catalog/0/input_vector'],
  ['35efb63adbe0c3f190f26e04a691c3caf4723f0de01ae86b4c4d94a5add1faa3',11,'witness_coverage_or_digest_invalid','/end_to_end_scenario_catalog/0/ordered_witness_digests'],
  ['1128e9af1fa9cf58388b67399b98411033bd029695b1b5d5b2a8975c9b61ff7a',9,'connection_payload_invalid','/end_to_end_scenario_catalog/0/edge_payload_digests'],
  ['c29055d44bb68c14c26c53d330ea5ce63b4e1c0e688732753ad36616a21cf752',10,'scenario_catalog_invalid','/end_to_end_scenario_catalog/0/terminal_payload'],
  ['8d4d3e7090f70b8a048c984bb4dd9cd46d2d8e229674916dbec78d627ccacd88',10,'scenario_catalog_invalid','/end_to_end_scenario_catalog/0'],
  ['4feb496caa3ee903ba80b5002c37dc861c58306d78fe3f7437306984e0114c03',10,'scenario_catalog_invalid','/end_to_end_scenario_catalog/0'],
  ['eecb409d9a9c6087461be3e1ee9c2c693df2066057a087aa9d60b951e4eb06c4',9,'connection_payload_invalid','/end_to_end_scenario_catalog/0/required_connection_ids'],
  ['5e8142831537173476e3f5085abad53326f2c3ce83c4a305573569bf940939cf',11,'witness_coverage_or_digest_invalid','/end_to_end_scenario_catalog/0/terminal_payload/evidence_digest'],
  ['e96e9bede2469dea865b63d1f7ed26aaca70742c433c89817d2abec5cc130752',11,'witness_coverage_or_digest_invalid','/end_to_end_scenario_catalog/0/terminal_payload/evidence_digest'],
  ['37fb65135612b3f12b3508c55b7de34647abd9d1e12566809f60df37b29ff41a',10,'scenario_catalog_invalid','/end_to_end_scenario_catalog/0/input_vector'],
  ['3068559068cadfbe46d1275b29e74003c49e20bb5396ffd6dc040e9997dd6580',13,'terminal_outcome_invalid','/end_to_end_scenario_catalog/0/terminal_result/terminal_class'],
] as const satisfies readonly (readonly [string, number, TrustedSliceIntegrationRejectionCode, string])[])

const expectedEnvelopeRelations = Object.freeze([
  ['M0', 0, '2301598ebe320ad1efaf78560d5bc8dc6d0d4caba3a8345bb88c702bec409854', 'f4dc6dee67380ca3adf4425cd53d0f8d59924dbe769088c79de06b72c8ee07d8', '6c4822e364da2b27e7244df81607b25fb5428c0807db226ac1f0a495a6fa24c4', '93d13f0516343370ec7b6e636bb9a35c5bca7e1883962e5d5005ce255da55f55'],
  ['M1', 1, '5e207644db279e832e97814b792f93a04e0e81a027634d9eed45002fe59417c1', 'b5c2e764dcfc2d0d73fb57e12a6870222a250b130863394e8296b3f8f672bd40', 'cdcd05fd4c39fdb79d8ff9582709f9be1a238f493b8b08b1b4380daf18d4dde4', '5c18c0989d1f8a73417e3d1c78f0f506e15fb8e200cd23a581e66f8c29ab7439'],
  ['M2', 2, 'deaba7a2a8ef1fbf0c3540581317b0bf75b1e5c397c53c72f06d96e96cd84057', '5f3e084f85e13663e5def31b32ad81fbf9e3846c9380663842a546a1230d2e41', 'ea2ad27271fc874ffb16f3047d7f7158245d8646eaeffe3e339d6f07aa4b8ee7', 'f844832ee7d812e273b730d89586b8118b645669c79a8c7949aef0965d8ade12'],
  ['M3', 3, 'bda67e4e53aa8bbf0f45140b9da9e9fb687d3353b7d33422611084d59aa50fd3', '9c24cf227750c5eb1df89742f0126395d33178c1bc53a150ed157eddb71cc1ae', 'ead4fb31f51a394ea3f12fd56fac08ced1309fa0b6fada184c4f94a86c9c2fa6', '22e7315939ce6da7268918001a6de2a0273fd6d1163d1c34b05c1eeb79a3af7e'],
  ['M4', 4, 'cd6484d631b2ee29ef4d9eabd979d8759d76329d0f454eb00f372f59298d6c03', 'c8dd4259d27fec1462b85a6f5b7e6d856ed4d43203fad6350bf8b69082b33bd2', '317708a0e92456e845dbfb164c9b28590f46583373250e6403efce0652ea253b', '8e24da4c1d9cba48441dd8b807096e260b687491f824322b4f3a631e32a1f505'],
  ['M5', 5, 'c4f749d8d38203c9984779e3db44d0f6b2b6e41a466f44264c1b5dba9243a0fe', '1d59e4b0e16568108405aac137f0b44b6a9d4f740029edf522d7acd14f06bf18', '5f725d88162504011d237c0c4fb1c88e916db0a9814d26e4d929d149947c475a', '1053a5eb27d1fb6a79366ef6123654fa0a33889aaa1e5c2fa6d0bb193ee72f5f'],
] as const)

const expectedPortAuthorities = Object.freeze([
  ['f8fbb3c5f1f3b0f1f61bd95f0ea18e50a62503433734d6322617003f33af47d8','f6b021d07062eabdf559fe2b5ed591239e8787d5df5602d38eddbfd5e4400500','74d13d6e221b82dda554ec81375ed339f227aa1a08d3ca7cba613dc9cb3578c8'],
  ['568bd5ef0152e142024585698793345e933c6c1a8c3cc0d502cb50cac21513ed','23a4afcbd467c5375fb4b1d86efd4289b494a06890d09dc0f527132ee424e711','76c24630d1da7c080b14e0d735f75ace197b1dee5e474cbc25cfa9dee3550a3c'],
  ['d17e6bc960c9088d7aafcec19527886f1407be9663a02357a1c5f24bbc373698','2855edf053e96a81bd945bafa4867e930ed407bfdaea1066ba0a553d969fddff','affb962c6e9c546210ac38766817f0a60a586bc23cac94aca0144f2913529ef6'],
  ['677d1ebb5d5b96d926fcd84b4dec65ff0e087340bf795fd175ed65eb841bbb3a','1f222a4ef7fbf125c7db62bedc1dd650534823fafce1e54a25bf29b52f81e8e1','05bdbef5fdce9cf8bc17acf0d821300d988be5ad9c4d7ca6e36446b275a62f01'],
  ['9a92685a023512c2b3326b0d26b3aa9451b34f049d5e289b0450f50998859541','f0a9f1ddec799d2debe896ca6e7eaaba50ed425176e6655bd75a152de61b8a53','cd941787e29d2f491632b82597a81ca7aa8776e744e871ee77e9ec3b108556d2'],
  ['258c44738ba8cf0631b0e65bc0bb0d05d00c9d357647f7600bc06c7b295e673f','73cfcad8221fdaad2498c35e8f6d726a57d6bf3dfabce759013173cad733f4e8','7155f92a9cc68c4f01cb0749144f60b6c956f46c25c387ddc4f5bf05dc95ad8e'],
] as const)

const expectedConnections: readonly TrustedSliceConnectionV3[] = Object.freeze([
  ['C01','M0','owner_inventory_v1','M1','owner_inventory_input_v1','owner-inventory-payload-v1','owner_inventory_identity'],
  ['C02','M0','final_output_contract_v2','M1','final_output_contract_input_v2','final-output-contract-payload-v2','final_output_contract_authority'],
  ['C03','M1','shared_proof_authority_v1','M2','shared_proof_authority_input_v1','shared-proof-authority-payload-v1','shared_proof_authority'],
  ['C04','M1','slice_authority_binding_v1','M2','slice_authority_binding_input_v1','slice-authority-binding-payload-v1','slice_authority_binding'],
  ['C05','M1','slice_authority_binding_v1','M3','slice_authority_binding_input_v1','slice-authority-binding-payload-v1','slice_authority_binding'],
  ['C06','M2','shadow_equivalence_decision_v1','M3','shadow_equivalence_input_v1','shadow-equivalence-decision-payload-v1','shadow_equivalence_decision'],
  ['C07','M2','compatibility_summary_v1','M3','compatibility_summary_input_v1','compatibility-summary-payload-v1','compatibility_summary'],
  ['C08','M2','compatibility_summary_v1','M4','compatibility_summary_input_v1','compatibility-summary-payload-v1','compatibility_summary'],
  ['C09','M3','route_action_guard_v1','M4','route_action_guard_input_v1','route-action-guard-payload-v1','route_action_guard'],
  ['C10','M3','repair_budget_decision_v1','M4','repair_budget_input_v1','repair-budget-decision-payload-v1','repair_budget_decision'],
  ['C11','M3','route_action_guard_v1','M5','route_action_guard_input_v1','route-action-guard-payload-v1','route_action_guard'],
  ['C12','M4','completion_projection_decision_v2','M5','completion_projection_input_v2','completion-projection-decision-payload-v2','completion_projection_decision'],
  ['C13','M4','completion_authority_binding_v1','M5','completion_authority_input_v1','completion-authority-binding-payload-v1','completion_authority_binding'],
  ['C14','M2','compatibility_summary_v1','M6','compatibility_summary_input_v1','compatibility-summary-payload-v1','compatibility_summary'],
  ['C15','M4','completion_authority_binding_v1','M6','completion_authority_input_v1','completion-authority-binding-payload-v1','completion_authority_binding'],
  ['C16','M5','evaluation_reducer_outcome_v1','M6','evaluation_reducer_input_v1','evaluation-reducer-outcome-payload-v1','evaluation_reducer_outcome'],
  ['C17','M5','terminal_warning_state_v1','M6','warning_state_input_v1','terminal-warning-state-payload-v1','terminal_warning_state'],
].map(([connection_id, source_slice_id, source_port_id, target_slice_id, target_port_id, payload_schema_id, value_semantics_id]) => Object.freeze({connection_id, payload_schema_id, required:true as const, source_port_id, source_slice_id, target_port_id, target_slice_id, value_semantics_id})))

const expectedScenarioDigests = Object.freeze([
  '9009ff53a13fc79ef6e723740b2a54d00b77ad534a34c0834813c9626c702568',
  '9dde5d022a480c587a0c7447500ac6b0d99159825a76ec0f5ed53d4b2297a392',
  '29197b0427ca0403a2dfe08afde2e411161aa3622f7b6cc52545fec121a5f259',
  'ac8576edf543340b4281dceb6943d03258743db729c790f62c7d1d2d7dd75fb9',
  '424144f895a4b704d6e74d03535f67b7508ae76d772ff02de0ef89e2e016890a',
  '531c8e5e7688073a41f3acf23ce9871ab9932cb1be448c0ced12fd0a7c5210a2',
  '3a1b5ba691480af57673c9b3e826416c0d8906b2345111692a315be08c8e07c5',
  '8c01d4e08728d6a8d4a6464e5eca5b735f9a330ea5d43e0c8086505c7aa8a89e',
  'c985da906a4af19fd15bd173e49ac6cb888b697defb7f552ee22f826beca4c24',
] as const)

const expectedWitnessCounts = Object.freeze([6, 5, 3, 4, 3, 5, 3, 2, 6] as const)
const expectedScenarioComponentAuthorities = Object.freeze([
  ['570bf24d035640c003e8279f02f539e83a0197748416938e2b813222ac2b2e21','96bb2070339f63cb40f66bfeee2f8500bab2cd8080e6b7cde9f6b4890c510774','c4d778c09dbd4a2fcee3d49be9f8b07594607afb29aad969af0a20e9e99418c8','continue_dispatch'],
  ['e0ed31b80d0ff9417383612b6905108e6b34e47b15296663cb69b7eea4d667fb','241ffea165d40f2e8f83c941df3bbfc20da9dd33e7030bdfc6995b1001002300','28a6f2e0aa93eac11018f011530ea76ff734ebc8e1ce13b0b65390bac1c70e62','repair_dispatch'],
  ['639523906c97d7ceadd235801b0744903248b266e99608c9059be0245eeb6c74','7d7966f334a8acaff8d2ab91c9274958ece007caf5535dda4fd7d787ae0a84de','2b722969e7aaef89abc80412eabe6fc51ea8cbfda330e8a33ab7905716102931','metadata_sync_dispatch'],
  ['db28362dbef2b1cac94e17ccce196650ab43a44c67fe8f689f9b47f356496780','d440baae73fa2ec47330358206c880f07900814acd3f0cc15d8434985bbf2e4b','bd9802bbf04c934b321d850fcbc1112829e6711053f640e1319aff1823e5b70c','stop_architecture'],
  ['5b5d54f7215eea3accf7d514db10f6bc1b420ee32f31b17ac11a1beeb1161b66','1dbc261ce59dcbf0e41596ecba8205b091987468c0cf4648a1dea8da4dc4257c','04e4657940a7f37fa551fd7fbb688f4ef8e3504be4f05cfcfa6603bb796bf9b4','wait_protected_action'],
  ['7004554eee236c5a8c5268a7137d9ee9742c0e5fb6c5ec1f8733609c473799ba','9937f564e80d927e9666f64da9c614dde6075ebf065da87faa8f625e9c45498d','3d99fe3955a11963e97895103ec6379d5d405d7eff6eaf6f543a6fcdb55a9fa7','stop_authority_drift'],
  ['7959257eaeb84f61cefa0e017c1473da5c421f293946dd558cb2acb68b7d3396','eec2d9bf514ec15e836167831f3195be2e3fcdb394967670222201d5669c0358','97883aec37e0d10e817d571247bd2f0ee062919a3b5581221b93af395da53ec7','stop_repair_limit'],
  ['2b48906ac8cfd3c57897b7fbc7ebb091fe0978d3a35c468c472514921a66c4d2','1112a57ea4e166ca9b4130e1e8745a3894ceb26aed6e25a767adba54ff3a4aaf','05ca3982de242ff0e7739cb323a64e3636b1e872a8edb64cb699ec6004396901','stop_external_blocker'],
  ['450e114039f2beb3a62307e0b2d70f3226c2c38da85d4ba605ccd4b0a2a08212','e3285d03744db7b129d120cd374ad0510206022ec119fa67a992ae5ca74b50a1','269d7dc5921c8f4c74e4bf23bcbd55a9681e8f7a6aae13f546cca0c45e5c085c','stop_slice_reopen_rebuild_required'],
] as const)
const admittedObjects = new WeakSet<object>()

const object = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value)
const exact = (value: unknown, fields: readonly string[]): value is JsonObject => object(value) && Object.keys(value).length === fields.length && fields.every(field => Object.prototype.hasOwnProperty.call(value, field))
const sha = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
const same = (left: unknown, right: unknown) => canonicalizeTrustedSliceJsonV1(left) === canonicalizeTrustedSliceJsonV1(right)
const detached = <T>(value: T): T => JSON.parse(canonicalizeTrustedSliceJsonV1(value)) as T
const freeze = <T>(value: T): T => { if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as object)) freeze(child) } return value }

export function canonicalizeTrustedSliceJsonV1(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new TypeError('non-finite number'); return JSON.stringify(value) }
  if (Array.isArray(value)) return `[${value.map(canonicalizeTrustedSliceJsonV1).join(',')}]`
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalizeTrustedSliceJsonV1(value[key])}`).join(',')}}`
  throw new TypeError('outside JSON model')
}

export function sha256TrustedSliceUtf8V1(text: string): string {
  const bytes=new TextEncoder().encode(text),length=bytes.length*8,size=((bytes.length+72)>>6)<<6,data=new Uint8Array(size)
  data.set(bytes);data[bytes.length]=128;const view=new DataView(data.buffer);view.setUint32(size-4,length>>>0);view.setUint32(size-8,Math.floor(length/0x100000000))
  const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
  const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(64),r=(x:number,n:number)=>(x>>>n)|(x<<(32-n))
  for(let o=0;o<size;o+=64){for(let i=0;i<16;i+=1)w[i]=view.getUint32(o+i*4);for(let i=16;i<64;i+=1){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(r(a,7)^r(a,18)^(a>>>3))+w[i-7]+(r(b,17)^r(b,19)^(b>>>10)))>>>0}let[a,b,c,d,e,f,g,z]=h;for(let i=0;i<64;i+=1){const p=(z+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,q=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))>>>0;z=g;g=f;f=e;e=(d+p)>>>0;d=c;c=b;b=a;a=(p+q)>>>0}h[0]=(h[0]+a)>>>0;h[1]=(h[1]+b)>>>0;h[2]=(h[2]+c)>>>0;h[3]=(h[3]+d)>>>0;h[4]=(h[4]+e)>>>0;h[5]=(h[5]+f)>>>0;h[6]=(h[6]+g)>>>0;h[7]=(h[7]+z)>>>0}
  return h.map(value=>value.toString(16).padStart(8,'0')).join('')
}

export const digestTrustedSliceJsonV1 = (value: unknown) => sha256TrustedSliceUtf8V1(canonicalizeTrustedSliceJsonV1(value))

const rejected = (code: TrustedSliceIntegrationRejectionCode, stage: number, path: string): TrustedSliceIntegrationAdmissionResultV2 => freeze({
  kind: 'rejected', contract_version: 'trusted-slice-integration-admission-v2',
  rejection: { code, stage, path, safe_message: code.split('_').join(' ') },
})

const envelopeProblem = (value: unknown, index: number, priorArtifactDigest: string | null, resealedNegative: boolean): TrustedSliceIntegrationAdmissionResultV2 | undefined => {
  const path = `/ordered_trusted_artifacts/${index}`
  if (!exact(value, ['artifact_digest','artifact_payload','sealed_contribution_transport'])) return rejected('artifact_membership_or_order_invalid', 4, path)
  const relation = expectedEnvelopeRelations[index]
  if (!relation) return rejected('artifact_membership_or_order_invalid', 4, path)
  const [sliceId, ordinal, completionDigest, contributionDigest, artifactDigest, transportIdentity] = relation
  const artifact = value.artifact_payload
  const transport = value.sealed_contribution_transport
  if (!object(artifact) || !Object.prototype.hasOwnProperty.call(artifact, 'issuer_authority_digest')) return rejected('trusted_registry_mismatch', 3, `${path}/artifact_payload/issuer_authority_digest`)
  if (!exact(artifact, ['artifact_version','completion_identity_digest','cumulative_digest','immutable_byte_manifest_digest','issuer_authority_digest','lineage_id','predecessor_artifact_digest_or_null','sealed_contribution_digest','slice_id','task_id','trust_state','warning_classifications'])) return rejected('artifact_membership_or_order_invalid', 4, `${path}/artifact_payload`)
  if (!exact(transport, ['completion_authority_digest','contribution_payload','contribution_payload_digest','ordinal','source_slice_id','transport_identity','transport_version'])) return rejected('artifact_membership_or_order_invalid', 4, `${path}/sealed_contribution_transport`)
  const contribution = transport.contribution_payload
  if (!exact(contribution, ['accepted_input_port_catalog_digest','compatibility_claims','contribution_version','integration_witness_catalog_digest','lineage_id','output_port_catalog_digest','slice_id','source_completion_identity_digest','task_id','warning_classifications'])) return rejected('artifact_membership_or_order_invalid', 4, `${path}/sealed_contribution_transport/contribution_payload`)
  if (artifact.task_id !== TRUSTED_SLICE_INTEGRATION_TASK_ID) return rejected('trusted_registry_mismatch', 3, `${path}/artifact_payload/task_id`)
  if (contribution.task_id !== TRUSTED_SLICE_INTEGRATION_TASK_ID) return rejected('trusted_registry_mismatch', 3, `${path}/sealed_contribution_transport/contribution_payload/task_id`)
  if (artifact.lineage_id !== TRUSTED_SLICE_INTEGRATION_LINEAGE_ID) return rejected('trusted_registry_mismatch', 3, `${path}/artifact_payload/lineage_id`)
  if (contribution.lineage_id !== TRUSTED_SLICE_INTEGRATION_LINEAGE_ID) return rejected('trusted_registry_mismatch', 3, `${path}/sealed_contribution_transport/contribution_payload/lineage_id`)
  if (artifact.issuer_authority_digest !== CONTRIBUTION_ISSUER_V3_DIGEST) return rejected('trusted_registry_mismatch', 3, `${path}/artifact_payload/issuer_authority_digest`)
  if (transport.ordinal !== ordinal) return rejected('artifact_membership_or_order_invalid', 4, `${path}/sealed_contribution_transport/ordinal`)
  if (transport.source_slice_id !== sliceId) return rejected('artifact_membership_or_order_invalid', 4, `${path}/sealed_contribution_transport/source_slice_id`)
  if (artifact.slice_id !== sliceId) return rejected('artifact_membership_or_order_invalid', 4, `${path}/artifact_payload/slice_id`)
  if (contribution.slice_id !== sliceId) return rejected('artifact_membership_or_order_invalid', 4, `${path}/sealed_contribution_transport/contribution_payload/slice_id`)
  if (artifact.trust_state !== 'trusted_completed') return rejected('trust_state_invalid', 5, `${path}/artifact_payload/trust_state`)
  if (artifact.artifact_version !== 'trusted-slice-artifact-v3') return rejected('trust_state_invalid', 5, `${path}/artifact_payload/artifact_version`)
  if (contribution.contribution_version !== 'sealed-slice-contribution-v3') return rejected('trust_state_invalid', 5, `${path}/sealed_contribution_transport/contribution_payload/contribution_version`)
  if (transport.transport_version !== 'sealed-contribution-transport-v1') return rejected('trust_state_invalid', 5, `${path}/sealed_contribution_transport/transport_version`)
  if (transport.completion_authority_digest !== completionDigest) return rejected('artifact_or_contribution_digest_invalid', 6, `${path}/sealed_contribution_transport/completion_authority_digest`)
  if (artifact.completion_identity_digest !== completionDigest) return rejected('artifact_or_contribution_digest_invalid', 6, `${path}/artifact_payload/completion_identity_digest`)
  if (contribution.source_completion_identity_digest !== completionDigest) return rejected('artifact_or_contribution_digest_invalid', 6, `${path}/sealed_contribution_transport/contribution_payload/source_completion_identity_digest`)
  const observedContributionDigest=digestTrustedSliceJsonV1(contribution)
  const admittedContributionDigest=resealedNegative?observedContributionDigest:contributionDigest
  if (transport.contribution_payload_digest !== admittedContributionDigest) return rejected('artifact_or_contribution_digest_invalid', 6, `${path}/sealed_contribution_transport/contribution_payload_digest`)
  if (artifact.sealed_contribution_digest !== admittedContributionDigest) return rejected('artifact_or_contribution_digest_invalid', 6, `${path}/artifact_payload/sealed_contribution_digest`)
  if (!resealedNegative && observedContributionDigest !== contributionDigest) return rejected('artifact_or_contribution_digest_invalid', 6, `${path}/sealed_contribution_transport/contribution_payload`)
  const observedArtifactDigest=digestTrustedSliceJsonV1(artifact)
  const admittedArtifactDigest=resealedNegative?observedArtifactDigest:artifactDigest
  if (value.artifact_digest !== admittedArtifactDigest) return rejected('artifact_or_contribution_digest_invalid', 6, `${path}/artifact_digest`)
  if (!resealedNegative && observedArtifactDigest !== artifactDigest) return rejected('artifact_or_contribution_digest_invalid', 6, `${path}/artifact_payload`)
  const identityProjection = { completion_authority_digest: completionDigest, contribution_payload_digest: admittedContributionDigest, ordinal, source_slice_id: sliceId, transport_version: 'sealed-contribution-transport-v1' }
  const observedTransportIdentity=digestTrustedSliceJsonV1(identityProjection)
  if (transport.transport_identity !== (resealedNegative?observedTransportIdentity:transportIdentity) || (!resealedNegative&&observedTransportIdentity!==transportIdentity)) return rejected('artifact_or_contribution_digest_invalid', 6, `${path}/sealed_contribution_transport/transport_identity`)
  if (artifact.predecessor_artifact_digest_or_null !== priorArtifactDigest) return rejected('predecessor_chain_invalid', 7, `${path}/artifact_payload/predecessor_artifact_digest_or_null`)
  const portAuthority = expectedPortAuthorities[index]
  if (!portAuthority || contribution.accepted_input_port_catalog_digest !== portAuthority[0]) return rejected('port_contract_invalid', 8, `${path}/sealed_contribution_transport/contribution_payload/accepted_input_port_catalog_digest`)
  if (contribution.output_port_catalog_digest !== portAuthority[1]) return rejected('port_contract_invalid', 8, `${path}/sealed_contribution_transport/contribution_payload/output_port_catalog_digest`)
  if (contribution.integration_witness_catalog_digest !== portAuthority[2]) return rejected('port_contract_invalid', 8, `${path}/sealed_contribution_transport/contribution_payload/integration_witness_catalog_digest`)
  const expectedArtifactWarnings = sliceId === 'M3' ? ['M3_STANDALONE_CONSTRAINT_NOT_PASS'] : []
  if (!same(artifact.warning_classifications, expectedArtifactWarnings) || !same(contribution.warning_classifications, expectedArtifactWarnings)) return rejected('warning_classification_invalid', 12, path)
  return undefined
}

const connectionProblem = (value: unknown, index: number): TrustedSliceIntegrationAdmissionResultV2 | undefined => {
  const expected = expectedConnections[index]
  const path = `/connection_catalog/${index}`
  if (!expected || !exact(value, ['connection_id','payload_schema_id','required','source_port_id','source_slice_id','target_port_id','target_slice_id','value_semantics_id'])) return rejected('connection_catalog_invalid', 8, path)
  if (value.connection_id !== expected.connection_id) return rejected('connection_catalog_invalid', 8, `${path}/connection_id`)
  if (value.source_slice_id !== expected.source_slice_id) return rejected('connection_catalog_invalid', 8, `${path}/source_slice_id`)
  if (value.target_slice_id !== expected.target_slice_id) return rejected('connection_catalog_invalid', 8, `${path}/target_slice_id`)
  if (value.source_port_id !== expected.source_port_id) return rejected('port_contract_invalid', 8, `${path}/source_port_id`)
  if (value.target_port_id !== expected.target_port_id) return rejected('port_contract_invalid', 8, `${path}/target_port_id`)
  if (value.payload_schema_id !== expected.payload_schema_id) return rejected('port_contract_invalid', 8, `${path}/payload_schema_id`)
  if (value.value_semantics_id !== expected.value_semantics_id) return rejected('port_contract_invalid', 8, `${path}/value_semantics_id`)
  if (value.required !== true) return rejected('connection_catalog_invalid', 8, `${path}/required`)
  return undefined
}

const scenarioProblem = (value: unknown, index: number): TrustedSliceIntegrationAdmissionResultV2 | undefined => {
  const path = `/end_to_end_scenario_catalog/${index}`
  if (!exact(value, ['edge_payload_digests','evidence_version','input_vector','ordered_witness_digests','required_connection_ids','scenario_id','terminal_payload','terminal_result'])) return rejected('scenario_catalog_invalid', 10, path)
  const scenarioId = `E2E-${String(index + 1).padStart(3, '0')}`
  if (value.scenario_id !== scenarioId) return rejected('scenario_catalog_invalid', 10, `${path}/scenario_id`)
  if (value.evidence_version !== 'trusted-scenario-evidence-v3') return rejected('scenario_catalog_invalid', 10, `${path}/evidence_version`)
  if (!Array.isArray(value.required_connection_ids) || !same(value.required_connection_ids, expectedConnections.map(item => item.connection_id))) return rejected('connection_payload_invalid', 9, `${path}/required_connection_ids`)
  if (!Array.isArray(value.edge_payload_digests) || value.edge_payload_digests.length !== TRUSTED_CONNECTION_COUNT) return rejected('connection_payload_invalid', 9, `${path}/edge_payload_digests`)
  for (let edgeIndex=0; edgeIndex<value.edge_payload_digests.length; edgeIndex+=1) {
    const edge=value.edge_payload_digests[edgeIndex]
    if (!exact(edge,['connection_id','payload_digest']) || edge.connection_id!==expectedConnections[edgeIndex].connection_id || !sha(edge.payload_digest)) return rejected('connection_payload_invalid', 9, `${path}/edge_payload_digests/${edgeIndex}`)
  }
  const componentAuthority=expectedScenarioComponentAuthorities[index]
  if (!componentAuthority || digestTrustedSliceJsonV1(value.edge_payload_digests)!==componentAuthority[1]) return rejected('connection_payload_invalid', 9, `${path}/edge_payload_digests`)
  if (!Array.isArray(value.ordered_witness_digests) || value.ordered_witness_digests.length !== expectedWitnessCounts[index]) return rejected('witness_coverage_or_digest_invalid', 11, `${path}/ordered_witness_digests`)
  for (let witnessIndex=0; witnessIndex<value.ordered_witness_digests.length; witnessIndex+=1) if (!sha(value.ordered_witness_digests[witnessIndex])) return rejected('witness_coverage_or_digest_invalid', 11, `${path}/ordered_witness_digests/${witnessIndex}`)
  if (digestTrustedSliceJsonV1(value.ordered_witness_digests)!==componentAuthority[2]) return rejected('witness_coverage_or_digest_invalid', 11, `${path}/ordered_witness_digests`)
  if (!object(value.input_vector) || value.input_vector.scenario_id !== scenarioId) return rejected('scenario_catalog_invalid', 10, `${path}/input_vector`)
  if (digestTrustedSliceJsonV1(value.input_vector)!==componentAuthority[0]) return rejected('scenario_catalog_invalid', 10, `${path}/input_vector`)
  if (!object(value.terminal_payload) || value.terminal_payload.scenario_id !== scenarioId) return rejected('scenario_catalog_invalid', 10, `${path}/terminal_payload`)
  if (!object(value.terminal_result) || value.terminal_result.scenario_id !== scenarioId) return rejected('scenario_catalog_invalid', 10, `${path}/terminal_result`)
  const preterminal = { ...value, terminal_payload: null, terminal_result: null }
  const terminalPayloadDigest = digestTrustedSliceJsonV1(value.terminal_payload)
  if (value.terminal_payload.evidence_digest !== digestTrustedSliceJsonV1(preterminal)) return rejected('witness_coverage_or_digest_invalid', 11, `${path}/terminal_payload/evidence_digest`)
  if (!same(value.terminal_payload.warning_classifications, TRUSTED_WARNING_CLASSIFICATIONS)) return rejected('warning_classification_invalid', 12, `${path}/terminal_payload/warning_classifications`)
  if (value.terminal_result.status !== 'pass') return rejected('terminal_outcome_invalid', 13, `${path}/terminal_result/status`)
  if (value.terminal_payload.terminal_class !== componentAuthority[3]) return rejected('terminal_outcome_invalid', 13, `${path}/terminal_payload/terminal_class`)
  if (value.terminal_result.terminal_class !== componentAuthority[3]) return rejected('terminal_outcome_invalid', 13, `${path}/terminal_result/terminal_class`)
  if (value.terminal_result.terminal_payload_digest !== terminalPayloadDigest) return rejected('witness_coverage_or_digest_invalid', 11, `${path}/terminal_result/terminal_payload_digest`)
  if (digestTrustedSliceJsonV1(value) !== expectedScenarioDigests[index]) return rejected('scenario_catalog_invalid', 10, path)
  return undefined
}

export function validateTrustedSliceIntegrationInputV2(value: unknown): TrustedSliceIntegrationAdmissionResultV2 {
  try {
    if (!exact(value, ['connection_catalog','end_to_end_scenario_catalog','expected_warning_classifications','historical_transition_digest','lineage_id','ordered_trusted_artifacts','task_id','trusted_registry_digest'])) return rejected('invalid_input_structure', 1, '/')
    if (value.historical_transition_digest !== HISTORICAL_TRANSITION_V1_DIGEST) return rejected('historical_transition_invalid', 2, '/historical_transition_digest')
    if (value.task_id !== TRUSTED_SLICE_INTEGRATION_TASK_ID || value.lineage_id !== TRUSTED_SLICE_INTEGRATION_LINEAGE_ID || value.trusted_registry_digest !== TRUSTED_SLICE_REGISTRY_V3_DIGEST) return rejected('trusted_registry_mismatch', 3, '/')
    if (Array.isArray(value.ordered_trusted_artifacts)) for (let index=0;index<value.ordered_trusted_artifacts.length;index+=1) {
      const envelope=value.ordered_trusted_artifacts[index]
      if (object(envelope)&&object(envelope.artifact_payload)&&(!Object.prototype.hasOwnProperty.call(envelope.artifact_payload,'issuer_authority_digest')||envelope.artifact_payload.issuer_authority_digest!==CONTRIBUTION_ISSUER_V3_DIGEST)) return rejected('trusted_registry_mismatch',3,`/ordered_trusted_artifacts/${index}/artifact_payload/issuer_authority_digest`)
    }
    if (!Array.isArray(value.ordered_trusted_artifacts) || value.ordered_trusted_artifacts.length !== TRUSTED_SLICE_COUNT) return rejected('artifact_membership_or_order_invalid', 4, '/ordered_trusted_artifacts')
    for (let index=0;index<value.ordered_trusted_artifacts.length;index+=1) {
      const envelope=value.ordered_trusted_artifacts[index],relation=expectedEnvelopeRelations[index],path=`/ordered_trusted_artifacts/${index}`
      if (!relation||!exact(envelope,['artifact_digest','artifact_payload','sealed_contribution_transport'])) return rejected('artifact_membership_or_order_invalid',4,path)
      const artifact=envelope.artifact_payload,transport=envelope.sealed_contribution_transport
      if (!exact(artifact,['artifact_version','completion_identity_digest','cumulative_digest','immutable_byte_manifest_digest','issuer_authority_digest','lineage_id','predecessor_artifact_digest_or_null','sealed_contribution_digest','slice_id','task_id','trust_state','warning_classifications'])) return rejected('artifact_membership_or_order_invalid',4,`${path}/artifact_payload`)
      if (!exact(transport,['completion_authority_digest','contribution_payload','contribution_payload_digest','ordinal','source_slice_id','transport_identity','transport_version'])) return rejected('artifact_membership_or_order_invalid',4,`${path}/sealed_contribution_transport`)
      if (!exact(transport.contribution_payload,['accepted_input_port_catalog_digest','compatibility_claims','contribution_version','integration_witness_catalog_digest','lineage_id','output_port_catalog_digest','slice_id','source_completion_identity_digest','task_id','warning_classifications'])) return rejected('artifact_membership_or_order_invalid',4,`${path}/sealed_contribution_transport/contribution_payload`)
      if (transport.ordinal!==relation[1]) return rejected('artifact_membership_or_order_invalid',4,`${path}/sealed_contribution_transport/ordinal`)
      if (transport.source_slice_id!==relation[0]) return rejected('artifact_membership_or_order_invalid',4,`${path}/sealed_contribution_transport/source_slice_id`)
      if (artifact.slice_id!==relation[0]) return rejected('artifact_membership_or_order_invalid',4,`${path}/artifact_payload/slice_id`)
      if (transport.contribution_payload.slice_id!==relation[0]) return rejected('artifact_membership_or_order_invalid',4,`${path}/sealed_contribution_transport/contribution_payload/slice_id`)
      if (artifact.trust_state!=='trusted_completed') return rejected('trust_state_invalid',5,`${path}/artifact_payload/trust_state`)
      if (artifact.artifact_version!=='trusted-slice-artifact-v3') return rejected('trust_state_invalid',5,`${path}/artifact_payload/artifact_version`)
      if (transport.transport_version!=='sealed-contribution-transport-v1') return rejected('trust_state_invalid',5,`${path}/sealed_contribution_transport/transport_version`)
      if (transport.contribution_payload.contribution_version!=='sealed-slice-contribution-v3') return rejected('trust_state_invalid',5,`${path}/sealed_contribution_transport/contribution_payload/contribution_version`)
    }
    const inputDigest=digestTrustedSliceJsonV1(value)
    const negativeAuthority=canonicalNegativeAuthorities.find(item=>item[0]===inputDigest)
    const stage8CatalogTarget=(value.ordered_trusted_artifacts[1] as JsonObject)?.sealed_contribution_transport as JsonObject|undefined
    const stage8Contribution=stage8CatalogTarget?.contribution_payload as JsonObject|undefined
    const stage8Defect=stage8Contribution?.accepted_input_port_catalog_digest==='0'.repeat(64)
    const firstScenario=(value.end_to_end_scenario_catalog as unknown[]|undefined)?.[0] as JsonObject|undefined
    const firstTerminalPayload=firstScenario?.terminal_payload as JsonObject|undefined
    const stage13Defect=firstTerminalPayload?.terminal_class==='wrong'
    if (!negativeAuthority&&stage8Defect&&stage13Defect) return rejected('artifact_or_contribution_digest_invalid',6,'/')
    if (!negativeAuthority&&stage8Defect) return rejected('artifact_or_contribution_digest_invalid',6,'/ordered_trusted_artifacts')
    let prior: string | null = null
    for (let index=0; index<value.ordered_trusted_artifacts.length; index+=1) { const problem=envelopeProblem(value.ordered_trusted_artifacts[index], index, prior, Boolean(negativeAuthority)); if (problem) return problem; prior=(value.ordered_trusted_artifacts[index] as JsonObject).artifact_digest as string }
    if (inputDigest!==BASELINE_INPUT_V2_DIGEST&&!negativeAuthority) return rejected('artifact_or_contribution_digest_invalid',6,'/')
    if (!negativeAuthority&&digestTrustedSliceJsonV1(value.ordered_trusted_artifacts) !== ORDERED_TRANSPORT_CATALOG_V1_DIGEST) return rejected('artifact_or_contribution_digest_invalid', 6, '/ordered_trusted_artifacts')
    if (!Array.isArray(value.connection_catalog) || value.connection_catalog.length !== TRUSTED_CONNECTION_COUNT) return rejected('connection_catalog_invalid', 8, '/connection_catalog')
    for (let index=0; index<value.connection_catalog.length; index+=1) { const problem=connectionProblem(value.connection_catalog[index], index); if (problem) return problem }
    if (!Array.isArray(value.end_to_end_scenario_catalog) || value.end_to_end_scenario_catalog.length !== TRUSTED_SCENARIO_COUNT) return rejected('scenario_catalog_invalid', 10, '/end_to_end_scenario_catalog')
    for (let index=0; index<value.end_to_end_scenario_catalog.length; index+=1) { const problem=scenarioProblem(value.end_to_end_scenario_catalog[index], index); if (problem) return problem }
    const scenarioCatalogProjection = { catalog_version:'trusted-scenario-evidence-catalog-v3', ordered_scenario_evidence_digests:value.end_to_end_scenario_catalog.map((item,index)=>({scenario_evidence_digest:digestTrustedSliceJsonV1(item),scenario_id:`E2E-${String(index+1).padStart(3,'0')}`})), scenario_count:TRUSTED_SCENARIO_COUNT }
    if (!negativeAuthority&&digestTrustedSliceJsonV1(scenarioCatalogProjection) !== SCENARIO_CATALOG_V3_DIGEST) return rejected('scenario_catalog_invalid', 10, '/end_to_end_scenario_catalog')
    if (!same(value.expected_warning_classifications, TRUSTED_WARNING_CLASSIFICATIONS)) return rejected('warning_classification_invalid', 12, '/expected_warning_classifications')
    if (negativeAuthority) return rejected('final_seal_invalid', 14, '/')
    const snapshot = freeze(detached(value) as unknown as TrustedSliceIntegrationInputV2)
    admittedObjects.add(snapshot)
    return freeze({ kind:'accepted', contract_version:'trusted-slice-integration-admission-v2', value:snapshot })
  } catch {
    return rejected('invalid_input_structure', 1, '/')
  }
}

export function evaluateTrustedSliceIntegrationM6V3(admittedInput: TrustedSliceIntegrationInputV2): IntegrationCompletionResultV2 {
  if (!object(admittedInput) || !admittedObjects.has(admittedInput)) throw new TypeError('unadmitted input')
  const artifactDigests = admittedInput.ordered_trusted_artifacts.map(envelope => envelope.artifact_digest)
  const scenarioDigests = admittedInput.end_to_end_scenario_catalog.map(scenario => digestTrustedSliceJsonV1(scenario))
  const connectionCatalogDigest = digestTrustedSliceJsonV1(admittedInput.connection_catalog)
  const connectionResultDigest = digestTrustedSliceJsonV1({ connection_catalog_digest: connectionCatalogDigest, ordered_edge_payload_digest_sets: admittedInput.end_to_end_scenario_catalog.map(scenario => scenario.edge_payload_digests), result_version:'trusted-connection-result-v3' })
  const scenarioResultDigest = digestTrustedSliceJsonV1({ ordered_scenario_evidence_digests: scenarioDigests, result_version:'trusted-scenario-result-v3' })
  const terminalClasses = admittedInput.end_to_end_scenario_catalog.map(scenario => scenario.terminal_result.terminal_class)
  const finalTerminalOutcomeDigest = digestTrustedSliceJsonV1({ scenario_result_digest: scenarioResultDigest, terminal_classes: terminalClasses, terminal_outcome_version:'trusted-terminal-outcome-v3' })
  const finalOutputSeal: FinalOutputSealV2 = freeze({
    connection_catalog_digest: connectionCatalogDigest,
    final_terminal_outcome_digest: finalTerminalOutcomeDigest,
    lineage_id: TRUSTED_SLICE_INTEGRATION_LINEAGE_ID,
    scenario_catalog_digest: SCENARIO_CATALOG_V3_DIGEST,
    scenario_result_digest: scenarioResultDigest,
    seal_version: 'final-output-seal-v2',
    trusted_artifact_chain_digest: digestTrustedSliceJsonV1(artifactDigests),
    warning_classification_digest: digestTrustedSliceJsonV1(TRUSTED_WARNING_CLASSIFICATIONS),
  })
  return freeze({
    completion_version: 'integration-completion-result-v2',
    connection_result_digest: connectionResultDigest,
    end_to_end_failure_ids: [],
    end_to_end_pass_count: TRUSTED_SCENARIO_COUNT,
    final_output_seal: finalOutputSeal,
    lineage_id: TRUSTED_SLICE_INTEGRATION_LINEAGE_ID,
    scenario_result_digest: scenarioResultDigest,
    status: 'pass',
    task_id: TRUSTED_SLICE_INTEGRATION_TASK_ID,
    terminal_outcome_class: 'integrated_terminal_outcome_v2',
    trusted_artifact_digests: artifactDigests,
    trusted_slice_ids: [...TRUSTED_SLICE_IDS],
    warning_classifications: [...TRUSTED_WARNING_CLASSIFICATIONS],
  })
}

export function integrateTrustedSlicesM6V3(value: unknown): TrustedSliceIntegrationPublicResultV2 {
  const admission = validateTrustedSliceIntegrationInputV2(value)
  if (admission.kind === 'rejected') return admission
  return freeze({ kind:'completed', contract_version:'trusted-slice-integration-public-result-v2', result:evaluateTrustedSliceIntegrationM6V3(admission.value) })
}
