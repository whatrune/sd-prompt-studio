import type { PromptTag } from '../data/tags'
import type { SelectedTag } from '../store'
import slotConfigJson from '../../data/slots.json'

export type ConflictLevel = 'hard' | 'warning'
export type ConflictReason = {
  level: ConflictLevel
  reason: string
  conflicting: SelectedTag[]
}

type SlotDefinition = { id: string; label: string; mode: 'single' | 'multiple' | 'limited'; limit?: number }
type SlotRule = {
  slot: string
  category?: string
  subcategory?: string
  excludeSubcategories?: string[]
  excludePatterns?: string[]
  prompts?: string[]
  patterns?: string[]
}
type SlotConfig = { version: number; slots: SlotDefinition[]; rules: SlotRule[] }
type ClothingProfile = { layer: 'inner' | 'main' | 'outer' | 'accessory'; coverage: Set<'upper' | 'lower' | 'full'>; kind: string; metadataComplete: boolean }
type RuleProfile = { slots: Map<string, string>; exclusiveGroups: Set<string>; clothing?: ClothingProfile }

const slotConfig = slotConfigJson as SlotConfig
const slotDefinitions = new Map(slotConfig.slots.map(slot => [slot.id, slot]))
const compiledRules = slotConfig.rules.map(rule => ({
  ...rule,
  normalizedPrompts: new Set((rule.prompts ?? []).map(value => value.trim().toLowerCase())),
  regexes: (rule.patterns ?? []).map(pattern => new RegExp(pattern, 'i')),
  excludeRegexes: (rule.excludePatterns ?? []).map(pattern => new RegExp(pattern, 'i')),
}))

const normalize = (value: string) => value.trim().toLowerCase()
const profileCache = new Map<string, RuleProfile>()

const ONE_PIECE_TERMS = ['dress','one-piece','one piece','gown','robe','kimono','yukata','jumpsuit','romper','bodysuit','leotard','plugsuit','bunny suit','school swimsuit','one-piece swimsuit','coveralls','overalls']
const OUTER_TERMS = ['coat','jacket','parka','cardigan','blazer','cape','poncho','bolero','vest','hoodie','raincoat','overcoat','trench coat']
const INNER_TERMS = ['bra','panties','lingerie','undershirt','camisole','tube top','bikini top','bikini bottom','underwear']
const TOP_TERMS = ['shirt','blouse','sweater','t-shirt','turtleneck','crop top','tank top','jersey','top']
const BOTTOM_TERMS2 = ['skirt','pants','trousers','shorts','jeans','leggings','culottes','buruma','bloomers','bottom']

function clothingProfile(tag: Pick<PromptTag, 'prompt' | 'category' | 'subcategory' | 'layer' | 'coverage'>): ClothingProfile | undefined {
  if (tag.category !== 'clothes') return undefined
  if (tag.layer && tag.coverage?.length) {
    const coverage = new Set(tag.coverage)
    const kind = tag.layer === 'main' && coverage.has('upper') && coverage.has('lower')
      ? 'onepiece'
      : tag.layer === 'main' && coverage.has('upper')
        ? 'top'
        : tag.layer === 'main' && coverage.has('lower')
          ? 'bottom'
          : tag.layer === 'outer'
            ? 'outerwear'
            : 'innerwear'
    return { layer: tag.layer, coverage, kind, metadataComplete: true }
  }
  const prompt = normalize(tag.prompt)
  const sub = tag.subcategory ?? ''
  const includesAny = (terms: string[]) => terms.some(term => prompt === term || prompt.includes(term))
  if (['柄・装飾','素材・質感','袖・襟・開口部','靴下・脚','靴'].includes(sub)) return undefined
  if (includesAny(OUTER_TERMS) || sub === 'アウター') return { layer: 'outer', coverage: new Set(['upper']), kind: 'outerwear', metadataComplete: false }
  if (includesAny(INNER_TERMS) || sub === '水着・下着') {
    const cov = prompt.includes('bottom') || prompt.includes('pant') ? new Set<'lower'>(['lower']) : prompt.includes('bra') || prompt.includes('top') ? new Set<'upper'>(['upper']) : new Set<'upper'|'lower'>(['upper','lower'])
    return { layer: 'inner', coverage: cov as Set<'upper'|'lower'|'full'>, kind: 'innerwear', metadataComplete: false }
  }
  if (includesAny(ONE_PIECE_TERMS) || ['ワンピース・ドレス','民族・歴史衣装','和服・伝統服','コスプレ・特殊衣装','ファンタジー・SF','制服・職業','寝間着・ルームウェア'].includes(sub) && /(dress|uniform|outfit|suit|robe|kimono|yukata|gown|costume|pajamas)/.test(prompt)) {
    return { layer: 'main', coverage: new Set(['upper','lower','full']), kind: 'onepiece', metadataComplete: false }
  }
  if (includesAny(BOTTOM_TERMS2) || sub === 'ボトムス') return { layer: 'main', coverage: new Set(['lower']), kind: 'bottom', metadataComplete: false }
  if (includesAny(TOP_TERMS) || sub === 'トップス') return { layer: 'main', coverage: new Set(['upper']), kind: 'top', metadataComplete: false }
  return undefined
}

function clothingConflict(a?: ClothingProfile, b?: ClothingProfile) {
  if (!a || !b) return false
  const overlap = [...a.coverage].some(part => b.coverage.has(part) || part === 'full' || b.coverage.has('full'))
  if (!overlap) return false
  if (a.layer !== b.layer) return false
  if (a.layer === 'accessory') return false
  return true
}

const FULL_OUTERWEAR = ['coat','trench coat','overcoat','raincoat','duffle coat','fur coat','gown','robe','bathrobe','dressing gown']
const BOTTOMS = ['skirt','pants','trousers','shorts','jeans','leggings','culottes','buruma','bloomers']
const FOOTWEAR = ['boots','shoes','sandals','loafers','sneakers','heels','pumps','slippers','barefoot']
const HAIR_STYLE_EXCLUSIVE = ['twintails','ponytail','side ponytail','single braid','double braid','hair bun','buzz cut','bald']
const HARD_MOTION_PAIRS = new Set([
  'running\u0000walking',
  'jumping\u0000sitting',
  'jumping\u0000lying',
  'jumping\u0000kneeling',
  'running\u0000swimming',
  'swimming\u0000walking',
])
const HARD_MOTION_SLOT_PAIRS: Array<[string, string]> = [
  ['body_posture', 'locomotion'],
  ['body_posture', 'airborne_state'],
  ['body_posture', 'acrobatics'],
  ['locomotion', 'airborne_state'],
  ['airborne_state', 'balance_pose'],
]

function pairKey(a: string, b: string) {
  return [normalize(a), normalize(b)].sort().join('\u0000')
}

function cacheKey(tag: Pick<PromptTag, 'prompt' | 'category' | 'subcategory' | 'slot' | 'layer' | 'coverage'>) {
  const slots = Array.isArray(tag.slot) ? tag.slot.join('|') : tag.slot ?? ''
  return `${tag.category}\u0000${tag.subcategory ?? ''}\u0000${normalize(tag.prompt)}\u0000${slots}\u0000${tag.layer ?? ''}\u0000${(tag.coverage ?? []).join('|')}`
}

function ruleMatches(rule: typeof compiledRules[number], tag: Pick<PromptTag, 'prompt' | 'category' | 'subcategory'>) {
  const prompt = normalize(tag.prompt)
  if (rule.category && rule.category !== tag.category) return false
  if (rule.subcategory && rule.subcategory !== tag.subcategory) return false
  if (rule.excludeSubcategories?.includes(tag.subcategory ?? '')) return false
  if (rule.excludeRegexes.some(regex => regex.test(prompt))) return false
  const hasPromptFilter = rule.normalizedPrompts.size > 0 || rule.regexes.length > 0
  if (!hasPromptFilter) return true
  return rule.normalizedPrompts.has(prompt) || rule.regexes.some(regex => regex.test(prompt))
}

export function buildRuleProfile(tag: Pick<PromptTag, 'prompt' | 'category' | 'subcategory' | 'slot' | 'layer' | 'coverage'>): RuleProfile {
  const key = cacheKey(tag)
  const cached = profileCache.get(key)
  if (cached) return cached

  const prompt = normalize(tag.prompt)
  const slots = new Map<string, string>()
  const exclusiveGroups = new Set<string>()

  const explicitSlots = tag.slot ? (Array.isArray(tag.slot) ? tag.slot : [tag.slot]) : []
  if (explicitSlots.length) {
    for (const slot of explicitSlots) {
      const definition = slotDefinitions.get(slot)
      if (!definition || definition.mode === 'multiple') continue
      slots.set(slot, prompt)
    }
  } else {
    for (const rule of compiledRules) {
      if (!ruleMatches(rule, tag)) continue
      const definition = slotDefinitions.get(rule.slot)
      if (!definition || definition.mode === 'multiple') continue
      slots.set(rule.slot, prompt)
    }
  }

  // Legacy groups remain as narrow exception rules while the JSON slot model grows.
  if (tag.category === 'clothes') {
    if (FULL_OUTERWEAR.some(item => prompt === item || prompt.endsWith(` ${item}`))) exclusiveGroups.add('full_outerwear')
    if (BOTTOMS.some(item => prompt === item || prompt.endsWith(` ${item}`))) exclusiveGroups.add('primary_bottom')
    if (FOOTWEAR.some(item => prompt === item || prompt.endsWith(` ${item}`))) exclusiveGroups.add('primary_footwear')
  }
  if (tag.category === 'hair' && HAIR_STYLE_EXCLUSIVE.some(item => prompt === item || prompt.endsWith(` ${item}`))) {
    exclusiveGroups.add('primary_hair_style')
  }

  const profile = { slots, exclusiveGroups, clothing: clothingProfile(tag) }
  profileCache.set(key, profile)
  return profile
}

type SelectedContext = {
  selectedProfiles: Array<{ tag: SelectedTag; profile: RuleProfile; source: PromptTag | SelectedTag }>
}

function createSelectedContext(selected: SelectedTag[], dictionary: PromptTag[]): SelectedContext {
  const byId = new Map(dictionary.map(item => [item.id, item]))
  return {
    selectedProfiles: selected.map(tag => {
      const source = byId.get(tag.id) ?? tag
      return { tag, source, profile: buildRuleProfile(source) }
    })
  }
}

function evaluate(candidate: PromptTag, context: SelectedContext): ConflictReason | null {
  const profile = buildRuleProfile(candidate)
  const hard: SelectedTag[] = []
  const warning: SelectedTag[] = []
  const hardMessages = new Set<string>()
  const warningMessages = new Set<string>()

  for (const item of context.selectedProfiles) {
    if (normalize(item.tag.prompt) === normalize(candidate.prompt)) continue

    const candidateConflicts = candidate.conflicts ?? []
    const sourceConflicts = 'conflicts' in item.source ? item.source.conflicts ?? [] : []
    if (candidateConflicts.includes(item.tag.prompt) || sourceConflicts.includes(candidate.prompt)) {
      hard.push(item.tag)
      hardMessages.add(`${item.tag.label}と辞書上の競合関係があります`)
      continue
    }

    // Clothing slots identify the garment family, but layer and coverage decide
    // whether two garments can actually be worn together.
    const canUseClothingMetadata = profile.clothing?.metadataComplete && item.profile.clothing?.metadataComplete
    if (!canUseClothingMetadata) {
      for (const [slot, value] of profile.slots) {
        const selectedValue = item.profile.slots.get(slot)
        if (selectedValue && selectedValue !== value) {
          hard.push(item.tag)
          hardMessages.add(`${item.tag.label}と同じ「${slotLabel(slot)}」を別の値で指定しています`)
        }
      }
    }

    for (const group of profile.exclusiveGroups) {
      if (item.profile.exclusiveGroups.has(group)) {
        hard.push(item.tag)
        hardMessages.add(`${item.tag.label}と同じ「${groupLabel(group)}」を占有します`)
        break
      }
    }

    if (clothingConflict(profile.clothing, item.profile.clothing)) {
      hard.push(item.tag)
      hardMessages.add(`${item.tag.label}と衣装の同じ着用範囲を占有します`)
    }

    const genericAndUpperEyelashes = (
      profile.slots.has('eyelash_length') && item.profile.slots.has('upper_eyelashes')
    ) || (
      profile.slots.has('upper_eyelashes') && item.profile.slots.has('eyelash_length')
    )
    if (genericAndUpperEyelashes) {
      hard.push(item.tag)
      hardMessages.add(`${item.tag.label}と上まつ毛の指定が重複します`)
    }

    if (HARD_MOTION_PAIRS.has(pairKey(candidate.prompt, item.tag.prompt))) {
      hard.push(item.tag)
      hardMessages.add(`${item.tag.label}と同時に成立しない動作です`)
    }

    const hasMotionSlotConflict = HARD_MOTION_SLOT_PAIRS.some(([left, right]) => (
      profile.slots.has(left) && item.profile.slots.has(right)
    ) || (
      profile.slots.has(right) && item.profile.slots.has(left)
    ))
    if (hasMotionSlotConflict) {
      hard.push(item.tag)
      hardMessages.add(`${item.tag.label}と同時に成立しない姿勢・動作です`)
    }

    const pair = new Set([normalize(candidate.prompt), normalize(item.tag.prompt)])
    if (pair.has('running') && [...pair].some(x => ['sitting','lying','kneeling'].includes(x))) {
      warning.push(item.tag)
      warningMessages.add(`${item.tag.label}との組み合わせは動作が曖昧です`)
    }
  }

  const uniqueHard = [...new Map(hard.map(item => [item.id, item])).values()]
  if (uniqueHard.length) return { level: 'hard', reason: [...hardMessages].join('。'), conflicting: uniqueHard }
  const uniqueWarning = [...new Map(warning.map(item => [item.id, item])).values()]
  if (uniqueWarning.length) return { level: 'warning', reason: [...warningMessages].join('。'), conflicting: uniqueWarning }
  return null
}

export function getConflictReason(candidate: PromptTag, selected: SelectedTag[], dictionary: PromptTag[]) {
  return evaluate(candidate, createSelectedContext(selected, dictionary))
}

export function getConflictMap(candidates: PromptTag[], selected: SelectedTag[], dictionary: PromptTag[]) {
  const context = createSelectedContext(selected, dictionary)
  const result = new Map<string, ConflictReason | null>()
  for (const tag of candidates) result.set(tag.id, evaluate(tag, context))
  return result
}

export function getSlotDefinitions() {
  return slotConfig.slots
}

function slotLabel(slot: string) {
  return slotDefinitions.get(slot)?.label ?? slot
}
function groupLabel(group: string) {
  return ({
    full_outerwear: '主アウター・全身衣装', primary_bottom: '主ボトムス', primary_footwear: '主な履物',
    primary_hair_style: '主要な髪型'
  } as Record<string,string>)[group] ?? group
}
