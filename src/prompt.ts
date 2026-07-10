import { adultTags } from './data/adultTags'
import { categoryOrder, subcategoryOrder, tags, type PromptTag } from './data/tags'
import type { PromptBlock, SelectedTag } from './store'

const bodyCategoryOrder = ['character', 'body', 'expression', 'eyes', 'hair', 'clothes', 'accessories']

function formatTag(prompt: string, weight: number) {
  return weight === 1 ? prompt : `(${prompt}:${weight.toFixed(1)})`
}

function uniqueTags(items: SelectedTag[]) {
  return [...new Map(items.map(item => [item.prompt, item])).values()]
}

export function tagSort(a: SelectedTag | PromptTag, b: SelectedTag | PromptTag) {
  const categoryDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
  if (categoryDiff !== 0) return categoryDiff
  const order = subcategoryOrder[a.category] ?? []
  const subDiff = order.indexOf(a.subcategory ?? '') - order.indexOf(b.subcategory ?? '')
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
