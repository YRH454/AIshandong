import { BookMarked, Braces, Languages, PenLine, ScanText, Tags, TextQuote } from 'lucide-react'
import type { KnowledgeMapData, KnowledgeMapNode } from './EditableKnowledgeMap'
import { FormulaText } from './FormulaText'

type TermFieldMapProps = {
  data: KnowledgeMapData
  language?: 'zh-CN' | 'en'
  onNodeSelect: (nodeId: string) => void
  onEdit?: () => void
}

function ordered(data: KnowledgeMapData, root: KnowledgeMapNode) {
  return data.nodes.filter(node => node.id !== root.id).sort((a, b) => (a.order || 99) - (b.order || 99))
}

function find(nodes: KnowledgeMapNode[], patterns: string[], fallback: number) {
  return nodes.find(node => patterns.some(pattern => `${node.label} ${node.group || ''}`.includes(pattern))) || nodes[fallback] || nodes.at(-1)
}

function brief(value: string | undefined, limit: number) {
  const text = value?.trim() || ''
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function TermEntry({ node, index, label, className, onSelect }: {
  node?: KnowledgeMapNode
  index: number
  label: string
  className: string
  onSelect: (nodeId: string) => void
}) {
  if (!node) return null
  return <button type="button" className={className} onClick={() => onSelect(node.id)} aria-label={`${label}: ${node.label}`}>
    <span>{String(index).padStart(2, '0')}</span>
    <div><small>{label}</small><strong><FormulaText>{node.label}</FormulaText></strong><p><FormulaText>{brief(node.detail, 78)}</FormulaText></p></div>
  </button>
}

export function TermFieldMap({ data, language = 'zh-CN', onNodeSelect, onEdit }: TermFieldMapProps) {
  const zh = language !== 'en'
  const root = data.nodes.find(node => node.role === 'core') || data.nodes[0]
  if (!root) return null
  const nodes = ordered(data, root)
  const original = find(nodes, ['术语原名', '原名'], 0)
  const meaning = find(nodes, ['一句释义', '含义'], 1)
  const attribute = find(nodes, ['关键属性', '属性'], 2)
  const alias = find(nodes, ['同义', '别名'], 3)
  const signal = find(nodes, ['题目信号', '识别'], 4)
  const confusing = find(nodes, ['易混淆', '辨析'], 5)
  const retell = find(nodes, ['自己', '复述'], 6)
  const copy = zh ? {
    map: '术语语义索引图', source: '术语主题', edit: '编辑图解',
    original: '名称', meaning: '一句释义', attribute: '关键属性', alias: '同义说法', signal: '出现信号', confusing: '易混淆词', retell: '自己的说法',
    hint: '像查词典一样阅读：先认名称，再理解含义，最后判断什么时候使用。',
  } : {
    map: 'Term semantic index', source: 'Term topic', edit: 'Edit map',
    original: 'Name', meaning: 'Meaning', attribute: 'Key property', alias: 'Alias', signal: 'Usage signal', confusing: 'Confusable term', retell: 'In your own words',
    hint: 'Read it like an index: identify the name, understand the meaning, then recognize when to use it.',
  }

  return <section className="term-field-map" aria-label={copy.map}>
    <header className="term-field-head">
      <button type="button" className="term-field-topic" onClick={() => onNodeSelect(root.id)}><span>{copy.source}</span><strong><FormulaText>{root.label}</FormulaText></strong></button>
      <p><FormulaText>{brief(root.detail, 124)}</FormulaText></p>
      {onEdit && <button type="button" className="term-field-edit" onClick={onEdit}><PenLine size={14} />{copy.edit}</button>}
    </header>
    <div className="term-field-stage">
      <aside className="term-field-index" aria-hidden="true"><BookMarked size={20} /><span>TERM INDEX</span><i>NAME</i><i>MEANING</i><i>USAGE</i></aside>
      <button type="button" className="term-field-core" onClick={() => onNodeSelect(root.id)}><Tags size={20} /><small>{copy.source}</small><strong><FormulaText>{root.label}</FormulaText></strong><p><FormulaText>{brief(root.detail, 94)}</FormulaText></p></button>
      <div className="term-field-column term-field-column-name">
        <Languages size={17} aria-hidden="true" />
        <TermEntry node={original} index={1} label={copy.original} className="term-entry term-entry-primary" onSelect={onNodeSelect} />
        <TermEntry node={alias} index={4} label={copy.alias} className="term-entry" onSelect={onNodeSelect} />
      </div>
      <div className="term-field-column term-field-column-meaning">
        <TextQuote size={17} aria-hidden="true" />
        <TermEntry node={meaning} index={2} label={copy.meaning} className="term-entry term-entry-primary" onSelect={onNodeSelect} />
        <TermEntry node={attribute} index={3} label={copy.attribute} className="term-entry" onSelect={onNodeSelect} />
      </div>
      <div className="term-field-column term-field-column-use">
        <ScanText size={17} aria-hidden="true" />
        <TermEntry node={signal} index={5} label={copy.signal} className="term-entry term-entry-primary" onSelect={onNodeSelect} />
        <TermEntry node={confusing} index={6} label={copy.confusing} className="term-entry" onSelect={onNodeSelect} />
      </div>
      <button type="button" className="term-field-retell" onClick={() => retell && onNodeSelect(retell.id)} disabled={!retell}><Braces size={18} /><span><small>{copy.retell}</small><strong><FormulaText>{retell?.label}</FormulaText></strong><p><FormulaText>{brief(retell?.detail, 90)}</FormulaText></p></span></button>
      <p className="term-field-hint">{copy.hint}</p>
    </div>
  </section>
}
