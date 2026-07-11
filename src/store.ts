import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { allTags, type ContentRating, type PromptTag } from './data/tags'
import { adultTags } from './data/adultTags'
import { canonicalId, resolveCanonicalTag } from './data/canonical'
import { createId } from './id'
import type { LocalizedLabels } from './i18n'

export type SelectedTag = { id: string; prompt: string; label: string; labels?: LocalizedLabels; category: string; outputCategory?: string; subcategory?: string; sortSubcategory?: string; promptGroup?: string; promptOrder?: number; slot?: string | string[]; weight: number; rating?: ContentRating }
export type SubjectPosition = 'left' | 'center' | 'right'
export type PromptBlock = { id: string; name: string; subjectNumber?: number; position?: SubjectPosition; tags: SelectedTag[] }
export type EditorLayer = 'subject' | 'scene'
export const SCENE_CATEGORIES = new Set(['quality', 'camera', 'background', 'scene_props', 'lighting', 'effects'])
export const isSceneCategory = (category: string) => SCENE_CATEGORIES.has(category)
export type ModelPreset = 'illustrious' | 'pony' | 'sdxl' | 'custom'

export type UserPromptTag = PromptTag & { source: 'user' }

type State = {
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
  replaceTags: (removeIds, tag) => set((state) => ({
    ...(isSceneCategory(tag.category) ? { sceneTags: [...state.sceneTags.filter(t => !removeIds.includes(t.id) && t.prompt !== tag.prompt), tag] } : { blocks: state.blocks.map(b => b.id === state.activeBlockId
      ? { ...b, tags: [...b.tags.filter(t => !removeIds.includes(t.id) && t.prompt !== tag.prompt), tag] }
      : b) })
  })),
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
  })
}), {
  name: 'sd-prompt-studio-v14',
  version: 11,
  migrate: migratePersistedState,
}))
