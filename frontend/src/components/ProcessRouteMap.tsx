import { BadgeCheck, ClipboardCheck, FileInput, Flag, GitBranch, History, PenLine, Play, RefreshCcw, ScanSearch } from 'lucide-react'
import { type KnowledgeMapData, type KnowledgeMapNode } from './EditableKnowledgeMap'
import { createSemanticNodePicker } from './knowledgeMapSemantic'
import { FormulaText } from './FormulaText'

type ProcessRouteMapProps = {
  data: KnowledgeMapData
  language?: 'zh-CN' | 'en'
  onNodeSelect: (nodeId: string) => void
  onEdit?: () => void
  inspectOnly?: boolean
}

function brief(value: string | undefined, limit: number) {
  const text = value?.trim() || ''
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function orderedNodes(data: KnowledgeMapData, root: KnowledgeMapNode) {
  return data.nodes.filter(node => node.id !== root.id).sort((a, b) => (a.order || 99) - (b.order || 99))
}

function RouteStation({ node, number, label, icon, className = '', onSelect, inspectOnly }: {
  node?: KnowledgeMapNode
  number: number
  label: string
  icon: React.ReactNode
  className?: string
  onSelect: (nodeId: string) => void
  inspectOnly: boolean
}) {
  if (!node) return null
  return <button type="button" className={`route-station ${className}`} onClick={() => onSelect(node.id)} aria-label={`${label}: ${node.label}`}>
    <span className="route-station-number">{String(number).padStart(2, '0')}</span>
    <span className="route-station-icon" aria-hidden="true">{icon}</span>
    <span className="route-station-role">{label}</span>
    <strong><FormulaText>{node.label}</FormulaText></strong>
    <small><FormulaText>{brief(node.detail, 70)}</FormulaText></small>
    <em>{node.example ? brief(node.example, 34) : inspectOnly ? '点击查看节点说明' : '点击进入这一步'}</em>
  </button>
}

/** Process maps use one directional track. Decisions split the rail and the
 * review action creates a single explicit return loop. */
export function ProcessRouteMap({ data, language = 'zh-CN', onNodeSelect, onEdit, inspectOnly = false }: ProcessRouteMapProps) {
  const zh = language !== 'en'
  const root = data.nodes.find(node => node.role === 'core') || data.nodes[0]
  if (!root) return null

  const nodes = orderedNodes(data, root)
  const pick = createSemanticNodePicker(nodes)
  const start = pick('start', ['起点', '开始', '识别'], 0)
  const input = pick('input', ['输入', '条件', '已知'], 1)
  const execute = pick('execution', ['执行', '规则'], 2)
  const change = pick('state_change', ['状态', '变化', '追踪', '记录'], 3)
  const checkpoint = pick('decision', ['终止', '检查', '判断', '分支'], 4)
  const output = pick('output', ['输出', '结果', '答案'], 5)
  const review = pick('review', ['复核', '校验', '回看', '逆向'], 6)
  const timeline = nodes.find(node => /(时间脉络|发展脉络|历史演变)/.test(`${node.label} ${node.group || ''}`))

  const copy = zh ? {
    map: '推理路径图', origin: '推演主线', edit: '编辑图解', start: '确定起点', input: '读取条件', execute: '执行规则',
    change: '记录变化', check: '作出判断', output: '形成输出', review: '回环复核', continue: '继续推进', stop: '满足条件后输出',
    timeline: '回看发展脉络', timelineHint: '看看这个知识如何一步步形成', hint: '从左向右阅读，判断点只负责决定继续或结束。',
  } : {
    map: 'Reasoning route', origin: 'Reasoning track', edit: 'Edit map', start: 'Set origin', input: 'Read conditions', execute: 'Apply rule',
    change: 'Track change', check: 'Decide', output: 'Produce output', review: 'Review loop', continue: 'Continue', stop: 'Output when satisfied',
    timeline: 'Open the chronicle', timelineHint: 'See how this knowledge developed', hint: 'Read left to right. The decision station only chooses continue or finish.',
  }

  return <section className="process-track-map" aria-label={copy.map}>
    <header className="process-track-head">
      <button type="button" className="process-track-topic" onClick={() => onNodeSelect(root.id)}><span>{copy.origin}</span><strong><FormulaText>{root.label}</FormulaText></strong></button>
      <p><FormulaText>{brief(root.detail, 116)}</FormulaText></p>
      {onEdit && <button type="button" className="process-track-edit" onClick={onEdit}><PenLine size={14} />{copy.edit}</button>}
    </header>

    <div className="process-track-viewport">
      <div className="process-track-ribbon" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
      <div className="process-track-stations">
        <RouteStation node={start} number={1} label={copy.start} icon={<Flag size={19} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />
        <RouteStation node={input} number={2} label={copy.input} icon={<FileInput size={19} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />
        <RouteStation node={execute} number={3} label={copy.execute} icon={<Play size={19} />} className="route-station-primary" onSelect={onNodeSelect} inspectOnly={inspectOnly} />
        <RouteStation node={change} number={4} label={copy.change} icon={<RefreshCcw size={19} />} onSelect={onNodeSelect} inspectOnly={inspectOnly} />
        <RouteStation node={checkpoint} number={5} label={copy.check} icon={<GitBranch size={19} />} className="route-station-decision" onSelect={onNodeSelect} inspectOnly={inspectOnly} />
        <RouteStation node={output} number={6} label={copy.output} icon={<BadgeCheck size={19} />} className="route-station-output" onSelect={onNodeSelect} inspectOnly={inspectOnly} />
      </div>

      <div className="process-decision-legend" aria-hidden="true"><span>{copy.continue}</span><span>{copy.stop}</span></div>
      {review && <button type="button" className="process-review-loop" onClick={() => onNodeSelect(review.id)} aria-label={`${copy.review}: ${review.label}`}>
        <ClipboardCheck size={18} /><span><b>{copy.review}</b><strong><FormulaText>{review.label}</FormulaText></strong><small><FormulaText>{brief(review.detail, 72)}</FormulaText></small></span>
      </button>}
      {timeline && <button type="button" className="process-history-link" onClick={() => onNodeSelect(timeline.id)} aria-label={`${copy.timeline}: ${timeline.label}`}>
        <History size={18} /><span><b>{copy.timeline}</b><strong><FormulaText>{timeline.label}</FormulaText></strong><small><FormulaText>{copy.timelineHint}</FormulaText></small></span>
      </button>}
      <p className="process-track-hint"><ScanSearch size={14} />{copy.hint}</p>
    </div>
  </section>
}
