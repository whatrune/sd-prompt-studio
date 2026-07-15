import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { allTags, type ContentRating, type PromptTag } from './data/tags'
import { adultTags } from './data/adultTags'
import { canonicalId, resolveCanonicalTag } from './data/canonical'
import { createId } from './id'
import type { LocalizedLabels } from './i18n'

export type TagModifiers = { color?: string }
export type SelectedTag = { id: string; prompt: string; label: string; labels?: LocalizedLabels; category: string; outputCategory?: string; subcategory?: string; sortSubcategory?: string; promptGroup?: string; promptOrder?: number; slot?: string | string[]; layer?: PromptTag['layer']; coverage?: PromptTag['coverage']; weight: number; rating?: ContentRating; baseTagId?: string; modifiers?: TagModifiers }
export type SubjectPosition = 'left' | 'center' | 'right'
export type PromptBlock = { id: string; name: string; subjectNumber?: number; position?: SubjectPosition; tags: SelectedTag[] }
export type EditorLayer = 'subject' | 'scene'
export type WorkspaceView = 'prompt' | 'favorites' | 'library'
export const SCENE_CATEGORIES = new Set(['quality', 'camera', 'background', 'scene_props', 'lighting', 'effects'])
export const isSceneCategory = (category: string) => SCENE_CATEGORIES.has(category)
export type ModelPreset = 'illustrious' | 'pony' | 'sdxl' | 'custom'
export type SeedEntry = { value: number; note?: string }
export const UNCLASSIFIED_PROMPT_GROUP_ID = 'prompt-group-unclassified'
export const PROMPT_GROUP_COLORS = ['#58a6ff', '#a371f7', '#3fb950', '#d29922', '#f778ba', '#39c5cf', '#db6d28', '#8b949e'] as const
export type PromptGroup = { id: string; name: string; color: string; createdAt: number; updatedAt: number }
export const nextPromptGroupName = (groups: Pick<PromptGroup, 'id' | 'name'>[]) => {
  const names = new Set(groups.filter(group => group.id !== UNCLASSIFIED_PROMPT_GROUP_ID).map(group => group.name.trim().toLocaleLowerCase()))
  let suffix = 1
  while (names.has(`グループ${suffix}`.toLocaleLowerCase())) suffix += 1
  return `グループ${suffix}`
}
export type SavedPromptStructure = { blocks: PromptBlock[]; sceneTags: SelectedTag[] }
export type SavedPromptSettings = { modelPreset: ModelPreset; seeds: SeedEntry[] }
export type SavedPrompt = {
  id: string
  name: string
  /** Migrated Prompt-level color retained for storage compatibility only. Never use for rendering. */
  legacyColor?: string
  groups: string[]
  summaryTags: string[]
  displayTags: SelectedTag[]
  structure: SavedPromptStructure
  generatedPrompt: string
  settings: SavedPromptSettings
  /** Compatibility aliases retained for the existing Inspector library. */
  modelPreset: ModelPreset
  positivePrompt: string
  negativePrompt: string
  blocks: PromptBlock[]
  sceneTags: SelectedTag[]
  seeds: SeedEntry[]
  createdAt: number
  updatedAt: number
}
export type SavePromptInput = Pick<SavedPrompt, 'name' | 'positivePrompt' | 'negativePrompt' | 'seeds'> & { groups?: string[] }

export type UserPromptTag = PromptTag & { source: 'user' }

export type State = {
  blocks: PromptBlock[]
  sceneTags: SelectedTag[]
  activeBlockId: string
  activeLayer: EditorLayer
  negative: string
  favoriteIds: string[]
  modelPreset: ModelPreset
  userTags: UserPromptTag[]
  contentLevel: ContentRating
  hideUnavailable: boolean
  seeds: SeedEntry[]
  savedPrompts: SavedPrompt[]
  promptGroups: PromptGroup[]
  navigationCollapsed: boolean
  workspaceView: WorkspaceView
  addTag: (tag: SelectedTag) => void
  addCustomTag: (prompt: string, category: string, saveToDictionary?: boolean, label?: string) => void
  addUserTag: (tag: Omit<UserPromptTag, 'id' | 'source'> & { id?: string }) => void
  importUserTags: (items: PromptTag[]) => number
  removeUserTag: (id: string) => void
  clearUserTags: () => void
  removeTag: (id: string) => void
  removeTagFromLayer: (layerId: string, id: string) => void
  setWeight: (id: string, weight: number) => void
  addBlock: () => void
  removeBlock: (id: string) => void
  renameBlock: (id: string, name: string) => void
  setSubjectPosition: (id: string, position: SubjectPosition) => void
  setActiveBlock: (id: string) => void
  setActiveLayer: (layer: EditorLayer) => void
  clearAll: () => void
  applyQualityPreset: (preset?: ModelPreset) => void
  setModelPreset: (preset: ModelPreset) => void
  setNegative: (value: string) => void
  resetNegative: () => void
  toggleFavorite: (id: string) => void
  setContentLevel: (level: ContentRating) => void
  setHideUnavailable: (value: boolean) => void
  replaceTags: (removeIds: string[], tag: SelectedTag) => void
  replaceTagInLayer: (layerId: string, removeIds: string[], tag: SelectedTag) => void
  setSeeds: (seeds: SeedEntry[]) => void
  savePrompt: (input: SavePromptInput) => SavedPrompt | null
  restorePrompt: (id: string) => boolean
  mergeSavedPrompt: (id: string) => boolean
  deleteSavedPrompt: (id: string) => void
  addPromptGroup: (name: string, color?: string) => PromptGroup | null
  renamePromptGroup: (id: string, name: string) => boolean
  setPromptGroupColor: (id: string, color: string) => boolean
  deletePromptGroup: (id: string) => boolean
  setNavigationCollapsed: (collapsed: boolean) => void
  setWorkspaceView: (view: WorkspaceView) => void
}

export const DEFAULT_NEGATIVE = 'modern, recent, old, oldest, cartoon, graphic, text, painting, crayon, graphite, abstract, glitch, deformed, mutated, ugly, disfigured, long body, lowres, bad anatomy, bad hands, missing fingers, extra fingers, extra digits, fewer digits, cropped, very displeasing, (worst quality, bad quality:1.2), sketch, jpeg artifacts, signature, watermark, username, (censored, bar_censor, mosaic_censor:1.2), simple background, conjoined, bad ai-generated'

const QUALITY_PRESETS: Record<ModelPreset, string[]> = {
  illustrious: ['masterpiece','best quality','amazing quality','4k','very aesthetic','high resolution','ultra-detailed','absurdres','newest'],
  pony: ['score_9','score_8_up','score_7_up','source_anime','rating_safe'],
  sdxl: ['masterpiece','best quality','high resolution','ultra-detailed','sharp focus'],
  custom: []
}

const createFirstBlock = (): PromptBlock => ({ id: createId(), name: '被写体 1', subjectNumber: 1, position: 'center', tags: [] })
const firstBlock = createFirstBlock()

const physicalDictionary = [...allTags, ...adultTags]

const cloneSelectedTag = (tag: SelectedTag): SelectedTag => ({
  ...tag,
  ...(tag.labels ? { labels: { ...tag.labels } } : {}),
  ...(tag.modifiers ? { modifiers: { ...tag.modifiers } } : {}),
})
const cloneBlock = (block: PromptBlock): PromptBlock => ({ ...block, tags: block.tags.map(cloneSelectedTag) })
const cloneSeed = (seed: SeedEntry): SeedEntry => ({ ...seed })
const validSeeds = (seeds: SeedEntry[]) => seeds.every(seed => Number.isSafeInteger(seed.value))
  && new Set(seeds.map(seed => seed.value)).size === seeds.length
const DEFAULT_PROMPT_GROUP_COLOR: string = PROMPT_GROUP_COLORS[0]
const UNCLASSIFIED_PROMPT_GROUP_COLOR: string = PROMPT_GROUP_COLORS[PROMPT_GROUP_COLORS.length - 1]
const normalizePromptGroupColor = (value: unknown, fallback: string = DEFAULT_PROMPT_GROUP_COLOR) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
const createUnclassifiedPromptGroup = (now = Date.now(), color: string = UNCLASSIFIED_PROMPT_GROUP_COLOR): PromptGroup => ({
  id: UNCLASSIFIED_PROMPT_GROUP_ID,
  name: '未分類',
  color: normalizePromptGroupColor(color, UNCLASSIFIED_PROMPT_GROUP_COLOR),
  createdAt: now,
  updatedAt: now,
})
const promptDisplayTags = (blocks: PromptBlock[], sceneTags: SelectedTag[]) => [
  ...sceneTags.map(cloneSelectedTag),
  ...blocks.flatMap(block => block.tags.map(cloneSelectedTag)),
]

const SUMMARY_CATEGORY_PRIORITY = ['character', 'people', 'hair', 'eyes', 'clothes', 'pose', 'background', 'camera']
const QUALITY_SUMMARY_PROMPTS = new Set(['masterpiece', 'best quality', 'amazing quality', 'high quality', '4k'])
const isQualitySummary = (value: string) => {
  const normalized = value.trim().toLocaleLowerCase()
  return QUALITY_SUMMARY_PROMPTS.has(normalized) || /(?:resolution|aesthetic|absurdres|\b\d+k\b)/i.test(normalized)
}

export function buildSavedPromptSummary(displayTags: SelectedTag[], fallbackTags: string[] = []) {
  const ordered = displayTags
    .map((tag, index) => ({ tag, index, priority: SUMMARY_CATEGORY_PRIORITY.indexOf(tag.category) }))
    .filter(({ tag }) => tag.category !== 'quality' && !isQualitySummary(tag.prompt))
    .sort((a, b) => (a.priority < 0 ? SUMMARY_CATEGORY_PRIORITY.length : a.priority) - (b.priority < 0 ? SUMMARY_CATEGORY_PRIORITY.length : b.priority) || a.index - b.index)
  const summary: string[] = []
  const seen = new Set<string>()
  for (const { tag } of ordered) {
    const value = tag.prompt.trim()
    const key = value.toLocaleLowerCase()
    if (!value || seen.has(key)) continue
    summary.push(value)
    seen.add(key)
    if (summary.length === 4) return summary
  }
  for (const value of fallbackTags) {
    const clean = value.trim()
    const key = clean.toLocaleLowerCase()
    if (!clean || isQualitySummary(clean) || seen.has(key)) continue
    summary.push(clean)
    seen.add(key)
    if (summary.length === 4) break
  }
  return summary
}

type LegacySavedPrompt = Partial<SavedPrompt> & { color?: string }

function normalizeSavedPrompt(saved: LegacySavedPrompt, fallbackPreset: ModelPreset): SavedPrompt {
  const blocks = Array.isArray(saved.structure?.blocks)
    ? saved.structure.blocks.map(cloneBlock)
    : Array.isArray(saved.blocks) ? saved.blocks.map(cloneBlock) : []
  const sceneTags = Array.isArray(saved.structure?.sceneTags)
    ? saved.structure.sceneTags.map(cloneSelectedTag)
    : Array.isArray(saved.sceneTags) ? saved.sceneTags.map(cloneSelectedTag) : []
  const modelPreset = saved.settings?.modelPreset ?? saved.modelPreset ?? fallbackPreset
  const seeds = (Array.isArray(saved.settings?.seeds) ? saved.settings.seeds : saved.seeds ?? [])
    .filter(seed => seed && Number.isSafeInteger(seed.value)).map(cloneSeed)
  const displayTags = Array.isArray(saved.displayTags) ? saved.displayTags.map(cloneSelectedTag) : promptDisplayTags(blocks, sceneTags)
  const generatedPrompt = saved.generatedPrompt ?? saved.positivePrompt ?? ''
  const now = Date.now()
  return {
    id: saved.id ?? `saved-prompt-${createId()}`,
    name: saved.name?.trim() || 'Untitled Prompt',
    ...((saved.legacyColor || saved.color) ? { legacyColor: normalizePromptGroupColor(saved.legacyColor ?? saved.color) } : {}),
    groups: Array.isArray(saved.groups) ? [...new Set(saved.groups.filter(Boolean))] : [],
    summaryTags: buildSavedPromptSummary(displayTags, Array.isArray(saved.summaryTags) ? saved.summaryTags : []),
    displayTags,
    structure: { blocks: blocks.map(cloneBlock), sceneTags: sceneTags.map(cloneSelectedTag) },
    generatedPrompt,
    negativePrompt: saved.negativePrompt ?? '',
    settings: { modelPreset, seeds: seeds.map(cloneSeed) },
    modelPreset,
    positivePrompt: generatedPrompt,
    blocks,
    sceneTags,
    seeds,
    createdAt: saved.createdAt ?? now,
    updatedAt: saved.updatedAt ?? saved.createdAt ?? now,
  }
}

function migrateLegacyUserClothingTag(tag: UserPromptTag): UserPromptTag {
  const direct: Record<string, string> = {
    'トップス': '上半身', 'アウター': '上半身', 'ボトムス': '下半身', 'ワンピース・ドレス': 'ワンピース',
    '制服・学校': '制服', '制服・職業': '制服', '和装': '和装', '民族・歴史': '民族・歴史',
    'ファンタジー・SF': 'ファンタジー', '水着・下着': '下着・部屋着', 'ルームウェア': '下着・部屋着',
    'レッグウェア': 'レッグウェア', '靴': '靴', 'デザイン・ディテール': '素材・デザイン',
    '素材・質感': '素材・デザイン', '柄・装飾': '素材・デザイン', 'センシティブ衣装': '衣装（アダルト）',
  }
  const subcategory = tag.subcategory === '水着・下着'
    ? /\b(swimsuit|bikini|swimwear|rash guard|wetsuit)\b/i.test(tag.prompt) ? '水着' : '下着・部屋着'
    : direct[tag.subcategory ?? ''] ?? (tag.subcategory === '衣装（アダルト）' ? tag.subcategory : 'セット・全身')
  return { ...tag, subcategory, sortSubcategory: tag.sortSubcategory ?? tag.subcategory }
}

export function migratePersistedState(persisted: unknown) {
  if (!persisted || typeof persisted !== 'object') return persisted
  const state = persisted as Partial<State>
  if (!Array.isArray(state.blocks)) return state
  const multipleSubjects = state.blocks.length > 1
  const migratedBlocks = state.blocks.map((block, index) => ({
    ...block,
    subjectNumber: block.subjectNumber ?? Number(block.name.match(/(\d+)\s*$/)?.[1] ?? index + 1),
    position: block.position ?? (multipleSubjects ? index === 0 ? 'left' : index === 1 ? 'right' : 'center' : 'center'),
    tags: block.tags.map(tag => {
      const current = resolveCanonicalTag(tag.id, physicalDictionary)
      return current
        ? { ...tag, id: current.id, prompt: current.prompt, label: current.label, category: current.category, outputCategory: current.outputCategory, subcategory: current.subcategory, sortSubcategory: current.sortSubcategory, rating: current.rating }
        : tag
    }),
  }))
  const sceneById = new Map<string, SelectedTag>()
  const existingSceneTags = Array.isArray(state.sceneTags) ? state.sceneTags : []
  for (const tag of [...existingSceneTags, ...migratedBlocks.flatMap(block => block.tags.filter(tag => isSceneCategory(tag.category)))]) {
    const current = sceneById.get(tag.id)
    if (!current) sceneById.set(tag.id, tag)
    else if (tag.weight > current.weight) sceneById.set(tag.id, { ...current, weight: tag.weight })
  }
  const rawSavedPrompts = Array.isArray(state.savedPrompts) ? state.savedPrompts as LegacySavedPrompt[] : []
  const migratedSavedPrompts = rawSavedPrompts.map(saved => normalizeSavedPrompt(saved, state.modelPreset ?? 'illustrious'))
  const rawPromptGroups = Array.isArray(state.promptGroups) ? state.promptGroups : []
  const now = Date.now()
  const migratedPromptGroups = rawPromptGroups
    .filter(group => group && group.id && group.name?.trim())
    .map((group, index) => {
      const legacyGroupColor = rawSavedPrompts.find(saved => saved.groups?.includes(group.id) && saved.color)?.color
      return {
        ...group,
        name: group.id === UNCLASSIFIED_PROMPT_GROUP_ID ? '未分類' : group.name.trim(),
        color: normalizePromptGroupColor(group.color ?? legacyGroupColor, PROMPT_GROUP_COLORS[index % PROMPT_GROUP_COLORS.length]),
        createdAt: group.createdAt ?? now,
        updatedAt: group.updatedAt ?? group.createdAt ?? now,
      }
    })
  const existingUnclassified = migratedPromptGroups.find(group => group.id === UNCLASSIFIED_PROMPT_GROUP_ID)
  const legacyUngroupedColor = rawSavedPrompts.find(saved => !saved.groups?.length && saved.color)?.color
  const unclassifiedGroup = existingUnclassified ?? createUnclassifiedPromptGroup(now, legacyUngroupedColor)
  const promptGroups = [unclassifiedGroup, ...migratedPromptGroups.filter(group => group.id !== UNCLASSIFIED_PROMPT_GROUP_ID)]
  const promptGroupIds = new Set(promptGroups.map(group => group.id))
  const savedPrompts = migratedSavedPrompts.map(saved => {
    const groups = saved.groups.filter(id => promptGroupIds.has(id))
    return { ...saved, groups: groups.length > 0 ? groups : [UNCLASSIFIED_PROMPT_GROUP_ID] }
  })
  return {
    ...state,
    blocks: migratedBlocks.map(block => ({ ...block, tags: block.tags.filter(tag => !isSceneCategory(tag.category)) })),
    sceneTags: [...sceneById.values()],
    activeLayer: state.activeLayer === 'scene' ? 'scene' : 'subject',
    favoriteIds: Array.isArray(state.favoriteIds)
      ? [...new Set(state.favoriteIds.map(id => canonicalId(id, physicalDictionary)))]
      : state.favoriteIds,
    userTags: Array.isArray(state.userTags)
      ? state.userTags.map(tag => {
          if (tag.category === 'clothes') return migrateLegacyUserClothingTag(tag)
          if (tag.category !== 'adult') return tag
          const placement: Record<string, [string, string]> = {
            'ポーズ': ['pose', 'ポーズ（アダルト）'],
            '行動': ['pose', '行動（アダルト）'],
            '相互作用': ['people', '相互作用（アダルト）'],
            '表情': ['expression', '表情（アダルト）'],
            '衣装': ['clothes', '衣装（アダルト）'],
            '道具': ['scene_props', '道具（アダルト）'],
          }
          const [category, subcategory] = placement[tag.subcategory ?? ''] ?? ['pose', '行動（アダルト）']
          return { ...tag, category, subcategory }
        })
      : state.userTags,
    seeds: Array.isArray(state.seeds) ? state.seeds.filter(seed => seed && Number.isSafeInteger(seed.value)).map(cloneSeed) : [],
    savedPrompts,
    promptGroups,
    navigationCollapsed: state.navigationCollapsed === true,
    workspaceView: state.workspaceView === 'favorites' || state.workspaceView === 'library' ? state.workspaceView : 'prompt',
  }
}

export const usePromptStore = create<State>()(persist((set, get) => ({
  blocks: [firstBlock],
  sceneTags: [],
  activeBlockId: firstBlock.id,
  activeLayer: 'subject',
  negative: DEFAULT_NEGATIVE,
  favoriteIds: [],
  modelPreset: 'illustrious',
  userTags: [],
  contentLevel: 'general',
  hideUnavailable: false,
  seeds: [],
  savedPrompts: [],
  promptGroups: [createUnclassifiedPromptGroup()],
  navigationCollapsed: false,
  workspaceView: 'prompt',
  replaceTags: (removeIds, tag) => set((state) => ({
    ...(isSceneCategory(tag.category) ? { sceneTags: [...state.sceneTags.filter(t => !removeIds.includes(t.id) && t.prompt !== tag.prompt), tag] } : { blocks: state.blocks.map(b => b.id === state.activeBlockId
      ? { ...b, tags: [...b.tags.filter(t => !removeIds.includes(t.id) && t.prompt !== tag.prompt), tag] }
      : b) })
  })),
  replaceTagInLayer: (layerId, removeIds, tag) => set((state) => {
    const replace = (items: SelectedTag[]) => [
      ...items.filter(item => !removeIds.includes(item.id) && item.prompt !== tag.prompt),
      tag,
    ]
    return layerId === 'scene'
      ? { sceneTags: replace(state.sceneTags) }
      : { blocks: state.blocks.map(block => block.id === layerId ? { ...block, tags: replace(block.tags) } : block) }
  }),
  addTag: (tag) => set((state) => ({
    ...(isSceneCategory(tag.category) ? { sceneTags: state.sceneTags.some(t => t.prompt === tag.prompt) ? state.sceneTags : [...state.sceneTags, tag] } : { blocks: state.blocks.map(b => b.id === state.activeBlockId && !b.tags.some(t => t.prompt === tag.prompt)
      ? { ...b, tags: [...b.tags, tag] }
      : b) })
  })),
  addCustomTag: (prompt, category, saveToDictionary = false, label) => {
    const clean = prompt.trim().replace(/^\[|\]$/g, '')
    if (!clean) return
    const item = { id: `custom-${createId()}`, prompt: clean, label: label?.trim() || clean, category, subcategory: 'カスタム', weight: 1 }
    get().addTag(item)
    if (saveToDictionary) get().addUserTag({ prompt: clean, label: item.label, category, subcategory: 'ユーザー辞書' })
  },
  addUserTag: (tag) => set((state) => {
    if (state.userTags.some(t => t.prompt === tag.prompt && t.category === tag.category)) return state
    const item: UserPromptTag = { ...tag, id: tag.id || `user-${createId()}`, source: 'user' }
    return { userTags: [...state.userTags, item] }
  }),
  importUserTags: (items) => {
    const valid = items.filter(item => item && typeof item.prompt === 'string' && typeof item.category === 'string')
    const before = get().userTags.length
    set((state) => {
      const map = new Map(state.userTags.map(t => [`${t.category}\u0000${t.prompt}`, t]))
      valid.forEach((item) => {
        const key = `${item.category}\u0000${item.prompt.trim()}`
        if (!map.has(key)) map.set(key, { ...item, id: item.id || `user-${createId()}`, label: item.label || item.prompt, subcategory: item.subcategory || 'ユーザー辞書', source: 'user' })
      })
      return { userTags: [...map.values()] }
    })
    return get().userTags.length - before
  },
  removeUserTag: (id) => set((state) => ({ userTags: state.userTags.filter(t => t.id !== id), favoriteIds: state.favoriteIds.filter(x => x !== id) })),
  clearUserTags: () => set({ userTags: [] }),
  removeTag: (id) => set((state) => ({
    sceneTags: state.sceneTags.filter(t => t.id !== id),
    blocks: state.blocks.map(b => b.id === state.activeBlockId ? { ...b, tags: b.tags.filter(t => t.id !== id) } : b)
  })),
  removeTagFromLayer: (layerId, id) => set((state) => layerId === 'scene'
    ? { sceneTags: state.sceneTags.filter(tag => tag.id !== id) }
    : { blocks: state.blocks.map(block => block.id === layerId ? { ...block, tags: block.tags.filter(tag => tag.id !== id) } : block) }),
  setWeight: (id, weight) => set((state) => ({
    sceneTags: state.sceneTags.map(t => t.id === id ? { ...t, weight: Math.max(0.1, Math.min(2, weight || 1)) } : t),
    blocks: state.blocks.map(b => b.id === state.activeBlockId
      ? { ...b, tags: b.tags.map(t => t.id === id ? { ...t, weight: Math.max(0.1, Math.min(2, weight || 1)) } : t) }
      : b)
  })),
  addBlock: () => set((state) => {
    const id = createId()
    const subjectNumber = Math.max(0, ...state.blocks.map((block, index) => block.subjectNumber ?? Number(block.name.match(/(\d+)\s*$/)?.[1] ?? index + 1))) + 1
    const blocks = state.blocks.length === 1
      ? [{ ...state.blocks[0], position: 'left' as const }, { id, name: `被写体 ${subjectNumber}`, subjectNumber, position: 'right' as const, tags: [] }]
      : [...state.blocks, { id, name: `被写体 ${subjectNumber}`, subjectNumber, position: 'center' as const, tags: [] }]
    return { blocks, activeBlockId: id, activeLayer: 'subject' }
  }),
  removeBlock: (id) => set((state) => {
    if (state.blocks.length === 1) return state
    const next = state.blocks.filter(b => b.id !== id)
    return { blocks: next, activeBlockId: state.activeBlockId === id ? next[0].id : state.activeBlockId }
  }),
  renameBlock: (id, name) => set((state) => ({ blocks: state.blocks.map(b => b.id === id ? { ...b, name: name.trim() || b.name } : b) })),
  setSubjectPosition: (id, position) => set((state) => ({ blocks: state.blocks.map(block => block.id === id ? { ...block, position } : block) })),
  setActiveBlock: (id) => set({ activeBlockId: id, activeLayer: 'subject' }),
  setActiveLayer: (layer) => set({ activeLayer: layer }),
  clearAll: () => set((state) => ({ sceneTags: [], blocks: state.blocks.map((b, index) => ({ ...b, name: `被写体 ${index + 1}`, tags: [] })) })),
  applyQualityPreset: (preset) => {
    const current = preset ?? get().modelPreset
    const prompts = QUALITY_PRESETS[current]
    set((state) => ({ sceneTags: [...state.sceneTags.filter(t => t.category !== 'quality'), ...prompts.map((prompt, i) => ({ id: `preset-${current}-${i}`, prompt, label: prompt, category: 'quality', subcategory: '品質', weight: 1 }))] }))
  },
  setModelPreset: (preset) => set({ modelPreset: preset }),
  setNegative: (value) => set({ negative: value }),
  resetNegative: () => set({ negative: DEFAULT_NEGATIVE }),
  toggleFavorite: (id) => set((state) => ({ favoriteIds: state.favoriteIds.includes(id) ? state.favoriteIds.filter(x => x !== id) : [...state.favoriteIds, id] })),
  setHideUnavailable: (value) => set({ hideUnavailable: value }),
  setContentLevel: (level) => set((state) => {
    const rank = { general: 0, suggestive: 1, adult: 2 } as const
    return {
      contentLevel: level,
      blocks: state.blocks.map(block => ({ ...block, tags: block.tags.filter(tag => rank[tag.rating ?? 'general'] <= rank[level]) }))
    }
  }),
  setSeeds: (seeds) => {
    if (!validSeeds(seeds)) return
    set({ seeds: seeds.map(cloneSeed) })
  },
  savePrompt: (input) => {
    const name = input.name.trim()
    if (!name || !validSeeds(input.seeds)) return null
    const state = get()
    const now = Date.now()
    const blocks = state.blocks.map(cloneBlock)
    const sceneTags = state.sceneTags.map(cloneSelectedTag)
    const seeds = input.seeds.map(cloneSeed)
    const displayTags = promptDisplayTags(blocks, sceneTags)
    const selectedGroups = [...new Set((input.groups ?? []).filter(id => state.promptGroups.some(group => group.id === id)))]
    const groups = selectedGroups.length > 0 ? selectedGroups : [UNCLASSIFIED_PROMPT_GROUP_ID]
    const promptGroups = state.promptGroups.some(group => group.id === UNCLASSIFIED_PROMPT_GROUP_ID)
      ? state.promptGroups
      : [createUnclassifiedPromptGroup(now), ...state.promptGroups]
    const saved: SavedPrompt = {
      id: `saved-prompt-${createId()}`,
      name,
      groups,
      summaryTags: buildSavedPromptSummary(displayTags),
      displayTags,
      structure: { blocks: blocks.map(cloneBlock), sceneTags: sceneTags.map(cloneSelectedTag) },
      generatedPrompt: input.positivePrompt,
      settings: { modelPreset: state.modelPreset, seeds: seeds.map(cloneSeed) },
      modelPreset: state.modelPreset,
      positivePrompt: input.positivePrompt,
      negativePrompt: input.negativePrompt,
      blocks,
      sceneTags,
      seeds,
      createdAt: now,
      updatedAt: now,
    }
    set(current => ({ promptGroups, savedPrompts: [saved, ...current.savedPrompts], seeds: saved.seeds.map(cloneSeed) }))
    return saved
  },
  restorePrompt: (id) => {
    const saved = get().savedPrompts.find(item => item.id === id)
    if (!saved || saved.blocks.length === 0) return false
    const blocks = saved.blocks.map(cloneBlock)
    set({
      blocks,
      sceneTags: saved.sceneTags.map(cloneSelectedTag),
      negative: saved.negativePrompt,
      modelPreset: saved.modelPreset,
      seeds: saved.seeds.map(cloneSeed),
      activeBlockId: blocks[0].id,
      activeLayer: 'subject',
    })
    return true
  },
  mergeSavedPrompt: (id) => {
    const state = get()
    const saved = state.savedPrompts.find(item => item.id === id)
    if (!saved) return false
    const mergeTags = (current: SelectedTag[], incoming: SelectedTag[]) => {
      const seen = new Set(current.map(tag => `${tag.id}\u0000${tag.prompt}`))
      return [...current.map(cloneSelectedTag), ...incoming.filter(tag => !seen.has(`${tag.id}\u0000${tag.prompt}`)).map(cloneSelectedTag)]
    }
    const blocks = [...state.blocks.map(cloneBlock), ...saved.blocks.map((block, index) => ({
      ...cloneBlock(block),
      id: createId(),
      subjectNumber: state.blocks.length + index + 1,
      name: `Character ${state.blocks.length + index + 1}`,
    }))]
    set({
      blocks,
      sceneTags: mergeTags(state.sceneTags, saved.sceneTags),
      negative: [state.negative, saved.negativePrompt].filter(Boolean).join(', '),
      seeds: [...state.seeds, ...saved.seeds.filter(seed => !state.seeds.some(current => current.value === seed.value)).map(cloneSeed)],
    })
    return true
  },
  deleteSavedPrompt: (id) => set(state => ({ savedPrompts: state.savedPrompts.filter(item => item.id !== id) })),
  addPromptGroup: (value, requestedColor) => {
    const name = value.trim()
    if (!name || get().promptGroups.some(group => group.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return null
    const now = Date.now()
    const userGroupCount = get().promptGroups.filter(group => group.id !== UNCLASSIFIED_PROMPT_GROUP_ID).length
    const color = normalizePromptGroupColor(requestedColor, PROMPT_GROUP_COLORS[userGroupCount % PROMPT_GROUP_COLORS.length])
    const group: PromptGroup = { id: `prompt-group-${createId()}`, name, color, createdAt: now, updatedAt: now }
    set(state => ({ promptGroups: [...state.promptGroups, group] }))
    return group
  },
  renamePromptGroup: (id, value) => {
    const name = value.trim()
    const state = get()
    if (id === UNCLASSIFIED_PROMPT_GROUP_ID || !name || !state.promptGroups.some(group => group.id === id) || state.promptGroups.some(group => group.id !== id && group.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return false
    set({ promptGroups: state.promptGroups.map(group => group.id === id ? { ...group, name, updatedAt: Date.now() } : group) })
    return true
  },
  setPromptGroupColor: (id, value) => {
    const state = get()
    if (id === UNCLASSIFIED_PROMPT_GROUP_ID || !state.promptGroups.some(group => group.id === id) || !/^#[0-9a-f]{6}$/i.test(value)) return false
    set({ promptGroups: state.promptGroups.map(group => group.id === id ? { ...group, color: value, updatedAt: Date.now() } : group) })
    return true
  },
  deletePromptGroup: (id) => {
    const state = get()
    if (id === UNCLASSIFIED_PROMPT_GROUP_ID || !state.promptGroups.some(group => group.id === id)) return false
    const promptGroups = state.promptGroups.some(group => group.id === UNCLASSIFIED_PROMPT_GROUP_ID)
      ? state.promptGroups.filter(group => group.id !== id)
      : [createUnclassifiedPromptGroup(), ...state.promptGroups.filter(group => group.id !== id)]
    set({
      promptGroups,
      savedPrompts: state.savedPrompts.map(saved => {
        const groups = saved.groups.filter(groupId => groupId !== id)
        return { ...saved, groups: groups.length > 0 ? groups : [UNCLASSIFIED_PROMPT_GROUP_ID] }
      }),
    })
    return true
  },
  setNavigationCollapsed: (navigationCollapsed) => set({ navigationCollapsed }),
  setWorkspaceView: (workspaceView) => set({ workspaceView }),
}), {
  name: 'sd-prompt-studio-v14',
  version: 16,
  migrate: migratePersistedState,
}))
