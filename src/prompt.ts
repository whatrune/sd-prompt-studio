import { adultTags } from './data/adultTags'
import { categoryOrder, subcategoryOrder, tags, type PromptTag } from './data/tags'
import type { PromptBlock, SelectedTag } from './store'
import { expandPrompt } from './promptExpansion'
import type { ModelPreset } from './store'

const legacyClothingSubcategoryOrder = ['トップス', 'アウター', 'ボトムス', 'ワンピース・ドレス', 'カジュアル', 'フォーマル', 'ゴシック・ロリータ', '制服・学校', '制服・職業', 'ミリタリー・ワーク', 'スポーツ・ダンス', '舞台・アイドル', 'コスチューム', 'ファンタジー・SF', '民族・歴史', '和装', 'ルームウェア', '水着・下着', 'センシティブ衣装', 'デザイン・ディテール', '素材・質感', '柄・装飾', 'レッグウェア', '靴', '衣装（アダルト）']
const legacyCharacterSubcategoryOrder = ['指定', '種族', '種族特徴', '職業', '属性']
const legacyPoseSubcategoryOrder = ['基本姿勢', '手・腕', '頭・上半身', '脚・開脚', '日常動作', '落下・バランス', '体操・アクロバット', 'ダンス', 'スポーツ', '武術・戦闘', '乗り物・騎乗', 'ポーズ（アダルト）', '行動（アダルト）']
const outputCategory = (tag: SelectedTag | PromptTag) => tag.outputCategory ?? tag.category

function formatTag(prompt: string, weight: number) {
  return weight === 1 ? prompt : `(${prompt}:${weight.toFixed(1)})`
}

function uniqueTags(items: SelectedTag[]) {
  return [...new Map(items.map(item => [item.prompt, item])).values()]
}

export function tagSort(a: SelectedTag | PromptTag, b: SelectedTag | PromptTag) {
  const aCategory = outputCategory(a)
  const bCategory = outputCategory(b)
  const categoryDiff = categoryOrder.indexOf(aCategory) - categoryOrder.indexOf(bCategory)
  if (categoryDiff !== 0) return categoryDiff
  const aGroup = a.promptGroup ?? aCategory
  const bGroup = b.promptGroup ?? bCategory
  if (aGroup === bGroup && a.promptOrder !== undefined && b.promptOrder !== undefined) {
    const promptOrderDiff = a.promptOrder - b.promptOrder
    if (promptOrderDiff !== 0) return promptOrderDiff
  }
  const order = aCategory === 'clothes' ? legacyClothingSubcategoryOrder : aCategory === 'character' ? legacyCharacterSubcategoryOrder : aCategory === 'pose' ? legacyPoseSubcategoryOrder : subcategoryOrder[aCategory] ?? []
  const usesLegacyOrder = aCategory === 'clothes' || aCategory === 'character' || aCategory === 'pose'
  const aSubcategory = usesLegacyOrder ? a.sortSubcategory ?? a.subcategory : a.subcategory
  const bSubcategory = usesLegacyOrder ? b.sortSubcategory ?? b.subcategory : b.subcategory
  const sortIndex = (subcategory?: string) => {
    const index = order.indexOf(subcategory ?? '')
    return index === -1 ? order.length : index
  }
  const subDiff = sortIndex(aSubcategory) - sortIndex(bSubcategory)
  if (subDiff !== 0) return subDiff
  const all = [...tags, ...adultTags]
  return all.findIndex(t => t.id === a.id) - all.findIndex(t => t.id === b.id)
}

function bracket(items: SelectedTag[]) {
  return `[${uniqueTags(items).sort(tagSort).map(t => formatTag(t.prompt, t.weight)).join(', ')}]`
}

export function buildPrompt(blocks: PromptBlock[], sceneTags: SelectedTag[] = []) {
  return buildPromptWithStrategy(blocks, sceneTags).prompt
}

export function buildPromptWithStrategy(blocks: PromptBlock[], sceneTags: SelectedTag[] = [], strategy: ModelPreset = 'illustrious', subjectBreak = 'BREAK') {
  return expandPrompt(blocks, sceneTags, { strategy, subjectBreak, outputCategory, renderTags: bracket })
}
