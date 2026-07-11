import type { ModelPreset, PromptBlock, SelectedTag, SubjectPosition } from './store'

export type ExpandedCharacter = { id: string; name: string; position: SubjectPosition; body: SelectedTag[]; pose: SelectedTag[]; output: string }
export type ExpandedScene = { subject_count: number; interaction: SelectedTag[]; composition: SelectedTag[]; tags: SelectedTag[] }
export type ExpansionResult = { prompt: string; characters: ExpandedCharacter[]; scene: ExpandedScene; strategy: ModelPreset }

type ExpansionOptions = {
  strategy: ModelPreset
  subjectBreak?: string
  sceneBreak?: string
  outputCategory: (tag: SelectedTag) => string
  renderTags: (tags: SelectedTag[]) => string
}

const positionLabel: Record<SubjectPosition, string> = { left: 'Left side:', right: 'Right side:', center: 'Center:' }

export function expandPrompt(blocks: PromptBlock[], sceneTags: SelectedTag[], options: ExpansionOptions): ExpansionResult {
  const subjectBreak = options.subjectBreak ?? 'BREAK'
  const sceneBreak = options.sceneBreak ?? 'BREAK'
  const sceneCategories = new Set(['quality', 'camera', 'background', 'scene_props', 'lighting', 'effects'])
  const subjectTags = blocks.flatMap(block => block.tags)
  const effectiveScene = [...new Map([...sceneTags, ...subjectTags.filter(tag => sceneCategories.has(options.outputCategory(tag)))].map(tag => [tag.id, tag])).values()]
  const quality = effectiveScene.filter(tag => options.outputCategory(tag) === 'quality')
  const people = subjectTags.filter(tag => options.outputCategory(tag) === 'people')
  const composition = effectiveScene.filter(tag => ['camera', 'background', 'scene_props'].includes(options.outputCategory(tag)))
  const effects = effectiveScene.filter(tag => ['lighting', 'effects'].includes(options.outputCategory(tag)))
  const multiple = blocks.length > 1
  const characters = blocks.flatMap((block, index) => {
    const body = block.tags.filter(tag => ['character', 'body', 'expression', 'eyes', 'hair', 'clothes', 'accessories'].includes(options.outputCategory(tag)))
    const pose = block.tags.filter(tag => options.outputCategory(tag) === 'pose')
    if (!body.length && !pose.length) return []
    const position = block.position ?? (multiple ? index === 0 ? 'left' : index === 1 ? 'right' : 'center' : 'center')
    const entity = `${options.renderTags(body)}\n\n${subjectBreak}\n\n${options.renderTags(pose)}`
    const output = options.strategy === 'illustrious' && multiple ? `${positionLabel[position]}\n${entity}` : entity
    return [{ id: block.id, name: block.name, position, body, pose, output }]
  })
  const sections = [options.renderTags(quality), options.renderTags(people)]
  if (characters.length) sections.push(characters.map(character => character.output).join(`\n\n${subjectBreak}\n\n`))
  else sections.push('[]', '[]')
  sections.push(options.renderTags(composition), sceneBreak, options.renderTags(effects))
  return {
    prompt: sections.join('\n\n'),
    characters,
    scene: { subject_count: blocks.length, interaction: people.filter(tag => Array.isArray(tag.slot) ? tag.slot.includes('interaction_action') : tag.slot === 'interaction_action'), composition, tags: effectiveScene },
    strategy: options.strategy,
  }
}
