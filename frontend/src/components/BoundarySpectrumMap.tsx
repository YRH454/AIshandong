import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeftRight,
  BadgeCheck,
  Ban,
  Brackets,
  Check,
  ChevronRight,
  GitCompareArrows,
  PenLine,
  ScanSearch,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { KnowledgeMapData, KnowledgeMapNode } from './EditableKnowledgeMap'
import type { KnowledgeMapSemanticRole } from './knowledgeMapSemantic'

type BoundarySpectrumMapProps = {
  data: KnowledgeMapData
  language?: 'zh-CN' | 'en'
  onNodeSelect: (nodeId: string) => void
  onEdit?: () => void
}

function ordered(data: KnowledgeMapData, root: KnowledgeMapNode) {
  return data.nodes.filter(node => node.id !== root.id).sort((a, b) => (a.order || 99) - (b.order || 99))
}

function clean(value: string | undefined) {
  return (value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/(^|\s)[#>*_-]{1,4}(?=\s)/g, ' ')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function brief(value: string | undefined, limit: number) {
  const cleaned = clean(value)
  return cleaned.length > limit ? `${cleaned.slice(0, limit).replace(/[，、；：,;:]?[^。！？.!?]*$/, '') || cleaned.slice(0, limit)}…` : cleaned
}

function byRole(nodes: KnowledgeMapNode[], role: KnowledgeMapSemanticRole, patterns: string[], fallback: number) {
  return nodes.find(node => node.semantic_role === role)
    || nodes.find(node => patterns.some(pattern => `${node.label} ${node.group || ''}`.includes(pattern)))
    || nodes[fallback]
}

function NodeAction({ node, className, icon, title, description, onOpen }: {
  node?: KnowledgeMapNode
  className: string
  icon: ReactNode
  title: string
  description?: string
  onOpen: (node: KnowledgeMapNode) => void
}) {
  if (!node) return null
  return <button type="button" className={className} onClick={() => onOpen(node)} aria-label={`${title}: ${node.label}`}>
    <span className="boundary-node-icon" aria-hidden="true">{icon}</span>
    <span className="boundary-node-copy">
      <small>{title}</small>
      <strong>{node.label}</strong>
      <p>{brief(description || node.detail, 126)}</p>
    </span>
    <ChevronRight className="boundary-node-arrow" size={18} aria-hidden="true" />
  </button>
}

export function BoundarySpectrumMap({ data, language = 'zh-CN', onNodeSelect, onEdit }: BoundarySpectrumMapProps) {
  const zh = language !== 'en'
  const root = data.nodes.find(node => node.role === 'core') || data.nodes[0]
  const nodes = useMemo(() => root ? ordered(data, root) : [], [data, root])
  const [activeNode, setActiveNode] = useState<KnowledgeMapNode | null>(null)
  if (!root) return null

  const definition = byRole(nodes, 'definition', ['核心定义', '定义'], 0)
  const included = byRole(nodes, 'inside', ['属于', '适用'], 1)
  const excluded = byRole(nodes, 'outside', ['不属于', '不适用'], 2)
  const condition = byRole(nodes, 'criterion', ['必要条件', '判定条件'], 3)
  const confusing = byRole(nodes, 'neighbor', ['易混淆', '相近'], 4)
  const counterexample = byRole(nodes, 'boundary_case', ['反例', '边界案例'], 5)
  const check = byRole(nodes, 'quick_check', ['快速判定', '检查'], 6)
  const generatedSteps = check?.visual?.items?.map(clean).filter(Boolean).slice(0, 3) || []
  const steps = generatedSteps.length === 3
    ? generatedSteps
    : (zh ? ['对照定义', '核验条件', '给出结论'] : ['Match definition', 'Verify criteria', 'Make the call'])
  const copy = zh ? {
    map: '概念边界判定场', edit: '编辑图解', source: '概念边界',
    inside: '范围之内', outside: '范围之外', threshold: '跨过这条线，结论就会改变',
    definition: '先固定定义', condition: '唯一判定门槛', confusing: '最容易混淆', counterexample: '只差一个条件', check: '三步判定',
    insideNote: '满足定义与必要条件', outsideNote: '外形相近，但关键条件不足',
    transition: '边界实验', transitionNote: '保持其他条件不变，只改变一个关键条件，观察结论如何跨越边界。',
    hint: '选择任一知识区域，可在当前画面查看完整解释。', close: '关闭解释', example: '具体例子', mistake: '容易误判',
  } : {
    map: 'Concept boundary field', edit: 'Edit map', source: 'Concept boundary',
    inside: 'Inside the range', outside: 'Outside the range', threshold: 'Cross this line and the decision changes',
    definition: 'Fix the definition', condition: 'Decision threshold', confusing: 'Closest neighbor', counterexample: 'One condition away', check: 'Three-step test',
    insideNote: 'Meets both definition and required conditions', outsideNote: 'Looks similar but misses a required condition',
    transition: 'Boundary experiment', transitionNote: 'Hold everything else constant, change one key condition, and observe the decision cross the boundary.',
    hint: 'Select any knowledge region to read its full explanation in place.', close: 'Close explanation', example: 'Example', mistake: 'Common mistake',
  }

  function open(node: KnowledgeMapNode) {
    setActiveNode(node)
    onNodeSelect(node.id)
  }

  return <section className="boundary-spectrum-map" aria-label={copy.map}>
    <header className="boundary-spectrum-head">
      <button type="button" className="boundary-spectrum-topic" onClick={() => open(root)}>
        <span>{copy.source}</span>
        <strong>{root.label}</strong>
      </button>
      <p>{brief(root.detail, 152)}</p>
      {onEdit && <button type="button" className="boundary-spectrum-edit" onClick={onEdit}><PenLine size={15} />{copy.edit}</button>}
    </header>

    <div className="boundary-spectrum-stage">
      <div className="boundary-definition-band">
        <button type="button" onClick={() => definition && open(definition)}>
          <span><Brackets size={21} strokeWidth={1.8} /></span>
          <small>{copy.definition}</small>
          <strong>{definition?.label || root.label}</strong>
          <p>{brief(definition?.detail || root.detail, 178)}</p>
        </button>
      </div>

      <div className="boundary-decision-field">
        <section className="boundary-decision-zone is-inside" aria-label={copy.inside}>
          <div className="boundary-zone-heading">
            <span><BadgeCheck size={24} strokeWidth={1.75} /></span>
            <div><h3>{copy.inside}</h3><p>{copy.insideNote}</p></div>
          </div>
          <NodeAction node={included} className="boundary-primary-node" icon={<Check size={20} strokeWidth={2} />} title={copy.inside} onOpen={open} />
        </section>

        <section className="boundary-criterion-spine" aria-label={copy.condition}>
          <span className="boundary-spine-line" aria-hidden="true" />
          <button type="button" onClick={() => condition && open(condition)}>
            <span><ShieldCheck size={22} strokeWidth={1.8} /></span>
            <small>{copy.condition}</small>
            <strong>{condition?.label || copy.threshold}</strong>
            <p>{brief(condition?.detail, 104)}</p>
          </button>
          <em>{copy.threshold}</em>
        </section>

        <section className="boundary-decision-zone is-outside" aria-label={copy.outside}>
          <div className="boundary-zone-heading">
            <span><Ban size={24} strokeWidth={1.75} /></span>
            <div><h3>{copy.outside}</h3><p>{copy.outsideNote}</p></div>
          </div>
          <NodeAction node={excluded} className="boundary-primary-node" icon={<X size={20} strokeWidth={2} />} title={copy.outside} onOpen={open} />
        </section>
      </div>

      <section className="boundary-transition-lab" aria-label={copy.transition}>
        <div className="boundary-transition-title">
          <ArrowLeftRight size={22} strokeWidth={1.7} />
          <div><h3>{copy.transition}</h3><p>{copy.transitionNote}</p></div>
        </div>
        <NodeAction node={confusing} className="boundary-transition-node is-neighbor" icon={<GitCompareArrows size={19} strokeWidth={1.8} />} title={copy.confusing} onOpen={open} />
        <span className="boundary-transition-arrow" aria-hidden="true"><ChevronRight size={22} /></span>
        <NodeAction node={counterexample} className="boundary-transition-node is-counterexample" icon={<Ban size={18} strokeWidth={1.8} />} title={copy.counterexample} onOpen={open} />
      </section>

      <section className="boundary-check-route" aria-label={copy.check}>
        <button type="button" className="boundary-check-intro" onClick={() => check && open(check)}>
          <ScanSearch size={23} strokeWidth={1.8} />
          <span><small>{copy.check}</small><strong>{check?.label || copy.check}</strong></span>
        </button>
        <ol>{steps.map((step, index) => <li key={`${step}-${index}`}><b>{index + 1}</b><span>{clean(step)}</span></li>)}</ol>
      </section>

      <p className="boundary-spectrum-hint">{copy.hint}</p>

      {activeNode && <aside className="boundary-detail-sheet" aria-live="polite" aria-label={activeNode.label}>
        <button type="button" className="boundary-detail-close" onClick={() => setActiveNode(null)} aria-label={copy.close}><X size={19} /></button>
        <span className="boundary-detail-group">{activeNode.group || copy.source}</span>
        <h3>{activeNode.label}</h3>
        <p>{clean(activeNode.detail)}</p>
        {activeNode.example && <div><strong>{copy.example}</strong><p>{clean(activeNode.example)}</p></div>}
        {activeNode.mistake && <div className="is-warning"><strong>{copy.mistake}</strong><p>{clean(activeNode.mistake)}</p></div>}
      </aside>}
    </div>
  </section>
}
