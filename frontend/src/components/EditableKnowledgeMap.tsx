import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Braces, Check, CirclePlus, EyeOff, GitBranchPlus, Lightbulb, MousePointer2, Play, Redo2, RotateCcw, Save, Sparkles, Target, Trash2, Undo2, X } from 'lucide-react'
import type { KnowledgeMapCollaboration, KnowledgeMapCollaborationSuggestion, KnowledgeMapNodeStatus } from '../services/api'
import { ApplicationValidationLab } from './ApplicationValidationLab'
import { BoundarySpectrumMap } from './BoundarySpectrumMap'
import { CausalMechanismLab } from './CausalMechanismLab'
import { ErrorDiagnosisMap } from './ErrorDiagnosisMap'
import { ProcessRouteMap } from './ProcessRouteMap'
import { RelationshipNetworkMap } from './RelationshipNetworkMap'
import { TermFieldMap } from './TermFieldMap'
import { TimelineChronicleMap } from './TimelineChronicleMap'
import { knowledgeMapSemanticRoles, type KnowledgeMapSemanticRole } from './knowledgeMapSemantic'
import { FormulaText } from './FormulaText'

export type KnowledgeMapNode = {
  id: string
  label: string
  role: 'core' | 'branch' | 'detail'
  kind?: 'core' | 'foundation' | 'principle' | 'process' | 'example' | 'pitfall'
  group?: string
  order?: number
  parent_id?: string
  semantic_role?: KnowledgeMapSemanticRole
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

export type KnowledgeMapType = 'concept_tree' | 'process_flow' | 'comparison_map' | 'system_map' | 'timeline_map' | 'causal_map' | 'relationship_map' | 'decision_map' | 'lab_map'

export type KnowledgeMapData = {
  schema_version: number
  layout: 'mindmap' | 'flow'
  map_type?: KnowledgeMapType
  groups?: string[]
  nodes: KnowledgeMapNode[]
  edges: Array<{ from: string; to: string; label?: string }>
  learning_path: string[]
  visual_scenes?: KnowledgeMapVisualScene[]
  deep_maps?: Record<string, KnowledgeMapDeepDive>
}

export type KnowledgeMapDeepDive = Omit<KnowledgeMapData, 'deep_maps'> & {
  source_node_id: string
  title: string
  summary: string
  content_version?: number
  generated_at?: string
  generation_source?: 'agent' | 'fallback' | 'local'
  source_fingerprint?: string
}

export type KnowledgeMapExplorationState = {
  active_node_id: string
  explored_node_ids: string[]
}

export type KnowledgeMapVisualSceneKind = 'flow_route' | 'stack_tower' | 'input_output_lab' | 'compare_split' | 'formula_board' | 'code_trace' | 'cause_chain' | 'pitfall_fork'

export type KnowledgeMapVisualAnnotation = {
  label: string
  title: string
  body: string
}

export type KnowledgeMapVisualDirection = {
  composition?: 'editorial_path' | 'layered_atlas' | 'experiment_stage' | 'split_argument' | 'formula_poster' | 'code_observatory' | 'causal_landscape' | 'decision_desk'
  visual_language?: 'quiet_editorial' | 'technical_blueprint' | 'paper_collage' | 'museum_label' | 'studio_notebook' | 'cinematic_console'
  annotations?: KnowledgeMapVisualAnnotation[]
  review_prompt?: string
}

export type KnowledgeMapVisualScene = {
  id: string
  kind: KnowledgeMapVisualSceneKind
  theme?: 'coral' | 'violet' | 'cobalt' | 'amber' | 'teal' | 'rose' | 'ink' | 'lime'
  title: string
  statement: string
  takeaway?: string
  node_ids: string[]
  steps?: string[]
  left?: string
  right?: string
  input?: string
  output?: string
  formula?: string
  code?: string
  design?: KnowledgeMapVisualDirection
}

export type KnowledgeMapProgressState = {
  progress: Record<string, Exclude<KnowledgeMapNodeStatus, 'new'>>
  summary: { total: number; mastered: number; review: number; untouched: number }
}

type CanvasMode = 'read' | 'edit'
type EditorTool = 'move' | 'connect'
type MapStudyMode = 'overview' | 'process' | 'recall' | 'review'
type Point = { x: number; y: number }
type TeachingKind = NonNullable<KnowledgeMapNode['kind']>
type VisualKind = NonNullable<NonNullable<KnowledgeMapNode['visual']>['kind']>
type SelectedEdge = Pick<KnowledgeMapData['edges'][number], 'from' | 'to'>

const canvasSize = { width: 1500, height: 820 }
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

function orderedNodes(data: KnowledgeMapData) {
  const core = data.nodes.find(node => node.role === 'core') || data.nodes[0]
  return data.nodes
    .filter(node => node.id !== core.id)
    .sort((a, b) => (a.order || 99) - (b.order || 99))
}

function coreFor(data: KnowledgeMapData) {
  return data.nodes.find(node => node.role === 'core') || data.nodes[0]
}

function parentFor(data: KnowledgeMapData, node: KnowledgeMapNode, root = coreFor(data)) {
  if (!root || node.id === root.id) return undefined
  if (node.parent_id && node.parent_id !== node.id && data.nodes.some(item => item.id === node.parent_id)) return node.parent_id
  // Older saved maps did not have parent_id.  Keep them explorable by
  // placing their former "detail" nodes beneath the nearest earlier branch
  // instead of leaving every atom directly under the core.
  if (node.role === 'detail') {
    const candidates = data.nodes
      .filter(item => item.role === 'branch' && item.id !== node.id)
      .sort((a, b) => (a.order || 99) - (b.order || 99))
    if (candidates.length) {
      const preceding = candidates.filter(item => (item.order || 0) <= (node.order || 99)).at(-1)
      return (preceding || candidates[(node.order || 1) % candidates.length]).id
    }
  }
  return root.id
}

function directChildren(data: KnowledgeMapData, parentId: string) {
  const root = coreFor(data)
  return data.nodes
    .filter(node => parentFor(data, node, root) === parentId)
    .sort((a, b) => (a.order || 99) - (b.order || 99))
}

function descendantsFor(data: KnowledgeMapData, rootId: string) {
  const ids = new Set<string>([rootId])
  const queue = [rootId]
  while (queue.length) {
    const parentId = queue.shift()
    if (!parentId) continue
    directChildren(data, parentId).forEach(child => {
      if (!ids.has(child.id)) { ids.add(child.id); queue.push(child.id) }
    })
  }
  return ids
}

function depthFor(data: KnowledgeMapData, node: KnowledgeMapNode, rootId = coreFor(data)?.id) {
  if (!rootId || node.id === rootId) return 0
  let depth = 0
  let cursor: KnowledgeMapNode | undefined = node
  const seen = new Set<string>()
  while (cursor && cursor.id !== rootId && depth < 4 && !seen.has(cursor.id)) {
    seen.add(cursor.id)
    const parentId = parentFor(data, cursor, coreFor(data))
    cursor = data.nodes.find(item => item.id === parentId)
    depth += 1
  }
  return depth
}

function clampPoint(point: Point, padding = 76): Point {
  return {
    x: Math.max(padding, Math.min(canvasSize.width - padding, point.x)),
    y: Math.max(padding, Math.min(canvasSize.height - padding, point.y)),
  }
}

function treePoints(data: KnowledgeMapData, rootId = coreFor(data)?.id, focused = false) {
  const root = data.nodes.find(node => node.id === rootId) || coreFor(data)
  const points = new Map<string, Point>()
  if (!root) return points
  const center = { x: canvasSize.width / 2, y: canvasSize.height / 2 }
  points.set(root.id, center)
  const branches = directChildren(data, root.id)
  const branchCount = Math.max(branches.length, 1)
  const isFocusedBranch = focused || root.id !== coreFor(data)?.id
  const mapType = isFocusedBranch ? 'concept_tree' : data.map_type || 'concept_tree'
  const isDefinitionTree = mapType === 'concept_tree'
    && !isFocusedBranch
    && branches.length === 3
    && branches.every(branch => directChildren(data, branch.id).length === 1)
  const causalMainLabels = ['前提条件', '判断信号', '作用规则', '关系变化', '得到结论']
  const causalNodes = new Map(data.nodes.map(node => [node.label, node]))
  const isCausalChain = mapType === 'causal_map'
    && !isFocusedBranch
    && causalMainLabels.every(label => causalNodes.has(label))

  if (isCausalChain) {
    // Mechanism maps are read as a causal route, not a set of related
    // concepts.  The main chain answers "why does this conclusion follow?"
    // while the two lower paths answer "when does it fail?" and "how do I
    // check it from the other direction?".
    points.set(root.id, { x: 162, y: 402 })
    const mainSlots: Point[] = [
      { x: 420, y: 252 }, { x: 640, y: 252 }, { x: 860, y: 252 }, { x: 1080, y: 252 }, { x: 1300, y: 252 },
    ]
    causalMainLabels.forEach((label, index) => {
      const node = causalNodes.get(label)
      if (node) points.set(node.id, mainSlots[index])
    })
    const failure = causalNodes.get('不能成立时')
    const verification = causalNodes.get('反向验证')
    if (failure) points.set(failure.id, { x: 470, y: 618 })
    if (verification) points.set(verification.id, { x: 1185, y: 618 })
  } else if (mapType === 'causal_map' && !isFocusedBranch) {
    // A causal explanation moves through a single, winding line.  The
    // alternating lanes make "why this leads to that" readable at a glance.
    points.set(root.id, { x: 170, y: center.y })
    const slots: Point[] = [
      { x: 440, y: 154 }, { x: 720, y: 154 }, { x: 1000, y: 154 }, { x: 1280, y: 154 },
      { x: 1280, y: 660 }, { x: 990, y: 660 }, { x: 700, y: 660 }, { x: 420, y: 660 },
    ]
    branches.forEach((branch, index) => points.set(branch.id, slots[index] || clampPoint({ x: 420 + index * 150, y: index % 2 ? 660 : 154 }, 76)))
  } else if (mapType === 'decision_map' && !isFocusedBranch) {
    // A decision map starts from one judgement and visibly forks into the
    // risky and safe routes before converging on the correction.
    points.set(root.id, { x: center.x, y: 126 })
    const slots: Point[] = [
      { x: 420, y: 350 }, { x: 1080, y: 350 }, { x: 278, y: 620 }, { x: 574, y: 620 },
      { x: 926, y: 620 }, { x: 1222, y: 620 }, { x: 750, y: 748 },
    ]
    branches.forEach((branch, index) => points.set(branch.id, slots[index] || clampPoint({ x: 750 + (index - 3) * 180, y: 690 }, 76)))
  } else if (mapType === 'lab_map' && !isFocusedBranch) {
    // The example view stages concrete input, transformation and output like
    // a small experiment rather than another generic mind-map.
    points.set(root.id, center)
    const slots: Point[] = [
      { x: 222, y: 224 }, { x: 222, y: 594 }, { x: 510, y: 140 }, { x: 510, y: 680 },
      { x: 990, y: 140 }, { x: 990, y: 680 }, { x: 1278, y: 410 },
    ]
    branches.forEach((branch, index) => points.set(branch.id, slots[index] || clampPoint({ x: 750 + (index - 3) * 176, y: index % 2 ? 670 : 150 }, 76)))
  } else if (mapType === 'process_flow' && !isFocusedBranch && branches.length <= 8 && data.nodes.length <= 10) {
    // A route is read in sequence, so it sweeps across the canvas instead of
    // compressing every step into one vertical column.
    points.set(root.id, { x: 170, y: center.y })
    const slots: Point[] = [
      { x: 438, y: 168 }, { x: 728, y: 168 }, { x: 1018, y: 168 }, { x: 1308, y: 168 },
      { x: 1308, y: 650 }, { x: 1018, y: 650 }, { x: 728, y: 650 }, { x: 438, y: 650 },
    ]
    branches.forEach((branch, index) => points.set(branch.id, slots[index] || clampPoint({ x: 440 + index * 160, y: index % 2 ? 650 : 168 }, 76)))
  } else if (mapType === 'process_flow' && !isFocusedBranch) {
    points.set(root.id, { x: 172, y: center.y })
    branches.forEach((branch, branchIndex) => {
      const y = 116 + branchIndex / Math.max(branchCount - 1, 1) * 588
      points.set(branch.id, { x: 560, y })
      const leaves = directChildren(data, branch.id)
      leaves.forEach((leaf, leafIndex) => {
        const yOffset = (leafIndex - (leaves.length - 1) / 2) * 98
        points.set(leaf.id, clampPoint({ x: 1014 + (leafIndex % 2) * 228, y: y + yOffset }, 86))
        directChildren(data, leaf.id).forEach((detail, detailIndex) => {
          points.set(detail.id, clampPoint({ x: 1394, y: y + yOffset + (detailIndex ? 66 : -66) }, 72))
        })
      })
    })
  } else if (mapType === 'timeline_map' && !isFocusedBranch && branches.length <= 8 && data.nodes.length <= 10) {
    points.set(root.id, { x: 170, y: center.y })
    const slots: Point[] = [
      { x: 444, y: 186 }, { x: 742, y: 186 }, { x: 1040, y: 186 }, { x: 1338, y: 186 },
      { x: 1338, y: 632 }, { x: 1040, y: 632 }, { x: 742, y: 632 }, { x: 444, y: 632 },
    ]
    branches.forEach((branch, index) => points.set(branch.id, slots[index] || clampPoint({ x: 440 + index * 164, y: index % 2 ? 632 : 186 }, 76)))
  } else if (mapType === 'timeline_map' && !isFocusedBranch) {
    points.set(root.id, { x: 128, y: 210 })
    branches.forEach((branch, branchIndex) => {
      const x = 312 + branchIndex / Math.max(branchCount - 1, 1) * 1040
      points.set(branch.id, { x, y: 316 })
      const leaves = directChildren(data, branch.id)
      leaves.forEach((leaf, leafIndex) => {
        points.set(leaf.id, clampPoint({ x: x + (leafIndex - (leaves.length - 1) / 2) * 148, y: 612 + (leafIndex % 2) * 92 }, 92))
        directChildren(data, leaf.id).forEach((detail, detailIndex) => {
          points.set(detail.id, clampPoint({ x: x + detailIndex * 92, y: 748 }, 62))
        })
      })
    })
  } else if (mapType === 'comparison_map' && !isFocusedBranch) {
    points.set(root.id, center)
    branches.forEach((branch, branchIndex) => {
      const side = branchIndex % 2 === 0 ? -1 : 1
      const row = Math.floor(branchIndex / 2)
      const y = 218 + row * 194
      points.set(branch.id, { x: center.x + side * 354, y })
      const leaves = directChildren(data, branch.id)
      leaves.forEach((leaf, leafIndex) => {
        points.set(leaf.id, clampPoint({ x: center.x + side * 638, y: y + (leafIndex - (leaves.length - 1) / 2) * 104 }, 102))
      })
    })
  } else if (isDefinitionTree) {
    // A definition map reads from top to bottom: the topic becomes three
    // distinct routes (define, delimit, recognise), each ending in its own
    // small learning action.  It is deliberately not a radial mind-map.
    points.set(root.id, { x: 750, y: 122 })
    const branchSlots: Point[] = [
      { x: 280, y: 402 }, { x: 750, y: 402 }, { x: 1220, y: 402 },
    ]
    const leafSlots: Point[] = [
      { x: 280, y: 654 }, { x: 750, y: 654 }, { x: 1220, y: 654 },
    ]
    branches.forEach((branch, branchIndex) => {
      points.set(branch.id, branchSlots[branchIndex])
      const leaf = directChildren(data, branch.id)[0]
      if (leaf) points.set(leaf.id, leafSlots[branchIndex])
    })
  } else if (mapType === 'concept_tree' && !isFocusedBranch) {
    // First-view maps deliberately stop at one readable layer: one topic in
    // the middle and up to eight knowledge atoms around it.  This lets the
    // learner take in the whole subject before a later, explicit deep-dive.
    if (branches.length <= 8 && data.nodes.length <= 10) {
      const overviewSlots: Point[] = [
        { x: 266, y: 154 }, { x: 266, y: 406 }, { x: 266, y: 656 }, { x: 750, y: 106 },
        { x: 1234, y: 154 }, { x: 1234, y: 406 }, { x: 1234, y: 656 }, { x: 750, y: 714 },
      ]
      points.set(root.id, center)
      branches.forEach((branch, branchIndex) => {
        points.set(branch.id, overviewSlots[branchIndex] || clampPoint({
          x: center.x + Math.cos(branchIndex / branchCount * Math.PI * 2) * 470,
          y: center.y + Math.sin(branchIndex / branchCount * Math.PI * 2) * 286,
        }, 74))
      })
    } else {
      // Retain a safe tree layout for learner-authored maps that have grown
      // beyond the compact overview.  Generation itself stays compact.
      points.set(root.id, { x: 218, y: center.y })
      branches.forEach((branch, branchIndex) => {
        const y = 108 + branchIndex / Math.max(branchCount - 1, 1) * 604
        points.set(branch.id, { x: 610, y })
        const leaves = directChildren(data, branch.id)
        const leafCount = Math.max(leaves.length, 1)
        leaves.forEach((leaf, leafIndex) => {
          const x = leafCount === 1 ? 1138
            : leafCount === 2 ? [1000, 1272][leafIndex]
              : leafCount === 3 ? [890, 1138, 1386][leafIndex]
                : [800, 990, 1180, 1370][leafIndex] || 1138
          points.set(leaf.id, clampPoint({ x, y }, 56))
          directChildren(data, leaf.id).forEach((detail, detailIndex) => {
            points.set(detail.id, clampPoint({ x: 1426, y: y + (detailIndex ? 82 : -82) }, 56))
          })
        })
      })
    }
  } else {
    const radiusX = mapType === 'system_map' ? 294 : 330
    const radiusY = mapType === 'system_map' ? 204 : 224
    const leafRadiusX = mapType === 'system_map' ? 590 : 646
    const leafRadiusY = mapType === 'system_map' ? 382 : 410
    branches.forEach((branch, branchIndex) => {
      const angle = -Math.PI / 2 + branchIndex / branchCount * Math.PI * 2
      points.set(branch.id, {
        x: center.x + Math.cos(angle) * radiusX,
        y: center.y + Math.sin(angle) * radiusY,
      })
      const leaves = directChildren(data, branch.id)
      const leafCount = Math.max(leaves.length, 1)
      leaves.forEach((leaf, leafIndex) => {
        const offset = (leafIndex - (leafCount - 1) / 2) * Math.min(.52, 1.56 / Math.max(leafCount, 1))
        const leafAngle = angle + offset
        points.set(leaf.id, clampPoint({
          x: center.x + Math.cos(leafAngle) * leafRadiusX,
          y: center.y + Math.sin(leafAngle) * leafRadiusY,
        }, 56))
        const details = directChildren(data, leaf.id)
        details.forEach((detail, detailIndex) => {
          const detailAngle = leafAngle + (detailIndex - (details.length - 1) / 2) * .13
          points.set(detail.id, clampPoint({
            x: center.x + Math.cos(detailAngle) * (leafRadiusX + 94),
            y: center.y + Math.sin(detailAngle) * (leafRadiusY + 58),
          }, 76))
        })
      })
    })
  }
  data.nodes.filter(node => !points.has(node.id)).forEach((node, index) => {
    const angle = -Math.PI / 2 + index / Math.max(data.nodes.length - 1, 1) * Math.PI * 2
    points.set(node.id, { x: center.x + Math.cos(angle) * 290, y: center.y + Math.sin(angle) * 200 })
  })
  return points
}

function isLegacyDefinitionTree(data: KnowledgeMapData) {
  const expectedLabels = ['一句定义', '关键词', '适用边界', '相近概念', '识别线索', '一句复述']
  const labels = new Set(data.nodes.map(node => node.label))
  const root = coreFor(data)
  return data.map_type === 'concept_tree'
    && (data.schema_version || 0) < 7
    && Boolean(root)
    && expectedLabels.every(label => labels.has(label))
}

function normalizeLegacyDefinitionTree(data: KnowledgeMapData): KnowledgeMapData {
  const root = coreFor(data)
  if (!isLegacyDefinitionTree(data) || !root) return data

  const branchParentByLabel: Record<string, string> = {
    关键词: '一句定义',
    相近概念: '适用边界',
    一句复述: '识别线索',
  }
  const nodeIdByLabel = new Map(data.nodes.map(node => [node.label, node.id]))
  return {
    ...data,
    schema_version: 7,
    nodes: data.nodes.map(node => ({
      ...node,
      parent_id: branchParentByLabel[node.label]
        ? nodeIdByLabel.get(branchParentByLabel[node.label]) || root.id
        : node.id === root.id ? undefined : root.id,
      role: branchParentByLabel[node.label] ? 'detail' : node.id === root.id ? 'core' : 'branch',
    })),
    edges: [
      { from: root.id, to: nodeIdByLabel.get('一句定义') || root.id, label: '解释' },
      { from: nodeIdByLabel.get('一句定义') || root.id, to: nodeIdByLabel.get('关键词') || root.id, label: '拆解' },
      { from: root.id, to: nodeIdByLabel.get('适用边界') || root.id, label: '限定' },
      { from: nodeIdByLabel.get('适用边界') || root.id, to: nodeIdByLabel.get('相近概念') || root.id, label: '辨析' },
      { from: root.id, to: nodeIdByLabel.get('识别线索') || root.id, label: '应用' },
      { from: nodeIdByLabel.get('识别线索') || root.id, to: nodeIdByLabel.get('一句复述') || root.id, label: '自检' },
    ].filter(edge => edge.from !== edge.to),
  }
}

function isLegacyCausalMap(data: KnowledgeMapData) {
  const expectedLabels = ['前提条件', '判断信号', '作用规则', '关系变化', '得到结论', '反向验证', '不能成立时']
  const labels = new Set(data.nodes.map(node => node.label))
  return data.map_type === 'causal_map'
    && (data.schema_version || 0) < 8
    && expectedLabels.every(label => labels.has(label))
}

function normalizeLegacyCausalMap(data: KnowledgeMapData): KnowledgeMapData {
  const root = coreFor(data)
  if (!isLegacyCausalMap(data) || !root) return data

  const parentByLabel: Record<string, string | undefined> = {
    前提条件: undefined,
    判断信号: '前提条件',
    作用规则: '判断信号',
    关系变化: '作用规则',
    得到结论: '关系变化',
    反向验证: '得到结论',
    不能成立时: '前提条件',
  }
  const edgeLabels: Record<string, string> = {
    前提条件: '先满足', 判断信号: '识别', 作用规则: '触发', 关系变化: '导致', 得到结论: '推出', 反向验证: '反向检查', 不能成立时: '缺少条件',
  }
  const nodeIdByLabel = new Map(data.nodes.map(node => [node.label, node.id]))
  return {
    ...data,
    schema_version: 8,
    nodes: data.nodes.map(node => {
      const parentLabel = parentByLabel[node.label]
      return {
        ...node,
        parent_id: node.id === root.id ? undefined : parentLabel ? nodeIdByLabel.get(parentLabel) || root.id : root.id,
        role: node.id === root.id ? 'core' : 'branch',
      }
    }),
    edges: data.nodes
      .filter(node => node.id !== root.id && nodeIdByLabel.has(node.label))
      .map(node => ({
        from: parentByLabel[node.label] ? nodeIdByLabel.get(parentByLabel[node.label] || '') || root.id : root.id,
        to: node.id,
        label: edgeLabels[node.label] || '关联',
      }))
      .filter(edge => edge.from !== edge.to),
  }
}

function isLegacyOverviewWithoutTimeline(data: KnowledgeMapData) {
  const labels = new Set(data.nodes.map(node => node.label))
  const expected = ['概念边界', '关键术语', '成立机制', '关键关系', '推理路径', '应用验证', '常见误判', '自检动作']
  return expected.every(label => labels.has(label))
    && !data.nodes.some(node => /(时间脉络|发展脉络|历史演变)/.test(node.label))
}

function normalizeLegacyOverviewTimeline(data: KnowledgeMapData): KnowledgeMapData {
  const root = coreFor(data)
  if (!root || !isLegacyOverviewWithoutTimeline(data)) return data
  return {
    ...data,
    schema_version: Math.max(10, data.schema_version || 1),
    groups: [...new Set([...(data.groups || []), '脉络'])],
    nodes: data.nodes.map(node => node.label !== '自检动作' ? node : ({
      ...node,
      label: '发展脉络',
      group: '脉络',
      kind: 'process',
      detail: `回看“${root.label}”从问题出现、方法形成到当前理解的关键变化。`,
      example: node.example || root.example,
      mistake: '只背最终结论，没有理解它为什么会逐步形成。',
      visual: { kind: 'sequence', headline: '起源 → 转折 → 现状', items: ['最初问题', '关键转折', '当前认识'] },
    })),
    edges: data.edges.map(edge => edge.to === data.nodes.find(node => node.label === '自检动作')?.id
      ? { ...edge, label: '回看演变' }
      : edge),
  }
}

function withPositions(data: KnowledgeMapData, reset = false): KnowledgeMapData {
  const isLegacy = isLegacyDefinitionTree(data) || isLegacyCausalMap(data) || isLegacyOverviewWithoutTimeline(data)
  const normalized = normalizeLegacyOverviewTimeline(normalizeLegacyCausalMap(normalizeLegacyDefinitionTree(data)))
  const points = treePoints(normalized)
  return {
    ...normalized,
    schema_version: Math.max(10, normalized.schema_version || 1),
    nodes: normalized.nodes.map(node => ({ ...node, position: reset || isLegacy || !node.position ? points.get(node.id) || { x: canvasSize.width / 2, y: canvasSize.height / 2 } : node.position })),
  }
}

function focusedMap(data: KnowledgeMapData, focusId: string) {
  const ids = descendantsFor(data, focusId)
  const scopedNodes = data.nodes.filter(node => ids.has(node.id))
  const scoped = { ...data, nodes: scopedNodes, edges: data.edges.filter(edge => ids.has(edge.from) && ids.has(edge.to)) }
  const points = treePoints(scoped, focusId, true)
  return { ...scoped, nodes: scoped.nodes.map(node => ({ ...node, position: points.get(node.id) || node.position })) }
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

function connectedNodes(data: KnowledgeMapData, nodeId: string) {
  const connectedIds = data.edges
    .filter(edge => edge.from === nodeId || edge.to === nodeId)
    .map(edge => edge.from === nodeId ? edge.to : edge.from)
  return [...new Set(connectedIds)].map(id => data.nodes.find(node => node.id === id)).filter((node): node is KnowledgeMapNode => Boolean(node))
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
  if (kind === 'formula') return <div className="map-visual visual-formula"><strong><FormulaText>{visual.formula || headline}</FormulaText></strong><span><FormulaText>{visual.formula ? headline : ''}</FormulaText></span></div>
  if (kind === 'comparison') return <div className="map-visual visual-comparison"><span><FormulaText>{visual.before || items[0] || '原状态'}</FormulaText></span><ArrowRight size={14} /><strong><FormulaText>{visual.after || items[1] || headline}</FormulaText></strong></div>
  if (kind === 'stack') return <div className="map-visual visual-stack">{(items.length ? items : [headline]).map((item, step) => <span key={`${node.id}-${item}`}><i>{step + 1}</i><FormulaText>{item}</FormulaText></span>)}</div>
  if (kind === 'sequence') return <div className="map-visual visual-sequence">{(items.length ? items : [headline]).map((item, step) => <span key={`${node.id}-${item}`}><i>{step + 1}</i><FormulaText>{item}</FormulaText></span>)}</div>
  if (kind === 'code') return <div className="map-visual visual-code"><Braces size={14} /><code><FormulaText>{visual.code || headline}</FormulaText></code></div>
  if (kind === 'input_output') return <div className="map-visual visual-io"><span><FormulaText>{visual.input || items[0] || '输入'}</FormulaText></span><ArrowRight size={14} /><strong><FormulaText>{visual.output || items[1] || headline}</FormulaText></strong></div>
  if (kind === 'warning') return <div className="map-visual visual-warning"><AlertTriangle size={14} /><span><FormulaText>{headline}</FormulaText></span></div>
  return <div className="map-visual visual-definition"><Lightbulb size={14} /><span><FormulaText>{headline}</FormulaText></span></div>
}

function MapNodeGlyph({ kind }: { kind: TeachingKind }) {
  const Icon = kind === 'core' ? Sparkles
    : kind === 'foundation' ? BookOpen
      : kind === 'principle' ? Lightbulb
        : kind === 'process' ? Play
          : kind === 'example' ? Braces
            : AlertTriangle
  return <span className={`map-node-glyph glyph-${kind}`} aria-hidden="true"><Icon size={15} strokeWidth={1.8} /></span>
}

type DeepDiveTemplate = Pick<KnowledgeMapNode, 'label' | 'kind' | 'group' | 'detail' | 'example' | 'mistake' | 'visual'>

function hasCompleteSemanticRoles(data: KnowledgeMapDeepDive, expectedMapType: KnowledgeMapType) {
  const expected = knowledgeMapSemanticRoles[expectedMapType]
  const actual = new Set(data.nodes.filter(node => node.role !== 'core').map(node => node.semantic_role).filter(Boolean))
  return expected.every(role => actual.has(role))
}

function deepDiveTemplates(source: KnowledgeMapNode, data: KnowledgeMapData): { mapType: KnowledgeMapType; layout: KnowledgeMapData['layout']; templates: DeepDiveTemplate[] } {
  const focus = `“${source.label}”`
  const detail = source.detail || `${focus}在当前主题中的作用。`
  const example = source.example || '回到一个具体题目，确认这个判断是否成立。'
  const mistake = source.mistake || '先检查前提、步骤和结果是否对应。'
  const visual = (kind: VisualKind, headline: string, extra: Partial<NonNullable<KnowledgeMapNode['visual']>> = {}) => ({ kind, headline, ...extra })
  const semanticText = `${source.label} ${source.group || ''}`

  if (source.role === 'core' || teachingKindFor(source) === 'core') {
    const related = orderedNodes(data).slice(0, 8).map(node => ({
      label: node.label,
      kind: teachingKindFor(node),
      group: groupFor(node, 0, true),
      detail: node.detail || `${node.label}与${focus}的关系。`,
      example: node.example,
      mistake: node.mistake,
      visual: node.visual || visual(visualKindFor(node), `理解${node.label}在整体中的位置`),
    }))
    return { mapType: 'system_map', layout: 'mindmap', templates: related.length ? related : [{ label: '核心关系', kind: 'foundation', group: '关系', detail, example, mistake, visual: visual('definition', detail) }] }
  }

  if (/(术语|关键词|词汇|名词)/.test(semanticText)) return {
    mapType: 'system_map', layout: 'mindmap', templates: [
      { label: '术语原名', kind: 'foundation', group: '名称', detail: `确认${focus}的正式名称、常见写法和出现位置。`, example, mistake, visual: visual('definition', '先认出它叫什么') },
      { label: '一句释义', kind: 'foundation', group: '含义', detail, example, mistake, visual: visual('definition', `用一句话解释${focus}`) },
      { label: '关键属性', kind: 'principle', group: '属性', detail: `提取${focus}不能缺少的核心属性。`, example, mistake, visual: visual('stack', '名称背后的关键属性', { items: ['它是什么', '它有什么特征', '它解决什么问题'] }) },
      { label: '同义说法', kind: 'example', group: '别名', detail: `整理材料中可能代指${focus}的其他表达。`, example, mistake, visual: visual('comparison', '不同说法，同一含义', { before: '教材表述', after: '自己的说法' }) },
      { label: '题目信号', kind: 'process', group: '识别', detail: `找到题目中提示需要使用${focus}的词语或情境。`, example, mistake, visual: visual('sequence', '看到信号 → 联想到术语', { items: ['圈出信号词', '对应术语', '检查条件'] }) },
      { label: '易混淆词', kind: 'pitfall', group: '辨析', detail: `列出与${focus}最容易混淆的术语，并指出差别。`, example, mistake, visual: visual('warning', '字面相近不代表含义相同') },
      { label: '用自己的话', kind: 'example', group: '复述', detail: `不用原句重新解释${focus}，再给出一个小情境。`, example, mistake, visual: visual('input_output', '把术语变成理解', { input: '教材术语', output: '自己的解释' }) },
    ],
  }

  if (/(边界|适用范围|成立范围|使用范围)/.test(semanticText)) return {
    mapType: 'comparison_map', layout: 'mindmap', templates: [
      { label: '核心定义', kind: 'foundation', group: '定义', detail, example, mistake, visual: visual('definition', `先固定${focus}的准确含义`) },
      { label: '属于这个概念', kind: 'example', group: '范围内', detail: `找出完全满足${focus}定义与条件的典型情况。`, example, mistake, visual: visual('input_output', '符合全部条件', { input: '条件完整', output: '属于概念' }) },
      { label: '不属于这个概念', kind: 'pitfall', group: '范围外', detail: `找出看起来相似、但缺少关键条件的情况。`, example, mistake, visual: visual('warning', '缺少必要条件时应排除') },
      { label: '必要条件', kind: 'principle', group: '判定线', detail: `列出判断${focus}时不能缺少的条件。`, example, mistake, visual: visual('formula', '全部满足才进入范围', { formula: '定义 + 必要条件 → 属于' }) },
      { label: '易混淆对象', kind: 'principle', group: '相邻概念', detail: `把${focus}与最容易混淆的概念并排比较。`, example, mistake, visual: visual('comparison', '相似但不同', { before: '表面相近', after: '关键条件不同' }) },
      { label: '边界反例', kind: 'pitfall', group: '反例', detail: `选择一个只差一个条件的例子，观察它为什么被排除。`, example, mistake, visual: visual('comparison', '只改变一个条件', { before: '满足条件', after: '不再属于' }) },
      { label: '快速判定', kind: 'process', group: '检查', detail: `用定义、必要条件和反例完成一次快速判断。`, example, mistake, visual: visual('sequence', '定义 → 条件 → 结论', { items: ['对照定义', '检查必要条件', '给出判断'] }) },
    ],
  }

  if (/(关键关系|变量关系|对应关系|相互关系|关联关系|联系)/.test(semanticText)) return {
    mapType: 'relationship_map', layout: 'mindmap', templates: [
      { label: '关系主体', kind: 'foundation', group: '主体', detail: `明确${focus}中首先被观察、比较或解释的核心对象。`, example, mistake, visual: visual('definition', '先固定关系的一端') },
      { label: '关联对象', kind: 'foundation', group: '对象', detail: `找出与关系主体发生联系的另一对象、变量或状态。`, example, mistake, visual: visual('comparison', '关系连接谁与谁', { before: '关系主体', after: '关联对象' }) },
      { label: '关系方向', kind: 'principle', group: '方向', detail, example, mistake, visual: visual('formula', source.visual?.formula || '主体变化 → 对象响应', { formula: source.visual?.formula || '主体变化 → 对象响应' }) },
      { label: '成立条件', kind: 'principle', group: '条件', detail: `列出${focus}能够稳定成立时不能缺少的条件。`, example, mistake, visual: visual('stack', '条件共同约束关系', { items: ['对象匹配', '条件满足', '范围一致'] }) },
      { label: '共同变化', kind: 'process', group: '联动', detail: `观察一端改变时，另一端怎样同步、滞后或反向改变。`, example, mistake, visual: visual('comparison', '比较两端的变化', { before: '主体发生变化', after: '对象产生响应' }) },
      { label: '冲突或例外', kind: 'pitfall', group: '例外', detail: `找出${focus}不成立、方向反转或被其他条件打断的情况。`, example, mistake, visual: visual('warning', '关系不是在所有条件下都成立') },
      { label: '验证证据', kind: 'example', group: '证据', detail: `用题目条件、实例或反例验证${focus}确实存在，而不是只凭相似性判断。`, example, mistake, visual: visual('input_output', '用证据检验关系', { input: '具体条件或案例', output: '关系成立或被否定' }) },
    ],
  }

  if (/(时间脉络|发展脉络|历史|演变|演化|发展过程|阶段变化)/.test(semanticText)) return {
    mapType: 'timeline_map', layout: 'flow', templates: [
      { label: '起源状态', kind: 'foundation', group: '开端', detail: `“${coreFor(data)?.label || '当前主题'}”最初要解释的问题是：${shortText(coreFor(data)?.detail || detail, 54)}`, example: coreFor(data)?.example || example, mistake, visual: visual('definition', '从主题最初要解决的问题开始') },
      { label: '早期阶段', kind: 'foundation', group: '萌芽', detail: `早期理解先从“${data.nodes.find(node => /概念边界|关键术语/.test(node.label))?.label || '基础定义'}”建立共同语言，再确认使用范围。`, example: data.nodes.find(node => /概念边界|关键术语/.test(node.label))?.detail || example, mistake, visual: visual('sequence', '从定义到初步形成', { items: ['确定概念', '统一术语', '划清范围'] }) },
      { label: '关键转折', kind: 'principle', group: '转折', detail: `真正的转折来自“${data.nodes.find(node => /成立机制|关键关系/.test(node.label))?.label || '内部机制'}”：学习从记住结论转向解释为什么成立。`, example: data.nodes.find(node => /成立机制|关键关系/.test(node.label))?.detail || example, mistake, visual: visual('comparison', '理解方式发生转变', { before: '只记结论', after: '能够解释机制' }) },
      { label: '演变过程', kind: 'process', group: '发展', detail: data.nodes.find(node => /推理路径/.test(node.label))?.detail || detail, example: data.nodes.find(node => /推理路径/.test(node.label))?.example || example, mistake, visual: visual('sequence', '沿真实推理逐步发展', { items: ['读取条件', '应用规则', '形成结论'] }) },
      { label: '阶段里程碑', kind: 'example', group: '里程碑', detail: `当学习者能够完成“${data.nodes.find(node => /应用验证/.test(node.label))?.label || '应用验证'}”，主题就从理解阶段进入可迁移使用阶段。`, example: data.nodes.find(node => /应用验证/.test(node.label))?.example || example, mistake, visual: visual('input_output', '从理解到会用', { input: '具体问题', output: '完成应用验证' }) },
      { label: '当前状态', kind: 'example', group: '现状', detail: `当前对“${coreFor(data)?.label || '这个主题'}”的稳定认识是：${shortText(coreFor(data)?.detail || detail, 60)}`, example: coreFor(data)?.example || example, mistake, visual: visual('definition', '把前面阶段沉淀为当前认识') },
      { label: '回望与启示', kind: 'pitfall', group: '回望', detail: `回看整条脉络，最需要警惕的是：${data.nodes.find(node => /常见误判/.test(node.label))?.mistake || mistake}`, example: data.nodes.find(node => /常见误判/.test(node.label))?.detail || example, mistake, visual: visual('warning', '用变化解释现状，也记住错误从哪里出现') },
    ],
  }

  if (/(成立机制|作用机制|因果|机制|作用)/.test(semanticText)) return {
    mapType: 'causal_map', layout: 'flow', templates: [
      { label: '前提条件', kind: 'foundation', group: '输入', detail: `先确认${focus}启动前需要具备什么条件。`, example, mistake, visual: visual('formula', '前提成立', { formula: '必要条件 → 机制启动' }) },
      { label: '触发信号', kind: 'foundation', group: '识别', detail: `找到能说明${focus}开始发生的信号。`, example, mistake, visual: visual('definition', '识别关系的启动信号') },
      { label: '规则腔室', kind: 'principle', group: '作用', detail, example, mistake, visual: visual('formula', source.visual?.formula || '条件 → 规则 → 转化', { formula: source.visual?.formula || '条件 → 规则 → 转化' }) },
      { label: '状态转化', kind: 'process', group: '转化', detail: `追踪${focus}内部实际改变了哪个量、状态或连接。`, example, mistake, visual: visual('comparison', '机制前后', { before: '输入状态', after: '转化状态' }) },
      { label: '结果出口', kind: 'example', group: '输出', detail: `把转化后的状态重新连接到原问题，说明最终产生的可观察结果。`, example, mistake, visual: visual('input_output', '机制产生结果', { input: '完成转化', output: '可观察结果' }) },
      { label: '反向验证', kind: 'example', group: '验证', detail: `改变一个条件，检查${focus}是否仍然成立。`, example, mistake, visual: visual('input_output', '改变条件再观察', { input: '条件变化', output: '关系是否保持' }) },
      { label: '机制失效', kind: 'pitfall', group: '诊断', detail: mistake, example, mistake, visual: visual('warning', '输入、触发或规则缺失都会让机制失效') },
    ],
  }

  if (teachingKindFor(source) === 'foundation') return {
    mapType: 'concept_tree', layout: 'mindmap', templates: [
      { label: '一句定义', kind: 'foundation', group: '定义', detail, example, mistake, visual: visual('definition', `先用自己的话说清${focus}`) },
      { label: '关键词', kind: 'foundation', group: '术语', detail: `从${focus}中圈出必须理解的关键词，再逐个说明它们的含义。`, example, mistake, visual: visual('definition', '名称、含义、边界', { items: ['名称是什么', '它表示什么', '在哪里适用'] }) },
      { label: '适用边界', kind: 'principle', group: '边界', detail: `确认${focus}在什么条件下成立，以及什么情况下不能直接使用。`, example, mistake, visual: visual('formula', '条件成立 → 可以使用', { formula: '条件满足 → 概念适用' }) },
      { label: '相近概念', kind: 'principle', group: '辨析', detail: `把${focus}与容易混淆的说法放在一起比较，避免只凭字面判断。`, example, mistake, visual: visual('comparison', '相似说法不等于同一概念', { before: '看起来相近', after: '适用条件不同' }) },
      { label: '识别线索', kind: 'process', group: '应用', detail: `在题目或材料中遇到什么信号时，可以判断这里需要使用${focus}。`, example, mistake, visual: visual('sequence', '识别 → 对照 → 判断', { items: ['找到题目信号', '对照定义', '确认边界'] }) },
      { label: '一句复述', kind: 'example', group: '回忆', detail: `不用原句，尝试重新解释${focus}，再用一个小例子验证。`, example, mistake, visual: visual('input_output', '把理解说出来', { input: '一个具体情境', output: '自己的解释' }) },
    ],
  }

  if (teachingKindFor(source) === 'principle') return {
    mapType: 'causal_map', layout: 'flow', templates: [
      { label: '前提条件', kind: 'foundation', group: '起因', detail: `先确认${focus}得以成立的前提。`, example, mistake, visual: visual('formula', '先满足条件', { formula: '前提成立 → 才能继续推理' }) },
      { label: '判断信号', kind: 'foundation', group: '识别', detail: `找到能判断前提是否满足的具体信号。`, example, mistake, visual: visual('definition', '题目中的关键信号') },
      { label: '作用规则', kind: 'principle', group: '机制', detail, example, mistake, visual: visual('formula', source.visual?.formula || '条件 → 规则 → 结果', { formula: source.visual?.formula || '条件 → 规则 → 结果' }) },
      { label: '关系变化', kind: 'principle', group: '因果', detail: `观察应用${focus}后，哪些量、状态或结论发生变化。`, example, mistake, visual: visual('comparison', '变化前后对照', { before: '输入与条件', after: '状态与结果' }) },
      { label: '得到结论', kind: 'process', group: '结果', detail: `把变化重新连回原问题，说明结论是怎样得到的。`, example, mistake, visual: visual('sequence', '代入 → 推理 → 结论', { items: ['代入已知条件', '应用关系', '回到问题'] }) },
      { label: '反向验证', kind: 'example', group: '验证', detail: `换一个小输入或反过来检查，验证${focus}没有被误用。`, example, mistake, visual: visual('input_output', '用反例检验', { input: '改变一个条件', output: '观察结论是否仍成立' }) },
      { label: '不能成立时', kind: 'pitfall', group: '边界', detail: mistake, example, mistake, visual: visual('warning', '缺少前提时不能直接推出结论') },
    ],
  }

  if (teachingKindFor(source) === 'process') return {
    mapType: 'process_flow', layout: 'flow', templates: [
      { label: '起点识别', kind: 'foundation', group: '准备', detail: `明确${focus}从哪个输入、状态或问题开始。`, example, mistake, visual: visual('definition', '先确定从哪里开始') },
      { label: '输入与条件', kind: 'foundation', group: '准备', detail: `列出进入这一步前已经成立的条件。`, example, mistake, visual: visual('input_output', '带着条件进入', { input: '当前输入与状态', output: '可执行的下一步' }) },
      { label: '执行规则', kind: 'process', group: '执行', detail, example, mistake, visual: visual('sequence', '按规则向前走', { items: ['读取当前状态', '应用规则', '记录变化'] }) },
      { label: '状态变化', kind: 'process', group: '追踪', detail: `每一步只追踪一个关键变化，避免跳步。`, example, mistake, visual: visual('stack', '当前 → 执行 → 下一状态', { items: ['当前状态', '执行规则', '下一状态'] }) },
      { label: '终止或检查', kind: 'principle', group: '判断', detail: `确认什么时候应该停止、返回或进入下一轮。`, example, mistake, visual: visual('comparison', '继续还是停止', { before: '条件未满足', after: '条件已满足' }) },
      { label: '输出结果', kind: 'example', group: '结果', detail: `把过程产出的结果放回原问题检验。`, example, mistake, visual: visual('input_output', '过程完成后', { input: '最终状态', output: '题目所求结果' }) },
      { label: '复核动作', kind: 'pitfall', group: '校验', detail: mistake, example, mistake, visual: visual('warning', '检查是否遗漏中间一步') },
    ],
  }

  if (teachingKindFor(source) === 'example') return {
    mapType: 'lab_map', layout: 'mindmap', templates: [
      { label: '具体输入', kind: 'foundation', group: '输入', detail: `选一个足够小的情境来观察${focus}。`, example, mistake, visual: visual('input_output', '先给出可验证输入', { input: source.visual?.input || '一个具体输入', output: '等待观察' }) },
      { label: '已知信息', kind: 'foundation', group: '条件', detail: `写下例子里已经给出的条件，不补充题目没有提供的事实。`, example, mistake, visual: visual('definition', '例子里已经知道什么') },
      { label: '套用规则', kind: 'principle', group: '规则', detail, example, mistake, visual: visual('formula', '条件 → 规则', { formula: source.visual?.formula || '给定条件 → 使用规则' }) },
      { label: '中间变化', kind: 'process', group: '观察', detail: `逐步记录${focus}作用时产生的变化。`, example, mistake, visual: visual('sequence', '每一步只记录一个变化', { items: ['初始状态', '应用规则', '中间状态'] }) },
      { label: '观察输出', kind: 'example', group: '输出', detail: example, example, mistake, visual: visual('input_output', '输入如何变成结果', { input: source.visual?.input || '具体输入', output: source.visual?.output || example }) },
      { label: '变式验证', kind: 'principle', group: '迁移', detail: `只改变一个条件，再观察${focus}是否仍然适用。`, example, mistake, visual: visual('comparison', '原例与变式', { before: '原来的条件', after: '改变一个条件' }) },
      { label: '可迁移结论', kind: 'pitfall', group: '复盘', detail: `总结这个例子能证明什么，不能证明什么。`, example, mistake, visual: visual('warning', '不要把一个例子当成全部情况') },
    ],
  }

  return {
    mapType: 'decision_map', layout: 'mindmap', templates: [
      { label: '错误起点', kind: 'pitfall', group: '风险', detail: mistake, example, mistake, visual: visual('warning', '错误通常从哪里开始') },
      { label: '漏掉的条件', kind: 'foundation', group: '遗漏', detail: `找出使用${focus}时最容易被忽略的条件或定义。`, example, mistake, visual: visual('definition', '先补上缺失的信息') },
      { label: '错误判断', kind: 'pitfall', group: '分岔', detail: `看清把条件遗漏后会作出的错误判断。`, example, mistake, visual: visual('comparison', '错误路径', { before: '跳过关键条件', after: '得到不可靠结论' }) },
      { label: '错误后果', kind: 'pitfall', group: '后果', detail: `说明这个误判会怎样影响后续推理或结果。`, example, mistake, visual: visual('warning', '错误会在后续被放大') },
      { label: '检查信号', kind: 'process', group: '发现', detail: `给自己一个能及时发现错误的检查信号。`, example, mistake, visual: visual('sequence', '暂停 → 核对 → 定位', { items: ['暂停结论', '核对前提', '定位遗漏'] }) },
      { label: '正确动作', kind: 'process', group: '纠正', detail: `回到正确步骤后，重新应用${focus}。`, example, mistake, visual: visual('sequence', '回退 → 补全 → 验证', { items: ['回到前一步', '补全条件', '重新验证'] }) },
      { label: '复核结果', kind: 'example', group: '确认', detail: `用${example}重新确认这次结论可靠。`, example, mistake, visual: visual('input_output', '修正后再检查', { input: '完整条件', output: '可靠结果' }) },
    ],
  }
}

function buildDeepDive(source: KnowledgeMapNode, data: KnowledgeMapData): KnowledgeMapDeepDive {
  const { mapType, layout, templates } = deepDiveTemplates(source, data)
  const prefix = `deep-${source.id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || 'node'}`
  const rootId = `${prefix}-root`
  const causalParentIndex = [-1, 0, 1, 2, 3, 4, 0]
  const nodes: KnowledgeMapNode[] = [
    { id: rootId, label: source.label, role: 'core', kind: 'core', group: '深读主题', order: 1, detail: source.detail || `${source.label}的内部关系。`, example: source.example, mistake: source.mistake, visual: { kind: 'definition', headline: `从${source.label}开始展开` } },
    ...templates.slice(0, 8).map((template, index) => {
      const isConceptLeaf = mapType === 'concept_tree' && index % 2 === 1
      const parentId = mapType === 'concept_tree' && isConceptLeaf
        ? `${prefix}-${index}`
        : mapType === 'causal_map' && causalParentIndex[index] >= 0
          ? `${prefix}-${causalParentIndex[index] + 1}`
          : rootId
      return {
        ...template,
        id: `${prefix}-${index + 1}`,
        parent_id: parentId,
        semantic_role: knowledgeMapSemanticRoles[mapType][index],
        role: isConceptLeaf ? 'detail' as const : 'branch' as const,
        order: index + 2,
      }
    }),
  ]
  const children = nodes.slice(1)
  const edges = mapType === 'concept_tree'
    ? children.map((node, index) => ({
      from: node.parent_id || rootId,
      to: node.id,
      label: ['解释', '拆解', '限定', '辨析', '应用', '自检'][index] || '延伸',
    }))
    : mapType === 'causal_map'
      ? children.map((node, index) => ({ from: node.parent_id || rootId, to: node.id, label: ['先满足', '识别', '触发', '导致', '推出', '反向检查', '缺少条件'][index] || '关联' }))
      : mapType === 'relationship_map'
        ? children.map((node, index) => ({ from: rootId, to: node.id, label: ['主体', '对象', '方向', '条件', '联动', '例外', '证据'][index] || '关系' }))
      : children.map((node, index) => ({ from: index === 0 ? rootId : children[index - 1].id, to: node.id, label: index === 0 ? '展开' : ['导致', '判断', '应用', '变化', '验证', '纠正', '复核'][Math.min(index - 1, 6)] }))
  if (!['concept_tree', 'causal_map', 'relationship_map'].includes(mapType) && children.length > 2) edges.push({ from: rootId, to: children[Math.floor(children.length / 2)].id, label: '关联' })
  return {
    source_node_id: source.id,
    title: `${source.label} 深读图`,
    summary: `围绕“${source.label}”展开的${children.length}个关键关系。`,
    generated_at: new Date().toISOString(),
    generation_source: 'local',
    content_version: mapType === 'comparison_map' ? 4 : 2,
    schema_version: 11,
    layout,
    map_type: mapType,
    groups: Array.from(new Set(children.map(node => node.group).filter(Boolean))) as string[],
    nodes,
    edges,
    learning_path: nodes.map(node => node.id),
  }
}

function inferredMapType(data: KnowledgeMapData): KnowledgeMapType {
  const labels = data.nodes.map(node => node.label).join(' ')
  if (/(关系主体|关联对象)/.test(labels) && /(关系方向|共同变化|验证证据)/.test(labels)) return 'relationship_map'
  if (/(规则腔室|作用规则|作用机制)/.test(labels) && /(触发信号|判断信号)/.test(labels) && /(机制失效|不能成立时|反向验证)/.test(labels)) return 'causal_map'
  if (/(起点识别|输入与条件)/.test(labels) && /(执行规则|状态变化)/.test(labels) && /(输出结果|复核动作)/.test(labels)) return 'process_flow'
  return data.map_type || 'concept_tree'
}

export function EditableKnowledgeMap({
  data, reader = false, workspace = false, language = 'zh-CN', progress, progressLoading = false, progressSavingNodeId,
  onStatusChange, onReviewPractice, reviewPracticeGenerating = false, onMapChange, mapSaving = false,
  collaboration, collaborationLoading = false, onCollaboration, onDismissSuggestion, onGenerateDeepDive,
  exploration, explorationKey, onExplorationChange, deepDiveDepth = 0,
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
  onGenerateDeepDive?: (nodeId: string, force?: boolean) => Promise<KnowledgeMapDeepDive>
  exploration?: KnowledgeMapExplorationState
  explorationKey?: string
  onExplorationChange?: (state: KnowledgeMapExplorationState) => void
  deepDiveDepth?: number
}) {
  const initialCore = data.nodes.find(node => node.role === 'core') || data.nodes[0]
  const [working, setWorking] = useState(data)
  const workingRef = useRef(data)
  const [mode, setMode] = useState<CanvasMode>('read')
  const [studyMode, setStudyMode] = useState<MapStudyMode>('overview')
  const [processIndex, setProcessIndex] = useState(0)
  const [revealedRecallIds, setRevealedRecallIds] = useState<Set<string>>(() => new Set())
  const [tool, setTool] = useState<EditorTool>('move')
  const [selectedId, setSelectedId] = useState(data.learning_path[0] || initialCore.id)
  const [mapFocusId, setMapFocusId] = useState<string | null>(null)
  const [activeDeepDiveId, setActiveDeepDiveId] = useState<string | null>(null)
  const exploredNodeIdsRef = useRef<Set<string>>(new Set(exploration?.explored_node_ids || []))
  const restoredExplorationKeyRef = useRef<string | null>(null)
  const [deepDiveGeneratingIds, setDeepDiveGeneratingIds] = useState<Set<string>>(() => new Set())
  const [deepDiveErrors, setDeepDiveErrors] = useState<Record<string, string>>({})
  const deepDiveRequests = useRef<Set<string>>(new Set())
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
  const isDeepDiveView = deepDiveDepth > 0

  useEffect(() => {
    if (isDeepDiveView || !exploration || !explorationKey || restoredExplorationKeyRef.current === explorationKey) return
    const validIds = new Set(data.nodes.filter(node => node.role !== 'core').map(node => node.id))
    exploredNodeIdsRef.current = new Set(exploration.explored_node_ids.filter(nodeId => validIds.has(nodeId)))
    const activeId = exploration.active_node_id
    if (activeId && validIds.has(activeId) && !data.deep_maps?.[activeId]) return
    restoredExplorationKeyRef.current = explorationKey
    if (activeId && validIds.has(activeId) && data.deep_maps?.[activeId]) {
      setSelectedId(activeId)
      setActiveDeepDiveId(activeId)
      setFocusOpen(false)
      setStudyMode('overview')
    }
  }, [data.deep_maps, data.nodes, exploration, explorationKey, isDeepDiveView])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const frame = window.requestAnimationFrame(() => {
      surface.scrollLeft = Math.max(0, (surface.scrollWidth - surface.clientWidth) / 2)
      surface.scrollTop = 0
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const copy = zh ? {
    progress: '学习进度', mastered: '已理解', review: '薄弱点', edit: '编辑图解', finishEdit: '完成编辑', practice: '练习薄弱点', practicing: '生成中…',
    move: '移动', connect: '连线', autoLayout: '自动整理', addNode: '添加节点', undo: '撤销', redo: '重做', delete: '删除', deleteConfirm: '确认删除',
    relation: '关系', related: '关联', prerequisite: '前置', causal: '因果', confusable: '易混淆', save: '保存中…', saved: '已同步',
    detail: '展开说明', example: '例子', mistake: '易错点', understood: '已理解', toReview: '标记薄弱', close: '收起', collaboration: '智能整理', collaborationLoading: '正在检查结构…', apply: '采纳', dismiss: '忽略',
    path: '学习路线', editorHint: '拖动节点调整位置；选择连线后，从一个节点拖到另一个节点。', limit: '最多保留 24 个节点。', nodeContent: '节点内容', nodeLabel: '名称', nodeDetail: '说明', applyNode: '应用修改',
    overview: '总览', process: '推演', recall: '回忆', reviewMode: '复盘', processTitle: '过程演算', processHint: '顺着关系一步步走，观察每一步的作用与变化。', step: '第', of: '步 /', previous: '上一步', next: '下一步', reset: '从头开始', recallTitle: '遮盖回忆', recallHint: '先在脑中说出这个节点，再点击揭示。', reveal: '点击揭示', recalled: '想起来了', linked: '关联节点', reviewTitle: '薄弱点复盘', reviewHint: '把需要再看的内容集中在同一张图里，再去做专项练习。', noWeakPoints: '还没有标记薄弱点。', focus: '节点深读',
    backToOverview: '返回总览', backToParent: '返回上一级', exploreBranch: '进入分支', focusedOn: '正在展开',
  } : {
    progress: 'Progress', mastered: 'Understood', review: 'Weak points', edit: 'Edit map', finishEdit: 'Done editing', practice: 'Practice weak points', practicing: 'Generating…',
    move: 'Move', connect: 'Connect', autoLayout: 'Auto-arrange', addNode: 'Add node', undo: 'Undo', redo: 'Redo', delete: 'Delete', deleteConfirm: 'Confirm delete',
    relation: 'Relation', related: 'Related', prerequisite: 'Prerequisite', causal: 'Cause & effect', confusable: 'Easy to confuse', save: 'Saving…', saved: 'Synced',
    detail: 'Full explanation', example: 'Example', mistake: 'Pitfall', understood: 'Understood', toReview: 'Needs work', close: 'Close', collaboration: 'Smart refine', collaborationLoading: 'Checking structure…', apply: 'Apply', dismiss: 'Dismiss',
    path: 'Learning path', editorHint: 'Drag nodes to reposition. In connect mode, drag from one node to another.', limit: 'This map already has 24 nodes.', nodeContent: 'Node content', nodeLabel: 'Title', nodeDetail: 'Explanation', applyNode: 'Apply changes',
    overview: 'Overview', process: 'Walk through', recall: 'Recall', reviewMode: 'Review', processTitle: 'Step through the process', processHint: 'Follow the relationships and inspect what changes at every step.', step: 'Step', of: 'of', previous: 'Previous', next: 'Next', reset: 'Restart', recallTitle: 'Recall from memory', recallHint: 'Name the idea in your head, then reveal it.', reveal: 'Reveal', recalled: 'I recalled it', linked: 'Connected ideas', reviewTitle: 'Review weak points', reviewHint: 'Keep the ideas that need another pass on one map, then start targeted practice.', noWeakPoints: 'No weak points are marked yet.', focus: 'Study this node',
    backToOverview: 'Back to overview', backToParent: 'Back one level', exploreBranch: 'Explore branch', focusedOn: 'Exploring',
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

    // Opening a node creates its deep-dive locally and asks the parent to
    // persist it.  The parent can briefly re-render with the previous map
    // while that save is still in flight.  Do not let that older prop erase
    // the new map before React has had a chance to display it.
    const localDeepMaps = workingRef.current.deep_maps || {}
    const incomingDeepMaps = data.deep_maps || {}
    const hasDeepDiveWaitingForParent = Object.entries(localDeepMaps)
      .some(([nodeId, localMap]) => {
        const incomingMap = incomingDeepMaps[nodeId]
        if (!incomingMap) return true
        return Boolean(localMap.generated_at && localMap.generated_at !== incomingMap.generated_at)
      })
    if (hasDeepDiveWaitingForParent) return

    setWorking(data)
    workingRef.current = data
    setUndoStack([])
    setRedoStack([])
    setSelectedId(current => data.nodes.some(node => node.id === current) ? current : (data.learning_path[0] || data.nodes[0]?.id || ''))
    setMapFocusId(current => current && data.nodes.some(node => node.id === current) ? current : null)
    setActiveDeepDiveId(current => current && data.deep_maps?.[current] ? current : null)
  }, [data, mode])

  const positioned = withPositions(working)
  const effectiveMapType = inferredMapType(positioned)
  const core = positioned.nodes.find(node => node.role === 'core') || positioned.nodes[0]
  const mapFocusNode = mapFocusId ? positioned.nodes.find(node => node.id === mapFocusId) || null : null
  const displayData = mapFocusNode ? focusedMap(positioned, mapFocusNode.id) : positioned
  const displayCore = displayData.nodes.find(node => node.id === mapFocusNode?.id) || displayData.nodes.find(node => node.role === 'core') || displayData.nodes[0]
  const displayCorePointX = displayCore ? pointFor(displayData, displayCore).x : null
  const branches = orderedNodes(positioned)
  const selectedNode = positioned.nodes.find(node => node.id === selectedId) || core
  const selectedIndex = selectedNode.id === core.id ? 0 : Math.max(0, branches.findIndex(node => node.id === selectedNode.id))
  const progressState = progress?.progress || {}
  const summary = progress?.summary?.total === positioned.nodes.length ? progress.summary : summaryFor(positioned, progressState)
  const relationLabel = copy[relationType]
  const processNodes = positioned.nodes
    .filter(node => node.id !== core.id && (teachingKindFor(node, node.id === core.id ? 0 : Math.max(0, branches.findIndex(item => item.id === node.id))) === 'process' || ['sequence', 'stack', 'input_output'].includes(visualKindFor(node, node.id === core.id ? 0 : Math.max(0, branches.findIndex(item => item.id === node.id))))))
    .sort((a, b) => (a.order || 99) - (b.order || 99))
  const reviewNodes = positioned.nodes.filter(node => nodeStatus(progressState, node.id) === 'review')
  const currentProcessNode = processNodes[Math.min(processIndex, Math.max(0, processNodes.length - 1))]
  const studyTabs: Array<{ id: MapStudyMode; label: string; icon: typeof BookOpen; available: boolean }> = [
    { id: 'overview', label: copy.overview, icon: BookOpen, available: true },
    { id: 'process', label: copy.process, icon: Play, available: processNodes.length >= 2 },
    { id: 'recall', label: copy.recall, icon: EyeOff, available: positioned.nodes.length >= 2 },
    { id: 'review', label: copy.reviewMode, icon: Target, available: reviewNodes.length > 0 },
  ]
  const activeStudyNodeIds = new Set<string>([
    ...(studyMode === 'process' && currentProcessNode ? [currentProcessNode.id] : []),
    ...(studyMode === 'review' ? reviewNodes.map(node => node.id) : []),
  ])
  const visibleEdges = displayData.edges
  const activeEdge = selectedEdge && positioned.edges.find(edge => edge.from === selectedEdge.from && edge.to === selectedEdge.to)
  const activeEdgeFrom = activeEdge && positioned.nodes.find(node => node.id === activeEdge.from)
  const activeEdgeTo = activeEdge && positioned.nodes.find(node => node.id === activeEdge.to)
  const selectedNodeDraft = JSON.stringify({ id: selectedNode.id, label: selectedNode.label, detail: selectedNode.detail, visual: selectedNode.visual || {} })
  const selectedConnections = connectedNodes(positioned, selectedNode.id).slice(0, 5)

  useEffect(() => {
    // Small screens deliberately retain the wide desk so knowledge atoms do
    // not collapse into an unreadable pile.  Whenever a learner enters a
    // branch, center that branch instead of leaving them at a blank edge of
    // the pannable surface.
    const surface = surfaceRef.current
    if (!surface || displayCorePointX == null || surface.scrollWidth <= surface.clientWidth) return
    const target = displayCorePointX / canvasSize.width * surface.scrollWidth - surface.clientWidth / 2
    const frame = window.requestAnimationFrame(() => { surface.scrollLeft = Math.max(0, target) })
    return () => window.cancelAnimationFrame(frame)
  }, [displayCorePointX, mapFocusId, mode])

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

  useEffect(() => {
    if (studyMode === 'process' && processIndex >= processNodes.length) setProcessIndex(0)
  }, [processIndex, processNodes.length, studyMode])

  useEffect(() => {
    if ((studyMode === 'process' && processNodes.length < 2) || (studyMode === 'review' && reviewNodes.length === 0)) setStudyMode('overview')
  }, [processNodes.length, reviewNodes.length, studyMode])

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
  function chooseStudyMode(next: MapStudyMode) {
    setStudyMode(next)
    setFocusOpen(false)
    if (next === 'process' && processNodes.length) {
      setProcessIndex(0)
      setSelectedId(processNodes[0].id)
    }
    if (next === 'recall') setRevealedRecallIds(new Set())
  }
  function advanceProcess(direction: -1 | 1) {
    if (!processNodes.length) return
    const nextIndex = Math.max(0, Math.min(processNodes.length - 1, processIndex + direction))
    setProcessIndex(nextIndex)
    setSelectedId(processNodes[nextIndex].id)
    setFocusOpen(false)
  }
  function revealRecallNode(nodeId: string) {
    setSelectedId(nodeId)
    setRevealedRecallIds(current => new Set([...current, nodeId]))
  }
  function returnFromFocusedMap() {
    if (!mapFocusNode) return
    const parentId = parentFor(positioned, mapFocusNode, core)
    const nextFocusId = parentId && parentId !== core.id ? parentId : null
    setMapFocusId(nextFocusId)
    setSelectedId(nextFocusId || core.id)
    setFocusOpen(false)
    setStudyMode('overview')
  }
  function requestDeepDive(nodeId: string, force = false) {
    if (!onGenerateDeepDive || deepDiveRequests.current.has(nodeId)) return
    deepDiveRequests.current.add(nodeId)
    setDeepDiveGeneratingIds(current => new Set([...current, nodeId]))
    setDeepDiveErrors(current => {
      const next = { ...current }
      delete next[nodeId]
      return next
    })
    void onGenerateDeepDive(nodeId, force)
      .then(deepDive => {
        const sourceNode = workingRef.current.nodes.find(node => node.id === nodeId)
        if (!sourceNode) return
        const expectedMapType = deepDiveTemplates(sourceNode, workingRef.current).mapType
        const requiredContentVersion = expectedMapType === 'comparison_map' ? 4 : 2
        if (
          deepDive.map_type !== expectedMapType
          || !hasCompleteSemanticRoles(deepDive, expectedMapType)
          || (deepDive.content_version || 0) < requiredContentVersion
        ) {
          // An older running backend may not know a newly introduced map
          // grammar yet. Keep the complete local version without surfacing a
          // false failure or replacing it with an unrelated generated map.
          persist(workingRef.current)
          return
        }
        const next = {
          ...workingRef.current,
          deep_maps: { ...(workingRef.current.deep_maps || {}), [nodeId]: deepDive },
        }
        changeWorking(next)
        persist(next)
      })
      .catch(error => {
        const message = error instanceof Error ? error.message : (zh ? '智能内容生成失败' : 'Smart generation failed')
        setDeepDiveErrors(current => ({ ...current, [nodeId]: message }))
        const currentMap = workingRef.current.deep_maps?.[nodeId]
        if (currentMap?.generation_source === 'local') persist(workingRef.current)
      })
      .finally(() => {
        deepDiveRequests.current.delete(nodeId)
        setDeepDiveGeneratingIds(current => {
          const next = new Set(current)
          next.delete(nodeId)
          return next
        })
      })
  }
  function exploreNode(nodeId: string) {
    const node = positioned.nodes.find(item => item.id === nodeId)
    if (!node) return
    if (isDeepDiveView) {
      setSelectedId(nodeId)
      setSelectedEdge(null)
      setFocusOpen(true)
      setStudyMode('overview')
      return
    }
    let existing = workingRef.current.deep_maps?.[nodeId]
    const expectedMapType = deepDiveTemplates(node, positioned).mapType
    const requiredContentVersion = expectedMapType === 'comparison_map' ? 4 : 2
    const needsContentRefresh = Boolean(
      existing
      && (existing.content_version || 0) < requiredContentVersion,
    )
    if (!existing || existing.map_type !== expectedMapType || needsContentRefresh) {
      existing = buildDeepDive(node, positioned)
      const next = {
        ...workingRef.current,
        deep_maps: { ...(workingRef.current.deep_maps || {}), [nodeId]: existing },
      }
      changeWorking(next)
      if (!onGenerateDeepDive) persist(next)
    }
    setSelectedId(nodeId)
    setSelectedEdge(null)
    setFocusOpen(false)
    setStudyMode('overview')
    setActiveDeepDiveId(nodeId)
    if (node.role !== 'core') {
      exploredNodeIdsRef.current.add(nodeId)
      onExplorationChange?.({
        active_node_id: nodeId,
        explored_node_ids: [...exploredNodeIdsRef.current],
      })
    }
    const needsSemanticUpgrade = !hasCompleteSemanticRoles(existing, expectedMapType)
    if (onGenerateDeepDive && (!['agent', 'fallback'].includes(existing.generation_source || '') || needsSemanticUpgrade || needsContentRefresh)) {
      requestDeepDive(nodeId, needsSemanticUpgrade || needsContentRefresh)
    }
  }
  function selectNode(nodeId: string) {
    if (mode === 'read') {
      if (studyMode === 'recall' && !revealedRecallIds.has(nodeId)) {
        revealRecallNode(nodeId)
        return
      }
      exploreNode(nodeId)
      return
    }
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
  function autoArrange() { setMapFocusId(null); commit(withPositions(positioned, true)) }
  function addNode() {
    if (positioned.nodes.length >= 24) return
    const id = `user-${Date.now().toString(36)}`
    const node: KnowledgeMapNode = { id, parent_id: selectedNode.id, label: zh ? '新知识点' : 'New concept', role: 'detail', kind: 'foundation', group: zh ? '补充' : 'Extra', order: positioned.nodes.length + 1, detail: zh ? '补充这个知识点的说明。' : 'Add a concise explanation for this concept.', visual: { kind: 'definition', headline: zh ? '说明它和主题的关系' : 'Explain how it relates to the topic' } }
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
    const replacementCore = selectedNode.id === core.id ? nodes[0] : core
    const reparentId = selectedNode.id === core.id ? replacementCore.id : parentFor(positioned, selectedNode, core) || core.id
    nodes = nodes.map((node, index) => ({
      ...node,
      role: selectedNode.id === core.id ? (node.id === replacementCore.id ? 'core' : node.role === 'core' ? 'branch' : node.role) : node.role,
      parent_id: node.parent_id === selectedNode.id ? reparentId : node.parent_id,
      order: node.order || index + 1,
    }))
    commit({ ...positioned, nodes, edges: positioned.edges.filter(edge => edge.from !== selectedNode.id && edge.to !== selectedNode.id), learning_path: positioned.learning_path.filter(id => id !== selectedNode.id) })
    setSelectedId(reparentId); setMapFocusId(current => current === selectedNode.id ? null : current); setSelectedEdge(null); setDeleteArmed(false)
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
    else if (suggestion.kind === 'new_node' && positioned.nodes.length < 24) {
      const id = `agent-${Date.now().toString(36)}`
      const node: KnowledgeMapNode = { id, parent_id: suggestion.from, label: suggestion.label, role: suggestion.role, kind: 'foundation', group: zh ? '补充' : 'Extra', detail: suggestion.detail, visual: { kind: 'definition', headline: suggestion.detail } }
      commit(withPositions({ ...positioned, nodes: [...positioned.nodes, node], edges: [...positioned.edges, { from: suggestion.from, to: id, label: suggestion.label_edge }], learning_path: [...positioned.learning_path, id] }, true)); setSelectedId(id)
    }
    onDismissSuggestion?.(suggestion)
  }
  function nodeStyle(node: KnowledgeMapNode) {
    const point = pointFor(displayData, node)
    return { '--node-x': `${point.x / canvasSize.width * 100}%`, '--node-y': `${point.y / canvasSize.height * 100}%` } as CSSProperties
  }
  function nodeIndex(node: KnowledgeMapNode) { return node.id === core.id ? 0 : Math.max(0, branches.findIndex(item => item.id === node.id)) }

  const isAtomicOverview = !mapFocusNode && positioned.nodes.length <= 10 && directChildren(positioned, core.id).length >= 6
  const activeDeepDive = !isDeepDiveView && activeDeepDiveId ? working.deep_maps?.[activeDeepDiveId] : undefined
  const activeDeepDiveType = activeDeepDive ? inferredMapType(activeDeepDive) : undefined
  const activeDeepDiveGenerating = Boolean(activeDeepDiveId && deepDiveGeneratingIds.has(activeDeepDiveId))
  const activeDeepDiveError = activeDeepDiveId ? deepDiveErrors[activeDeepDiveId] : undefined
  const deepMapLabels: Record<KnowledgeMapType, string> = zh ? {
    concept_tree: '概念定义树', causal_map: '成立机制图', relationship_map: '关键关系图', process_flow: '推理路径图', lab_map: '案例实验图', decision_map: '错误分岔图', system_map: '系统全景图', comparison_map: '对照关系图', timeline_map: '时间脉络图',
  } : {
    concept_tree: 'Concept constellation', causal_map: 'Mechanism map', relationship_map: 'Relationship map', process_flow: 'Reasoning route', lab_map: 'Example lab', decision_map: 'Decision fork', system_map: 'System view', comparison_map: 'Comparison map', timeline_map: 'Timeline',
  }
  function saveDeepDiveMap(nextMap: KnowledgeMapData) {
    if (!activeDeepDiveId) return
    const current = workingRef.current.deep_maps?.[activeDeepDiveId]
    if (!current) return
    commit({
      ...workingRef.current,
      deep_maps: {
        ...(workingRef.current.deep_maps || {}),
        [activeDeepDiveId]: { ...current, ...nextMap, source_node_id: current.source_node_id, title: current.title, summary: current.summary },
      },
    })
  }

  const focusSheet = mode === 'read' && focusOpen ? <section className="map-focus-sheet" aria-live="polite">
    <button className="map-focus-close" type="button" onClick={() => setFocusOpen(false)} aria-label={copy.close}><X size={15} /></button>
    <div className="map-focus-heading"><span>{groupFor(selectedNode, selectedIndex, zh)}</span><h2><FormulaText>{selectedNode.label}</FormulaText></h2></div>
    <p><FormulaText>{selectedNode.detail}</FormulaText></p>
    <MapVisual node={selectedNode} index={selectedIndex} />
    {selectedNode.example && <small><b>{copy.example}</b><FormulaText>{selectedNode.example}</FormulaText></small>}
    {selectedNode.mistake && <small className="focus-mistake"><b>{copy.mistake}</b><FormulaText>{selectedNode.mistake}</FormulaText></small>}
    {selectedConnections.length > 0 && <div className="map-focus-links"><b>{copy.linked}</b><span>{selectedConnections.map(node => <button type="button" key={node.id} onClick={() => { if (studyMode === 'recall') { revealRecallNode(node.id); setFocusOpen(false) } else exploreNode(node.id) }}><FormulaText>{node.label}</FormulaText></button>)}</span></div>}
    {onStatusChange && <div className="map-focus-actions"><button type="button" className={nodeStatus(progressState, selectedNode.id) === 'review' ? 'review active' : ''} disabled={progressSavingNodeId === selectedNode.id} onClick={() => onStatusChange(selectedNode.id, 'review')}>{copy.toReview}</button><button type="button" className={nodeStatus(progressState, selectedNode.id) === 'mastered' ? 'mastered active' : ''} disabled={progressSavingNodeId === selectedNode.id} onClick={() => onStatusChange(selectedNode.id, 'mastered')}><Check size={13} />{studyMode === 'recall' ? copy.recalled : copy.understood}</button></div>}
  </section> : null

  if (activeDeepDive) return <section className={`knowledge-map-deep-dive deep-dive-${activeDeepDiveType || 'concept_tree'}`} aria-label={zh ? `${activeDeepDive.title} 深读图` : `${activeDeepDive.title} deep map`}>
    <header className="map-deep-dive-head">
      <button type="button" onClick={() => {
        setActiveDeepDiveId(null)
        setSelectedId(activeDeepDive.source_node_id)
        setStudyMode('overview')
        onExplorationChange?.({ active_node_id: '', explored_node_ids: [...exploredNodeIdsRef.current] })
      }}><ArrowLeft size={16} />{zh ? '返回主题总览' : 'Back to overview'}</button>
      <div><span>{deepMapLabels[activeDeepDiveType || 'concept_tree']}</span><h2>{activeDeepDive.title}</h2><p>{activeDeepDive.summary}</p></div>
      <small>{zh ? '主题总览 / 专题深读' : 'Overview / Deep study'}</small>
    </header>
    {(activeDeepDiveGenerating || activeDeepDiveError || activeDeepDive.generation_source === 'fallback') && <div className={`map-deep-dive-generation ${activeDeepDiveError ? 'is-error' : activeDeepDive.generation_source === 'fallback' ? 'is-fallback' : 'is-running'}`} role="status" aria-live="polite">
      <span>{activeDeepDiveGenerating ? <Sparkles size={15} /> : <AlertTriangle size={15} />}</span>
      <p>
        <b>{activeDeepDiveGenerating ? (zh ? '正在后台完善这张专题图' : 'Refining this deep map in the background') : activeDeepDiveError ? (zh ? '智能内容暂时没有生成完成' : 'Smart content did not finish') : (zh ? '当前显示可直接学习的基础版本' : 'Showing the ready-to-study base version')}</b>
        <small>{activeDeepDiveGenerating ? (zh ? '你可以继续浏览或返回总览，完成后会自动替换为专属内容。' : 'Keep browsing or return to the overview. It will update automatically.') : activeDeepDiveError || (zh ? '模型暂时不可用时仍可继续学习，也可以重新尝试生成专属内容。' : 'You can keep learning or retry the tailored version.')}</small>
      </p>
      {!activeDeepDiveGenerating && activeDeepDiveId && onGenerateDeepDive && <button type="button" onClick={() => requestDeepDive(activeDeepDiveId, true)}><RotateCcw size={13} />{zh ? '重新生成' : 'Retry'}</button>}
    </div>}
    <EditableKnowledgeMap
      data={activeDeepDive}
      reader={reader}
      language={language}
      progress={progress}
      progressLoading={progressLoading}
      progressSavingNodeId={progressSavingNodeId}
      onStatusChange={onStatusChange}
      onMapChange={saveDeepDiveMap}
      mapSaving={mapSaving}
      deepDiveDepth={deepDiveDepth + 1}
    />
  </section>

  if (isDeepDiveView && effectiveMapType === 'comparison_map' && mode === 'read' && !mapFocusNode) return <section className="knowledge-map-specialized-shell">
    <BoundarySpectrumMap
      data={positioned}
      language={language}
      onNodeSelect={(nodeId) => {
        setSelectedId(nodeId)
        setSelectedEdge(null)
        setStudyMode('overview')
      }}
      onEdit={onMapChange ? () => setMode('edit') : undefined}
    />
  </section>

  if (isDeepDiveView && effectiveMapType === 'system_map' && mode === 'read' && !mapFocusNode) return <section className="knowledge-map-specialized-shell">
    <TermFieldMap
      data={positioned}
      language={language}
      onNodeSelect={exploreNode}
      onEdit={onMapChange ? () => setMode('edit') : undefined}
    />
    {focusSheet}
  </section>

  if (effectiveMapType === 'relationship_map' && mode === 'read' && !mapFocusNode) return <section className="knowledge-map-specialized-shell">
    <RelationshipNetworkMap
      data={positioned}
      language={language}
      onNodeSelect={exploreNode}
      onEdit={onMapChange ? () => setMode('edit') : undefined}
      inspectOnly={isDeepDiveView}
    />
    {focusSheet}
  </section>

  if (effectiveMapType === 'causal_map' && mode === 'read' && !mapFocusNode) return <section className="knowledge-map-specialized-shell">
    <CausalMechanismLab
      data={positioned}
      language={language}
      onNodeSelect={exploreNode}
      onEdit={onMapChange ? () => setMode('edit') : undefined}
      inspectOnly={isDeepDiveView}
    />
    {focusSheet}
  </section>

  if (effectiveMapType === 'process_flow' && mode === 'read' && !mapFocusNode) return <section className="knowledge-map-specialized-shell">
    <ProcessRouteMap
      data={positioned}
      language={language}
      onNodeSelect={exploreNode}
      onEdit={onMapChange ? () => setMode('edit') : undefined}
      inspectOnly={isDeepDiveView}
    />
    {focusSheet}
  </section>

  if (effectiveMapType === 'lab_map' && mode === 'read' && !mapFocusNode) return <section className="knowledge-map-specialized-shell">
    <ApplicationValidationLab
      data={positioned}
      language={language}
      onNodeSelect={exploreNode}
      onEdit={onMapChange ? () => setMode('edit') : undefined}
      inspectOnly={isDeepDiveView}
    />
    {focusSheet}
  </section>

  if (effectiveMapType === 'decision_map' && mode === 'read' && !mapFocusNode) return <section className="knowledge-map-specialized-shell">
    <ErrorDiagnosisMap
      data={positioned}
      language={language}
      onNodeSelect={exploreNode}
      onEdit={onMapChange ? () => setMode('edit') : undefined}
      inspectOnly={isDeepDiveView}
    />
    {focusSheet}
  </section>

  if (effectiveMapType === 'timeline_map' && mode === 'read' && !mapFocusNode) return <section className="knowledge-map-specialized-shell">
    <TimelineChronicleMap
      data={positioned}
      language={language}
      onNodeSelect={exploreNode}
      onEdit={onMapChange ? () => setMode('edit') : undefined}
      inspectOnly={isDeepDiveView}
    />
    {focusSheet}
  </section>

  return <section className={`knowledge-map knowledge-map-canvas-workspace map-type-${effectiveMapType} ${reader ? 'knowledge-map-reader' : ''} ${workspace ? 'knowledge-map-workspace' : ''} mode-${mode} ${mapFocusNode ? 'is-branch-focused' : ''} ${isAtomicOverview ? 'is-atomic-overview' : ''}`} aria-label={zh ? '互动式知识图解' : 'Interactive knowledge map'}>
    <div className="knowledge-map-overview">
      <span>{copy.progress}</span>
      {progressLoading ? <small>{zh ? '正在载入…' : 'Loading…'}</small> : <div><b>{summary.mastered}/{summary.total}</b><small>{copy.mastered}</small>{summary.review > 0 && <em>{summary.review} {copy.review}</em>}</div>}
      {mapFocusNode && <div className="map-explorer-nav" aria-label={zh ? '图谱层级导航' : 'Map hierarchy navigation'}><button type="button" onClick={returnFromFocusedMap}><ArrowLeft size={13} />{parentFor(positioned, mapFocusNode, core) === core.id ? copy.backToOverview : copy.backToParent}</button><span>{copy.focusedOn} “<FormulaText>{mapFocusNode.label}</FormulaText>”</span></div>}
      {mode === 'read' && <div className="map-study-switcher" role="tablist" aria-label={zh ? '图解学习方式' : 'Map study modes'}>
        {studyTabs.filter(tab => tab.available).map(tab => {
          const Icon = tab.icon
          return <button type="button" role="tab" key={tab.id} aria-selected={studyMode === tab.id} className={studyMode === tab.id ? 'active' : ''} onClick={() => chooseStudyMode(tab.id)}><Icon size={13} />{tab.label}</button>
        })}
      </div>}
      <div className="knowledge-map-overview-actions">
        {onReviewPractice && summary.review > 0 && <button type="button" disabled={reviewPracticeGenerating} onClick={onReviewPractice}>{reviewPracticeGenerating ? copy.practicing : copy.practice}</button>}
        {onMapChange && <button type="button" className={mode === 'edit' ? 'active' : ''} onClick={() => { if (mode === 'read') { setEditorOpen(true); setMapFocusId(null); setFocusOpen(false) } setMode(current => current === 'edit' ? 'read' : 'edit') }}><MousePointer2 size={13} />{mode === 'edit' ? copy.finishEdit : copy.edit}</button>}
      </div>
    </div>

    <div ref={surfaceRef} className="map-full-canvas" onPointerMove={canvasPointerMove} onPointerUp={canvasPointerUp} onPointerCancel={canvasPointerUp}>
      <div className="map-canvas-stage">
      <svg className="map-canvas-lines" viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`} aria-hidden={mode === 'read'}>
        <defs><marker id={arrowId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z" /></marker></defs>
        <g className="map-canvas-orbits" aria-hidden="true">
          <circle cx="750" cy="410" r="294" />
          <circle cx="750" cy="410" r="188" />
          <circle className="orbit-dash" cx="750" cy="410" r="244" />
          <path d="M 456 410 H 1044 M 750 116 V 704" />
        </g>
        {visibleEdges.map((edge, index) => {
          const fromNode = displayData.nodes.find(node => node.id === edge.from); const toNode = displayData.nodes.find(node => node.id === edge.to)
          if (!fromNode || !toNode) return null
          const from = pointFor(displayData, fromNode); const to = pointFor(displayData, toNode)
          const targetKind = teachingKindFor(toNode, nodeIndex(toNode))
          const isSelected = selectedEdge?.from === edge.from && selectedEdge?.to === edge.to
          const isStudyEdge = activeStudyNodeIds.has(edge.from) || activeStudyNodeIds.has(edge.to)
          const showLabel = mode === 'edit'
            ? (isSelected || edge.from === selectedNode.id || edge.to === selectedNode.id || edge.from === linkSource)
            : Boolean(edge.label) && (studyMode === 'overview' || isStudyEdge)
          const selectCurrentEdge = () => selectEdge(edge)
          return <g className={`map-canvas-edge to-${targetKind} ${showLabel ? 'is-labeled' : ''} ${isSelected ? 'is-selected' : ''} ${studyMode !== 'overview' && !isStudyEdge ? 'is-muted' : ''} ${isStudyEdge ? 'is-study-edge' : ''}`} key={`${edge.from}-${edge.to}-${index}`} role={mode === 'edit' ? 'button' : undefined} tabIndex={mode === 'edit' ? 0 : undefined} aria-label={mode === 'edit' ? `${editorCopy.edgeContent}: ${fromNode.label} ${edge.label || relationLabel} ${toNode.label}` : undefined} onPointerDown={event => { if (mode === 'edit') event.stopPropagation() }} onClick={selectCurrentEdge} onKeyDown={event => { if (mode === 'edit' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectCurrentEdge() } }}><path className="map-canvas-edge-hit" d={pathBetween(from, to)} /> <path d={pathBetween(from, to)} markerEnd={`url(#${arrowId})`} />{showLabel && edge.label && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8}>{edge.label}</text>}</g>
        })}
        {mode === 'edit' && linkSource && linkPreview && <path className="map-canvas-edge-preview" d={pathBetween(pointFor(positioned, positioned.nodes.find(node => node.id === linkSource) || core), linkPreview)} />}
      </svg>

      {displayData.nodes.map(node => {
        const index = nodeIndex(node); const kind = teachingKindFor(node, index); const displayKind = mapFocusNode?.id === node.id ? 'core' : kind; const status = nodeStatus(progressState, node.id); const active = selectedNode.id === node.id
        const depth = depthFor(displayData, node, displayCore?.id)
        const hiddenForRecall = mode === 'read' && studyMode === 'recall' && !revealedRecallIds.has(node.id)
        const dimmedForStudy = mode === 'read' && studyMode !== 'overview' && studyMode !== 'recall' && !activeStudyNodeIds.has(node.id)
        return <button type="button" key={node.id} data-map-node={node.id} className={`map-canvas-node kind-${displayKind} depth-${depth} node-visual-${visualKindFor(node, index)} status-${status} ${active ? 'is-active' : ''} ${mapFocusNode?.id === node.id ? 'is-focus-root' : ''} ${mode === 'edit' ? 'is-editing' : ''} ${hiddenForRecall ? 'is-recall-hidden' : ''} ${dimmedForStudy ? 'is-study-muted' : ''} ${activeStudyNodeIds.has(node.id) ? 'is-study-active' : ''}`} style={nodeStyle(node)} onClick={() => { if (suppressNodeClick.current) { suppressNodeClick.current = false; return } selectNode(node.id) }} onPointerDown={event => nodePointerDown(event, node.id)} aria-pressed={active}>
          {hiddenForRecall ? <>
            <span className="map-node-group">{copy.recallTitle}</span>
            <strong>{zh ? '这个知识点是什么？' : 'What idea belongs here?'}</strong>
            <p>{copy.recallHint}</p>
            <span className="map-recall-reveal"><EyeOff size={14} />{copy.reveal}</span>
          </> : <>
            <MapNodeGlyph kind={displayKind} />
            <span className="map-node-group">{groupFor(node, index, zh)}</span>
            <strong><FormulaText>{node.label}</FormulaText></strong>
            <p><FormulaText>{shortText(node.detail || (zh ? '点击查看说明。' : 'Click for an explanation.'), displayKind === 'core' ? 116 : depth > 1 ? 52 : 72)}</FormulaText></p>
            <MapVisual node={node} index={index} compact={mode === 'edit'} />
            {mode === 'read' && studyMode === 'overview' && <span className="map-node-enter"><GitBranchPlus size={12} />{isDeepDiveView ? (zh ? '查看说明' : 'Read details') : (zh ? '展开专题图' : 'Open deep map')}</span>}
          </>}
          {status !== 'new' && <i className="map-node-status">{status === 'mastered' ? <Check size={12} /> : <AlertTriangle size={12} />}</i>}
        </button>
      })}

      {focusSheet}

      {mode === 'read' && studyMode === 'process' && currentProcessNode && <section className="map-process-sheet" aria-live="polite">
        <button className="map-process-close" type="button" onClick={() => chooseStudyMode('overview')} aria-label={copy.close}><X size={15} /></button>
        <span>{copy.processTitle} · {processIndex + 1}/{processNodes.length}</span>
        <h2><FormulaText>{currentProcessNode.label}</FormulaText></h2>
        <small className="map-process-hint">{copy.processHint}</small>
        <p><FormulaText>{currentProcessNode.detail}</FormulaText></p>
        <MapVisual node={currentProcessNode} index={nodeIndex(currentProcessNode)} />
        <div className="map-process-actions"><button type="button" onClick={() => advanceProcess(-1)} disabled={processIndex === 0}><ArrowLeft size={13} />{copy.previous}</button><button type="button" onClick={() => setProcessIndex(0)}><RotateCcw size={13} />{copy.reset}</button><button type="button" className="primary" onClick={() => advanceProcess(1)} disabled={processIndex === processNodes.length - 1}>{copy.next}<ArrowRight size={13} /></button></div>
      </section>}

      {mode === 'read' && studyMode === 'review' && <section className="map-review-sheet" aria-live="polite">
        <button className="map-process-close" type="button" onClick={() => chooseStudyMode('overview')} aria-label={copy.close}><X size={15} /></button>
        <div><Target size={15} /><h2>{copy.reviewTitle}</h2></div>
        <p>{copy.reviewHint}</p>
        {reviewNodes.length ? <div className="map-review-nodes">{reviewNodes.map(node => <button type="button" key={node.id} onClick={() => exploreNode(node.id)}>{node.label}</button>)}</div> : <small>{copy.noWeakPoints}</small>}
        {onReviewPractice && reviewNodes.length > 0 && <button type="button" className="map-review-practice" disabled={reviewPracticeGenerating} onClick={onReviewPractice}>{reviewPracticeGenerating ? copy.practicing : copy.practice}<ArrowRight size={13} /></button>}
      </section>}

      {mode === 'edit' && <>
        <div className="map-editor-toolbar">
          <button type="button" className={tool === 'move' ? 'active' : ''} onClick={() => setTool('move')}><MousePointer2 size={13} />{copy.move}</button>
          <button type="button" className={tool === 'connect' ? 'active' : ''} onClick={() => setTool('connect')}><GitBranchPlus size={13} />{copy.connect}</button>
          <label>{copy.relation}<select value={relationType} onChange={event => setRelationType(event.target.value as typeof relationType)}><option value="related">{copy.related}</option><option value="prerequisite">{copy.prerequisite}</option><option value="causal">{copy.causal}</option><option value="confusable">{copy.confusable}</option></select></label>
          <button type="button" onClick={autoArrange}><Sparkles size={13} />{copy.autoLayout}</button>
          <button type="button" onClick={addNode} disabled={positioned.nodes.length >= 24}><CirclePlus size={14} />{copy.addNode}</button>
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
            <small>{positioned.nodes.length >= 24 ? copy.limit : tool === 'connect' ? copy.editorHint : editorCopy.edgeHint}</small>
          </>}
        </section>}
        {(collaborationLoading || collaboration?.suggestions.length) && <section className="map-collaboration-sheet"><p>{collaborationLoading ? copy.collaborationLoading : collaboration?.summary}</p>{collaboration?.suggestions.slice(0, 3).map((suggestion, index) => <article key={`${suggestion.kind}-${index}`}><span>{suggestion.reason}</span><div><button type="button" onClick={() => applySuggestion(suggestion)}>{copy.apply}</button><button type="button" onClick={() => onDismissSuggestion?.(suggestion)}>{copy.dismiss}</button></div></article>)}</section>}
      </>}
      </div>
    </div>

    <div className="map-learning-track" aria-label={copy.path}><span>{copy.path}</span>{positioned.learning_path.map((id, index) => { const node = positioned.nodes.find(item => item.id === id); return node && <button type="button" className={selectedNode.id === id ? 'active' : ''} key={id} onClick={() => { if (mode === 'read') exploreNode(id); else setSelectedId(id) }}>{index + 1}. <FormulaText>{node.label}</FormulaText></button> })}</div>
  </section>
}
