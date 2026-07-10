import fs from 'node:fs'

const dir = new URL('../data/', import.meta.url)
const files = fs.readdirSync(dir).filter(name => name.endsWith('.json') && name !== 'slots.json')
const ids = new Set()
const rowsById = new Map()
const posePrompts = new Set()
const deferredSlotChecks = []
const slotIdsDeferred = new Set()
const allowedCategories = new Set(['quality', 'people', 'character', 'expression', 'eyes', 'hair', 'body', 'clothes', 'accessories', 'pose', 'camera', 'background', 'scene_props', 'lighting', 'effects'])
let count = 0

for (const file of files) {
  const rows = JSON.parse(fs.readFileSync(new URL(file, dir), 'utf8'))
  if (!Array.isArray(rows)) throw new Error(`${file}: dictionary root must be an array`)
  for (const row of rows) {
    if (!row.id || !row.prompt || !row.category) throw new Error(`${file}: invalid row`)
    if (!allowedCategories.has(row.category)) throw new Error(`${file}: unknown major category ${row.category} on ${row.id}`)
    if (ids.has(row.id)) throw new Error(`duplicate id: ${row.id}`)
    if (row.category === 'pose' && row.prompt.includes(',')) throw new Error(`${file}: pose prompt must be a single representative tag: ${row.id}`)
    if (row.category === 'pose') {
      const promptKey = row.prompt.trim().toLowerCase()
      if (!row.deprecated && posePrompts.has(promptKey)) throw new Error(`${file}: duplicate canonical pose prompt ${row.prompt}`)
      if (!row.deprecated) posePrompts.add(promptKey)
    }
    if (row.deprecated && !row.redirectTo) throw new Error(`${file}: deprecated tag requires redirectTo on ${row.id}`)
    if (row.redirectTo && !row.deprecated) throw new Error(`${file}: redirectTo requires deprecated on ${row.id}`)
    if (row.sources && (!Array.isArray(row.sources) || row.sources.some(source => !['existing', 'RIN'].includes(source)))) throw new Error(`${file}: invalid sources on ${row.id}`)
    const slots = row.slot ? (Array.isArray(row.slot) ? row.slot : [row.slot]) : []
    for (const slot of slots) {
      if (!slotIdsDeferred.has(slot)) deferredSlotChecks.push({ file, id: row.id, slot })
    }
    if (row.layer && !['inner', 'main', 'outer', 'accessory'].includes(row.layer)) throw new Error(`${file}: invalid layer on ${row.id}`)
    if (row.coverage && (!Array.isArray(row.coverage) || row.coverage.some(value => !['upper', 'lower', 'full'].includes(value)))) throw new Error(`${file}: invalid coverage on ${row.id}`)
    if ((row.layer && !row.coverage) || (!row.layer && row.coverage)) throw new Error(`${file}: layer and coverage must be used together on ${row.id}`)
    if (file === 'clothes.json' && /shirt/.test(row.prompt) && !/shirt dress/.test(row.prompt) && row.coverage?.join(',') !== 'upper') throw new Error(`${file}: shirt must cover upper on ${row.id}`)
    if (file === 'clothes.json' && /\b(dress|gown)\b/.test(row.prompt) && !/dress shirt/.test(row.prompt) && row.coverage?.join(',') !== 'upper,lower') throw new Error(`${file}: dress must cover upper and lower on ${row.id}`)
    if (file === 'clothes.json' && /\b(pants|skirt)\b/.test(row.prompt) && !/dress|suit|outfit/.test(row.prompt) && row.coverage?.join(',') !== 'lower') throw new Error(`${file}: pants and skirts must cover lower on ${row.id}`)
    ids.add(row.id)
    rowsById.set(row.id, row)
    count += 1
  }
}

for (const row of rowsById.values()) {
  if (!row.redirectTo) continue
  if (!rowsById.has(row.redirectTo)) throw new Error(`missing canonical target ${row.redirectTo} on ${row.id}`)
  const visited = new Set([row.id])
  let target = rowsById.get(row.redirectTo)
  while (target?.redirectTo) {
    if (visited.has(target.id)) throw new Error(`canonical redirect cycle on ${row.id}`)
    visited.add(target.id)
    target = rowsById.get(target.redirectTo)
  }
}

const slotConfig = JSON.parse(fs.readFileSync(new URL('slots.json', dir), 'utf8'))
if (!Array.isArray(slotConfig.slots) || !Array.isArray(slotConfig.rules)) throw new Error('slots.json: invalid root')
const slotIds = new Set()
for (const slot of slotConfig.slots) {
  if (!slot.id || !slot.label || !slot.mode) throw new Error('slots.json: invalid slot')
  if (slotIds.has(slot.id)) throw new Error(`slots.json: duplicate slot id ${slot.id}`)
  slotIds.add(slot.id)
  slotIdsDeferred.add(slot.id)
}
for (const check of deferredSlotChecks) {
  if (!slotIds.has(check.slot)) throw new Error(`${check.file}: unknown tag slot ${check.slot} on ${check.id}`)
}
for (const rule of slotConfig.rules) {
  if (!rule.slot || !slotIds.has(rule.slot)) throw new Error(`slots.json: unknown slot ${rule.slot}`)
  if (rule.category && !allowedCategories.has(rule.category)) throw new Error(`slots.json: unknown major category ${rule.category}`)
}

console.log(`OK: ${count} tags / ${files.length} dictionary files / ${slotConfig.slots.length} slots`)
