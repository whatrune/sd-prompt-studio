import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

try {
  const [{ adultTags }, { buildPrompt }, { migratePersistedState }, { categoryOrder, subcategoryOrder }] = await Promise.all([
    server.ssrLoadModule('/src/data/adultTags.ts'),
    server.ssrLoadModule('/src/prompt.ts'),
    server.ssrLoadModule('/src/store.ts'),
    server.ssrLoadModule('/src/data/tags.ts'),
  ])

  assert.equal(adultTags.length, 131, 'adult tag count must remain unchanged')
  assert.equal(new Set(adultTags.map(tag => tag.id)).size, 131, 'adult tag ids must remain unique')
  assert.equal(adultTags.some(tag => tag.category === 'adult'), false, 'adult must not be a major category')
  assert.equal(categoryOrder.includes('adult'), false, 'adult must not appear in categoryOrder')

  const expectedPlacements = {
    'ポーズ（アダルト）': 'pose',
    '行動（アダルト）': 'pose',
    '相互作用（アダルト）': 'people',
    '表情（アダルト）': 'expression',
    '衣装（アダルト）': 'clothes',
    '道具（アダルト）': 'scene_props',
  }
  for (const [subcategory, category] of Object.entries(expectedPlacements)) {
    assert(subcategoryOrder[category].includes(subcategory), `${subcategory} must be visible under ${category}`)
  }
  for (const tag of adultTags.filter(tag => tag.subcategory?.endsWith('（アダルト）'))) {
    assert.equal(tag.category, expectedPlacements[tag.subcategory], `unexpected placement for ${tag.id}`)
  }

  const normalBlocks = [{
    id: 'subject-1',
    name: '被写体 1',
    tags: [
      { id: 'q', prompt: 'masterpiece', label: '品質', category: 'quality', subcategory: '品質', weight: 1 },
      { id: 'p', prompt: '1girl', label: '一人', category: 'people', subcategory: '人数', weight: 1 },
      { id: 'b', prompt: 'blue hair', label: '青髪', category: 'hair', subcategory: '髪色', weight: 1 },
      { id: 'o', prompt: 'standing', label: '立つ', category: 'pose', subcategory: '基本姿勢', weight: 1.2 },
      { id: 'c', prompt: 'portrait', label: 'ポートレート', category: 'camera', subcategory: '画角・距離', weight: 1 },
      { id: 'l', prompt: 'backlight', label: '逆光', category: 'lighting', subcategory: '光の方向', weight: 1 },
    ],
  }]
  assert.equal(buildPrompt(normalBlocks), [
    '[masterpiece]',
    '[1girl]',
    '[blue hair]\n\nBREAK\n\n[(standing:1.2)]',
    '[portrait]',
    'BREAK',
    '[backlight]',
  ].join('\n\n'), 'existing prompt groups and order must remain unchanged')

  const bySubcategory = Object.fromEntries(
    Object.keys(expectedPlacements).map(subcategory => [subcategory, adultTags.find(tag => tag.subcategory === subcategory)]),
  )
  const adultPrompt = buildPrompt([{ id: 'adult-subject', name: '被写体 1', tags: Object.values(bySubcategory).map(tag => ({ ...tag, weight: 1 })) }])
  assert(adultPrompt.split('\n\n')[1].includes(bySubcategory['相互作用（アダルト）'].prompt))
  assert(adultPrompt.includes(bySubcategory['表情（アダルト）'].prompt))
  assert(adultPrompt.includes(bySubcategory['衣装（アダルト）'].prompt))
  assert(adultPrompt.includes(bySubcategory['ポーズ（アダルト）'].prompt))
  assert(adultPrompt.includes(bySubcategory['行動（アダルト）'].prompt))
  assert(adultPrompt.includes(bySubcategory['道具（アダルト）'].prompt))

  const migrated = migratePersistedState({
    blocks: [{ id: 'saved', name: '被写体 1', tags: [{ id: bySubcategory['ポーズ（アダルト）'].id, prompt: bySubcategory['ポーズ（アダルト）'].prompt, label: 'saved', category: 'adult', subcategory: 'ポーズ', weight: 1.4, rating: 'adult' }] }],
    userTags: [{ id: 'user-adult', prompt: 'custom adult action', label: 'custom', category: 'adult', subcategory: '行動', rating: 'adult', source: 'user' }],
  })
  assert.equal(migrated.blocks[0].tags[0].category, 'pose')
  assert.equal(migrated.blocks[0].tags[0].subcategory, 'ポーズ（アダルト）')
  assert.equal(migrated.blocks[0].tags[0].weight, 1.4)
  assert.equal(migrated.userTags[0].category, 'pose')
  assert.equal(migrated.userTags[0].subcategory, '行動（アダルト）')

  console.log('OK: adult reclassification, prompt regression, and persisted-state migration')
} finally {
  await server.close()
}
