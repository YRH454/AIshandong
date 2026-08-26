import { useEffect, useMemo, useRef, useState } from 'react'
import { Graph, NodeEvent, treeToGraphData } from '@antv/g6'
import {
  ArrowLeftRegular,
  ArrowResetRegular,
  ArrowRightRegular,
  BeakerRegular,
  BookOpenRegular,
  BranchRegular,
  BrainRegular,
  CheckmarkRegular,
  DismissRegular,
  FlowRegular,
  LightbulbRegular,
  TargetRegular,
  WarningRegular,
  ZoomInRegular,
  ZoomOutRegular,
} from '@fluentui/react-icons'
import type {
  KnowledgeMapData,
  KnowledgeMapDeepDive,
  KnowledgeMapExplorationState,
  KnowledgeMapNode,
  KnowledgeMapProgressState,
} from './EditableKnowledgeMap'
import type {
  KnowledgeMapCollaboration,
  KnowledgeMapCollaborationSuggestion,
  KnowledgeMapNodeStatus,
} from '../services/api'
import './G6KnowledgeMap.css'

type G6KnowledgeMapProps = {
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
  onGenerateDeepDive?: (nodeId: string, force?: boolean) => Promise<KnowledgeMapDeepDive>
  exploration?: KnowledgeMapExplorationState
  explorationKey?: string
  onExplorationChange?: (state: KnowledgeMapExplorationState) => void
  deepDiveDepth?: number
}

type MapTreeNode = {
  id: string
  label: string
  children?: MapTreeNode[]
  data: {
    node: KnowledgeMapNode
    branchIndex: number
    color: string
  }
}

type MapFrame = {
  title: string
  sourceNodeId: string
  data: KnowledgeMapData
}

const branchPalette = ['#b45cf4', '#3987ff', '#ff9b54', '#2cae9c', '#e95f83', '#a67a46', '#6478e8', '#d452aa']

function rootFor(data: KnowledgeMapData) {
  return data.nodes.find(node => node.role === 'core') || data.nodes[0]
}

function childrenFor(data: KnowledgeMapData, parentId: string) {
  const edgeChildren = data.edges
    .filter(edge => edge.from === parentId)
    .map(edge => data.nodes.find(node => node.id === edge.to))
    .filter((node): node is KnowledgeMapNode => Boolean(node))
  const parentChildren = data.nodes.filter(node => node.parent_id === parentId)
  const seen = new Set<string>()
  return [...edgeChildren, ...parentChildren]
    .filter(node => {
      if (seen.has(node.id)) return false
      seen.add(node.id)
      return true
    })
    .sort((a, b) => (a.order || Number.MAX_SAFE_INTEGER) - (b.order || Number.MAX_SAFE_INTEGER))
}

function buildTree(data: KnowledgeMapData) {
  const root = rootFor(data)
  if (!root) return null

  const build = (node: KnowledgeMapNode, branchIndex: number, path: Set<string>): MapTreeNode => {
    const nextPath = new Set(path)
    nextPath.add(node.id)
    const children = childrenFor(data, node.id)
      .filter(child => !nextPath.has(child.id))
      .map((child, index) => build(child, node.id === root.id ? index : branchIndex, nextPath))
    return {
      id: node.id,
      label: node.label,
      data: {
        node,
        branchIndex,
        color: branchPalette[Math.max(0, branchIndex) % branchPalette.length],
      },
      ...(children.length ? { children } : {}),
    }
  }

  const tree = build(root, -1, new Set())
  const included = new Set<string>()
  const visit = (entry: MapTreeNode) => {
    included.add(entry.id)
    entry.children?.forEach(visit)
  }
  visit(tree)
  const detached = data.nodes
    .filter(node => node.id !== root.id && !included.has(node.id))
    .sort((a, b) => (a.order || Number.MAX_SAFE_INTEGER) - (b.order || Number.MAX_SAFE_INTEGER))
    .map((node, index) => build(node, index + (tree.children?.length || 0), new Set([root.id])))
  if (detached.length) tree.children = [...(tree.children || []), ...detached]
  return tree
}

function mapTitle(data: KnowledgeMapData, language: 'zh-CN' | 'en') {
  const root = rootFor(data)
  if (root?.label) return root.label
  return language === 'en' ? 'Knowledge map' : '知识图解'
}

function shortLabel(label: string, limit = 22) {
  return label.length > limit ? `${label.slice(0, limit - 1)}…` : label
}

function roleLabel(node: KnowledgeMapNode, language: 'zh-CN' | 'en') {
  const zh = language !== 'en'
  const kind = node.kind || (node.role === 'core' ? 'core' : 'foundation')
  const labels = zh
    ? { core: '主题核心', foundation: '基础概念', principle: '关键原理', process: '推理过程', example: '例题应用', pitfall: '易错提醒' }
    : { core: 'Core topic', foundation: 'Foundation', principle: 'Principle', process: 'Process', example: 'Worked example', pitfall: 'Pitfall' }
  return labels[kind]
}

function NodeGlyph({ node }: { node: KnowledgeMapNode }) {
  const kind = node.kind || (node.role === 'core' ? 'core' : 'foundation')
  if (kind === 'core') return <BrainRegular />
  if (kind === 'principle') return <LightbulbRegular />
  if (kind === 'process') return <FlowRegular />
  if (kind === 'example') return <BeakerRegular />
  if (kind === 'pitfall') return <WarningRegular />
  return <BookOpenRegular />
}

export function G6KnowledgeMap(props: G6KnowledgeMapProps) {
  const language = props.language || 'zh-CN'
  const zh = language !== 'en'
  const canvasRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Graph | null>(null)
  const exploredRef = useRef<Set<string>>(new Set(props.exploration?.explored_node_ids || []))
  const rootIdRef = useRef(rootFor(props.data)?.id)
  const [frames, setFrames] = useState<MapFrame[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanding, setExpanding] = useState(false)
  const [expandError, setExpandError] = useState<string | null>(null)

  const current = frames.at(-1)?.data || props.data
  const currentTitle = frames.at(-1)?.title || mapTitle(current, language)
  const currentRoot = rootFor(current)
  const graphTree = useMemo(() => buildTree(current), [current])
  const graphKey = useMemo(() => `${currentRoot?.id || 'empty'}:${current.nodes.map(node => node.id).join('|')}`, [current, currentRoot?.id])
  const selectedNode = current.nodes.find(node => node.id === selectedId) || null
  const total = props.progress?.summary.total ?? Math.max(0, props.data.nodes.filter(node => node.role !== 'core').length)
  const mastered = props.progress?.summary.mastered ?? 0
  const canOpenDeepDive = frames.length === 0 && Boolean(selectedNode && selectedNode.id !== currentRoot?.id)

  useEffect(() => {
    const nextRootId = rootFor(props.data)?.id
    if (rootIdRef.current !== nextRootId) {
      rootIdRef.current = nextRootId
      setFrames([])
      setSelectedId(null)
      setExpandError(null)
    }
  }, [props.data])

  useEffect(() => {
    if (!props.exploration) return
    exploredRef.current = new Set(props.exploration.explored_node_ids)
  }, [props.exploration])

  useEffect(() => {
    const container = canvasRef.current
    if (!container || !graphTree) return
    const graphData = treeToGraphData(graphTree, {
      getNodeData: datum => {
        const entry = datum as MapTreeNode
        const node = entry.data.node
        const isRoot = node.id === currentRoot?.id
        return {
          id: entry.id,
          data: entry.data,
          children: entry.children?.map(child => child.id),
          style: {
            size: isRoot ? [194, 58] : [228, 52],
            radius: isRoot ? 10 : 8,
            fill: isRoot ? '#eff0f2' : 'rgba(255,255,255,0)',
            stroke: isRoot ? '#dedfe4' : 'rgba(255,255,255,0)',
            lineWidth: isRoot ? 1 : 0,
            labelText: shortLabel(entry.label),
            labelFill: isRoot ? '#53565f' : '#2f3138',
            labelFontSize: isRoot ? 17 : 14,
            labelFontWeight: isRoot ? 650 : 440,
            labelFontFamily: 'Inter, PingFang SC, Microsoft YaHei, sans-serif',
            labelMaxWidth: isRoot ? 164 : 206,
            labelWordWrap: true,
            labelLineHeight: 20,
            cursor: 'pointer',
            halo: false,
          },
        }
      },
      getEdgeData: (source, target) => {
        const targetEntry = target as MapTreeNode
        return {
          source: String(source.id),
          target: String(target.id),
          data: { color: targetEntry.data.color },
          style: {
            stroke: targetEntry.data.color,
            lineWidth: 2.4,
            opacity: 0.94,
            lineCap: 'round',
          },
        }
      },
    })

    let destroyed = false
    let graph: Graph | null = null
    // G6 performs async canvas setup. Deferring it by one frame keeps React
    // development-mode effect replay from constructing and immediately
    // destroying the same canvas instance.
    const frame = window.requestAnimationFrame(() => {
      if (destroyed) return
      graph = new Graph({
        container,
        data: graphData,
        autoResize: true,
        autoFit: 'view',
        padding: [92, 158, 94, 158],
        animation: { duration: 460, easing: 'ease-in-out' },
        node: { type: 'rect' },
        edge: { type: 'cubic-horizontal' },
        layout: {
          type: 'mindmap',
          direction: 'H',
          getWidth: () => 228,
          getHeight: () => 52,
          getHGap: () => 70,
          getVGap: () => 18,
          getSide: (_child: unknown, index: number) => index % 2 === 0 ? 'left' : 'right',
        },
        behaviors: [
          { type: 'drag-canvas' },
          { type: 'zoom-canvas', sensitivity: 1.05 },
          { type: 'collapse-expand', trigger: 'dblclick', animation: true },
        ],
      })
      graphRef.current = graph
      graph.on(NodeEvent.CLICK, (event: any) => {
        if (!event?.target?.id) return
        setExpandError(null)
        setSelectedId(String(event.target.id))
      })
      void graph.render()
        .then(() => destroyed ? undefined : graph?.fitView({ when: 'always' }))
        .catch(() => undefined)
    })

    return () => {
      destroyed = true
      window.cancelAnimationFrame(frame)
      graph?.destroy()
      if (graphRef.current === graph) graphRef.current = null
    }
  }, [currentRoot?.id, graphKey, graphTree])

  useEffect(() => {
    setSelectedId(null)
    setExpandError(null)
  }, [graphKey])

  async function openDeepDive() {
    if (!selectedNode || !props.onGenerateDeepDive || expanding) return
    const existing = props.data.deep_maps?.[selectedNode.id]
    if (existing) {
      setFrames(currentFrames => [...currentFrames, { title: selectedNode.label, sourceNodeId: selectedNode.id, data: existing }])
      setSelectedId(null)
      return
    }
    setExpanding(true)
    setExpandError(null)
    try {
      const deepDive = await props.onGenerateDeepDive(selectedNode.id)
      exploredRef.current.add(selectedNode.id)
      props.onExplorationChange?.({ active_node_id: selectedNode.id, explored_node_ids: [...exploredRef.current] })
      setFrames(currentFrames => [...currentFrames, { title: selectedNode.label, sourceNodeId: selectedNode.id, data: deepDive }])
      setSelectedId(null)
    } catch (error) {
      setExpandError(error instanceof Error ? error.message : (zh ? '这张专题图暂时无法生成。' : 'This deep map is not ready yet.'))
    } finally {
      setExpanding(false)
    }
  }

  function goBack() {
    setFrames(currentFrames => currentFrames.slice(0, -1))
    setSelectedId(null)
    setExpandError(null)
  }

  const selectedStatus = selectedNode ? props.progress?.progress[selectedNode.id] || 'new' : 'new'

  return <section className={`g6-knowledge-map ${props.workspace ? 'is-workspace' : ''} ${props.reader ? 'is-reader' : ''}`} aria-label={zh ? '知识图解' : 'Knowledge map'}>
    <header className="g6-map-header">
      <div className="g6-map-heading">
        {frames.length > 0 && <button type="button" className="g6-map-back" onClick={goBack}><ArrowLeftRegular />{zh ? '返回主题总览' : 'Back to overview'}</button>}
        <span>{frames.length > 0 ? (zh ? '专题图解' : 'Deep map') : (zh ? '知识图解' : 'Knowledge map')}</span>
        <h1>{currentTitle}</h1>
      </div>
      <div className="g6-map-header-meta">
        <TargetRegular />
        <b>{mastered}/{total}</b>
        <small>{zh ? '已理解' : 'understood'}</small>
      </div>
    </header>

    <div className="g6-map-surface">
      <div className="g6-map-canvas" ref={canvasRef} />

      <div className="g6-map-controls" aria-label={zh ? '画布控制' : 'Canvas controls'}>
        <button type="button" onClick={() => void graphRef.current?.zoomBy(1.16)} aria-label={zh ? '放大' : 'Zoom in'}><ZoomInRegular /></button>
        <button type="button" onClick={() => void graphRef.current?.zoomBy(0.86)} aria-label={zh ? '缩小' : 'Zoom out'}><ZoomOutRegular /></button>
        <button type="button" onClick={() => void graphRef.current?.fitView({ when: 'always' })} aria-label={zh ? '重置视图' : 'Reset view'}><ArrowResetRegular /></button>
      </div>

      {selectedNode && <aside className="g6-map-inspector" aria-live="polite">
        <button type="button" className="g6-map-inspector-close" onClick={() => setSelectedId(null)} aria-label={zh ? '关闭' : 'Close'}><DismissRegular /></button>
        <div className="g6-map-inspector-icon"><NodeGlyph node={selectedNode} /></div>
        <span>{roleLabel(selectedNode, language)}</span>
        <h2>{selectedNode.label}</h2>
        <p>{selectedNode.detail || (zh ? '暂无补充说明。' : 'No extra note yet.')}</p>
        {selectedNode.example && <small><BookOpenRegular /><b>{zh ? '例子' : 'Example'}</b>{selectedNode.example}</small>}
        {selectedNode.mistake && <small className="is-warning"><WarningRegular /><b>{zh ? '易错点' : 'Pitfall'}</b>{selectedNode.mistake}</small>}
        {canOpenDeepDive && <button type="button" className="g6-map-enter" disabled={expanding} onClick={() => void openDeepDive()}>
          <BranchRegular />{expanding ? (zh ? '正在生成专题图…' : 'Building deep map…') : (zh ? '展开这条知识支路' : 'Open this branch')}<ArrowRightRegular />
        </button>}
        {props.onStatusChange && selectedNode.id !== currentRoot?.id && <div className="g6-map-status-actions">
          <button type="button" className={selectedStatus === 'review' ? 'is-active review' : ''} disabled={props.progressSavingNodeId === selectedNode.id} onClick={() => props.onStatusChange?.(selectedNode.id, 'review')}><WarningRegular />{zh ? '需要复习' : 'Review'}</button>
          <button type="button" className={selectedStatus === 'mastered' ? 'is-active mastered' : ''} disabled={props.progressSavingNodeId === selectedNode.id} onClick={() => props.onStatusChange?.(selectedNode.id, 'mastered')}><CheckmarkRegular />{zh ? '已理解' : 'Understood'}</button>
        </div>}
      </aside>}

      {expandError && <div className="g6-map-error" role="status"><WarningRegular /><span>{expandError}</span><button type="button" onClick={() => setExpandError(null)}>{zh ? '知道了' : 'Dismiss'}</button></div>}
      <div className="g6-map-hint"><span>{zh ? '拖拽平移 · 滚轮缩放 · 双击收起/展开分支' : 'Drag to move · Scroll to zoom · Double-click to collapse or expand'}</span></div>
    </div>
  </section>
}
