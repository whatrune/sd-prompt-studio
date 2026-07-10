import { adultTags } from './data/adultTags'
import { categoryOrder, subcategoryOrder, tags, type PromptTag } from './data/tags'
import type { PromptBlock, SelectedTag } from './store'

const bodyCategoryOrder = ['character', 'body', 'expression', 'eyes', 'hair', 'clothes', 'accessories']
const legacyClothingSubcategoryOrder = ['トップス', 'アウター', 'ボトムス', 'ワンピース・ドレス', 'カジュアル', 'フォーマル', 'ゴシック・ロリータ', '制服・学校', '制服・職業', 'ミリタリー・ワーク', 'スポーツ・ダンス', '舞台・アイドル', 'コスチューム', 'ファンタジー・SF', '民族・歴史', '和装', 'ルームウェア', '水着・下着', 'センシティブ衣装', 'デザイン・ディテール', '素材・質感', '柄・装飾', 'レッグウェア', '靴', '衣装（アダルト）']

function formatTag(prompt: string, weight: number) {
  return weight === 1 ? prompt : `(${prompt}:${weight.toFixed(1)})`
}

function uniqueTags(items: SelectedTag[]) {
  return [...new Map(items.map(item => [item.prompt, item])).values()]
}

export function tagSort(a: SelectedTag | PromptTag, b: SelectedTag | PromptTag) {
  const categoryDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
  if (categoryDiff !== 0) return categoryDiff
  const order = a.category === 'clothes' ? legacyClothingSubcategoryOrder : subcategoryOrder[a.category] ?? []
  const aSubcategory = a.category === 'clothes' ? a.sortSubcategory ?? a.subcategory : a.subcategory
  const bSubcategory = b.category === 'clothes' ? b.sortSubcategory ?? b.subcategory : b.subcategory
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
  const quality = allTags.filter(tag => tag.category === 'quality')
  const people = allTags.filter(tag => tag.category === 'people')
  const cameraBackground = allTags.filter(tag => ['camera', 'background', 'scene_props'].includes(tag.category))
  const lightingEffects = allTags.filter(tag => ['lighting', 'effects'].includes(tag.category))
  const subjects = blocks.flatMap(block => {
    const body = block.tags.filter(tag => bodyCategoryOrder.includes(tag.category))
    const pose = block.tags.filter(tag => tag.category === 'pose')
    if (!body.length && !pose.length) return []
    return [bracket(body), bracket(pose)]
  })
  const sections = [bracket(quality), bracket(people)]
  if (subjects.length) sections.push(subjects.join('\n\nBREAK\n\n'))
  else sections.push('[]', '[]')
  sections.push(bracket(cameraBackground), 'BREAK', bracket(lightingEffects))
  return sections.join('\n\n')
}
