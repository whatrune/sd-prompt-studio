import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

try {
  const [{ adultTags }, { buildPrompt, tagSort }, { migratePersistedState }, { categoryOrder, subcategoryOrder, tags }, { getConflictReason, getSlotDefinitions }] = await Promise.all([
    server.ssrLoadModule('/src/data/adultTags.ts'),
    server.ssrLoadModule('/src/prompt.ts'),
    server.ssrLoadModule('/src/store.ts'),
    server.ssrLoadModule('/src/data/tags.ts'),
    server.ssrLoadModule('/src/engine/smartTagEngine.ts'),
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
