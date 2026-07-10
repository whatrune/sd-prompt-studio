import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

try {
  const [{ adultTags }, { buildPrompt, tagSort }, { migratePersistedState }, { categoryOrder, subcategoryOrder, tags, allTags }, { getConflictReason, getSlotDefinitions }, { canonicalVisibleTags, mergeCanonicalTag, resolveCanonicalTag }] = await Promise.all([
    server.ssrLoadModule('/src/data/adultTags.ts'),
    server.ssrLoadModule('/src/prompt.ts'),
    server.ssrLoadModule('/src/store.ts'),
    server.ssrLoadModule('/src/data/tags.ts'),
    server.ssrLoadModule('/src/engine/smartTagEngine.ts'),
    server.ssrLoadModule('/src/data/canonical.ts'),
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
  assert.equal(conflict('waving', ['walking']), null, 'compatible body motions must not share an exclusive slot')
  assert.equal(conflict('running', ['walking'])?.level, 'hard', 'walking and running must conflict')
  assert.equal(conflict('lying', ['standing'])?.level, 'hard', 'standing and lying must conflict')
  assert.equal(conflict('jumping', ['sitting'])?.level, 'hard', 'jumping and sitting must conflict')

  const poseDictionary = JSON.parse(fs.readFileSync(new URL('../data/pose.json', import.meta.url), 'utf8'))
  assert.equal(poseDictionary.length, 311, 'Motion physical dictionary must include the RIN dance batch')
  assert.equal(new Set(poseDictionary.map(tag => tag.id)).size, 311, 'Motion ids must remain unique')
  assert.equal(poseDictionary.filter(tag => !tag.deprecated).length, 294, 'canonical Motion display count must exclude redirects')
  assert.equal(allTags.filter(tag => tag.category === 'pose').length, 311, 'physical Motion rows must remain available')
  assert.equal(tags.filter(tag => tag.category === 'pose').length, 294, 'deprecated Motion rows must not be exposed to the UI')
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
  assert.deepEqual(tags.find(tag => tag.prompt === 'arabesque')?.slot, ['dance_style', 'balance_pose', 'leg_pose'])
  assert.deepEqual(tags.find(tag => tag.prompt === 'fan dance')?.slot, ['dance_style', 'hand_action'])
  assert.equal(conflict('ballet', ['dancing'])?.level, 'hard', 'generic and specific dance styles must remain distinct and conflict')
  assert.equal(conflict('flamenco', ['hip hop dance'])?.level, 'hard', 'different dance styles must conflict')
  assert.equal(conflict('ballet', ['standing']), null, 'dance style and body posture must coexist')
  assert.equal(conflict('arabesque', ['standing']), null, 'dance balance pose and base posture must coexist')
  assert.equal(conflict('fan dance', ['standing']), null, 'dance hand action and base posture must coexist')

  const dancePromptOrder = ['hip hop dance', 'ballet', 'dancing'].map(prompt => ({ ...findTag(prompt), weight: 1 }))
  assert.deepEqual([...dancePromptOrder].sort(tagSort).map(tag => tag.prompt), ['dancing', 'ballet', 'hip hop dance'], 'new specific dances must preserve legacy dance Prompt order')

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

  console.log('OK: adult reclassification, prompt regression, and persisted-state migration')
} finally {
  await server.close()
}
