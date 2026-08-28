import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Graph, GraphEvent, NodeEvent, treeToGraphData } from '@antv/g6'
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
  WarningRegular,
  ZoomInRegular,
  ZoomOutRegular,
} from '@fluentui/react-icons'
import type {
  KnowledgeMapData,
  KnowledgeMapDeepDive,
  KnowledgeMapExplorationState,
  KnowledgeMapType,
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
  data: { node: KnowledgeMapNode; branchIndex: number; color: string }
}

type MapFrame = { title: string; sourceNodeId: string; data: KnowledgeMapData }

type GraphProfile = {
  id: KnowledgeMapViewId
  label: string
  semanticType: KnowledgeMapType
  nodeType: string
  edgeType: string
  usesTree: boolean
  layout?: Record<string, unknown>
  visual:
    | 'mindmap' | 'dendrogram' | 'dots' | 'compact' | 'fishbone' | 'index' | 'flow' | 'decision' | 'tokens' | 'bubbles'
    | 'grid' | 'arc' | 'timeline' | 'split' | 'org' | 'radial-tree' | 'outline' | 'funnel'
    | 'cycle' | 'lanes' | 'stairs' | 'orbit' | 'honeycomb' | 'bipartite' | 'chord'
    | 'quadrant' | 'pyramid' | 'spectrum' | 'heatmap'
  plugins?: Array<Record<string, unknown>>
}

type KnowledgeMapViewId =
  | 'mindmap' | 'dendrogram' | 'compact-box' | 'fishbone' | 'indented' | 'org-chart' | 'radial-tree' | 'outline-tree'
  | 'dagre-lr' | 'dagre-tb' | 'snake' | 'timeline-river' | 'funnel-flow' | 'cycle-loop' | 'swimlane' | 'staircase'
  | 'circular' | 'concentric' | 'radial' | 'force' | 'd3-bubble' | 'fruchterman' | 'atlas2' | 'mds'
  | 'orbit' | 'honeycomb' | 'bipartite' | 'chord-ring'
  | 'grid' | 'arc-dependency' | 'edge-bundling' | 'split-comparison' | 'quadrant' | 'pyramid' | 'spectrum' | 'matrix-heat'

type FallbackNode = { id: string; label: string; color: string; x: number; y: number }
type FallbackLink = { id: string; from: { x: number; y: number }; to: { x: number; y: number }; color: string }
type FallbackMap = {
  core: FallbackNode
  nodes: FallbackNode[]
  links: FallbackLink[]
  guideNodes: FallbackNode[]
}
type MotionPoint = { x: number; y: number }
type MotionSegment = { id: string; from: MotionPoint; to: MotionPoint; color: string }

function reducedMapMotion() {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return window.matchMedia('(max-width: 760px)').matches
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || (navigator.hardwareConcurrency || 8) <= 4
    || (nav.deviceMemory || 8) <= 4
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const branchPalette = ['#405ed8', '#5f8ee6', '#2e9f93', '#d17b4b', '#a65bc6', '#d05375', '#7c8b4d', '#7f72d6']

const knowledgeMapViewGroups: Array<{
  id: string
  zh: string
  en: string
  views: Array<{ id: KnowledgeMapViewId; zh: string; en: string }>
}> = [
  { id: 'tree', zh: '树与层级', en: 'Trees & hierarchy', views: [
    { id: 'mindmap', zh: '双翼思维导图', en: 'Two-sided mindmap' },
    { id: 'dendrogram', zh: '谱系树', en: 'Dendrogram' },
    { id: 'compact-box', zh: '紧凑层级盒', en: 'Compact hierarchy' },
    { id: 'fishbone', zh: '鱼骨因果图', en: 'Fishbone diagram' },
    { id: 'indented', zh: '缩进目录树', en: 'Indented tree' },
    { id: 'org-chart', zh: '组织结构树', en: 'Organisation chart' },
    { id: 'radial-tree', zh: '径向层级树', en: 'Radial hierarchy' },
    { id: 'outline-tree', zh: '章节目次树', en: 'Outline tree' },
  ] },
  { id: 'flow', zh: '流程与演化', en: 'Flow & evolution', views: [
    { id: 'dagre-lr', zh: '横向推理流程', en: 'Horizontal reasoning flow' },
    { id: 'dagre-tb', zh: '纵向决策流程', en: 'Vertical decision flow' },
    { id: 'snake', zh: '蛇形学习路径', en: 'Snake learning path' },
    { id: 'timeline-river', zh: '时间河', en: 'Timeline river' },
    { id: 'funnel-flow', zh: '漏斗收敛图', en: 'Funnel convergence' },
    { id: 'cycle-loop', zh: '循环反馈图', en: 'Feedback loop' },
    { id: 'swimlane', zh: '泳道流程图', en: 'Swimlane flow' },
    { id: 'staircase', zh: '阶梯进阶图', en: 'Learning staircase' },
  ] },
  { id: 'network', zh: '网络与关系', en: 'Networks & relations', views: [
    { id: 'circular', zh: '环形依赖网', en: 'Circular dependency' },
    { id: 'concentric', zh: '同心层级环', en: 'Concentric layers' },
    { id: 'radial', zh: '径向关系网', en: 'Radial network' },
    { id: 'force', zh: '弹性关系网', en: 'Force network' },
    { id: 'd3-bubble', zh: '知识气泡群', en: 'Knowledge bubbles' },
    { id: 'fruchterman', zh: '聚类星群', en: 'Cluster constellation' },
    { id: 'atlas2', zh: '稠密关系云', en: 'Dense relation cloud' },
    { id: 'mds', zh: '相似性空间', en: 'Similarity space' },
    { id: 'orbit', zh: '轨道系统图', en: 'Orbital system' },
    { id: 'honeycomb', zh: '蜂巢知识群', en: 'Honeycomb cluster' },
    { id: 'bipartite', zh: '双部桥接图', en: 'Bipartite bridge' },
    { id: 'chord-ring', zh: '弦图关系环', en: 'Chord relation ring' },
  ] },
  { id: 'analysis', zh: '比较与分析', en: 'Comparison & analysis', views: [
    { id: 'grid', zh: '知识矩阵', en: 'Knowledge matrix' },
    { id: 'arc-dependency', zh: '弧线依赖图', en: 'Arc dependency map' },
    { id: 'edge-bundling', zh: '关系束图', en: 'Edge-bundling map' },
    { id: 'split-comparison', zh: '双区对照图', en: 'Split comparison' },
    { id: 'quadrant', zh: '四象限分析', en: 'Quadrant analysis' },
    { id: 'pyramid', zh: '金字塔层级', en: 'Knowledge pyramid' },
    { id: 'spectrum', zh: '连续谱图', en: 'Knowledge spectrum' },
    { id: 'matrix-heat', zh: '关系热区图', en: 'Relation heatmap' },
  ] },
]

const knowledgeMapViewCount = knowledgeMapViewGroups.reduce((count, group) => count + group.views.length, 0)

function mapViewLabel(viewId: KnowledgeMapViewId, language: 'zh-CN' | 'en') {
  const view = knowledgeMapViewGroups.flatMap(group => group.views).find(item => item.id === viewId)
  return language === 'en' ? view?.en || viewId : view?.zh || viewId
}

function layoutForMapType(mapType: KnowledgeMapType): KnowledgeMapData['layout'] {
  return ['process_flow', 'timeline_map', 'causal_map'].includes(mapType) ? 'flow' : 'mindmap'
}

function defaultViewForMapType(mapType: KnowledgeMapType): KnowledgeMapViewId {
  const defaults: Record<KnowledgeMapType, KnowledgeMapViewId> = {
    concept_tree: 'mindmap',
    process_flow: 'dagre-lr',
    comparison_map: 'split-comparison',
    system_map: 'force',
    timeline_map: 'timeline-river',
    causal_map: 'fishbone',
    relationship_map: 'edge-bundling',
    decision_map: 'dagre-tb',
    lab_map: 'd3-bubble',
  }
  return defaults[mapType]
}

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
      data: { node, branchIndex, color: branchPalette[Math.max(0, branchIndex) % branchPalette.length] },
      ...(children.length ? { children } : {}),
    }
  }
  const tree = build(root, -1, new Set())
  const included = new Set<string>()
  const visit = (entry: MapTreeNode) => { included.add(entry.id); entry.children?.forEach(visit) }
  visit(tree)
  const detached = data.nodes
    .filter(node => node.id !== root.id && !included.has(node.id))
    .sort((a, b) => (a.order || Number.MAX_SAFE_INTEGER) - (b.order || Number.MAX_SAFE_INTEGER))
    .map((node, index) => build(node, index + (tree.children?.length || 0), new Set([root.id])))
  if (detached.length) tree.children = [...(tree.children || []), ...detached]
  return tree
}

function mapTitle(data: KnowledgeMapData, language: 'zh-CN' | 'en') {
  return rootFor(data)?.label || (language === 'en' ? 'Knowledge map' : '知识图解')
}

function shortLabel(label: string, limit = 12) {
  return label.length > limit ? `${label.slice(0, limit - 1)}…` : label
}

function roleLabel(node: KnowledgeMapNode, language: 'zh-CN' | 'en') {
  const kind = node.kind || (node.role === 'core' ? 'core' : 'foundation')
  const labels = language === 'en'
    ? { core: 'Core topic', foundation: 'Foundation', principle: 'Principle', process: 'Process', example: 'Worked example', pitfall: 'Pitfall' }
    : { core: '主题核心', foundation: '基础概念', principle: '关键原理', process: '推理过程', example: '例题应用', pitfall: '易错提醒' }
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

function profileFor(viewId: KnowledgeMapViewId, language: 'zh-CN' | 'en'): GraphProfile {
  const profiles: Record<KnowledgeMapViewId, Omit<GraphProfile, 'label' | 'id'>> = {
    // Overview maps commonly contain only 8–10 atoms. Give those branches
    // enough vertical room to use the canvas instead of compressing them into
    // a thin centre strip that reads like a slide rather than a map.
    // These three views deliberately own three different graph grammars. The
    // generated payload often gives every atom the same parent; using a tree
    // layout for all of them made "different" choices collapse into the same
    // root-and-list drawing.
    mindmap: { semanticType: 'concept_tree', nodeType: 'rect', edgeType: 'cubic-horizontal', usesTree: false, visual: 'mindmap' },
    dendrogram: { semanticType: 'concept_tree', nodeType: 'circle', edgeType: 'cubic-horizontal', usesTree: false, visual: 'dendrogram' },
    'compact-box': { semanticType: 'concept_tree', nodeType: 'rect', edgeType: 'polyline', usesTree: false, visual: 'compact' },
    // The upstream fishbone layout is fragile when generated knowledge atoms
    // contain cross-links. A fixed fishbone grammar keeps the official visual
    // language while accepting any valid knowledge payload.
    fishbone: { semanticType: 'causal_map', nodeType: 'rect', edgeType: 'line', usesTree: false, visual: 'fishbone' },
    indented: { semanticType: 'concept_tree', nodeType: 'circle', edgeType: 'polyline', usesTree: true, visual: 'index', layout: { type: 'indented', direction: 'LR', indent: 112, getHeight: () => 30, getWidth: () => 42 } },
    'org-chart': { semanticType: 'concept_tree', nodeType: 'rect', edgeType: 'polyline', usesTree: false, visual: 'org' },
    'radial-tree': { semanticType: 'concept_tree', nodeType: 'circle', edgeType: 'line', usesTree: false, visual: 'radial-tree' },
    'outline-tree': { semanticType: 'concept_tree', nodeType: 'rect', edgeType: 'polyline', usesTree: false, visual: 'outline' },
    'dagre-lr': { semanticType: 'process_flow', nodeType: 'rect', edgeType: 'polyline', usesTree: false, visual: 'flow', layout: { type: 'antv-dagre', rankdir: 'LR', nodesep: 46, ranksep: 92, align: 'UL', controlPoints: true } },
    'dagre-tb': { semanticType: 'decision_map', nodeType: 'diamond', edgeType: 'polyline', usesTree: false, visual: 'decision', layout: { type: 'dagre', rankdir: 'TB', nodesep: 72, ranksep: 88, align: 'UL' } },
    // Keep the snake view on a deterministic two-row path. The third-party
    // layout can collapse a sparse deep map into one enormous title node.
    snake: { semanticType: 'process_flow', nodeType: 'rect', edgeType: 'polyline', usesTree: false, visual: 'flow' },
    'timeline-river': { semanticType: 'timeline_map', nodeType: 'circle', edgeType: 'cubic-horizontal', usesTree: false, visual: 'timeline' },
    'funnel-flow': { semanticType: 'process_flow', nodeType: 'rect', edgeType: 'cubic-vertical', usesTree: false, visual: 'funnel' },
    'cycle-loop': { semanticType: 'process_flow', nodeType: 'circle', edgeType: 'quadratic', usesTree: false, visual: 'cycle' },
    swimlane: { semanticType: 'process_flow', nodeType: 'rect', edgeType: 'polyline', usesTree: false, visual: 'lanes' },
    staircase: { semanticType: 'process_flow', nodeType: 'rect', edgeType: 'polyline', usesTree: false, visual: 'stairs' },
    circular: { semanticType: 'relationship_map', nodeType: 'circle', edgeType: 'line', usesTree: false, visual: 'tokens', layout: { type: 'circular', nodeSize: 42, nodeSpacing: 56, ordering: 'topology' } },
    concentric: { semanticType: 'system_map', nodeType: 'circle', edgeType: 'line', usesTree: false, visual: 'bubbles', layout: { type: 'concentric', nodeSize: 52, minNodeSpacing: 42, maxLevelDiff: 0.5, sortBy: 'degree', preventOverlap: true } },
    radial: { semanticType: 'lab_map', nodeType: 'circle', edgeType: 'line', usesTree: false, visual: 'tokens', layout: { type: 'radial', nodeSize: 42, unitRadius: 112, linkDistance: 170, preventOverlap: true, strictRadial: true } },
    // Small generated maps need deterministic spacing. The physics layouts
    // repeatedly converged into a tight knot with overlapping labels, so the
    // four relation views below keep their own readable network grammars.
    force: { semanticType: 'system_map', nodeType: 'circle', edgeType: 'line', usesTree: false, visual: 'tokens' },
    'd3-bubble': { semanticType: 'lab_map', nodeType: 'circle', edgeType: 'line', usesTree: false, visual: 'bubbles' },
    fruchterman: { semanticType: 'relationship_map', nodeType: 'circle', edgeType: 'line', usesTree: false, visual: 'bubbles' },
    atlas2: { semanticType: 'relationship_map', nodeType: 'circle', edgeType: 'line', usesTree: false, visual: 'dots' },
    mds: { semanticType: 'comparison_map', nodeType: 'circle', edgeType: 'line', usesTree: false, visual: 'dots', layout: { type: 'mds', nodeSize: 34, linkDistance: 125 } },
    orbit: { semanticType: 'system_map', nodeType: 'circle', edgeType: 'line', usesTree: false, visual: 'orbit' },
    honeycomb: { semanticType: 'lab_map', nodeType: 'diamond', edgeType: 'line', usesTree: false, visual: 'honeycomb' },
    bipartite: { semanticType: 'relationship_map', nodeType: 'rect', edgeType: 'cubic-horizontal', usesTree: false, visual: 'bipartite' },
    'chord-ring': { semanticType: 'relationship_map', nodeType: 'circle', edgeType: 'quadratic', usesTree: false, visual: 'chord' },
    grid: { semanticType: 'comparison_map', nodeType: 'rect', edgeType: 'line', usesTree: false, visual: 'grid', layout: { type: 'grid', sortBy: 'order', nodeSize: [136, 58], cols: 3, preventOverlap: true } },
    'arc-dependency': { semanticType: 'relationship_map', nodeType: 'circle', edgeType: 'quadratic', usesTree: false, visual: 'arc' },
    'edge-bundling': { semanticType: 'relationship_map', nodeType: 'circle', edgeType: 'line', usesTree: false, visual: 'tokens', layout: { type: 'circular', nodeSize: 34, nodeSpacing: 42 }, plugins: [{ key: 'knowledge-edge-bundling', type: 'edge-bundling', bundleThreshold: 0.12, cycles: 5 }] },
    'split-comparison': { semanticType: 'comparison_map', nodeType: 'rect', edgeType: 'cubic-horizontal', usesTree: false, visual: 'split' },
    quadrant: { semanticType: 'comparison_map', nodeType: 'rect', edgeType: 'line', usesTree: false, visual: 'quadrant' },
    pyramid: { semanticType: 'comparison_map', nodeType: 'rect', edgeType: 'polyline', usesTree: false, visual: 'pyramid' },
    spectrum: { semanticType: 'comparison_map', nodeType: 'circle', edgeType: 'line', usesTree: false, visual: 'spectrum' },
    'matrix-heat': { semanticType: 'comparison_map', nodeType: 'rect', edgeType: 'line', usesTree: false, visual: 'heatmap' },
  }
  return { id: viewId, label: mapViewLabel(viewId, language), ...profiles[viewId] }
}

function edgeDataFor(data: KnowledgeMapData, rootId?: string) {
  const ids = new Set(data.nodes.map(node => node.id))
  const seen = new Set<string>()
  const edges = data.edges
    .filter(edge => ids.has(edge.from) && ids.has(edge.to) && edge.from !== edge.to)
    .filter(edge => {
      const key = `${edge.from}|${edge.to}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  const baseEdges = edges.length || !rootId
    ? edges
    : data.nodes.filter(node => node.id !== rootId).map(node => ({ from: rootId, to: node.id, label: '' }))
  const mapType = data.map_type || (data.layout === 'flow' ? 'process_flow' : 'concept_tree')
  const ordered = data.nodes
    .filter(node => node.id !== rootId)
    .sort((a, b) => (a.order || Number.MAX_SAFE_INTEGER) - (b.order || Number.MAX_SAFE_INTEGER))
  const unique = (items: KnowledgeMapData['edges']) => {
    const seen = new Set<string>()
    return items.filter(edge => {
      const key = `${edge.from}|${edge.to}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  const hasInternalRelations = baseEdges.some(edge => edge.from !== rootId && edge.to !== rootId)

  // The authoring payload intentionally keeps the overview easy to read by
  // connecting atoms to the core. For a true flow/timeline view, convert that
  // star into the declared order so the layout communicates a different idea.
  if (!hasInternalRelations && rootId && ['process_flow', 'timeline_map', 'causal_map'].includes(mapType) && ordered.length) {
    return unique([
      { from: rootId, to: ordered[0].id, label: '' },
      ...ordered.slice(1).map((node, index) => ({ from: ordered[index].id, to: node.id, label: '' })),
    ])
  }
  if (!hasInternalRelations && rootId && ['relationship_map', 'system_map', 'lab_map', 'comparison_map'].includes(mapType)) {
    const supportEdges = ordered.slice(1).map((node, index) => ({ from: ordered[index].id, to: node.id, label: '' }))
    return unique([...baseEdges, ...supportEdges])
  }
  return baseEdges
}

function hierarchyGroupsFor(
  nodes: KnowledgeMapNode[],
  viewId: 'dendrogram' | 'compact-box',
  language: 'zh-CN' | 'en',
) {
  const groupCount = Math.min(3, Math.max(1, Math.ceil(nodes.length / 3)))
  const labels = language === 'en'
    ? (viewId === 'dendrogram' ? ['Concept base', 'Key reasoning', 'Application'] : ['Core ideas', 'Reasoning', 'Practice'])
    : (viewId === 'dendrogram' ? ['概念基底', '关键原理', '应用迁移'] : ['核心概念', '推理连接', '应用练习'])
  return Array.from({ length: groupCount }, (_value, index) => {
    const start = Math.floor(index * nodes.length / groupCount)
    const end = Math.floor((index + 1) * nodes.length / groupCount)
    return {
      id: `__${viewId}_group_${index}`,
      label: labels[index] || labels.at(-1) || (language === 'en' ? 'Knowledge group' : '知识分组'),
      color: branchPalette[index % branchPalette.length],
      nodes: nodes.slice(start, end),
    }
  })
}

function fallbackMapFor(
  data: KnowledgeMapData,
  rootId: string | undefined,
  profile: GraphProfile,
  language: 'zh-CN' | 'en',
): FallbackMap {
  const leaves = data.nodes
    .filter(node => node.id !== rootId)
    .sort((a, b) => (a.order || Number.MAX_SAFE_INTEGER) - (b.order || Number.MAX_SAFE_INTEGER))
    .slice(0, 10)
  const count = Math.max(1, leaves.length)
  const mapType = data.map_type || (data.layout === 'flow' ? 'process_flow' : 'concept_tree')
  let core = { id: rootId || 'core', label: shortLabel(mapTitle(data, language), 14), color: '#252c42', x: 50, y: 50 }
  const coordinates = new Map<string, { x: number; y: number }>()
  const guideNodes: FallbackNode[] = []
  let sourceLinks: Array<{ from: string; to: string; label?: string }> | null = null

  if (profile.id === 'mindmap') {
    core = { ...core, x: 50, y: 50 }
    const counts = [Math.ceil(leaves.length / 2), Math.floor(leaves.length / 2)]
    leaves.forEach((node, index) => {
      const side = index % 2
      const slot = Math.floor(index / 2)
      const spread = counts[side] <= 1 ? 50 : 16 + slot * 68 / (counts[side] - 1)
      coordinates.set(node.id, { x: side ? 77 : 23, y: spread })
    })
  } else if (profile.id === 'dendrogram') {
    core = { ...core, x: 9, y: 50 }
    const groups = hierarchyGroupsFor(leaves, 'dendrogram', language)
    sourceLinks = []
    groups.forEach((group, groupIndex) => {
      const groupY = groups.length === 1 ? 50 : 16 + groupIndex * 68 / (groups.length - 1)
      const guide = { id: group.id, label: group.label, color: group.color, x: 40, y: groupY }
      guideNodes.push(guide)
      sourceLinks!.push({ from: core.id, to: guide.id })
      group.nodes.forEach((node, nodeIndex) => {
        const atomY = group.nodes.length === 1 ? groupY : groupY - 11 + nodeIndex * 22 / (group.nodes.length - 1)
        coordinates.set(node.id, { x: 80, y: atomY })
        sourceLinks!.push({ from: guide.id, to: node.id })
      })
    })
  } else if (profile.id === 'compact-box') {
    core = { ...core, x: 50, y: 13 }
    const groups = hierarchyGroupsFor(leaves, 'compact-box', language)
    sourceLinks = []
    groups.forEach((group, groupIndex) => {
      const groupX = groups.length === 1 ? 50 : 19 + groupIndex * 62 / (groups.length - 1)
      const guide = { id: group.id, label: group.label, color: group.color, x: groupX, y: 33 }
      guideNodes.push(guide)
      sourceLinks!.push({ from: core.id, to: guide.id })
      group.nodes.forEach((node, nodeIndex) => {
        const atomY = 52 + nodeIndex * Math.min(16, 34 / Math.max(1, group.nodes.length - 1))
        coordinates.set(node.id, { x: groupX, y: atomY })
        sourceLinks!.push({ from: guide.id, to: node.id })
      })
    })
  } else if (profile.id === 'snake') {
    core = { ...core, x: 10, y: 24 }
    const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(leaves.length * 1.6))))
    leaves.forEach((node, index) => {
      const row = Math.floor(index / columns)
      const slot = index % columns
      const visualSlot = row % 2 ? columns - 1 - slot : slot
      coordinates.set(node.id, {
        x: columns === 1 ? 53 : 28 + visualSlot * 62 / (columns - 1),
        y: row % 2 ? 75 : 34,
      })
    })
  } else if (['process_flow', 'timeline_map', 'causal_map'].includes(mapType)) {
    core = { ...core, x: 9, y: 50 }
    leaves.forEach((node, index) => {
      const ratio = count === 1 ? .5 : index / (count - 1)
      coordinates.set(node.id, { x: 23 + ratio * 66, y: mapType === 'timeline_map' ? (index % 2 ? 65 : 35) : (index % 2 ? 58 : 42) })
    })
  } else if (mapType === 'decision_map') {
    core = { ...core, x: 50, y: 16 }
    const template = [
      { x: 29, y: 38 }, { x: 71, y: 38 }, { x: 16, y: 61 }, { x: 40, y: 61 },
      { x: 60, y: 61 }, { x: 84, y: 61 }, { x: 27, y: 84 }, { x: 73, y: 84 },
    ]
    leaves.forEach((node, index) => coordinates.set(node.id, template[index] || { x: 50, y: 86 }))
  } else if (mapType === 'comparison_map') {
    core = { ...core, x: 50, y: 50 }
    const rows = [22, 38, 58, 76]
    leaves.forEach((node, index) => coordinates.set(node.id, { x: index % 2 ? 78 : 22, y: rows[Math.floor(index / 2) % rows.length] }))
  } else if (mapType === 'relationship_map' || mapType === 'system_map') {
    const template = [
      { x: 21, y: 26 }, { x: 46, y: 18 }, { x: 78, y: 27 }, { x: 18, y: 57 },
      { x: 80, y: 58 }, { x: 31, y: 82 }, { x: 58, y: 85 }, { x: 74, y: 76 },
    ]
    leaves.forEach((node, index) => coordinates.set(node.id, template[index] || { x: 50, y: 87 }))
  } else if (mapType === 'lab_map') {
    const template = [
      { x: 50, y: 18 }, { x: 77, y: 32 }, { x: 82, y: 62 }, { x: 62, y: 83 },
      { x: 34, y: 83 }, { x: 17, y: 61 }, { x: 22, y: 32 }, { x: 50, y: 88 },
    ]
    leaves.forEach((node, index) => coordinates.set(node.id, template[index] || { x: 50, y: 88 }))
  } else {
    leaves.forEach((node, index) => {
      const angle = -Math.PI / 2 + index / count * Math.PI * 2
      const radius = index % 2 === 0 ? 35 : 39
      coordinates.set(node.id, { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius })
    })
  }

  const nodes = leaves.map((node, index) => ({
    id: node.id,
    label: shortLabel(node.label, 10),
    color: branchPalette[index % branchPalette.length],
    ...(coordinates.get(node.id) || { x: 50, y: 87 }),
  }))
  const positions = new Map<string, { x: number; y: number }>()
  positions.set(core.id, core)
  nodes.forEach(node => positions.set(node.id, node))
  guideNodes.forEach(node => positions.set(node.id, node))
  const orderedIds = new Map(nodes.map((node, index) => [node.id, index]))
  const directLinks = edgeDataFor(data, rootId)
  const resolvedLinks = sourceLinks ?? (directLinks.length ? directLinks : nodes.map(node => ({ from: core.id, to: node.id, label: '' })))
  const links = resolvedLinks
    .map((edge, index) => {
      const from = positions.get(edge.from)
      const to = positions.get(edge.to)
      if (!from || !to) return null
      const colorIndex = orderedIds.get(edge.to) ?? orderedIds.get(edge.from) ?? index
      return { id: `${edge.from}__${edge.to}`, from, to, color: branchPalette[colorIndex % branchPalette.length] }
    })
    .filter((edge): edge is FallbackLink => Boolean(edge))
  return { core, nodes, links, guideNodes }
}

function motionPathFor(segment: MotionSegment) {
  const { from, to } = segment
  const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
  if (horizontal) {
    const bend = from.x + (to.x - from.x) * .52
    return `M ${from.x} ${from.y} C ${bend} ${from.y}, ${bend} ${to.y}, ${to.x} ${to.y}`
  }
  const bend = from.y + (to.y - from.y) * .52
  return `M ${from.x} ${from.y} C ${from.x} ${bend}, ${to.x} ${bend}, ${to.x} ${to.y}`
}

export function G6KnowledgeMap(props: G6KnowledgeMapProps) {
  const language = props.language || 'zh-CN'
  const zh = language !== 'en'
  const surfaceRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Graph | null>(null)
  const graphCleanupRef = useRef<Promise<unknown>>(Promise.resolve())
  const exploredRef = useRef<Set<string>>(new Set(props.exploration?.explored_node_ids || []))
  const rootIdRef = useRef(rootFor(props.data)?.id)
  const [frames, setFrames] = useState<MapFrame[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanding, setExpanding] = useState(false)
  const [expandError, setExpandError] = useState<string | null>(null)
  const [renderState, setRenderState] = useState<'booting' | 'ready' | 'failed' | 'empty'>('booting')
  const [mapTypeChoice, setMapTypeChoice] = useState<'auto' | KnowledgeMapViewId>('auto')
  const [motionSegments, setMotionSegments] = useState<MotionSegment[]>([])
  const [motionCore, setMotionCore] = useState<MotionPoint | null>(null)
  const [lowMotion] = useState(reducedMapMotion)
  const [reducedMotion] = useState(prefersReducedMotion)
  const [pageVisible, setPageVisible] = useState(() => !document.hidden)

  const current = frames.at(-1)?.data || props.data
  const recommendedMapType = (current.map_type || (current.layout === 'flow' ? 'process_flow' : 'concept_tree')) as KnowledgeMapType
  const recommendedViewId = defaultViewForMapType(recommendedMapType)
  const activeViewId = mapTypeChoice === 'auto' ? recommendedViewId : mapTypeChoice
  const profile = useMemo(() => profileFor(activeViewId, language), [activeViewId, language])
  const viewData = useMemo<KnowledgeMapData>(() => {
    return { ...current, map_type: profile.semanticType, layout: layoutForMapType(profile.semanticType) }
  }, [current, profile.semanticType])
  const currentTitle = frames.at(-1)?.title || mapTitle(current, language)
  // Keep the root object stable between unrelated UI updates (hover, motion,
  // visibility). This lets the graph memo/effect depend on the actual root
  // value without accidentally rebuilding G6 on every parent render.
  const currentRoot = useMemo(() => rootFor(viewData), [viewData])
  const graphTree = useMemo(() => buildTree(viewData), [viewData])
  const graphKey = useMemo(() => JSON.stringify({
    root: currentRoot?.id || 'empty', view: profile.id, mapType: viewData.map_type, layout: viewData.layout,
    nodes: viewData.nodes.map(node => [node.id, node.parent_id || '', node.label, node.kind || '', node.group || '']),
    edges: viewData.edges.map(edge => [edge.from, edge.to, edge.label || '']),
  }), [viewData, currentRoot?.id, profile.id])
  const fallbackMap = useMemo(
    () => fallbackMapFor(viewData, currentRoot?.id, profile, language),
    [viewData, currentRoot?.id, profile, language],
  )
  const hasLearnableAtoms = viewData.nodes.some(node => node.id !== currentRoot?.id)
  // Only near-empty maps need a tight zoom ceiling. Rich relationship maps
  // must still be able to expand into the canvas instead of becoming a tiny
  // cluster in the middle of an otherwise blank workspace.
  const maxCanvasZoom = hasLearnableAtoms && viewData.nodes.length <= 2 ? 1.18 : 3
  const selectedNode = current.nodes.find(node => node.id === selectedId) || null
  const canOpenDeepDive = frames.length === 0 && Boolean(selectedNode && selectedNode.id !== currentRoot?.id && props.onGenerateDeepDive)
  const surfaceStyle = motionCore
    ? { '--g6-focus-x': `${motionCore.x}px`, '--g6-focus-y': `${motionCore.y}px` } as CSSProperties
    : undefined

  const graphData = useMemo<any>(() => {
    const indexById = new Map(viewData.nodes.map((node, index) => [node.id, index]))
    const leafNodes = viewData.nodes.filter(node => node.id !== currentRoot?.id)
    const leafIndexById = new Map(leafNodes.map((node, index) => [node.id, index]))
    const presetPosition = (node: KnowledgeMapNode, index: number) => {
      const isRoot = node.id === currentRoot?.id
      const totalNodes = Math.max(2, viewData.nodes.length)
      const leafIndex = leafIndexById.get(node.id) || 0
      const leafCount = Math.max(1, leafNodes.length)
      if (profile.visual === 'arc') {
        return { x: 90 + index * (820 / (totalNodes - 1)), y: 420 }
      }
      if (profile.visual === 'timeline') {
        if (isRoot) return { x: 74, y: 290 }
        const orderedIndex = Math.max(0, index - 1)
        const count = Math.max(1, totalNodes - 2)
        return { x: 190 + orderedIndex * (690 / count), y: orderedIndex % 2 === 0 ? 222 : 358 }
      }
      if (profile.visual === 'split') {
        if (isRoot) return { x: 500, y: 300 }
        const orderedIndex = Math.max(0, index - 1)
        const side = orderedIndex % 2
        const row = Math.floor(orderedIndex / 2)
        return { x: side ? 790 : 210, y: 145 + row * 104 }
      }
      if (profile.visual === 'fishbone') {
        if (isRoot) return { x: 920, y: 300 }
        const column = Math.floor(leafIndex / 2)
        return { x: 150 + column * 185, y: leafIndex % 2 ? 455 : 145 }
      }
      if (profile.visual === 'org') {
        if (isRoot) return { x: 500, y: 82 }
        if (leafIndex < 3) return { x: 245 + leafIndex * 255, y: 235 }
        const rowCount = Math.max(1, leafCount - 3)
        return { x: 150 + (leafIndex - 3) * (700 / Math.max(1, rowCount - 1)), y: 430 }
      }
      if (profile.visual === 'radial-tree') {
        if (isRoot) return { x: 500, y: 300 }
        const angle = -Math.PI / 2 + leafIndex / leafCount * Math.PI * 2
        const radius = leafIndex % 2 ? 265 : 165
        return { x: 500 + Math.cos(angle) * radius, y: 300 + Math.sin(angle) * radius * .72 }
      }
      if (profile.visual === 'outline') {
        if (isRoot) return { x: 92, y: 78 }
        return { x: 250 + (leafIndex % 3) * 205, y: 118 + leafIndex * 54 }
      }
      if (profile.visual === 'funnel') {
        if (isRoot) return { x: 500, y: 64 }
        const progress = leafIndex / Math.max(1, leafCount - 1)
        const spread = 245 * (1 - progress * .78)
        return { x: 500 + (leafIndex % 2 ? spread : -spread), y: 142 + leafIndex * (410 / leafCount) }
      }
      if (profile.visual === 'cycle' || profile.visual === 'chord') {
        const graphIndex = indexById.get(node.id) || 0
        const angle = -Math.PI / 2 + graphIndex / totalNodes * Math.PI * 2
        const radius = profile.visual === 'chord' ? 238 : 220
        return { x: 500 + Math.cos(angle) * radius, y: 300 + Math.sin(angle) * radius * .82 }
      }
      if (profile.visual === 'lanes') {
        if (isRoot) return { x: 96, y: 300 }
        const lane = leafIndex % 3
        const column = Math.floor(leafIndex / 3)
        return { x: 305 + column * 250, y: 145 + lane * 155 }
      }
      if (profile.visual === 'stairs') {
        if (isRoot) return { x: 94, y: 505 }
        return { x: 215 + leafIndex * (690 / Math.max(1, leafCount - 1)), y: 465 - leafIndex * (350 / Math.max(1, leafCount - 1)) }
      }
      if (profile.visual === 'orbit') {
        if (isRoot) return { x: 500, y: 300 }
        const angle = -Math.PI / 2 + leafIndex / leafCount * Math.PI * 2
        const radius = leafIndex % 2 ? 255 : 170
        return { x: 500 + Math.cos(angle) * radius, y: 300 + Math.sin(angle) * radius * .64 }
      }
      if (profile.visual === 'honeycomb') {
        if (isRoot) return { x: 500, y: 300 }
        const template = [[500, 145], [635, 220], [635, 380], [500, 455], [365, 380], [365, 220], [770, 300], [230, 300]]
        const position = template[leafIndex % template.length]
        return { x: position[0], y: position[1] }
      }
      if (profile.visual === 'bipartite') {
        if (isRoot) return { x: 500, y: 72 }
        const side = leafIndex % 2
        return { x: side ? 760 : 240, y: 165 + Math.floor(leafIndex / 2) * 105 }
      }
      if (profile.visual === 'quadrant') {
        if (isRoot) return { x: 500, y: 300 }
        const template = [[270, 160], [390, 220], [730, 160], [610, 220], [270, 440], [390, 380], [730, 440], [610, 380]]
        const position = template[leafIndex % template.length]
        return { x: position[0], y: position[1] }
      }
      if (profile.visual === 'pyramid') {
        if (isRoot) return { x: 500, y: 86 }
        const rows = [[500, 190], [380, 300], [620, 300], [260, 425], [420, 425], [580, 425], [740, 425], [500, 535]]
        const position = rows[leafIndex % rows.length]
        return { x: position[0], y: position[1] }
      }
      if (profile.visual === 'spectrum') {
        if (isRoot) return { x: 78, y: 300 }
        return { x: 190 + leafIndex * (720 / Math.max(1, leafCount - 1)), y: 300 }
      }
      if (profile.visual === 'heatmap') {
        if (isRoot) return { x: 500, y: 68 }
        return { x: 310 + (leafIndex % 3) * 190, y: 190 + Math.floor(leafIndex / 3) * 130 }
      }
      return {}
    }
    const nodeData = (node: KnowledgeMapNode, branchIndex: number, sequenceIndex = branchIndex): any => {
      const isRoot = node.id === currentRoot?.id
      const color = isRoot ? '#252c42' : branchPalette[Math.max(0, branchIndex) % branchPalette.length]
      const common = {
        fill: isRoot ? '#252c42' : '#ffffff', stroke: isRoot ? '#252c42' : color, lineWidth: isRoot ? 0 : 2,
        labelText: shortLabel(node.label, isRoot ? 14 : 12), labelFill: isRoot ? '#ffffff' : '#293044',
        labelFontFamily: 'Inter, PingFang SC, Microsoft YaHei, sans-serif', labelWordWrap: true, cursor: 'pointer',
        halo: true, haloFill: color, haloOpacity: isRoot ? 0.16 : 0.07, haloLineWidth: isRoot ? 18 : 12,
      }
      let visualStyle: Record<string, unknown>
      if (profile.visual === 'dendrogram' || profile.visual === 'dots') {
        visualStyle = {
          size: isRoot ? 32 : 16, fill: isRoot ? '#252c42' : color, stroke: '#ffffff', lineWidth: 2,
          labelPlacement: 'right', labelFill: '#313744', labelFontSize: isRoot ? 13 : 11, labelFontWeight: isRoot ? 750 : 600,
          labelBackground: true, labelBackgroundFill: 'rgba(255,255,255,.9)', labelPadding: [3, 5], labelMaxWidth: 148, haloLineWidth: 7,
        }
      } else if (profile.visual === 'compact') {
        visualStyle = { size: isRoot ? [132, 42] : [108, 34], radius: 7, labelPlacement: 'center', labelFontSize: isRoot ? 14 : 11, labelFontWeight: 700, labelMaxWidth: 94, labelLineHeight: 15 }
      } else if (profile.visual === 'fishbone') {
        visualStyle = isRoot
          ? { size: [150, 46], radius: 23, labelPlacement: 'center', labelFontSize: 14, labelFontWeight: 760 }
          : { size: [34, 34], radius: 5, fill: color, stroke: color, labelPlacement: sequenceIndex % 2 ? 'top' : 'bottom', labelFill: '#303540', labelFontSize: 11, labelFontWeight: 650, labelOffsetY: sequenceIndex % 2 ? -8 : 8, halo: false }
      } else if (profile.visual === 'index') {
        visualStyle = { size: isRoot ? 24 : 13, fill: isRoot ? '#252c42' : color, stroke: '#ffffff', lineWidth: 2, labelPlacement: 'right', labelFill: '#343a47', labelFontSize: isRoot ? 14 : 12, labelFontWeight: 650, labelBackground: true, labelBackgroundFill: '#ffffff', labelPadding: [3, 6], halo: false }
      } else if (profile.visual === 'decision') {
        visualStyle = { size: isRoot ? 100 : 76, fill: isRoot ? '#252c42' : `${color}18`, stroke: isRoot ? '#252c42' : color, lineWidth: 2, labelPlacement: 'center', labelFontSize: isRoot ? 14 : 11, labelFontWeight: 700, labelMaxWidth: isRoot ? 70 : 56, labelLineHeight: 15 }
      } else if (profile.visual === 'tokens') {
        visualStyle = { size: isRoot ? 78 : 38, fill: isRoot ? '#252c42' : color, stroke: '#ffffff', lineWidth: 3, labelPlacement: isRoot ? 'center' : 'bottom', labelFill: isRoot ? '#ffffff' : '#343a47', labelFontSize: isRoot ? 14 : 11, labelFontWeight: 700, labelOffsetY: isRoot ? 0 : 8, labelMaxWidth: 110, haloLineWidth: 9 }
      } else if (profile.visual === 'bubbles') {
        const bubbleSize = isRoot ? 112 : 46 + (sequenceIndex % 4) * 9
        visualStyle = { size: bubbleSize, fill: isRoot ? '#252c42' : `${color}d9`, stroke: '#ffffff', lineWidth: 3, labelPlacement: 'center', labelFill: '#ffffff', labelFontSize: isRoot ? 15 : 10, labelFontWeight: 760, labelMaxWidth: bubbleSize - 10, labelLineHeight: 13, haloLineWidth: 10 }
      } else if (profile.visual === 'grid') {
        visualStyle = { size: isRoot ? [150, 66] : [132, 56], radius: 4, fill: isRoot ? '#252c42' : `${color}10`, stroke: isRoot ? '#252c42' : color, labelPlacement: 'center', labelFontSize: isRoot ? 15 : 12, labelFontWeight: 720, labelMaxWidth: 114, halo: false }
      } else if (profile.visual === 'arc') {
        visualStyle = { size: isRoot ? 24 : 16, fill: isRoot ? '#252c42' : color, stroke: '#ffffff', lineWidth: 2, labelPlacement: 'bottom', labelFill: '#333946', labelFontSize: 10, labelFontWeight: 650, labelRotation: Math.PI / 2, labelOffsetY: 9, halo: false }
      } else if (profile.visual === 'timeline') {
        visualStyle = { size: isRoot ? 78 : 36, fill: isRoot ? '#252c42' : color, stroke: '#ffffff', lineWidth: 3, labelPlacement: sequenceIndex % 2 ? 'top' : 'bottom', labelFill: isRoot ? '#ffffff' : '#323844', labelFontSize: isRoot ? 14 : 11, labelFontWeight: 700, labelOffsetY: sequenceIndex % 2 ? -9 : 9, labelBackground: !isRoot, labelBackgroundFill: 'rgba(255,255,255,.92)', labelPadding: [3, 5], haloLineWidth: 9 }
      } else if (profile.visual === 'split') {
        visualStyle = { size: isRoot ? [160, 62] : [144, 48], radius: isRoot ? 18 : 24, fill: isRoot ? '#252c42' : `${color}12`, stroke: isRoot ? '#252c42' : color, labelPlacement: 'center', labelFontSize: isRoot ? 15 : 12, labelFontWeight: 720, labelMaxWidth: 126, haloLineWidth: 10 }
      } else if (profile.visual === 'org') {
        visualStyle = { size: isRoot ? [190, 58] : [154, 50], radius: 8, fill: isRoot ? '#252c42' : '#fff', stroke: isRoot ? '#252c42' : color, labelPlacement: 'center', labelFontSize: isRoot ? 15 : 12, labelFontWeight: 720, labelMaxWidth: 134, halo: false }
      } else if (profile.visual === 'radial-tree') {
        visualStyle = { size: isRoot ? 92 : 28, fill: isRoot ? '#252c42' : color, stroke: '#fff', lineWidth: 3, labelPlacement: isRoot ? 'center' : 'right', labelFill: isRoot ? '#fff' : '#323844', labelFontSize: isRoot ? 15 : 11, labelFontWeight: 700, labelOffsetX: isRoot ? 0 : 8, labelBackground: !isRoot, labelBackgroundFill: 'rgba(255,255,255,.92)', labelPadding: [3, 5], haloLineWidth: 8 }
      } else if (profile.visual === 'outline') {
        visualStyle = { size: isRoot ? [158, 44] : [176, 34], radius: 3, fill: isRoot ? '#252c42' : `${color}0f`, stroke: isRoot ? '#252c42' : color, lineWidth: isRoot ? 0 : 1.5, labelPlacement: 'center', labelFontSize: isRoot ? 14 : 11, labelFontWeight: 690, labelMaxWidth: 156, halo: false }
      } else if (profile.visual === 'funnel') {
        const funnelWidth = isRoot ? 240 : Math.max(96, 210 - sequenceIndex * 14)
        visualStyle = { size: [funnelWidth, isRoot ? 52 : 40], radius: 20, fill: isRoot ? '#252c42' : `${color}18`, stroke: isRoot ? '#252c42' : color, labelPlacement: 'center', labelFontSize: isRoot ? 15 : 11, labelFontWeight: 720, labelMaxWidth: funnelWidth - 22, haloLineWidth: 8 }
      } else if (profile.visual === 'cycle') {
        visualStyle = { size: isRoot ? 82 : 58, fill: isRoot ? '#252c42' : `${color}e6`, stroke: '#fff', lineWidth: 3, labelPlacement: 'center', labelFill: '#fff', labelFontSize: isRoot ? 14 : 10, labelFontWeight: 750, labelMaxWidth: isRoot ? 65 : 48, haloLineWidth: 8 }
      } else if (profile.visual === 'lanes') {
        visualStyle = { size: isRoot ? [145, 54] : [146, 44], radius: 9, fill: isRoot ? '#252c42' : '#fff', stroke: isRoot ? '#252c42' : color, labelPlacement: 'center', labelFontSize: isRoot ? 14 : 11, labelFontWeight: 720, labelMaxWidth: 126, halo: false }
      } else if (profile.visual === 'stairs') {
        visualStyle = { size: isRoot ? [142, 54] : [126, 44], radius: 5, fill: isRoot ? '#252c42' : `${color}14`, stroke: isRoot ? '#252c42' : color, labelPlacement: 'center', labelFontSize: isRoot ? 14 : 11, labelFontWeight: 720, labelMaxWidth: 108, halo: false }
      } else if (profile.visual === 'orbit') {
        visualStyle = { size: isRoot ? 104 : 34, fill: isRoot ? '#252c42' : color, stroke: '#fff', lineWidth: 3, labelPlacement: isRoot ? 'center' : 'bottom', labelFill: isRoot ? '#fff' : '#333946', labelFontSize: isRoot ? 15 : 10, labelFontWeight: 720, labelOffsetY: isRoot ? 0 : 8, labelMaxWidth: 102, haloLineWidth: 8 }
      } else if (profile.visual === 'honeycomb') {
        visualStyle = { size: isRoot ? 96 : 76, fill: isRoot ? '#252c42' : `${color}dd`, stroke: '#fff', lineWidth: 4, labelPlacement: 'center', labelFill: '#fff', labelFontSize: isRoot ? 14 : 10, labelFontWeight: 760, labelMaxWidth: isRoot ? 70 : 56, halo: false }
      } else if (profile.visual === 'bipartite') {
        visualStyle = { size: isRoot ? [170, 52] : [148, 44], radius: isRoot ? 18 : 7, fill: isRoot ? '#252c42' : '#fff', stroke: isRoot ? '#252c42' : color, labelPlacement: 'center', labelFontSize: isRoot ? 14 : 11, labelFontWeight: 720, labelMaxWidth: 128, halo: false }
      } else if (profile.visual === 'chord') {
        visualStyle = { size: isRoot ? 52 : 28, fill: isRoot ? '#252c42' : color, stroke: '#fff', lineWidth: 3, labelPlacement: 'outside', labelFill: '#323844', labelFontSize: 10, labelFontWeight: 700, labelOffsetY: 8, labelBackground: true, labelBackgroundFill: 'rgba(255,255,255,.9)', labelPadding: [2, 4], halo: false }
      } else if (profile.visual === 'quadrant') {
        visualStyle = { size: isRoot ? [148, 56] : [138, 48], radius: 12, fill: isRoot ? '#252c42' : `${color}12`, stroke: isRoot ? '#252c42' : color, labelPlacement: 'center', labelFontSize: isRoot ? 14 : 11, labelFontWeight: 720, labelMaxWidth: 120, haloLineWidth: 7 }
      } else if (profile.visual === 'pyramid') {
        const pyramidWidth = isRoot ? 156 : 126 + (sequenceIndex % 4) * 12
        visualStyle = { size: [pyramidWidth, isRoot ? 52 : 46], radius: 4, fill: isRoot ? '#252c42' : `${color}d8`, stroke: '#fff', lineWidth: 3, labelPlacement: 'center', labelFill: '#fff', labelFontSize: isRoot ? 14 : 10, labelFontWeight: 760, labelMaxWidth: pyramidWidth - 18, halo: false }
      } else if (profile.visual === 'spectrum') {
        visualStyle = { size: isRoot ? 70 : 28 + (sequenceIndex % 3) * 8, fill: isRoot ? '#252c42' : color, stroke: '#fff', lineWidth: 3, labelPlacement: isRoot ? 'center' : (sequenceIndex % 2 ? 'top' : 'bottom'), labelFill: isRoot ? '#fff' : '#323844', labelFontSize: isRoot ? 13 : 10, labelFontWeight: 720, labelOffsetY: sequenceIndex % 2 ? -8 : 8, labelBackground: !isRoot, labelBackgroundFill: 'rgba(255,255,255,.92)', labelPadding: [2, 4], halo: false }
      } else if (profile.visual === 'heatmap') {
        visualStyle = { size: isRoot ? [180, 50] : [150, 96], radius: isRoot ? 16 : 2, fill: isRoot ? '#252c42' : `${color}${sequenceIndex % 2 ? 'ba' : '7d'}`, stroke: isRoot ? '#252c42' : '#fff', lineWidth: isRoot ? 0 : 5, labelPlacement: 'center', labelFill: isRoot ? '#fff' : '#fff', labelFontSize: isRoot ? 14 : 11, labelFontWeight: 760, labelMaxWidth: isRoot ? 150 : 126, halo: false }
      } else {
        const isCircle = profile.nodeType === 'circle'
        visualStyle = {
          size: isRoot ? (isCircle ? 112 : [184, 64]) : (isCircle ? 50 : [156, 46]), radius: isRoot ? 17 : 11,
          labelPlacement: isRoot || !isCircle ? 'center' : 'bottom', labelFontSize: isRoot ? 16 : (isCircle ? 12 : 13), labelFontWeight: isRoot ? 700 : 600,
          labelMaxWidth: isRoot ? 144 : (isCircle ? 112 : 132), labelLineHeight: 18, labelOffsetY: isCircle && !isRoot ? 8 : 0,
        }
      }
      return {
        id: node.id,
        cluster: node.group || node.kind || node.role,
        order: node.order || sequenceIndex,
        data: { node, branchIndex, color, cluster: node.group || node.kind || node.role },
        style: { ...common, ...visualStyle, ...presetPosition(node, sequenceIndex) },
      }
    }
    const edgeData = (from: string, to: string, branchIndex: number, label = '', edgeIndex = 0): any => {
      const fromIndex = indexById.get(from) || 0
      const toIndex = indexById.get(to) || 0
      const distance = Math.abs(toIndex - fromIndex)
      const edgeColor = branchPalette[Math.max(0, branchIndex) % branchPalette.length]
      const visualEdgeStyle: Record<string, unknown> = profile.visual === 'arc'
        ? { curveOffset: -(52 + distance * 26), lineWidth: 1.3, opacity: 0.58 }
        : profile.visual === 'fishbone'
          ? { lineWidth: 2.8, opacity: 0.72 }
          : profile.visual === 'cycle' || profile.visual === 'chord'
            ? { curveOffset: profile.visual === 'chord' ? 64 + distance * 11 : 42, lineWidth: profile.visual === 'chord' ? 1.15 : 2.2, opacity: profile.visual === 'chord' ? .34 : .72, endArrow: profile.visual === 'cycle' }
          : ['decision', 'flow', 'timeline', 'funnel', 'lanes', 'stairs'].includes(profile.visual)
            ? { lineWidth: 2, opacity: 0.68, endArrow: true }
            : profile.visual === 'grid' || profile.visual === 'heatmap'
              ? { lineWidth: 1, opacity: 0.18 }
              : profile.visual === 'bubbles' || profile.visual === 'honeycomb'
                ? { lineWidth: 1.2, opacity: 0.28 }
                : profile.visual === 'spectrum'
                  ? { lineWidth: 3, opacity: .54 }
                : { lineWidth: 1.55, opacity: 0.52 }
      return {
        id: `${from}__${to}__${edgeIndex}`, source: from, target: to,
        data: { color: edgeColor },
        style: {
          stroke: edgeColor, lineCap: 'round', ...visualEdgeStyle,
          ...(label && from !== currentRoot?.id && !profile.usesTree && !['arc', 'grid'].includes(profile.visual) ? { labelText: shortLabel(label, 6), labelFill: '#697086', labelFontSize: 10 } : {}),
        },
      }
    }
    const positionedNode = (node: KnowledgeMapNode, branchIndex: number, x: number, y: number, sequenceIndex = branchIndex) => {
      const entry = nodeData(node, branchIndex, sequenceIndex)
      return { ...entry, style: { ...entry.style, x, y } }
    }
    const hierarchyGuideNode = (id: string, label: string, color: string, x: number, y: number, mode: 'tree' | 'columns') => ({
      id,
      type: 'rect',
      data: { virtual: true },
      style: {
        x,
        y,
        size: mode === 'columns' ? [168, 38] : [140, 34],
        radius: mode === 'columns' ? 8 : 17,
        fill: `${color}12`,
        stroke: color,
        lineWidth: 1.5,
        labelText: label,
        labelPlacement: 'center',
        labelFill: '#303746',
        labelFontSize: 11,
        labelFontWeight: 720,
        halo: false,
        cursor: 'default',
      },
    })
    const hierarchyEdge = (from: string, to: string, color: string, index: number) => {
      const entry = edgeData(from, to, index, '', index)
      return { ...entry, style: { ...entry.style, stroke: color, lineWidth: 1.55, opacity: .64 } }
    }
    if (currentRoot && profile.id === 'mindmap') {
      const atoms = [...leafNodes].sort((a, b) => (a.order || Number.MAX_SAFE_INTEGER) - (b.order || Number.MAX_SAFE_INTEGER))
      const perSide = [Math.ceil(atoms.length / 2), Math.floor(atoms.length / 2)]
      const nodes = [positionedNode(currentRoot, 0, 500, 300, 0)]
      const edges: any[] = []
      atoms.forEach((node, index) => {
        const side = index % 2
        const slot = Math.floor(index / 2)
        const y = perSide[side] <= 1 ? 300 : 118 + slot * 364 / (perSide[side] - 1)
        nodes.push(positionedNode(node, index, side ? 790 : 210, y, index + 1))
        edges.push(hierarchyEdge(currentRoot.id, node.id, branchPalette[index % branchPalette.length], index))
      })
      return { nodes, edges }
    }
    if (currentRoot && profile.id === 'dendrogram') {
      const atoms = [...leafNodes].sort((a, b) => (a.order || Number.MAX_SAFE_INTEGER) - (b.order || Number.MAX_SAFE_INTEGER))
      const groups = hierarchyGroupsFor(atoms, 'dendrogram', language)
      const nodes: any[] = [positionedNode(currentRoot, 0, 104, 300, 0)]
      const edges: any[] = []
      groups.forEach((group, groupIndex) => {
        const groupY = groups.length === 1 ? 300 : 132 + groupIndex * 336 / (groups.length - 1)
        nodes.push(hierarchyGuideNode(group.id, group.label, group.color, 370, groupY, 'tree'))
        edges.push(hierarchyEdge(currentRoot.id, group.id, group.color, groupIndex))
        group.nodes.forEach((node, nodeIndex) => {
          const branchIndex = atoms.indexOf(node)
          const y = group.nodes.length === 1 ? groupY : groupY - 58 + nodeIndex * 116 / (group.nodes.length - 1)
          nodes.push(positionedNode(node, branchIndex, 688, y, branchIndex + 1))
          edges.push(hierarchyEdge(group.id, node.id, group.color, branchIndex + groups.length))
        })
      })
      return { nodes, edges }
    }
    if (currentRoot && profile.id === 'compact-box') {
      const atoms = [...leafNodes].sort((a, b) => (a.order || Number.MAX_SAFE_INTEGER) - (b.order || Number.MAX_SAFE_INTEGER))
      const groups = hierarchyGroupsFor(atoms, 'compact-box', language)
      const nodes: any[] = [positionedNode(currentRoot, 0, 500, 76, 0)]
      const edges: any[] = []
      groups.forEach((group, groupIndex) => {
        const groupX = groups.length === 1 ? 500 : 188 + groupIndex * 624 / (groups.length - 1)
        nodes.push(hierarchyGuideNode(group.id, group.label, group.color, groupX, 212, 'columns'))
        edges.push(hierarchyEdge(currentRoot.id, group.id, group.color, groupIndex))
        group.nodes.forEach((node, nodeIndex) => {
          const branchIndex = atoms.indexOf(node)
          nodes.push(positionedNode(node, branchIndex, groupX, 330 + nodeIndex * 78, branchIndex + 1))
          edges.push(hierarchyEdge(group.id, node.id, group.color, branchIndex + groups.length))
        })
      })
      return { nodes, edges }
    }
    if (currentRoot && profile.id === 'snake') {
      const atoms = [...leafNodes].sort((a, b) => (a.order || Number.MAX_SAFE_INTEGER) - (b.order || Number.MAX_SAFE_INTEGER))
      const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(atoms.length * 1.6))))
      const nodes: any[] = [positionedNode(currentRoot, 0, 94, 300, 0)]
      atoms.forEach((node, index) => {
        const row = Math.floor(index / columns)
        const slot = index % columns
        const visualSlot = row % 2 ? columns - 1 - slot : slot
        nodes.push(positionedNode(node, index, columns === 1 ? 520 : 248 + visualSlot * 650 / (columns - 1), row % 2 ? 428 : 178, index + 1))
      })
      const path = [currentRoot, ...atoms]
      return {
        nodes,
        edges: path.slice(1).map((node, index) => hierarchyEdge(path[index].id, node.id, branchPalette[index % branchPalette.length], index)),
      }
    }
    if (currentRoot && ['force', 'd3-bubble', 'fruchterman', 'atlas2'].includes(profile.id)) {
      const atoms = [...leafNodes].sort((a, b) => (a.order || Number.MAX_SAFE_INTEGER) - (b.order || Number.MAX_SAFE_INTEGER))
      const templates: Record<'force' | 'd3-bubble' | 'fruchterman' | 'atlas2', Array<[number, number]>> = {
        force: [[190, 205], [360, 120], [625, 130], [820, 235], [820, 420], [620, 500], [345, 490], [175, 390], [300, 305], [705, 300]],
        'd3-bubble': [[295, 150], [520, 118], [735, 168], [846, 322], [700, 492], [415, 500], [190, 385], [185, 245], [410, 260], [685, 370]],
        fruchterman: [[232, 188], [344, 135], [358, 265], [665, 142], [792, 225], [682, 332], [390, 455], [615, 468], [260, 382], [770, 392]],
        atlas2: [[294, 182], [455, 120], [662, 148], [812, 264], [752, 438], [542, 505], [328, 448], [178, 320], [364, 300], [682, 316]],
      }
      const template = templates[profile.id as 'force' | 'd3-bubble' | 'fruchterman' | 'atlas2']
      const nodes = [positionedNode(currentRoot, 0, 500, 300, 0)]
      atoms.forEach((node, index) => {
        const [x, y] = template[index % template.length]
        nodes.push(positionedNode(node, index, x, y, index + 1))
      })
      const baseEdges = edgeDataFor(viewData, currentRoot.id)
      const atlasLinks = profile.id === 'atlas2'
        ? atoms.flatMap((node, index) => atoms[index + 3] ? [{ from: node.id, to: atoms[index + 3].id, label: '' }] : [])
        : []
      return {
        nodes,
        edges: [...baseEdges, ...atlasLinks].map((edge, index) => edgeData(edge.from, edge.to, index, edge.label || '', index)),
      }
    }
    if (profile.visual === 'fishbone' && currentRoot) {
      const atoms = [...leafNodes].sort((a, b) => (a.order || Number.MAX_SAFE_INTEGER) - (b.order || Number.MAX_SAFE_INTEGER))
      const columnCount = Math.max(1, Math.ceil(atoms.length / 2))
      const anchors = Array.from({ length: columnCount }, (_value, index) => ({
        id: `__fishbone_anchor_${index}`,
        style: { x: 242 + index * 185, y: 300, size: 2, opacity: 0, fillOpacity: 0, strokeOpacity: 0, label: false },
        data: { virtual: true },
      }))
      const ribs = atoms.map((node, index) => ({
        id: `fishbone_rib_${index}`,
        source: node.id,
        target: anchors[Math.floor(index / 2)].id,
        style: { stroke: branchPalette[index % branchPalette.length], lineWidth: 2.4, opacity: .72, lineCap: 'round' },
      }))
      const spine = anchors.map((anchor, index) => ({
        id: `fishbone_spine_${index}`,
        source: anchor.id,
        target: anchors[index + 1]?.id || currentRoot.id,
        style: { stroke: '#56627f', lineWidth: 4.2, opacity: .78, lineCap: 'round', endArrow: index === anchors.length - 1 },
      }))
      return {
        nodes: [nodeData(currentRoot, 0, 0), ...atoms.map((node, index) => nodeData(node, index, index)), ...anchors],
        edges: [...ribs, ...spine],
      }
    }
    if (profile.usesTree && graphTree) {
      return treeToGraphData(graphTree, {
        getNodeData: datum => {
          const entry = datum as MapTreeNode
          return { ...nodeData(entry.data.node, entry.data.branchIndex), children: entry.children?.map(child => child.id) }
        },
        getEdgeData: (source, target) => {
          const targetEntry = target as MapTreeNode
          const candidate = viewData.edges.find(edge => edge.from === source.id && edge.to === target.id)
          return edgeData(String(source.id), String(target.id), targetEntry.data.branchIndex, candidate?.label || '')
        },
      })
    }
    let edgeList = edgeDataFor(viewData, currentRoot?.id)
    const orderedLeaves = [...leafNodes].sort((a, b) => (a.order || Number.MAX_SAFE_INTEGER) - (b.order || Number.MAX_SAFE_INTEGER))
    const sequenceEdges = orderedLeaves.length && currentRoot
      ? [
          { from: currentRoot.id, to: orderedLeaves[0].id, label: '' },
          ...orderedLeaves.slice(1).map((node, index) => ({ from: orderedLeaves[index].id, to: node.id, label: '' })),
        ]
      : []
    if (profile.visual === 'fishbone' && currentRoot) {
      edgeList = orderedLeaves.map(node => ({ from: node.id, to: currentRoot.id, label: '' }))
    }
    if (['funnel', 'lanes', 'stairs', 'spectrum'].includes(profile.visual) || profile.id === 'snake') edgeList = sequenceEdges
    if (profile.visual === 'cycle' && currentRoot && orderedLeaves.length) {
      edgeList = [...sequenceEdges, { from: orderedLeaves.at(-1)!.id, to: currentRoot.id, label: '' }]
    }
    if (profile.visual === 'org' && currentRoot) {
      edgeList = orderedLeaves.map((node, index) => ({ from: index < 3 ? currentRoot.id : orderedLeaves[(index - 3) % Math.min(3, orderedLeaves.length)].id, to: node.id, label: '' }))
    }
    if (profile.visual === 'radial-tree' && currentRoot) {
      edgeList = orderedLeaves.map((node, index) => ({ from: index < 4 ? currentRoot.id : orderedLeaves[index % 4].id, to: node.id, label: '' }))
    }
    if (profile.visual === 'outline' && currentRoot) {
      edgeList = orderedLeaves.map((node, index) => ({ from: index < 3 ? currentRoot.id : orderedLeaves[index - 3].id, to: node.id, label: '' }))
    }
    if (profile.visual === 'bipartite' && currentRoot) {
      const left = orderedLeaves.filter((_node, index) => index % 2 === 0)
      const right = orderedLeaves.filter((_node, index) => index % 2 === 1)
      edgeList = [
        ...left.map(node => ({ from: currentRoot.id, to: node.id, label: '' })),
        ...right.map(node => ({ from: currentRoot.id, to: node.id, label: '' })),
        ...left.flatMap((node, index) => right.slice(index, index + 2).map(target => ({ from: node.id, to: target.id, label: '' }))),
      ]
    }
    if (profile.visual === 'chord' && currentRoot) {
      const ring = [currentRoot, ...orderedLeaves]
      edgeList = ring.flatMap((node, index) => [1, 3].map(offset => ring[(index + offset) % ring.length]).filter(Boolean).map(target => ({ from: node.id, to: target.id, label: '' })))
    }
    if (profile.visual === 'pyramid' && currentRoot) {
      edgeList = orderedLeaves.map((node, index) => ({ from: index < 2 ? currentRoot.id : orderedLeaves[Math.floor((index - 2) / 2)].id, to: node.id, label: '' }))
    }
    if (profile.visual === 'heatmap') edgeList = []
    if (profile.id === 'edge-bundling') {
      const leaves = viewData.nodes.filter(node => node.id !== currentRoot?.id)
      const extraEdges: KnowledgeMapData['edges'] = []
      leaves.forEach((node, index) => {
        if (leaves[index + 2]) extraEdges.push({ from: node.id, to: leaves[index + 2].id, label: '' })
        if (leaves[index + 4]) extraEdges.push({ from: node.id, to: leaves[index + 4].id, label: '' })
      })
      edgeList = [...edgeList, ...extraEdges]
    }
    return {
      nodes: viewData.nodes.map((node, index) => nodeData(node, index, index)),
      edges: edgeList.map((edge, index) => edgeData(edge.from, edge.to, indexById.get(edge.to) || 0, edge.label || '', index)),
    }
  }, [currentRoot, graphTree, language, profile, viewData])

  useEffect(() => {
    const nextRootId = rootFor(props.data)?.id
    if (rootIdRef.current !== nextRootId) {
      rootIdRef.current = nextRootId
      setFrames([])
      setSelectedId(null)
      setExpandError(null)
      setMapTypeChoice('auto')
    }
  }, [props.data])

  useEffect(() => {
    if (props.exploration) exploredRef.current = new Set(props.exploration.explored_node_ids)
  }, [props.exploration])

  useEffect(() => {
    const container = canvasRef.current
    if (!container || !currentRoot || !hasLearnableAtoms || !graphData.nodes?.length) {
      setRenderState(hasLearnableAtoms ? 'failed' : 'empty')
      return
    }
    let destroyed = false
    let graph: Graph | null = null
    let retryTimer: number | undefined
    let motionFrame: number | undefined
    setRenderState('booting')
    setMotionSegments([])
    setMotionCore(null)
    const restoreCanvasFrame = () => {
      container.style.position = 'absolute'
      container.style.display = 'grid'
      container.style.inset = '0'
      container.style.width = 'auto'
      container.style.height = 'auto'
    }
    const motionEdges = graphData.edges
      .filter((edge: any) => !String(edge.source).startsWith('__') && !String(edge.target).startsWith('__'))
      .slice(0, 18)
    const toSurfacePoint = (point: [number, number] | Float32Array, bounds: DOMRect) => {
      if (!graph) return null
      const clientPoint = graph.getClientByCanvas(point)
      const x = Number(clientPoint[0]) - bounds.left
      const y = Number(clientPoint[1]) - bounds.top
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    }
    const updateMotionLayer = () => {
      if (destroyed || !graph || !surfaceRef.current) return
      try {
        // Read the surface bounds once per update. Calling getBoundingClientRect
        // for every animated edge can force repeated layout work while G6 is
        // still settling.
        const bounds = surfaceRef.current.getBoundingClientRect()
        const rootPoint = currentRoot ? toSurfacePoint(graph.getElementPosition(currentRoot.id) as [number, number], bounds) : null
        const segments = motionEdges
          .map((edge: any, index: number) => {
            const from = toSurfacePoint(graph!.getElementPosition(String(edge.source)) as [number, number], bounds)
            const to = toSurfacePoint(graph!.getElementPosition(String(edge.target)) as [number, number], bounds)
            if (!from || !to) return null
            return {
              id: String(edge.id || `${edge.source}__${edge.target}__${index}`),
              from,
              to,
              color: String((edge as any).data?.color || branchPalette[index % branchPalette.length]),
            }
          })
          .filter((segment: MotionSegment | null): segment is MotionSegment => Boolean(segment))
        setMotionCore(rootPoint)
        setMotionSegments(segments)
      } catch {
        // The graph can be between layout and renderer commits. The next
        // viewport/layout event will try again without affecting the map.
      }
    }
    const scheduleMotionUpdate = () => {
      if (destroyed || motionFrame !== undefined) return
      motionFrame = window.requestAnimationFrame(() => {
        motionFrame = undefined
        updateMotionLayer()
      })
    }
    const safelyFitGraph = async () => {
      if (destroyed || !graph) return
      await graph.fitView({ when: 'always' })
      if (destroyed || !graph) return
      // A sparse response used to be enlarged until a single title occupied
      // the entire canvas. Keep the page readable while retaining normal fit
      // behaviour for rich maps.
      if (graph.getZoom() > maxCanvasZoom) {
        await graph.zoomTo(maxCanvasZoom, { duration: 0 })
        if (!destroyed) await graph.fitCenter({ duration: 0 })
      }
    }
    const createGraph = () => {
      if (destroyed) return
      // G6 writes inline positioning styles onto its host. After an instance is
      // destroyed those styles remain, collapsing the next layout to 0px high.
      // Restore the host frame before measuring and again after construction.
      // Some G6 renderers retain their layered canvases after destroy(); clear
      // the host only after the previous cleanup promise has settled so a new
      // view never inherits ghost nodes or labels from the old one.
      container.replaceChildren()
      restoreCanvasFrame()
      const { width, height } = container.getBoundingClientRect()
      if (width < 20 || height < 20) {
        retryTimer = window.setTimeout(createGraph, 90)
        return
      }
      try {
        graph = new Graph({
          container, data: graphData, autoResize: true, autoFit: 'view', padding: [58, 62, 64, 62], zoomRange: [0.25, maxCanvasZoom],
          animation: { duration: 520, easing: 'ease-out' },
          node: {
            type: ((datum: any) => datum.data?.virtual ? 'rect' : profile.nodeType) as never,
            state: {
              active: { halo: true, haloLineWidth: 24, haloOpacity: .22, lineWidth: 3, labelFontWeight: 760, zIndex: 7 },
              inactive: { fillOpacity: .3, strokeOpacity: .24, labelFillOpacity: .34, haloOpacity: 0 },
              selected: { halo: true, haloLineWidth: 27, haloOpacity: .28, lineWidth: 3.2, zIndex: 8 },
            },
            animation: { enter: 'fade', update: [{ fields: ['x', 'y', 'fill', 'stroke'], duration: 520, easing: 'ease-out' }] },
          } as never,
          edge: {
            type: profile.edgeType as never,
            state: {
              active: { halo: true, haloLineWidth: 8, haloOpacity: .18, lineWidth: 3, strokeOpacity: .96, zIndex: 4 },
              inactive: { strokeOpacity: .12, labelOpacity: .2 },
              selected: { halo: true, haloLineWidth: 9, haloOpacity: .22, lineWidth: 3.2, strokeOpacity: .98, zIndex: 5 },
            },
            animation: { enter: 'path-in', update: [{ fields: ['sourceNode', 'targetNode', 'stroke'], duration: 520, easing: 'ease-out' }] },
          } as never,
          layout: profile.layout as never,
          ...(profile.plugins ? { plugins: profile.plugins as never } : {}),
          behaviors: [
            { type: 'drag-canvas' },
            { type: 'zoom-canvas', sensitivity: 1.06 },
            { type: 'hover-activate', degree: 1, inactiveState: 'inactive', animation: true },
            ...(profile.usesTree ? [{ type: 'collapse-expand', trigger: 'dblclick', animation: true }] : []),
          ],
        })
        restoreCanvasFrame()
        graphRef.current = graph
        graph.on(GraphEvent.AFTER_TRANSFORM, scheduleMotionUpdate)
        graph.on(GraphEvent.AFTER_LAYOUT, scheduleMotionUpdate)
        graph.on(GraphEvent.AFTER_SIZE_CHANGE, scheduleMotionUpdate)
        graph.on(NodeEvent.CLICK, (event: any) => {
          if (!event?.target?.id || String(event.target.id).startsWith('__')) return
          setExpandError(null)
          setSelectedId(String(event.target.id))
        })
        void graph.render().then(async () => {
          if (destroyed || !graph) return
          await safelyFitGraph()
          if (destroyed) return
          scheduleMotionUpdate()
          setRenderState('ready')
          window.setTimeout(() => {
            if (!destroyed) void safelyFitGraph().then(scheduleMotionUpdate)
          }, 520)
        }).catch(() => { if (!destroyed) setRenderState('failed') })
      } catch {
        if (!destroyed) setRenderState('failed')
      }
    }
    let animationFrame: number | undefined
    void graphCleanupRef.current.finally(() => {
      if (!destroyed) animationFrame = window.requestAnimationFrame(createGraph)
    })
    return () => {
      destroyed = true
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame)
      if (retryTimer) window.clearTimeout(retryTimer)
      if (motionFrame !== undefined) window.cancelAnimationFrame(motionFrame)
      if (graph) {
        graph.off(GraphEvent.AFTER_TRANSFORM, scheduleMotionUpdate)
        graph.off(GraphEvent.AFTER_LAYOUT, scheduleMotionUpdate)
        graph.off(GraphEvent.AFTER_SIZE_CHANGE, scheduleMotionUpdate)
        graphCleanupRef.current = Promise.resolve(graph.destroy())
          .catch(() => undefined)
          .then(() => {
            container.replaceChildren()
            restoreCanvasFrame()
          })
      }
      if (graphRef.current === graph) graphRef.current = null
    }
  }, [currentRoot, graphData, graphKey, hasLearnableAtoms, maxCanvasZoom, profile])

  useEffect(() => { setSelectedId(null); setExpandError(null) }, [graphKey])

  async function openDeepDive() {
    if (!selectedNode || !props.onGenerateDeepDive || expanding) return
    const existing = props.data.deep_maps?.[selectedNode.id]
    if (existing) {
      setFrames(currentFrames => [...currentFrames, { title: selectedNode.label, sourceNodeId: selectedNode.id, data: existing }])
      setSelectedId(null)
      setMapTypeChoice('auto')
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
      setMapTypeChoice('auto')
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
    setMapTypeChoice('auto')
  }

  async function resetCanvasView() {
    const graph = graphRef.current
    if (!graph) return
    await graph.fitView({ when: 'always' })
    if (graph.getZoom() > maxCanvasZoom) {
      await graph.zoomTo(maxCanvasZoom, { duration: 0 })
      await graph.fitCenter({ duration: 0 })
    }
  }

  const selectedStatus = selectedNode ? props.progress?.progress[selectedNode.id] || 'new' : 'new'
  const motionEnabled = pageVisible && !reducedMotion
  const displayedMotionSegments = useMemo(
    () => motionSegments.slice(0, lowMotion ? 5 : 10),
    [lowMotion, motionSegments],
  )

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  return <section className={`g6-knowledge-map ${props.workspace ? 'is-workspace' : ''} ${props.reader ? 'is-reader' : ''}`} aria-label={zh ? '知识图解' : 'Knowledge map'}>
    <header className="g6-map-header">
      <div className="g6-map-heading">
        {frames.length > 0 && <button type="button" className="g6-map-back" onClick={goBack}><ArrowLeftRegular />{zh ? '返回主题总览' : 'Back to overview'}</button>}
        <span>{profile.label}</span>
        <h1>{currentTitle}</h1>
      </div>
      <div className="g6-map-header-actions">
        <label className="g6-map-type-picker">
          <span>{zh ? '图解样式' : 'Map style'}</span>
          <select value={mapTypeChoice} onChange={event => setMapTypeChoice(event.target.value as 'auto' | KnowledgeMapViewId)}>
            <option value="auto">{zh ? `${knowledgeMapViewCount} 种图解 · 智能推荐：${mapViewLabel(recommendedViewId, language)}` : `${knowledgeMapViewCount} styles · Recommended: ${mapViewLabel(recommendedViewId, language)}`}</option>
            {knowledgeMapViewGroups.map(group => <optgroup key={group.id} label={zh ? group.zh : group.en}>
              {group.views.map(view => <option key={view.id} value={view.id}>{zh ? view.zh : view.en}</option>)}
            </optgroup>)}
          </select>
          <small>{zh ? `${knowledgeMapViewCount} 种` : `${knowledgeMapViewCount} styles`}</small>
        </label>
      </div>
    </header>

    <div className={`g6-map-surface is-${profile.id}`} data-render-state={renderState} ref={surfaceRef} style={surfaceStyle}>
      <div className="g6-map-atmosphere" aria-hidden="true">
        <span className="g6-map-atmosphere-orb orb-a" />
        <span className="g6-map-atmosphere-orb orb-b" />
        <span className="g6-map-atmosphere-arc arc-a" />
        <span className="g6-map-atmosphere-arc arc-b" />
        <span className="g6-map-atmosphere-grain" />
      </div>
      {renderState === 'empty' ? <div className="g6-map-empty" role="status">
        <div className="g6-map-empty-icon"><BookOpenRegular /></div>
        <h2>{zh ? '这张图还没有可展示的知识节点' : 'This map has no learnable nodes yet'}</h2>
        <p>{zh ? '生成结果目前只有标题，不能把它当作完整图解放大显示。请返回上一级，选择一个知识点重新展开。' : 'The response only contains a title, so it is not shown as a full map. Go back and expand another knowledge point.'}</p>
        {frames.length > 0 && <button type="button" onClick={goBack}><ArrowLeftRegular />{zh ? '返回上一层图解' : 'Back to the previous map'}</button>}
      </div> : <div className="g6-map-fallback" aria-hidden={renderState === 'ready'}>
        <svg className="g6-map-fallback-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {fallbackMap.links.map(link => <line key={link.id} x1={link.from.x} y1={link.from.y} x2={link.to.x} y2={link.to.y} stroke={link.color} />)}
        </svg>
        <div className="g6-map-fallback-core" style={{ '--fallback-core-x': `${fallbackMap.core.x}%`, '--fallback-core-y': `${fallbackMap.core.y}%` } as CSSProperties}>{shortLabel(currentTitle, 14)}</div>
        {fallbackMap.guideNodes.map(node => <div
          key={node.id}
          className="g6-map-fallback-guide"
          style={{ '--fallback-x': `${node.x}%`, '--fallback-y': `${node.y}%`, '--fallback-color': node.color } as CSSProperties}
        >{node.label}</div>)}
        {fallbackMap.nodes.map(node => <button
          key={node.id}
          type="button"
          className="g6-map-fallback-node"
          style={{ '--fallback-x': `${node.x}%`, '--fallback-y': `${node.y}%`, '--fallback-color': node.color } as CSSProperties}
          onClick={() => setSelectedId(node.id)}
        >{node.label}</button>)}
        <span className="g6-map-fallback-status">{renderState === 'failed' ? (zh ? '已切换为兼容视图' : 'Compatibility view') : (zh ? '正在排布图谱' : 'Arranging map')}</span>
      </div>}
      <div className="g6-map-canvas" ref={canvasRef} aria-hidden={renderState !== 'ready'} />
      <svg className="g6-map-motion-layer" aria-hidden="true" data-motion-state={renderState} data-motion-paused={motionEnabled ? 'false' : 'true'}>
        {displayedMotionSegments.map((segment: MotionSegment, index: number) => {
          const path = motionPathFor(segment)
          return <g key={segment.id}>
            <path className="g6-map-motion-trace" d={path} pathLength="100" stroke={segment.color} />
            <circle className="g6-map-motion-signal" r={profile.visual === 'bubbles' ? 3 : 2.5} fill={segment.color}>
              {motionEnabled && <animateMotion dur={`${2.8 + (index % 3) * .35}s`} begin={`${(index % 4) * .24}s`} repeatCount="indefinite" path={path} />}
            </circle>
            <circle className="g6-map-motion-endpoint" cx={segment.to.x} cy={segment.to.y} r="4" fill={segment.color}>
              {motionEnabled && <animate attributeName="r" values="3;7;3" dur={`${3.4 + (index % 4) * .24}s`} begin={`${(index % 5) * .32}s`} repeatCount="indefinite" />}
              {motionEnabled && <animate attributeName="opacity" values=".08;.34;.08" dur={`${3.4 + (index % 4) * .24}s`} begin={`${(index % 5) * .32}s`} repeatCount="indefinite" />}
            </circle>
          </g>
        })}
        {motionCore && <g className="g6-map-motion-core-group">
          <circle className="g6-map-motion-core" cx={motionCore.x} cy={motionCore.y} r="18">
            {motionEnabled && <animate attributeName="r" values="18;36;18" dur="3.4s" repeatCount="indefinite" />}
            {motionEnabled && <animate attributeName="opacity" values=".32;0;.32" dur="3.4s" repeatCount="indefinite" />}
          </circle>
          {motionEnabled && <animateTransform attributeName="transform" type="translate" values="0 0; 1 -1; -1 1; 0 0" dur="4.8s" repeatCount="indefinite" />}
        </g>}
      </svg>
      <div className="g6-map-controls" aria-label={zh ? '画布控制' : 'Canvas controls'}>
        <button type="button" onClick={() => void graphRef.current?.zoomBy(1.16)} aria-label={zh ? '放大' : 'Zoom in'}><ZoomInRegular /></button>
        <button type="button" onClick={() => void graphRef.current?.zoomBy(0.86)} aria-label={zh ? '缩小' : 'Zoom out'}><ZoomOutRegular /></button>
        <button type="button" onClick={() => void resetCanvasView()} aria-label={zh ? '重置视图' : 'Reset view'}><ArrowResetRegular /></button>
      </div>
      {selectedNode && <aside className="g6-map-inspector" aria-live="polite">
        <button type="button" className="g6-map-inspector-close" onClick={() => setSelectedId(null)} aria-label={zh ? '关闭' : 'Close'}><DismissRegular /></button>
        <div className="g6-map-inspector-icon"><NodeGlyph node={selectedNode} /></div>
        <span>{roleLabel(selectedNode, language)}</span>
        <h2>{selectedNode.label}</h2>
        <p>{selectedNode.detail || (zh ? '暂无补充说明。' : 'No extra note yet.')}</p>
        {selectedNode.example && <small><BookOpenRegular /><b>{zh ? '例子' : 'Example'}</b>{selectedNode.example}</small>}
        {selectedNode.mistake && <small className="is-warning"><WarningRegular /><b>{zh ? '易错点' : 'Pitfall'}</b>{selectedNode.mistake}</small>}
        {canOpenDeepDive && <button type="button" className="g6-map-enter" disabled={expanding} onClick={() => void openDeepDive()}><BranchRegular />{expanding ? (zh ? '正在生成专题图…' : 'Building deep map…') : (zh ? '展开这条知识支路' : 'Open this branch')}<ArrowRightRegular /></button>}
        {props.onStatusChange && selectedNode.id !== currentRoot?.id && <div className="g6-map-status-actions">
          <button type="button" className={selectedStatus === 'review' ? 'is-active review' : ''} disabled={props.progressSavingNodeId === selectedNode.id} onClick={() => props.onStatusChange?.(selectedNode.id, 'review')}><WarningRegular />{zh ? '需要复习' : 'Review'}</button>
          <button type="button" className={selectedStatus === 'mastered' ? 'is-active mastered' : ''} disabled={props.progressSavingNodeId === selectedNode.id} onClick={() => props.onStatusChange?.(selectedNode.id, 'mastered')}><CheckmarkRegular />{zh ? '已理解' : 'Understood'}</button>
        </div>}
      </aside>}
      {expandError && <div className="g6-map-error" role="status"><WarningRegular /><span>{expandError}</span><button type="button" onClick={() => setExpandError(null)}>{zh ? '知道了' : 'Dismiss'}</button></div>}
    </div>
  </section>
}
