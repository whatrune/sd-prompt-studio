import type { PromptTag } from '../data/tags'

export type ModelKey = 'illustrious' | 'pony' | 'sdxl' | 'flux'
export type ModelHint = { model: ModelKey; level: 'direct' | 'likely' | 'generic'; note: string }

export function generationNote(tag: PromptTag): string | undefined {
  return tag.generationNote ?? tag.description
}

export function modelHints(tag: PromptTag): ModelHint[] {
  if (tag.models?.length) return ['illustrious','pony','sdxl','flux'].map(model => ({
    model: model as ModelKey,
    level: tag.models!.includes(model) ? 'direct' : 'generic',
    note: tag.models!.includes(model) ? '辞書で対応指定あり' : '汎用語として試行可能'
  }))
  const p = tag.prompt.toLowerCase()
  if (p.startsWith('score_') || p.startsWith('source_')) return [
    {model:'pony',level:'direct',note:'Pony系の品質・ソース記法'},
    {model:'illustrious',level:'generic',note:'通常は別の品質タグを推奨'},
    {model:'sdxl',level:'generic',note:'通常は別の品質タグを推奨'},
    {model:'flux',level:'generic',note:'自然文寄りの記述を推奨'}
  ]
  const common: ModelHint[] = [
    {model:'illustrious',level:'likely',note:'Danbooru系タグとして試行しやすい'},
    {model:'pony',level:'likely',note:'タグ記法として試行しやすい'},
    {model:'sdxl',level:'generic',note:'チェックポイント依存の汎用タグ'},
    {model:'flux',level:'generic',note:'必要に応じて自然文へ言い換え'}
  ]
  return common
}

export function compatibilityLabel(level: ModelHint['level']) {
  return level === 'direct' ? '専用・明示' : level === 'likely' ? '使われやすい' : '汎用・要確認'
}

export function inferCategory(prompt: string, dictionary: PromptTag[]): PromptTag | undefined {
  const normalized = prompt.trim().toLowerCase().replace(/^\(|\)$/g,'').replace(/:\s*[\d.]+$/,'')
  return dictionary.find(t => t.prompt.toLowerCase() === normalized)
}

export function heuristicCategory(prompt: string): string {
  const p=prompt.toLowerCase()
  const rules: Array<[string,string[]]> = [
    ['quality',['quality','masterpiece','resolution','aesthetic','absurdres','score_']],
    ['people',['girl','boy','solo','multiple','couple','group']],
    ['eyes',['eyes','pupils','iris','eyelash','eyeliner']],
    ['hair',['hair','bangs','sidelocks','ponytail','twintails','braid']],
    ['clothes',['shirt','dress','skirt','pants','uniform','jacket','coat','socks','shoes','kimono','swimsuit']],
    ['pose',['standing','sitting','lying','kneeling','hands','arms','pose']],
    ['camera',['view','shot','angle','portrait','close-up','full body','lens']],
    ['background',['room','school','toilet','yard','street','forest','beach','city','background']],
    ['lighting',['light','lighting','backlight','rim light','shadow']],
    ['effects',['bokeh','depth of field','blur','particles','grain','flare']],
    ['expression',['smile','crying','mouth','blush','angry','sad']],
    ['body',['skin','body','breasts','waist','legs','sweat']],
  ]
  return rules.find(([,words])=>words.some(w=>p.includes(w)))?.[0] ?? 'character'
}
