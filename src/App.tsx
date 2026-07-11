import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, Ban, BookOpen, Check, ChevronDown, ChevronUp, Copy, Info, Plus, RotateCcw, Search, Settings2, Sparkles, Star, Trash2, WandSparkles, X } from 'lucide-react'
import { categoryLabels, categoryOrder, subcategoryOrder, TAG_COUNT, tags, type ContentRating, type PromptTag } from './data/tags'
import { ADULT_TAG_COUNT, adultTags } from './data/adultTags'
import { isSceneCategory, usePromptStore, type SelectedTag, type ModelPreset } from './store'
import { compatibilityLabel, generationNote, heuristicCategory, inferCategory, modelHints } from './engine/tagIntelligence'
import { getConflictMap } from './engine/smartTagEngine'
import './styles.css'
import { createId } from './id'
import { buildPromptWithStrategy, tagSort } from './prompt'
import { DEFAULT_LOCALE, getCategoryLabel, getTagLabel, t } from './i18n'



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
  const [query, setQuery] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [copied, setCopied] = useState(false)
  const [inspectedTag, setInspectedTag] = useState<PromptTag | null>(null)
  const [analyzerOpen, setAnalyzerOpen] = useState(false)
  const [analyzerText, setAnalyzerText] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [saveCustom, setSaveCustom] = useState(true)
  const [composerCollapsed, setComposerCollapsed] = useState(true)
  const [relatedCollapsed, setRelatedCollapsed] = useState(false)
  const [selectedCollapsed, setSelectedCollapsed] = useState(false)
  const [expansionCollapsed, setExpansionCollapsed] = useState(true)
  const [promptCollapsed, setPromptCollapsed] = useState(true)
  const [negativeCollapsed, setNegativeCollapsed] = useState(true)
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
  const activeSubject = store.blocks.find(b => b.id === store.activeBlockId)!
  const active = store.activeLayer === 'scene' ? { id: 'scene', name: 'Scene', tags: store.sceneTags } : activeSubject

  const subcategories = useMemo(() => subcategoryOrder[category] ?? [], [category])
  const dictionaryTags = useMemo(() => [...tags, ...adultTags, ...store.userTags], [store.userTags])
  const visibleDictionaryTags = useMemo(() => dictionaryTags.filter(tag => RATING_RANK[tag.rating ?? 'general'] <= RATING_RANK[store.contentLevel]).map(tag => ({ ...tag, label: getTagLabel(tag, locale) })), [dictionaryTags, locale, store.contentLevel])
  const conflictMap = useMemo(() => getConflictMap(visibleDictionaryTags, active.tags, dictionaryTags), [visibleDictionaryTags, active.tags, dictionaryTags])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return visibleDictionaryTags.filter(t => {
      if (favoritesOnly && !store.favoriteIds.includes(t.id)) return false
      if (!q && t.category !== category) return false
      if (!q && subcategory !== 'すべて' && t.subcategory !== subcategory) return false
      if (!q && store.hideUnavailable && conflictMap.get(t.id)?.level === 'hard') return false
      return !q || scoreTag(t, q) > 0
    }).sort((a,b) => q ? scoreTag(b,q)-scoreTag(a,q) || tagSort(a,b) : tagSort(a,b))
  }, [category, subcategory, query, favoritesOnly, store.favoriteIds, visibleDictionaryTags, store.hideUnavailable, conflictMap])

  const expansion = useMemo(() => buildPromptWithStrategy(store.blocks, store.sceneTags, store.modelPreset), [store.blocks, store.sceneTags, store.modelPreset])
  const prompt = expansion.prompt

  const warnings = useMemo(() => conflicts(active.tags), [active.tags])
  const related = useMemo(() => relatedTags(active.tags).slice(0, 8), [active.tags])
  const selectedSections = useMemo(() => {
    const group = (key: string, category: string, label: string, items: SelectedTag[], layerId: string, subcategory?: string, excludeSubcategory?: string) => ({ key, category, label, subcategory, items: items.filter(tag => tag.category === category && (!subcategory || tag.subcategory === subcategory) && (!excludeSubcategory || tag.subcategory !== excludeSubcategory)).map(tag => ({ tag, layerId })) })
    const sceneGroup = (key: string, category: string, label: string, subcategory?: string, excludeSubcategory?: string) => group(key, category, label, store.sceneTags, 'scene', subcategory, excludeSubcategory)
    const subjectSection = (block: typeof store.blocks[number]) => ({
      id: block.id,
      name: block.name,
      targetId: block.id,
      groups: [
        ...['people','expression','eyes','hair','body','clothes','accessories','pose'].map(category => group(category, category, getCategoryLabel(category, locale), block.tags, block.id)),
      ],
    })
    if (store.activeLayer === 'subject') {
      const selected = store.blocks.find(block => block.id === store.activeBlockId) ?? store.blocks[0]
      return [subjectSection(selected)]
    }
    return [
      { id: 'common', name: t('commonSettings', locale), targetId: 'scene', groups: [
        sceneGroup('quality', 'quality', t('quality', locale), undefined, 'スタイル'),
        sceneGroup('style', 'quality', t('style', locale), 'スタイル'),
        ...['lighting','camera','background','effects'].map(category => sceneGroup(category, category, getCategoryLabel(category, locale))),
      ] },
      ...store.blocks.map(subjectSection),
    ]
  }, [locale, store.activeBlockId, store.activeLayer, store.blocks, store.sceneTags])
  async function copyPrompt() {
    const success = await copyText(prompt)
    if (!success) { alert('コピーできませんでした。テキストを選択して手動でコピーしてください。'); return }
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }
  function chooseCategory(c:string){ store.setActiveLayer(isSceneCategory(c) ? 'scene' : 'subject'); setCategory(c); setSubcategory('すべて'); setQuery(''); setFavoritesOnly(false) }
  function changeContentLevel(level: ContentRating){
    if (level === 'adult' && store.contentLevel !== 'adult') {
      const accepted = confirm('成人向けタグを表示します。成人キャラクター同士の表現にのみ使用し、未成年を示すタグとは併用できません。表示しますか？')
      if (!accepted) return
    }
    store.setContentLevel(level)
  }
  function toggleDictionaryTag(tag: PromptTag){
    const selected = active.tags.find(t => t.prompt === tag.prompt)
    if (selected) { store.removeTag(selected.id); return }
    if (tag.rating === 'adult' && hasMinorMarker(store.blocks.flatMap(b => b.tags))) {
      alert('成人向けタグは、未成年を示すタグと同時に追加できません。')
      return
    }
    if (MINOR_MARKERS.some(marker => tag.prompt.toLowerCase().includes(marker)) && hasAdultTag(store.blocks.flatMap(b => b.tags))) {
      alert('未成年を示すタグは、成人向けタグと同時に追加できません。')
      return
    }
    const conflict = conflictMap.get(tag.id)
    if (conflict?.level === 'hard') {
      const accepted = confirm(`競合しています。\n\nそのまま追加しますか？`)
      if (!accepted) return
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

  return <main className="app-shell">
    <header className="topbar">
      <div><h1>SD Prompt Studio <span className="version-mark">v21.0 α1</span></h1><p>Stable Diffusion Prompt IDE · {(TAG_COUNT + ADULT_TAG_COUNT + store.userTags.length).toLocaleString()} tags</p></div>
      <div className="header-actions">
        <button className="ghost" onClick={()=>setAnalyzerOpen(true)}><BookOpen size={17}/>Prompt解析</button>
        <div className="settings-wrap">
          <button className={`ghost settings-button ${settingsOpen?'active':''}`} onClick={()=>setSettingsOpen(v=>!v)} aria-expanded={settingsOpen}>
            <Settings2 size={17}/>{t('settings',locale)}
            {store.contentLevel!=='general'&&<span className={`rating-dot ${store.contentLevel}`} title={store.contentLevel==='adult'?'成人向け表示中':'軽度なセンシティブ表示中'}/>} 
          </button>
          {settingsOpen&&<div className="settings-popover">
            <div className="settings-popover-head"><div><span className="eyebrow">DISPLAY SETTINGS</span><strong>コンテンツ表示</strong></div><button onClick={()=>setSettingsOpen(false)}><X size={15}/></button></div>
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
        <button className="ghost danger" onClick={store.clearAll}><Trash2 size={17}/>{t('clearAll',locale)}</button>
      </div>
    </header>
    <section className="workspace">
      <aside className="sidebar panel">
        <div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="日本語・英語で検索" /></div>
        <button className={`favorite-filter ${favoritesOnly?'active':''}`} onClick={()=>{setFavoritesOnly(!favoritesOnly);setQuery('')}}><Star size={16}/>お気に入り</button>
        <nav>{categoryOrder.map(c=><button key={c} className={category===c&&!query&&!favoritesOnly?'active':''} onClick={()=>chooseCategory(c)}>{getCategoryLabel(c,locale)}<small>{visibleDictionaryTags.filter(t=>t.category===c).length}</small></button>)}</nav>
        <div className="preset-box"><label>モデル</label><select value={store.modelPreset} onChange={e=>store.setModelPreset(e.target.value as ModelPreset)}><option value="illustrious">Illustrious / NoobAI</option><option value="pony">Pony</option><option value="sdxl">SDXL汎用</option><option value="custom">カスタム</option></select><button className="preset" onClick={()=>store.applyQualityPreset()}><WandSparkles size={17}/>品質を置き換え</button></div>
      </aside>

      <section className="tag-panel panel">
        {(favoritesOnly||query)&&<div className="panel-title">
          <div><span className="eyebrow">PROMPT DICTIONARY</span><h2>{favoritesOnly?'お気に入り':`「${query}」の検索結果`}</h2></div>
        </div>}
        {!query&&!favoritesOnly&&subcategories.length>0&&<div className="subcategory-tabs">{['すべて',...subcategories].map(sub=>{const activeSub=subcategory===sub;return <button key={sub} className={activeSub?'active':''} aria-pressed={activeSub} onClick={()=>setSubcategory(sub)}>{activeSub&&<Check size={14}/>}<span>{sub}</span></button>})}</div>}
        {['hair','eyes','body','clothes','scene_props'].includes(category)&&<section className={`composer-section ${composerCollapsed?'collapsed':''}`}>
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
        {related.length>0&&<section className={`related-suggestions ${relatedCollapsed?'collapsed':''}`}>
          <button className="related-suggestions-toggle" onClick={()=>setRelatedCollapsed(v=>!v)} aria-expanded={!relatedCollapsed}>
            <span><Sparkles size={15}/>関連候補 <small>{related.length}</small></span>
            {relatedCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}
          </button>
          {!relatedCollapsed&&<div className="related-suggestions-list">{related.filter(tag=>RATING_RANK[tag.rating ?? 'general']<=RATING_RANK[store.contentLevel]).map(tag=><button key={tag.id} className={`category-${tag.category}`} onClick={()=>toggleDictionaryTag(tag)}>＋ {tag.label}<small>{tag.prompt}</small></button>)}</div>}
        </section>}
        <div className="tag-grid">{filtered.map(tag=>{const selected=active.tags.some(t=>t.prompt===tag.prompt);const favorite=store.favoriteIds.includes(tag.id);const isUser='source' in tag;const conflict=conflictMap.get(tag.id);const unavailable=!selected&&conflict?.level==='hard';const warning=!selected&&conflict?.level==='warning';return <article key={tag.id} className={`tag-card category-${tag.category} ${selected?'selected':''} ${unavailable?'unavailable':''} ${warning?'warning':''}`}><button className={`star ${favorite?'active':''}`} aria-label="お気に入り" onClick={()=>store.toggleFavorite(tag.id)}><Star size={15} fill={favorite?'currentColor':'none'}/></button><button className="info-tag" title="タグ詳細" aria-label="タグ詳細" onClick={()=>setInspectedTag(tag)}><Info size={14}/></button>{isUser&&<button className="delete-user-tag" title="ユーザー辞書から削除" onClick={()=>store.removeUserTag(tag.id)}><X size={13}/></button>}<button className="tag-main" onClick={()=>toggleDictionaryTag(tag)}>{unavailable&&<span className="conflict-badge"><Ban size={13}/>競合</span>}{warning&&<span className="warning-badge"><AlertTriangle size={13}/>注意</span>}<strong>{tag.label}</strong><span>{tag.prompt}</span><small>{isUser?'ユーザー辞書 / ':''}{tag.rating==='adult'?'成人向け / ':tag.rating==='suggestive'?'軽度 / ':''}{categoryLabels[tag.category]} / {tag.subcategory}</small></button></article>})}</div>
      </section>

      <aside className="preview panel">
        <div className="block-tabs"><button className={store.activeLayer==='scene'?'active':''} onClick={()=>store.setActiveLayer('scene')}>{t('overview',locale)}</button>{store.blocks.map(b=><button key={b.id} className={store.activeLayer==='subject'&&b.id===store.activeBlockId?'active':''} onClick={()=>store.setActiveBlock(b.id)}>{b.name}{store.blocks.length>1&&<X size={13} onClick={e=>{e.stopPropagation();store.removeBlock(b.id)}}/>}</button>)}<button className="add-block" onClick={store.addBlock}><Plus size={16}/>{t('addSubject',locale)}</button></div>
        <section className="prompt-actions"><strong>Prompt Actions</strong><button onClick={copyPrompt}><Copy size={16}/>{copied?'コピー済み':'Positiveをコピー'}</button><button onClick={async()=>{const ok=await copyText(store.negative);if(ok){setCopied(true);setTimeout(()=>setCopied(false),1400)}}}><Copy size={16}/>{copied?'コピー済み':'Negativeをコピー'}</button></section>
        {store.activeLayer==='subject'&&activeSubject&&<label className="subject-position">Character position<select value={activeSubject.position??'center'} onChange={event=>store.setSubjectPosition(activeSubject.id,event.target.value as 'left'|'center'|'right')}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>}
        <section className={`preview-section ${selectedCollapsed?'collapsed':''}`}>
          <button className="preview-section-toggle" onClick={()=>setSelectedCollapsed(v=>!v)} aria-expanded={!selectedCollapsed}>
            <span>{t('selectedTags',locale)}</span>{selectedCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}
          </button>
          {!selectedCollapsed&&<div className="preview-section-content">
            <div className="selected-outline">
              {selectedSections.map(section=><section className="selected-layer" key={section.id}><button className="selected-layer-title" onClick={()=>section.targetId==='scene'?store.setActiveLayer('scene'):store.setActiveBlock(section.targetId)}>{section.name}</button>{section.groups.map(entry=><section className="selected-group" key={entry.key}>
                <div className="selected-group-head"><button onClick={()=>{if(section.targetId!=='scene')store.setActiveBlock(section.targetId);chooseCategory(entry.category);if(entry.subcategory)setSubcategory(entry.subcategory)}}><strong>{entry.label}</strong><span>{entry.items.length}</span></button></div>
                <div className="selected-chips">{entry.items.length===0?<small className="selected-empty">{t('unselected',locale)}</small>:entry.items.sort((a,b)=>tagSort(a.tag,b.tag)).map(({tag,layerId})=><div className={`selected-chip category-${tag.category}`} key={`${layerId}-${tag.id}`} title={`${tag.prompt}${tag.weight!==1?` / 重み ${tag.weight.toFixed(1)}`:''}`}>
                  <button className="chip-label" onClick={()=>{const source=visibleDictionaryTags.find(t=>t.id===tag.id);if(source)setInspectedTag(source)}}>{getTagLabel(tag,locale)}</button>
                  {tag.weight!==1&&<span className="chip-weight">{tag.weight.toFixed(1)}</span>}
                  <button className="chip-remove" aria-label={`${tag.label}を削除`} onClick={()=>store.removeTagFromLayer(layerId, tag.id)}><X size={12}/></button>
                </div>)}</div>
              </section>)}</section>)}
            </div>
          </div>}
        </section>
        <section className={`preview-section expansion-preview ${expansionCollapsed?'collapsed':''}`}>
          <button className="preview-section-toggle" title="Expansion Preview" onClick={()=>setExpansionCollapsed(value=>!value)} aria-expanded={!expansionCollapsed}><span>Generated Prompt Structure</span>{expansionCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button>
          {!expansionCollapsed&&<div className="preview-section-content expansion-entities"><small>{expansion.strategy} / {expansion.scene.subject_count} subject(s)</small>{expansion.characters.map(character=><section key={character.id}><strong>{character.name} · {character.position}</strong><pre>{character.output}</pre></section>)}</div>}
        </section>
        <section className={`preview-section output-box ${promptCollapsed?'collapsed':''}`}>
          <div className="output-head"><button className="preview-section-toggle inline" onClick={()=>setPromptCollapsed(v=>!v)} aria-expanded={!promptCollapsed}><span>Final Prompt</span>{promptCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button><button onClick={copyPrompt}><Copy size={16}/>{copied?'コピー済み':'コピー'}</button></div>
          {!promptCollapsed&&<textarea readOnly value={prompt}/>} 
        </section>
        <section className={`preview-section output-box negative ${negativeCollapsed?'collapsed':''}`}>
          <div className="output-head"><button className="preview-section-toggle inline" onClick={()=>setNegativeCollapsed(v=>!v)} aria-expanded={!negativeCollapsed}><span>Negative Prompt</span>{negativeCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button><div><button onClick={store.resetNegative}><RotateCcw size={15}/>初期値</button><button onClick={async()=>{ const success = await copyText(store.negative); if (!success) alert('コピーできませんでした。テキストを選択して手動でコピーしてください。') }}><Copy size={16}/>コピー</button></div></div>
          {!negativeCollapsed&&<textarea value={store.negative} onChange={e=>store.setNegative(e.target.value)} />} 
        </section>
      </aside>
    </section>
    {inspectedTag&&<div className="modal-backdrop" onMouseDown={()=>setInspectedTag(null)}><section className="tag-detail-modal" onMouseDown={e=>e.stopPropagation()}><div className="analyzer-head"><div><span className="eyebrow">TAG INTELLIGENCE</span><h2>{inspectedTag.label}</h2><code>{inspectedTag.prompt}</code></div><button onClick={()=>setInspectedTag(null)}><X size={18}/></button></div>{categoryGuides[inspectedTag.category]&&<div className={`category-guide category-guide-${inspectedTag.category}`}><strong>{categoryGuides[inspectedTag.category].title}</strong><p>{categoryGuides[inspectedTag.category].text}</p></div>}{generationNote(inspectedTag)&&<><strong className="mini-title">生成メモ</strong><p>{generationNote(inspectedTag)}</p></>}<dl><div><dt>分類</dt><dd>{categoryLabels[inspectedTag.category]} / {inspectedTag.subcategory || '未分類'}</dd></div><div><dt>表示区分</dt><dd>{inspectedTag.rating || 'general'}</dd></div></dl><strong className="mini-title">モデル記法の目安</strong><div className="model-hints">{modelHints(inspectedTag).map(h=><span key={h.model} className={`model-hint ${h.level}`}><b>{h.model}</b>{compatibilityLabel(h.level)}<small>{h.note}</small></span>)}</div>{(inspectedTag.related?.length??0)>0&&<><strong className="mini-title">関連タグ</strong><div className="inspector-related">{inspectedTag.related!.map(x=><button key={x} onClick={()=>{const found=visibleDictionaryTags.find(t=>t.prompt===x);if(found)toggleDictionaryTag(found)}}>{x}</button>)}</div></>}</section></div>}
    {analyzerOpen&&<div className="modal-backdrop" onMouseDown={()=>setAnalyzerOpen(false)}><section className="analyzer-modal" onMouseDown={e=>e.stopPropagation()}><div className="analyzer-head"><div><span className="eyebrow">PROMPT ANALYZER</span><h2>既存プロンプトをGUIへ取り込む</h2></div><button onClick={()=>setAnalyzerOpen(false)}><X size={18}/></button></div><p>カンマ、改行、角括弧、BREAKを解析し、辞書一致またはキーワード推定でカテゴリ分けします。</p><textarea value={analyzerText} onChange={e=>setAnalyzerText(e.target.value)} placeholder="masterpiece, 1girl, blue hair, ..."/><div className="analyzer-preview">{analyzerText.split(/,|\n|BREAK/i).map(x=>x.trim().replace(/^\[|\]$/g,'')).filter(Boolean).slice(0,80).map((raw,i)=>{const clean=raw.replace(/^\((.*):[\d.]+\)$/,'$1').trim();const found=inferCategory(clean,visibleDictionaryTags);const cat=found?.category||heuristicCategory(clean);return <span key={`${raw}-${i}`}><b>{categoryLabels[cat]||cat}</b>{clean}{found?'':'（推定）'}</span>})}</div><div className="modal-actions"><button className="ghost" onClick={()=>setAnalyzerText('')}>クリア</button><button onClick={()=>{const entries=analyzerText.split(/,|\n|BREAK/i).map(x=>x.trim().replace(/^\[|\]$/g,'')).filter(Boolean);entries.forEach(raw=>{const m=raw.match(/^\((.*):([\d.]+)\)$/);const clean=(m?.[1]||raw).trim();const found=inferCategory(clean,visibleDictionaryTags);const cat=found?.category||heuristicCategory(clean);store.addTag({...found,id:found?.id||`analyzed-${createId()}`,prompt:found?.prompt||clean,label:found?.label||clean,category:cat,subcategory:found?.subcategory||'解析・自由タグ',weight:m?Number(m[2]):1})});setAnalyzerOpen(false)}}><BookOpen size={16}/>解析結果を追加</button></div></section></div>}
  </main>
}
