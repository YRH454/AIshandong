import { ArrowLeftRight, CheckCircle2, Link2, PenLine, Scale, ShieldQuestion, Split } from 'lucide-react'
import { type KnowledgeMapData, type KnowledgeMapNode } from './EditableKnowledgeMap'
import { createSemanticNodePicker } from './knowledgeMapSemantic'

type RelationshipNetworkMapProps = {
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
  return data.nodes
    .filter(node => node.id !== root.id)
    .sort((a, b) => (a.order || 99) - (b.order || 99))
}

function RelationshipNode({
  node, className, label, icon, onSelect, inspectOnly,
}: {
  node?: KnowledgeMapNode
  className: string
  label: string
  icon: React.ReactNode
  onSelect: (nodeId: string) => void
  inspectOnly: boolean
}) {
  if (!node) return null
  return <button type="button" className={className} onClick={() => onSelect(node.id)} aria-label={`${label}: ${node.label}`}>
    <span className="relationship-node-icon" aria-hidden="true">{icon}</span>
    <span className="relationship-node-role">{label}</span>
    <strong>{node.label}</strong>
    <small>{compact(node.detail, 76)}</small>
    <em>{node.example ? compact(node.example, 38) : inspectOnly ? '点击查看节点说明' : '点击展开这条关系'}</em>
  </button>
}

/** Relationship maps use a bilateral grammar: two subjects, a directional
 * bridge, and a lower evidence bench. They intentionally avoid a central hub. */
export function RelationshipNetworkMap({ data, language = 'zh-CN', onNodeSelect, onEdit, inspectOnly = false }: RelationshipNetworkMapProps) {
  const zh = language !== 'en'
  const root = data.nodes.find(node => node.role === 'core') || data.nodes[0]
  if (!root) return null

  const nodes = orderedNodes(data, root)
  const pick = createSemanticNodePicker(nodes)
  const subject = pick('subject', ['关系主体', '主体', '变量'], 0)
  const object = pick('object', ['关联对象', '对象', '对应'], 1)
  const direction = pick('direction', ['关系方向', '方向', '作用'], 2)
  const condition = pick('condition', ['成立条件', '条件', '前提'], 3)
  const covary = pick('covariation', ['共同变化', '联动', '变化'], 4)
  const exception = pick('exception', ['冲突', '例外', '失效', '反例'], 5)
  const evidence = pick('evidence', ['验证证据', '证据', '验证', '案例'], 6)

  const copy = zh ? {
    map: '关键关系图', center: '关系命题', edit: '编辑图解',
    subject: '关系主体', object: '关联对象', direction: '方向与强度', condition: '成立条件',
    covary: '共同变化', exception: '冲突或例外', evidence: '验证证据',
    bridge: '关系桥', positive: '同向变化', negative: '反向或制约',
  } : {
    map: 'Relationship map', center: 'Relationship claim', edit: 'Edit map',
    subject: 'Subject', object: 'Related object', direction: 'Direction and strength', condition: 'Conditions',
    covary: 'Co-variation', exception: 'Conflict or exception', evidence: 'Evidence',
    bridge: 'Relationship bridge', positive: 'Moves together', negative: 'Constrains or reverses',
  }

  return <section className="relationship-network-map" aria-label={copy.map}>
    <header className="relationship-map-head">
      <button type="button" className="relationship-map-topic" onClick={() => onNodeSelect(root.id)}>
        <span>{copy.center}</span>
        <strong>{root.label}</strong>
      </button>
      <p>{compact(root.detail, 116)}</p>
      {onEdit && <button type="button" className="relationship-map-edit" onClick={onEdit}><PenLine size={14} />{copy.edit}</button>}
    </header>

    <div className="relationship-map-deck">
      <div className="relationship-axis-label">{copy.bridge}</div>

      <RelationshipNode node={subject} className="relationship-subject" label={copy.subject} icon={<Link2 size={20} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />
      <RelationshipNode node={object} className="relationship-object" label={copy.object} icon={<ArrowLeftRight size={20} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />

      {direction && <button type="button" className="relationship-direction" onClick={() => onNodeSelect(direction.id)} aria-label={`${copy.direction}: ${direction.label}`}>
        <span>{copy.direction}</span>
        <strong>{direction.label}</strong>
        <small>{compact(direction.visual?.formula || direction.detail, 70)}</small>
        <i><b>{copy.positive}</b><b>{copy.negative}</b></i>
      </button>}

      <div className="relationship-flow-line" aria-hidden="true"><span /><i /><span /></div>

      <div className="relationship-evidence-bench">
        <RelationshipNode node={condition} className="relationship-condition" label={copy.condition} icon={<Scale size={18} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />
        <RelationshipNode node={covary} className="relationship-covary" label={copy.covary} icon={<Split size={18} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />
        <RelationshipNode node={exception} className="relationship-exception" label={copy.exception} icon={<ShieldQuestion size={18} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />
        <RelationshipNode node={evidence} className="relationship-evidence" label={copy.evidence} icon={<CheckCircle2 size={18} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />
      </div>
    </div>
  </section>
}
