import { createHash } from 'node:crypto'

import {
  ContractViolationV1,
  GADP_ROLE_DISPATCH_V1,
  validateIdentityV1,
  validateReviewV1,
  validateRoleDispatchEnvelopeV1,
} from './contracts-v1.mjs'
import { sameIdentityBindingV1 } from './identity-review-admission-v1.mjs'

export const GADP_ROLE_OUTPUT_V1 = 'gadp_role_output_v1'

const SHA256 = /^[0-9a-f]{64}$/
const ROLE_OUTPUT_STATUSES = new Set(['COMPLETED', 'FAILED'])
const violation = (reason) => { throw new ContractViolationV1(reason) }
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
const exactKeys = (value, expected, reason) => {
  if (!plainObject(value)) violation(reason)
  const actual = Object.keys(value).sort()
  const canonical = [...expected].sort()
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index])) violation(reason)
}

const canonicalJson = (value) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isSafeInteger(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (plainObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  violation('canonical_value_invalid')
}

export const digestCanonicalV1 = (value) => createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')

export const sealRoleDispatchV1 = ({
  identity: identityInput,
  review: reviewInput,
  roleId,
  profileId,
  purpose,
  authorizedPaths,
  capabilityIds,
  promptSha256,
}) => {
  const identity = validateIdentityV1(identityInput)
  const review = validateReviewV1(reviewInput)
  if (!sameIdentityBindingV1(identity, review.identity)) violation('role_dispatch_binding_invalid')
  return validateRoleDispatchEnvelopeV1({
    record_type: GADP_ROLE_DISPATCH_V1,
    identity,
    role_id: roleId,
    profile_id: profileId,
    purpose,
    source_review_id: review.source_id,
    authorized_paths: authorizedPaths,
    capability_ids: capabilityIds,
    prompt_sha256: promptSha256,
  })
}

export const projectProviderInvocationV1 = ({ dispatch: dispatchInput, prompt }) => {
  const dispatch = validateRoleDispatchEnvelopeV1(dispatchInput)
  if (typeof prompt !== 'string' || prompt.length === 0 || Buffer.byteLength(prompt, 'utf8') > 65536 ||
    digestCanonicalV1(prompt) !== dispatch.prompt_sha256) violation('provider_invocation_binding_invalid')
  return Object.freeze({
    dispatch_sha256: digestCanonicalV1(dispatch),
    profile_id: dispatch.profile_id,
    prompt,
    provider_credential_keys: Object.freeze([]),
    repository_access: false,
    protected_operation_authorized: false,
  })
}

export const validateRoleOutputV1 = ({ dispatch: dispatchInput, output }) => {
  const dispatch = validateRoleDispatchEnvelopeV1(dispatchInput)
  exactKeys(output, [
    'record_type', 'dispatch_sha256', 'identity', 'role_id', 'purpose', 'status', 'body', 'body_sha256',
  ], 'role_output_invalid')
  const identity = validateIdentityV1(output.identity)
  if (
    output.record_type !== GADP_ROLE_OUTPUT_V1 || output.dispatch_sha256 !== digestCanonicalV1(dispatch) ||
    !sameIdentityBindingV1(dispatch.identity, identity) || output.role_id !== dispatch.role_id ||
    output.purpose !== dispatch.purpose || !ROLE_OUTPUT_STATUSES.has(output.status) ||
    typeof output.body !== 'string' || output.body.length === 0 || Buffer.byteLength(output.body, 'utf8') > 262144 ||
    typeof output.body_sha256 !== 'string' || !SHA256.test(output.body_sha256) ||
    output.body_sha256 !== createHash('sha256').update(output.body, 'utf8').digest('hex')
  ) violation('role_output_invalid')
  return Object.freeze({
    ok: true,
    reason: 'role_output_bound',
    output: Object.freeze({ ...output, identity }),
    protected_operation_authorized: false,
  })
}

