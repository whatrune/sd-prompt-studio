import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

try {
  const {
    formatUserDictionaryImportFailure,
    parseUserDictionaryImportText,
    validateUserDictionaryImportPayload,
  } = await server.ssrLoadModule('/src/userDictionaryImport.ts')
  const { usePromptStore } = await server.ssrLoadModule('/src/store.ts')

  const one = { id: 'user-one', prompt: 'custom one', label: 'Custom One', category: 'character', subcategory: 'ユーザー辞書' }
  const two = { id: 'user-two', prompt: ' custom two ', label: '', category: 'pose' }
  const three = { prompt: 'custom three', category: 'background' }

  assert.deepEqual(validateUserDictionaryImportPayload([]), { success: true, items: [] }, 'empty array must remain a valid import')
  assert.equal(validateUserDictionaryImportPayload([one]).success, true, 'one valid entry must be admitted')
  assert.equal(validateUserDictionaryImportPayload([one, two, three]).success, true, 'multiple valid entries must be admitted together')
  assert.equal(validateUserDictionaryImportPayload({ tags: [one] }).success, true, 'legacy tags root must remain compatible')

  for (const [name, items, expectedIndex] of [
    ['first', [null, one, two], 0],
    ['middle', [one, { prompt: 'bad' }, two], 1],
    ['last', [one, two, { category: 'hair' }], 2],
  ]) {
    const result = validateUserDictionaryImportPayload(items)
    assert.equal(result.success, false, `invalid ${name} entry must reject the complete import`)
    assert.equal(result.rejectedCount, 1, `invalid ${name} entry must report one rejection`)
    assert.equal(result.issues[0].index, expectedIndex, `invalid ${name} entry must report its exact index`)
    assert.equal(result.issues[0].reason, 'entry_invalid', `invalid ${name} entry must use the canonical reason`)
  }

  const mixed = validateUserDictionaryImportPayload([one, { id: 'bad-id', prompt: 'missing category' }, two, 42])
  assert.equal(mixed.success, false, 'mixed valid and invalid input must reject atomically')
  assert.equal(mixed.rejectedCount, 2, 'mixed rejection count must include every invalid entry')
  assert.deepEqual(mixed.issues.map(issue => [issue.index, issue.identity]), [[1, 'bad-id'], [3, undefined]], 'bounded issues must retain available identity and index')

  const malformedJson = parseUserDictionaryImportText('{bad json')
  assert.equal(malformedJson.success, false, 'malformed JSON must fail before store mutation')
  assert.equal(malformedJson.issues[0].reason, 'json_invalid', 'malformed JSON must retain its rejection reason')
  const malformedRoot = validateUserDictionaryImportPayload({ entries: [one] })
  assert.equal(malformedRoot.success, false, 'unsupported root shape must fail')
  assert.equal(malformedRoot.issues[0].reason, 'root_not_array', 'unsupported root must retain its rejection reason')

  const duplicatePayload = validateUserDictionaryImportPayload([one, { ...one, id: 'user-one-later', label: 'Later' }])
  assert.equal(duplicatePayload.success, true, 'duplicates remain admissible under the existing first-wins contract')
  assert.equal(validateUserDictionaryImportPayload([{ prompt: '', category: 'unknown-category' }]).success, true, 'existing empty-prompt and unknown-category runtime compatibility must remain unchanged')

  const existing = { id: 'existing', prompt: 'existing prompt', label: 'Existing', category: 'character', subcategory: 'Existing', source: 'user' }
  usePromptStore.setState({ userTags: [existing] })
  const beforeRejected = usePromptStore.getState().userTags
  let rejectedNotifications = 0
  const unsubscribeRejected = usePromptStore.subscribe(() => { rejectedNotifications += 1 })
  const rejected = usePromptStore.getState().importUserTags([one, { prompt: 'invalid middle' }, two])
  unsubscribeRejected()
  assert.equal(rejected.success, false, 'store boundary must reject a mixed payload')
  assert.equal(rejected.added, 0, 'rejected import must add zero entries')
  assert.equal(usePromptStore.getState().userTags, beforeRejected, 'rejected import must preserve the exact existing state reference')
  assert.equal(rejectedNotifications, 0, 'rejected import must perform no store mutation')

  const repeated = usePromptStore.getState().importUserTags([one, { prompt: 'invalid middle' }, two])
  assert.equal(repeated.success, false, 'repeated rejected import must remain rejected')
  assert.equal(usePromptStore.getState().userTags, beforeRejected, 'repeated rejection must remain side-effect free')

  const validResult = usePromptStore.getState().importUserTags([one, two, three])
  assert.deepEqual(validResult, { success: true, added: 3, imported: 3 }, 'valid multi-entry import must report the full committed batch')
  const imported = usePromptStore.getState().userTags
  assert.equal(imported.length, 4, 'valid import must preserve existing state and append all new entries')
  assert.equal(imported[2].prompt, ' custom two ', 'stored prompt bytes must preserve existing normalization behavior')
  assert.equal(imported[2].label, ' custom two ', 'empty labels must preserve the existing prompt fallback')
  assert.equal(imported[2].subcategory, 'ユーザー辞書', 'missing subcategory must preserve the existing fallback')
  assert.equal(imported[3].source, 'user', 'imported entries must retain canonical user source ownership')
  assert.equal(typeof imported[3].id, 'string', 'missing IDs must still be generated')

  const duplicateResult = usePromptStore.getState().importUserTags([
    { ...one, id: 'replacement', label: 'Replacement' },
    { id: 'duplicate-batch', prompt: 'custom three', label: 'Duplicate', category: 'background' },
  ])
  assert.deepEqual(duplicateResult, { success: true, added: 0, imported: 2 }, 'existing duplicate keys must remain successful no-ops')
  assert.equal(usePromptStore.getState().userTags.find(tag => tag.prompt === 'custom one').id, 'user-one', 'existing entry must continue to win duplicate conflicts')

  const manyInvalid = validateUserDictionaryImportPayload(Array.from({ length: 8 }, (_, index) => ({ id: `bad-${index}`, prompt: `bad ${index}` })))
  assert.equal(manyInvalid.success, false, 'many invalid entries must reject')
  assert.equal(manyInvalid.rejectedCount, 8, 'rejection count must remain complete')
  assert.equal(manyInvalid.issues.length, 5, 'displayed issue details must remain bounded')
  assert(formatUserDictionaryImportFailure(manyInvalid).includes('ほか3件'), 'bounded failure UI must disclose omitted detail count')
  const longIdentity = validateUserDictionaryImportPayload([{ id: 'x'.repeat(120), prompt: 'bad' }])
  assert.equal(longIdentity.issues[0].identity.length, 80, 'displayed entry identity must remain bounded')
  assert(formatUserDictionaryImportFailure(mixed).includes('#2 bad-id entry_invalid'), 'failure UI must identify rejected entry and reason')
  assert.equal(formatUserDictionaryImportFailure(malformedJson), 'ユーザー辞書を読み込めませんでした（json_invalid）', 'malformed JSON UI must be distinct')
  assert.equal(formatUserDictionaryImportFailure(malformedRoot), 'ユーザー辞書を読み込めませんでした（root_not_array）', 'malformed root UI must be distinct')

  const exported = JSON.stringify(usePromptStore.getState().userTags, null, 2)
  const exportRoundTrip = parseUserDictionaryImportText(exported)
  assert.equal(exportRoundTrip.success, true, 'current exported array bytes must remain import-compatible')
  assert.equal(exportRoundTrip.items.length, usePromptStore.getState().userTags.length, 'export round-trip must retain every entry')

  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert(appSource.includes('parseUserDictionaryImportText(await file.text())'), 'UI must parse and validate the complete file before store import')
  assert(appSource.includes('store.importUserTags(parsed.items)'), 'UI must use the canonical atomic store path')
  assert(appSource.includes('formatUserDictionaryImportFailure'), 'UI must project bounded rejection feedback')
  assert.equal(appSource.includes('items.filter(item =>'), false, 'UI must not retain partial-entry filtering')

  console.log('Atomic user dictionary import tests passed: 50 assertions')
} finally {
  await server.close()
}
