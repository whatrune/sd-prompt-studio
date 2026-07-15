import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Activity, AlertTriangle, BadgeCheck, Ban, BookOpen, Camera, Check, ChevronDown, ChevronRight, ChevronUp, Copy, Eye, Gem, Image, Info, Lightbulb, Menu, MessageSquareText, Package, PersonStanding, Plus, RotateCcw, Save, Scissors, Search, Settings2, Shirt, Smile, Sparkles, Star, Tags, Trash2, UserRound, Users, WandSparkles, X } from 'lucide-react'
import { categoryLabels, categoryOrder, subcategoryOrder, TAG_COUNT, tags, type ContentRating, type PromptTag } from './data/tags'
import { ADULT_TAG_COUNT, adultTags } from './data/adultTags'
import { isSceneCategory, nextPromptGroupName, UNCLASSIFIED_PROMPT_GROUP_ID, usePromptStore, type SelectedTag, type ModelPreset, type PromptGroup, type SavedPrompt } from './store'
import { compatibilityLabel, generationNote, heuristicCategory, inferCategory, modelHints } from './engine/tagIntelligence'
import { getConflictMap } from './engine/smartTagEngine'
import './styles.css'
import { createId } from './id'
import { buildPromptWithStrategy, tagSort } from './prompt'
import { DEFAULT_LOCALE, getCategoryLabel, getTagLabel, t } from './i18n'
import { buildColorModifiedTag, COLOR_MODIFIERS, findColorModifier, isColorModifiableCategory } from './modifiers/colorModifier'



const categoryGuides: Record<string, { title: string; text: string }> = {
  camera: { title: 'カメラ・構図', text: '画面にどこまで入れるか、どの方向から見るか、遠近感をどう見せるかを指定します。画角・視点・レンズは似ていますが、役割が異なります。' },
  lighting: { title: 'ライティング', text: '光の柔らかさ、方向、色、時間帯を指定します。人物の立体感や場面の感情を大きく変えるカテゴリです。' },
  effects: { title: '奥行き・エフェクト', text: 'ぼかし、空気遠近、光学効果、粒子、色調補正を追加します。主役を目立たせたり、画面の前後関係や空気感を補強します。' },
  quality: { title: '品質・スタイル', text: '品質や描画傾向を補助するタグです。効果はモデルやチェックポイントによって異なります。' },
}

const COLOR_OPTIONS = [
  ['', '指定なし'], ['black', '黒'], ['white', '白'], ['gray', 'グレー'], ['silver', '銀'], ['red', '赤'], ['crimson', '深紅'], ['orange', 'オレンジ'], ['yellow', '黄'], ['gold', '金'], ['green', '緑'], ['emerald', 'エメラルド'], ['teal', '青緑'], ['cyan', 'シアン'], ['blue', '青'], ['navy blue', '紺'], ['purple', '紫'], ['violet', '菫'], ['pink', 'ピンク'], ['magenta', 'マゼンタ'], ['brown', '茶'], ['beige', 'ベージュ'], ['peach', '桃色'], ['rainbow', '虹色']
] as const
const SKIN_OPTIONS = [
  ['pale skin', '青白い肌'], ['porcelain skin', '陶器のような白肌'], ['fair skin', '色白'], ['light skin', '明るい肌'], ['rosy skin', '血色のよい肌'], ['peach skin', 'ピーチ色の肌'], ['olive skin', 'オリーブ肌'], ['tan skin', '日焼け肌'], ['sun-kissed skin', '健康的な日焼け肌'], ['bronze skin', 'ブロンズ肌'], ['brown skin', '褐色肌'], ['dark skin', '濃い肌'], ['deep dark skin', '深い褐色肌'], ['blue skin', '青い肌'], ['green skin', '緑の肌'], ['purple skin', '紫の肌'], ['gray skin', '灰色の肌']
] as const

const NAV_CATEGORY_ICONS = {
  quality: BadgeCheck,
  people: Users,
  character: UserRound,
  expression: Smile,
  eyes: Eye,
  hair: Scissors,
  body: Activity,
  clothes: Shirt,
  accessories: Gem,
  pose: PersonStanding,
  camera: Camera,
  background: Image,
  scene_props: Package,
  lighting: Lightbulb,
  effects: Sparkles,
} as const

const mutuallyExclusiveGroups = [
  ['short hair','medium hair','long hair','very long hair','absurdly long hair'],
  ['black hair','brown hair','blonde hair','white hair','silver hair','red hair','blue hair','green hair','pink hair','purple hair','orange hair'],
  ['blue eyes','green eyes','red eyes','purple eyes','brown eyes','black eyes','gold eyes','silver eyes','pink eyes'],
  ['standing','sitting','lying','kneeling','squatting'],
  ['front view','side view','back view','from above','from below']
]


async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy copy path below.
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  } catch {
    return false
  }
}

const RATING_RANK: Record<ContentRating, number> = { general: 0, suggestive: 1, adult: 2 }
type Theme = 'dark' | 'light'
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  try {
    const stored = window.localStorage.getItem('sd-prompt-studio-theme')
    return stored === 'light' || stored === 'dark' ? stored : 'dark'
  } catch {
    return 'dark'
  }
}
const MINOR_MARKERS = ['child','children','young child','elementary school student','middle school student','underage','minor','preteen','teenage','loli','shota']
function hasMinorMarker(items: SelectedTag[]) { return items.some(t => MINOR_MARKERS.some(marker => t.prompt.toLowerCase().includes(marker))) }
function hasAdultTag(items: SelectedTag[]) { return items.some(t => t.rating === 'adult') }
function scoreTag(tag: PromptTag, query: string) {
  const q = query.toLowerCase()
  const label = tag.label.toLowerCase(), prompt = tag.prompt.toLowerCase()
  if (label === q || prompt === q) return 100
  if (label.startsWith(q) || prompt.startsWith(q)) return 70
  if (label.includes(q) || prompt.includes(q)) return 50
  if ((tag.aliases ?? []).some(a => a.toLowerCase().includes(q))) return 30
  return 0
}
type TagSubcategoryGroup = { key: string; label: string; tags: PromptTag[]; showTitle: boolean }
type TagCategoryGroup = { key: string; label?: string; groups: TagSubcategoryGroup[] }
function TabLabel({ active, label }: { active: boolean; label: string }) {
  return <>{active&&<Check size={14}/>}<span>{label}</span></>
}
function groupTagsBySubcategory(items: PromptTag[], category: string) {
  const grouped = new Map<string, PromptTag[]>()
  items.forEach(tag => {
    const key = tag.subcategory?.trim() || 'その他'
    const existing = grouped.get(key)
    if (existing) existing.push(tag)
    else grouped.set(key, [tag])
  })
  const configured = subcategoryOrder[category] ?? []
  const known = configured.filter(key => key !== 'その他' && grouped.has(key))
  const unknown = [...grouped.keys()].filter(key => key !== 'その他' && !configured.includes(key))
  const ordered = [...known, ...unknown, ...(grouped.has('その他') ? ['その他'] : [])]
  return ordered.map(key => ({ key, label: key, tags: grouped.get(key) ?? [], showTitle: true }))
}
function conflicts(selected: SelectedTag[]) {
  const prompts = selected.map(t => t.prompt)
  const groupWarnings = mutuallyExclusiveGroups.flatMap(group => {
    const hits = group.filter(x => prompts.includes(x))
    return hits.length > 1 ? [`${hits.join(' / ')} は同時指定で競合する可能性があります`] : []
  })
  const metadataWarnings = selected.flatMap(item => {
    const source = [...tags, ...adultTags].find(t => t.id === item.id)
    return (source?.conflicts ?? []).filter(x => prompts.includes(x)).map(x => `${item.prompt} / ${x} は競合候補です`)
  })
  return [...new Set([...groupWarnings, ...metadataWarnings])]
}
function relatedTags(selected: SelectedTag[]) {
  const promptSet = new Set(selected.map(t => t.prompt))
  const suggestions: Record<string,string[]> = {
    'twintails':['hair ribbon','hair bow','long hair'],
    'serafuku':['red neckerchief','pleated skirt','loafers'],
    'maid':['maid headdress','frilled apron','white gloves'],
    'nebulae cosmic eyes':['glowing eyes','sparkling eyes','cosmic background'],
    'backlight':['rim light','volumetric lighting','lens flare'],
    'portrait':['looking at viewer','depth of field','bokeh']
  }
  const wanted = selected.flatMap(t => {
    const source = [...tags, ...adultTags].find(x => x.id === t.id)
    return [...(suggestions[t.prompt] ?? []), ...(source?.related ?? [])]
  }).filter(p => !promptSet.has(p))
  return [...new Set(wanted)].map(p => [...tags, ...adultTags].find(t => t.prompt === p)).filter(Boolean) as PromptTag[]
}

export default function App() {
  const locale = DEFAULT_LOCALE
  const [category, setCategory] = useState('quality')
  const [subcategory, setSubcategory] = useState('すべて')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [query, setQuery] = useState('')
  const [searchCategory, setSearchCategory] = useState('すべて')
  const [favoriteCategory, setFavoriteCategory] = useState('すべて')
  const [activeColorModifier, setActiveColorModifier] = useState('')
  const [copiedPositive, setCopiedPositive] = useState(false)
  const [copiedNegative, setCopiedNegative] = useState(false)
  const [copiedFinal, setCopiedFinal] = useState(false)
  const [inspectedTag, setInspectedTag] = useState<PromptTag | null>(null)
  const [analyzerOpen, setAnalyzerOpen] = useState(false)
  const [analyzerText, setAnalyzerText] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [saveCustom, setSaveCustom] = useState(true)
  const [composerCollapsed, setComposerCollapsed] = useState(true)
  const [relatedCollapsed, setRelatedCollapsed] = useState(false)
  const [selectedCollapsed, setSelectedCollapsed] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [expansionCollapsed, setExpansionCollapsed] = useState(true)
  const [promptCollapsed, setPromptCollapsed] = useState(true)
  const [negativeCollapsed, setNegativeCollapsed] = useState(true)
  const [savePromptOpen, setSavePromptOpen] = useState(false)
  const [savePromptName, setSavePromptName] = useState('')
  const [seedInputs, setSeedInputs] = useState<string[]>([''])
  const [savePromptError, setSavePromptError] = useState('')
  const [savePromptGroups, setSavePromptGroups] = useState<string[]>([])
  const [activeLibraryGroup, setActiveLibraryGroup] = useState('all')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editingGroupName, setEditingGroupName] = useState('')
  const [editingGroupColor, setEditingGroupColor] = useState('#58a6ff')
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<PromptGroup | null>(null)
  const [selectedSavedPrompt, setSelectedSavedPrompt] = useState<SavedPrompt | null>(null)
  const [pendingApplyPrompt, setPendingApplyPrompt] = useState<SavedPrompt | null>(null)
  const [pendingDeletePrompt, setPendingDeletePrompt] = useState<SavedPrompt | null>(null)
  const [clearPromptConfirmOpen, setClearPromptConfirmOpen] = useState(false)
  const [activeNavigationFlyout, setActiveNavigationFlyout] = useState<'prompt' | 'favorites' | 'library' | null>(null)
  const navigationHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigationCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settingsRef = useRef<HTMLDivElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [clothingItem, setClothingItem] = useState('shirt')
  const [clothingColor, setClothingColor] = useState('black')
  const [clothingMaterial, setClothingMaterial] = useState('')
  const [clothingPattern, setClothingPattern] = useState('')
  const [hairColor, setHairColor] = useState('black')
  const [hairAccentColor, setHairAccentColor] = useState('')
  const [hairColorMode, setHairColorMode] = useState('solid')
  const [eyeColor, setEyeColor] = useState('blue')
  const [eyeAccentColor, setEyeAccentColor] = useState('')
  const [eyeColorMode, setEyeColorMode] = useState('solid')
  const [skinColor, setSkinColor] = useState('fair skin')
  const [propItem, setPropItem] = useState('bed')
  const [propHorizontal, setPropHorizontal] = useState('left side')
  const [propVertical, setPropVertical] = useState('')
  const [propDepth, setPropDepth] = useState('background')
  const store = usePromptStore()
  const userPromptGroups = useMemo(() => store.promptGroups.filter(group => group.id !== UNCLASSIFIED_PROMPT_GROUP_ID), [store.promptGroups])
  const effectiveLibraryGroup = activeLibraryGroup === UNCLASSIFIED_PROMPT_GROUP_ID || (activeLibraryGroup !== 'all' && !userPromptGroups.some(group => group.id === activeLibraryGroup)) ? 'all' : activeLibraryGroup
  const isSearchMode = query.trim().length > 0
  const favoritesOnly = store.workspaceView === 'favorites'
  const mainSubjectId = store.blocks[0]?.id
  const [viewContextId, setViewContextId] = useState<string>(() => store.activeBlockId)
  const activeSubject = store.blocks.find(b => b.id === store.activeBlockId)!
  const active = store.activeLayer === 'scene' ? { id: 'scene', name: 'Scene', tags: store.sceneTags } : { ...activeSubject, tags: [...store.sceneTags, ...activeSubject.tags] }

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    try { window.localStorage.setItem('sd-prompt-studio-theme', theme) } catch { /* Keep the in-memory theme when storage is unavailable. */ }
  }, [theme])
  useEffect(() => {
    if (!settingsOpen) return
    const closeSettingsOnOutsidePointer = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false)
    }
    document.addEventListener('pointerdown', closeSettingsOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeSettingsOnOutsidePointer)
  }, [settingsOpen])

  useEffect(() => {
    if (activeLibraryGroup === UNCLASSIFIED_PROMPT_GROUP_ID || (activeLibraryGroup !== 'all' && !userPromptGroups.some(group => group.id === activeLibraryGroup))) {
      setActiveLibraryGroup('all')
    }
  }, [activeLibraryGroup, userPromptGroups])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveNavigationFlyout(null)
    }
    if (!store.navigationCollapsed) setActiveNavigationFlyout(null)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      if (navigationHoverTimer.current) window.clearTimeout(navigationHoverTimer.current)
      if (navigationCloseTimer.current) window.clearTimeout(navigationCloseTimer.current)
    }
  }, [store.navigationCollapsed])

  function cancelNavigationTimers() {
    if (navigationHoverTimer.current) window.clearTimeout(navigationHoverTimer.current)
    if (navigationCloseTimer.current) window.clearTimeout(navigationCloseTimer.current)
    navigationHoverTimer.current = null
    navigationCloseTimer.current = null
  }
  function openNavigationFlyoutAfterDelay(view: 'prompt' | 'favorites' | 'library') {
    if (!store.navigationCollapsed) return
    cancelNavigationTimers()
    navigationHoverTimer.current = window.setTimeout(() => {
      setActiveNavigationFlyout(view)
      navigationHoverTimer.current = null
    }, 500)
  }
  function closeNavigationFlyoutAfterDelay() {
    if (navigationHoverTimer.current) window.clearTimeout(navigationHoverTimer.current)
    navigationHoverTimer.current = null
    navigationCloseTimer.current = window.setTimeout(() => {
      setActiveNavigationFlyout(null)
      navigationCloseTimer.current = null
    }, 150)
  }
  function closeNavigationFlyout() {
    cancelNavigationTimers()
    setActiveNavigationFlyout(null)
  }
  function navigateToPrompt() {
    closeNavigationFlyout()
    store.setWorkspaceView('prompt')
    setQuery('')
    setSubcategory('すべて')
  }
  function navigateToFavorites() {
    closeNavigationFlyout()
    store.setWorkspaceView('favorites')
    setQuery('')
    setFavoriteCategory('すべて')
    setSubcategory('すべて')
  }
  function changeSearchQuery(value: string) {
    const startsSearch = !isSearchMode && value.trim().length > 0
    setQuery(value)
    if (startsSearch || !value.trim()) setSearchCategory('すべて')
    if (value.trim()) store.setWorkspaceView('prompt')
  }

  const subcategories = useMemo(() => subcategoryOrder[category] ?? [], [category])
  const dictionaryTags = useMemo(() => [...tags, ...adultTags, ...store.userTags], [store.userTags])
  const visibleDictionaryTags = useMemo(() => dictionaryTags.filter(tag => RATING_RANK[tag.rating ?? 'general'] <= RATING_RANK[store.contentLevel]).map(tag => ({ ...tag, label: getTagLabel(tag, locale) })), [dictionaryTags, locale, store.contentLevel])
  const conflictSelection = favoritesOnly ? [...store.sceneTags, ...activeSubject.tags] : active.tags
  const conflictMap = useMemo(() => getConflictMap(visibleDictionaryTags, conflictSelection, dictionaryTags), [visibleDictionaryTags, conflictSelection, dictionaryTags])
  const favoriteCategories = useMemo(() => {
    const favoriteIds = new Set(store.favoriteIds)
    return categoryOrder.filter(categoryKey => visibleDictionaryTags.some(tag => tag.category === categoryKey
      && favoriteIds.has(tag.id)
      && (!store.hideUnavailable || conflictMap.get(tag.id)?.level !== 'hard')))
  }, [conflictMap, store.favoriteIds, store.hideUnavailable, visibleDictionaryTags])
  useEffect(() => {
    if (favoriteCategory !== 'すべて' && !favoriteCategories.includes(favoriteCategory)) setFavoriteCategory('すべて')
  }, [favoriteCategories, favoriteCategory])
  const searchCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return categoryOrder.filter(categoryKey => visibleDictionaryTags.some(tag => tag.category === categoryKey
      && scoreTag(tag, q) > 0
      && (!store.hideUnavailable || conflictMap.get(tag.id)?.level !== 'hard')))
  }, [conflictMap, query, store.hideUnavailable, visibleDictionaryTags])
  useEffect(() => {
    if (!isSearchMode || (searchCategory !== 'すべて' && !searchCategories.includes(searchCategory))) setSearchCategory('すべて')
  }, [isSearchMode, searchCategories, searchCategory])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return visibleDictionaryTags.filter(t => {
      if (q) {
        if (scoreTag(t, q) === 0) return false
        if (store.hideUnavailable && conflictMap.get(t.id)?.level === 'hard') return false
        return searchCategory === 'すべて' || t.category === searchCategory
      }
      if (favoritesOnly && !store.favoriteIds.includes(t.id)) return false
      if (favoritesOnly && favoriteCategory !== 'すべて' && t.category !== favoriteCategory) return false
      if (!favoritesOnly && !q && t.category !== category) return false
      if (!favoritesOnly && !q && subcategory !== 'すべて' && t.subcategory !== subcategory) return false
      if (!q && store.hideUnavailable && conflictMap.get(t.id)?.level === 'hard') return false
      return true
    }).sort((a,b) => q ? scoreTag(b,q)-scoreTag(a,q) || tagSort(a,b) : tagSort(a,b))
  }, [category, subcategory, query, searchCategory, favoritesOnly, favoriteCategory, store.favoriteIds, visibleDictionaryTags, store.hideUnavailable, conflictMap])
  const tagCategoryGroups = useMemo<TagCategoryGroup[]>(() => {
    if (query.trim() || (!favoritesOnly && subcategory !== 'すべて')) {
      return [{ key: 'flat', groups: [{ key: 'flat', label: '', tags: filtered, showTitle: false }] }]
    }
    if (favoritesOnly) {
      const favoritesByCategory = new Map<string, PromptTag[]>()
      filtered.forEach(tag => {
        const existing = favoritesByCategory.get(tag.category)
        if (existing) existing.push(tag)
        else favoritesByCategory.set(tag.category, [tag])
      })
      return categoryOrder.flatMap(categoryKey => {
        const categoryTags = favoritesByCategory.get(categoryKey) ?? []
        if (categoryTags.length === 0) return []
        const groups = groupTagsBySubcategory(categoryTags, categoryKey)
        const showSubcategory = groups.length > 1
        return [{
          key: categoryKey,
          label: getCategoryLabel(categoryKey, locale),
          groups: groups.map(group => ({ ...group, showTitle: showSubcategory })),
        }]
      })
    }
    return [{ key: category, groups: groupTagsBySubcategory(filtered, category) }]
  }, [category, favoritesOnly, filtered, locale, query, subcategory])
  const selectedLayerTags = useMemo(() => {
    const subject = store.blocks.find(block => block.id === viewContextId) ?? activeSubject
    return {
      scene: store.sceneTags,
      subject: subject.tags,
    }
  }, [activeSubject, store.blocks, store.sceneTags, viewContextId])

  const expansion = useMemo(() => buildPromptWithStrategy(store.blocks, store.sceneTags, store.modelPreset), [store.blocks, store.sceneTags, store.modelPreset])
  const prompt = expansion.prompt

  const openSavePrompt = () => {
    setSavePromptName('')
    setSeedInputs(store.seeds.length > 0 ? store.seeds.map(seed => String(seed.value)) : [''])
    setSavePromptGroups([])
    setSavePromptError('')
    setSavePromptOpen(true)
  }
  const submitSavedPrompt = () => {
    if (seedInputs.some(value => value !== '' && !/^\d+$/.test(value))) {
      setSavePromptError('Seedは整数で入力してください。')
      return
    }
    const seeds = seedInputs.filter(Boolean).map(value => ({ value: Number(value) }))
    if (seeds.some(seed => !Number.isSafeInteger(seed.value))) {
      setSavePromptError('Seedは安全な整数範囲で入力してください。')
      return
    }
    if (new Set(seeds.map(seed => seed.value)).size !== seeds.length) {
      setSavePromptError('同じSeedは重複して保存できません。')
      return
    }
    const name = savePromptName.trim()
    if (!name) {
      setSavePromptError('名前を入力してください。')
      return
    }
    const saved = store.savePrompt({ name, positivePrompt: prompt, negativePrompt: store.negative, seeds, groups: savePromptGroups })
    if (!saved) {
      setSavePromptError('保存内容を確認してください。')
      return
    }
    setSavePromptOpen(false)
  }
  const visibleSavedPrompts = effectiveLibraryGroup === 'all'
    ? store.savedPrompts
    : store.savedPrompts.filter(saved => saved.groups.includes(effectiveLibraryGroup))
  const createPromptGroup = () => {
    const group = store.addPromptGroup(nextPromptGroupName(store.promptGroups))
    if (group) {
      setActiveLibraryGroup(group.id)
      setEditingGroupId(group.id)
      setEditingGroupName(group.name)
      setEditingGroupColor(group.color)
    }
  }
  const startGroupEdit = (group: PromptGroup) => {
    if (group.id === UNCLASSIFIED_PROMPT_GROUP_ID) return
    setEditingGroupId(group.id)
    setEditingGroupName(group.name)
    setEditingGroupColor(group.color)
  }
  const finishGroupEdit = (id: string) => {
    store.renamePromptGroup(id, editingGroupName)
    store.setPromptGroupColor(id, editingGroupColor)
    setEditingGroupId(null)
  }
  const applySavedPrompt = (mode: 'replace' | 'merge') => {
    if (!pendingApplyPrompt) return
    const applied = mode === 'replace'
      ? store.restorePrompt(pendingApplyPrompt.id)
      : store.mergeSavedPrompt(pendingApplyPrompt.id)
    if (applied) {
      const nextBlockId = mode === 'replace' ? pendingApplyPrompt.blocks[0]?.id : store.activeBlockId
      if (nextBlockId) setViewContextId(nextBlockId)
      store.setWorkspaceView('prompt')
      setPendingApplyPrompt(null)
    }
  }
  const deleteSavedPrompt = () => {
    if (!pendingDeletePrompt) return
    store.deleteSavedPrompt(pendingDeletePrompt.id)
    if (selectedSavedPrompt?.id === pendingDeletePrompt.id) setSelectedSavedPrompt(null)
    setPendingDeletePrompt(null)
  }
  const clearCurrentPrompt = () => {
    store.clearAll()
    setClearPromptConfirmOpen(false)
  }
  const deletePromptGroup = () => {
    if (!pendingDeleteGroup) return
    const deleted = store.deletePromptGroup(pendingDeleteGroup.id)
    if (deleted && activeLibraryGroup === pendingDeleteGroup.id) setActiveLibraryGroup('all')
    setPendingDeleteGroup(null)
  }

  const warnings = useMemo(() => conflicts(active.tags), [active.tags])
  const related = useMemo(() => relatedTags(active.tags).slice(0, 8), [active.tags])
  const selectedSections = useMemo(() => {
    const group = (key: string, category: string, label: string, items: SelectedTag[], layerId: string, subcategory?: string, excludeSubcategory?: string) => ({ key, category, label, subcategory, items: items.filter(tag => tag.category === category && (!subcategory || tag.subcategory === subcategory) && (!excludeSubcategory || tag.subcategory !== excludeSubcategory)).map(tag => ({ tag, layerId })) })
    const sceneGroup = (key: string, category: string, label: string, subcategory?: string, excludeSubcategory?: string) => group(key, category, label, store.sceneTags, 'scene', subcategory, excludeSubcategory)
    const subjectSection = (block: typeof store.blocks[number]) => ({
      id: block.id,
      name: `${getCategoryLabel('character', locale)} ${block.subjectNumber ?? 1}`,
      kind: 'CHARACTER',
      targetId: block.id,
      groups: [
        ...['people','expression','eyes','hair','body','clothes','accessories','pose'].map(category => group(category, category, getCategoryLabel(category, locale), block.tags, block.id)),
      ],
    })
    const commonSection = { id: 'common', name: 'Common', kind: 'COMMON', targetId: 'scene', groups: [
      sceneGroup('quality', 'quality', t('quality', locale), undefined, 'スタイル'),
      sceneGroup('style', 'quality', t('style', locale), 'スタイル'),
      ...['lighting','camera','background','effects'].map(category => sceneGroup(category, category, getCategoryLabel(category, locale))),
    ] }
    const selected = store.blocks.find(block => block.id === viewContextId) ?? store.blocks[0]
    return selected ? [commonSection, subjectSection(selected)] : [commonSection]
  }, [locale, store.blocks, store.sceneTags, viewContextId])
  async function copyPrompt(target: 'actions' | 'final' = 'actions') {
    const success = await copyText(prompt)
    if (!success) { alert('コピーできませんでした。テキストを選択して手動でコピーしてください。'); return }
    const setCopied = target === 'actions' ? setCopiedPositive : setCopiedFinal
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }
  async function copyNegativePrompt(showFeedback = true) {
    const success = await copyText(store.negative)
    if (!success) { alert('コピーできませんでした。テキストを選択して手動でコピーしてください。'); return }
    if (showFeedback) {
      setCopiedNegative(true)
      setTimeout(() => setCopiedNegative(false), 1400)
    }
  }
  function setContextTarget(targetId:string){
    setViewContextId(targetId)
    store.setActiveBlock(targetId)
  }
  function addCharacter(){
    store.addBlock()
    const addedId = usePromptStore.getState().activeBlockId
    setContextTarget(addedId)
  }
  function chooseCategory(c:string, targetId?:string){
    if (targetId === 'scene' || (!targetId && isSceneCategory(c))) store.setActiveLayer('scene')
    else store.setActiveBlock(targetId ?? viewContextId)
    store.setWorkspaceView('prompt'); setCategory(c); setSubcategory('すべて'); setQuery('')
  }
  function changeContentLevel(level: ContentRating){
    if (level === 'adult' && store.contentLevel !== 'adult') {
      const accepted = confirm('成人向けタグを表示します。成人キャラクター同士の表現にのみ使用し、未成年を示すタグとは併用できません。表示しますか？')
      if (!accepted) return
    }
    store.setContentLevel(level)
  }
  function toggleDictionaryTag(tag: PromptTag){
    const targetSubject = store.blocks.find(block => block.id === viewContextId) ?? activeSubject
    const layerId = isSceneCategory(tag.category) ? 'scene' : targetSubject.id
    const layerTags = layerId === 'scene' ? store.sceneTags : targetSubject.tags
    const selected = layerTags.find(item => item.id === tag.id || item.baseTagId === tag.id || item.prompt === tag.prompt)
    const colorApplicable = activeColorModifier && isColorModifiableCategory(tag.category)
    if (!colorApplicable && selected) { store.removeTagFromLayer(layerId, selected.id); return }
    if (tag.rating === 'adult' && hasMinorMarker(store.blocks.flatMap(b => b.tags))) {
      alert('成人向けタグは、未成年を示すタグと同時に追加できません。')
      return
    }
    if (MINOR_MARKERS.some(marker => tag.prompt.toLowerCase().includes(marker)) && hasAdultTag(store.blocks.flatMap(b => b.tags))) {
      alert('未成年を示すタグは、成人向けタグと同時に追加できません。')
      return
    }
    const conflict = conflictMap.get(tag.id)
    if (conflict?.level === 'hard' && !selected) {
      const accepted = confirm(`競合しています。\n\nそのまま追加しますか？`)
      if (!accepted) return
    }
    if (colorApplicable) {
      const draft = buildColorModifiedTag(tag, activeColorModifier, dictionaryTags)
      const relatedSelections = layerTags.filter(item =>
        item.id === tag.id || item.baseTagId === tag.id || item.prompt === tag.prompt ||
        item.id === draft.baseTagId || item.baseTagId === draft.baseTagId || item.prompt === draft.prompt
      )
      const removeIds = [...new Set(relatedSelections.map(item => item.id))]
      const existing = relatedSelections[0]
      if (relatedSelections.some(item => item.modifiers?.color === activeColorModifier)) {
        removeIds.forEach(id => store.removeTagFromLayer(layerId, id))
        setActiveColorModifier('')
        return
      }
      const derived = buildColorModifiedTag(tag, activeColorModifier, dictionaryTags, existing?.weight ?? 1)
      store.replaceTagInLayer(layerId, removeIds, derived)
      setActiveColorModifier('')
      return
    }
    store.addTag({...tag, weight: 1})
  }
  function addCustom(){ store.addCustomTag(customPrompt, category, saveCustom, customLabel); setCustomPrompt(''); setCustomLabel('') }
  function exportUserDictionary(){
    const blob = new Blob([JSON.stringify(store.userTags, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'sd-prompt-user-dictionary.json'; a.click(); URL.revokeObjectURL(url)
  }
  async function importUserDictionary(file?: File){
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const items = Array.isArray(parsed) ? parsed : parsed.tags
      if (!Array.isArray(items)) throw new Error('配列ではありません')
      const added = store.importUserTags(items)
      alert(`${added}件をユーザー辞書へ追加しました`)
    } catch { alert('JSON形式を読み込めませんでした') }
    if (importRef.current) importRef.current.value = ''
  }
  function addClothing(){
    const parts = [clothingColor, clothingPattern, clothingMaterial, clothingItem].filter(Boolean)
    const prompt = parts.join(' ')
    store.addTag({ id: `composed-clothes-${createId()}`, prompt, label: prompt, category: 'clothes', subcategory: '組み合わせ', weight: 1 })
  }
  function buildHairPrompt(){
    if (!hairAccentColor || hairColorMode === 'solid') return `${hairColor} hair`
    if (hairColorMode === 'two-tone') return `${hairColor} and ${hairAccentColor} two-tone hair`
    if (hairColorMode === 'gradient') return `${hairColor} to ${hairAccentColor} gradient hair`
    if (hairColorMode === 'tips') return `${hairColor} hair with ${hairAccentColor} tips`
    if (hairColorMode === 'inner') return `${hairColor} hair with ${hairAccentColor} inner color`
    return `${hairColor} hair with ${hairAccentColor} highlights`
  }
  function addHairColor(){
    const prompt = buildHairPrompt()
    store.addTag({ id: `composed-hair-${createId()}`, prompt, label: prompt, category: 'hair', subcategory: '髪色・配色', weight: 1 })
  }
  function buildEyePrompt(){
    if (!eyeAccentColor || eyeColorMode === 'solid') return `${eyeColor} eyes`
    if (eyeColorMode === 'heterochromia') return `${eyeColor} and ${eyeAccentColor} heterochromia`
    if (eyeColorMode === 'gradient') return `${eyeColor} to ${eyeAccentColor} gradient eyes`
    if (eyeColorMode === 'inner-ring') return `${eyeColor} eyes with ${eyeAccentColor} inner ring`
    return `${eyeColor} eyes with ${eyeAccentColor} outer ring`
  }
  function addEyeColor(){
    const prompt = buildEyePrompt()
    store.addTag({ id: `composed-eyes-${createId()}`, prompt, label: prompt, category: 'eyes', subcategory: '目の色・配色', weight: 1 })
  }
  function addSkinColor(){
    store.addTag({ id: `composed-skin-${createId()}`, prompt: skinColor, label: skinColor, category: 'body', subcategory: '肌色', weight: 1 })
  }
  function addSceneProp(){
    const position = [propVertical, propHorizontal, propDepth ? `in the ${propDepth}` : ''].filter(Boolean).join(' ')
    const prompt = position ? `${propItem} on the ${position}`.replace('on the in the', 'in the') : propItem
    store.addTag({ id: `composed-prop-${createId()}`, prompt, label: prompt, category: 'scene_props', subcategory: '配置済み', weight: 1 })
  }

  function renderTagCard(tag: PromptTag) {
    const layerTags = isSceneCategory(tag.category) ? selectedLayerTags.scene : selectedLayerTags.subject
    const selectedTag = layerTags.find(item => item.id === tag.id || item.baseTagId === tag.id || item.prompt === tag.prompt)
    const selected = Boolean(selectedTag)
    const appliedColor = selectedTag?.modifiers?.color ? findColorModifier(selectedTag.modifiers.color) : undefined
    const colorNotApplicable = Boolean(activeColorModifier) && !isColorModifiableCategory(tag.category)
    const favorite = store.favoriteIds.includes(tag.id)
    const isUser = 'source' in tag
    const conflict = conflictMap.get(tag.id)
    const unavailable = !selected && conflict?.level === 'hard'
    const warning = !selected && conflict?.level === 'warning'
    const colorAvailability = colorNotApplicable ? '、カラー適用対象外。通常タグとして追加されます' : ''
    const accessibleLabel = `${tag.label}${appliedColor ? `、カラー: ${appliedColor.label}` : ''}${selected ? '、選択済み' : ''}${colorAvailability}`
    return <article key={tag.id} className={`tag-card category-${tag.category} ${selected?'selected':''} ${unavailable?'unavailable':''} ${warning?'warning':''} ${colorNotApplicable?'color-not-applicable':''}`} title={appliedColor || colorNotApplicable ? accessibleLabel : undefined}>
      <button className={`star ${favorite?'active':''}`} aria-label="お気に入り" onClick={()=>store.toggleFavorite(tag.id)}><Star size={15} fill={favorite?'currentColor':'none'}/></button>
      <button className="info-tag" title="タグ詳細" aria-label="タグ詳細" onClick={()=>setInspectedTag(tag)}><Info size={14}/></button>
      {isUser&&<button className="delete-user-tag" title="ユーザー辞書から削除" onClick={()=>store.removeUserTag(tag.id)}><X size={13}/></button>}
      <button className="tag-main" aria-label={accessibleLabel} onClick={()=>toggleDictionaryTag(tag)}>{unavailable&&<span className="conflict-badge"><Ban size={13}/>競合</span>}{warning&&<span className="warning-badge"><AlertTriangle size={13}/>注意</span>}<strong>{tag.label}</strong><span>{selectedTag?.prompt ?? tag.prompt}</span><small>{isUser?'ユーザー辞書 / ':''}{tag.rating==='adult'?'成人向け / ':tag.rating==='suggestive'?'軽度 / ':''}{categoryLabels[tag.category]} / {tag.subcategory}</small></button>
      {appliedColor&&<span className="tag-color-ribbon" style={{ '--modifier-color': appliedColor.swatch } as CSSProperties} aria-hidden="true"/>}
    </article>
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="app-brand"><button type="button" className="navigation-toggle" aria-label={store.navigationCollapsed?'Navigationを展開':'Navigationを最小化'} aria-expanded={!store.navigationCollapsed} onClick={()=>{closeNavigationFlyout();store.setNavigationCollapsed(!store.navigationCollapsed)}}><Menu size={19}/></button><div><h1>SD Prompt Studio <span className="version-mark">v21.0 α1</span></h1><p>Stable Diffusion Prompt IDE · {(TAG_COUNT + ADULT_TAG_COUNT + store.userTags.length).toLocaleString()} tags</p></div></div>
      <div className="header-search"><div className="search-box"><Search size={16}/><input aria-label="タグ検索" value={query} onChange={e=>changeSearchQuery(e.target.value)} placeholder="日本語・英語で検索" />{query.length>0&&<button type="button" className="header-search-clear" aria-label="検索をクリア" onClick={()=>changeSearchQuery('')}><X size={15}/></button>}</div></div>
      <div className="header-actions">
        <div className="settings-wrap" ref={settingsRef}>
          <button type="button" className={`ghost settings-button ${settingsOpen?'active':''}`} aria-label="設定" title="設定" onClick={()=>setSettingsOpen(v=>!v)} aria-expanded={settingsOpen}>
            <Settings2 size={16}/>
            {store.contentLevel!=='general'&&<span className={`rating-dot ${store.contentLevel}`} title={store.contentLevel==='adult'?'成人向け表示中':'軽度なセンシティブ表示中'}/>} 
          </button>
          {settingsOpen&&<div className="settings-popover">
            <div className="settings-popover-head"><div><span className="eyebrow">DISPLAY SETTINGS</span><strong>コンテンツ表示</strong></div><button onClick={()=>setSettingsOpen(false)}><X size={15}/></button></div>
            <div className="theme-setting"><span>テーマ</span><div className="theme-segment" role="group" aria-label="Display theme"><button type="button" aria-pressed={theme==='dark'} className={theme==='dark'?'active':''} onClick={()=>setTheme('dark')}>Dark</button><button type="button" aria-pressed={theme==='light'} className={theme==='light'?'active':''} onClick={()=>setTheme('light')}>Light</button></div></div>
            <label className="settings-field">表示レベル
              <select value={store.contentLevel} onChange={e=>changeContentLevel(e.target.value as ContentRating)}>
                <option value="general">一般のみ</option>
                <option value="suggestive">軽度なセンシティブを含む</option>
                <option value="adult">成人向けを含む</option>
              </select>
            </label>
            <p>{store.contentLevel==='adult'?'成人向けタグを表示中。未成年タグとの同時使用はブロックされます。':store.contentLevel==='suggestive'?'軽度なセンシティブタグを表示中です。':'成人向けタグは非表示です。'}</p>
            <label className="settings-toggle"><input type="checkbox" checked={store.hideUnavailable} onChange={e=>store.setHideUnavailable(e.target.checked)}/><span><b>使用可能なタグだけ表示</b><small>OFFでは競合タグをグレーアウト。検索結果では常に表示します。</small></span></label>
            <section className="settings-dictionary">
              <div className="settings-section-head"><div><span className="eyebrow">USER DICTIONARY</span><strong>ユーザー辞書</strong></div><small>{store.userTags.length}件</small></div>
              <div className="settings-dictionary-actions">
                <button onClick={exportUserDictionary}>辞書を書き出す</button>
                <button onClick={()=>importRef.current?.click()}>辞書を読み込む</button>
                <input ref={importRef} hidden type="file" accept="application/json" onChange={e=>importUserDictionary(e.target.files?.[0])}/>
                {store.userTags.length>0&&<button className="danger" onClick={()=>confirm('ユーザー辞書を空にしますか？')&&store.clearUserTags()}>辞書を空にする</button>}
              </div>
              <div className="settings-custom-form">
                <label>English Tag<input value={customPrompt} onChange={e=>setCustomPrompt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCustom()} placeholder="custom prompt tag" /></label>
                <label>表示名<input value={customLabel} onChange={e=>setCustomLabel(e.target.value)} placeholder="日本語名（任意）" /></label>
                <label className="settings-toggle compact"><input type="checkbox" checked={saveCustom} onChange={e=>setSaveCustom(e.target.checked)}/><span><b>ユーザー辞書へ保存</b></span></label>
                <button className="dictionary-add" onClick={addCustom}><Plus size={14}/>現在のカテゴリへ追加</button>
              </div>
              {store.userTags.length>0&&<div className="settings-user-list">{store.userTags.map(tag=><div key={tag.id}><span><b>{getTagLabel(tag,locale)}</b><code>{tag.prompt}</code></span><button title="削除" onClick={()=>store.removeUserTag(tag.id)}><X size={13}/></button></div>)}</div>}
              <p>追加・削除・Import・Exportをここで管理します。Role metadataは将来の表示拡張用です。</p>
            </section>
          </div>}
        </div>
      </div>
    </header>
    <section className={`workspace ${store.navigationCollapsed?'navigation-collapsed':''}`}>
      <aside className={`sidebar panel navigation-shell ${store.navigationCollapsed?'collapsed':''}`} aria-label="Navigation">
        <div className="navigation-groups">
          <section className={`navigation-group prompt-navigation ${activeNavigationFlyout==='prompt'?'flyout-open':''}`} onMouseEnter={()=>openNavigationFlyoutAfterDelay('prompt')} onMouseLeave={closeNavigationFlyoutAfterDelay} onFocus={()=>{if(store.navigationCollapsed){cancelNavigationTimers();setActiveNavigationFlyout('prompt')}}} onBlur={closeNavigationFlyoutAfterDelay}>
            <button type="button" className={`navigation-primary ${store.workspaceView==='prompt'?'active':''}`} aria-label="プロンプト" aria-current={store.workspaceView==='prompt'?'page':undefined} onClick={navigateToPrompt}><span className="navigation-icon-slot navigation-primary-icon"><Sparkles size={17}/></span><span className="navigation-label">プロンプト</span><span className="navigation-tooltip" role="tooltip">プロンプト</span></button>
            <div className="navigation-children navigation-flyout">
              {store.navigationCollapsed&&<strong>プロンプト</strong>}
              <nav aria-label="プロンプトカテゴリ">{categoryOrder.map(c=>{const CategoryIcon=NAV_CATEGORY_ICONS[c as keyof typeof NAV_CATEGORY_ICONS]??Sparkles;return <button key={c} className={`navigation-item ${category===c&&!isSearchMode&&!favoritesOnly?'active':''}`} onClick={()=>{closeNavigationFlyout();store.setWorkspaceView('prompt');chooseCategory(c)}}><span className="navigation-icon-slot"><CategoryIcon size={15}/></span><span className="navigation-item-label">{getCategoryLabel(c,locale)}</span><small>{visibleDictionaryTags.filter(t=>t.category===c).length}</small></button>})}</nav>
              <div className="preset-box"><label>モデル</label><select value={store.modelPreset} onChange={e=>store.setModelPreset(e.target.value as ModelPreset)}><option value="illustrious">Illustrious / NoobAI</option><option value="pony">Pony</option><option value="sdxl">SDXL汎用</option><option value="custom">カスタム</option></select><button className="preset" onClick={()=>store.applyQualityPreset()}><WandSparkles size={17}/>品質を置き換え</button></div>
            </div>
          </section>
          <section className="navigation-group navigation-analyzer">
            <button type="button" className={`navigation-primary ${analyzerOpen?'active':''}`} aria-label="Prompt解析" aria-current={analyzerOpen?'page':undefined} onClick={()=>{closeNavigationFlyout();setAnalyzerOpen(true)}}><span className="navigation-icon-slot navigation-primary-icon"><BookOpen size={17}/></span><span className="navigation-label">Prompt解析</span><span className="navigation-tooltip" role="tooltip">Prompt解析</span></button>
          </section>
          <section className={`navigation-group ${activeNavigationFlyout==='favorites'?'flyout-open':''}`} onMouseEnter={()=>openNavigationFlyoutAfterDelay('favorites')} onMouseLeave={closeNavigationFlyoutAfterDelay} onFocus={()=>{if(store.navigationCollapsed){cancelNavigationTimers();setActiveNavigationFlyout('favorites')}}} onBlur={closeNavigationFlyoutAfterDelay}>
            <button type="button" className={`navigation-primary ${store.workspaceView==='favorites'?'active':''}`} aria-label="お気に入り" aria-current={store.workspaceView==='favorites'?'page':undefined} onClick={navigateToFavorites}><span className="navigation-icon-slot navigation-primary-icon"><Star size={17}/></span><span className="navigation-label">お気に入り</span><span className="navigation-tooltip" role="tooltip">お気に入り</span></button>
            <div className="navigation-children navigation-flyout compact">
              {store.navigationCollapsed&&<strong>お気に入り</strong>}
              <button className={`navigation-item ${favoritesOnly?'active':''}`} onClick={navigateToFavorites}><span className="navigation-icon-slot"><Tags size={15}/></span><span className="navigation-item-label">タグ</span></button>
              <button className="navigation-item" onClick={navigateToFavorites}><span className="navigation-icon-slot"><MessageSquareText size={15}/></span><span className="navigation-item-label">Prompt</span></button>
            </div>
          </section>
          <section className={`navigation-group ${activeNavigationFlyout==='library'?'flyout-open':''}`} onMouseEnter={()=>openNavigationFlyoutAfterDelay('library')} onMouseLeave={closeNavigationFlyoutAfterDelay} onFocus={()=>{if(store.navigationCollapsed){cancelNavigationTimers();setActiveNavigationFlyout('library')}}} onBlur={closeNavigationFlyoutAfterDelay}>
            <button type="button" className={`navigation-primary ${store.workspaceView==='library'?'active':''}`} aria-label="ライブラリ" aria-current={store.workspaceView==='library'?'page':undefined} onClick={()=>{closeNavigationFlyout();store.setWorkspaceView('library')}}><span className="navigation-icon-slot navigation-primary-icon"><BookOpen size={17}/></span><span className="navigation-label">ライブラリ</span><span className="navigation-tooltip" role="tooltip">ライブラリ</span></button>
            <div className="navigation-children navigation-flyout compact">
              {store.navigationCollapsed&&<strong>ライブラリ</strong>}
              <button className="navigation-item" onClick={()=>{closeNavigationFlyout();store.setWorkspaceView('library')}}><span className="navigation-icon-slot"><Save size={15}/></span><span className="navigation-item-label">Saved Prompt</span></button>
            </div>
          </section>
          <section className="navigation-group navigation-settings">
            <button type="button" className={`navigation-primary ${settingsOpen?'active':''}`} aria-label="設定" aria-current={settingsOpen?'page':undefined} onClick={()=>{closeNavigationFlyout();setSettingsOpen(true)}}><span className="navigation-icon-slot navigation-primary-icon"><Settings2 size={17}/></span><span className="navigation-label">設定</span><span className="navigation-tooltip" role="tooltip">設定</span></button>
          </section>
        </div>
      </aside>

      <section className="tag-panel panel">
        {store.workspaceView==='library'?<div className="library-workspace">
          <section className="category-tabs-section library-tabs-section" aria-label="Prompt Libraryグループ"><nav className="subcategory-tabs library-tabs">
            <button type="button" className={effectiveLibraryGroup==='all'?'active':''} aria-pressed={effectiveLibraryGroup==='all'} onClick={()=>setActiveLibraryGroup('all')}><TabLabel active={effectiveLibraryGroup==='all'} label="すべて"/></button>
            {userPromptGroups.map(group=><div key={group.id} className={`library-group-tab${activeLibraryGroup===group.id?' active':''}`} style={{'--prompt-group-color':group.color} as CSSProperties}>
              {editingGroupId===group.id
                ?<div className="library-group-editor" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node | null))finishGroupEdit(group.id)}}>
                  <input className="library-group-edit" aria-label={`${group.name}の名前を編集`} autoFocus value={editingGroupName} onChange={event=>setEditingGroupName(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')finishGroupEdit(group.id);if(event.key==='Escape')setEditingGroupId(null)}}/>
                  <input className="library-group-color" type="color" aria-label={`${group.name}の色を編集`} value={editingGroupColor} onInput={event=>{const color=event.currentTarget.value;setEditingGroupColor(color);store.setPromptGroupColor(group.id,color)}}/>
                </div>
                :<button type="button" className="library-group-select" aria-pressed={activeLibraryGroup===group.id} title="ダブルクリックで名前と色を編集" onClick={()=>setActiveLibraryGroup(group.id)} onDoubleClick={()=>startGroupEdit(group)}><TabLabel active={activeLibraryGroup===group.id} label={group.name}/></button>}
              <button type="button" className="library-group-delete" aria-label={`${group.name}を削除`} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();setPendingDeleteGroup(group)}} onDoubleClick={event=>event.stopPropagation()}><X size={12}/></button>
            </div>)}
            <button type="button" className="library-add-group" aria-label="グループを追加" onClick={createPromptGroup}><Plus size={15}/></button>
          </nav></section>
          <section className="library-card-list" aria-label="保存済みPrompt一覧">
            {visibleSavedPrompts.length===0?<div className="library-empty"><BookOpen size={22}/><strong>保存済みPromptはありません</strong><span>現在のPromptを保存すると、ここから再利用できます。</span></div>:visibleSavedPrompts.map(saved=>{const selected=selectedSavedPrompt?.id===saved.id;const userGroupIds=saved.groups.filter(id=>id!==UNCLASSIFIED_PROMPT_GROUP_ID);const displayGroupId=effectiveLibraryGroup!=='all'&&userGroupIds.includes(effectiveLibraryGroup)?effectiveLibraryGroup:userGroupIds[0];const groupColor=userPromptGroups.find(group=>group.id===displayGroupId)?.color;return <article className={`saved-prompt-asset${selected?' selected':''}`} key={saved.id} style={{'--prompt-group-color':groupColor} as CSSProperties}>
              <button type="button" className="saved-prompt-asset-main" aria-pressed={selected} onClick={()=>setSelectedSavedPrompt(saved)}>
                <strong>{saved.name}</strong>
                <span className="saved-prompt-summary">{saved.summaryTags.length?saved.summaryTags.join(' / '):'タグなし'}</span>
              </button>
              <div className="saved-prompt-asset-footer">
                <div className="saved-prompt-meta"><span>{saved.displayTags.length} tags</span><time dateTime={new Date(saved.createdAt).toISOString()}>{new Date(saved.createdAt).toLocaleDateString('ja-JP')}</time></div>
                <div className="saved-prompt-asset-actions">
                  <button type="button" className="saved-prompt-apply" aria-label={`${saved.name}を適用`} onClick={()=>setPendingApplyPrompt(saved)}><Check size={15}/>適用</button>
                  <button type="button" className="saved-prompt-delete" aria-label={`${saved.name}を削除`} onClick={()=>setPendingDeletePrompt(saved)}><X size={15}/></button>
                </div>
              </div>
            </article>})}
          </section>
        </div>:<div className="prompt-workspace-content">
        <div className="prompt-controls">
        <div className="prompt-control-bar">
        {isSearchMode&&<section className="category-tabs-section" aria-label="検索結果カテゴリ"><div className="subcategory-tabs">{['すべて',...searchCategories].map(categoryKey=>{const activeCategory=searchCategory===categoryKey;return <button key={categoryKey} className={activeCategory?'active':''} aria-pressed={activeCategory} onClick={()=>setSearchCategory(categoryKey)}><TabLabel active={activeCategory} label={categoryKey==='すべて'?'すべて':getCategoryLabel(categoryKey,locale)}/></button>})}</div></section>}
        {!isSearchMode&&favoritesOnly&&<section className="category-tabs-section" aria-label="お気に入りカテゴリ"><div className="subcategory-tabs">{['すべて',...favoriteCategories].map(categoryKey=>{const activeCategory=favoriteCategory===categoryKey;return <button key={categoryKey} className={activeCategory?'active':''} aria-pressed={activeCategory} onClick={()=>setFavoriteCategory(categoryKey)}><TabLabel active={activeCategory} label={categoryKey==='すべて'?'すべて':getCategoryLabel(categoryKey,locale)}/></button>})}</div></section>}
        {!isSearchMode&&!favoritesOnly&&subcategories.length>0&&<section className="category-tabs-section" aria-label="カテゴリ"><div className="subcategory-tabs">{['すべて',...subcategories].map(sub=>{const activeSub=subcategory===sub;return <button key={sub} className={activeSub?'active':''} aria-pressed={activeSub} onClick={()=>setSubcategory(sub)}><TabLabel active={activeSub} label={sub}/></button>})}</div></section>}
        <section className="color-selector-section" aria-label="Color Selector"><div className="color-modifier-bar" aria-label="Color Modifier">
          <div className="color-modifier-label"><span>COLOR</span><strong>{findColorModifier(activeColorModifier)?.label ?? '指定なし'}</strong></div>
          <div className="color-modifier-swatches">
            <button type="button" className={`color-swatch color-swatch-none ${activeColorModifier?'':'active'}`} title="指定なし" aria-label="カラー指定なし" aria-pressed={!activeColorModifier} onClick={()=>setActiveColorModifier('')}><X size={13}/></button>
            {COLOR_MODIFIERS.map(color=><button key={color.value} type="button" className={`color-swatch ${activeColorModifier===color.value?'active':''}`} style={{ '--swatch-color': color.swatch } as CSSProperties} title={color.label} aria-label={`カラー: ${color.label}`} aria-pressed={activeColorModifier===color.value} onClick={()=>setActiveColorModifier(current=>current===color.value?'':color.value)}>{activeColorModifier===color.value&&<Check size={12}/>}</button>)}
          </div>
        </div></section>
        </div>
        {!favoritesOnly&&['hair','eyes','body','clothes','scene_props'].includes(category)&&<section className={`composer-section ${composerCollapsed?'collapsed':''}`}>
          <button className="composer-toggle" onClick={()=>setComposerCollapsed(v=>!v)} aria-expanded={!composerCollapsed}>
            <span>コンポーザー</span>
            {composerCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}
          </button>
          {!composerCollapsed&&<div className="composer-content">
        {category==='hair'&&<div className="composer-box"><h3>髪色コンポーザー</h3><p>基本色と差し色、配色方法を組み合わせます。髪型や前髪は下の辞書から追加できます。</p><div className="composer-grid"><label>基本色<select value={hairColor} onChange={e=>setHairColor(e.target.value)}>{COLOR_OPTIONS.filter(([v])=>v).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>差し色<select value={hairAccentColor} onChange={e=>setHairAccentColor(e.target.value)}>{COLOR_OPTIONS.map(([value,label])=><option key={value||'none'} value={value}>{label}</option>)}</select></label><label>配色<select value={hairColorMode} onChange={e=>setHairColorMode(e.target.value)}><option value="solid">単色</option><option value="two-tone">ツートン</option><option value="gradient">グラデーション</option><option value="tips">毛先だけ</option><option value="inner">インナーカラー</option><option value="highlights">ハイライト</option></select></label></div><div className="composer-preview">{buildHairPrompt()}</div><button onClick={addHairColor}><Plus size={16}/>この髪色を追加</button></div>}
        {category==='eyes'&&<div className="composer-box"><h3>目の色コンポーザー</h3><p>目の基本色と二色目を合成します。瞳孔や宇宙眼などの内部模様は下の辞書から追加できます。</p><div className="composer-grid"><label>基本色<select value={eyeColor} onChange={e=>setEyeColor(e.target.value)}>{COLOR_OPTIONS.filter(([v])=>v).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>二色目<select value={eyeAccentColor} onChange={e=>setEyeAccentColor(e.target.value)}>{COLOR_OPTIONS.map(([value,label])=><option key={value||'none'} value={value}>{label}</option>)}</select></label><label>配色<select value={eyeColorMode} onChange={e=>setEyeColorMode(e.target.value)}><option value="solid">単色</option><option value="heterochromia">オッドアイ</option><option value="gradient">グラデーション</option><option value="inner-ring">内側リング</option><option value="outer-ring">外側リング</option></select></label></div><div className="composer-preview">{buildEyePrompt()}</div><button onClick={addEyeColor}><Plus size={16}/>この目の色を追加</button></div>}
        {category==='body'&&<div className="composer-box"><h3>肌色コンポーザー</h3><p>肌の色・トーンをひとつのタグとして追加します。</p><div className="composer-grid"><label>肌色<select value={skinColor} onChange={e=>setSkinColor(e.target.value)}>{SKIN_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div><div className="composer-preview">{skinColor}</div><button onClick={addSkinColor}><Plus size={16}/>この肌色を追加</button></div>}
        {category==='clothes'&&<div className="composer-box"><h3>服装コンポーザー</h3><p>色・柄・素材を選び、服名へ合成します。</p><div className="composer-grid"><label>色<select value={clothingColor} onChange={e=>setClothingColor(e.target.value)}><option value="">指定なし</option><option value="black">黒</option><option value="white">白</option><option value="red">赤</option><option value="blue">青</option><option value="green">緑</option><option value="pink">ピンク</option><option value="purple">紫</option><option value="yellow">黄</option><option value="brown">茶</option><option value="navy blue">紺</option><option value="beige">ベージュ</option><option value="gray">グレー</option><option value="gold">金</option><option value="silver">銀</option></select></label><label>柄<select value={clothingPattern} onChange={e=>setClothingPattern(e.target.value)}><option value="">指定なし</option><option value="plaid">チェック</option><option value="striped">ストライプ</option><option value="polka dot">水玉</option><option value="floral print">花柄</option><option value="camouflage">迷彩</option></select></label><label>素材<select value={clothingMaterial} onChange={e=>setClothingMaterial(e.target.value)}><option value="">指定なし</option><option value="denim">デニム</option><option value="leather">レザー</option><option value="silk">シルク</option><option value="satin">サテン</option><option value="lace">レース</option><option value="knit">ニット</option><option value="velvet">ベルベット</option></select></label><label>服<select value={clothingItem} onChange={e=>setClothingItem(e.target.value)}><option value="shirt">シャツ</option><option value="blouse">ブラウス</option><option value="t-shirt">Tシャツ</option><option value="hoodie">パーカー</option><option value="sweater">セーター</option><option value="cardigan">カーディガン</option><option value="jacket">ジャケット</option><option value="coat">コート</option><option value="skirt">スカート</option><option value="pleated skirt">プリーツスカート</option><option value="miniskirt">ミニスカート</option><option value="shorts">ショートパンツ</option><option value="pants">パンツ</option><option value="dress">ドレス</option><option value="one-piece dress">ワンピース</option><option value="serafuku">セーラー服</option><option value="gym uniform">体操服</option><option value="buruma">ブルマ</option><option value="bloomers">ブルーマー</option><option value="track jacket">ジャージ上</option><option value="track pants">ジャージ下</option><option value="leotard">レオタード</option><option value="bunny suit">バニースーツ</option><option value="china dress">チャイナドレス</option><option value="bodysuit">ボディスーツ</option></select></label></div><div className="composer-preview">{[clothingColor,clothingPattern,clothingMaterial,clothingItem].filter(Boolean).join(' ')}</div><button onClick={addClothing}><Plus size={16}/>この服装を追加</button></div>}
        {category==='scene_props'&&<div className="composer-box"><h3>背景小物コンポーザー</h3><p>小物と画面内の位置、奥行きを組み合わせます。</p><div className="composer-grid"><label>小物<select value={propItem} onChange={e=>setPropItem(e.target.value)}><option value="bed">ベッド</option><option value="chair">椅子</option><option value="sofa">ソファ</option><option value="bookshelf">本棚</option><option value="desk">机</option><option value="table">テーブル</option><option value="floor lamp">フロアランプ</option><option value="window">窓</option><option value="potted plant">観葉植物</option><option value="mirror">鏡</option><option value="television">テレビ</option><option value="cabinet">キャビネット</option></select></label><label>左右<select value={propHorizontal} onChange={e=>setPropHorizontal(e.target.value)}><option value="">指定なし</option><option value="left side">左</option><option value="center">中央</option><option value="right side">右</option></select></label><label>上下<select value={propVertical} onChange={e=>setPropVertical(e.target.value)}><option value="">指定なし</option><option value="upper">上</option><option value="middle">中</option><option value="lower">下</option></select></label><label>奥行き<select value={propDepth} onChange={e=>setPropDepth(e.target.value)}><option value="">指定なし</option><option value="foreground">手前</option><option value="midground">中景</option><option value="background">奥</option></select></label></div><div className="composer-preview">{propItem} / {[propVertical,propHorizontal,propDepth].filter(Boolean).join('・')}</div><button onClick={addSceneProp}><Plus size={16}/>配置して追加</button></div>}
          </div>}
        </section>}
        {!isSearchMode&&!favoritesOnly&&!['hair','eyes','body','clothes','scene_props'].includes(category)&&<section className="composer-placeholder" aria-label="Composer"><span>COMPOSER</span></section>}
        </div>
        <section className="tag-list-section" aria-label="タグ一覧">
        {isSearchMode&&<div className="panel-title">
          <div><span className="eyebrow">PROMPT DICTIONARY</span><h2>{`「${query}」の検索結果`}</h2></div>
        </div>}
        {related.length>0&&<section className={`related-suggestions ${relatedCollapsed?'collapsed':''}`}>
          <button className="related-suggestions-toggle" onClick={()=>setRelatedCollapsed(v=>!v)} aria-expanded={!relatedCollapsed}>
            <span><Sparkles size={15}/>関連候補 <small>{related.length}</small></span>
            {relatedCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}
          </button>
          {!relatedCollapsed&&<div className="related-suggestions-list">{related.filter(tag=>RATING_RANK[tag.rating ?? 'general']<=RATING_RANK[store.contentLevel]).map(tag=><button key={tag.id} className={`category-${tag.category}`} onClick={()=>toggleDictionaryTag(tag)}>＋ {tag.label}<small>{tag.prompt}</small></button>)}</div>}
        </section>}
        {favoritesOnly&&filtered.length===0?<div className="tag-empty-state"><Star size={18}/><span>お気に入りタグはありません</span></div>:<div className="tag-groups">{tagCategoryGroups.map(categoryGroup=><section className="tag-category-group" key={categoryGroup.key}>
          {categoryGroup.label&&<h2 className="tag-category-title">{categoryGroup.label}</h2>}
          <div className="tag-subcategory-groups">{categoryGroup.groups.map(group=><section className="tag-group" key={`${categoryGroup.key}-${group.key}`}>
            {group.showTitle&&<h3 className="tag-group-title">{group.label}</h3>}
            <div className="tag-grid tag-group-grid">{group.tags.map(renderTagCard)}</div>
          </section>)}</div>
        </section>)}</div>}
        </section>
        </div>}
      </section>

      <aside className="preview panel">
        {store.workspaceView==='library'?<>
        <div className="inspector-header" aria-label="Saved Prompt Inspector">
          <div className="block-tabs"><button type="button" className="active">{selectedSavedPrompt?.name??'Promptを選択'}</button></div>
          <section className="prompt-actions"><strong>Prompt Actions</strong><button className="copy-positive" onClick={()=>copyPrompt('actions')}>{copiedPositive?<Check size={16}/>:<Copy size={16}/>}<span>{copiedPositive?'コピー済み':'Positiveをコピー'}</span></button><button className="copy-negative" onClick={()=>copyNegativePrompt(true)}>{copiedNegative?<Check size={16}/>:<Copy size={16}/>}<span>{copiedNegative?'コピー済み':'Negativeをコピー'}</span></button><button type="button" className="save-current-prompt" aria-label="Promptを保存" title="Promptを保存" onClick={openSavePrompt}><Save size={16}/></button><button type="button" className="clear-current-prompt" aria-label="Promptをクリア" title="Promptをクリア" onClick={()=>setClearPromptConfirmOpen(true)}><Trash2 size={16}/></button></section>
        </div>
        <div className="inspector-scroll" aria-label="Saved Prompt details">
          {!selectedSavedPrompt?<section className={`preview-section ${selectedCollapsed?'collapsed':''}`}><div className="preview-section-header"><button className="preview-section-toggle" onClick={()=>setSelectedCollapsed(value=>!value)} aria-expanded={!selectedCollapsed}><span>{t('promptContext',locale)}</span>{selectedCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button></div>{!selectedCollapsed&&<div className="preview-section-content"><small className="selected-empty">カードを選択するとPromptの詳細を確認できます。</small></div>}</section>:<>
          <section className={`preview-section ${selectedCollapsed?'collapsed':''}`}>
            <div className="preview-section-header"><button className="preview-section-toggle" onClick={()=>setSelectedCollapsed(value=>!value)} aria-expanded={!selectedCollapsed}>
              <span>{t('promptContext',locale)}</span>{selectedCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}
            </button></div>
            {!selectedCollapsed&&<div className="preview-section-content prompt-context-content"><div className="selected-outline">
              {(()=>{const sectionId='saved-prompt-common';const expanded=expandedSections[sectionId]??true;const contentId=`prompt-context-section-${sectionId}`;return <section className={`selected-layer context-common interactive ${expanded?'expanded':'collapsed'}`}>
                <div className="selected-layer-header"><button type="button" className="selected-layer-title selected-layer-toggle" aria-expanded={expanded} aria-controls={contentId} onClick={()=>setExpandedSections(current=>({...current,[sectionId]:!expanded}))}>
                  {expanded?<ChevronDown className="section-chevron" size={14}/>:<ChevronRight className="section-chevron" size={14}/>}<strong>Common</strong><small className="section-tag-count">{selectedSavedPrompt.structure.sceneTags.length} tags</small>
                </button></div>
                {expanded&&<div className="selected-layer-content" id={contentId}>{categoryOrder.flatMap(categoryKey=>{const items=selectedSavedPrompt.structure.sceneTags.filter(tag=>tag.category===categoryKey);return items.length?[<section className="selected-group" key={`saved-scene-${categoryKey}`}><div className="selected-group-head"><button type="button"><strong>{getCategoryLabel(categoryKey,locale)} <small>({items.length})</small></strong></button></div><div className="selected-chips">{items.map(tag=><div className={`selected-chip category-${tag.category}`} key={`saved-scene-${tag.id}`} title={tag.prompt}><button type="button" className="chip-label" onClick={()=>{const source=visibleDictionaryTags.find(item=>item.id===tag.id);if(source)setInspectedTag(source)}}>{getTagLabel(tag,locale)}</button>{tag.weight!==1&&<span className="chip-weight">{tag.weight.toFixed(1)}</span>}</div>)}</div></section>]:[]})}</div>}
              </section>})()}
              {selectedSavedPrompt.structure.blocks.map((block,index)=>{const sectionId=`saved-prompt-${block.id}`;const expanded=expandedSections[sectionId]??true;const contentId=`prompt-context-section-${sectionId}`;return <section className={`selected-layer context-character interactive ${expanded?'expanded':'collapsed'}`} key={block.id}>
                <div className="selected-layer-header"><button type="button" className="selected-layer-title selected-layer-toggle" aria-expanded={expanded} aria-controls={contentId} onClick={()=>setExpandedSections(current=>({...current,[sectionId]:!expanded}))}>
                  {expanded?<ChevronDown className="section-chevron" size={14}/>:<ChevronRight className="section-chevron" size={14}/>}<strong>{getCategoryLabel('character',locale)} {block.subjectNumber??index+1}</strong><small className="section-tag-count">{block.tags.length} tags</small>
                </button></div>
                {expanded&&<div className="selected-layer-content" id={contentId}>{categoryOrder.flatMap(categoryKey=>{const items=block.tags.filter(tag=>tag.category===categoryKey);return items.length?[<section className="selected-group" key={`${block.id}-${categoryKey}`}><div className="selected-group-head"><button type="button"><strong>{getCategoryLabel(categoryKey,locale)} <small>({items.length})</small></strong></button></div><div className="selected-chips">{items.map(tag=><div className={`selected-chip category-${tag.category}`} key={`${block.id}-${tag.id}`} title={tag.prompt}><button type="button" className="chip-label" onClick={()=>{const source=visibleDictionaryTags.find(item=>item.id===tag.id);if(source)setInspectedTag(source)}}>{getTagLabel(tag,locale)}</button>{tag.weight!==1&&<span className="chip-weight">{tag.weight.toFixed(1)}</span>}</div>)}</div></section>]:[]})}</div>}
              </section>})}
            </div></div>}
          </section>
          <section className={`preview-section expansion-preview ${expansionCollapsed?'collapsed':''}`}><div className="preview-section-header"><button className="preview-section-toggle" title="Expansion Preview" onClick={()=>setExpansionCollapsed(value=>!value)} aria-expanded={!expansionCollapsed}><span>Generated Prompt Structure</span>{expansionCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button></div>{!expansionCollapsed&&<div className="preview-section-content expansion-entities"><small>{selectedSavedPrompt.settings.modelPreset} / Seeds: {selectedSavedPrompt.settings.seeds.map(seed=>seed.value).join(', ')||'未設定'} / {selectedSavedPrompt.structure.blocks.length} subject(s)</small>{selectedSavedPrompt.structure.blocks.map((block,index)=><section key={block.id}><strong>{block.name||`${getCategoryLabel('character',locale)} ${block.subjectNumber??index+1}`} · {block.position??'center'}</strong><pre>{block.tags.map(tag=>tag.prompt).join(', ')}</pre></section>)}</div>}</section>
          <section className={`preview-section output-box ${promptCollapsed?'collapsed':''}`}><div className="preview-section-header"><button className="preview-section-toggle" onClick={()=>setPromptCollapsed(value=>!value)} aria-expanded={!promptCollapsed}><span>Final Prompt</span>{promptCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button></div>{!promptCollapsed&&<div className="preview-section-content"><textarea readOnly value={selectedSavedPrompt.generatedPrompt}/></div>}</section>
          <section className={`preview-section output-box negative ${negativeCollapsed?'collapsed':''}`}><div className="preview-section-header"><button className="preview-section-toggle" onClick={()=>setNegativeCollapsed(value=>!value)} aria-expanded={!negativeCollapsed}><span>Negative Prompt</span>{negativeCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button></div>{!negativeCollapsed&&<div className="preview-section-content"><textarea readOnly value={selectedSavedPrompt.negativePrompt}/></div>}</section>
          </>}
        </div>
        </>:<>
        <div className="inspector-header" aria-label="Inspector controls">
          <div className="block-tabs">{store.blocks.map((b,index)=><button key={b.id} className={viewContextId===b.id?'active':''} onClick={()=>setContextTarget(b.id)}>{getCategoryLabel('character',locale)} {b.subjectNumber??index+1}{index>0&&<X size={13} onClick={e=>{e.stopPropagation();if(viewContextId===b.id&&mainSubjectId)setContextTarget(mainSubjectId);store.removeBlock(b.id)}}/>}</button>)}<button className="add-block" onClick={addCharacter}><Plus size={16}/>{t('addSubject',locale)}</button></div>
          <section className="prompt-actions"><strong>Prompt Actions</strong><button className="copy-positive" onClick={()=>copyPrompt('actions')}>{copiedPositive?<Check size={16}/>:<Copy size={16}/>}<span>{copiedPositive?'コピー済み':'Positiveをコピー'}</span></button><button className="copy-negative" onClick={()=>copyNegativePrompt(true)}>{copiedNegative?<Check size={16}/>:<Copy size={16}/>}<span>{copiedNegative?'コピー済み':'Negativeをコピー'}</span></button><button type="button" className="save-current-prompt" aria-label="Promptを保存" title="Promptを保存" onClick={openSavePrompt}><Save size={16}/></button><button type="button" className="clear-current-prompt" aria-label="Promptをクリア" title="Promptをクリア" onClick={()=>setClearPromptConfirmOpen(true)}><Trash2 size={16}/></button></section>
        </div>
        <div className="inspector-scroll" aria-label="Inspector details">
        <section className={`preview-section ${selectedCollapsed?'collapsed':''}`}>
          <div className="preview-section-header"><button className="preview-section-toggle" onClick={()=>setSelectedCollapsed(v=>!v)} aria-expanded={!selectedCollapsed}>
            <span>{t('promptContext',locale)}</span>{selectedCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}
          </button></div>
          {!selectedCollapsed&&<div className="preview-section-content prompt-context-content">
            <div className="selected-outline">
              {selectedSections.map(section=>{
                const defaultExpanded = section.targetId === 'scene' || section.targetId === viewContextId
                const expanded = expandedSections[section.id] ?? defaultExpanded
                const contentId = `prompt-context-section-${section.id}`
                const tagCount = section.groups.reduce((total, entry) => total + entry.items.length, 0)
                return <section className={`selected-layer context-${section.kind.toLowerCase()} interactive ${expanded?'expanded':'collapsed'}`} key={section.id}>
                  <div className="selected-layer-header">
                    <button type="button" className="selected-layer-title selected-layer-toggle" aria-expanded={expanded} aria-controls={contentId} onClick={()=>setExpandedSections(current=>({...current,[section.id]:!expanded}))}>
                      {expanded?<ChevronDown className="section-chevron" size={14}/>:<ChevronRight className="section-chevron" size={14}/>}
                      <strong>{section.name}</strong>
                      <small className="section-tag-count">{tagCount} tags</small>
                    </button>
                  </div>
                  {expanded&&<div className="selected-layer-content" id={contentId}>{store.blocks.length>1&&section.targetId!=='scene'&&<div className="context-character-metadata"><label className="context-position-inline" onClick={event=>event.stopPropagation()}><span>配置</span><select aria-label="配置" value={store.blocks.find(block=>block.id===section.targetId)?.position??'center'} onClick={event=>event.stopPropagation()} onChange={event=>store.setSubjectPosition(section.targetId,event.target.value as 'left'|'center'|'right')}><option value="left">左側</option><option value="center">中央</option><option value="right">右側</option></select></label></div>}{section.groups.map(entry=><section className="selected-group" key={entry.key} onClick={()=>{chooseCategory(entry.category,section.targetId);if(entry.subcategory)setSubcategory(entry.subcategory)}}>
                    <div className="selected-group-head"><button><strong>{entry.label} <small>({entry.items.length})</small></strong></button></div>
                    <div className="selected-chips">{entry.items.length===0?<small className="selected-empty">{t('unselected',locale)}</small>:entry.items.sort((a,b)=>tagSort(a.tag,b.tag)).map(({tag,layerId})=><div className={`selected-chip category-${tag.category}`} key={`${layerId}-${tag.id}`} title={`${tag.prompt}${tag.weight!==1?` / 重み ${tag.weight.toFixed(1)}`:''}`}>
                      <button className="chip-label" onClick={event=>{event.stopPropagation();const source=visibleDictionaryTags.find(t=>t.id===tag.id);if(source)setInspectedTag(source)}}>{getTagLabel(tag,locale)}</button>
                      {tag.weight!==1&&<span className="chip-weight">{tag.weight.toFixed(1)}</span>}
                      <button className="chip-remove" aria-label={`${tag.label}を削除`} onClick={event=>{event.stopPropagation();store.removeTagFromLayer(layerId, tag.id)}}><X size={12}/></button>
                    </div>)}</div>
                  </section>)}</div>}
                </section>
              })}
            </div>
          </div>}
        </section>
        <section className={`preview-section expansion-preview ${expansionCollapsed?'collapsed':''}`}>
          <div className="preview-section-header"><button className="preview-section-toggle" title="Expansion Preview" onClick={()=>setExpansionCollapsed(value=>!value)} aria-expanded={!expansionCollapsed}><span>Generated Prompt Structure</span>{expansionCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button></div>
          {!expansionCollapsed&&<div className="preview-section-content expansion-entities"><small>{expansion.strategy} / {expansion.scene.subject_count} subject(s)</small>{expansion.characters.map(character=><section key={character.id}><strong>{character.name} · {character.position}</strong><pre>{character.output}</pre></section>)}</div>}
        </section>
        <section className={`preview-section output-box ${promptCollapsed?'collapsed':''}`}>
          <div className="preview-section-header"><button className="preview-section-toggle" onClick={()=>setPromptCollapsed(v=>!v)} aria-expanded={!promptCollapsed}><span>Final Prompt</span>{promptCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button></div>
          {!promptCollapsed&&<div className="preview-section-content"><textarea readOnly value={prompt}/></div>}
        </section>
        <section className={`preview-section output-box negative ${negativeCollapsed?'collapsed':''}`}>
          <div className="preview-section-header"><button className="preview-section-toggle" onClick={()=>setNegativeCollapsed(v=>!v)} aria-expanded={!negativeCollapsed}><span>Negative Prompt</span>{negativeCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button></div>
          {!negativeCollapsed&&<div className="preview-section-content"><textarea value={store.negative} onChange={e=>store.setNegative(e.target.value)} /><div className="preview-section-footer"><button className="preview-content-action" onClick={store.resetNegative}><RotateCcw size={14}/>初期値に戻す</button></div></div>}
        </section>
        </div>
        </>}
      </aside>
    </section>
    {savePromptOpen&&<div className="modal-backdrop" onMouseDown={()=>setSavePromptOpen(false)}><section className="prompt-save-modal" onMouseDown={event=>event.stopPropagation()}>
      <div className="analyzer-head"><div><span className="eyebrow">PROMPT LIBRARY</span><h2>現在の編集状態を保存</h2></div><button aria-label="保存画面を閉じる" onClick={()=>setSavePromptOpen(false)}><X size={18}/></button></div>
      <label className="prompt-save-name">名前<input value={savePromptName} onChange={event=>setSavePromptName(event.target.value)} placeholder="例: Cyber Witch"/></label>
      {userPromptGroups.length>0&&<fieldset className="prompt-save-groups"><legend>グループ</legend>{userPromptGroups.map(group=><label key={group.id}><input type="checkbox" checked={savePromptGroups.includes(group.id)} onChange={()=>setSavePromptGroups(current=>current.includes(group.id)?current.filter(id=>id!==group.id):[...current,group.id])}/><span className="prompt-group-option" style={{'--prompt-group-color':group.color} as CSSProperties}>{group.name}</span></label>)}</fieldset>}
      <p className="prompt-save-group-note">グループ未選択時はすべてにのみ表示されます</p>
      <div className="prompt-save-seeds"><strong>Seed <small>（任意）</small></strong>{seedInputs.map((value,index)=><div className="prompt-save-seed-row" key={index}><input inputMode="numeric" aria-label={`Seed ${index+1}`} value={value} onChange={event=>{const next=event.target.value.replace(/\D/g,'');setSeedInputs(current=>current.map((item,i)=>i===index?next:item));setSavePromptError('')}} placeholder="123456789"/><button type="button" onClick={()=>setSeedInputs(current=>current.filter((_,i)=>i!==index))}>削除</button></div>)}<button type="button" className="prompt-add-seed" onClick={()=>setSeedInputs(current=>[...current,''])}><Plus size={14}/>Seed追加</button></div>
      {savePromptError&&<p className="prompt-save-error" role="alert">{savePromptError}</p>}
      <div className="modal-actions"><button className="ghost" onClick={()=>setSavePromptOpen(false)}>キャンセル</button><button onClick={submitSavedPrompt}>保存</button></div>
    </section></div>}
    {pendingDeleteGroup&&<div className="modal-backdrop" onMouseDown={()=>setPendingDeleteGroup(null)}><section className="library-dialog delete-prompt-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-prompt-group-title" onMouseDown={event=>event.stopPropagation()}>
      <div className="analyzer-head"><div><span className="eyebrow">DELETE GROUP</span><h2 id="delete-prompt-group-title">グループを削除しますか？</h2></div><button aria-label="閉じる" onClick={()=>setPendingDeleteGroup(null)}><X size={18}/></button></div>
      <p><strong>{pendingDeleteGroup.name}</strong></p><p>保存Prompt自体は削除されません。</p>
      <div className="modal-actions"><button className="ghost" onClick={()=>setPendingDeleteGroup(null)}>キャンセル</button><button className="danger" onClick={deletePromptGroup}>削除</button></div>
    </section></div>}
    {pendingApplyPrompt&&<div className="modal-backdrop" onMouseDown={()=>setPendingApplyPrompt(null)}><section className="library-dialog apply-prompt-dialog" role="dialog" aria-modal="true" aria-labelledby="apply-prompt-title" onMouseDown={event=>event.stopPropagation()}>
      <div className="analyzer-head"><div><span className="eyebrow">APPLY PROMPT</span><h2 id="apply-prompt-title">このPromptを適用しますか？</h2></div><button aria-label="閉じる" onClick={()=>setPendingApplyPrompt(null)}><X size={18}/></button></div>
      <p><strong>{pendingApplyPrompt.name}</strong></p><p>現在のPrompt: {store.sceneTags.length+store.blocks.reduce((total,block)=>total+block.tags.length,0)} tags</p>
      <div className="apply-prompt-options"><button onClick={()=>applySavedPrompt('replace')}><strong>上書き</strong><span>現在のPromptを置き換えます。</span></button><button onClick={()=>applySavedPrompt('merge')}><strong>追加</strong><span>現在のPromptへ単純マージします。</span></button></div>
      <div className="modal-actions"><button className="ghost" onClick={()=>setPendingApplyPrompt(null)}>キャンセル</button></div>
    </section></div>}
    {pendingDeletePrompt&&<div className="modal-backdrop" onMouseDown={()=>setPendingDeletePrompt(null)}><section className="library-dialog delete-prompt-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-prompt-title" onMouseDown={event=>event.stopPropagation()}>
      <div className="analyzer-head"><div><span className="eyebrow">DELETE PROMPT</span><h2 id="delete-prompt-title">Saved Promptを削除しますか？</h2></div><button aria-label="閉じる" onClick={()=>setPendingDeletePrompt(null)}><X size={18}/></button></div>
      <p><strong>{pendingDeletePrompt.name}</strong></p><p>この操作は取り消せません。</p>
      <div className="modal-actions"><button className="ghost" onClick={()=>setPendingDeletePrompt(null)}>キャンセル</button><button className="danger" onClick={deleteSavedPrompt}>削除</button></div>
    </section></div>}
    {clearPromptConfirmOpen&&<div className="modal-backdrop" onMouseDown={()=>setClearPromptConfirmOpen(false)}><section className="library-dialog delete-prompt-dialog clear-prompt-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-prompt-title" onMouseDown={event=>event.stopPropagation()}>
      <div className="analyzer-head"><div><span className="eyebrow">CLEAR PROMPT</span><h2 id="clear-prompt-title">現在のPromptをすべてクリアしますか？</h2></div><button aria-label="閉じる" onClick={()=>setClearPromptConfirmOpen(false)}><X size={18}/></button></div>
      <p>編集中のPromptだけをクリアします。Saved Prompt、お気に入り、Library Groupは削除されません。</p>
      <div className="modal-actions"><button className="ghost" onClick={()=>setClearPromptConfirmOpen(false)}>キャンセル</button><button className="danger" onClick={clearCurrentPrompt}>クリア</button></div>
    </section></div>}
    {inspectedTag&&<div className="modal-backdrop" onMouseDown={()=>setInspectedTag(null)}><section className="tag-detail-modal" onMouseDown={e=>e.stopPropagation()}><div className="analyzer-head"><div><span className="eyebrow">TAG INTELLIGENCE</span><h2>{inspectedTag.label}</h2><code>{inspectedTag.prompt}</code></div><button onClick={()=>setInspectedTag(null)}><X size={18}/></button></div>{categoryGuides[inspectedTag.category]&&<div className={`category-guide category-guide-${inspectedTag.category}`}><strong>{categoryGuides[inspectedTag.category].title}</strong><p>{categoryGuides[inspectedTag.category].text}</p></div>}{generationNote(inspectedTag)&&<><strong className="mini-title">生成メモ</strong><p>{generationNote(inspectedTag)}</p></>}<dl><div><dt>分類</dt><dd>{categoryLabels[inspectedTag.category]} / {inspectedTag.subcategory || '未分類'}</dd></div><div><dt>表示区分</dt><dd>{inspectedTag.rating || 'general'}</dd></div></dl><strong className="mini-title">モデル記法の目安</strong><div className="model-hints">{modelHints(inspectedTag).map(h=><span key={h.model} className={`model-hint ${h.level}`}><b>{h.model}</b>{compatibilityLabel(h.level)}<small>{h.note}</small></span>)}</div>{(inspectedTag.related?.length??0)>0&&<><strong className="mini-title">関連タグ</strong><div className="inspector-related">{inspectedTag.related!.map(x=><button key={x} onClick={()=>{const found=visibleDictionaryTags.find(t=>t.prompt===x);if(found)toggleDictionaryTag(found)}}>{x}</button>)}</div></>}</section></div>}
    {analyzerOpen&&<div className="modal-backdrop" onMouseDown={()=>setAnalyzerOpen(false)}><section className="analyzer-modal" onMouseDown={e=>e.stopPropagation()}><div className="analyzer-head"><div><span className="eyebrow">PROMPT ANALYZER</span><h2>既存プロンプトをGUIへ取り込む</h2></div><button onClick={()=>setAnalyzerOpen(false)}><X size={18}/></button></div><p>カンマ、改行、角括弧、BREAKを解析し、辞書一致またはキーワード推定でカテゴリ分けします。</p><textarea value={analyzerText} onChange={e=>setAnalyzerText(e.target.value)} placeholder="masterpiece, 1girl, blue hair, ..."/><div className="analyzer-preview">{analyzerText.split(/,|\n|BREAK/i).map(x=>x.trim().replace(/^\[|\]$/g,'')).filter(Boolean).slice(0,80).map((raw,i)=>{const clean=raw.replace(/^\((.*):[\d.]+\)$/,'$1').trim();const found=inferCategory(clean,visibleDictionaryTags);const cat=found?.category||heuristicCategory(clean);return <span key={`${raw}-${i}`}><b>{categoryLabels[cat]||cat}</b>{clean}{found?'':'（推定）'}</span>})}</div><div className="modal-actions"><button className="ghost" onClick={()=>setAnalyzerText('')}>クリア</button><button onClick={()=>{const entries=analyzerText.split(/,|\n|BREAK/i).map(x=>x.trim().replace(/^\[|\]$/g,'')).filter(Boolean);entries.forEach(raw=>{const m=raw.match(/^\((.*):([\d.]+)\)$/);const clean=(m?.[1]||raw).trim();const found=inferCategory(clean,visibleDictionaryTags);const cat=found?.category||heuristicCategory(clean);store.addTag({...found,id:found?.id||`analyzed-${createId()}`,prompt:found?.prompt||clean,label:found?.label||clean,category:cat,subcategory:found?.subcategory||'解析・自由タグ',weight:m?Number(m[2]):1})});setAnalyzerOpen(false)}}><BookOpen size={16}/>解析結果を追加</button></div></section></div>}
  </main>
}
