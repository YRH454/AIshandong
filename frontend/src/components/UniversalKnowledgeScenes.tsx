import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  ArrowRight,
  Atom,
  BookOpenCheck,
  Check,
  CircleDot,
  GitBranch,
  Network,
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

type UniversalActor = {
  id: string
  label: string
  role?: string
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

export function UniversalKnowledgeScene(props: UniversalKnowledgeSceneProps) {
  const { kind, scene, actors, beats, safeStep, activeBeat, progress, moveTo, tr, onInteraction } = props
  const [comparisonFocus, setComparisonFocus] = useState<'left' | 'right'>('left')
  const [causalBlocked, setCausalBlocked] = useState(false)
  const [networkFocusId, setNetworkFocusId] = useState<string | null>(null)
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null)
  const [showExceptionPath, setShowExceptionPath] = useState(false)
  const [openedEvidenceIds, setOpenedEvidenceIds] = useState<string[]>([])
  const parameterPayload = scene.scene_payload?.kind === 'parameter-lab' ? scene.scene_payload : null
  const inputMin = parameterPayload?.min ?? scene.simulation?.input_min ?? 0
  const inputMax = parameterPayload?.max ?? scene.simulation?.input_max ?? 100
  const initialInput = parameterPayload?.initial ?? scene.simulation?.initial_input ?? Math.round((inputMin + inputMax) / 2)
  const [parameterValue, setParameterValue] = useState(initialInput)
  const motionAction = activeBeat?.action ?? 'focus'
  const motionClass = `motion-${motionAction} motion-step-${safeStep % 4}`
  const parameterRatio = inputMax === inputMin ? .5 : (parameterValue - inputMin) / (inputMax - inputMin)
  const nodes = useMemo(() => {
    const source = actors.length >= 3 ? actors : scene.visual.items.map((label, index) => ({ id: `visual-${index}`, label, role: '' }))
    return source.slice(0, 7)
  }, [actors, scene.visual.items])
  const progressIndex = (count: number) => count ? Math.max(0, Math.min(count - 1, Math.round(progress * count) - 1)) : 0
  const focusIndex = (items: Array<{ id?: string; label?: string; title?: string }>) => {
    const target = activeBeat?.target
    if (target) {
      const matchingIndex = items.findIndex(item => item.id === target || item.label === target || item.title === target)
      if (matchingIndex >= 0) return matchingIndex
    }
    return progressIndex(items.length)
  }
  const interactFor = (index: number, count: number, outcome?: Omit<DynamicExplanationInteractionOutcome, 'kind'>) => {
    onInteraction?.(outcome ? { ...outcome, kind } : undefined)
    moveTo(beatIndex(index, Math.max(1, count), beats))
  }

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
      <div className={`universal-scene concept-constellation-scene ${motionClass}`} data-motion={motionAction}>
        <div className="constellation-field" style={constellationStyle} aria-label={tr('概念星图', 'Concept constellation')}>
          <div className="constellation-core"><Atom size={31} /><strong>{payload?.core || scene.visual.headline || scene.title}</strong><span>{payload?.core_detail || scene.key_point}</span></div>
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
            return <button type="button" className={`${index === activeIndex ? 'active motion-target' : index < activeIndex ? 'visited' : ''}`} style={{ '--node-x': `${point.x}%`, '--node-y': `${point.y}%`, '--node-delay': `${index * 55}ms`, '--node-origin-x': `${Math.round((50 - point.x) * 5.1)}px`, '--node-origin-y': `${Math.round((50 - point.y) * 4.4)}px` } as CSSProperties} onClick={() => interactFor(index, branches.length, { label: node.label, detail: node.detail, value: node.relation, signal: 'complete' })} key={node.id}><small>{node.relation || tr('关联概念', 'Related idea')}</small><strong>{node.label}</strong></button>
          })}
        </div>
        <aside className="universal-reading-strip"><CircleDot size={17} /><span>{focused?.label || activeBeat?.label || scene.title}</span><strong>{focused?.detail || activeBeat?.detail || scene.narration}</strong>{payload?.boundary_conditions[0] && <small>{tr('边界：', 'Boundary: ')}{payload.boundary_conditions[0]}</small>}</aside>
      </div>
    )
  }

  if (kind === 'causal-chain') {
    const payload = scene.scene_payload?.kind === kind ? scene.scene_payload : null
    const steps = payload?.steps?.length ? payload.steps.slice(0, 6) : nodes.map(node => ({ id: node.id, label: node.label, mechanism: node.role || scene.narration, effect: scene.key_point }))
    const activeIndex = focusIndex(steps)
    const focused = steps[activeIndex]
    return (
      <div className={`universal-scene causal-chain-scene ${motionClass}${causalBlocked ? ' is-blocked' : ''}`} data-motion={motionAction}>
        <header><GitBranch size={22} /><span>{scene.stage?.focal_question || scene.key_point}</span><b>{tr('触发：', 'Trigger: ')}{payload?.trigger || steps[0]?.label}</b></header>
        <div className="causal-chain-track">
          <i className="causal-progress" style={{ '--causal-progress': progress } as CSSProperties} />
          {steps.map((step, index) => <div className={`causal-link${causalBlocked && index > activeIndex ? ' blocked-downstream' : ''}`} key={step.id}>
            <button type="button" className={`${index === activeIndex ? 'active motion-target' : index < activeIndex ? 'visited' : ''}`} onClick={() => interactFor(index, steps.length, { label: step.label, detail: step.effect, value: step.mechanism, signal: 'complete' })}><small>{index === 0 ? tr('起因', 'Cause') : index === steps.length - 1 ? tr('收束', 'Resolution') : tr('机制', 'Mechanism')}</small><strong>{step.label}</strong><span>{step.mechanism}</span><em>{tr('产生：', 'Produces: ')}{step.effect}</em></button>
            {index < steps.length - 1 && <ArrowRight aria-hidden="true" />}
          </div>)}
        </div>
        <footer><strong>{focused?.label || activeBeat?.label || scene.visual.headline}</strong><p>{causalBlocked ? tr('链条在此处被阻断，后续结果不会继续发生。', 'The chain is interrupted here, so downstream effects stop.') : focused?.mechanism || activeBeat?.detail || scene.narration}</p><span>{tr('结果：', 'Outcome: ')}{causalBlocked ? tr('结果未形成', 'Outcome prevented') : payload?.outcome || scene.key_point}</span>{payload?.blockers[0] && <button type="button" className={causalBlocked ? 'active' : ''} aria-pressed={causalBlocked} onClick={() => { const blocked = !causalBlocked; setCausalBlocked(blocked); onInteraction?.({ kind, label: blocked ? tr('因果链已被阻断', 'Causal chain blocked') : tr('因果链已恢复', 'Causal chain restored'), detail: blocked ? payload.blockers[0] : payload.outcome || scene.key_point, value: blocked ? tr('结果未形成', 'Outcome prevented') : payload.outcome || scene.key_point, signal: blocked ? 'blocked' : 'complete' }) }}><ShieldAlert size={14} />{causalBlocked ? tr('恢复因果链', 'Restore chain') : `${tr('测试阻断：', 'Test blocker: ')}${payload.blockers[0]}`}</button>}</footer>
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
      <div className={`universal-scene timeline-river-scene ${motionClass}`} style={{ '--timeline-x': `${activeX}%`, '--timeline-y': `${activeY}%` } as CSSProperties} data-motion={motionAction}>
        <div className="timeline-river-heading"><Timer size={22} /><strong>{payload?.period_label || scene.visual.headline || scene.title}</strong><span>{scene.stage?.focal_question}</span></div>
        <div className="timeline-river-flow">
          <svg viewBox="0 0 1000 260" preserveAspectRatio="none" aria-hidden="true"><path d="M20 150 C180 40 260 235 430 128 C610 18 720 238 980 92" /><path className="active" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - progress} d="M20 150 C180 40 260 235 430 128 C610 18 720 238 980 92" /></svg>
          <i className="timeline-advance-signal" aria-hidden="true" />
          {events.map((event, index) => {
            const x = 7 + index * (86 / Math.max(1, events.length - 1))
            const y = index % 3 === 0 ? 54 : index % 3 === 1 ? 28 : 68
            return <button type="button" className={`${index === activeIndex ? 'active motion-target' : index < activeIndex ? 'visited' : ''}${event.is_turning_point ? ' turning-point' : ''}`} style={{ '--river-x': `${x}%`, '--river-y': `${y}%` } as CSSProperties} onClick={() => interactFor(index, events.length, { label: event.title, detail: event.impact, value: event.change, signal: 'complete' })} key={event.id}><i>{event.is_turning_point ? '↗' : index + 1}</i><small>{event.marker || tr('阶段', 'Stage')}</small><strong>{event.title}</strong></button>
          })}
        </div>
        <div className="timeline-river-caption"><span>{focused?.title || activeBeat?.label || scene.title}</span><p><b>{tr('变化：', 'Change: ')}</b>{focused?.change || activeBeat?.detail || scene.narration}<br /><small>{tr('阶段影响：', 'Impact: ')}{focused?.impact || payload?.retrospective || scene.key_point}</small></p></div>
      </div>
    )
  }

  if (kind === 'comparison-studio') {
    const payload = scene.scene_payload?.kind === kind ? scene.scene_payload : null
    const midpoint = Math.max(1, Math.ceil(nodes.length / 2))
    const fallbackLeft = nodes.slice(0, midpoint)
    const fallbackRight = nodes.slice(midpoint)
    const dimensions = payload?.dimensions?.length ? payload.dimensions.slice(0, 6) : fallbackLeft.map((item, index) => ({ label: item.role || `${tr('维度', 'Dimension')} ${index + 1}`, left: item.label, right: fallbackRight[index]?.label || scene.key_point, deciding_factor: scene.narration }))
    const activeComparisonIndex = focusIndex(dimensions)
    const selected = dimensions[activeComparisonIndex]
    const choose = (side: 'left' | 'right') => {
      const title = side === 'left' ? payload?.left_title || scene.visual.before || tr('对象 A', 'Option A') : payload?.right_title || scene.visual.after || tr('对象 B', 'Option B')
      onInteraction?.({ kind, label: title, detail: selected?.deciding_factor || scene.key_point, value: side, signal: 'complete' })
      setComparisonFocus(side)
      moveTo(side === 'left' ? 0 : Math.max(0, beats.length - 1))
    }
    const chooseDimension = (index: number) => {
      const dimension = dimensions[index]
      interactFor(index, dimensions.length, { label: dimension.label, detail: dimension.deciding_factor, value: `${dimension.left} / ${dimension.right}`, signal: 'complete' })
    }
    return (
      <div className={`universal-scene comparison-studio-scene focus-${comparisonFocus} ${motionClass}`} style={{ '--comparison-offset': comparisonFocus === 'left' ? '-8px' : '8px' } as CSSProperties} data-motion={motionAction}>
        <section><button type="button" onClick={() => choose('left')}><Scale size={20} /><span>{tr('对象 A', 'Option A')}</span><strong>{payload?.left_title || scene.visual.before || fallbackLeft[0]?.label || scene.title}</strong></button><div>{dimensions.map((item, index) => <button type="button" className={index === activeComparisonIndex ? 'active motion-target' : ''} onClick={() => chooseDimension(index)} key={`left-${item.label}`}><small>{item.label}</small><strong>{item.left}</strong></button>)}</div></section>
        <div className="comparison-axis"><span>{tr('共同条件', 'Shared condition')}</span><strong>{payload?.shared_condition || scene.visual.headline}</strong><i /><small>{selected?.deciding_factor || tr('决定差异的条件', 'The condition that changes the result')}</small></div>
        <section><button type="button" onClick={() => choose('right')}><Waypoints size={20} /><span>{tr('对象 B', 'Option B')}</span><strong>{payload?.right_title || scene.visual.after || fallbackRight[0]?.label || scene.key_point}</strong></button><div>{dimensions.map((item, index) => <button type="button" className={index === activeComparisonIndex ? 'active motion-target' : ''} onClick={() => chooseDimension(index)} key={`right-${item.label}`}><small>{item.label}</small><strong>{item.right}</strong></button>)}</div></section>
        <footer><Check size={15} />{payload?.recommendation || selected?.deciding_factor || activeBeat?.detail || scene.narration}</footer>
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
      <div className={`universal-scene system-network-scene ${motionClass}`} data-motion={motionAction}>
        <header><Network size={22} /><strong>{scene.visual.headline || scene.title}</strong><span>{tr('输入', 'Input')} · {payload?.inputs.join(' / ') || scene.stage?.focal_question}</span></header>
        <div className="system-network-field">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{networkEdges.map((edge, index) => { const from = positions.get(edge.from); const to = positions.get(edge.to); return from && to ? <g className={tracedEdges.has(index) ? 'trace-active' : ''} key={`${edge.from}-${edge.to}-${index}`}><line className={tracedEdges.has(index) ? 'active' : ''} x1={from.x} y1={from.y} x2={to.x} y2={to.y} /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2}>{edge.label}</text></g> : null })}{payload?.feedback_loops.map((edge, index) => { const from = positions.get(edge.from); const to = positions.get(edge.to); return from && to ? <line className={`feedback${focused?.id === edge.from ? ' active' : ''}`} strokeDasharray="2 2" x1={from.x} y1={from.y} x2={to.x} y2={to.y} key={`feedback-${index}`} /> : null })}</svg>
          {networkNodes.map((node, index) => { const point = networkPositions[index % networkPositions.length]; const isFocused = node.id === focused?.id; const downstream = networkEdges.filter(edge => edge.from === node.id).map(edge => networkNodes.find(item => item.id === edge.to)?.label || edge.to).join(' → '); return <button type="button" className={`${isFocused ? 'active motion-target' : tracedEdges.size && [...tracedEdges].some(edgeIndex => networkEdges[edgeIndex]?.to === node.id) ? 'visited' : ''}`} style={{ '--network-x': `${point.x}%`, '--network-y': `${point.y}%` } as CSSProperties} onClick={() => { setNetworkFocusId(node.id); interactFor(index, networkNodes.length, { label: node.label, detail: node.detail, value: downstream || payload?.outputs.join(' / ') || scene.key_point, signal: 'complete' }) }} key={node.id}><i>{isFocused ? <Sparkles size={15} /> : <CircleDot size={13} />}</i><small>{node.role || tr('节点', 'Node')}</small><strong>{node.label}</strong></button> })}
          <div className="network-pulse" style={{ '--network-x': `${focusedPoint.x}%`, '--network-y': `${focusedPoint.y}%` } as CSSProperties}><ArrowRight size={15} /></div>
        </div>
        <aside><span>{focused?.label || activeBeat?.label}</span><strong>{focused?.detail || activeBeat?.detail || scene.narration}</strong><small>{tr('输出', 'Output')} · {payload?.outputs.join(' / ') || scene.key_point}</small></aside>
      </div>
    )
  }

  if (kind === 'state-machine') {
    const payload = scene.scene_payload?.kind === kind ? scene.scene_payload : null
    const states = payload?.states?.length ? payload.states.slice(0, 7) : nodes.map(node => ({ id: node.id, label: node.label, description: node.role || scene.narration }))
    const activeIndex = focusIndex(states)
    const statePositions = new Map(states.map((state, index) => [state.id, orbitPositions[index % orbitPositions.length]]))
    const transitions = payload?.transitions?.length ? payload.transitions : states.slice(1).map((state, index) => ({ from: states[index].id, to: state.id, trigger: tr('条件满足', 'Condition met'), effect: state.description }))
    const focused = states.find(state => state.id === selectedStateId) || states[Math.min(activeIndex, states.length - 1)]
    const focusedTransition = transitions.find(item => item.from === focused?.id) || transitions[Math.min(activeIndex, transitions.length - 1)]
    const movingTransition = transitions.find(item => item.from === activeBeat?.from && item.to === activeBeat?.to) || focusedTransition
    const transitionFrom = movingTransition ? statePositions.get(movingTransition.from) : undefined
    const transitionTo = movingTransition ? statePositions.get(movingTransition.to) : undefined
    const stateTokenStyle = transitionFrom && transitionTo ? {
      '--state-token-x': `${transitionFrom.x}%`,
      '--state-token-y': `${transitionFrom.y}%`,
      '--state-token-dx': `${(transitionTo.x - transitionFrom.x) * .93}vw`,
      '--state-token-dy': `${(transitionTo.y - transitionFrom.y) * .5}vh`,
    } as CSSProperties : undefined
    return (
      <div className={`universal-scene state-machine-scene ${motionClass}`} data-motion={motionAction}>
        <header><CircleDot size={22} /><strong>{scene.visual.headline || scene.title}</strong><span>{scene.stage?.focal_question}</span></header>
        <div className="state-machine-loop">
          <svg className="state-transition-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{transitions.map((transition, index) => { const from = statePositions.get(transition.from); const to = statePositions.get(transition.to); const active = transition.from === focused?.id; return from && to ? <g className={active ? 'transition-active' : ''} key={`${transition.from}-${transition.to}-${index}`}><line className={active ? 'active' : ''} x1={from.x} y1={from.y} x2={to.x} y2={to.y} /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2}>{transition.trigger}</text></g> : null })}{payload?.exception_paths.map((transition, index) => { const from = statePositions.get(transition.from); const to = statePositions.get(transition.to); return from && to ? <g className={showExceptionPath ? 'exception-active' : ''} key={`exception-${index}`}><line className={`exception${showExceptionPath ? ' active' : ''}`} strokeDasharray="2 2" x1={from.x} y1={from.y} x2={to.x} y2={to.y} /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2}>{transition.trigger}</text></g> : null })}</svg>
          <div className="state-machine-core"><span>{tr('当前状态', 'Current state')}</span><strong>{focused?.label || activeBeat?.label}</strong><p>{focused?.description || activeBeat?.detail || scene.narration}</p>{focusedTransition && <small>{tr('触发：', 'Trigger: ')}{focusedTransition.trigger}<br />{tr('转为：', 'Next: ')}{states.find(item => item.id === focusedTransition.to)?.label || focusedTransition.to}</small>}</div>
          {stateTokenStyle && <i className="state-transition-token" style={stateTokenStyle} aria-hidden="true"><CircleDot size={15} /></i>}
          {states.map((state, index) => { const point = orbitPositions[index % orbitPositions.length]; const stateRole = state.id === payload?.initial_state ? tr('初始状态', 'Initial') : payload?.terminal_states.includes(state.id) ? tr('终止状态', 'Terminal') : tr('状态', 'State'); const transition = transitions.find(item => item.from === state.id); return <button type="button" className={state.id === focused?.id ? 'active motion-target' : index < activeIndex ? 'visited' : ''} style={{ '--state-x': `${point.x}%`, '--state-y': `${point.y}%` } as CSSProperties} onClick={() => { setSelectedStateId(state.id); setShowExceptionPath(false); interactFor(index, states.length, { label: state.label, detail: transition?.effect || state.description, value: transition?.trigger, signal: 'complete' }) }} key={state.id}><small>{stateRole}</small><strong>{state.label}</strong></button> })}
        </div>
        <footer><GitBranch size={17} /><span>{showExceptionPath ? payload?.exception_paths[0]?.effect : focusedTransition?.effect || tr('选择任意状态，查看触发条件和下一步变化。', 'Choose a state to inspect its trigger and next transition.')}</span>{payload?.exception_paths.length ? <button type="button" className={showExceptionPath ? 'active' : ''} aria-pressed={showExceptionPath} onClick={() => { const showing = !showExceptionPath; setShowExceptionPath(showing); const exception = payload.exception_paths[0]; onInteraction?.({ kind, label: showing ? tr('异常分支', 'Exception path') : tr('正常路径', 'Normal path'), detail: showing ? exception.effect : focusedTransition?.effect || scene.key_point, value: showing ? exception.trigger : focusedTransition?.trigger, signal: showing ? 'boundary' : 'complete' }) }}><ShieldAlert size={14} />{showExceptionPath ? tr('返回正常路径', 'Show normal path') : tr('查看异常分支', 'Inspect exception')}</button> : null}</footer>
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
      onInteraction?.({ kind, label: `${parameterPayload?.parameter_label || scene.simulation?.input_label || tr('参数', 'Parameter')} = ${value}${parameterPayload?.unit || ''}`, detail: nearest?.result || scene.key_point, value: nearest?.label, signal: value === inputMin || value === inputMax ? 'boundary' : 'complete' })
      moveTo(beatIndex(Math.round(nextRatio * Math.max(1, (parameterPayload?.response_points.length || nodes.length) - 1)), Math.max(1, parameterPayload?.response_points.length || nodes.length), beats))
    }
    return (
      <div className={`universal-scene parameter-lab-scene ${motionClass}`} style={{ '--parameter-ratio': parameterRatio } as CSSProperties} data-motion={motionAction}>
        <section className="parameter-control-bench"><SlidersHorizontal size={25} /><strong>{parameterPayload?.parameter_label || scene.simulation?.input_label || scene.visual.headline || tr('条件参数', 'Condition')}</strong><label><span>{inputMin}{parameterPayload?.unit}</span><input type="range" min={inputMin} max={inputMax} value={parameterValue} onChange={event => setParameter(Number(event.target.value))} /><span>{inputMax}{parameterPayload?.unit}</span></label><b>{parameterValue}<small>{parameterPayload?.unit}</small></b><p>{threshold?.effect || scene.simulation?.experiment?.description || scene.stage?.focal_question}</p>{parameterPayload && <em className={stable ? 'stable' : ''}>{stable ? parameterPayload.stable_range.label : threshold?.label}</em>}</section>
        <section className="parameter-response-field"><div className="parameter-wave"><i /><i /><i /><span />{parameterPayload?.response_points.map(point => { const ratio = (point.value - inputMin) / Math.max(1, inputMax - inputMin); return <button type="button" className={response === point ? 'active motion-target' : ''} style={{ '--point-x': `${ratio * 100}%` } as CSSProperties} onClick={() => setParameter(point.value)} key={`${point.value}-${point.label}`}><small>{point.value}</small><strong>{point.label}</strong></button> })}</div><div><small>{tr('实时响应', 'Live response')}</small><strong>{response?.result || activeBeat?.value || scene.visual.after || scene.key_point}</strong><p>{response ? `${response.label} · ${threshold?.effect || response.result}` : activeBeat?.detail || scene.narration}</p></div></section>
      </div>
    )
  }

  const payload = scene.scene_payload?.kind === 'case-lab' ? scene.scene_payload : null
  const evidence = payload?.evidence?.length ? payload.evidence.slice(0, 7) : nodes.map(node => ({ id: node.id, label: node.label, detail: node.role || scene.narration, supports: scene.key_point }))
  const activeIndex = focusIndex(evidence)
  const focusedEvidence = evidence[activeIndex]
  const evidenceNeeded = Math.min(2, evidence.length)
  const conclusionReady = openedEvidenceIds.length >= evidenceNeeded
  return (
    <div className={`universal-scene case-lab-scene ${motionClass}${conclusionReady ? ' conclusion-ready' : ''}`} data-motion={motionAction}>
      <header><BookOpenCheck size={23} /><strong>{scene.visual.headline || scene.title}</strong><span>{scene.stage?.focal_question}</span></header>
      <div className="case-evidence-board">
        <section><p>{payload?.background}</p>{evidence.map((item, index) => { const opened = openedEvidenceIds.includes(item.id); return <button type="button" className={`${index === activeIndex ? 'active motion-target' : ''}${opened ? ' opened' : ''}`} aria-pressed={opened} onClick={() => { const nextOpened = opened ? openedEvidenceIds : [...openedEvidenceIds, item.id]; setOpenedEvidenceIds(nextOpened); const unlocked = nextOpened.length >= evidenceNeeded; interactFor(index, evidence.length, { label: unlocked ? tr('证据链已完成', 'Evidence chain complete') : item.label, detail: unlocked ? payload?.conclusion || item.supports || scene.key_point : item.detail, value: unlocked ? payload?.counterevidence[0] : item.supports, signal: unlocked ? 'complete' : 'incomplete' }) }} key={item.id}>{opened ? <Check size={16} /> : <Search size={16} />}<span><small>{opened ? tr('已核验证据', 'Verified evidence') : `${tr('证据', 'Evidence')} ${index + 1}`}</small><strong>{item.label}</strong></span></button> })}<small className="case-evidence-progress">{tr(`已核验 ${openedEvidenceIds.length}/${evidenceNeeded} 条关键证据`, `${openedEvidenceIds.length}/${evidenceNeeded} key evidence checked`)}</small></section>
        <ArrowRight className="case-verdict-arrow" size={28} />
        <aside><span>{conclusionReady ? tr('结论已解锁', 'Conclusion unlocked') : tr('正在核验证据', 'Checking evidence')}</span><strong>{conclusionReady ? payload?.conclusion || focusedEvidence?.supports || scene.key_point : focusedEvidence?.label || tr('请先打开证据', 'Open evidence first')}</strong><p>{focusedEvidence?.detail || activeBeat?.detail || scene.visual.example || scene.narration}</p>{payload?.reasoning_steps[activeIndex] && <small>{tr('推理：', 'Reasoning: ')}{payload.reasoning_steps[activeIndex]}</small>}<i>{conclusionReady ? <Check size={16} /> : <Search size={16} />}{conclusionReady && payload?.counterevidence[0] ? `${tr('反证检查：', 'Countercheck: ')}${payload.counterevidence[0]}` : tr(`还需核验 ${Math.max(0, evidenceNeeded - openedEvidenceIds.length)} 条关键证据`, `${Math.max(0, evidenceNeeded - openedEvidenceIds.length)} more evidence required`)}</i></aside>
      </div>
    </div>
  )
}
