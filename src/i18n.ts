export type Locale = 'ja' | 'en'
export type LocalizedLabels = Partial<Record<Locale, string>>
export const DEFAULT_LOCALE: Locale = 'ja'

const messages = {
  overview: { ja: '全体', en: 'Overview' }, settings: { ja: '設定', en: 'Settings' }, clearAll: { ja: 'すべてクリア', en: 'Clear all' },
  addSubject: { ja: '人物追加', en: 'Add subject' }, promptActions: { ja: 'Prompt Actions', en: 'Prompt Actions' },
  copyPositive: { ja: 'Positiveをコピー', en: 'Copy positive' }, copyNegative: { ja: 'Negativeをコピー', en: 'Copy negative' }, copied: { ja: 'コピー済み', en: 'Copied' },
  selectedTags: { ja: '選択済みタグ', en: 'Selected tags' }, commonSettings: { ja: '共通設定', en: 'Common settings' },
  promptContext: { ja: 'Prompt Context', en: 'Prompt Context' },
  quality: { ja: '品質', en: 'Quality' }, style: { ja: 'スタイル', en: 'Style' }, unselected: { ja: '未選択', en: 'Not selected' },
} as const

const categories: Record<string, Record<Locale, string>> = {
  quality:{ja:'品質',en:'Quality'},people:{ja:'人数・相互作用',en:'People & interaction'},character:{ja:'キャラクター',en:'Character'},expression:{ja:'表情・顔',en:'Expression & face'},
  eyes:{ja:'目',en:'Eyes'},hair:{ja:'髪',en:'Hair'},body:{ja:'身体',en:'Body'},clothes:{ja:'服装',en:'Clothes'},accessories:{ja:'装飾・身につける物',en:'Accessories'},
  pose:{ja:'ポーズ・モーション',en:'Pose & motion'},camera:{ja:'カメラ・構図',en:'Camera & composition'},background:{ja:'背景・場所',en:'Background & location'},
  scene_props:{ja:'小物・オブジェクト',en:'Props & objects'},lighting:{ja:'ライティング',en:'Lighting'},effects:{ja:'奥行き・エフェクト',en:'Depth & effects'},
}

export type MessageKey = keyof typeof messages
export const t = (key: MessageKey, locale: Locale = DEFAULT_LOCALE) => messages[key][locale]
export const getCategoryLabel = (category: string, locale: Locale = DEFAULT_LOCALE) => categories[category]?.[locale] ?? category
export const getTagLabel = (tag: { label: string; prompt: string; labels?: LocalizedLabels }, locale: Locale = DEFAULT_LOCALE) => tag.labels?.[locale] ?? (locale === 'en' ? tag.prompt : tag.label)
