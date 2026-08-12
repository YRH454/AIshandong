import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Canvas } from '@react-three/fiber'
import { Html, Line, OrbitControls, RoundedBox } from '@react-three/drei'
import {
  ArrowLeft, Check, ChevronRight, Eye, FileText, Map as MapIcon, Maximize2,
  MousePointer2, Sparkles, X, ZoomIn,
} from 'lucide-react'
import type { KnowledgeMapData, KnowledgeMapNode, KnowledgeMapProgressState } from './EditableKnowledgeMap'
import type { KnowledgeMapNodeStatus } from '../services/api'

type RenderMode = 'three' | 'flat'
type Point3 = [number, number, number]

type Station = {
  node: KnowledgeMapNode
  position: Point3
  index: number
}

type KnowledgeMapImmersiveSpaceProps = {
  data: KnowledgeMapData
  title: string
  course: string
  topic: string
  language?: 'zh-CN' | 'en'
  progress?: KnowledgeMapProgressState
  progressSavingNodeId?: string | null
  reviewPracticeGenerating?: boolean
  onStatusChange?: (nodeId: string, status: KnowledgeMapNodeStatus) => void
  onReviewPractice?: () => void
  onOpenCanvas: () => void
  onExit: () => void
}

const stationPositions: Point3[] = [
  [0, 0, 0.4],
  [-4.2, 2.05, -1.35],
  [-1.45, 2.8, -2.3],
  [1.7, 2.15, -1.55],
  [4.15, 0.62, -0.55],
  [3.15, -2.35, -1.45],
  [0.05, -2.8, -2.1],
  [-3.15, -2.05, -1.15],
  [-4.65, -0.3, -1.9],
  [0.5, 0.05, -3.35],
]

function supportsThreeDimensionalCanvas() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function shouldPreferFlatMode() {
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number }
  const smallViewport = window.matchMedia('(max-width: 760px)').matches
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const fewCores = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4
  const lowMemory = typeof navigatorWithMemory.deviceMemory === 'number' && navigatorWithMemory.deviceMemory <= 4
  return smallViewport || reducedMotion || fewCores || lowMemory
}

function orderStations(data: KnowledgeMapData): Station[] {
  const core = data.nodes.find(node => node.role === 'core') || data.nodes[0]
  if (!core) return []
  const orderedIds = [core.id, ...data.learning_path.filter(id => id !== core.id)]
  const orderedNodes = [
    ...orderedIds.map(id => data.nodes.find(node => node.id === id)).filter((node): node is KnowledgeMapNode => Boolean(node)),
    ...data.nodes.filter(node => !orderedIds.includes(node.id)),
  ].slice(0, stationPositions.length)
  return orderedNodes.map((node, index) => ({ node, position: stationPositions[index] || [0, 0, -3.4], index }))
}

function toneFor(node: KnowledgeMapNode, index: number) {
  const kind = node.kind || (node.role === 'core' ? 'core' : index % 4 === 0 ? 'example' : index % 4 === 1 ? 'principle' : index % 4 === 2 ? 'process' : 'foundation')
  if (kind === 'core') return '#2d6a4f'
  if (kind === 'pitfall') return '#ad5a4e'
  if (kind === 'example') return '#946d2c'
  if (kind === 'process') return '#3c657b'
  if (kind === 'principle') return '#68528c'
  return '#4e7561'
}

function groupLabel(node: KnowledgeMapNode, index: number, language: 'zh-CN' | 'en') {
  if (node.group) return node.group
  const fallbackKinds: Array<'foundation' | 'principle' | 'process' | 'example' | 'pitfall'> = ['foundation', 'principle', 'process', 'example', 'pitfall']
  const kind = node.kind || (node.role === 'core' ? 'core' : fallbackKinds[Math.max(0, index - 1) % fallbackKinds.length])
  const labels = language === 'en'
    ? { core: 'Core idea', foundation: 'Foundation', principle: 'Principle', process: 'Process', example: 'Example', pitfall: 'Pitfall' }
    : { core: '核心概念', foundation: '基础', principle: '原理', process: '过程', example: '例子', pitfall: '易错点' }
  return labels[kind] || (index === 0 ? labels.core : labels.foundation)
}

function statusFor(progress: Record<string, Exclude<KnowledgeMapNodeStatus, 'new'>>, nodeId: string): KnowledgeMapNodeStatus {
  return progress[nodeId] || 'new'
}

function shortText(value: string, limit: number) {
  const text = value.trim()
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function StationNode({
  station, selected, status, language, onSelect,
}: {
  station: Station
  selected: boolean
  status: KnowledgeMapNodeStatus
  language: 'zh-CN' | 'en'
  onSelect: () => void
}) {
  const { node, index, position } = station
  const tone = toneFor(node, index)
  const statusCopy = language === 'en'
    ? { mastered: 'Understood', review: 'Review', new: 'New' }
    : { mastered: '已理解', review: '待复习', new: '未学习' }
  const depth = Math.max(0, Math.min(1, (position[2] + 3.5) / 4))
  const scale = selected ? 1.075 : 1
  return (
    <group position={position} scale={scale} onClick={event => { event.stopPropagation(); onSelect() }}>
      <mesh position={[0, -0.87, -0.04]} receiveShadow>
        <cylinderGeometry args={[1.72, 1.9, 0.1, 48]} />
        <meshStandardMaterial color="#dde6df" roughness={0.94} />
      </mesh>
      <mesh position={[0, -0.79, 0]}>
        <cylinderGeometry args={[1.47, 1.56, 0.08, 48]} />
        <meshStandardMaterial color={tone} roughness={0.68} transparent opacity={selected ? 0.78 : 0.4} />
      </mesh>
      <RoundedBox args={[2.86, 1.46, 0.22]} radius={0.14} smoothness={4} position={[0, 0, 0.11]} castShadow receiveShadow>
        <meshStandardMaterial color="#ffffff" roughness={0.74} metalness={0.03} />
      </RoundedBox>
      <mesh position={[0, 0, 0.235]}>
        <planeGeometry args={[2.54, 0.06]} />
        <meshBasicMaterial color={tone} transparent opacity={selected ? 0.92 : 0.65} />
      </mesh>
      <Html transform position={[0, 0, 0.27]} distanceFactor={9.5} className="immersive-map-node-html" style={{ zIndex: selected ? 4 : Math.round(2 + depth) }}>
        <button className={`immersive-map-node-copy${selected ? ' selected' : ''}`} type="button" onClick={onSelect}>
          <span>{groupLabel(node, index, language)}</span>
          <strong>{shortText(node.label, 20)}</strong>
          <small className={`status-${status}`}>{statusCopy[status]}</small>
        </button>
      </Html>
    </group>
  )
}

function SpatialGraph({
  stations, data, selectedId, progress, language, lowPower, onSelect,
}: {
  stations: Station[]
  data: KnowledgeMapData
  selectedId: string
  progress: Record<string, Exclude<KnowledgeMapNodeStatus, 'new'>>
  language: 'zh-CN' | 'en'
  lowPower: boolean
  onSelect: (id: string) => void
}) {
  const byId = new Map(stations.map(station => [station.node.id, station]))
  const coreId = stations[0]?.node.id
  const edges = data.edges.length > 0
    ? data.edges.filter(edge => byId.has(edge.from) && byId.has(edge.to))
    : stations.slice(1).map(station => ({ from: coreId || '', to: station.node.id }))
  return (
    <>
      <color attach="background" args={['#f7faf8']} />
      <fog attach="fog" args={['#f7faf8', 9, 22]} />
      <ambientLight intensity={1.45} />
      <directionalLight position={[4.5, 7, 7]} intensity={1.6} castShadow={!lowPower} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-7, 2.5, 2]} intensity={0.54} color="#dbeadf" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.1, -0.5]} receiveShadow>
        <planeGeometry args={[25, 18]} />
        <meshStandardMaterial color="#f0f5f1" roughness={0.98} />
      </mesh>
      <gridHelper args={[22, 22, '#d7e2da', '#e7eee9']} position={[0, -3.08, -0.5]} />
      {edges.map((edge, index) => {
        const from = byId.get(edge.from)
        const to = byId.get(edge.to)
        if (!from || !to) return null
        const midpoint: Point3 = [
          (from.position[0] + to.position[0]) / 2,
          (from.position[1] + to.position[1]) / 2 + 0.18,
          Math.min(from.position[2], to.position[2]) - 0.25,
        ]
        const active = selectedId === edge.from || selectedId === edge.to
        return <Line key={`${edge.from}-${edge.to}-${index}`} points={[from.position, midpoint, to.position]} color={active ? '#39745a' : '#b8c7bd'} lineWidth={active ? 1.8 : 1.05} transparent opacity={active ? 0.9 : 0.58} />
      })}
      {stations.map(station => <StationNode
        key={station.node.id}
        station={station}
        selected={station.node.id === selectedId}
        status={statusFor(progress, station.node.id)}
        language={language}
        onSelect={() => onSelect(station.node.id)}
      />)}
      <OrbitControls
        enablePan={!lowPower}
        enableDamping={!lowPower}
        dampingFactor={0.08}
        minDistance={7}
        maxDistance={15}
        minPolarAngle={Math.PI / 4.3}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, -0.15, -1.1]}
      />
    </>
  )
}

function FlatFallback({
  stations, selectedId, language, progress, onSelect,
}: {
  stations: Station[]
  selectedId: string
  language: 'zh-CN' | 'en'
  progress: Record<string, Exclude<KnowledgeMapNodeStatus, 'new'>>
  onSelect: (id: string) => void
}) {
  return (
    <div className="immersive-map-flat" aria-label={language === 'en' ? 'Planar knowledge map' : '平面知识图解'}>
      {stations.map((station, index) => {
        const status = statusFor(progress, station.node.id)
        return <button
          key={station.node.id}
          className={`${station.node.id === selectedId ? 'selected' : ''} status-${status}`}
          type="button"
          onClick={() => onSelect(station.node.id)}
          style={{ '--station-tone': toneFor(station.node, index) } as CSSProperties}
        >
          <span>{groupLabel(station.node, index, language)}</span>
          <b>{station.node.label}</b>
        </button>
      })}
    </div>
  )
}

export default function KnowledgeMapImmersiveSpace({
  data, title, course, topic, language = 'zh-CN', progress, progressSavingNodeId,
  reviewPracticeGenerating = false, onStatusChange, onReviewPractice, onOpenCanvas, onExit,
}: KnowledgeMapImmersiveSpaceProps) {
  const zh = language !== 'en'
  const stations = useMemo(() => orderStations(data), [data])
  const initialNodeId = data.learning_path.find(id => data.nodes.some(node => node.id === id)) || stations[0]?.node.id || ''
  const [selectedId, setSelectedId] = useState(initialNodeId)
  const [canUseThree] = useState(() => supportsThreeDimensionalCanvas())
  const [lowPower] = useState(() => shouldPreferFlatMode())
  const [renderMode, setRenderMode] = useState<RenderMode>(() => canUseThree && !lowPower ? 'three' : 'flat')
  const progressById = progress?.progress || {}
  const selectedStation = stations.find(station => station.node.id === selectedId) || stations[0]
  const selectedNode = selectedStation?.node
  const selectedStatus = selectedNode ? statusFor(progressById, selectedNode.id) : 'new'
  const summary = progress?.summary || { total: stations.length, mastered: 0, review: 0, untouched: stations.length }
  const detail = selectedNode?.detail || (zh ? '选择一个学习站点，查看它在当前主题中的作用、例子与易错点。' : 'Choose a learning station to see its role, examples, and common mistakes.')

  useEffect(() => {
    setSelectedId(current => stations.some(station => station.node.id === current) ? current : initialNodeId)
  }, [initialNodeId, stations])

  useEffect(() => {
    document.body.classList.add('knowledge-map-immersive-open')
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('knowledge-map-immersive-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onExit])

  const copy = zh ? {
    exit: '退出空间', title: '沉浸学习空间', spatial: '空间视图', flat: '平面视图', lowPower: '已为当前设备使用平面视图', tryThree: '尝试 3D', canvas: '编辑二维画布', path: '学习路线', nodes: '个学习站点', understood: '标为已理解', review: '标为待复习', practicing: '生成中…', practice: '围绕待复习节点出题', hint: '拖动旋转视角，滚轮缩放，点击学习站点聚焦内容', source: '来自本次知识图解', mastered: '已理解', reviewStatus: '待复习', fresh: '未学习', focus: '当前聚焦', example: '例子', pitfall: '易错点', twoD: '二维画布', progress: '学习进度', fallback: '当前环境不支持 WebGL，已显示相同内容的平面视图。',
  } : {
    exit: 'Exit space', title: 'Immersive study space', spatial: 'Spatial view', flat: 'Planar view', lowPower: 'Planar view is recommended for this device', tryThree: 'Try 3D', canvas: 'Edit 2D canvas', path: 'Learning route', nodes: 'learning stations', understood: 'Mark understood', review: 'Mark for review', practicing: 'Generating…', practice: 'Practice review nodes', hint: 'Drag to orbit, scroll to zoom, and select a learning station to focus', source: 'Built from this knowledge map', mastered: 'Understood', reviewStatus: 'Review', fresh: 'New', focus: 'Focus', example: 'Example', pitfall: 'Pitfall', twoD: '2D canvas', progress: 'Learning progress', fallback: 'WebGL is unavailable here, so the same content is shown in a planar view.',
  }
  const statusCopy = selectedStatus === 'mastered' ? copy.mastered : selectedStatus === 'review' ? copy.reviewStatus : copy.fresh
  const handleCanvas = () => {
    onExit()
    window.requestAnimationFrame(onOpenCanvas)
  }

  const content = (
    <div className="knowledge-map-immersive-layer" role="dialog" aria-modal="true" aria-label={copy.title}>
      <section className="knowledge-map-immersive">
        <header className="immersive-map-topbar">
          <button className="immersive-map-exit" type="button" onClick={onExit}><ArrowLeft size={17} />{copy.exit}</button>
          <div className="immersive-map-heading">
            <span><Sparkles size={14} />{copy.title}</span>
            <strong>{title}</strong>
            <small>{course} / {topic} · {stations.length} {copy.nodes}</small>
          </div>
          <div className="immersive-map-actions">
            <div className="immersive-map-mode-switch" aria-label={zh ? '切换图解视图' : 'Switch diagram view'}>
              <button className={renderMode === 'three' ? 'active' : ''} type="button" onClick={() => setRenderMode('three')} disabled={!canUseThree}><Maximize2 size={15} />{copy.spatial}</button>
              <button className={renderMode === 'flat' ? 'active' : ''} type="button" onClick={() => setRenderMode('flat')}><MapIcon size={15} />{copy.flat}</button>
            </div>
            <button className="immersive-map-canvas" type="button" onClick={handleCanvas}><FileText size={15} />{copy.canvas}</button>
            <button className="immersive-map-close" type="button" aria-label={copy.exit} onClick={onExit}><X size={18} /></button>
          </div>
        </header>

        <main className="immersive-map-main">
          <section className="immersive-map-stage" aria-label={copy.spatial}>
            {renderMode === 'three' && canUseThree ? (
              <Canvas
                className="immersive-map-canvas-3d"
                dpr={lowPower ? 1 : [1, 1.55]}
                camera={{ position: [0, 0.25, 13.8], fov: 42, near: 0.1, far: 100 }}
                shadows={!lowPower}
                gl={{ antialias: !lowPower, alpha: false, powerPreference: 'high-performance' }}
                onPointerMissed={() => setSelectedId(initialNodeId)}
                fallback={<FlatFallback stations={stations} selectedId={selectedId} language={language} progress={progressById} onSelect={setSelectedId} />}
              >
                <SpatialGraph stations={stations} data={data} selectedId={selectedId} progress={progressById} language={language} lowPower={lowPower} onSelect={setSelectedId} />
              </Canvas>
            ) : <FlatFallback stations={stations} selectedId={selectedId} language={language} progress={progressById} onSelect={setSelectedId} />}
            <div className="immersive-map-stage-caption">
              <MousePointer2 size={15} />
              <span>{renderMode === 'three' && canUseThree ? copy.hint : !canUseThree ? copy.fallback : copy.lowPower}</span>
              {renderMode === 'flat' && canUseThree && <button type="button" onClick={() => setRenderMode('three')}><ZoomIn size={14} />{copy.tryThree}</button>}
            </div>
          </section>

          <aside className="immersive-map-inspector">
            <div className="immersive-map-progress">
              <span>{copy.progress}</span>
              <strong>{summary.mastered}/{summary.total}</strong>
              <small>{summary.review ? `${copy.reviewStatus} ${summary.review}` : zh ? '继续从任意站点开始' : 'Start with any station'}</small>
            </div>
            {selectedNode && <>
              <div className="immersive-map-focus-label"><Eye size={14} />{copy.focus} · {groupLabel(selectedNode, selectedStation?.index || 0, language)}</div>
              <h1>{selectedNode.label}</h1>
              <p>{detail}</p>
              <div className="immersive-map-status-line"><span className={`status-${selectedStatus}`}>{statusCopy}</span><small>{copy.source}</small></div>
              {selectedNode.example && <section className="immersive-map-note"><b>{copy.example}</b><p>{selectedNode.example}</p></section>}
              {selectedNode.mistake && <section className="immersive-map-note pitfall"><b>{copy.pitfall}</b><p>{selectedNode.mistake}</p></section>}
              <div className="immersive-map-node-actions">
                <button
                  className={selectedStatus === 'mastered' ? 'active' : ''}
                  type="button"
                  disabled={!onStatusChange || progressSavingNodeId === selectedNode.id}
                  onClick={() => onStatusChange?.(selectedNode.id, selectedStatus === 'mastered' ? 'new' : 'mastered')}
                ><Check size={15} />{progressSavingNodeId === selectedNode.id ? (zh ? '同步中…' : 'Saving…') : copy.understood}</button>
                <button
                  className={selectedStatus === 'review' ? 'active review' : ''}
                  type="button"
                  disabled={!onStatusChange || progressSavingNodeId === selectedNode.id}
                  onClick={() => onStatusChange?.(selectedNode.id, selectedStatus === 'review' ? 'new' : 'review')}
                ><Sparkles size={15} />{copy.review}</button>
              </div>
            </>}
            <div className="immersive-map-route">
              <div><span>{copy.path}</span><small>{stations.length} {copy.nodes}</small></div>
              {stations.map((station, index) => <button className={station.node.id === selectedId ? 'active' : ''} type="button" key={station.node.id} onClick={() => setSelectedId(station.node.id)}><i>{index + 1}</i><span>{station.node.label}</span><ChevronRight size={14} /></button>)}
            </div>
            <button className="immersive-map-practice" type="button" disabled={!onReviewPractice || summary.review === 0 || reviewPracticeGenerating} onClick={onReviewPractice}><Sparkles size={16} />{reviewPracticeGenerating ? copy.practicing : copy.practice}</button>
          </aside>
        </main>
      </section>
    </div>
  )
  return createPortal(content, document.body)
}
