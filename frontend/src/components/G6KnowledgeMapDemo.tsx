import { useMemo, useState } from 'react'
import { G6KnowledgeMap } from './G6KnowledgeMap'
import type { KnowledgeMapData, KnowledgeMapDeepDive, KnowledgeMapProgressState } from './EditableKnowledgeMap'
import type { KnowledgeMapNodeStatus } from '../services/api'

const overview: KnowledgeMapData = {
  schema_version: 8,
  layout: 'mindmap',
  map_type: 'concept_tree',
  nodes: [
    { id: 'core', label: '条件概率', role: 'core', kind: 'core', detail: '在已知条件发生的前提下，重新衡量目标事件发生的可能性。' },
    { id: 'model', parent_id: 'core', order: 1, label: '建模对象', role: 'branch', kind: 'foundation', detail: '先明确样本空间、目标事件 A 与条件事件 B。' },
    { id: 'condition', parent_id: 'core', order: 2, label: '条件信息', role: 'branch', kind: 'foundation', detail: '条件 B 发生后，原来的样本空间会被缩小为 B。' },
    { id: 'definition', parent_id: 'core', order: 3, label: '条件概率定义', role: 'branch', kind: 'principle', detail: 'P(A|B)=P(A∩B)/P(B)，前提是 P(B)>0。', visual: { kind: 'formula', formula: 'P(A|B)=P(A∩B)/P(B)' } },
    { id: 'product', parent_id: 'core', order: 4, label: '乘法公式', role: 'branch', kind: 'process', detail: '把交集事件拆成“先发生 B，再发生 A”的连续过程。', visual: { kind: 'sequence', items: ['确认 B', '计算 P(B)', '求 P(A|B)', '得到 P(A∩B)'] } },
    { id: 'bayes', parent_id: 'core', order: 5, label: '贝叶斯反推', role: 'branch', kind: 'principle', detail: '从观察到的结果倒推可能的原因，需要结合先验概率。' },
    { id: 'independence', parent_id: 'core', order: 6, label: '独立性辨析', role: 'branch', kind: 'pitfall', detail: '独立时 P(A|B)=P(A)，但“互斥”并不等于“独立”。', mistake: '不要把 P(A|B) 与 P(B|A) 当成同一件事。' },
    { id: 'example', parent_id: 'core', order: 7, label: '抽球题应用', role: 'branch', kind: 'example', detail: '已知抽到红球后，判断它来自某个盒子的概率。', example: '先列出“红球”这一条件下的所有可能来源，再比较比例。' },
    { id: 'check', parent_id: 'core', order: 8, label: '一问自检', role: 'branch', kind: 'example', detail: '每一步都问：我现在是在原样本空间里，还是在条件 B 的范围内？' },
  ],
  edges: [
    'model', 'condition', 'definition', 'product', 'bayes', 'independence', 'example', 'check',
  ].map(to => ({ from: 'core', to })),
  learning_path: ['model', 'condition', 'definition', 'product', 'bayes', 'independence', 'example', 'check'],
}

function deepDiveFor(nodeId: string): KnowledgeMapDeepDive {
  const source = overview.nodes.find(node => node.id === nodeId) || overview.nodes[0]
  const rootId = `${nodeId}-core`
  const pieces = [
    ['meaning', '这一步在问什么', '把“条件”理解为观察到的新信息。', 'foundation'],
    ['rule', '关键规则', source.detail, 'principle'],
    ['use', '怎么用', '按“条件 → 范围 → 比例”的顺序写出每一步。', 'process'],
    ['mistake', '容易混淆', source.mistake || '区分已知条件与目标事件，不能把方向写反。', 'pitfall'],
    ['case', '微型例子', source.example || '用一个具体事件代入定义，检查分母是否是条件事件。', 'example'],
  ] as const
  const nodes = [
    { id: rootId, label: source.label, role: 'core' as const, kind: 'core' as const, detail: `专题深读：${source.detail}` },
    ...pieces.map(([id, label, detail, kind], index) => ({
      id: `${nodeId}-${id}`,
      parent_id: rootId,
      order: index + 1,
      label,
      role: 'branch' as const,
      kind,
      detail,
    })),
  ]
  return {
    schema_version: 8,
    layout: 'mindmap',
    map_type: 'concept_tree',
    source_node_id: source.id,
    title: `${source.label} · 专题图`,
    summary: `从含义、规则、应用与易错点展开 ${source.label}。`,
    nodes,
    edges: nodes.slice(1).map(node => ({ from: rootId, to: node.id })),
    learning_path: nodes.slice(1).map(node => node.id),
    generation_source: 'local',
  }
}

export default function G6KnowledgeMapDemo() {
  const [progress, setProgress] = useState<KnowledgeMapProgressState>({
    progress: {},
    summary: { total: 8, mastered: 0, review: 0, untouched: 8 },
  })
  const map = useMemo(() => overview, [])

  function updateProgress(nodeId: string, status: KnowledgeMapNodeStatus) {
    setProgress(current => {
      const next = { ...current.progress, [nodeId]: status === 'new' ? undefined : status }
      const active = Object.values(next).filter(Boolean)
      return {
        progress: next as KnowledgeMapProgressState['progress'],
        summary: {
          total: 8,
          mastered: active.filter(item => item === 'mastered').length,
          review: active.filter(item => item === 'review').length,
          untouched: 8 - active.length,
        },
      }
    })
  }

  return <main style={{ minHeight: '100vh', background: '#f7f8fa', padding: '18px' }}>
    <G6KnowledgeMap
      data={map}
      workspace
      progress={progress}
      onStatusChange={updateProgress}
      onGenerateDeepDive={async nodeId => deepDiveFor(nodeId)}
    />
  </main>
}
