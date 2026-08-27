import type { PromptTag } from './data/tags'

export const USER_DICTIONARY_IMPORT_ISSUE_LIMIT = 5

export type UserDictionaryImportRejectionReason = 'json_invalid' | 'root_not_array' | 'entry_invalid'
export type UserDictionaryImportIssue = Readonly<{
  index: number | null
  identity?: string
  reason: UserDictionaryImportRejectionReason
}>
export type UserDictionaryImportValidation =
  | Readonly<{ success: true; items: readonly PromptTag[] }>
  | Readonly<{ success: false; rejectedCount: number; issues: readonly UserDictionaryImportIssue[] }>
export type UserDictionaryImportResult =
  | Readonly<{ success: true; added: number; imported: number }>
  | Readonly<{ success: false; added: 0; rejectedCount: number; issues: readonly UserDictionaryImportIssue[] }>

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object'

function entryIdentity(value: unknown) {
  if (!isRecord(value)) return undefined
  if (typeof value.id === 'string' && value.id) return value.id.slice(0, 80)
  if (typeof value.prompt === 'string' && value.prompt) return value.prompt.slice(0, 80)
  return undefined
}

export function validateUserDictionaryImportPayload(payload: unknown): UserDictionaryImportValidation {
  const items = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.tags) ? payload.tags : null

  if (!items) {
    return Object.freeze({
      success: false,
      rejectedCount: 0,
      issues: Object.freeze([{ index: null, reason: 'root_not_array' as const }]),
    })
  }

  const invalid = items.flatMap((item, index) => isRecord(item)
    && typeof item.prompt === 'string'
    && typeof item.category === 'string'
    ? []
    : [{ index, identity: entryIdentity(item), reason: 'entry_invalid' as const }])

  if (invalid.length > 0) {
    return Object.freeze({
      success: false,
      rejectedCount: invalid.length,
      issues: Object.freeze(invalid.slice(0, USER_DICTIONARY_IMPORT_ISSUE_LIMIT).map(issue => Object.freeze(issue))),
    })
  }

  return Object.freeze({ success: true, items: Object.freeze([...items] as PromptTag[]) })
}

export function parseUserDictionaryImportText(text: string): UserDictionaryImportValidation {
  try {
    return validateUserDictionaryImportPayload(JSON.parse(text))
  } catch {
    return Object.freeze({
      success: false,
      rejectedCount: 0,
      issues: Object.freeze([{ index: null, reason: 'json_invalid' as const }]),
    })
  }
}

export function formatUserDictionaryImportFailure(result: Extract<UserDictionaryImportValidation | UserDictionaryImportResult, { success: false }>) {
  const rootReason = result.issues[0]?.reason
  if (rootReason === 'json_invalid') return 'ユーザー辞書を読み込めませんでした（json_invalid）'
  if (rootReason === 'root_not_array') return 'ユーザー辞書を読み込めませんでした（root_not_array）'

  const details = result.issues.map(issue => {
    const identity = issue.identity ? ` ${issue.identity}` : ''
    return `#${(issue.index ?? 0) + 1}${identity} ${issue.reason}`
  }).join(', ')
  const omitted = result.rejectedCount - result.issues.length
  const remainder = omitted > 0 ? `, ほか${omitted}件` : ''
  return `ユーザー辞書を読み込めませんでした（${result.rejectedCount}件拒否: ${details}${remainder}）`
}
