import type { PromptTag } from './data/tags'
import { heuristicCategory, inferCategory } from './engine/tagIntelligence'

export type PromptAnalyzerEntry = Readonly<{
  source: string
  prompt: string
  label: string
  category: string
  subcategory: string
  weight: number
  matched: boolean
  dictionaryTag?: PromptTag
}>

function hasBalancedParentheses(input: string) {
  let depth = 0
  for (const character of input) {
    if (character === '(') depth += 1
    if (character === ')') {
      if (depth === 0) return false
      depth -= 1
    }
  }
  return depth === 0
}

const isWordCharacter = (character: string | undefined) => Boolean(character && /[a-z0-9_]/i.test(character))

function splitBalancedPrompt(input: string) {
  const segments: string[] = []
  let current = ''
  let depth = 0
  const flush = () => {
    segments.push(current)
    current = ''
  }

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (character === '(') depth += 1
    if (character === ')') depth -= 1

    if (depth === 0 && (character === ',' || character === '\n')) {
      flush()
      continue
    }

    const breakToken = input.slice(index, index + 5)
    if (depth === 0
      && breakToken.toUpperCase() === 'BREAK'
      && !isWordCharacter(input[index - 1])
      && !isWordCharacter(input[index + 5])) {
      flush()
      index += 4
      continue
    }

    current += character
  }
  flush()
  return segments
}

function splitPrompt(input: string) {
  return hasBalancedParentheses(input)
    ? splitBalancedPrompt(input)
    : input.split(/,|\r?\n|BREAK/i)
}

function normalizeSegment(segment: string) {
  return segment.trim().replace(/^\[|\]$/g, '').trim()
}

function parseWeight(segment: string) {
  const weightedShell = segment.match(/^\((.*):([^()]*)\)$/s)
  if (!weightedShell) return { prompt: segment, weight: 1, malformed: false }
  const match = segment.match(/^\((.*):([\d.]+)\)$/s)
  if (!match) return { prompt: segment, weight: 1, malformed: true }
  const prompt = match[1].trim()
  const weight = Number(match[2])
  return prompt && Number.isFinite(weight)
    ? { prompt, weight, malformed: false }
    : { prompt: segment, weight: 1, malformed: true }
}

export function parsePromptAnalyzerInput(input: string, dictionary: PromptTag[]): readonly PromptAnalyzerEntry[] {
  const entries = splitPrompt(input).flatMap((segment) => {
    const source = normalizeSegment(segment)
    if (!source || source.toUpperCase() === 'BREAK') return []

    const parsed = parseWeight(source)
    const dictionaryTag = parsed.malformed ? undefined : inferCategory(parsed.prompt, dictionary)
    const prompt = dictionaryTag?.prompt ?? parsed.prompt
    return [Object.freeze({
      source,
      prompt,
      label: dictionaryTag?.label ?? prompt,
      category: dictionaryTag?.category ?? heuristicCategory(prompt),
      subcategory: dictionaryTag?.subcategory ?? '解析・自由タグ',
      weight: parsed.weight,
      matched: Boolean(dictionaryTag),
      ...(dictionaryTag ? { dictionaryTag } : {}),
    })]
  })
  return Object.freeze(entries)
}
