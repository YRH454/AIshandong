import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  ArrowRight,
  Atom,
  BookOpenCheck,
  Check,
  CircleDot,
  Database,
  GitBranch,
  MemoryStick,
  Network,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Waypoints,
} from 'lucide-react'
import type {
  DynamicExplanationBeat,
  DynamicExplanationInteractionOutcome,
  DynamicExplanationScene,
  DynamicExplanationStageKind,
} from './dynamicExplanation'
import { FormulaText } from './FormulaText'

type UniversalActor = {
  id: string
  label: string
  role?: string
}

type ComparisonDimension = {
  id?: string
  label: string
  left: string
  right: string
  deciding_factor: string
}

type StoryboardVisualItem = {
  id?: string
  label?: string
  title?: string
  marker?: string
  role?: string
}

// A stage's learning grammar (causal chain, timeline, network…) determines
// how an idea moves.  Its subject material determines what the learner feels
// they are looking at.  Keeping those two decisions separate prevents every
// subject from turning into the same set of neutral cards with a new colour.
type StoryboardMood = 'circuit' | 'archive' | 'organic' | 'formula' | 'dossier' | 'flow' | 'route' | 'paper'

type CausalTransmissionNode = StoryboardVisualItem & {
  id: string
  label: string
  role: 'trigger' | 'step' | 'outcome'
  mechanism: string
  effect: string
  state_before?: string
  state_after?: string
  observable?: string
}

export type UniversalKnowledgeSceneProps = {
  kind: DynamicExplanationStageKind
  scene: DynamicExplanationScene
  actors: UniversalActor[]
  beats: DynamicExplanationBeat[]
  safeStep: number
  activeBeat?: DynamicExplanationBeat
  progress: number
  moveTo: (next: number) => void
  tr: (chinese: string, english: string) => string
  onInteraction?: (outcome?: DynamicExplanationInteractionOutcome) => void
}

const orbitPositions = [
  { x: 50, y: 12 }, { x: 78, y: 27 }, { x: 84, y: 64 }, { x: 62, y: 84 },
  { x: 32, y: 84 }, { x: 14, y: 58 }, { x: 20, y: 25 },
]

const networkPositions = [
  { x: 13, y: 23 }, { x: 42, y: 13 }, { x: 76, y: 24 }, { x: 84, y: 63 },
  { x: 56, y: 82 }, { x: 23, y: 75 }, { x: 48, y: 50 },
]

const stateRoutePositions = [
  { x: 11, y: 57 }, { x: 27, y: 30 }, { x: 49, y: 26 }, { x: 73, y: 43 },
  { x: 84, y: 71 }, { x: 53, y: 78 }, { x: 25, y: 73 },
]

function stageDossierPositions(count: number) {
  // A case is read left-to-right: the learner's question sets the condition,
  // short evidence signals travel on two lanes, and only then does the verdict
  // form.  Keeping the cards on this route prevents the old "postcards around
  // a circle" composition from turning an argument into a slide.
  const runway = [
    { x: 35, y: 31, rotation: 0 }, { x: 53, y: 31, rotation: 0 }, { x: 35, y: 69, rotation: 0 },
    { x: 53, y: 69, rotation: 0 }, { x: 44, y: 50, rotation: 0 }, { x: 63, y: 50, rotation: 0 },
  ]
  if (count <= 1) return [{ x: 44, y: 50, rotation: 0 }]
  if (count === 2) return [runway[0], runway[2]]
  if (count === 3) return [runway[0], runway[1], runway[2]]
  if (count === 4) return runway.slice(0, 4)
  return runway
}

function dossierRoutePath(point: { x: number; y: number }, index: number) {
  const bend = point.y < 50 ? -5 : 5
  const firstControlX = Math.min(64, point.x + 14)
  const secondControlX = 72
  return `M ${point.x + 6} ${point.y} C ${firstControlX} ${point.y}, ${secondControlX} ${50 + bend + (index % 2 ? 1.5 : -1.5)}, 78 50`
}

function compactCaseLabel(value: string | undefined, fallback: string) {
  const raw = (value || '').replace(/\[[^\]]+\]\([^)]*\)/g, match => match.replace(/^\[|\]\([^)]*\)$/g, ''))
  const tableCells = raw
    .split('|')
    .map(cell => cell.replace(/[`*_#>]/g, '').replace(/^\s*(?:[-•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
  const genericTableLabels = /^(?:你的目标|建议任务|时间|正确理解|重点理解|工具推荐|课程视频|小练习|实验建议)$/
  const candidate = (tableCells.length > 1
    ? tableCells.find(cell => !genericTableLabels.test(cell))
    : tableCells[0]) || fallback
  const plain = candidate
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/(?:^|\s)(?:例如|比如|包含|包括).*/u, '')
    .trim()
  if (!plain) return fallback
  const naturalStop = plain.search(/[，、。；;：:（(]/u)
  const short = naturalStop >= 4 ? plain.slice(0, naturalStop) : plain
  return short.length > 14 ? `${short.slice(0, 13).replace(/[，、；;：: ]+$/u, '')}…` : short
}

function stageRoutePositions(count: number) {
  if (count <= 1) return [{ x: 50, y: 68 }]
  if (count === 2) return [{ x: 22, y: 60 }, { x: 78, y: 40 }]
  if (count === 3) return [{ x: 16, y: 64 }, { x: 50, y: 28 }, { x: 84, y: 64 }]
  if (count === 4) return [{ x: 13, y: 63 }, { x: 34, y: 28 }, { x: 66, y: 28 }, { x: 87, y: 63 }]
  return stateRoutePositions
}

function causalTransmissionPositions(count: number) {
  const patterns: Record<number, number[]> = {
    1: [50],
    2: [57, 43],
    3: [59, 36, 58],
    4: [61, 35, 63, 44],
    5: [60, 34, 66, 38, 58],
    6: [53, 38, 58, 41, 56, 45],
    7: [54, 37, 60, 42, 58, 38, 53],
    8: [54, 36, 61, 43, 59, 38, 60, 48],
  }
  const ys = patterns[Math.min(8, Math.max(1, count))] || patterns[8]
  return Array.from({ length: count }, (_, index) => ({
    x: count <= 1 ? 50 : 7 + index * 86 / (count - 1),
    y: ys[index % ys.length],
  }))
}

function causalLinkPath(from: { x: number; y: number }, to: { x: number; y: number }, index: number) {
  const controlX = (from.x + to.x) / 2
  const controlY = (from.y + to.y) / 2 + (index % 2 ? -6 : 6)
  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`
}

function normalizeStoryboardTerm(value?: string) {
  return (value || '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim()
}

function itemStoryboardTerms(item: StoryboardVisualItem) {
  return [item.id, item.label, item.title]
    .map(normalizeStoryboardTerm)
    .filter(term => term.length >= 2)
}

function storyboardTermsMatch(left?: string, right?: string) {
  const normalizedLeft = normalizeStoryboardTerm(left)
  const normalizedRight = normalizeStoryboardTerm(right)
  if (normalizedLeft.length < 2 || normalizedRight.length < 2) return false
  return normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)
}

function matchingItemIndex(items: StoryboardVisualItem[], term?: string) {
  if (!term) return -1
  return items.findIndex(item => itemStoryboardTerms(item).some(value => storyboardTermsMatch(value, term)))
}

function storyboardMood(scene: DynamicExplanationScene, kind: DynamicExplanationStageKind): StoryboardMood {
  const source = [
    scene.title,
    scene.narration,
    scene.key_point,
    scene.storyboard?.knowledge_relation,
    scene.storyboard?.visible_change,
    ...(scene.storyboard?.atoms || []),
  ].join(' ').toLocaleLowerCase()

  if (/缓存|cache|cpu|处理器|地址|指令|寄存器|内存|算法|程序|代码|网络|协议|数据/.test(source)) return 'circuit'
  if (/历史|年代|世纪|革命|事件|战争|朝代|演变|时间|阶段|发展/.test(source)) return 'archive'
  if (/细胞|基因|生态|生物|植物|动物|人体|器官|化学|分子|蛋白/.test(source)) return 'organic'
  if (/公式|方程|函数|几何|概率|参数|变量|数学|计算|力|速度|电流/.test(source)) return 'formula'
  if (kind === 'case-lab') return 'dossier'
  if (kind === 'timeline-river' || kind === 'causal-chain') return 'flow'
  if (kind === 'state-machine') return 'route'
  return 'paper'
}

/**
 * A quiet, content-shaped physical substrate for the universal stages.
 *
 * It intentionally contains no copy: the stage nodes keep the real knowledge
 * labels, while this layer gives their relationships a recognisable material
 * language.  The director playhead from CinematicKnowledgeStage drives the
 * highlighted path through CSS variables, so it advances during a beat rather
 * than popping between static slides.
 */
function SubjectStageScaffold({ mood }: { mood: StoryboardMood }) {
  if (!['circuit', 'archive', 'organic', 'formula'].includes(mood)) return null

  if (mood === 'circuit') {
    return (
      <div className="subject-stage-scaffold subject-stage-scaffold--circuit" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <path className="subject-trace trace-a" pathLength={100} d="M 2 26 H 19 V 47 H 40 V 34 H 63 V 62 H 83 V 44 H 98" />
          <path className="subject-trace trace-b" pathLength={100} d="M 2 73 H 16 V 56 H 33 V 71 H 54 V 45 H 75 V 31 H 98" />
          <path className="subject-trace trace-c" pathLength={100} d="M 25 2 V 18 H 48 V 29 H 71 V 17 H 91 V 2" />
          <circle className="subject-terminal terminal-a" cx="19" cy="47" r="1.8" />
          <circle className="subject-terminal terminal-b" cx="63" cy="62" r="1.8" />
          <circle className="subject-terminal terminal-c" cx="75" cy="31" r="1.8" />
        </svg>
        <i className="subject-signal signal-a" />
        <i className="subject-signal signal-b" />
      </div>
    )
  }

  if (mood === 'archive') {
    return (
      <div className="subject-stage-scaffold subject-stage-scaffold--archive" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <path className="subject-thread" pathLength={100} d="M 5 71 C 17 54, 24 76, 37 58 S 56 43, 69 53 S 85 36, 96 22" />
          <path className="subject-thread subject-thread--ghost" d="M 5 83 C 20 66, 28 88, 44 68 S 62 56, 77 62 S 91 49, 98 42" />
          <rect className="subject-record record-a" x="14" y="49" width="13" height="17" rx="1" />
          <rect className="subject-record record-b" x="45" y="40" width="15" height="19" rx="1" />
          <rect className="subject-record record-c" x="77" y="28" width="12" height="16" rx="1" />
        </svg>
        <i className="subject-seal seal-a" />
        <i className="subject-seal seal-b" />
      </div>
    )
  }

  if (mood === 'organic') {
    return (
      <div className="subject-stage-scaffold subject-stage-scaffold--organic" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <path className="subject-membrane" d="M 18 45 C 16 20, 41 8, 63 17 C 85 26, 92 53, 76 73 C 62 91, 31 88, 20 68 C 16 60, 20 52, 18 45 Z" />
          <path className="subject-vein vein-a" pathLength={100} d="M 20 62 C 33 51, 41 59, 51 47 S 70 34, 80 25" />
          <path className="subject-vein vein-b" pathLength={100} d="M 25 30 C 37 38, 45 32, 57 46 S 69 66, 78 73" />
          <circle className="subject-organelle organelle-a" cx="37" cy="47" r="4" />
          <circle className="subject-organelle organelle-b" cx="63" cy="56" r="3.2" />
          <circle className="subject-organelle organelle-c" cx="55" cy="31" r="2.4" />
        </svg>
        <i className="subject-drift drift-a" />
        <i className="subject-drift drift-b" />
      </div>
    )
  }

  return (
    <div className="subject-stage-scaffold subject-stage-scaffold--formula" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <path className="subject-axis" d="M 8 82 H 96 M 17 94 V 8" />
        <path className="subject-curve" pathLength={100} d="M 18 74 C 31 74, 33 58, 46 53 S 57 33, 69 36 S 77 18, 92 15" />
        <path className="subject-curve subject-curve--secondary" pathLength={100} d="M 18 24 C 33 31, 37 47, 52 51 S 73 69, 92 76" />
        <circle className="subject-coordinate coordinate-a" cx="46" cy="53" r="2.2" />
        <circle className="subject-coordinate coordinate-b" cx="69" cy="36" r="2.2" />
      </svg>
      <i className="subject-variable variable-a" />
      <i className="subject-variable variable-b" />
    </div>
  )
}

function beatIndex(index: number, count: number, beats: DynamicExplanationBeat[]) {
  if (count <= 1 || beats.length <= 1) return 0
  return Math.round(index / (count - 1) * (beats.length - 1))
}

function reachableEdges(edges: Array<{ from: string; to: string }>, start: string) {
  const reached = new Set<string>([start])
  const active = new Set<number>()
  let changed = true
  while (changed) {
    changed = false
    edges.forEach((edge, index) => {
      if (reached.has(edge.from) && !reached.has(edge.to)) {
        reached.add(edge.to)
        active.add(index)
        changed = true
      }
    })
  }
  return active
}

function looksLikeCacheComparison(scene: DynamicExplanationScene, dimensions: ComparisonDimension[]) {
  const payload = scene.scene_payload?.kind === 'comparison-studio' ? scene.scene_payload : null
  const source = [
    scene.title,
    scene.narration,
    scene.key_point,
    scene.visual.headline,
    payload?.shared_condition,
    payload?.left_title,
    payload?.right_title,
    ...dimensions.flatMap(item => [item.label, item.left, item.right, item.deciding_factor]),
  ].filter(Boolean).join(' ')
  return /缓存|cache|命中|地址|标记位|有效位|索引|cache\s*line|tag\b|index\b|valid\b/i.test(source)
}

function isHitLabel(value: string) {
  const normalized = value.toLowerCase()
  if (/未命中|不命中|miss|不同|不一致|失配/.test(normalized)) return false
  return /命中|hit|一致|相同|匹配/.test(normalized)
}

type CacheComparisonLabProps = {
  scene: DynamicExplanationScene
  dimensions: ComparisonDimension[]
  activeIndex: number
  comparisonFocus: 'left' | 'right'
  motionClass: string
  motionAction: DynamicExplanationBeat['action']
  storyboardSurfaceClass: string
  storyboardAtomClass: (item: StoryboardVisualItem, active?: boolean) => string
  onExplore: (item: StoryboardVisualItem | string) => void
  choose: (side: 'left' | 'right') => void
  chooseDimension: (index: number) => void
  tr: UniversalKnowledgeSceneProps['tr']
}

function CacheComparisonLab({ scene, dimensions, activeIndex, comparisonFocus, motionClass, motionAction, storyboardSurfaceClass, storyboardAtomClass, onExplore, choose, chooseDimension, tr }: CacheComparisonLabProps) {
  const payload = scene.scene_payload?.kind === 'comparison-studio' ? scene.scene_payload : null
  const selected = dimensions[Math.min(activeIndex, Math.max(0, dimensions.length - 1))]
  const leftTitle = payload?.left_title || scene.visual.before || tr('地址 A', 'Address A')
  const rightTitle = payload?.right_title || scene.visual.after || tr('地址 B', 'Address B')
  const leftHit = isHitLabel(`${leftTitle} ${selected?.left || ''}`)
  const rightHit = isHitLabel(`${rightTitle} ${selected?.right || ''}`)
  const activeHit = comparisonFocus === 'left' ? leftHit : rightHit
  const visibleDimensions = dimensions.slice(0, 3)
  const field = (side: 'left' | 'right', index: number) => side === 'left'
    ? (index === 0 ? '0110' : index === 1 ? '10' : '1')
    : (index === 0 ? '1001' : index === 1 ? '10' : '1')
  const resultText = activeHit ? tr('从缓存行读取数据', 'Read from cache line') : tr('继续向下一层取数', 'Continue to lower memory')

  return (
    <div className={`universal-scene cache-comparison-lab focus-${comparisonFocus} ${activeHit ? 'is-hit' : 'is-miss'} ${motionClass} ${storyboardSurfaceClass}`} data-motion={motionAction} aria-label={tr('缓存命中对比演示', 'Cache hit comparison demonstration')}>
      <div className="cache-lab-watermark" aria-hidden="true" />
      <button type="button" className={`cache-address-token left${comparisonFocus === 'left' ? ' active' : ''} ${storyboardAtomClass({ label: leftTitle }, comparisonFocus === 'left')}`} onClick={() => { onExplore({ label: leftTitle }); choose('left') }} aria-pressed={comparisonFocus === 'left'}>
        <span>{tr('对象 A', 'Object A')}</span>
        <strong><FormulaText>{leftTitle}</FormulaText></strong>
        <div aria-label={tr('地址 A 的地址分段', 'Address A fields')}><i><small>TAG</small><b>{field('left', 0)}</b></i><i><small>INDEX</small><b>{field('left', 1)}</b></i><i><small>V</small><b>{field('left', 2)}</b></i></div>
      </button>

      <div className="cache-machine-stage">
        <div className="cache-machine-title"><MemoryStick size={20} /><span>{tr('同一缓存组', 'Same cache set')}</span></div>
        <svg className="cache-machine-wiring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path className="cache-wire cache-wire-left" pathLength={100} d="M 0 50 C 22 50, 28 40, 47 44" />
          <path className="cache-wire cache-wire-right" pathLength={100} d="M 100 50 C 78 50, 72 60, 53 56" />
          <path className="cache-wire cache-wire-return" pathLength={100} d="M 52 58 C 61 74, 76 78, 91 84" />
        </svg>
        <div className="cache-set-rack" aria-label={tr('缓存组中的缓存行', 'Cache lines in the set')}>
          {[0, 1, 2, 3].map(index => <i className={index === 1 ? 'target-line' : ''} key={index}><small>{tr('缓存行', 'Line')} {index + 1}</small><b>{index === 1 ? '0110' : index === 3 ? '0011' : '—'}</b><span>{index === 1 ? tr('数据', 'Data') : tr('空闲', 'Idle')}</span></i>)}
        </div>
        <div className="cache-probe-path" aria-hidden="true"><i className="cache-probe left" /><i className="cache-probe right" /><span><CircleDot size={15} /></span></div>
        {!activeHit && <div className="cache-fallback-store" aria-label={resultText}><Database size={19} /><span>{tr('下探', 'Descend')}</span></div>}
        <div className={`cache-result-beacon ${activeHit ? 'hit' : 'miss'}`} aria-live="polite" aria-label={`${activeHit ? tr('命中', 'Hit') : tr('未命中', 'Miss')}：${resultText}`}><i>{activeHit ? <Check size={18} /> : <ArrowRight size={18} />}</i><strong>{activeHit ? tr('命中', 'Hit') : tr('未命中', 'Miss')}</strong><span><FormulaText>{resultText}</FormulaText></span></div>
      </div>

      <button type="button" className={`cache-address-token right${comparisonFocus === 'right' ? ' active' : ''} ${storyboardAtomClass({ label: rightTitle }, comparisonFocus === 'right')}`} onClick={() => { onExplore({ label: rightTitle }); choose('right') }} aria-pressed={comparisonFocus === 'right'}>
        <span>{tr('对象 B', 'Object B')}</span>
        <strong><FormulaText>{rightTitle}</FormulaText></strong>
        <div aria-label={tr('地址 B 的地址分段', 'Address B fields')}><i><small>TAG</small><b>{field('right', 0)}</b></i><i><small>INDEX</small><b>{field('right', 1)}</b></i><i><small>V</small><b>{field('right', 2)}</b></i></div>
      </button>

      <div className="cache-lab-insight">
        <div><small><FormulaText>{selected?.label || tr('决定条件', 'Deciding field')}</FormulaText></small><strong><FormulaText>{selected?.deciding_factor || scene.key_point}</FormulaText></strong></div>
        {visibleDimensions.length > 1 && <nav aria-label={tr('切换比较条件', 'Switch comparison condition')}>{visibleDimensions.map((item, index) => <button type="button" className={`${index === activeIndex ? 'active' : ''} ${storyboardAtomClass(item, index === activeIndex)}`} aria-pressed={index === activeIndex} onClick={() => { onExplore(item); chooseDimension(index) }} key={item.id || item.label}><FormulaText>{item.label}</FormulaText></button>)}</nav>}
      </div>
    </div>
  )
}

export function UniversalKnowledgeScene(props: UniversalKnowledgeSceneProps) {
  const { kind, scene, actors, beats, safeStep, activeBeat, progress, moveTo, tr, onInteraction } = props
  const [comparisonFocus, setComparisonFocus] = useState<'left' | 'right'>('left')
  const [causalBlocked, setCausalBlocked] = useState(false)
  const [networkFocusId, setNetworkFocusId] = useState<string | null>(null)
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null)
  const [showExceptionPath, setShowExceptionPath] = useState(false)
  const [openedEvidenceIds, setOpenedEvidenceIds] = useState<string[]>([])
  const [counterEvidenceOpen, setCounterEvidenceOpen] = useState(false)
  const parameterPayload = scene.scene_payload?.kind === 'parameter-lab' ? scene.scene_payload : null
  const inputMin = parameterPayload?.min ?? scene.simulation?.input_min ?? 0
  const inputMax = parameterPayload?.max ?? scene.simulation?.input_max ?? 100
  const initialInput = parameterPayload?.initial ?? scene.simulation?.initial_input ?? Math.round((inputMin + inputMax) / 2)
  const [parameterValue, setParameterValue] = useState(initialInput)
  const [exploredStoryboardAtoms, setExploredStoryboardAtoms] = useState<string[]>([])
  const storyboardAtoms = useMemo(() => Array.from(new Set((scene.storyboard?.atoms || [])
    .map(atom => atom.trim())
    .filter(atom => normalizeStoryboardTerm(atom).length >= 2))), [scene.storyboard?.atoms])
  const motionAction = activeBeat?.action ?? 'focus'
  const motionClass = `motion-${motionAction} motion-step-${safeStep % 4}`
  const sceneMood = storyboardMood(scene, kind)
  const storyboardSurfaceClass = `storyboard-surface scene-mood-${sceneMood}${storyboardAtoms.length ? ' has-storyboard-focus' : ''}`
  const storyboardStepAtom = storyboardAtoms.length
    ? storyboardAtoms[Math.min(storyboardAtoms.length - 1, Math.round(safeStep / Math.max(1, beats.length - 1) * (storyboardAtoms.length - 1)))]
    : undefined
  const parameterRatio = inputMax === inputMin ? .5 : (parameterValue - inputMin) / (inputMax - inputMin)
  const nodes = useMemo(() => {
    const source = actors.length >= 3 ? actors : scene.visual.items.map((label, index) => ({ id: `visual-${index}`, label, role: '' }))
    return source.slice(0, 7)
  }, [actors, scene.visual.items])
  const progressIndex = (count: number) => count ? Math.max(0, Math.min(count - 1, Math.round(progress * count) - 1)) : 0
  const storyboardAtomKey = (item: StoryboardVisualItem) => {
    const matchingAtom = storyboardAtoms.find(atom => itemStoryboardTerms(item).some(term => storyboardTermsMatch(term, atom)))
    if (matchingAtom) return `atom:${normalizeStoryboardTerm(matchingAtom)}`
    const fallback = itemStoryboardTerms(item)[0]
    return fallback ? `item:${fallback}` : ''
  }
  const rememberStoryboardAtom = (item: StoryboardVisualItem | string) => {
    const key = storyboardAtomKey(typeof item === 'string' ? { label: item } : item)
    if (!key) return
    setExploredStoryboardAtoms(current => current.includes(key) ? current : [...current, key])
  }
  const storyboardAtomClass = (item: StoryboardVisualItem, active = false) => {
    const key = storyboardAtomKey(item)
    return `storyboard-atom${active ? ' storyboard-atom-active' : ''}${key && exploredStoryboardAtoms.includes(key) ? ' storyboard-atom-explored' : ''}`
  }
  const focusIndex = (items: StoryboardVisualItem[]) => {
    for (const target of [activeBeat?.target, activeBeat?.to]) {
      const matchingIndex = matchingItemIndex(items, target)
      if (matchingIndex >= 0) return matchingIndex
    }
    const storyboardIndex = matchingItemIndex(items, storyboardStepAtom)
    if (storyboardIndex >= 0) return storyboardIndex
    const labelIndex = matchingItemIndex(items, activeBeat?.label)
    if (labelIndex >= 0) return labelIndex
    return progressIndex(items.length)
  }
  const interactFor = (index: number, count: number, outcome?: Omit<DynamicExplanationInteractionOutcome, 'kind'>) => {
    if (outcome?.label) rememberStoryboardAtom(outcome.label)
    onInteraction?.(outcome ? { ...outcome, kind } : undefined)
    moveTo(beatIndex(index, Math.max(1, count), beats))
  }

  useEffect(() => {
    setComparisonFocus('left')
    setCausalBlocked(false)
    setNetworkFocusId(null)
    setSelectedStateId(null)
    setShowExceptionPath(false)
    setOpenedEvidenceIds([])
    setCounterEvidenceOpen(false)
    setParameterValue(initialInput)
    setExploredStoryboardAtoms([])
  }, [initialInput, scene.id])

  useEffect(() => {
    if (!storyboardStepAtom) return
    const key = `atom:${normalizeStoryboardTerm(storyboardStepAtom)}`
    setExploredStoryboardAtoms(current => current.includes(key) ? current : [...current, key])
  }, [scene.id, storyboardStepAtom])

  useEffect(() => {
    setNetworkFocusId(null)
    setSelectedStateId(null)
  }, [activeBeat?.id])

  useEffect(() => {
    if (kind !== 'parameter-lab' || !parameterPayload || !activeBeat?.target) return
    const targetPoint = parameterPayload.response_points.find(point => point.label === activeBeat.target || `${point.value}` === activeBeat.target)
    if (targetPoint) setParameterValue(value => value === targetPoint.value ? value : targetPoint.value)
  }, [activeBeat?.target, kind, parameterPayload])

  if (kind === 'concept-constellation') {
    const payload = scene.scene_payload?.kind === kind ? scene.scene_payload : null
    const branches = payload?.branches?.length ? payload.branches.slice(0, 7) : nodes.map(node => ({ ...node, relation: node.role || tr('关联', 'Related'), detail: scene.key_point }))
    const branchPositions = new Map(branches.map((branch, index) => [branch.id, orbitPositions[index % orbitPositions.length]]))
    const activeIndex = focusIndex(branches)
    const focused = branches[activeIndex]
    const focusedPoint = orbitPositions[activeIndex % orbitPositions.length]
    const rayDx = focusedPoint.x - 50
    const rayDy = focusedPoint.y - 50
    const constellationStyle = {
      '--constellation-ray-angle': `${Math.atan2(rayDy, rayDx) * 180 / Math.PI}deg`,
      '--constellation-ray-length': `${Math.min(43, Math.hypot(rayDx, rayDy))}%`,
    } as CSSProperties
    return (
      <div className={`universal-scene concept-constellation-scene ${motionClass} ${storyboardSurfaceClass}`} data-motion={motionAction}>
        <SubjectStageScaffold mood={sceneMood} />
        <div className="constellation-field" style={constellationStyle} aria-label={tr('概念星图', 'Concept constellation')}>
          <div className={`constellation-core ${storyboardAtomClass({ label: payload?.core || scene.visual.headline || scene.title })}`}><Atom size={31} /><strong><FormulaText>{payload?.core || scene.visual.headline || scene.title}</FormulaText></strong><span><FormulaText>{payload?.core_detail || scene.key_point}</FormulaText></span></div>
          <i className="constellation-focus-ray" aria-hidden="true" />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {branches.map((_, index) => {
              const point = orbitPositions[index % orbitPositions.length]
              return <line key={index} x1="50" y1="50" x2={point.x} y2={point.y} className={index <= activeIndex ? 'active' : ''} />
            })}
            {payload?.cross_links.map((link, index) => {
              const from = branchPositions.get(link.from)
              const to = branchPositions.get(link.to)
              return from && to ? <line key={`cross-${index}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="cross-link" /> : null
            })}
          </svg>
          {branches.map((node, index) => {
            const point = orbitPositions[index % orbitPositions.length]
            return <button type="button" className={`${index === activeIndex ? 'active motion-target' : index < activeIndex ? 'visited' : ''} ${storyboardAtomClass(node, index === activeIndex)}`} style={{ '--node-x': `${point.x}%`, '--node-y': `${point.y}%`, '--node-delay': `${index * 55}ms`, '--node-origin-x': `${Math.round((50 - point.x) * 5.1)}px`, '--node-origin-y': `${Math.round((50 - point.y) * 4.4)}px` } as CSSProperties} onClick={() => interactFor(index, branches.length, { label: node.label, detail: node.detail, value: node.relation, signal: 'complete' })} key={node.id}><small><FormulaText>{node.relation || tr('关联概念', 'Related idea')}</FormulaText></small><strong><FormulaText>{node.label}</FormulaText></strong></button>
          })}
        </div>
        <aside className="universal-reading-strip"><CircleDot size={17} /><span><FormulaText>{focused?.label || activeBeat?.label || scene.title}</FormulaText></span><strong><FormulaText>{focused?.detail || activeBeat?.detail || scene.narration}</FormulaText></strong>{payload?.boundary_conditions[0] && <small>{tr('边界：', 'Boundary: ')}<FormulaText>{payload.boundary_conditions[0]}</FormulaText></small>}</aside>
      </div>
    )
  }

  if (kind === 'causal-chain') {
    const payload = scene.scene_payload?.kind === kind ? scene.scene_payload : null
    const steps = payload?.steps?.length ? payload.steps.slice(0, 6) : nodes.map((node, index) => ({
      id: node.id,
      label: node.label,
      mechanism: node.role || scene.narration,
      effect: nodes[index + 1]?.label || scene.key_point,
      state_before: index ? nodes[index - 1]?.label : payload?.trigger || scene.visual.before,
      state_after: nodes[index + 1]?.label || scene.visual.after || scene.key_point,
      observable: scene.key_point,
    }))
    const causalNodes: CausalTransmissionNode[] = [
      {
        id: 'causal-trigger',
        label: payload?.trigger || scene.visual.before || steps[0]?.label || tr('触发条件', 'Trigger'),
        role: 'trigger',
        mechanism: steps[0]?.state_before || scene.stage?.focal_question || scene.narration,
        effect: steps[0]?.label || scene.key_point,
        state_before: tr('条件尚未满足', 'Condition inactive'),
        state_after: steps[0]?.state_before || steps[0]?.label,
        observable: scene.visual.before || scene.key_point,
      },
      ...steps.map(step => ({ ...step, role: 'step' as const })),
      {
        id: 'causal-outcome',
        label: payload?.outcome || scene.visual.after || scene.key_point,
        role: 'outcome',
        mechanism: steps[steps.length - 1]?.effect || scene.key_point,
        effect: payload?.outcome || scene.key_point,
        state_before: steps[steps.length - 1]?.state_after || steps[steps.length - 1]?.label,
        state_after: payload?.outcome || scene.visual.after || scene.key_point,
        observable: payload?.outcome || scene.visual.after || scene.key_point,
      },
    ]
    const activeIndex = focusIndex(causalNodes)
    const focused = causalNodes[activeIndex]
    const layout = causalTransmissionPositions(causalNodes.length)
    const settledIndex = causalBlocked
      ? activeIndex
      : Math.max(activeIndex, Math.min(causalNodes.length - 1, Math.round(progress * Math.max(0, causalNodes.length - 1))))
    const cutIndex = Math.min(Math.max(0, activeIndex), Math.max(0, causalNodes.length - 2))
    const focusedPoint = layout[activeIndex] || layout[0]
    const barrierPoint = causalBlocked && layout[cutIndex + 1]
      ? {
        x: (layout[cutIndex].x + layout[cutIndex + 1].x) / 2,
        y: (layout[cutIndex].y + layout[cutIndex + 1].y) / 2,
      }
      : null
    const activeLink = activeIndex > 0
      ? causalLinkPath(layout[activeIndex - 1], focusedPoint, activeIndex - 1)
      : ''
    const stateBefore = focused?.state_before || focused?.mechanism || scene.visual.before || tr('条件尚未触发', 'Condition inactive')
    const stateAfter = focused?.state_after || focused?.observable || focused?.effect || scene.visual.after || scene.key_point
    const stateChange = [focused?.state_before, focused?.state_after].filter(Boolean).join(' → ')
    const currentExplanation = causalBlocked
      ? tr('条件被切断，信号停在当前环节，后续状态不会继续形成。', 'The condition is cut, so the signal stops here and downstream states do not form.')
      : focused?.mechanism || activeBeat?.detail || scene.narration
    const replay = () => {
      setCausalBlocked(false)
      moveTo(0)
      onInteraction?.({ kind, label: tr('从头观察机制链', 'Replay mechanism chain'), detail: payload?.trigger || scene.title, value: tr('回到触发条件', 'Back to trigger'), signal: 'complete' })
    }
    return (
      <div className={`universal-scene causal-flux-stage ${motionClass}${causalBlocked ? ' is-blocked' : ''} ${storyboardSurfaceClass}`} data-motion={motionAction} data-causal-mood={sceneMood} aria-label={tr('因果机制传导台', 'Causal mechanism transmission desk')}>
        <SubjectStageScaffold mood={sceneMood} />
        <div className="causal-flux-world" aria-label={tr('因果机制流动演示', 'Causal mechanism flow demonstration')}>
          <div className="causal-flux-title" aria-hidden="true"><GitBranch size={15} /><span><FormulaText>{scene.stage?.focal_question || scene.title}</FormulaText></span></div>
          <div className={`causal-flux-focus-field role-${focused?.role || 'step'}`} style={{ '--causal-focus-x': `${focusedPoint.x}%`, '--causal-focus-y': `${focusedPoint.y}%` } as CSSProperties} key={`focus-${scene.id}-${activeIndex}-${causalBlocked ? 'blocked' : 'flow'}`} aria-hidden="true"><i /><i /><b /></div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {causalNodes.slice(0, -1).map((_, index) => {
              const path = causalLinkPath(layout[index], layout[index + 1], index)
              const isTraced = index < settledIndex
              const isBlocked = causalBlocked && index >= cutIndex
              return <g className={`${isTraced ? 'traced' : ''}${isBlocked ? ' blocked' : ''}`} key={`segment-${index}`}>
                <path className="causal-flux-rail" d={path} />
                <path className="causal-flux-reveal" pathLength="1" strokeDasharray="1" strokeDashoffset={isTraced && !isBlocked ? 0 : 1} d={path} />
              </g>
            })}
            {barrierPoint && <g className="causal-flux-barrier" transform={`translate(${barrierPoint.x} ${barrierPoint.y})`}><path d="M -2.1 -4.1 L 2.1 -4.1 L 2.1 4.1 L -2.1 4.1 Z" /><path d="M -1.35 -2.65 L 1.35 2.65 M 1.35 -2.65 L -1.35 2.65" /></g>}
            <g className="causal-flux-signal" key={`signal-${scene.id}-${activeIndex}-${causalBlocked ? 'blocked' : 'flow'}`}>
              {activeLink && !causalBlocked ? (
                <>
                  <circle className="causal-flux-signal-halo" cx="0" cy="0" r="3.4"><animateMotion path={activeLink} dur="720ms" fill="freeze" /></circle>
                  <circle className="causal-flux-signal-core" cx="0" cy="0" r="1.35"><animateMotion path={activeLink} dur="720ms" fill="freeze" /></circle>
                </>
              ) : (
                <>
                  <circle className="causal-flux-signal-halo" cx={focusedPoint.x} cy={focusedPoint.y} r="3.4" />
                  <circle className="causal-flux-signal-core" cx={focusedPoint.x} cy={focusedPoint.y} r="1.35" />
                </>
              )}
            </g>
          </svg>
          {causalNodes.map((node, index) => {
            const point = layout[index]
            const isActive = index === activeIndex
            const isVisited = index < activeIndex
            const isDownstream = causalBlocked && index > cutIndex
            const stateLabel = node.state_after || node.observable || node.effect
            const roleLabel = node.role === 'trigger' ? tr('触发条件', 'Trigger') : node.role === 'outcome' ? tr('形成结果', 'Outcome') : tr('状态变化', 'State change')
            return <button type="button" className={`causal-flux-node causal-flux-node--${node.role} ${isActive ? 'active motion-target' : isVisited ? 'visited' : ''}${isDownstream ? ' blocked-downstream' : ''} ${storyboardAtomClass(node, isActive)}`} style={{ '--causal-node-x': `${point.x}%`, '--causal-node-y': `${point.y}%`, '--causal-node-delay': `${index * 55}ms` } as CSSProperties} onClick={() => interactFor(index, causalNodes.length, { label: node.label, detail: node.mechanism, value: stateLabel || node.effect || node.label, signal: 'complete' })} disabled={isDownstream} key={node.id}>
              <span className="causal-flux-node-mark" aria-hidden="true"><i /></span><small>{roleLabel}</small><strong><FormulaText>{node.label}</FormulaText></strong>{stateLabel && <em>{stateLabel}</em>}
            </button>
          })}
          <div className="causal-flux-state-transform" key={`state-${scene.id}-${activeIndex}-${causalBlocked ? 'blocked' : 'flow'}`} aria-live="polite">
            <span className="causal-flux-state-token causal-flux-state-token--before"><i aria-hidden="true" /><small>{tr('前一状态', 'Before')}</small><strong title={stateBefore}><FormulaText>{stateBefore}</FormulaText></strong></span>
            <span className="causal-flux-state-arrow" aria-hidden="true"><ArrowRight size={18} /></span>
            <span className="causal-flux-state-token causal-flux-state-token--after"><i aria-hidden="true" /><small>{causalBlocked ? tr('未形成', 'Blocked') : tr('可观察变化', 'After')}</small><strong title={causalBlocked ? payload?.blockers[0] || stateAfter : stateAfter}><FormulaText>{causalBlocked ? payload?.blockers[0] || stateAfter : stateAfter}</FormulaText></strong></span>
          </div>
        </div>
        <aside className="causal-flux-insight"><div><span><FormulaText>{focused?.label || activeBeat?.label || scene.title}{stateChange ? ` · ${stateChange}` : ''}</FormulaText></span><strong><FormulaText>{currentExplanation}</FormulaText></strong></div><nav className="causal-flux-actions" aria-label={tr('机制控制', 'Mechanism controls')}>{payload?.blockers[0] && <button type="button" className={causalBlocked ? 'active' : ''} aria-pressed={causalBlocked} onClick={() => { const blocked = !causalBlocked; setCausalBlocked(blocked); onInteraction?.({ kind, label: blocked ? tr('因果链已被阻断', 'Causal chain blocked') : tr('因果链已恢复', 'Causal chain restored'), detail: blocked ? payload.blockers[0] : payload.outcome || scene.key_point, value: blocked ? tr('结果未形成', 'Outcome prevented') : payload.outcome || scene.key_point, signal: blocked ? 'blocked' : 'complete' }) }}><ShieldAlert size={14} />{causalBlocked ? tr('恢复流动', 'Restore flow') : tr('切断条件', 'Cut condition')}</button>}<button type="button" className="causal-flux-replay" onClick={replay}><RotateCcw size={14} />{tr('从头观察', 'Replay')}</button></nav></aside>
      </div>
    )
  }

  if (kind === 'timeline-river') {
    const payload = scene.scene_payload?.kind === kind ? scene.scene_payload : null
    const events = payload?.events?.length ? payload.events.slice(0, 7) : nodes.map((node, index) => ({ id: node.id, marker: node.role || `${index + 1}`, title: node.label, change: activeBeat?.detail || scene.narration, impact: scene.key_point, is_turning_point: false }))
    const activeIndex = focusIndex(events)
    const focused = events[activeIndex]
    const activeX = 7 + activeIndex * (86 / Math.max(1, events.length - 1))
    const activeY = activeIndex % 3 === 0 ? 54 : activeIndex % 3 === 1 ? 28 : 68
    return (
      <div className={`universal-scene timeline-river-scene ${motionClass} ${storyboardSurfaceClass}`} style={{ '--timeline-x': `${activeX}%`, '--timeline-y': `${activeY}%` } as CSSProperties} data-motion={motionAction}>
        <SubjectStageScaffold mood={sceneMood} />
        <div className="timeline-river-heading"><Timer size={22} /><strong><FormulaText>{payload?.period_label || scene.visual.headline || scene.title}</FormulaText></strong><span><FormulaText>{scene.stage?.focal_question}</FormulaText></span></div>
        <div className="timeline-river-flow">
          <svg viewBox="0 0 1000 260" preserveAspectRatio="none" aria-hidden="true"><path d="M20 150 C180 40 260 235 430 128 C610 18 720 238 980 92" /><path className="active" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - progress} d="M20 150 C180 40 260 235 430 128 C610 18 720 238 980 92" /></svg>
          <i className="timeline-advance-signal" aria-hidden="true" />
          {events.map((event, index) => {
            const x = 7 + index * (86 / Math.max(1, events.length - 1))
            const y = index % 3 === 0 ? 54 : index % 3 === 1 ? 28 : 68
            return <button type="button" className={`${index === activeIndex ? 'active motion-target' : index < activeIndex ? 'visited' : ''}${event.is_turning_point ? ' turning-point' : ''} ${storyboardAtomClass(event, index === activeIndex)}`} style={{ '--river-x': `${x}%`, '--river-y': `${y}%` } as CSSProperties} onClick={() => interactFor(index, events.length, { label: event.title, detail: event.impact, value: event.change, signal: 'complete' })} key={event.id}><i>{event.is_turning_point ? '↗' : index + 1}</i><small><FormulaText>{event.marker || tr('阶段', 'Stage')}</FormulaText></small><strong><FormulaText>{event.title}</FormulaText></strong></button>
          })}
        </div>
        <div className="timeline-river-caption"><span><FormulaText>{focused?.title || activeBeat?.label || scene.title}</FormulaText></span><p><b>{tr('变化：', 'Change: ')}</b><FormulaText>{focused?.change || activeBeat?.detail || scene.narration}</FormulaText><br /><small>{tr('阶段影响：', 'Impact: ')}<FormulaText>{focused?.impact || payload?.retrospective || scene.key_point}</FormulaText></small></p></div>
      </div>
    )
  }

  if (kind === 'comparison-studio') {
    const payload = scene.scene_payload?.kind === kind ? scene.scene_payload : null
    const midpoint = Math.max(1, Math.ceil(nodes.length / 2))
    const fallbackLeft = nodes.slice(0, midpoint)
    const fallbackRight = nodes.slice(midpoint)
    const dimensions: ComparisonDimension[] = payload?.dimensions?.length ? payload.dimensions.slice(0, 6) : fallbackLeft.map((item, index) => ({ label: item.role || `${tr('维度', 'Dimension')} ${index + 1}`, left: item.label, right: fallbackRight[index]?.label || scene.key_point, deciding_factor: scene.narration }))
    const activeComparisonIndex = focusIndex(dimensions)
    const selected = dimensions[activeComparisonIndex]
    const choose = (side: 'left' | 'right') => {
      const title = side === 'left' ? payload?.left_title || scene.visual.before || tr('对象 A', 'Option A') : payload?.right_title || scene.visual.after || tr('对象 B', 'Option B')
      rememberStoryboardAtom(title)
      onInteraction?.({ kind, label: title, detail: selected?.deciding_factor || scene.key_point, value: side, signal: 'complete' })
      setComparisonFocus(side)
      moveTo(side === 'left' ? 0 : Math.max(0, beats.length - 1))
    }
    const chooseDimension = (index: number) => {
      const dimension = dimensions[index]
      interactFor(index, dimensions.length, { label: dimension.label, detail: dimension.deciding_factor, value: `${dimension.left} / ${dimension.right}`, signal: 'complete' })
    }
    if (looksLikeCacheComparison(scene, dimensions)) {
      return <CacheComparisonLab scene={scene} dimensions={dimensions} activeIndex={activeComparisonIndex} comparisonFocus={comparisonFocus} motionClass={motionClass} motionAction={motionAction} storyboardSurfaceClass={storyboardSurfaceClass} storyboardAtomClass={storyboardAtomClass} onExplore={rememberStoryboardAtom} choose={choose} chooseDimension={chooseDimension} tr={tr} />
    }
    const leftTitle = payload?.left_title || scene.visual.before || fallbackLeft[0]?.label || scene.title
    const rightTitle = payload?.right_title || scene.visual.after || fallbackRight[0]?.label || scene.key_point
    return (
      <div className={`universal-scene comparison-decision-stage focus-${comparisonFocus} ${motionClass} ${storyboardSurfaceClass}`} style={{ '--comparison-bias': comparisonFocus === 'left' ? '-1' : '1' } as CSSProperties} data-motion={motionAction}>
        <SubjectStageScaffold mood={sceneMood} />
        <div className="comparison-decision-halo" aria-hidden="true" />
        <button type="button" className={`comparison-candidate left ${storyboardAtomClass({ label: leftTitle }, comparisonFocus === 'left')}`} onClick={() => choose('left')} aria-pressed={comparisonFocus === 'left'}><Scale size={21} /><span>{tr('方案 A', 'Option A')}</span><strong><FormulaText>{leftTitle}</FormulaText></strong><i><FormulaText>{selected?.left || tr('等待对比', 'Ready to compare')}</FormulaText></i></button>
        <section className="comparison-decision-core" aria-label={tr('对比决策台', 'Comparison decision desk')}>
          <div className="comparison-condition"><span>{tr('保持不变', 'Held constant')}</span><strong><FormulaText>{payload?.shared_condition || scene.visual.headline}</FormulaText></strong></div>
          <div className="comparison-balance" aria-hidden="true"><i /><span><Sparkles size={16} /></span></div>
          <div className="comparison-focus-readout"><small><FormulaText>{selected?.label || tr('当前维度', 'Current dimension')}</FormulaText></small><strong><FormulaText>{selected?.deciding_factor || activeBeat?.detail || scene.key_point}</FormulaText></strong></div>
          <nav aria-label={tr('选择比较维度', 'Select comparison dimension')}>{dimensions.slice(0, 5).map((item, index) => <button type="button" className={`${index === activeComparisonIndex ? 'active motion-target' : ''} ${storyboardAtomClass(item, index === activeComparisonIndex)}`} aria-pressed={index === activeComparisonIndex} onClick={() => chooseDimension(index)} key={item.id || item.label}><FormulaText>{item.label}</FormulaText></button>)}</nav>
        </section>
        <button type="button" className={`comparison-candidate right ${storyboardAtomClass({ label: rightTitle }, comparisonFocus === 'right')}`} onClick={() => choose('right')} aria-pressed={comparisonFocus === 'right'}><Waypoints size={21} /><span>{tr('方案 B', 'Option B')}</span><strong><FormulaText>{rightTitle}</FormulaText></strong><i><FormulaText>{selected?.right || tr('等待对比', 'Ready to compare')}</FormulaText></i></button>
        <footer className="comparison-verdict"><Check size={15} /><strong><FormulaText>{payload?.recommendation || selected?.deciding_factor || activeBeat?.detail || scene.narration}</FormulaText></strong></footer>
      </div>
    )
  }

  if (kind === 'system-network') {
    const payload = scene.scene_payload?.kind === kind ? scene.scene_payload : null
    const networkNodes = payload?.nodes?.length ? payload.nodes.slice(0, 7) : nodes.map(node => ({ ...node, detail: scene.key_point }))
    const activeIndex = focusIndex(networkNodes)
    const positions = new Map(networkNodes.map((node, index) => [node.id, networkPositions[index % networkPositions.length]]))
    const networkEdges = payload?.edges?.length ? payload.edges : networkNodes.slice(1).map((node, index) => ({ from: networkNodes[index].id, to: node.id, label: tr('传递', 'Transfer') }))
    const focused = networkNodes.find(node => node.id === networkFocusId) || networkNodes[Math.min(activeIndex, networkNodes.length - 1)]
    const tracedEdges = reachableEdges(networkEdges, focused?.id || networkNodes[0]?.id || '')
    const focusedPoint = positions.get(focused?.id) || networkPositions[0]
    return (
      <div className={`universal-scene system-network-scene ${motionClass} ${storyboardSurfaceClass}`} data-motion={motionAction}>
        <SubjectStageScaffold mood={sceneMood} />
        <header><Network size={22} /><strong><FormulaText>{scene.visual.headline || scene.title}</FormulaText></strong><span>{tr('输入', 'Input')} · <FormulaText>{payload?.inputs.join(' / ') || scene.stage?.focal_question}</FormulaText></span></header>
        <div className="system-network-field">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{networkEdges.map((edge, index) => { const from = positions.get(edge.from); const to = positions.get(edge.to); return from && to ? <g className={tracedEdges.has(index) ? 'trace-active' : ''} key={`${edge.from}-${edge.to}-${index}`}><line className={tracedEdges.has(index) ? 'active' : ''} x1={from.x} y1={from.y} x2={to.x} y2={to.y} /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2}>{edge.label}</text></g> : null })}{payload?.feedback_loops.map((edge, index) => { const from = positions.get(edge.from); const to = positions.get(edge.to); return from && to ? <line className={`feedback${focused?.id === edge.from ? ' active' : ''}`} strokeDasharray="2 2" x1={from.x} y1={from.y} x2={to.x} y2={to.y} key={`feedback-${index}`} /> : null })}</svg>
          {networkNodes.map((node, index) => { const point = networkPositions[index % networkPositions.length]; const isFocused = node.id === focused?.id; const downstream = networkEdges.filter(edge => edge.from === node.id).map(edge => networkNodes.find(item => item.id === edge.to)?.label || edge.to).join(' → '); return <button type="button" className={`${isFocused ? 'active motion-target' : tracedEdges.size && [...tracedEdges].some(edgeIndex => networkEdges[edgeIndex]?.to === node.id) ? 'visited' : ''} ${storyboardAtomClass(node, isFocused)}`} style={{ '--network-x': `${point.x}%`, '--network-y': `${point.y}%` } as CSSProperties} onClick={() => { setNetworkFocusId(node.id); interactFor(index, networkNodes.length, { label: node.label, detail: node.detail, value: downstream || payload?.outputs.join(' / ') || scene.key_point, signal: 'complete' }) }} key={node.id}><i>{isFocused ? <Sparkles size={15} /> : <CircleDot size={13} />}</i><small>{node.role || tr('节点', 'Node')}</small><strong><FormulaText>{node.label}</FormulaText></strong></button> })}
          <div className="network-pulse" style={{ '--network-x': `${focusedPoint.x}%`, '--network-y': `${focusedPoint.y}%` } as CSSProperties}><ArrowRight size={15} /></div>
        </div>
        <aside><span><FormulaText>{focused?.label || activeBeat?.label}</FormulaText></span><strong><FormulaText>{focused?.detail || activeBeat?.detail || scene.narration}</FormulaText></strong><small>{tr('输出', 'Output')} · <FormulaText>{payload?.outputs.join(' / ') || scene.key_point}</FormulaText></small></aside>
      </div>
    )
  }

  if (kind === 'state-machine') {
    const payload = scene.scene_payload?.kind === kind ? scene.scene_payload : null
    const states = payload?.states?.length ? payload.states.slice(0, 7) : nodes.map(node => ({ id: node.id, label: node.label, description: node.role || scene.narration }))
    const activeIndex = focusIndex(states)
    const routeLayout = stageRoutePositions(states.length)
    const statePositions = new Map(states.map((state, index) => [state.id, routeLayout[index % routeLayout.length]]))
    const transitions = payload?.transitions?.length ? payload.transitions : states.slice(1).map((state, index) => ({ from: states[index].id, to: state.id, trigger: tr('条件满足', 'Condition met'), effect: state.description }))
    const focused = states.find(state => state.id === selectedStateId) || states[Math.min(activeIndex, states.length - 1)]
    const focusedTransition = transitions.find(item => item.from === focused?.id) || transitions[Math.min(activeIndex, transitions.length - 1)]
    const movingTransition = transitions.find(item => item.from === activeBeat?.from && item.to === activeBeat?.to) || focusedTransition
    const transitionTo = movingTransition ? statePositions.get(movingTransition.to) : undefined
    const routeRunnerPoint = transitionTo || statePositions.get(focused?.id || '') || stateRoutePositions[0]
    return (
      <div className={`universal-scene state-route-stage ${motionClass}${showExceptionPath ? ' exception-open' : ''} ${storyboardSurfaceClass}`} data-motion={motionAction} aria-label={tr('状态切换路线', 'State transition route')}>
        <SubjectStageScaffold mood={sceneMood} />
        <header className="state-route-heading"><CircleDot size={18} /><strong><FormulaText>{scene.visual.headline || scene.title}</FormulaText></strong><span><FormulaText>{scene.stage?.focal_question}</FormulaText></span></header>
        <div className="state-route-field">
          <div className="state-route-wash" aria-hidden="true" />
          <svg className="state-route-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path className="state-route-guide" d="M 8 57 C 22 16, 41 18, 55 29 S 78 37, 87 70 C 72 91, 37 90, 18 72" />
            {transitions.map((transition, index) => {
              const from = statePositions.get(transition.from)
              const to = statePositions.get(transition.to)
              const active = transition.from === focused?.id || (transition.from === movingTransition?.from && transition.to === movingTransition?.to)
              return from && to ? <g className={active ? 'active' : ''} key={`${transition.from}-${transition.to}-${index}`}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2}>{transition.trigger}</text></g> : null
            })}
            {payload?.exception_paths.map((transition, index) => {
              const from = statePositions.get(transition.from)
              const to = statePositions.get(transition.to)
              return from && to ? <g className={showExceptionPath ? 'exception active' : 'exception'} key={`exception-${index}`}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2}>{transition.trigger}</text></g> : null
            })}
          </svg>
          <div className="state-route-current" aria-live="polite"><span>{tr('当前停靠', 'Current stop')}</span><strong><FormulaText>{focused?.label || activeBeat?.label || scene.title}</FormulaText></strong><small><FormulaText>{focusedTransition?.trigger || tr('等待条件', 'Waiting for condition')}</FormulaText></small></div>
          <i className="state-route-runner" style={{ '--state-runner-x': `${routeRunnerPoint.x}%`, '--state-runner-y': `${routeRunnerPoint.y}%` } as CSSProperties} aria-hidden="true"><ArrowRight size={15} /></i>
          {states.map((state, index) => {
            const point = routeLayout[index % routeLayout.length]
            const stateRole = state.id === payload?.initial_state ? tr('起始', 'Start') : payload?.terminal_states.includes(state.id) ? tr('终点', 'End') : tr('状态', 'State')
            const transition = transitions.find(item => item.from === state.id)
            return <button type="button" className={`${state.id === focused?.id ? 'active motion-target' : index < activeIndex ? 'visited' : ''} ${storyboardAtomClass(state, state.id === focused?.id)}`} style={{ '--state-x': `${point.x}%`, '--state-y': `${point.y}%`, '--state-delay': `${index * 55}ms` } as CSSProperties} onClick={() => { setSelectedStateId(state.id); setShowExceptionPath(false); interactFor(index, states.length, { label: state.label, detail: transition?.effect || state.description, value: transition?.trigger, signal: 'complete' }) }} key={state.id}><i>{stateRole}</i><strong><FormulaText>{state.label}</FormulaText></strong></button>
          })}
        </div>
        <footer className="state-route-caption"><div><span><FormulaText>{focusedTransition?.trigger || tr('触发条件', 'Trigger')}</FormulaText></span><strong><FormulaText>{showExceptionPath ? payload?.exception_paths[0]?.effect : focusedTransition?.effect || focused?.description || scene.narration}</FormulaText></strong></div>{payload?.exception_paths.length ? <button type="button" className={showExceptionPath ? 'active' : ''} aria-pressed={showExceptionPath} onClick={() => { const showing = !showExceptionPath; setShowExceptionPath(showing); const exception = payload.exception_paths[0]; onInteraction?.({ kind, label: showing ? tr('异常路径', 'Exception route') : tr('主路线', 'Main route'), detail: showing ? exception.effect : focusedTransition?.effect || scene.key_point, value: showing ? exception.trigger : focusedTransition?.trigger, signal: showing ? 'boundary' : 'complete' }) }}><ShieldAlert size={14} />{showExceptionPath ? tr('回到主路线', 'Return to main route') : tr('查看异常路径', 'View exception')}</button> : null}</footer>
      </div>
    )
  }

  if (kind === 'parameter-lab') {
    const responsePoints = parameterPayload?.response_points || []
    const response = responsePoints.length ? responsePoints.reduce((closest, point) => Math.abs(point.value - parameterValue) < Math.abs(closest.value - parameterValue) ? point : closest) : undefined
    const reachedThresholds = parameterPayload?.thresholds.filter(item => parameterValue >= item.value) || []
    const threshold = reachedThresholds[reachedThresholds.length - 1] || parameterPayload?.thresholds[0]
    const stable = parameterPayload ? parameterValue >= parameterPayload.stable_range.min && parameterValue <= parameterPayload.stable_range.max : false
    const setParameter = (value: number) => {
      const nextRatio = inputMax === inputMin ? .5 : (value - inputMin) / (inputMax - inputMin)
      setParameterValue(value)
      const nearest = responsePoints.length ? responsePoints.reduce((closest, point) => Math.abs(point.value - value) < Math.abs(closest.value - value) ? point : closest) : undefined
      rememberStoryboardAtom(nearest?.label || parameterPayload?.parameter_label || scene.simulation?.input_label || scene.visual.headline || scene.title)
      onInteraction?.({ kind, label: `${parameterPayload?.parameter_label || scene.simulation?.input_label || tr('参数', 'Parameter')} = ${value}${parameterPayload?.unit || ''}`, detail: nearest?.result || scene.key_point, value: nearest?.label, signal: value === inputMin || value === inputMax ? 'boundary' : 'complete' })
      moveTo(beatIndex(Math.round(nextRatio * Math.max(1, (parameterPayload?.response_points.length || nodes.length) - 1)), Math.max(1, parameterPayload?.response_points.length || nodes.length), beats))
    }
    return (
      <div className={`universal-scene parameter-lab-scene ${motionClass} ${storyboardSurfaceClass}`} style={{ '--parameter-ratio': parameterRatio } as CSSProperties} data-motion={motionAction}>
        <SubjectStageScaffold mood={sceneMood} />
        <section className={`parameter-control-bench ${storyboardAtomClass({ label: parameterPayload?.parameter_label || scene.simulation?.input_label || scene.visual.headline || scene.title })}`}><SlidersHorizontal size={25} /><strong>{parameterPayload?.parameter_label || scene.simulation?.input_label || scene.visual.headline || tr('条件参数', 'Condition')}</strong><label><span>{inputMin}{parameterPayload?.unit}</span><input type="range" min={inputMin} max={inputMax} value={parameterValue} onChange={event => setParameter(Number(event.target.value))} /><span>{inputMax}{parameterPayload?.unit}</span></label><b>{parameterValue}<small>{parameterPayload?.unit}</small></b><p>{threshold?.effect || scene.simulation?.experiment?.description || scene.stage?.focal_question}</p>{parameterPayload && <em className={stable ? 'stable' : ''}>{stable ? parameterPayload.stable_range.label : threshold?.label}</em>}</section>
        <section className="parameter-response-field"><div className="parameter-wave"><i /><i /><i /><span />{parameterPayload?.response_points.map(point => { const ratio = (point.value - inputMin) / Math.max(1, inputMax - inputMin); return <button type="button" className={`${response === point ? 'active motion-target' : ''} ${storyboardAtomClass(point, response === point)}`} style={{ '--point-x': `${ratio * 100}%` } as CSSProperties} onClick={() => setParameter(point.value)} key={`${point.value}-${point.label}`}><small>{point.value}</small><strong>{point.label}</strong></button> })}</div><div><small>{tr('实时响应', 'Live response')}</small><strong>{response?.result || activeBeat?.value || scene.visual.after || scene.key_point}</strong><p>{response ? `${response.label} · ${threshold?.effect || response.result}` : activeBeat?.detail || scene.narration}</p></div></section>
      </div>
    )
  }

  const payload = scene.scene_payload?.kind === 'case-lab' ? scene.scene_payload : null
  const evidenceCandidates = [
    ...(payload?.evidence || []),
    ...nodes.map(node => ({ id: `zone-${node.id}`, label: node.label, detail: node.role || scene.narration, supports: scene.key_point })),
    ...(payload?.reasoning_steps || []).map((detail, index) => ({ id: `reasoning-${index + 1}`, label: tr(`推理线索 ${index + 1}`, `Reasoning cue ${index + 1}`), detail, supports: payload?.conclusion || scene.key_point })),
  ]
  const seenEvidenceLabels = new Set<string>()
  const evidence = evidenceCandidates.filter(item => {
    const key = item.label.trim().toLocaleLowerCase()
    if (!key || seenEvidenceLabels.has(key)) return false
    seenEvidenceLabels.add(key)
    return true
  // Four clear, material pieces of evidence communicate an argument better
  // than six tiny labels.  The remaining detail stays available in the active
  // cue and the counterexample, rather than compressing the stage into a wall
  // of text.
  }).slice(0, 4)
  const activeIndex = focusIndex(evidence)
  const focusedEvidence = evidence[activeIndex]
  const evidenceNeeded = Math.min(evidence.length, Math.max(2, Math.min(4, Math.ceil(evidence.length * .6))))
  const conclusionReady = openedEvidenceIds.length >= evidenceNeeded
  const dossierLayout = stageDossierPositions(evidence.length)
  const counterEvidence = payload?.counterevidence[0] || tr('回到原始条件核对：它不成立时，当前结论就不能直接套用。', 'Return to the original condition: if it fails, the conclusion cannot be applied directly.')
  const conclusion = payload?.conclusion || focusedEvidence?.supports || scene.key_point
  const evidenceReadiness = evidenceNeeded ? Math.min(1, openedEvidenceIds.length / evidenceNeeded) : 0
  const focalQuestion = scene.stage?.focal_question || scene.key_point
  const compactQuestion = compactCaseLabel(focalQuestion, tr('当前问题', 'Current question'))
  const compactConclusion = compactCaseLabel(conclusion, tr('等待证据汇流', 'Waiting for evidence'))
  return (
    <div className={`universal-scene case-dossier-stage case-evidence-theater case-evidence-runway ${motionClass}${conclusionReady ? ' conclusion-ready' : ''} ${counterEvidenceOpen ? ' counterevidence-open' : ''} ${storyboardSurfaceClass}`} data-motion={motionAction} style={{ '--case-readiness': evidenceReadiness } as CSSProperties} aria-label={tr('案例证据推演台', 'Case evidence reasoning desk')}>
      <header className="case-dossier-heading">
        <div><BookOpenCheck size={18} /><strong>{scene.visual.headline || scene.title}</strong></div>
        <span>{payload?.background || scene.stage?.focal_question}</span>
        <small>{tr(`证据 ${Math.min(openedEvidenceIds.length, evidenceNeeded)}/${evidenceNeeded || 0}`, `Evidence ${Math.min(openedEvidenceIds.length, evidenceNeeded)}/${evidenceNeeded || 0}`)}</small>
      </header>
      <div className="case-dossier-field">
        <div className="case-evidence-camera">
          <div className="case-evidence-world">
        <svg className="case-evidence-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {evidence.map((item, index) => {
            const point = dossierLayout[index % dossierLayout.length]
            const opened = openedEvidenceIds.includes(item.id)
            const route = dossierRoutePath(point, index)
            const signalDuration = Math.max(1.8, Math.min(5, (activeBeat?.duration_ms || 3200) / 1000))
            return <g key={item.id}>
              <path className="case-route-base" d={route} />
              <path className={`${opened ? 'opened' : ''}${index === activeIndex ? ' active' : ''}`} pathLength="100" d={route} />
              <circle className="case-route-origin" cx={point.x + 6} cy={point.y} r=".7" />
              {index === activeIndex && <circle className="case-route-signal" cx="0" cy="0" r="1.12"><animateMotion path={route} dur={`${signalDuration}s`} fill="freeze" /></circle>}
            </g>
          })}
        </svg>
        <section className="case-question-anchor" title={focalQuestion}><span>{tr('待回答的问题', 'Question to resolve')}</span><strong>{compactQuestion}</strong><i aria-hidden="true" /></section>
        <section className="case-verdict-hub" aria-live="polite">
          <i>{conclusionReady ? <Check size={26} /> : <Search size={26} />}</i>
          <span>{conclusionReady ? tr('判断已形成', 'Verdict formed') : tr('证据正在汇入', 'Evidence converging')}</span>
          <strong title={conclusionReady ? conclusion : undefined}>{conclusionReady ? compactConclusion : tr(`还需核验 ${Math.max(0, evidenceNeeded - openedEvidenceIds.length)} 条关键依据`, `${Math.max(0, evidenceNeeded - openedEvidenceIds.length)} more key cues`)}</strong>
          <small>{focusedEvidence?.supports || scene.key_point}</small>
          <em aria-hidden="true"><b /><b /><b /><b /></em>
        </section>
        <div className="case-evidence-scatter">
          {evidence.map((item, index) => {
            const opened = openedEvidenceIds.includes(item.id)
            const position = dossierLayout[index % dossierLayout.length]
            const compactLabel = compactCaseLabel(item.label, tr(`线索 ${index + 1}`, `Cue ${index + 1}`))
            return <button type="button" className={`${index === activeIndex ? 'active motion-target' : ''}${opened ? ' opened' : ''} ${storyboardAtomClass(item, index === activeIndex)}`} style={{ '--dossier-x': `${position.x}%`, '--dossier-y': `${position.y}%`, '--dossier-rotation': `${position.rotation}deg`, '--dossier-delay': `${index * 60}ms`, '--dossier-order': index } as CSSProperties} aria-label={`${opened ? tr('已核验', 'Checked') : tr('核验证据', 'Check evidence')}：${item.label}`} aria-pressed={opened} onClick={() => { rememberStoryboardAtom(item); const nextOpened = opened ? openedEvidenceIds : [...openedEvidenceIds, item.id]; setOpenedEvidenceIds(nextOpened); const unlocked = nextOpened.length >= evidenceNeeded; interactFor(index, evidence.length, { label: unlocked ? tr('证据链已完成', 'Evidence chain complete') : item.label, detail: unlocked ? conclusion : item.detail, value: unlocked ? counterEvidence : item.supports, signal: unlocked ? 'complete' : 'incomplete' }) }} key={item.id}><i>{opened ? <Check size={15} /> : <Search size={15} />}</i><span><small>{opened ? tr('已核验', 'Checked') : `${tr('线索', 'Cue')} ${String(index + 1).padStart(2, '0')}`}</small><strong title={item.label}>{compactLabel}</strong></span></button>
          })}
        </div>
        <button type="button" className="case-countercheck" aria-pressed={counterEvidenceOpen} onClick={() => { const next = !counterEvidenceOpen; setCounterEvidenceOpen(next); onInteraction?.({ kind, label: next ? tr('正在核对反证条件', 'Checking counterevidence') : tr('收起反证条件', 'Hide counterevidence'), detail: counterEvidence, value: scene.key_point, signal: next ? 'boundary' : 'complete' }) }}><ShieldAlert size={16} /><span>{tr('反证边界', 'Boundary check')}</span><strong>{counterEvidence}</strong><em>{counterEvidenceOpen ? tr('收起', 'Hide') : tr('查看', 'Inspect')}</em></button>
          </div>
        </div>
      </div>
      <footer className="case-evidence-footer"><div><span>{focusedEvidence?.label || activeBeat?.label || tr('当前证据', 'Current evidence')}</span><strong>{focusedEvidence?.detail || activeBeat?.detail || scene.visual.example || scene.narration}</strong></div><i aria-hidden="true"><b style={{ '--case-progress': evidenceReadiness } as CSSProperties} /></i></footer>
    </div>
  )
}
