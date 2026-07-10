import { adultTags } from './data/adultTags'
import { categoryOrder, subcategoryOrder, tags, type PromptTag } from './data/tags'
import type { PromptBlock, SelectedTag } from './store'

const bodyCategoryOrder = ['character', 'body', 'expression', 'eyes', 'hair', 'clothes', 'accessories']
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

export function buildPrompt(blocks: PromptBlock[]) {
  const allTags = blocks.flatMap(block => block.tags)
  const quality = allTags.filter(tag => outputCategory(tag) === 'quality')
  const people = allTags.filter(tag => outputCategory(tag) === 'people')
  const cameraBackground = allTags.filter(tag => ['camera', 'background', 'scene_props'].includes(outputCategory(tag)))
  const lightingEffects = allTags.filter(tag => ['lighting', 'effects'].includes(outputCategory(tag)))
  const subjects = blocks.flatMap(block => {
    const body = block.tags.filter(tag => bodyCategoryOrder.includes(outputCategory(tag)))
    const pose = block.tags.filter(tag => outputCategory(tag) === 'pose')
    if (!body.length && !pose.length) return []
    return [bracket(body), bracket(pose)]
  })
  const sections = [bracket(quality), bracket(people)]
  if (subjects.length) sections.push(subjects.join('\n\nBREAK\n\n'))
  else sections.push('[]', '[]')
  sections.push(bracket(cameraBackground), 'BREAK', bracket(lightingEffects))
  return sections.join('\n\n')
}
