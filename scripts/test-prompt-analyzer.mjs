import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })

try {
  const { parsePromptAnalyzerInput } = await server.ssrLoadModule('/src/promptAnalyzer.ts')
  const dictionary = [
    { id: 'quality-masterpiece', prompt: 'masterpiece', label: 'マスターピース', category: 'quality', subcategory: '品質' },
    { id: 'hair-blue', prompt: 'blue hair', label: '青髪', aliases: ['azure hair'], category: 'hair', subcategory: '髪色' },
    { id: 'eyes-green', prompt: 'green eyes', label: '緑の目', category: 'eyes', subcategory: '目の色' },
    { id: 'pose-standing', prompt: 'standing', label: '立つ', category: 'pose', subcategory: '基本姿勢' },
  ]

  const basic = parsePromptAnalyzerInput(' masterpiece, blue hair ', dictionary)
  assert.deepEqual(basic.map(entry => entry.prompt), ['masterpiece', 'blue hair'], 'basic comma-separated tags must retain order')
  assert.deepEqual(basic.map(entry => entry.category), ['quality', 'hair'], 'dictionary categories must remain canonical')
  assert.equal(basic.every(entry => entry.weight === 1), true, 'ordinary tags must keep weight 1')

  const weighted = parsePromptAnalyzerInput('(blue hair:1.2), [(standing:.5)]', dictionary)
  assert.deepEqual(weighted.map(entry => [entry.prompt, entry.weight]), [['blue hair', 1.2], ['standing', 0.5]], 'weighted and bracket-wrapped tags must preserve numeric weights')
  assert.equal(weighted[0].dictionaryTag?.id, 'hair-blue', 'weighted dictionary tags must retain canonical metadata')

  const bracketList = parsePromptAnalyzerInput('[blue hair, green eyes]', dictionary)
  assert.deepEqual(bracketList.map(entry => entry.prompt), ['blue hair', 'green eyes'], 'square brackets must remain list containers')

  const grouped = parsePromptAnalyzerInput('((red hair, blue eyes):1.2), standing', dictionary)
  assert.equal(grouped.length, 2, 'balanced grouped commas must not split the grouped tag')
  assert.deepEqual([grouped[0].prompt, grouped[0].weight], ['(red hair, blue eyes)', 1.2], 'nested weighted grouping must remain intact')
  assert.equal(grouped[1].prompt, 'standing', 'top-level delimiters after a group must still split')

  const groupedNewline = parsePromptAnalyzerInput('((red hair,\nblue eyes):1.1)\nmasterpiece', dictionary)
  assert.equal(groupedNewline.length, 2, 'newlines inside balanced parentheses must not split the group')
  assert.equal(groupedNewline[0].prompt, '(red hair,\nblue eyes)', 'group-internal whitespace must remain lossless')

  const breaks = parsePromptAnalyzerInput('blue hair\nBREAK\ngreen eyes,break,standing', dictionary)
  assert.deepEqual(breaks.map(entry => entry.prompt), ['blue hair', 'green eyes', 'standing'], 'top-level BREAK must remain a case-insensitive structural delimiter')
  assert.equal(parsePromptAnalyzerInput('(heart BREAK motif), heartbreak', dictionary).length, 2, 'BREAK inside parentheses and BREAK text inside words must remain literal')
  assert.equal(parsePromptAnalyzerInput('(heart BREAK motif), heartbreak', dictionary)[0].prompt, '(heart BREAK motif)', 'group-internal BREAK must not split')
  assert.equal(parsePromptAnalyzerInput('(heart BREAK motif), heartbreak', dictionary)[1].prompt, 'heartbreak', 'BREAK substrings in ordinary words must not split')

  assert.deepEqual(parsePromptAnalyzerInput(' ,\r\n, BREAK ,, ', dictionary), [], 'empty and repeated delimiters must produce no entries')
  assert.deepEqual(parsePromptAnalyzerInput('azure hair', dictionary).map(entry => [entry.prompt, entry.label, entry.matched]), [['blue hair', '青髪', true]], 'aliases must resolve once to the canonical preview/apply value')

  const malformedGroup = parsePromptAnalyzerInput('(red hair, blue eyes', dictionary)
  assert.deepEqual(malformedGroup.map(entry => entry.prompt), ['(red hair', 'blue eyes'], 'unbalanced grouping must retain legacy fail-soft splitting')
  const malformedWeight = parsePromptAnalyzerInput('(blue hair:1..2)', dictionary)
  assert.deepEqual([malformedWeight[0].prompt, malformedWeight[0].weight], ['(blue hair:1..2)', 1], 'malformed weights must degrade to a literal weight-1 tag')
  assert.deepEqual(parsePromptAnalyzerInput('(:1.2)', dictionary).map(entry => [entry.prompt, entry.weight]), [['(:1.2)', 1]], 'empty weighted bodies must degrade to a literal tag')

  const mixedInput = '[masterpiece, ((red hair, blue eyes):1.3)]\nBREAK\n[standing]'
  const mixedFirst = parsePromptAnalyzerInput(mixedInput, dictionary)
  const mixedSecond = parsePromptAnalyzerInput(mixedInput, dictionary)
  assert.deepEqual(mixedSecond, mixedFirst, 'identical input and dictionary must produce identical structures')
  assert.equal(Object.isFrozen(mixedFirst), true, 'the canonical parsed result collection must be immutable')
  assert.equal(mixedFirst.every(Object.isFrozen), true, 'every canonical parsed entry must be immutable')

  const appSource = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.equal((appSource.match(/parsePromptAnalyzerInput\(/g) ?? []).length, 1, 'App must create exactly one shared analyzer result')
  assert(appSource.includes('analyzerEntries.map((entry,i)=>'), 'Preview must consume the shared analyzer result')
  assert(appSource.includes('analyzerEntries.forEach(entry=>store.addTag('), 'Apply must consume the same shared analyzer result through existing store.addTag')
  assert.equal(appSource.includes("analyzerText.split(/,|\\n|BREAK/i)"), false, 'App must not retain either inline parser')
  assert.equal(appSource.includes('.slice(0,80)'), false, 'Preview must not hide parsed entries that apply will import')

  console.log('Prompt Analyzer deterministic parser tests passed: 28 assertions')
} finally {
  await server.close()
}
