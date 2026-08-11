import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { AlertTriangle, ArrowRight, Braces, Check, CirclePlus, GitBranchPlus, Lightbulb, MousePointer2, Redo2, Save, Sparkles, Trash2, Undo2, X } from 'lucide-react'
import type { KnowledgeMapCollaboration, KnowledgeMapCollaborationSuggestion, KnowledgeMapNodeStatus } from '../services/api'

export type KnowledgeMapNode = {
  id: string
  label: string
  role: 'core' | 'branch' | 'detail'
  kind?: 'core' | 'foundation' | 'principle' | 'process' | 'example' | 'pitfall'
  group?: string
  order?: number
  detail: string
  example?: string
  mistake?: string
  visual?: {
    kind?: 'definition' | 'sequence' | 'code' | 'input_output' | 'warning' | 'formula' | 'comparison' | 'stack'
    headline?: string
    items?: string[]
    code?: string
    input?: string
    output?: string
    formula?: string
    before?: string
    after?: string
  }
  position?: { x: number; y: number }
}

export type KnowledgeMapData = {
  schema_version: number
  layout: 'mindmap' | 'flow'
  map_type?: 'concept_tree' | 'process_flow'
  groups?: string[]
  nodes: KnowledgeMapNode[]
  edges: Array<{ from: string; to: string; label?: string }>
  learning_path: string[]
}

export type KnowledgeMapProgressState = {
  progress: Record<string, Exclude<KnowledgeMapNodeStatus, 'new'>>
  summary: { total: number; mastered: number; review: number; untouched: number }
}

type CanvasMode = 'read' | 'edit'
type EditorTool = 'move' | 'connect'
type Point = { x: number; y: number }
type TeachingKind = NonNullable<KnowledgeMapNode['kind']>
type VisualKind = NonNullable<NonNullable<KnowledgeMapNode['visual']>['kind']>
type SelectedEdge = Pick<KnowledgeMapData['edges'][number], 'from' | 'to'>

const canvasSize = { width: 1160, height: 700 }
const defaultGroups: Record<TeachingKind, { zh: string; en: string }> = {
  core: { zh: '核心概念', en: 'Core idea' }, foundation: { zh: '基础', en: 'Foundation' },
  principle: { zh: '原理', en: 'How it works' }, process: { zh: '过程', en: 'Process' },
  example: { zh: '案例', en: 'Worked case' }, pitfall: { zh: '易错点', en: 'Pitfall' },
}

function teachingKindFor(node: KnowledgeMapNode, index = 0): TeachingKind {
  if (node.kind) return node.kind
  if (node.role === 'core') return 'core'
  return (['foundation', 'principle', 'process', 'example', 'pitfall'][Math.min(index, 4)] || 'foundation') as TeachingKind
}

function visualKindFor(node: KnowledgeMapNode, index = 0): VisualKind {
  if (node.visual?.kind) return node.visual.kind
  const kind = teachingKindFor(node, index)
  if (kind === 'principle') return 'formula'
  if (kind === 'process') return 'stack'
  if (kind === 'example') return 'input_output'
  if (kind === 'pitfall') return 'warning'
  return 'definition'
}

function groupFor(node: KnowledgeMapNode, index: number, zh: boolean) {
  return node.group || defaultGroups[teachingKindFor(node, index)][zh ? 'zh' : 'en']
}

function shortText(value: string, limit: number) {
  const text = value.trim()
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function defaultPoint(index: number, kind: TeachingKind): Point {
  if (kind === 'core') return { x: 222, y: 356 }
  const positions: Point[] = [
    { x: 553, y: 152 }, { x: 892, y: 152 }, { x: 553, y: 392 },
    { x: 892, y: 390 }, { x: 710, y: 593 }, { x: 1054, y: 590 },
  ]
  return positions[Math.min(index, positions.length - 1)]
}

function orderedNodes(data: KnowledgeMapData) {
  const core = data.nodes.find(node => node.role === 'core') || data.nodes[0]
  return data.nodes
    .filter(node => node.id !== core.id)
    .sort((a, b) => (a.order || 99) - (b.order || 99))
}

function withPositions(data: KnowledgeMapData, reset = false): KnowledgeMapData {
  const core = data.nodes.find(node => node.role === 'core') || data.nodes[0]
  const others = orderedNodes(data)
  return {
    ...data,
    schema_version: Math.max(3, data.schema_version || 1),
    nodes: data.nodes.map(node => {
      const index = node.id === core.id ? 0 : Math.max(0, others.findIndex(item => item.id === node.id))
      return { ...node, position: reset || !node.position ? defaultPoint(index, teachingKindFor(node, index)) : node.position }
    }),
  }
}

function pointFor(data: KnowledgeMapData, node: KnowledgeMapNode): Point {
  const positioned = withPositions(data)
  return positioned.nodes.find(item => item.id === node.id)?.position || { x: canvasSize.width / 2, y: canvasSize.height / 2 }
}

function pathBetween(from: Point, to: Point) {
  const middle = from.x + (to.x - from.x) * .48
  return `M ${from.x} ${from.y} C ${middle} ${from.y}, ${middle} ${to.y}, ${to.x} ${to.y}`
}

function nodeStatus(progress: KnowledgeMapProgressState['progress'], nodeId: string): KnowledgeMapNodeStatus {
  return progress[nodeId] || 'new'
}

function summaryFor(data: KnowledgeMapData, progress: KnowledgeMapProgressState['progress']) {
  const mastered = data.nodes.filter(node => progress[node.id] === 'mastered').length
  const review = data.nodes.filter(node => progress[node.id] === 'review').length
  return { total: data.nodes.length, mastered, review, untouched: Math.max(0, data.nodes.length - mastered - review) }
}

function visualFallback(kind: VisualKind, node: KnowledgeMapNode) {
  if (kind === 'formula') return `“${node.label}”如何成立`
  if (kind === 'stack') return '逐层展开，再逐层返回'
  if (kind === 'input_output') return `用一个具体输入验证“${node.label}”`
  if (kind === 'warning') return node.mistake || `先检查“${node.label}”的必要条件`
  if (kind === 'comparison') return `分清“${node.label}”前后的变化`
  return `抓住“${node.label}”在主题中的作用`
}

function MapVisual({ node, index, compact = false }: { node: KnowledgeMapNode; index: number; compact?: boolean }) {
  const visual = node.visual || {}
  const kind = visualKindFor(node, index)
  const headline = visual.headline || visualFallback(kind, node)
  const items = (visual.items || []).filter(Boolean).slice(0, compact ? 2 : 3)
  if (kind === 'formula') return <div className="map-visual visual-formula"><strong>{visual.formula || headline}</strong><span>{visual.formula ? headline : ''}</span></div>
  if (kind === 'comparison') return <div className="map-visual visual-comparison"><span>{visual.before || items[0] || '原状态'}</span><ArrowRight size={14} /><strong>{visual.after || items[1] || headline}</strong></div>
  if (kind === 'stack') return <div className="map-visual visual-stack">{(items.length ? items : [headline]).map((item, step) => <span key={`${node.id}-${item}`}><i>{step + 1}</i>{item}</span>)}</div>
  if (kind === 'sequence') return <div className="map-visual visual-sequence">{(items.length ? items : [headline]).map((item, step) => <span key={`${node.id}-${item}`}><i>{step + 1}</i>{item}</span>)}</div>
  if (kind === 'code') return <div className="map-visual visual-code"><Braces size={14} /><code>{visual.code || headline}</code></div>
  if (kind === 'input_output') return <div className="map-visual visual-io"><span>{visual.input || items[0] || '输入'}</span><ArrowRight size={14} /><strong>{visual.output || items[1] || headline}</strong></div>
  if (kind === 'warning') return <div className="map-visual visual-warning"><AlertTriangle size={14} /><span>{headline}</span></div>
  return <div className="map-visual visual-definition"><Lightbulb size={14} /><span>{headline}</span></div>
}

export function EditableKnowledgeMap({
  data, reader = false, workspace = false, language = 'zh-CN', progress, progressLoading = false, progressSavingNodeId,
  onStatusChange, onReviewPractice, reviewPracticeGenerating = false, onMapChange, mapSaving = false,
  collaboration, collaborationLoading = false, onCollaboration, onDismissSuggestion,
}: {
  data: KnowledgeMapData
  reader?: boolean
  workspace?: boolean
  language?: 'zh-CN' | 'en'
  progress?: KnowledgeMapProgressState
  progressLoading?: boolean
  progressSavingNodeId?: string | null
  onStatusChange?: (nodeId: string, status: KnowledgeMapNodeStatus) => void
  onReviewPractice?: () => void
  reviewPracticeGenerating?: boolean
  onMapChange?: (map: KnowledgeMapData) => Promise<void> | void
  mapSaving?: boolean
  collaboration?: KnowledgeMapCollaboration
  collaborationLoading?: boolean
  onCollaboration?: () => void
  onDismissSuggestion?: (suggestion: KnowledgeMapCollaborationSuggestion) => void
}) {
  const initialCore = data.nodes.find(node => node.role === 'core') || data.nodes[0]
  const [working, setWorking] = useState(data)
  const workingRef = useRef(data)
  const [mode, setMode] = useState<CanvasMode>('read')
  const [tool, setTool] = useState<EditorTool>('move')
  const [selectedId, setSelectedId] = useState(data.learning_path[0] || initialCore.id)
  const [focusOpen, setFocusOpen] = useState(false)
  const [undoStack, setUndoStack] = useState<KnowledgeMapData[]>([])
  const [redoStack, setRedoStack] = useState<KnowledgeMapData[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragOrigin = useRef<KnowledgeMapData | null>(null)
  const [linkSource, setLinkSource] = useState<string | null>(null)
  const [linkPreview, setLinkPreview] = useState<Point | null>(null)
  const suppressNodeClick = useRef(false)
  const [relationType, setRelationType] = useState<'related' | 'prerequisite' | 'causal' | 'confusable'>('related')
  const [titleDraft, setTitleDraft] = useState('')
  const [detailDraft, setDetailDraft] = useState('')
  const [visualKindDraft, setVisualKindDraft] = useState<VisualKind>('definition')
  const [visualHeadlineDraft, setVisualHeadlineDraft] = useState('')
  const [visualPrimaryDraft, setVisualPrimaryDraft] = useState('')
  const [visualLeftDraft, setVisualLeftDraft] = useState('')
  const [visualRightDraft, setVisualRightDraft] = useState('')
  const [visualItemsDraft, setVisualItemsDraft] = useState('')
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [editorOpen, setEditorOpen] = useState(true)
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge | null>(null)
  const [edgeLabelDraft, setEdgeLabelDraft] = useState('')
  const [deleteEdgeArmed, setDeleteEdgeArmed] = useState(false)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const arrowId = `map-arrow-${useId().replace(/:/g, '')}`
  const zh = language !== 'en'
  const copy = zh ? {
    progress: '学习进度', mastered: '已理解', review: '薄弱点', edit: '编辑图解', finishEdit: '完成编辑', practice: '练习薄弱点', practicing: '生成中…',
    move: '移动', connect: '连线', autoLayout: '自动整理', addNode: '添加节点', undo: '撤销', redo: '重做', delete: '删除', deleteConfirm: '确认删除',
    relation: '关系', related: '关联', prerequisite: '前置', causal: '因果', confusable: '易混淆', save: '保存中…', saved: '已同步',
    detail: '展开说明', example: '例子', mistake: '易错点', understood: '已理解', toReview: '标记薄弱', close: '收起', collaboration: '智能整理', collaborationLoading: '正在检查结构…', apply: '采纳', dismiss: '忽略',
    path: '学习路线', editorHint: '拖动节点调整位置；选择连线后，从一个节点拖到另一个节点。', limit: '最多保留 14 个节点。', nodeContent: '节点内容', nodeLabel: '名称', nodeDetail: '说明', applyNode: '应用修改',
  } : {
    progress: 'Progress', mastered: 'Understood', review: 'Weak points', edit: 'Edit map', finishEdit: 'Done editing', practice: 'Practice weak points', practicing: 'Generating…',
    move: 'Move', connect: 'Connect', autoLayout: 'Auto-arrange', addNode: 'Add node', undo: 'Undo', redo: 'Redo', delete: 'Delete', deleteConfirm: 'Confirm delete',
    relation: 'Relation', related: 'Related', prerequisite: 'Prerequisite', causal: 'Cause & effect', confusable: 'Easy to confuse', save: 'Saving…', saved: 'Synced',
    detail: 'Full explanation', example: 'Example', mistake: 'Pitfall', understood: 'Understood', toReview: 'Needs work', close: 'Close', collaboration: 'Smart refine', collaborationLoading: 'Checking structure…', apply: 'Apply', dismiss: 'Dismiss',
    path: 'Learning path', editorHint: 'Drag nodes to reposition. In connect mode, drag from one node to another.', limit: 'This map already has 14 nodes.', nodeContent: 'Node content', nodeLabel: 'Title', nodeDetail: 'Explanation', applyNode: 'Apply changes',
  }
  const editorCopy = zh ? {
    visual: '教学展示', visualKind: '展示方式', visualText: '提示文本', visualFormula: '公式或关系式', visualCode: '代码片段', visualLeft: '左侧', visualRight: '右侧', visualSteps: '步骤（每行一项）',
    definition: '概念', formula: '公式', comparison: '对比', stack: '调用栈', sequence: '步骤', code: '代码', input_output: '输入输出', warning: '易错提示',
    edgeContent: '连线关系', edgeLabel: '关系说明', applyEdge: '保存关系', deleteEdge: '移除连线', deleteEdgeConfirm: '确认移除', edgeHint: '点击画布中的连线，可修改关系说明或移除它。',
  } : {
    visual: 'Teaching display', visualKind: 'Display type', visualText: 'Teaching prompt', visualFormula: 'Formula or relationship', visualCode: 'Code fragment', visualLeft: 'Left side', visualRight: 'Right side', visualSteps: 'Steps (one per line)',
    definition: 'Definition', formula: 'Formula', comparison: 'Comparison', stack: 'Call stack', sequence: 'Sequence', code: 'Code', input_output: 'Input/output', warning: 'Pitfall',
    edgeContent: 'Connection', edgeLabel: 'Relationship label', applyEdge: 'Save relationship', deleteEdge: 'Remove line', deleteEdgeConfirm: 'Confirm removal', edgeHint: 'Click a line on the canvas to rename or remove it.',
  }

  useEffect(() => {
    // Parent state is refreshed after every autosave.  When that response is
    // normalized by the server, it may gain harmless default fields.  While
    // editing, keep the local history intact so the learner can undo the
    // change they just made instead of receiving a fresh, empty history.
    if (mode === 'edit' || JSON.stringify(data) === JSON.stringify(workingRef.current)) return
    setWorking(data)
    workingRef.current = data
    setUndoStack([])
    setRedoStack([])
    setSelectedId(current => data.nodes.some(node => node.id === current) ? current : (data.learning_path[0] || data.nodes[0]?.id || ''))
  }, [data, mode])

  const positioned = withPositions(working)
  const core = positioned.nodes.find(node => node.role === 'core') || positioned.nodes[0]
  const branches = orderedNodes(positioned)
  const selectedNode = positioned.nodes.find(node => node.id === selectedId) || core
  const selectedIndex = selectedNode.id === core.id ? 0 : Math.max(0, branches.findIndex(node => node.id === selectedNode.id))
  const progressState = progress?.progress || {}
  const summary = progress?.summary || summaryFor(positioned, progressState)
  const relationLabel = copy[relationType]
  const visibleEdges = mode === 'edit' ? positioned.edges : positioned.edges.filter(edge => edge.from === core.id || edge.to === core.id)
  const activeEdge = selectedEdge && positioned.edges.find(edge => edge.from === selectedEdge.from && edge.to === selectedEdge.to)
  const activeEdgeFrom = activeEdge && positioned.nodes.find(node => node.id === activeEdge.from)
  const activeEdgeTo = activeEdge && positioned.nodes.find(node => node.id === activeEdge.to)
  const selectedNodeDraft = JSON.stringify({ id: selectedNode.id, label: selectedNode.label, detail: selectedNode.detail, visual: selectedNode.visual || {} })

  useEffect(() => {
    const draftNode = JSON.parse(selectedNodeDraft) as KnowledgeMapNode
    setTitleDraft(draftNode.label || '')
    setDetailDraft(draftNode.detail || '')
    const visual = draftNode.visual || {}
    const kind = visualKindFor(draftNode, selectedIndex)
    setVisualKindDraft(kind)
    setVisualHeadlineDraft(visual.headline || visualFallback(kind, draftNode))
    setVisualPrimaryDraft(kind === 'formula' ? (visual.formula || '') : (kind === 'code' ? (visual.code || '') : ''))
    setVisualLeftDraft(kind === 'comparison' ? (visual.before || visual.items?.[0] || '') : (kind === 'input_output' ? (visual.input || visual.items?.[0] || '') : ''))
    setVisualRightDraft(kind === 'comparison' ? (visual.after || visual.items?.[1] || '') : (kind === 'input_output' ? (visual.output || visual.items?.[1] || '') : ''))
    setVisualItemsDraft(['stack', 'sequence'].includes(kind) ? (visual.items || []).slice(0, 3).join('\n') : '')
    setDeleteArmed(false)
  }, [selectedIndex, selectedNodeDraft])

  function changeWorking(next: KnowledgeMapData) {
    workingRef.current = next
    setWorking(next)
  }
  function persist(next: KnowledgeMapData) {
    void Promise.resolve(onMapChange?.(next)).catch(() => undefined)
  }
  function commit(next: KnowledgeMapData, previous = workingRef.current) {
    if (JSON.stringify(next) === JSON.stringify(previous)) return
    setUndoStack(stack => [...stack.slice(-19), previous])
    setRedoStack([])
    changeWorking(next)
    persist(next)
  }
  function pointFrom(event: { clientX: number; clientY: number }): Point | null {
    const surface = surfaceRef.current
    if (!surface) return null
    const rect = surface.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    return {
      x: Math.max(120, Math.min(canvasSize.width - 105, (event.clientX - rect.left) / rect.width * canvasSize.width)),
      y: Math.max(92, Math.min(canvasSize.height - 86, (event.clientY - rect.top) / rect.height * canvasSize.height)),
    }
  }
  function selectNode(nodeId: string) {
    if (mode === 'read') { setSelectedId(nodeId); setFocusOpen(true); return }
    if (tool === 'move') setEditorOpen(true)
    setSelectedEdge(null); setDeleteEdgeArmed(false)
    if (tool === 'connect') {
      if (linkSource && linkSource !== nodeId) {
        if (!positioned.edges.some(edge => edge.from === linkSource && edge.to === nodeId)) commit({ ...positioned, edges: [...positioned.edges, { from: linkSource, to: nodeId, label: relationLabel }] })
        setLinkSource(null); setLinkPreview(null)
      } else { setLinkSource(nodeId); setLinkPreview(pointFor(positioned, positioned.nodes.find(node => node.id === nodeId) || core)) }
      return
    }
    setSelectedId(nodeId)
  }
  function nodePointerDown(event: ReactPointerEvent<HTMLButtonElement>, nodeId: string) {
    if (mode !== 'edit') return
    event.stopPropagation()
    setSelectedId(nodeId)
    setSelectedEdge(null); setDeleteEdgeArmed(false)
    if (tool === 'connect') { event.preventDefault(); suppressNodeClick.current = true; selectNode(nodeId); return }
    event.currentTarget.setPointerCapture(event.pointerId)
    dragOrigin.current = positioned
    setDraggingId(nodeId)
  }
  function canvasPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (mode !== 'edit') return
    const point = pointFrom(event)
    if (!point) return
    if (draggingId) changeWorking({ ...workingRef.current, nodes: workingRef.current.nodes.map(node => node.id === draggingId ? { ...node, position: point } : node) })
    else if (linkSource) setLinkPreview(point)
  }
  function canvasPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (draggingId) {
      const previous = dragOrigin.current || positioned
      dragOrigin.current = null
      setDraggingId(null)
      commit(workingRef.current, previous)
    }
    if (linkSource) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-map-node]')?.dataset.mapNode
      if (target === linkSource) return
      if (target && !positioned.edges.some(edge => edge.from === linkSource && edge.to === target)) {
        commit({ ...positioned, edges: [...positioned.edges, { from: linkSource, to: target, label: relationLabel }] })
      }
      setLinkSource(null); setLinkPreview(null)
    }
  }
  function autoArrange() { commit(withPositions(positioned, true)) }
  function addNode() {
    if (positioned.nodes.length >= 14) return
    const id = `user-${Date.now().toString(36)}`
    const node: KnowledgeMapNode = { id, label: zh ? '新知识点' : 'New concept', role: 'detail', kind: 'foundation', group: zh ? '补充' : 'Extra', order: positioned.nodes.length, detail: zh ? '补充这个知识点的说明。' : 'Add a concise explanation for this concept.', visual: { kind: 'definition', headline: zh ? '说明它和主题的关系' : 'Explain how it relates to the topic' } }
    const next = withPositions({ ...positioned, nodes: [...positioned.nodes, node], edges: [...positioned.edges, { from: selectedNode.id, to: id, label: relationLabel }], learning_path: [...positioned.learning_path, id] }, true)
    commit(next); setSelectedId(id)
  }
  function saveNodeContent() {
    const label = titleDraft.trim().slice(0, 24)
    if (!label || positioned.nodes.some(node => node.id !== selectedNode.id && node.label === label)) return
    const visual = {
      kind: visualKindDraft,
      headline: visualHeadlineDraft.trim().slice(0, 120),
      items: ['stack', 'sequence'].includes(visualKindDraft) ? visualItemsDraft.split('\n').map(item => item.trim()).filter(Boolean).slice(0, 3) : [],
      code: visualKindDraft === 'code' ? visualPrimaryDraft.trim().slice(0, 240) : '',
      input: visualKindDraft === 'input_output' ? visualLeftDraft.trim().slice(0, 120) : '',
      output: visualKindDraft === 'input_output' ? visualRightDraft.trim().slice(0, 120) : '',
      formula: visualKindDraft === 'formula' ? visualPrimaryDraft.trim().slice(0, 160) : '',
      before: visualKindDraft === 'comparison' ? visualLeftDraft.trim().slice(0, 120) : '',
      after: visualKindDraft === 'comparison' ? visualRightDraft.trim().slice(0, 120) : '',
    }
    commit({ ...positioned, nodes: positioned.nodes.map(node => node.id === selectedNode.id ? { ...node, label, detail: detailDraft.trim().slice(0, 300), visual } : node) })
  }
  function deleteNode() {
    if (!deleteArmed) { setDeleteArmed(true); return }
    if (positioned.nodes.length <= 3) return
    let nodes = positioned.nodes.filter(node => node.id !== selectedNode.id)
    if (!nodes.some(node => node.role === 'core')) nodes = nodes.map((node, index) => ({ ...node, role: index === 0 ? 'core' : node.role }))
    commit({ ...positioned, nodes, edges: positioned.edges.filter(edge => edge.from !== selectedNode.id && edge.to !== selectedNode.id), learning_path: positioned.learning_path.filter(id => id !== selectedNode.id) })
    setSelectedId(nodes[0].id); setSelectedEdge(null); setDeleteArmed(false)
  }
  function selectEdge(edge: KnowledgeMapData['edges'][number]) {
    if (mode !== 'edit') return
    setEditorOpen(true)
    setSelectedEdge({ from: edge.from, to: edge.to })
    setEdgeLabelDraft(edge.label || '')
    setDeleteEdgeArmed(false)
    setLinkSource(null); setLinkPreview(null)
  }
  function saveEdge() {
    if (!activeEdge) return
    const label = edgeLabelDraft.trim().slice(0, 24)
    commit({ ...positioned, edges: positioned.edges.map(edge => edge.from === activeEdge.from && edge.to === activeEdge.to ? { ...edge, label } : edge) })
  }
  function deleteEdge() {
    if (!activeEdge) return
    if (!deleteEdgeArmed) { setDeleteEdgeArmed(true); return }
    commit({ ...positioned, edges: positioned.edges.filter(edge => edge.from !== activeEdge.from || edge.to !== activeEdge.to) })
    setSelectedEdge(null); setDeleteEdgeArmed(false)
  }
  function undo() {
    const previous = undoStack[undoStack.length - 1]
    if (!previous) return
    setUndoStack(stack => stack.slice(0, -1)); setRedoStack(stack => [workingRef.current, ...stack].slice(0, 20)); changeWorking(previous); persist(previous)
  }
  function redo() {
    const next = redoStack[0]
    if (!next) return
    setRedoStack(stack => stack.slice(1)); setUndoStack(stack => [...stack, workingRef.current].slice(-20)); changeWorking(next); persist(next)
  }
  function applySuggestion(suggestion: KnowledgeMapCollaborationSuggestion) {
    if (suggestion.kind === 'review') onStatusChange?.(suggestion.node_id, 'review')
    else if (suggestion.kind === 'edge' && !positioned.edges.some(edge => edge.from === suggestion.from && edge.to === suggestion.to)) commit({ ...positioned, edges: [...positioned.edges, { from: suggestion.from, to: suggestion.to, label: suggestion.label }] })
    else if (suggestion.kind === 'node_note') commit({ ...positioned, nodes: positioned.nodes.map(node => node.id === suggestion.node_id ? { ...node, [suggestion.field]: suggestion.value } : node) })
    else if (suggestion.kind === 'new_node' && positioned.nodes.length < 14) {
      const id = `agent-${Date.now().toString(36)}`
      const node: KnowledgeMapNode = { id, label: suggestion.label, role: suggestion.role, kind: 'foundation', group: zh ? '补充' : 'Extra', detail: suggestion.detail, visual: { kind: 'definition', headline: suggestion.detail } }
      commit(withPositions({ ...positioned, nodes: [...positioned.nodes, node], edges: [...positioned.edges, { from: suggestion.from, to: id, label: suggestion.label_edge }], learning_path: [...positioned.learning_path, id] }, true)); setSelectedId(id)
    }
    onDismissSuggestion?.(suggestion)
  }
  function nodeStyle(node: KnowledgeMapNode) {
    const point = pointFor(positioned, node)
    return { '--node-x': `${point.x / canvasSize.width * 100}%`, '--node-y': `${point.y / canvasSize.height * 100}%` } as CSSProperties
  }
  function nodeIndex(node: KnowledgeMapNode) { return node.id === core.id ? 0 : Math.max(0, branches.findIndex(item => item.id === node.id)) }

  return <section className={`knowledge-map knowledge-map-canvas-workspace ${reader ? 'knowledge-map-reader' : ''} ${workspace ? 'knowledge-map-workspace' : ''} mode-${mode}`} aria-label={zh ? '互动式知识图解' : 'Interactive knowledge map'}>
    <div className="knowledge-map-overview">
      <span>{copy.progress}</span>
      {progressLoading ? <small>{zh ? '正在载入…' : 'Loading…'}</small> : <div><b>{summary.mastered}/{summary.total}</b><small>{copy.mastered}</small>{summary.review > 0 && <em>{summary.review} {copy.review}</em>}</div>}
      <div className="knowledge-map-overview-actions">
        {onReviewPractice && summary.review > 0 && <button type="button" disabled={reviewPracticeGenerating} onClick={onReviewPractice}>{reviewPracticeGenerating ? copy.practicing : copy.practice}</button>}
        {onMapChange && <button type="button" className={mode === 'edit' ? 'active' : ''} onClick={() => { if (mode === 'read') setEditorOpen(true); setMode(current => current === 'edit' ? 'read' : 'edit') }}><MousePointer2 size={13} />{mode === 'edit' ? copy.finishEdit : copy.edit}</button>}
      </div>
    </div>

    <div ref={surfaceRef} className="map-full-canvas" onPointerMove={canvasPointerMove} onPointerUp={canvasPointerUp} onPointerCancel={canvasPointerUp}>
      <svg className="map-canvas-lines" viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`} aria-hidden={mode === 'read'}>
        <defs><marker id={arrowId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" /></marker></defs>
        {visibleEdges.map((edge, index) => {
          const fromNode = positioned.nodes.find(node => node.id === edge.from); const toNode = positioned.nodes.find(node => node.id === edge.to)
          if (!fromNode || !toNode) return null
          const from = pointFor(positioned, fromNode); const to = pointFor(positioned, toNode)
          const isSelected = selectedEdge?.from === edge.from && selectedEdge?.to === edge.to
          const showLabel = mode === 'edit' && (isSelected || edge.from === selectedNode.id || edge.to === selectedNode.id || edge.from === linkSource)
          const selectCurrentEdge = () => selectEdge(edge)
          return <g className={`map-canvas-edge ${showLabel ? 'is-labeled' : ''} ${isSelected ? 'is-selected' : ''}`} key={`${edge.from}-${edge.to}-${index}`} role={mode === 'edit' ? 'button' : undefined} tabIndex={mode === 'edit' ? 0 : undefined} aria-label={mode === 'edit' ? `${editorCopy.edgeContent}: ${fromNode.label} ${edge.label || relationLabel} ${toNode.label}` : undefined} onPointerDown={event => { if (mode === 'edit') event.stopPropagation() }} onClick={selectCurrentEdge} onKeyDown={event => { if (mode === 'edit' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectCurrentEdge() } }}><path className="map-canvas-edge-hit" d={pathBetween(from, to)} /> <path d={pathBetween(from, to)} markerEnd={`url(#${arrowId})`} />{showLabel && edge.label && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8}>{edge.label}</text>}</g>
        })}
        {mode === 'edit' && linkSource && linkPreview && <path className="map-canvas-edge-preview" d={pathBetween(pointFor(positioned, positioned.nodes.find(node => node.id === linkSource) || core), linkPreview)} />}
      </svg>

      {positioned.nodes.map(node => {
        const index = nodeIndex(node); const kind = teachingKindFor(node, index); const status = nodeStatus(progressState, node.id); const active = selectedNode.id === node.id
        return <button type="button" key={node.id} data-map-node={node.id} className={`map-canvas-node kind-${kind} node-visual-${visualKindFor(node, index)} status-${status} ${active ? 'is-active' : ''} ${mode === 'edit' ? 'is-editing' : ''}`} style={nodeStyle(node)} onClick={() => { if (suppressNodeClick.current) { suppressNodeClick.current = false; return } selectNode(node.id) }} onPointerDown={event => nodePointerDown(event, node.id)} aria-pressed={active}>
          <span className="map-node-group">{groupFor(node, index, zh)}</span>
          <strong>{node.label}</strong>
          <p>{shortText(node.detail || (zh ? '点击查看说明。' : 'Click for an explanation.'), kind === 'core' ? 116 : 72)}</p>
          <MapVisual node={node} index={index} compact={mode === 'edit'} />
          {status !== 'new' && <i className="map-node-status">{status === 'mastered' ? <Check size={12} /> : <AlertTriangle size={12} />}</i>}
        </button>
      })}

      {mode === 'read' && focusOpen && <section className="map-focus-sheet" aria-live="polite">
        <button className="map-focus-close" type="button" onClick={() => setFocusOpen(false)} aria-label={copy.close}><X size={15} /></button>
        <div><span>{groupFor(selectedNode, selectedIndex, zh)}</span><h2>{selectedNode.label}</h2></div>
        <p>{selectedNode.detail}</p>
        <MapVisual node={selectedNode} index={selectedIndex} />
        {selectedNode.example && <small><b>{copy.example}</b>{selectedNode.example}</small>}
        {selectedNode.mistake && <small className="focus-mistake"><b>{copy.mistake}</b>{selectedNode.mistake}</small>}
        {onStatusChange && <div className="map-focus-actions"><button type="button" className={nodeStatus(progressState, selectedNode.id) === 'review' ? 'review active' : ''} disabled={progressSavingNodeId === selectedNode.id} onClick={() => onStatusChange(selectedNode.id, 'review')}>{copy.toReview}</button><button type="button" className={nodeStatus(progressState, selectedNode.id) === 'mastered' ? 'mastered active' : ''} disabled={progressSavingNodeId === selectedNode.id} onClick={() => onStatusChange(selectedNode.id, 'mastered')}><Check size={13} />{copy.understood}</button></div>}
      </section>}

      {mode === 'edit' && <>
        <div className="map-editor-toolbar">
          <button type="button" className={tool === 'move' ? 'active' : ''} onClick={() => setTool('move')}><MousePointer2 size={13} />{copy.move}</button>
          <button type="button" className={tool === 'connect' ? 'active' : ''} onClick={() => setTool('connect')}><GitBranchPlus size={13} />{copy.connect}</button>
          <label>{copy.relation}<select value={relationType} onChange={event => setRelationType(event.target.value as typeof relationType)}><option value="related">{copy.related}</option><option value="prerequisite">{copy.prerequisite}</option><option value="causal">{copy.causal}</option><option value="confusable">{copy.confusable}</option></select></label>
          <button type="button" onClick={autoArrange}><Sparkles size={13} />{copy.autoLayout}</button>
          <button type="button" onClick={addNode} disabled={positioned.nodes.length >= 14}><CirclePlus size={14} />{copy.addNode}</button>
          <button type="button" onClick={undo} disabled={!undoStack.length}><Undo2 size={13} />{copy.undo}</button>
          <button type="button" onClick={redo} disabled={!redoStack.length}><Redo2 size={13} />{copy.redo}</button>
          {onCollaboration && <button type="button" disabled={collaborationLoading} onClick={onCollaboration}><Sparkles size={13} />{collaborationLoading ? copy.collaborationLoading : copy.collaboration}</button>}
          <span>{mapSaving ? <><Save size={13} />{copy.save}</> : <><Check size={13} />{copy.saved}</>}</span>
        </div>
        {editorOpen && <section className="map-editor-drawer" aria-live="polite">
          {activeEdge ? <>
            <div className="map-editor-drawer-head"><b>{editorCopy.edgeContent}</b><span className="map-editor-drawer-actions"><button type="button" className={deleteEdgeArmed ? 'delete armed' : 'delete'} onClick={deleteEdge}><Trash2 size={13} />{deleteEdgeArmed ? editorCopy.deleteEdgeConfirm : editorCopy.deleteEdge}</button><button type="button" className="map-editor-close" aria-label={zh ? '关闭编辑面板' : 'Close editor'} onClick={() => setEditorOpen(false)}><X size={14} /></button></span></div>
            <p className="map-edge-path"><b>{activeEdgeFrom?.label}</b><ArrowRight size={14} /><b>{activeEdgeTo?.label}</b></p>
            <label>{editorCopy.edgeLabel}<input value={edgeLabelDraft} maxLength={24} onChange={event => setEdgeLabelDraft(event.target.value)} /></label>
            <button type="button" className="apply-node" onClick={saveEdge}>{editorCopy.applyEdge}</button>
            <small>{editorCopy.edgeHint}</small>
          </> : <>
            <div className="map-editor-drawer-head"><b>{copy.nodeContent}</b><span className="map-editor-drawer-actions"><button type="button" className={deleteArmed ? 'delete armed' : 'delete'} disabled={positioned.nodes.length <= 3} onClick={deleteNode}><Trash2 size={13} />{deleteArmed ? copy.deleteConfirm : copy.delete}</button><button type="button" className="map-editor-close" aria-label={zh ? '关闭编辑面板' : 'Close editor'} onClick={() => setEditorOpen(false)}><X size={14} /></button></span></div>
            <label>{copy.nodeLabel}<input value={titleDraft} maxLength={24} onChange={event => setTitleDraft(event.target.value)} /></label>
            <label>{copy.nodeDetail}<textarea value={detailDraft} maxLength={300} rows={3} onChange={event => setDetailDraft(event.target.value)} /></label>
            <section className="map-editor-visual">
              <b>{editorCopy.visual}</b>
              <label>{editorCopy.visualKind}<select value={visualKindDraft} onChange={event => setVisualKindDraft(event.target.value as VisualKind)}><option value="definition">{editorCopy.definition}</option><option value="formula">{editorCopy.formula}</option><option value="comparison">{editorCopy.comparison}</option><option value="stack">{editorCopy.stack}</option><option value="sequence">{editorCopy.sequence}</option><option value="code">{editorCopy.code}</option><option value="input_output">{editorCopy.input_output}</option><option value="warning">{editorCopy.warning}</option></select></label>
              {['definition', 'warning', 'formula', 'code'].includes(visualKindDraft) && <label>{visualKindDraft === 'formula' ? editorCopy.visualFormula : visualKindDraft === 'code' ? editorCopy.visualCode : editorCopy.visualText}<input value={visualKindDraft === 'formula' || visualKindDraft === 'code' ? visualPrimaryDraft : visualHeadlineDraft} maxLength={visualKindDraft === 'code' ? 240 : 160} onChange={event => visualKindDraft === 'formula' || visualKindDraft === 'code' ? setVisualPrimaryDraft(event.target.value) : setVisualHeadlineDraft(event.target.value)} /></label>}
              {['formula', 'code'].includes(visualKindDraft) && <label>{editorCopy.visualText}<input value={visualHeadlineDraft} maxLength={120} onChange={event => setVisualHeadlineDraft(event.target.value)} /></label>}
              {['comparison', 'input_output'].includes(visualKindDraft) && <div className="map-editor-visual-pair"><label>{editorCopy.visualLeft}<input value={visualLeftDraft} maxLength={120} onChange={event => setVisualLeftDraft(event.target.value)} /></label><label>{editorCopy.visualRight}<input value={visualRightDraft} maxLength={120} onChange={event => setVisualRightDraft(event.target.value)} /></label></div>}
              {['stack', 'sequence'].includes(visualKindDraft) && <label>{editorCopy.visualSteps}<textarea value={visualItemsDraft} maxLength={360} rows={3} onChange={event => setVisualItemsDraft(event.target.value)} /></label>}
            </section>
            <button type="button" className="apply-node" onClick={saveNodeContent}>{copy.applyNode}</button>
            <small>{positioned.nodes.length >= 14 ? copy.limit : tool === 'connect' ? copy.editorHint : editorCopy.edgeHint}</small>
          </>}
        </section>}
        {(collaborationLoading || collaboration?.suggestions.length) && <section className="map-collaboration-sheet"><p>{collaborationLoading ? copy.collaborationLoading : collaboration?.summary}</p>{collaboration?.suggestions.slice(0, 3).map((suggestion, index) => <article key={`${suggestion.kind}-${index}`}><span>{suggestion.reason}</span><div><button type="button" onClick={() => applySuggestion(suggestion)}>{copy.apply}</button><button type="button" onClick={() => onDismissSuggestion?.(suggestion)}>{copy.dismiss}</button></div></article>)}</section>}
      </>}
    </div>

    <div className="map-learning-track" aria-label={copy.path}><span>{copy.path}</span>{positioned.learning_path.map((id, index) => { const node = positioned.nodes.find(item => item.id === id); return node && <button type="button" className={selectedNode.id === id ? 'active' : ''} key={id} onClick={() => { setSelectedId(id); if (mode === 'read') setFocusOpen(true) }}>{index + 1}. {node.label}</button> })}</div>
  </section>
}
