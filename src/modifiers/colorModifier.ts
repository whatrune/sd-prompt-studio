export type ColorModifier = {
  value: string
  label: string
  swatch: string
}

export const COLOR_MODIFIERS: readonly ColorModifier[] = [
  { value: 'black', label: '黒', swatch: '#111827' },
  { value: 'white', label: '白', swatch: '#ffffff' },
  { value: 'gray', label: 'グレー', swatch: '#6b7280' },
  { value: 'silver', label: '銀', swatch: '#c0c7d1' },
  { value: 'red', label: '赤', swatch: '#dc2626' },
  { value: 'crimson', label: '深紅', swatch: '#b91c3c' },
  { value: 'orange', label: 'オレンジ', swatch: '#f97316' },
  { value: 'yellow', label: '黄', swatch: '#facc15' },
  { value: 'gold', label: '金', swatch: '#d4a017' },
  { value: 'green', label: '緑', swatch: '#16a34a' },
  { value: 'emerald', label: 'エメラルド', swatch: '#059669' },
  { value: 'teal', label: '青緑', swatch: '#0d9488' },
  { value: 'cyan', label: 'シアン', swatch: '#06b6d4' },
  { value: 'blue', label: '青', swatch: '#2563eb' },
  { value: 'navy blue', label: '紺', swatch: '#1e3a8a' },
  { value: 'purple', label: '紫', swatch: '#7e22ce' },
  { value: 'violet', label: '菫', swatch: '#8b5cf6' },
  { value: 'pink', label: 'ピンク', swatch: '#ec4899' },
  { value: 'magenta', label: 'マゼンタ', swatch: '#d946ef' },
  { value: 'brown', label: '茶', swatch: '#854d0e' },
  { value: 'beige', label: 'ベージュ', swatch: '#d6c7a1' },
  { value: 'peach', label: '桃', swatch: '#ffb38a' },
] as const

export const COLOR_MODIFIABLE_CATEGORIES = new Set(['eyes', 'hair', 'clothes', 'accessories', 'scene_props'])

// Extra common prompt colors are recognized so a new modifier replaces them instead of stacking.
const KNOWN_COLOR_PREFIXES = [
  ...COLOR_MODIFIERS.map(color => color.value),
  'light blue', 'dark blue', 'light green', 'dark green', 'light brown', 'dark brown',
  'blonde', 'platinum blonde', 'rose gold',
].sort((a, b) => b.length - a.length)

export function isColorModifiableCategory(category: string) {
  return COLOR_MODIFIABLE_CATEGORIES.has(category)
}

export function findColorModifier(value: string) {
  return COLOR_MODIFIERS.find(color => color.value === value)
}

export function applyColorModifier(prompt: string, color: string) {
  const cleanPrompt = prompt.trim()
  const cleanColor = color.trim()
  if (!cleanPrompt || !cleanColor) return cleanPrompt
  const lowerPrompt = cleanPrompt.toLowerCase()
  const existing = KNOWN_COLOR_PREFIXES.find(candidate => lowerPrompt === candidate || lowerPrompt.startsWith(`${candidate} `))
  const basePrompt = existing ? cleanPrompt.slice(existing.length).trim() : cleanPrompt
  return basePrompt ? `${cleanColor} ${basePrompt}` : cleanColor
}

export function colorModifierSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
