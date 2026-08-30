import { BadgeCheck, CircuitBoard, Gauge, KeyRound, PenLine, RotateCcw, ShieldAlert } from 'lucide-react'
import { type KnowledgeMapData, type KnowledgeMapNode } from './EditableKnowledgeMap'
import { createSemanticNodePicker } from './knowledgeMapSemantic'
import { FormulaText } from './FormulaText'

type CausalMechanismLabProps = {
  data: KnowledgeMapData
  language?: 'zh-CN' | 'en'
  onNodeSelect: (nodeId: string) => void
  onEdit?: () => void
  inspectOnly?: boolean
}

function compact(value: string | undefined, limit: number) {
  const text = value?.trim() || ''
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function orderedNodes(data: KnowledgeMapData, root: KnowledgeMapNode) {
  return data.nodes.filter(node => node.id !== root.id).sort((a, b) => (a.order || 99) - (b.order || 99))
}

function Chamber({ node, className, label, icon, onSelect, inspectOnly }: {
  node?: KnowledgeMapNode
  className: string
  label: string
  icon: React.ReactNode
  onSelect: (nodeId: string) => void
  inspectOnly: boolean
}) {
  if (!node) return null
  return <button type="button" className={className} onClick={() => onSelect(node.id)} aria-label={`${label}: ${node.label}`}>
    <span className="causal-chamber-icon" aria-hidden="true">{icon}</span>
    <span className="causal-chamber-label">{label}</span>
    <strong><FormulaText>{node.label}</FormulaText></strong>
    <small><FormulaText>{compact(node.visual?.formula || node.detail, 72)}</FormulaText></small>
    <em>{node.example ? <FormulaText>{compact(node.example, 34)}</FormulaText> : inspectOnly ? '点击查看节点说明' : '点击拆解这一环'}</em>
  </button>
}

/** Causal maps use a cutaway-machine grammar: information enters from the
 * left, passes through distinct chambers, and exits as an observable result. */
export function CausalMechanismLab({ data, language = 'zh-CN', onNodeSelect, onEdit, inspectOnly = false }: CausalMechanismLabProps) {
  const zh = language !== 'en'
  const root = data.nodes.find(node => node.role === 'core') || data.nodes[0]
  if (!root) return null

  const nodes = orderedNodes(data, root)
  const pick = createSemanticNodePicker(nodes)
  const condition = pick('premise', ['前提', '条件', '基础'], 0)
  const signal = pick('trigger', ['信号', '触发', '判断', '识别'], 1)
  const rule = pick('mechanism', ['规则', '原理', '机制'], 2)
  const change = pick('transformation', ['转化', '变化', '状态', '路径'], 3)
  const conclusion = pick('result', ['结论', '结果', '输出'], 4)
  const verification = pick('verification', ['反向', '验证', '回溯', '对比'], 5)
  const failure = pick('failure', ['失效', '错误', '不能', '不足', '缺少'], 6)

  const copy = zh ? {
    map: '成立机制图', center: '机制剖面', edit: '编辑图解', condition: '条件入口', signal: '触发感应',
    rule: '规则腔室', change: '状态转化', output: '结果出口', diagnostic: '诊断台', verify: '反向验证', failure: '机制失效',
  } : {
    map: 'Mechanism map', center: 'Mechanism cutaway', edit: 'Edit map', condition: 'Condition inlet', signal: 'Trigger sensor',
    rule: 'Rule chamber', change: 'State transform', output: 'Result outlet', diagnostic: 'Diagnostics', verify: 'Reverse check', failure: 'Failure mode',
  }

  return <section className="causal-machine-map" aria-label={copy.map}>
    <header className="causal-machine-head">
      <button type="button" className="causal-machine-topic" onClick={() => onNodeSelect(root.id)}><span>{copy.center}</span><strong><FormulaText>{root.label}</FormulaText></strong></button>
      <p><FormulaText>{compact(root.detail, 116)}</FormulaText></p>
      {onEdit && <button type="button" className="causal-machine-edit" onClick={onEdit}><PenLine size={14} />{copy.edit}</button>}
    </header>

    <div className="causal-machine-deck">
      <div className="causal-machine-rail" aria-hidden="true"><span /><span /><span /><span /></div>
      <div className="causal-machine-shell" aria-hidden="true" />

      <Chamber node={condition} className="causal-condition-chamber" label={copy.condition} icon={<KeyRound size={20} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />
      <Chamber node={signal} className="causal-signal-chamber" label={copy.signal} icon={<Gauge size={20} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />
      <Chamber node={rule} className="causal-rule-chamber" label={copy.rule} icon={<CircuitBoard size={23} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />
      <Chamber node={change} className="causal-change-chamber" label={copy.change} icon={<RotateCcw size={20} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />
      <Chamber node={conclusion} className="causal-output-chamber" label={copy.output} icon={<BadgeCheck size={20} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />

      <aside className="causal-diagnostic-bench" aria-label={copy.diagnostic}>
        <strong>{copy.diagnostic}</strong>
        <Chamber node={verification} className="causal-verify-module" label={copy.verify} icon={<RotateCcw size={18} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />
        <Chamber node={failure} className="causal-failure-module" label={copy.failure} icon={<ShieldAlert size={18} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />
      </aside>
    </div>
  </section>
}
