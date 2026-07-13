import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

try {
  const [{ adultTags }, { buildPrompt, buildPromptWithStrategy, tagSort }, { migratePersistedState, usePromptStore, isSceneCategory }, { categoryOrder, subcategoryOrder, tags, allTags }, { getConflictReason, getSlotDefinitions }, { canonicalVisibleTags, mergeCanonicalTag, resolveCanonicalTag }, { applyColorModifier, buildColorModifiedTag, findColorModifier, isColorModifiableCategory }] = await Promise.all([
    server.ssrLoadModule('/src/data/adultTags.ts'),
    server.ssrLoadModule('/src/prompt.ts'),
    server.ssrLoadModule('/src/store.ts'),
    server.ssrLoadModule('/src/data/tags.ts'),
    server.ssrLoadModule('/src/engine/smartTagEngine.ts'),
    server.ssrLoadModule('/src/data/canonical.ts'),
    server.ssrLoadModule('/src/modifiers/colorModifier.ts'),
  ])

  assert.equal(usePromptStore.getState().navigationCollapsed, false, 'Navigation must start expanded')
  assert.equal(usePromptStore.getState().workspaceView, 'prompt', 'Prompt must be the initial Workspace view')
  usePromptStore.getState().setNavigationCollapsed(true)
  assert.equal(usePromptStore.getState().navigationCollapsed, true, 'Navigation collapse state must be editable')
  usePromptStore.getState().setWorkspaceView('favorites')
  assert.equal(usePromptStore.getState().workspaceView, 'favorites', 'Favorite navigation must update Workspace view')
  usePromptStore.getState().setWorkspaceView('library')
  assert.equal(usePromptStore.getState().workspaceView, 'library', 'Library navigation must update Workspace view')
  const migratedNavigation = migratePersistedState({ blocks: [{ id: 'navigation-subject', name: '被写体 1', tags: [] }], navigationCollapsed: true, workspaceView: 'library' })
  assert.equal(migratedNavigation.navigationCollapsed, true, 'persisted Navigation collapse state must survive migration')
  assert.equal(migratedNavigation.workspaceView, 'library', 'persisted Workspace view must survive migration')
  usePromptStore.getState().setNavigationCollapsed(false)
  usePromptStore.getState().setWorkspaceView('prompt')

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

  const clothingSubcategories = ['上半身', '下半身', 'ワンピース', 'セット・全身', '制服', '和装', '民族・歴史', 'ファンタジー', '水着', '下着・部屋着', 'レッグウェア', '靴', 'アクセサリー', '素材・デザイン', '衣装（アダルト）']
  assert.deepEqual(subcategoryOrder.clothes, clothingSubcategories)
  const clothingDictionary = JSON.parse(fs.readFileSync(new URL('../data/clothes.json', import.meta.url), 'utf8'))
  assert.equal(clothingDictionary.length, 505, 'clothing dictionary tag count must remain unchanged')
  assert.equal(new Set(clothingDictionary.map(tag => tag.id)).size, 505, 'clothing dictionary ids must remain unique')
  const clothingTags = tags.filter(tag => tag.category === 'clothes')
  assert.equal(clothingTags.length, 502, 'runtime clothing tags must include the three Character clothing-state tags')
  assert.equal(new Set(clothingTags.map(tag => tag.id)).size, 502, 'runtime clothing ids must remain unique')
  assert.equal(clothingTags.every(tag => clothingSubcategories.includes(tag.subcategory)), true)
  assert.equal(adultTags.filter(tag => tag.category === 'clothes').length, 27)
  assert.equal(adultTags.filter(tag => tag.category === 'clothes').every(tag => tag.subcategory === '衣装（アダルト）'), true)

  const legacyOrderPrompts = ['high heels', 'latex', 'dress', 'skirt', 'shirt']
  const legacyOrderedTags = legacyOrderPrompts.map(prompt => clothingTags.find(tag => tag.prompt === prompt))
  assert.deepEqual([...legacyOrderedTags].sort(tagSort).map(tag => tag.prompt), ['shirt', 'skirt', 'dress', 'latex', 'high heels'], 'clothing Prompt order must remain compatible')

  const adultClothingOrder = [
    clothingTags.find(tag => tag.prompt === 'dress'),
    clothingTags.find(tag => tag.prompt === 'shirt'),
    adultTags.find(tag => tag.prompt === 'nude'),
    adultTags.find(tag => tag.prompt === 'see-through clothes'),
  ]
  assert.deepEqual([...adultClothingOrder].sort(tagSort).map(tag => tag.prompt), ['shirt', 'dress', 'see-through clothes', 'nude'], 'adult clothing Prompt order must remain compatible')

  const eastAsianTraditionalPrompts = new Set(['china dress', 'qipao', 'cheongsam', 'hanfu', 'hanbok'])
  const eastAsianTraditionalTags = clothingDictionary.filter(tag => eastAsianTraditionalPrompts.has(tag.prompt))
  assert.equal(eastAsianTraditionalTags.length, 6)
  assert.equal(eastAsianTraditionalTags.every(tag => tag.subcategory === '民族・歴史'), true, 'Chinese and Korean traditional clothing must not be classified as Japanese clothing')

  const nonJapaneseTraditionalPrompts = new Set(['sari', 'kilt', 'dirndl'])
  const nonJapaneseTraditionalTags = clothingDictionary.filter(tag => nonJapaneseTraditionalPrompts.has(tag.prompt))
  assert.equal(nonJapaneseTraditionalTags.length, 3)
  assert.equal(nonJapaneseTraditionalTags.every(tag => tag.subcategory === '民族・歴史'), true, 'non-Japanese traditional clothing must not be classified as Japanese clothing')
  const japaneseTraditionalPrompts = ['kimono', 'yukata', 'furisode', 'hakama skirt', 'jinbei', 'miko outfit', 'haori']
  assert.equal(japaneseTraditionalPrompts.every(prompt => clothingDictionary.find(tag => tag.prompt === prompt)?.subcategory === '和装'), true, 'Japanese traditional clothing must remain in the Japanese clothing category')

  const migratedClothing = migratePersistedState({
    blocks: [{ id: 'clothes', name: '被写体 1', tags: [{ id: 'clo-dress-shirt', prompt: 'dress shirt', label: 'saved', category: 'clothes', subcategory: 'トップス', weight: 1.3 }] }],
    userTags: [],
  })
  assert.equal(migratedClothing.blocks[0].tags[0].subcategory, '上半身')
  assert.equal(migratedClothing.blocks[0].tags[0].sortSubcategory, 'トップス')
  assert.equal(migratedClothing.blocks[0].tags[0].weight, 1.3)

  const newUserClothingTag = { id: 'user-new-clothes', prompt: 'custom coordinated outfit', label: 'custom', category: 'clothes', subcategory: 'セット・全身', weight: 1 }
  const unknownUserClothingTag = { id: 'user-unknown-clothes', prompt: 'unknown custom outfit', label: 'unknown', category: 'clothes', subcategory: '将来追加される分類', weight: 1 }
  const knownClothingTag = { ...clothingTags.find(tag => tag.prompt === 'shirt'), weight: 1 }
  assert.deepEqual([newUserClothingTag, knownClothingTag, unknownUserClothingTag].sort(tagSort).map(tag => tag.prompt), ['shirt', 'custom coordinated outfit', 'unknown custom outfit'], 'new and unknown user clothing subcategories must sort after legacy categories')

  const migratedUserSwimwear = migratePersistedState({
    blocks: [],
    userTags: [
      { id: 'user-swimsuit', prompt: 'competition swimsuit', label: 'swimsuit', category: 'clothes', subcategory: '水着・下着', source: 'user' },
      { id: 'user-rash-guard', prompt: 'long sleeve rash guard', label: 'rash guard', category: 'clothes', subcategory: '水着・下着', source: 'user' },
      { id: 'user-lingerie', prompt: 'lace lingerie', label: 'lingerie', category: 'clothes', subcategory: '水着・下着', source: 'user' },
    ],
  })
  assert.deepEqual(migratedUserSwimwear.userTags.map(tag => tag.subcategory), ['水着', '水着', '下着・部屋着'])

  const dictionary = [...tags, ...adultTags]
  const findTag = prompt => dictionary.find(tag => tag.prompt === prompt)
  const selectedTag = prompt => ({ ...findTag(prompt), weight: 1 })
  const conflict = (candidate, selected) => getConflictReason(findTag(candidate), selected.map(selectedTag), dictionary)
  for (const [inner, outer] of [['camisole', 'shirt'], ['shirt', 'cardigan'], ['t-shirt', 'hoodie'], ['dress', 'coat']]) {
    assert.equal(conflict(outer, [inner]), null, `${inner} + ${outer} must be allowed`)
  }
  for (const [first, second] of [['shirt', 'blouse'], ['t-shirt', 'sweater'], ['jacket', 'cardigan'], ['dress', 'pants']]) {
    assert.equal(conflict(second, [first])?.level, 'hard', `${first} + ${second} must conflict`)
  }
  assert.equal(conflict('shirt', ['shirt']), null, 'a selected tag must not conflict with itself')
  const explicitConflictCandidate = { ...findTag('shirt'), id: 'explicit-conflict', prompt: 'explicit conflict shirt', conflicts: ['cardigan'] }
  assert.equal(getConflictReason(explicitConflictCandidate, [selectedTag('cardigan')], dictionary)?.level, 'hard', 'explicit conflicts must take priority')
  const incompleteTopA = { id: 'incomplete-top-a', prompt: 'custom upper garment a', label: 'A', category: 'clothes', subcategory: '上半身', slot: 'top_main' }
  const incompleteTopB = { id: 'incomplete-top-b', prompt: 'custom upper garment b', label: 'B', category: 'clothes', subcategory: '上半身', slot: 'top_main', layer: 'main' }
  assert.equal(getConflictReason(incompleteTopB, [{ ...incompleteTopA, weight: 1 }], [incompleteTopA, incompleteTopB])?.level, 'hard', 'incomplete clothing metadata must fall back to same-slot conflict detection')

  assert(getSlotDefinitions().some(slot => slot.id === 'upper_eyelashes'))
  assert(getSlotDefinitions().some(slot => slot.id === 'lower_eyelashes'))
  assert.equal(conflict('lower eyelashes', ['upper eyelashes']), null, 'upper and lower eyelashes must be compatible')
  assert.equal(conflict('long lower eyelashes', ['lower eyelashes'])?.level, 'hard', 'two lower-eyelash variants must conflict')
  assert.equal(conflict('upper eyelashes', ['long eyelashes'])?.level, 'hard', 'unspecified eyelashes must conflict with an explicit upper-eyelash tag')
  assert.equal(conflict('lower eyelashes', ['long eyelashes']), null, 'unspecified eyelashes are treated as upper and may coexist with lower eyelashes')
  assert.equal(conflict('sidelocks', ['bangs']), null, 'front bangs and sidelocks must be compatible')
  assert.equal(conflict('pants', ['shirt']), null, 'upper and lower garments must be compatible')
  assert.equal(conflict('glasses', ['hat']), null, 'head and face accessories must be compatible')
  assert.equal(conflict('raised eyebrow', ['thick eyebrows']), null, 'eyebrow shape and state must be compatible')
  assert.equal(conflict('sad eyebrows', ['raised eyebrow'])?.level, 'hard', 'two eyebrow states must conflict')
  assert.equal(conflict('raised eyebrow', ['thick eyebrows']), null, 'eyebrow state and shape must coexist')
  assert.equal(conflict('open mouth', ['fang']), null, 'mouth openness and mouth feature must coexist')
  assert.equal(conflict('fang', ['closed mouth']), null, 'closed mouth and fang feature must coexist')
  assert.equal(conflict('sharp teeth', ['closed mouth']), null, 'closed mouth and sharp-teeth feature must coexist')
  assert.equal(conflict('visible teeth', ['closed mouth'])?.level, 'hard', 'closed mouth and visible teeth must conflict')
  assert.equal(conflict('tongue out', ['closed mouth'])?.level, 'hard', 'closed mouth and tongue out must conflict')
  assert.equal(conflict('looking at viewer', ['closed eyes'])?.level, 'hard', 'closed eyes and directed gaze must conflict')
  assert.equal(conflict('star-shaped highlights', ['no eye highlights'])?.level, 'hard', 'highlight shape and no highlights must conflict')
  assert.equal(conflict('sparkling eyes', ['wet eyes']), null, 'multiple eye effects must coexist')
  assert.equal(conflict('winged eyeliner', ['monolid']), null, 'eyeliner style and eyelid shape must coexist')
  assert(getSlotDefinitions().some(slot => slot.id === 'eye_effect' && slot.mode === 'multiple'))
  assert(getSlotDefinitions().some(slot => slot.id === 'eyelash_shape'))
  assert(getSlotDefinitions().some(slot => slot.id === 'eyelash_color'))
  assert(getSlotDefinitions().some(slot => slot.id === 'eyelash_decoration' && slot.mode === 'multiple'))

  const eyesDictionary = JSON.parse(fs.readFileSync(new URL('../data/eyes.json', import.meta.url), 'utf8'))
  const expressionDictionary = JSON.parse(fs.readFileSync(new URL('../data/expression.json', import.meta.url), 'utf8'))
  assert.equal(eyesDictionary.length, 302)
  assert.equal(eyesDictionary.filter(tag => !tag.deprecated).length, 297)
  assert.equal(expressionDictionary.length, 114)
  assert.equal(expressionDictionary.filter(tag => !tag.deprecated).length, 108, 'canonical expressions must exclude six redirects')
  for (const id of ['exp-v5-biting-lip','exp-v5-fangs','exp-v5-furrowed-brows','v19-exp-cheek-puff','v19-exp-pouting','exp-v5-blushing']) {
    assert(resolveCanonicalTag(id, allTags), `${id} must resolve to a canonical expression`)
    assert.equal(tags.some(tag => tag.id === id), false, `${id} must not be displayed`)
  }
  const expressionOrder = ['angry', 'happy', 'smile'].map(prompt => ({ ...findTag(prompt), weight: 1 }))
  assert.deepEqual([...expressionOrder].sort(tagSort).map(tag => tag.prompt), ['smile', 'happy', 'angry'], 'existing expression Prompt order must remain compatible')

  const rinEyeRedirects = {
    'rin-eye-empty-eyes': 'eye-empty-eyes',
    'rin-eye-teary-eyes': 'eye-teary-eyes',
    'rin-eye-glowing-eyes': 'eye-glowing-eyes',
    'rin-eye-star-highlights': 'eye-star-shaped-highlights',
    'rin-eye-slit-pupils': 'eye-slit-pupils',
  }
  for (const [legacyId, canonicalId] of Object.entries(rinEyeRedirects)) {
    assert.equal(resolveCanonicalTag(legacyId, allTags)?.id, canonicalId)
    assert.equal(tags.some(tag => tag.id === legacyId), false)
  }
  assert.equal(tags.find(tag => tag.prompt === 'red pupils')?.slot, 'pupil_color')
  assert.equal(tags.find(tag => tag.prompt === 'dilated pupils')?.slot, 'pupil_size_state')
  assert.equal(tags.find(tag => tag.prompt === 'half-closed eyes')?.slot, 'eye_state')
  assert(getSlotDefinitions().some(slot => slot.id === 'pupil_color' && slot.mode === 'single'))
  assert(getSlotDefinitions().some(slot => slot.id === 'pupil_size_state' && slot.mode === 'single'))
  assert.equal(conflict('empty eyes', ['round eyes']), null, 'eye shape and eye state must coexist')
  assert.equal(conflict('teary eyes', ['looking at viewer']), null, 'gaze direction and eye state must coexist')
  assert.equal(conflict('star-shaped highlights', ['glowing eyes']), null, 'eye effect and highlight shape must coexist')
  assert.equal(conflict('red pupils', ['slit pupils']), null, 'pupil shape and pupil color must coexist')
  assert.equal(conflict('star-shaped highlights', ['no eye highlights'])?.level, 'hard')
  const pupilBeforeColor = ['red eyes', 'slit pupils'].map(prompt => ({ ...findTag(prompt), weight: 1 }))
  assert.deepEqual([...pupilBeforeColor].sort(tagSort).map(tag => tag.prompt), ['slit pupils', 'red eyes'], 'pupil group must sort before eye color')
  const orderedEyePrompt = buildPrompt([{ id: 'eye-order', name: '被写体 1', tags: pupilBeforeColor }])
  assert(orderedEyePrompt.includes('[slit pupils, red eyes]'), 'Prompt output must apply pupil-before-color ordering without changing tag strings')
  const customPromptOrder = [
    { id: 'order-late', prompt: 'late', label: 'late', category: 'eyes', subcategory: '目の色', promptGroup: 'custom-eyes', promptOrder: 20, weight: 1 },
    { id: 'order-early', prompt: 'early', label: 'early', category: 'eyes', subcategory: '目の色', promptGroup: 'custom-eyes', promptOrder: 10, weight: 1 },
  ]
  assert.deepEqual([...customPromptOrder].sort(tagSort).map(tag => tag.prompt), ['early', 'late'], 'promptOrder must override selection order within a group')
  assert.equal(conflict('red pupils', ['slit pupils']), null, 'conflict evaluation must remain independent from prompt sorting')
  assert.equal(conflict('waving', ['walking']), null, 'compatible body motions must not share an exclusive slot')
  assert.equal(conflict('running', ['walking'])?.level, 'hard', 'walking and running must conflict')
  assert.equal(conflict('lying', ['standing'])?.level, 'hard', 'standing and lying must conflict')
  assert.equal(conflict('jumping', ['sitting'])?.level, 'hard', 'jumping and sitting must conflict')

  const poseDictionary = JSON.parse(fs.readFileSync(new URL('../data/pose.json', import.meta.url), 'utf8'))
  assert.equal(poseDictionary.length, 336, 'Motion physical dictionary must include the RIN daily-action batch')
  assert.equal(new Set(poseDictionary.map(tag => tag.id)).size, 336, 'Motion ids must remain unique')
  assert.equal(poseDictionary.filter(tag => !tag.deprecated).length, 304, 'canonical Motion display count must exclude redirects')
  assert.equal(allTags.filter(tag => tag.category === 'pose').length, 336, 'physical Motion rows must remain available')
  assert.equal(tags.filter(tag => tag.category === 'pose').length, 304, 'deprecated Motion rows must not be exposed to the UI')
  assert.equal(tags.some(tag => tag.deprecated), false, 'deprecated tags must not be visible')
  for (const tag of poseDictionary) assert(resolveCanonicalTag(tag.id, allTags), `every legacy id must resolve: ${tag.id}`)
  assert.equal(resolveCanonicalTag('rin-pose-on-back', allTags)?.id, 'pos-lying-on-back')
  assert.equal(resolveCanonicalTag('rin-v-sign', allTags)?.prompt, 'peace sign', 'ambiguous v must not replace the canonical Prompt')
  assert(tags.find(tag => tag.id === 'pos-peace-sign')?.aliases?.includes('v'), 'v must remain searchable as an alias')
  assert.deepEqual(tags.find(tag => tag.id === 'pos-lying-on-back')?.sources, ['existing', 'RIN'])

  const rinGymnasticsRedirects = {
    'rin-standing-split': 'v19-motion-y-balance',
    'rin-needle-pose': 'v19-motion-needle-pose',
    'rin-handstand': 'v19-motion-handstand',
    'rin-cartwheel': 'v19-motion-cartwheel',
    'rin-backflip': 'v19-motion-backflip',
  }
  for (const [legacyId, canonicalId] of Object.entries(rinGymnasticsRedirects)) {
    assert.equal(resolveCanonicalTag(legacyId, allTags)?.id, canonicalId, `${legacyId} must resolve to its existing canonical tag`)
    assert.equal(tags.some(tag => tag.id === legacyId), false, `${legacyId} must not be displayed`)
    assert.deepEqual(tags.find(tag => tag.id === canonicalId)?.sources, ['existing', 'RIN'])
  }
  const rinYogaPrompts = ['lotus pose', 'downward-facing dog', 'tree pose', 'warrior pose', 'cobra pose']
  for (const prompt of rinYogaPrompts) {
    const tag = tags.find(item => item.prompt === prompt)
    assert(tag, `${prompt} must be added as a distinct canonical tag`)
    assert.deepEqual(tag.sources, ['RIN'])
    assert(tag.label && tag.aliases?.length && tag.related?.length && tag.description && tag.slot, `${prompt} must include complete RIN metadata`)
  }
  assert.deepEqual(tags.find(tag => tag.prompt === 'handstand')?.slot, ['acrobatics', 'balance_pose'], 'handstand must occupy acrobatics and balance slots')
  assert.deepEqual(tags.find(tag => tag.prompt === 'backflip')?.slot, ['acrobatics', 'airborne_state'])
  assert.deepEqual(tags.find(tag => tag.prompt === 'standing split')?.slot, ['balance_pose', 'leg_pose'])
  assert.equal(conflict('handstand', ['standing split'])?.level, 'hard', 'handstand and standing split must conflict through balance_pose')
  assert.equal(conflict('cartwheel', ['backflip'])?.level, 'hard', 'two acrobatics actions must conflict')

  const rinDanceRedirects = {
    'rin-dance-ballet': 'v19-motion-ballet-pose',
    'rin-dance-arabesque': 'v19-motion-arabesque',
    'rin-dance-pirouette': 'v19-motion-pirouette',
    'rin-dance-fan-dance': 'v19-motion-fan-dance',
    'rin-dance-belly-dance': 'v19-motion-belly-dance',
    'rin-dance-ribbon-dance': 'v19-motion-ribbon-dance',
  }
  for (const [legacyId, canonicalId] of Object.entries(rinDanceRedirects)) {
    assert.equal(resolveCanonicalTag(legacyId, allTags)?.id, canonicalId, `${legacyId} must resolve to its existing canonical dance tag`)
    assert.equal(tags.some(tag => tag.id === legacyId), false, `${legacyId} must not be displayed`)
    assert.deepEqual(tags.find(tag => tag.id === canonicalId)?.sources, ['existing', 'RIN'])
  }
  const specificRinDances = ['hip hop dance', 'idol dance', 'flamenco', 'pole dance']
  for (const prompt of specificRinDances) {
    const tag = tags.find(item => item.prompt === prompt)
    assert(tag, `${prompt} must be added as a distinct canonical dance style`)
    assert.deepEqual(tag.sources, ['RIN'])
    assert(tag.label && tag.aliases?.length && tag.related?.length && tag.description && tag.slot, `${prompt} must include complete RIN metadata`)
  }
  assert(tags.some(tag => tag.prompt === 'dancing'), 'generic dance must remain a separate canonical tag')
  assert(tags.some(tag => tag.prompt === 'ballet'), 'RIN ballet Prompt must be promoted on the existing canonical id')
  assert(tags.find(tag => tag.prompt === 'ballet')?.aliases?.includes('ballet pose'))
  assert.deepEqual(tags.find(tag => tag.prompt === 'arabesque')?.slot, ['dance_move', 'balance_pose', 'leg_pose'])
  assert.deepEqual(tags.find(tag => tag.prompt === 'pirouette')?.slot, ['dance_move', 'balance_pose'])
  assert.deepEqual(tags.find(tag => tag.prompt === 'fan dance')?.slot, ['dance_style', 'hand_action'])
  assert.equal(conflict('ballet', ['dancing'])?.level, 'hard', 'generic and specific dance styles must remain distinct and conflict')
  assert.equal(conflict('flamenco', ['hip hop dance'])?.level, 'hard', 'different dance styles must conflict')
  assert.equal(conflict('arabesque', ['ballet']), null, 'ballet style and arabesque move must coexist')
  assert.equal(conflict('pirouette', ['ballet']), null, 'ballet style and pirouette move must coexist')
  assert.equal(conflict('pirouette', ['arabesque'])?.level, 'hard', 'different dance moves must conflict')
  assert.equal(conflict('ballet', ['standing']), null, 'dance style and body posture must coexist')
  assert.equal(conflict('arabesque', ['standing']), null, 'dance balance pose and base posture must coexist')
  assert.equal(conflict('fan dance', ['standing']), null, 'dance hand action and base posture must coexist')

  const dancePromptOrder = ['hip hop dance', 'ballet', 'dancing'].map(prompt => ({ ...findTag(prompt), weight: 1 }))
  assert.deepEqual([...dancePromptOrder].sort(tagSort).map(tag => tag.prompt), ['dancing', 'ballet', 'hip hop dance'], 'new specific dances must preserve legacy dance Prompt order')

  const rinSportRedirects = {
    'rin-sport-swimming': 'pos-swimming',
    'rin-sport-cycling': 'v19-motion-cycling',
    'rin-sport-surfing': 'v19-motion-surfing',
    'rin-sport-skiing': 'v19-motion-skiing',
    'rin-sport-soccer-kick': 'v19-motion-soccer-kick',
    'rin-sport-basketball-shot': 'v19-motion-basketball-shot',
    'rin-sport-tennis-serve': 'v19-motion-tennis-serve',
    'rin-sport-baseball-swing': 'v19-motion-baseball-batting',
  }
  for (const [legacyId, canonicalId] of Object.entries(rinSportRedirects)) {
    assert.equal(resolveCanonicalTag(legacyId, allTags)?.id, canonicalId, `${legacyId} must resolve to its existing canonical sport tag`)
    assert.equal(tags.some(tag => tag.id === legacyId), false, `${legacyId} must not be displayed`)
  }
  const sportTypes = ['soccer', 'basketball', 'tennis', 'baseball', 'volleyball']
  for (const prompt of sportTypes) assert.equal(tags.find(tag => tag.prompt === prompt)?.slot, 'sport_type', `${prompt} must use sport_type`)
  assert(getSlotDefinitions().some(slot => slot.id === 'sport_type' && slot.mode === 'single'))
  assert.equal(tags.find(tag => tag.id === 'v19-motion-baseball-batting')?.prompt, 'baseball swing')
  assert(tags.find(tag => tag.prompt === 'baseball swing')?.aliases?.includes('baseball batting'))
  assert.deepEqual(tags.find(tag => tag.prompt === 'swimming')?.slot, ['sport_action', 'locomotion'])
  assert.deepEqual(tags.find(tag => tag.prompt === 'basketball dunk')?.slot, ['sport_action', 'hand_action'])
  assert.equal(conflict('soccer kick', ['soccer']), null, 'sport type and matching sport action must coexist')
  assert.equal(conflict('soccer kick', ['running']), null, 'sport action and locomotion must coexist')
  assert.equal(conflict('basketball', ['soccer'])?.level, 'hard', 'different sport types must conflict')
  assert.equal(conflict('running', ['swimming'])?.level, 'hard', 'swimming and running must conflict')
  assert.equal(conflict('jumping', ['basketball dunk']), null, 'basketball dunk and jumping must coexist')

  const sportPromptOrder = ['baseball swing', 'soccer kick', 'swimming'].map(prompt => ({ ...findTag(prompt), weight: 1 }))
  assert.deepEqual([...sportPromptOrder].sort(tagSort).map(tag => tag.prompt), ['swimming', 'soccer kick', 'baseball swing'], 'existing sport Prompt order must remain compatible')

  const rinDailyRedirects = {
    'rin-daily-waving': 'pos-waving',
    'rin-daily-pointing': 'pos-pointing',
    'rin-daily-taking-selfie': 'pos-taking-selfie',
    'rin-daily-writing': 'pos-writing',
    'rin-daily-drinking': 'pos-drinking',
    'rin-daily-cooking': 'pos-cooking',
    'rin-daily-playing-guitar': 'pos-playing-guitar',
    'rin-interaction-hugging': 'peo-hugging',
  }
  for (const [legacyId, canonicalId] of Object.entries(rinDailyRedirects)) {
    assert.equal(resolveCanonicalTag(legacyId, allTags)?.id, canonicalId, `${legacyId} must resolve to its existing canonical tag`)
    assert.equal(tags.some(tag => tag.id === legacyId), false, `${legacyId} must not be displayed`)
  }
  for (const prompt of ['holding phone', 'reading book', 'carrying']) {
    const tag = tags.find(item => item.prompt === prompt)
    assert(tag && tag.category === 'pose', `${prompt} must be added as a self-contained Motion tag`)
    assert.deepEqual(tag.sources, ['RIN'])
  }
  const hugging = tags.find(tag => tag.prompt === 'hugging')
  const handshake = tags.find(tag => tag.prompt === 'handshake')
  assert.equal(hugging?.category, 'people', 'hugging must remain outside Motion')
  assert.equal(handshake?.category, 'people', 'handshake must be separated from Motion')
  assert.equal(hugging?.slot, 'interaction_action')
  assert.equal(handshake?.slot, 'interaction_action')
  assert(getSlotDefinitions().some(slot => slot.id === 'interaction_action' && slot.mode === 'single'))
  assert.equal(conflict('waving', ['standing']), null, 'hand action and body posture must coexist')
  assert.equal(conflict('reading book', ['sitting']), null, 'daily hand/gaze action and posture must coexist')
  assert.equal(conflict('handshake', ['hugging'])?.level, 'hard', 'different interaction actions must conflict')

  const dailyPromptOrder = ['playing guitar', 'taking selfie', 'drinking', 'cooking', 'writing', 'reading'].map(prompt => ({ ...findTag(prompt), weight: 1 }))
  assert.deepEqual([...dailyPromptOrder].sort(tagSort).map(tag => tag.prompt), ['reading', 'writing', 'cooking', 'drinking', 'taking selfie', 'playing guitar'], 'existing daily-action Prompt order must remain compatible')

  const futureRinTag = { id: 'rin-future-wave', label: 'RIN wave', prompt: 'wave', category: 'pose', sources: ['RIN'], aliases: ['future wave'], related: ['waving'] }
  const mergedFutureTag = mergeCanonicalTag(tags.find(tag => tag.id === 'pos-waving'), futureRinTag)
  assert.deepEqual(mergedFutureTag.sources, ['existing', 'RIN'], 'future RIN batches must use the same source merge rule')
  assert.equal(mergedFutureTag.prompt, 'wave', 'future RIN Prompt must be preferred by the canonical merge rule')
  assert(mergedFutureTag.aliases.includes('future wave'))
  assert(mergedFutureTag.aliases.includes('waving'), 'the previous canonical Prompt must remain searchable')
  assert.equal(mergeCanonicalTag(tags.find(tag => tag.id === 'pos-peace-sign'), { ...futureRinTag, prompt: 'v' }).prompt, 'peace sign', 'ambiguous RIN Prompts may be excluded from promotion')
  assert.equal(canonicalVisibleTags([...allTags, { ...futureRinTag, deprecated: true, redirectTo: 'pos-waving' }]).some(tag => tag.id === futureRinTag.id), false)
  const motionSubcategories = new Set(['基本姿勢', '姿勢の変化', '手・腕の動作', '脚・開脚', '移動', '空中・落下', 'バランス', '体操・アクロバット', 'ダンス', 'スポーツ', '武術・戦闘', '乗り物・騎乗'])
  assert.equal(poseDictionary.every(tag => motionSubcategories.has(tag.subcategory)), true, 'every Motion tag must use the redesigned subcategories')
  assert(getSlotDefinitions().some(slot => slot.id === 'vehicle_action' && slot.mode === 'single'))
  assert(getSlotDefinitions().some(slot => slot.id === 'dance_style' && slot.mode === 'single'))
  assert(getSlotDefinitions().some(slot => slot.id === 'dance_move' && slot.mode === 'single'))
  assert(getSlotDefinitions().some(slot => slot.id === 'combat_action' && slot.mode === 'multiple'))

  const motionOrderPrompts = ['horseback riding', 'punching', 'swimming', 'dancing', 'handstand', 'falling', 'walking', 'knees to chest', 'head tilt', 'arms crossed', 'standing']
  const motionOrderTags = motionOrderPrompts.map(prompt => ({ ...findTag(prompt), weight: 1 }))
  const expectedMotionOrder = ['standing', 'arms crossed', 'head tilt', 'knees to chest', 'walking', 'falling', 'handstand', 'dancing', 'swimming', 'punching', 'horseback riding']
  assert.deepEqual([...motionOrderTags].sort(tagSort).map(tag => tag.prompt), expectedMotionOrder, 'legacy Motion Prompt order must remain compatible')
  const motionPrompt = buildPrompt([{ id: 'motion-order', name: '被写体 1', tags: motionOrderTags }])
  assert(motionPrompt.includes(`[${expectedMotionOrder.join(', ')}]`), 'Motion Prompt output order must remain compatible')

  for (const [first, second] of [['walking', 'waving'], ['running', 'waving'], ['jumping', 'arms raised'], ['floating', 'reaching'], ['soccer kick', 'running'], ['punching', 'walking'], ['horseback riding', 'waving']]) {
    assert.equal(conflict(second, [first]), null, `${first} + ${second} must be compatible`)
  }
  for (const [first, second] of [['standing', 'sitting'], ['walking', 'running'], ['jumping', 'floating'], ['jumping', 'sitting'], ['falling', 'floating'], ['handstand', 'standing'], ['dancing', 'belly dance'], ['soccer kick', 'basketball shot'], ['horseback riding', 'riding motorcycle']]) {
    assert.equal(conflict(second, [first])?.level, 'hard', `${first} + ${second} must conflict`)
  }

  const migratedMotion = migratePersistedState({
    blocks: [{ id: 'motion', name: '被写体 1', tags: [{ id: 'pos-walking', prompt: 'walking', label: '歩く', category: 'pose', subcategory: '日常動作', weight: 1.3 }] }],
    userTags: [],
  })
  assert.equal(migratedMotion.blocks[0].tags[0].subcategory, '移動')
  assert.equal(migratedMotion.blocks[0].tags[0].sortSubcategory, '日常動作')
  assert.equal(migratedMotion.blocks[0].tags[0].weight, 1.3)

  const migratedCanonicalMotion = migratePersistedState({
    blocks: [{ id: 'canonical-motion', name: '被写体 1', tags: [{ id: 'rin-pose-on-back', prompt: 'on back', label: '仰向け', category: 'pose', weight: 1.4 }] }],
    favoriteIds: ['rin-pose-on-back', 'rin-v-sign'],
    userTags: [],
  })
  assert.equal(migratedCanonicalMotion.blocks[0].tags.length, 1, 'saved selections must not be lost')
  assert.equal(migratedCanonicalMotion.blocks[0].tags[0].id, 'pos-lying-on-back')
  assert.equal(migratedCanonicalMotion.blocks[0].tags[0].prompt, 'on back')
  assert.equal(migratedCanonicalMotion.blocks[0].tags[0].weight, 1.4)
  assert.deepEqual(migratedCanonicalMotion.favoriteIds, ['pos-lying-on-back', 'pos-peace-sign'])

  const migratedRinGymnastics = migratePersistedState({
    blocks: [{ id: 'rin-gymnastics', name: '被写体 1', tags: [{ id: 'rin-handstand', prompt: 'handstand', label: '逆立ち', category: 'pose', weight: 1.2 }] }],
    favoriteIds: ['rin-handstand', 'rin-standing-split'],
    userTags: [],
  })
  assert.equal(migratedRinGymnastics.blocks[0].tags[0].id, 'v19-motion-handstand')
  assert.equal(migratedRinGymnastics.blocks[0].tags[0].weight, 1.2)
  assert.deepEqual(migratedRinGymnastics.favoriteIds, ['v19-motion-handstand', 'v19-motion-y-balance'])

  const migratedRinDance = migratePersistedState({
    blocks: [{ id: 'rin-dance', name: '被写体 1', tags: [{ id: 'rin-dance-ballet', prompt: 'ballet', label: 'バレエ', category: 'pose', weight: 1.1 }] }],
    favoriteIds: ['rin-dance-ballet', 'rin-dance-ribbon-dance'],
    userTags: [],
  })
  assert.equal(migratedRinDance.blocks[0].tags[0].id, 'v19-motion-ballet-pose')
  assert.equal(migratedRinDance.blocks[0].tags[0].prompt, 'ballet')
  assert.equal(migratedRinDance.blocks[0].tags[0].weight, 1.1)
  assert.deepEqual(migratedRinDance.favoriteIds, ['v19-motion-ballet-pose', 'v19-motion-ribbon-dance'])

  const migratedRinSport = migratePersistedState({
    blocks: [{ id: 'rin-sport', name: '被写体 1', tags: [{ id: 'rin-sport-baseball-swing', prompt: 'baseball swing', label: '野球スイング', category: 'pose', weight: 1.2 }] }],
    favoriteIds: ['rin-sport-baseball-swing', 'rin-sport-swimming'],
    userTags: [],
  })
  assert.equal(migratedRinSport.blocks[0].tags[0].id, 'v19-motion-baseball-batting')
  assert.equal(migratedRinSport.blocks[0].tags[0].prompt, 'baseball swing')
  assert.equal(migratedRinSport.blocks[0].tags[0].weight, 1.2)
  assert.deepEqual(migratedRinSport.favoriteIds, ['v19-motion-baseball-batting', 'pos-swimming'])

  const migratedRinDaily = migratePersistedState({
    blocks: [{ id: 'rin-daily', name: '被写体 1', tags: [{ id: 'rin-daily-taking-selfie', prompt: 'taking selfie', label: '自撮り', category: 'pose', weight: 1.3 }] }],
    favoriteIds: ['rin-daily-taking-selfie', 'rin-interaction-hugging'],
    userTags: [],
  })
  assert.equal(migratedRinDaily.blocks[0].tags[0].id, 'pos-taking-selfie')
  assert.equal(migratedRinDaily.blocks[0].tags[0].weight, 1.3)
  assert.deepEqual(migratedRinDaily.favoriteIds, ['pos-taking-selfie', 'peo-hugging'])

  const migratedFaceCanonical = migratePersistedState({
    blocks: [{ id: 'face', name: '被写体 1', tags: [{ id: 'exp-v5-biting-lip', prompt: 'biting lip', label: '唇を噛む', category: 'expression', weight: 1.2 }] }],
    favoriteIds: ['exp-v5-biting-lip', 'v19-exp-cheek-puff'],
    userTags: [],
  })
  assert.equal(migratedFaceCanonical.blocks[0].tags[0].id, 'exp-lip-bite')
  assert.equal(migratedFaceCanonical.blocks[0].tags[0].weight, 1.2)
  assert.deepEqual(migratedFaceCanonical.favoriteIds, ['exp-lip-bite', 'v19-exp-puffed-cheeks'])

  const migratedRinEye = migratePersistedState({
    blocks: [{ id: 'eye', name: '被写体 1', tags: [{ id: 'rin-eye-empty-eyes', prompt: 'empty eyes', label: '虚ろな目', category: 'eyes', weight: 1.1 }] }],
    favoriteIds: ['rin-eye-empty-eyes', 'rin-eye-slit-pupils'], userTags: [],
  })
  assert.equal(migratedRinEye.blocks[0].tags[0].id, 'eye-empty-eyes')
  assert.equal(migratedRinEye.blocks[0].tags[0].weight, 1.1)
  assert.deepEqual(migratedRinEye.favoriteIds, ['eye-empty-eyes', 'eye-slit-pupils'])

  assert.equal(isSceneCategory('quality'), true)
  assert.equal(isSceneCategory('camera'), true)
  assert.equal(isSceneCategory('hair'), false)
  const sceneQuality = { id: 'qua-masterpiece', prompt: 'masterpiece', label: 'masterpiece', category: 'quality', subcategory: '品質', weight: 1 }
  const sceneCamera = { id: 'cam-portrait', prompt: 'portrait', label: 'portrait', category: 'camera', subcategory: '画角・距離', weight: 1 }
  const subjectHair = { id: 'hai-black-hair', prompt: 'black hair', label: '黒髪', category: 'hair', subcategory: '髪色', weight: 1 }
  const migratedLayers = migratePersistedState({
    blocks: [
      { id: 's1', name: 'Subject 1', tags: [sceneQuality, sceneCamera, subjectHair] },
      { id: 's2', name: 'Subject 2', tags: [{ ...sceneQuality, weight: 1.4 }] },
    ], favoriteIds: [], userTags: [],
  })
  assert.deepEqual(migratedLayers.blocks.map(block => block.tags.map(tag => tag.prompt)), [['black hair'], []])
  assert.deepEqual(migratedLayers.sceneTags.map(tag => [tag.prompt, tag.weight]), [['masterpiece', 1.4], ['portrait', 1]], 'duplicate Scene tags must use maximum weight and first-seen order')
  const layeredPrompt = buildPrompt(migratedLayers.blocks, migratedLayers.sceneTags)
  assert.equal(layeredPrompt.match(/masterpiece/g)?.length, 1, 'Scene tags must be emitted exactly once')
  assert(layeredPrompt.includes('[black hair]'), 'Subject tag strings must be preserved')

  assert.equal(migratedLayers.blocks[0].position, 'left', 'the first migrated multi-Subject must be positioned left')
  assert.equal(migratedLayers.blocks[1].position, 'right', 'the second migrated multi-Subject must be positioned right')
  const twoCharacterExpansion = buildPromptWithStrategy([
    { id: 'left', name: 'Left character', position: 'left', tags: [subjectHair] },
    { id: 'right', name: 'Right character', position: 'right', tags: [{ ...subjectHair, id: 'hai-white-hair', prompt: 'white hair', label: 'white hair' }] },
  ], [sceneQuality], 'illustrious')
  assert.equal(twoCharacterExpansion.scene.subject_count, 2)
  assert(twoCharacterExpansion.prompt.includes('Left side:\n[black hair]'), 'Illustrious output must label the left entity')
  assert(twoCharacterExpansion.prompt.includes('Right side:\n[white hair]'), 'Illustrious output must label the right entity')
  assert.equal(twoCharacterExpansion.prompt.match(/masterpiece/g)?.length, 1, 'shared Scene tags must be emitted once in expanded output')
  const customBreakExpansion = buildPromptWithStrategy([
    { id: 'left', name: 'Left', position: 'left', tags: [subjectHair] },
    { id: 'right', name: 'Right', position: 'right', tags: [{ ...subjectHair, id: 'hai-white-hair', prompt: 'white hair' }] },
  ], [], 'illustrious', 'ENTITY_BREAK')
  assert(customBreakExpansion.prompt.includes('ENTITY_BREAK'), 'entity BREAK placement must be configurable')

  usePromptStore.setState({ blocks: [{ id: 'subject-test', name: 'Subject 1', tags: [subjectHair] }], activeBlockId: 'subject-test', activeLayer: 'scene', sceneTags: [sceneQuality] })
  usePromptStore.getState().addBlock()
  assert.equal(usePromptStore.getState().blocks[1].tags.length, 0, 'new Subjects must start without Scene tags')
  assert.equal(usePromptStore.getState().blocks[0].position, 'left')
  assert.equal(usePromptStore.getState().blocks[1].position, 'right')
  usePromptStore.getState().setSubjectPosition(usePromptStore.getState().blocks[1].id, 'center')
  assert.equal(usePromptStore.getState().blocks[1].position, 'center', 'Subject position must be editable')
  assert.equal(usePromptStore.getState().sceneTags.length, 1, 'adding a Subject must preserve Scene')
  const secondId = usePromptStore.getState().blocks[1].id
  usePromptStore.getState().removeBlock(secondId)
  assert.equal(usePromptStore.getState().sceneTags.length, 1, 'removing a Subject must preserve Scene')

  usePromptStore.setState({ blocks: [
    { id: 'numbered-1', name: '被写体 1', subjectNumber: 1, tags: [] },
    { id: 'numbered-2', name: '被写体 2', subjectNumber: 2, tags: [] },
    { id: 'numbered-3', name: '被写体 3', subjectNumber: 3, tags: [] },
  ], activeBlockId: 'numbered-2' })
  usePromptStore.getState().removeBlock('numbered-2')
  assert.deepEqual(usePromptStore.getState().blocks.map(block => block.subjectNumber), [1, 3], 'removing a Subject must not renumber remaining Subjects')
  usePromptStore.getState().addBlock()
  assert.equal(usePromptStore.getState().blocks.at(-1).subjectNumber, 4, 'new Subjects must use the next unused fixed number')

  usePromptStore.setState({ blocks: [{ id: 'layer-target', name: '被写体 1', subjectNumber: 1, tags: [subjectHair] }], activeBlockId: 'layer-target', activeLayer: 'subject', sceneTags: [] })
  usePromptStore.getState().addTag(sceneQuality)
  assert.equal(usePromptStore.getState().sceneTags.some(tag => tag.id === sceneQuality.id), true, 'Common tags added during Character editing must target Scene')
  assert.deepEqual(usePromptStore.getState().blocks[0].tags.map(tag => tag.id), [subjectHair.id], 'Common tags must not leak into Character tags')
  usePromptStore.getState().removeTagFromLayer('scene', sceneQuality.id)
  assert.equal(usePromptStore.getState().sceneTags.length, 0, 'selected Common tags must be removable from Scene while editing a Character')

  const migratedWithoutLibrary = migratePersistedState({
    blocks: [{ id: 'legacy-library', name: '被写体 1', tags: [subjectHair] }],
    sceneTags: [sceneQuality],
    userTags: [],
  })
  assert.deepEqual(migratedWithoutLibrary.savedPrompts, [], 'existing persisted state must default savedPrompts to an empty array')
  assert.deepEqual(migratedWithoutLibrary.seeds, [], 'existing persisted state must default current seeds to an empty array')
  const migratedLegacySavedPrompt = migratePersistedState({
    blocks: [{ id: 'legacy-library', name: '被写体 1', tags: [] }],
    sceneTags: [],
    userTags: [],
    modelPreset: 'sdxl',
    savedPrompts: [{ id: 'legacy-saved', type: 'favorite', name: 'Legacy Saved', positivePrompt: '', negativePrompt: '', blocks: [{ id: 'legacy-library', name: '被写体 1', tags: [] }], sceneTags: [], seeds: [], createdAt: 1, updatedAt: 1 }],
  })
  assert.equal(migratedLegacySavedPrompt.savedPrompts[0].modelPreset, 'sdxl', 'legacy saved Prompts must inherit the persisted Model Preset')

  usePromptStore.setState({
    blocks: [{ id: 'library-subject', name: 'Library Subject', subjectNumber: 1, position: 'center', tags: [subjectHair] }],
    sceneTags: [sceneQuality],
    activeBlockId: 'library-subject',
    activeLayer: 'subject',
    negative: 'library negative',
    modelPreset: 'pony',
    seeds: [],
    savedPrompts: [],
  })
  const savedLibraryPrompt = usePromptStore.getState().savePrompt({
    name: 'Library Favorite',
    positivePrompt: 'saved positive snapshot',
    negativePrompt: 'library negative',
    seeds: [{ value: 123456789 }, { value: 987654321 }, { value: 24680 }],
  })
  assert(savedLibraryPrompt, 'valid Prompt state must be saved')
  assert.equal(usePromptStore.getState().savedPrompts.length, 1)
  assert.equal(usePromptStore.getState().savedPrompts[0].modelPreset, 'pony')
  assert.deepEqual(usePromptStore.getState().savedPrompts[0].seeds.map(seed => seed.value), [123456789, 987654321, 24680])
  assert.equal(usePromptStore.getState().savePrompt({ name: 'Duplicate seeds', positivePrompt: '', negativePrompt: '', seeds: [{ value: 7 }, { value: 7 }] }), null, 'duplicate Seeds must be rejected')
  const seedlessPrompt = usePromptStore.getState().savePrompt({ name: 'Seedless Prompt', positivePrompt: '', negativePrompt: '', seeds: [] })
  assert(seedlessPrompt, 'a Prompt without Seeds must be saved')

  usePromptStore.setState({
    blocks: [{ id: 'changed-subject', name: 'Changed', tags: [] }],
    sceneTags: [],
    activeBlockId: 'changed-subject',
    negative: 'changed negative',
    seeds: [{ value: 1 }],
    modelPreset: 'sdxl',
  })
  assert.equal(usePromptStore.getState().savedPrompts[0].blocks[0].tags[0].prompt, 'black hair', 'saved blocks must remain immutable after current edits')
  assert.equal(usePromptStore.getState().savedPrompts[0].sceneTags[0].prompt, 'masterpiece', 'saved Scene tags must remain immutable after current edits')
  assert.equal(usePromptStore.getState().restorePrompt(savedLibraryPrompt.id), true, 'saved Prompt state must restore')
  assert.equal(usePromptStore.getState().blocks[0].id, 'library-subject')
  assert.equal(usePromptStore.getState().blocks[0].tags[0].prompt, 'black hair')
  assert.equal(usePromptStore.getState().sceneTags[0].prompt, 'masterpiece')
  assert.equal(usePromptStore.getState().negative, 'library negative')
  assert.equal(usePromptStore.getState().modelPreset, 'pony')
  assert.deepEqual(usePromptStore.getState().seeds.map(seed => seed.value), [123456789, 987654321, 24680])
  usePromptStore.getState().deleteSavedPrompt(savedLibraryPrompt.id)
  assert.equal(usePromptStore.getState().savedPrompts.length, 1, 'deleting a saved Prompt must remove only that snapshot')

  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert(appSource.includes("useState(true)"), 'Prompt panels must have collapsed initial state')
  assert(appSource.includes('Prompt Actions'), 'copy actions must be rendered above Prompt output')
  assert(appSource.includes('Expansion Preview'), 'expanded entities must be inspectable without changing the Prompt')
  assert(appSource.includes("store.setActiveLayer('scene')"), 'Scene category jump must activate the Scene layer')
  assert(appSource.includes('className="app-brand"'), 'Navigation toggle must live in the App Header brand area')
  assert(appSource.includes('<Menu size={19}/>'), 'Navigation toggle must use one hamburger icon in both states')
  assert.equal(appSource.includes('navigation-panel-role'), false, 'Navigation must not reserve a dedicated heading row')
  assert.equal(appSource.includes('<div className="panel-role">TAG SELECTOR</div>'), false, 'TAG SELECTOR must not retain a display-only panel title')
  assert.equal(appSource.includes('<div className="panel-role">PROMPT PREVIEW</div>'), false, 'PROMPT PREVIEW must not retain a display-only panel title')
  assert(appSource.indexOf('className="subcategory-tabs"') < appSource.indexOf('className="color-modifier-bar"'), 'subcategory tabs must render before Color Modifier controls')
  assert.equal(appSource.includes('className="navigation-header"'), false, 'Navigation must not retain a duplicate internal Collapse header')
  assert(appSource.includes('className="navigation-icon-slot"'), 'Navigation children must use a shared icon slot')
  assert(appSource.includes('className={`navigation-item'), 'Prompt categories must use the shared Navigation item structure')
  assert(appSource.includes("setActiveNavigationFlyout"), 'Flyout visibility must use explicit React state')
  assert(appSource.includes('}, 500)'), 'Navigation Flyout must use the requested hover delay')
  assert(appSource.includes('function navigateToPrompt()'), 'Prompt navigation must have an explicit Workspace reset action')
  for (const label of ['プロンプト', 'お気に入り', 'ライブラリ', '設定']) assert(appSource.includes(`>${label}</span>`), `${label} must be rendered as a Japanese Navigation label`)

  const characterDictionary = JSON.parse(fs.readFileSync(new URL('../data/character.json', import.meta.url), 'utf8'))
  assert.equal(characterDictionary.length, 103, 'character dictionary count must remain unchanged')
  assert.equal(new Set(characterDictionary.map(tag => tag.id)).size, 103, 'character ids must remain unique')
  const movedCharacterClothing = characterDictionary.filter(tag => ['alternate costume', 'cosplay', 'uniformed character'].includes(tag.prompt))
  assert.equal(movedCharacterClothing.every(tag => tag.category === 'clothes' && tag.outputCategory === 'character'), true, 'clothing state tags must display under Clothes but output under Character')

  const characterOrderPrompts = ['fire attribute', 'teacher', 'halo', 'elf', 'alternate costume', 'original character']
  const characterOrderTags = characterOrderPrompts.map(prompt => ({ ...tags.find(tag => tag.prompt === prompt), weight: 1 }))
  assert.deepEqual([...characterOrderTags].sort(tagSort).map(tag => tag.prompt), ['original character', 'alternate costume', 'elf', 'halo', 'teacher', 'fire attribute'], 'legacy Character Prompt order must remain compatible')
  const characterPrompt = buildPrompt([{ id: 'character-order', name: '被写体 1', tags: characterOrderTags }])
  assert(characterPrompt.includes('[original character, alternate costume, elf, halo, teacher, fire attribute]'), 'Clothes-displayed character tags must remain in the Character Prompt group')

  assert.equal(conflict('cyborg', ['human']), null, 'core species and machine species may coexist')
  assert.equal(conflict('catgirl', ['human']), null, 'core species and species archetype may coexist')
  assert.equal(conflict('vampire', ['human']), null, 'core species and species state may coexist')
  assert.equal(conflict('elf', ['human'])?.level, 'hard', 'two core species must conflict')
  assert.equal(conflict('wolf girl', ['catgirl'])?.level, 'hard', 'two species archetypes must conflict')
  assert.equal(conflict('robot girl', ['android'])?.level, 'hard', 'two machine species must conflict')

  const findCharacterTag = prompt => characterDictionary.find(tag => tag.prompt === prompt)
  const characterConflict = (candidate, selected) => getConflictReason(
    findCharacterTag(candidate),
    selected.map(prompt => ({ ...findCharacterTag(prompt), weight: 1 })),
    characterDictionary,
  )
  for (const [first, second] of [['cat ears', 'horns'], ['horns', 'angel wings'], ['angel wings', 'cat tail'], ['cat ears', 'cat tail']]) {
    assert.equal(characterConflict(second, [first]), null, `${first} + ${second} must be compatible`)
  }
  assert.equal(characterConflict('fox ears', ['cat ears'])?.level, 'hard', 'two ear types must conflict')
  assert.equal(characterConflict('demon wings', ['angel wings'])?.level, 'hard', 'two wing types must conflict')
  assert.equal(conflict('mage', ['teacher']), null, 'multiple occupations and roles must be allowed')
  assert.equal(conflict('water attribute', ['fire attribute']), null, 'multiple elemental attributes must be allowed')

  const migratedCharacter = migratePersistedState({
    blocks: [{ id: 'character', name: '被写体 1', tags: [
      { id: 'cha-maid', prompt: 'maid', label: 'メイド', category: 'character', subcategory: '指定', weight: 1.2 },
      { id: 'cha-alternate-costume', prompt: 'alternate costume', label: '別衣装', category: 'character', subcategory: '指定', weight: 1 },
    ] }],
    userTags: [],
  })
  assert.equal(migratedCharacter.blocks[0].tags[0].subcategory, '職業・役割')
  assert.equal(migratedCharacter.blocks[0].tags[0].weight, 1.2)
  assert.equal(migratedCharacter.blocks[0].tags[1].category, 'clothes')
  assert.equal(migratedCharacter.blocks[0].tags[1].outputCategory, 'character')
  assert.equal(migratedCharacter.blocks[0].tags[1].sortSubcategory, '指定')

  assert.equal(applyColorModifier('cosmic eyes', 'black'), 'black cosmic eyes')
  assert.equal(applyColorModifier('red eyes', 'black'), 'black eyes')
  assert.equal(applyColorModifier('white dress', 'blue'), 'blue dress')
  assert.equal(applyColorModifier('navy blue hair', 'red'), 'red hair')
  assert.equal(applyColorModifier('chair', 'black'), 'black chair')
  assert.equal(applyColorModifier('grey eyes', 'red'), 'red eyes')
  assert.equal(applyColorModifier('aqua eyes', 'black'), 'black eyes')
  assert.equal(applyColorModifier('amber eyes', 'blue'), 'blue eyes')
  assert.equal(isColorModifiableCategory('expression'), false)
  assert.equal(isColorModifiableCategory('pose'), false)
  assert.equal(isColorModifiableCategory('eyes'), true)
  assert.equal(isColorModifiableCategory('scene_props'), true)
  assert.equal(findColorModifier('white').swatch, '#ffffff')

  const redEyes = tags.find(tag => tag.prompt === 'red eyes')
  const blackEyes = tags.find(tag => tag.prompt === 'black eyes')
  const cosmicEyes = tags.find(tag => tag.prompt === 'cosmic eyes')
  const matchedBlackEyes = buildColorModifiedTag(redEyes, 'black', tags)
  assert.equal(matchedBlackEyes.id, blackEyes.id, 'dictionary Prompt match must reuse the canonical dictionary id')
  assert.equal(matchedBlackEyes.prompt, 'black eyes')
  assert.equal(matchedBlackEyes.label, '黒い目', 'dictionary Prompt match must use the matched dictionary label')
  const derivedBlueCosmicEyes = buildColorModifiedTag(cosmicEyes, 'blue', tags)
  assert.equal(derivedBlueCosmicEyes.prompt, 'blue cosmic eyes')
  assert.equal(derivedBlueCosmicEyes.label, cosmicEyes.label, 'derived tags without a dictionary match must keep the source label')

  const coloredTag = { id: 'derived-color-cosmic-blue', prompt: 'blue cosmic eyes', label: '宇宙眼', category: 'eyes', subcategory: '虹彩・内部模様', baseTagId: 'eyes-cosmic', modifiers: { color: 'blue' }, weight: 1.3 }
  assert(buildPrompt([{ id: 'colored-subject', name: '被写体 1', tags: [coloredTag] }]).includes('(blue cosmic eyes:1.3)'), 'existing Prompt rendering must output the completed colored prompt')
  usePromptStore.setState({
    blocks: [
      { id: 'color-subject-1', name: '被写体 1', tags: [{ id: 'eyes-cosmic', prompt: 'cosmic eyes', label: '宇宙眼', category: 'eyes', weight: 1.3 }] },
      { id: 'color-subject-2', name: '被写体 2', tags: [] },
    ],
    sceneTags: [{ id: 'chair', prompt: 'chair', label: '椅子', category: 'scene_props', weight: 1 }],
    activeBlockId: 'color-subject-2',
  })
  usePromptStore.getState().replaceTagInLayer('color-subject-1', ['eyes-cosmic'], coloredTag)
  assert.equal(usePromptStore.getState().blocks[0].tags[0].prompt, 'blue cosmic eyes', 'explicit layer replacement must update the requested Character')
  assert.equal(usePromptStore.getState().blocks[0].tags[0].weight, 1.3, 'color replacement must preserve weight')
  assert.equal(usePromptStore.getState().blocks[1].tags.length, 0, 'color replacement must not update the active but untargeted Character')
  usePromptStore.getState().replaceTagInLayer('scene', ['chair'], { ...coloredTag, id: 'derived-color-chair-black', prompt: 'black chair', category: 'scene_props', baseTagId: 'chair', modifiers: { color: 'black' }, weight: 1 })
  assert.equal(usePromptStore.getState().sceneTags[0].prompt, 'black chair', 'scene color replacement must stay in sceneTags')

  const migratedColor = migratePersistedState({ blocks: [{ id: 'saved-color', name: '被写体 1', tags: [coloredTag] }], sceneTags: [], userTags: [] })
  assert.equal(migratedColor.blocks[0].tags[0].baseTagId, 'eyes-cosmic', 'migration must preserve optional baseTagId')
  assert.equal(migratedColor.blocks[0].tags[0].modifiers.color, 'blue', 'migration must preserve optional modifier metadata')

  console.log('OK: adult reclassification, prompt regression, and persisted-state migration')
} finally {
  await server.close()
}
