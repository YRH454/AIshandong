import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CirclePause,
  CirclePlay,
  Code2,
  Eye,
  FlaskConical,
  GitBranch,
  Layers3,
  Network,
  RotateCcw,
  Scale,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import type {
  DynamicExplanationBeat,
  DynamicExplanationScene,
  DynamicExplanationSceneEngine,
} from './dynamicExplanation'

type DynamicProcessTheaterProps = {
  scene: DynamicExplanationScene
  language: 'zh-CN' | 'en'
  learningMode?: 'quick' | 'guided' | 'challenge'
  showNarration?: boolean
  onRevealNarration?: () => void
  onComplete?: () => void
}

type RuntimeModel = {
  engine: DynamicExplanationSceneEngine
  subject: string
  codeLines: string[]
  beats: DynamicExplanationBeat[]
  actors: Array<{ id: string; label: string; role?: string }>
}

const engineNames: Record<DynamicExplanationSceneEngine, { zh: string; en: string }> = {
  process: { zh: '流程推演', en: 'Process walkthrough' },
  state: { zh: '状态变化', en: 'State transition' },
  comparison: { zh: '对比实验', en: 'Comparison experiment' },
  spatial: { zh: '空间关系', en: 'Spatial relationship' },
  timeline: { zh: '时间演化', en: 'Timeline evolution' },
  experiment: { zh: '操作实验', en: 'Interactive experiment' },
  story: { zh: '知识叙事', en: 'Knowledge story' },
}

const actionNames: Record<DynamicExplanationBeat['action'], { zh: string; en: string }> = {
  spawn: { zh: '创建对象', en: 'Spawn' },
  focus: { zh: '聚焦观察', en: 'Focus' },
  move: { zh: '传递移动', en: 'Move' },
  change: { zh: '状态改变', en: 'Change' },
  branch: { zh: '产生分支', en: 'Branch' },
  return: { zh: '返回上层', en: 'Return' },
  resolve: { zh: '得到结果', en: 'Resolve' },
}

function factorial(value: number) {
  let result = 1
  for (let index = 2; index <= value; index += 1) result *= index
  return result
}

function inferEngine(scene: DynamicExplanationScene): DynamicExplanationSceneEngine {
  if (scene.scene_engine) return scene.scene_engine
  if (scene.visual_type === 'stack' || scene.visual_type === 'code-trace') return 'state'
  if (scene.visual_type === 'sequence' || scene.visual_type === 'journey') return 'process'
  if (scene.visual_type === 'compare' || scene.visual_type === 'contrast' || scene.visual_type === 'pitfall' || scene.visual_type === 'error-lab') return 'comparison'
  if (scene.visual_type === 'network' || scene.visual_type === 'map' || scene.visual_type === 'concept') return 'spatial'
  if (scene.visual_type === 'timeline') return 'timeline'
  if (scene.visual_type === 'example' || scene.visual_type === 'lab') return 'experiment'
  return 'story'
}

function isRecursionScene(scene: DynamicExplanationScene) {
  const searchable = [scene.title, scene.narration, scene.key_point, scene.visual.headline, ...scene.visual.items].join(' ')
  return /递归|调用栈|栈帧|factorial|阶乘|recursion|recursive/i.test(searchable)
}

function derivedModel(scene: DynamicExplanationScene): RuntimeModel {
  const engine = inferEngine(scene)
  const simulation = scene.simulation
  const sourceItems = scene.visual.items.length ? scene.visual.items : [scene.key_point]
  const beats = simulation?.beats?.length
    ? simulation.beats
    : sourceItems.map((item, index) => ({
        id: `beat-${index + 1}`,
        label: item,
        detail: index === sourceItems.length - 1
          ? (scene.visual.example || scene.key_point)
          : `${item} → ${sourceItems[index + 1] || scene.key_point}`,
        action: index === 0 ? 'spawn' as const : index === sourceItems.length - 1 ? 'resolve' as const : 'move' as const,
        target: `actor-${index + 1}`,
        from: index > 0 ? `actor-${index}` : undefined,
        to: `actor-${index + 1}`,
        code_line: Math.min(index + 1, Math.max(simulation?.code_lines?.length || sourceItems.length, 1)),
      }))

  return {
    engine,
    subject: simulation?.subject || scene.visual.headline || scene.title,
    codeLines: simulation?.code_lines?.length ? simulation.code_lines : sourceItems,
    beats,
    actors: simulation?.actors?.length
      ? simulation.actors
      : sourceItems.map((item, index) => ({ id: `actor-${index + 1}`, label: item, role: index === 0 ? 'input' : index === sourceItems.length - 1 ? 'result' : 'step' })),
  }
}

function recursionBeats(input: number, faultMode: boolean): DynamicExplanationBeat[] {
  if (faultMode) {
    return Array.from({ length: input + 5 }, (_, index) => {
      const value = input - index
      return {
        id: `fault-${index}`,
        label: `factorial(${value})`,
        detail: value <= 1
          ? '终止条件被关闭，调用仍在继续，栈空间不断被占用。'
          : `继续创建 factorial(${value - 1})，却没有任何返回发生。`,
        action: value === 1 ? 'branch' : 'spawn',
        target: `frame-${value}`,
        value: String(value),
        code_line: value <= 1 ? 2 : 3,
      }
    })
  }

  const calls: DynamicExplanationBeat[] = []
  for (let value = input; value >= 1; value -= 1) {
    calls.push({
      id: `call-${value}`,
      label: `进入 factorial(${value})`,
      detail: value === 1
        ? '命中 n ≤ 1，递归停止创建新栈帧，准备返回 1。'
        : `当前层暂时等待，并把规模缩小为 factorial(${value - 1})。`,
      action: value === 1 ? 'focus' : 'spawn',
      target: `frame-${value}`,
      value: String(value),
      code_line: value === 1 ? 2 : 3,
    })
  }
  for (let value = 2; value <= input; value += 1) {
    calls.push({
      id: `return-${value}`,
      label: `返回到 factorial(${value})`,
      detail: `${value} × ${factorial(value - 1)} = ${factorial(value)}，这一层完成并离开调用栈。`,
      action: value === input ? 'resolve' : 'return',
      target: `frame-${value}`,
      from: `frame-${value - 1}`,
      to: `frame-${value}`,
      value: String(factorial(value)),
      code_line: 3,
    })
  }
  return calls
}

function quickRoute(beats: DynamicExplanationBeat[]) {
  if (beats.length <= 4) return beats
  return [beats[0], beats[Math.floor((beats.length - 1) / 2)], beats[beats.length - 1]]
}

export function DynamicProcessTheater({ scene, language, learningMode = 'guided', showNarration = true, onRevealNarration, onComplete }: DynamicProcessTheaterProps) {
  const tr = (chinese: string, english: string) => language === 'en' ? english : chinese
  const recursion = isRecursionScene(scene)
  const baseModel = useMemo(() => derivedModel(scene), [scene])
  const configuredInput = scene.simulation?.initial_input
  const [inputValue, setInputValue] = useState(Number.isFinite(configuredInput) ? Number(configuredInput) : 4)
  const [faultMode, setFaultMode] = useState(false)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [predictionRevealed, setPredictionRevealed] = useState(false)

  const beats = useMemo(
    () => {
      const route = recursion ? recursionBeats(inputValue, faultMode) : baseModel.beats
      return learningMode === 'quick' ? quickRoute(route) : route
    },
    [baseModel.beats, faultMode, inputValue, learningMode, recursion],
  )
  const safeStep = Math.min(step, Math.max(beats.length - 1, 0))
  const activeBeat = beats[safeStep]
  const nextBeat = beats[safeStep + 1]
  const engine = recursion ? 'state' : baseModel.engine
  const inputMin = Math.max(2, scene.simulation?.input_min || 2)
  const inputMax = Math.min(8, Math.max(inputMin, scene.simulation?.input_max || 7))

  useEffect(() => {
    setStep(0)
    setPlaying(false)
    setFaultMode(false)
    setPredictionRevealed(false)
  }, [scene.id])

  useEffect(() => {
    setStep(current => Math.min(current, Math.max(beats.length - 1, 0)))
    setPredictionRevealed(false)
  }, [beats.length])

  useEffect(() => {
    if (!playing || beats.length < 2) return undefined
    const timer = window.setInterval(() => {
      setStep(current => {
        if (current >= beats.length - 1) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, faultMode ? 650 : 1250)
    return () => window.clearInterval(timer)
  }, [beats.length, faultMode, playing])

  useEffect(() => {
    setPredictionRevealed(false)
  }, [safeStep])

  const moveStep = (next: number) => {
    setPlaying(false)
    setStep(Math.max(0, Math.min(next, beats.length - 1)))
  }

  const recursionValues = Array.from({ length: inputValue }, (_, index) => inputValue - index)
  const descending = safeStep < inputValue
  const visibleCallCount = faultMode ? safeStep + 1 : Math.min(inputValue, safeStep + 1)
  const returnedCount = faultMode ? 0 : Math.max(0, safeStep - inputValue + 1)
  const visibleFrames = faultMode
    ? Array.from({ length: safeStep + 1 }, (_, index) => inputValue - index)
    : activeBeat?.action === 'resolve'
      ? []
      : recursionValues.slice(0, Math.max(1, visibleCallCount - returnedCount))
  const activeFrame = faultMode
    ? inputValue - safeStep
    : descending
      ? inputValue - safeStep
      : Math.min(inputValue, 1 + returnedCount)
  const codeLines = recursion
    ? ['function factorial(n) {', '  if (n <= 1) return 1', '  return n * factorial(n - 1)', '}']
    : baseModel.codeLines
  const activeCodeLine = Math.max(1, Math.min(activeBeat?.code_line || safeStep + 1, codeLines.length))
  const activeActorIndex = Math.max(0, baseModel.actors.findIndex(actor => actor.id === activeBeat?.target || actor.id === activeBeat?.to))
  const visitedActors = new Set(beats.slice(0, safeStep + 1).flatMap(beat => [beat.target, beat.from, beat.to].filter(Boolean)))
  const activeAction = activeBeat?.action ? tr(actionNames[activeBeat.action].zh, actionNames[activeBeat.action].en) : tr('运行中', 'Running')
  const transitionFrom = activeBeat?.from ? baseModel.actors.find(actor => actor.id === activeBeat.from)?.label || activeBeat.from : ''
  const transitionToId = activeBeat?.to || activeBeat?.target
  const transitionTo = transitionToId ? baseModel.actors.find(actor => actor.id === transitionToId)?.label || transitionToId : ''
  const transitionPath = transitionFrom && transitionTo && transitionFrom !== transitionTo
    ? `${transitionFrom} → ${transitionTo}`
    : transitionTo || transitionFrom || activeAction
  const comparisonSplit = Math.max(1, Math.ceil(baseModel.actors.length / 2))

  const restart = () => {
    setPlaying(false)
    setStep(0)
    setPredictionRevealed(false)
  }

  return (
    <section className={`process-theater engine-${engine} ${faultMode ? 'is-fault-mode' : ''}`} aria-label={tr('知识过程剧场', 'Knowledge process theater')}>
      <header className="process-theater-head">
        <div>
          <h2>{baseModel.subject}</h2>
          <p>{learningMode === 'challenge'
            ? tr('先预测下一次变化，再让过程给出答案。', 'Predict the next change before the process reveals it.')
            : tr('观察对象如何变化，并亲手控制每一个因果节拍。', 'Observe state changes and control every causal beat.')}</p>
        </div>
        <div className="process-engine-badge"><i /><span>{tr(engineNames[engine].zh, engineNames[engine].en)}</span><strong>{safeStep + 1} / {beats.length}</strong></div>
      </header>

      <div className="process-theater-grid">
        <aside className="process-code-panel">
          <div className="process-panel-title"><Code2 size={15} /><span>{tr(recursion ? '代码与执行行' : '规则与步骤', recursion ? 'Code and execution' : 'Rules and steps')}</span></div>
          <div className="process-code-lines">
            {codeLines.map((line, index) => (
              <button
                type="button"
                className={index + 1 === activeCodeLine ? 'active' : ''}
                key={`${line}-${index}`}
                onClick={() => {
                  const beatIndex = beats.findIndex(item => item.code_line === index + 1)
                  if (beatIndex >= 0) moveStep(beatIndex)
                }}
              >
                <i>{String(index + 1).padStart(2, '0')}</i><code>{line}</code>
              </button>
            ))}
          </div>
          <div className="process-code-legend">
            <span><i className="current" />{tr('正在执行', 'Executing')}</span>
            <span><i className="waiting" />{tr('等待返回', 'Waiting')}</span>
          </div>
        </aside>

        <main className="process-live-stage">
          <div className="process-stage-grid" aria-hidden="true" />
          <div className="process-stage-heading">
            <span>{faultMode ? tr('错误分支正在运行', 'Fault branch running') : tr('实时状态', 'Live state')}</span>
            <strong>{activeBeat?.label || scene.title}</strong>
          </div>

          {recursion ? (
            <div className="recursion-runtime" key={`${faultMode}-${inputValue}-${safeStep}`}>
              <div className="recursion-flow-labels" aria-hidden="true">
                <span><ArrowDown size={13} />{tr('创建调用', 'Create calls')}</span>
                <span><ArrowUp size={13} />{tr('合并返回值', 'Merge returns')}</span>
              </div>
              <div className="recursion-stack" aria-label={tr('调用栈', 'Call stack')}>
                <div className="stack-cap"><Layers3 size={14} /><span>{tr('调用栈', 'Call stack')}</span><em>{visibleFrames.length}</em></div>
                <div className="runtime-frames">
                  {visibleFrames.map((value, index) => {
                    const active = value === activeFrame
                    const waiting = !faultMode && value > activeFrame && descending
                    return (
                      <div className={`runtime-frame ${active ? 'active' : ''} ${waiting ? 'waiting' : ''}`} key={`${value}-${index}`}>
                        <span>factorial({value})</span>
                        <strong>{faultMode && value <= 1 ? tr('仍在继续调用', 'Still calling') : active ? tr('正在执行', 'Executing') : tr('等待返回', 'Waiting')}</strong>
                        <i>{faultMode && value <= 1 ? '?' : !descending && value <= returnedCount + 1 ? factorial(Math.max(1, value)) : `n = ${value}`}</i>
                      </div>
                    )
                  })}
                  {!visibleFrames.length && <div className="runtime-result"><CheckCircle2 size={22} /><span>{tr('调用栈已清空', 'Call stack cleared')}</span><strong>{factorial(inputValue)}</strong></div>}
                </div>
              </div>

              <div className="recursion-transfer" aria-hidden="true">
                <i className={descending ? 'moving-down' : 'moving-up'} />
                <span>{faultMode ? tr('没有返回值', 'No return value') : descending ? `n → ${Math.max(1, activeFrame - 1)}` : `${activeFrame} × ${factorial(Math.max(1, activeFrame - 1))}`}</span>
              </div>

              <div className="runtime-value-panel">
                <span>{faultMode ? tr('风险状态', 'Risk state') : descending ? tr('当前参数', 'Current argument') : tr('正在合并', 'Merging result')}</span>
                <strong>{faultMode && activeFrame <= 1 ? 'STACK ↗' : descending ? activeFrame : factorial(Math.max(1, activeFrame))}</strong>
                <p>{activeBeat?.detail}</p>
              </div>
            </div>
          ) : engine === 'comparison' ? (
            <div className="semantic-runtime comparison-runtime" key={`${scene.id}-${safeStep}`}>
              <section className="comparison-side before"><span>{tr('条件 A', 'Condition A')}</span><strong>{scene.visual.before || baseModel.actors[0]?.label || scene.title}</strong><div>{baseModel.actors.slice(0, comparisonSplit).map((actor, index) => <button type="button" className={index === activeActorIndex ? 'active' : ''} key={actor.id} onClick={() => moveStep(Math.min(index, beats.length - 1))}><i>{index + 1}</i><span>{actor.label}</span></button>)}</div></section>
              <div className={`comparison-balance ${activeActorIndex < comparisonSplit ? 'leans-before' : 'leans-after'}`} aria-hidden="true"><Scale size={34} /><i /><small>{activeAction}</small></div>
              <section className="comparison-side after"><span>{tr('条件 B', 'Condition B')}</span><strong>{scene.visual.after || baseModel.actors.at(-1)?.label || scene.key_point}</strong><div>{baseModel.actors.slice(comparisonSplit).map((actor, index) => <button type="button" className={visitedActors.has(actor.id) ? 'active' : ''} key={actor.id} onClick={() => moveStep(Math.min(index + comparisonSplit, beats.length - 1))}><i>{index + 1}</i><span>{actor.label}</span></button>)}</div></section>
              <p>{showNarration ? activeBeat?.detail || scene.narration : tr('先判断哪一侧会改变，以及为什么。', 'Predict which side changes and why.')}</p>
            </div>
          ) : engine === 'timeline' ? (
            <div className="semantic-runtime timeline-runtime" key={`${scene.id}-${safeStep}`}>
              <div className="timeline-track" aria-hidden="true"><i style={{ '--timeline-scale': (safeStep + 1) / Math.max(beats.length, 1) } as CSSProperties} /></div>
              <div className="timeline-events">{beats.map((beat, index) => <button type="button" className={index === safeStep ? 'active' : index < safeStep ? 'completed' : ''} key={beat.id} onClick={() => moveStep(index)}><i>{index < safeStep ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}</i><span><small>{String(index + 1).padStart(2, '0')}</small><strong>{beat.label}</strong><p>{index === safeStep && showNarration ? beat.detail : tr('沿时间继续观察变化', 'Continue along the timeline')}</p></span></button>)}</div>
              <div className="timeline-causal-caption"><GitBranch size={15} /><span>{transitionPath}</span><strong>{activeBeat?.value || activeAction}</strong></div>
            </div>
          ) : engine === 'spatial' ? (
            <div className="semantic-runtime spatial-runtime" key={`${scene.id}-${safeStep}`}>
              <div className="spatial-core"><Network size={23} /><span>{tr('核心关系', 'Core relationship')}</span><strong>{baseModel.subject}</strong></div>
              {baseModel.actors.map((actor, index) => {
                const angle = (Math.PI * 2 * index) / Math.max(baseModel.actors.length, 1) - Math.PI / 2
                const x = 50 + Math.cos(angle) * 36
                const y = 50 + Math.sin(angle) * 34
                return <button type="button" className={`${index === activeActorIndex ? 'active' : ''}${visitedActors.has(actor.id) ? ' visited' : ''}`} style={{ '--spatial-x': `${x}%`, '--spatial-y': `${y}%`, '--spatial-angle': `${angle + Math.PI}rad` } as CSSProperties} key={actor.id} onClick={() => moveStep(Math.min(index, beats.length - 1))}><i>{index + 1}</i><strong>{actor.label}</strong><span>{actor.role || tr('关联对象', 'Related object')}</span></button>
              })}
              <p>{showNarration ? activeBeat?.detail || scene.narration : tr('先预测当前对象会与哪一个区域建立关系。', 'Predict which region connects next.')}</p>
            </div>
          ) : engine === 'experiment' ? (
            <div className="semantic-runtime experiment-runtime" key={`${scene.id}-${safeStep}`}>
              <section className="experiment-input"><SlidersHorizontal size={22} /><span>{scene.simulation?.input_label || tr('当前输入', 'Current input')}</span><strong>{scene.simulation?.initial_input ?? activeBeat?.value ?? safeStep + 1}</strong><p>{scene.simulation?.experiment?.description || scene.visual.example || scene.narration}</p></section>
              <div className="experiment-transfer"><ArrowRight size={24} /><i /><span>{activeAction}</span><small>{transitionPath}</small></div>
              <section className="experiment-result"><Boxes size={22} /><span>{tr('观察结果', 'Observed result')}</span><strong>{activeBeat?.label || scene.key_point}</strong><p>{showNarration ? activeBeat?.detail || scene.key_point : tr('先改变条件并预测结果。', 'Change the condition and predict the result.')}</p></section>
              <div className="experiment-actors">{baseModel.actors.map((actor, index) => <button type="button" className={index === activeActorIndex ? 'active' : ''} key={actor.id} onClick={() => moveStep(Math.min(index, beats.length - 1))}><i>{index + 1}</i><span>{actor.label}</span></button>)}</div>
            </div>
          ) : engine === 'story' ? (
            <div className="semantic-runtime story-runtime" key={`${scene.id}-${safeStep}`}>
              <BookOpen size={28} />
              <span>{tr('当前叙事节点', 'Current story beat')}</span>
              <h3>{activeBeat?.label || scene.title}</h3>
              <small className="story-transition"><GitBranch size={14} />{transitionPath}</small>
              <p>{showNarration ? activeBeat?.detail || scene.narration : tr('先用自己的话猜一猜，这个故事节点想解释什么。', 'Predict what this story beat is trying to explain.')}</p>
              <div>{beats.map((beat, index) => <button type="button" className={index === safeStep ? 'active' : index < safeStep ? 'completed' : ''} key={beat.id} onClick={() => moveStep(index)}><i>{index + 1}</i><span>{beat.label}</span></button>)}</div>
            </div>
          ) : engine === 'state' ? (
            <div className="semantic-runtime state-runtime" key={`${scene.id}-${safeStep}`}>
              <div className="state-board">{baseModel.actors.map((actor, index) => <button type="button" className={`${index === activeActorIndex ? 'active' : ''}${visitedActors.has(actor.id) ? ' visited' : ''}`} key={actor.id} onClick={() => moveStep(Math.min(index, beats.length - 1))}><span>{actor.role || tr('状态对象', 'State object')}</span><strong>{actor.label}</strong><i>{index === activeActorIndex ? activeBeat?.value || tr('变化中', 'Changing') : visitedActors.has(actor.id) ? tr('已更新', 'Updated') : tr('等待', 'Waiting')}</i>{index === activeActorIndex && <em>{activeAction}</em>}</button>)}</div>
              <p>{showNarration ? activeBeat?.detail || scene.narration : tr('观察哪些状态已经改变，再预测下一项。', 'Inspect changed states and predict the next one.')}</p>
            </div>
          ) : (
            <div className="semantic-runtime process-runtime" key={`${scene.id}-${safeStep}`}>
              <div className="process-lane">{baseModel.actors.map((actor, index) => <div className="process-lane-item" key={actor.id}><button type="button" className={`${index === activeActorIndex ? 'active' : ''}${visitedActors.has(actor.id) ? 'visited' : ''}`} onClick={() => moveStep(Math.min(index, beats.length - 1))}><i>{visitedActors.has(actor.id) ? <CheckCircle2 size={15} /> : index + 1}</i><strong>{actor.label}</strong><span>{actor.role || tr('过程节点', 'Process node')}</span></button>{index < baseModel.actors.length - 1 && <div className={`process-lane-transfer ${index === Math.max(0, activeActorIndex - 1) ? 'active' : ''}`} aria-hidden="true"><i /><ArrowRight size={20} /></div>}</div>)}</div>
              <div className="process-current"><span>{activeAction}</span><strong>{activeBeat?.label || scene.title}</strong><small>{transitionPath}</small><p>{showNarration ? activeBeat?.detail || scene.narration : tr('先预测下一个对象会发生什么变化。', 'Predict what changes next.')}</p></div>
            </div>
          )}
        </main>

        <aside className="process-inspector">
          <div className="process-panel-title"><GitBranch size={15} /><span>{tr('状态检查器', 'State inspector')}</span></div>
          <div className="process-inspector-status">
            <span>{tr('当前动作', 'Current action')}</span>
            <strong>{activeAction}</strong>
            {showNarration
              ? <p>{activeBeat?.detail || scene.narration}</p>
              : <div className="process-hidden-explanation"><p>{tr('先观察当前对象和状态，预测下一次变化。', 'Observe the current object and predict the next change.')}</p>{onRevealNarration && <button type="button" onClick={onRevealNarration}><Eye size={14} />{tr('揭晓过程', 'Reveal process')}</button>}</div>}
          </div>
          <div className="process-state-table">
            <div><span>{tr('对象', 'Object')}</span><strong>{activeBeat?.target || baseModel.subject}</strong></div>
            <div><span>{tr('状态', 'State')}</span><strong>{faultMode ? tr('异常增长', 'Overflowing') : activeBeat?.value || tr('变化中', 'Changing')}</strong></div>
            <div><span>{tr('下一步', 'Next')}</span><strong>{predictionRevealed ? (nextBeat?.label || tr('过程完成', 'Complete')) : '••••••'}</strong></div>
          </div>
          <button className="process-predict" type="button" disabled={!nextBeat} onClick={() => setPredictionRevealed(value => !value)}><Eye size={14} />{predictionRevealed ? tr('隐藏下一步', 'Hide next step') : tr('预测后再揭晓', 'Predict, then reveal')}</button>
          <div className="process-takeaway"><Sparkles size={15} /><span>{tr('本幕要带走的关系', 'Relationship to remember')}</span><p>{showNarration ? scene.key_point : tr('完成预测后再揭晓本幕结论。', 'Reveal the conclusion after making a prediction.')}</p></div>
        </aside>
      </div>

      <footer className="process-theater-controls">
        <div className="process-transport">
          <button type="button" onClick={restart} aria-label={tr('重新开始', 'Restart')}><RotateCcw size={16} /></button>
          <button type="button" aria-label={tr('上一步', 'Previous step')} onClick={() => moveStep(safeStep - 1)} disabled={safeStep === 0}><ChevronLeft size={18} /></button>
          <button className="process-play" type="button" aria-pressed={playing} onClick={() => setPlaying(value => !value)} disabled={beats.length < 2}>{playing ? <CirclePause size={18} /> : <CirclePlay size={18} />}{playing ? tr('暂停推演', 'Pause') : tr('播放推演', 'Play')}</button>
          <button type="button" aria-label={safeStep >= beats.length - 1 ? tr('完成本幕', 'Complete scene') : tr('下一步', 'Next step')} onClick={() => safeStep >= beats.length - 1 ? onComplete?.() : moveStep(safeStep + 1)} disabled={safeStep >= beats.length - 1 && !onComplete}>{safeStep >= beats.length - 1 ? <CheckCircle2 size={18} /> : <ChevronRight size={18} />}</button>
        </div>
        <div className="process-scrubber">
          <input aria-label={tr('推演进度', 'Walkthrough progress')} type="range" min="0" max={Math.max(beats.length - 1, 0)} value={safeStep} onChange={event => moveStep(Number(event.target.value))} />
          <span>{Math.round(((safeStep + 1) / Math.max(beats.length, 1)) * 100)}%</span>
        </div>
        {recursion && (
          <div className="process-experiment-controls">
            <label><span>{tr('输入 n', 'Input n')}</span><input type="number" min={inputMin} max={inputMax} value={inputValue} onChange={event => { const next = Math.max(inputMin, Math.min(inputMax, Number(event.target.value) || inputMin)); setInputValue(next); restart() }} /></label>
            <button className={faultMode ? 'active danger' : ''} type="button" aria-pressed={faultMode} onClick={() => { setFaultMode(value => !value); setStep(0); setPlaying(false) }}><FlaskConical size={15} />{faultMode ? tr('恢复终止条件', 'Restore base case') : tr('关闭终止条件实验', 'Remove base case')}</button>
          </div>
        )}
      </footer>

      {faultMode && <div className="process-fault-banner" role="status"><AlertTriangle size={16} /><span>{tr('实验模式：终止条件已移除。观察调用为何无法返回，而不是记住一个结论。', 'Experiment mode: the base case is removed. Observe why calls cannot return.')}</span></div>}
    </section>
  )
}
