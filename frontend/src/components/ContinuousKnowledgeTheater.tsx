import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, CirclePause, CirclePlay, Eye, ListTree, MousePointerClick, PenLine, X } from 'lucide-react'
import type { DynamicExplanationBranchCondition, DynamicExplanationCheckpoint, DynamicExplanationData, DynamicExplanationInteractionOutcome, DynamicExplanationScene, DynamicExplanationSceneEngine, DynamicExplanationTeachingPhase } from './dynamicExplanation'
import { CinematicKnowledgeStage, type CinematicDirectorEvent } from './CinematicKnowledgeStage'
import { getCinematicStageKind } from './cinematicStage'
import { DynamicProcessTheater } from './DynamicProcessTheater'

type LearningMode = 'quick' | 'guided' | 'challenge'

type ContinuousKnowledgeTheaterProps = {
  data: DynamicExplanationData
  language: 'zh-CN' | 'en'
  activeIndex: number
  learningMode: LearningMode
  completedSceneIds: string[]
  visitedSceneIds: string[]
  interactionOutcomes: Record<string, DynamicExplanationInteractionOutcome>
  nextSceneIndex: number | null
  activeBranchDecision?: {
    condition: DynamicExplanationBranchCondition
    label: string
    reason: string
    targetSceneId: string
  }
  selectedAnswer?: string
  checkpoint?: DynamicExplanationCheckpoint
  showNarration: boolean
  editing?: boolean
  completionNotice?: 'earlier' | 'overview' | null
  onExit: () => void
  onSelectScene: (index: number) => void
  onBack: () => void
  onAdvance: () => void
  onInteractionOutcome: (scene: DynamicExplanationScene, outcome: DynamicExplanationInteractionOutcome) => void
  onModeChange: (mode: LearningMode) => void
  onAnswer: (answer: string) => void
  onRevealNarration: () => void
  onEdit?: () => void
}

const engineNames: Record<DynamicExplanationSceneEngine, { zh: string; en: string }> = {
  process: { zh: '过程', en: 'Process' },
  state: { zh: '状态', en: 'State' },
  comparison: { zh: '对比', en: 'Compare' },
  spatial: { zh: '关系', en: 'Spatial' },
  timeline: { zh: '演化', en: 'Timeline' },
  experiment: { zh: '实验', en: 'Experiment' },
  story: { zh: '叙事', en: 'Story' },
}

const phaseNames: Record<DynamicExplanationTeachingPhase, { zh: string; en: string }> = {
  question: { zh: '提出问题', en: 'Question' },
  intuition: { zh: '建立直觉', en: 'Intuition' },
  mechanism: { zh: '解释机制', en: 'Mechanism' },
  verification: { zh: '动态验证', en: 'Verify' },
  boundary: { zh: '检查边界', en: 'Boundary' },
  synthesis: { zh: '形成结论', en: 'Synthesis' },
}

function inferEngine(scene: DynamicExplanationData['scenes'][number]): DynamicExplanationSceneEngine {
  if (scene.scene_engine) return scene.scene_engine
  if (scene.visual_type === 'stack' || scene.visual_type === 'code-trace') return 'state'
  if (scene.visual_type === 'sequence' || scene.visual_type === 'journey') return 'process'
  if (scene.visual_type === 'compare' || scene.visual_type === 'contrast' || scene.visual_type === 'pitfall' || scene.visual_type === 'error-lab') return 'comparison'
  if (scene.visual_type === 'network' || scene.visual_type === 'map' || scene.visual_type === 'concept' || scene.visual_type === 'recap') return 'spatial'
  if (scene.visual_type === 'timeline') return 'timeline'
  if (scene.visual_type === 'example' || scene.visual_type === 'lab') return 'experiment'
  return 'story'
}

function inferPhase(index: number, total: number): DynamicExplanationTeachingPhase {
  if (total <= 3) return (['question', 'mechanism', 'synthesis'] as const)[Math.min(index, 2)]
  if (total === 4) return (['question', 'intuition', 'verification', 'synthesis'] as const)[index]
  if (total === 5) return (['question', 'intuition', 'mechanism', 'verification', 'synthesis'] as const)[index]
  if (index === 0) return 'question'
  if (index === 1) return 'intuition'
  if (index === total - 1) return 'synthesis'
  if (index === total - 2) return 'boundary'
  if (index >= Math.max(3, total - 3)) return 'verification'
  return 'mechanism'
}

export function ContinuousKnowledgeTheater(props: ContinuousKnowledgeTheaterProps) {
  const {
    data,
    language,
    activeIndex,
    learningMode,
    completedSceneIds,
    visitedSceneIds,
    interactionOutcomes,
    nextSceneIndex,
    activeBranchDecision,
    selectedAnswer,
    checkpoint,
    showNarration,
    editing = false,
    completionNotice,
    onExit,
    onSelectScene,
    onBack,
    onAdvance,
    onInteractionOutcome,
    onModeChange,
    onAnswer,
    onRevealNarration,
    onEdit,
  } = props
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [checkOpen, setCheckOpen] = useState(false)
  const [directorActive, setDirectorActive] = useState(false)
  const [directorPlaying, setDirectorPlaying] = useState(false)
  const [directorAwaitingInteraction, setDirectorAwaitingInteraction] = useState(false)
  const [directorTransitioning, setDirectorTransitioning] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [speechRate, setSpeechRate] = useState(1)
  const controlsTimerRef = useRef<number | null>(null)
  const transitionTimerRef = useRef<number | null>(null)
  const tr = (chinese: string, english: string) => language === 'en' ? english : chinese
  const scene = data.scenes[activeIndex]
  const completed = useMemo(() => new Set(completedSceneIds), [completedSceneIds])
  const routeIndexes = useMemo(() => {
    const all = data.scenes.map((_, index) => index)
    if (learningMode !== 'quick' || all.length <= 3) return all
    return [...new Set([0, Math.round((all.length - 1) / 2), all.length - 1])]
  }, [data.scenes, learningMode])
  const activeRoutePosition = Math.max(0, routeIndexes.indexOf(activeIndex))
  const routeCompletedCount = routeIndexes.filter(index => completed.has(data.scenes[index]?.id)).length
  const checked = Boolean(selectedAnswer)
  const cinematicKind = scene ? getCinematicStageKind(scene) : null
  const previousSceneId = visitedSceneIds.length > 1 ? visitedSceneIds[visitedSceneIds.length - 2] : ''
  const previousIndex = previousSceneId ? data.scenes.findIndex(item => item.id === previousSceneId) : -1
  const nextIndex = nextSceneIndex
  const previousScene = previousIndex !== null ? data.scenes[previousIndex] : null
  const continuitySource = scene?.continuity?.source_scene_id
    ? data.scenes.find(item => item.id === scene.continuity?.source_scene_id) || previousScene
    : previousScene
  const previousOutcome = continuitySource ? interactionOutcomes[continuitySource.id] : undefined
  const firstIncompleteIndex = data.scenes.findIndex(item => !completed.has(item.id))
  const directorAvailable = useMemo(() => data.scenes.length > 1 && data.scenes.every(item => Boolean(getCinematicStageKind(item))), [data.scenes])
  const interactionPrompt = scene?.stage?.interaction_prompt || (cinematicKind ? {
    'number-transform': tr('轮到你：点击任意一位，检查符号位或位权。', 'Your turn: inspect any bit, including its sign or weight.'),
    'storage-hierarchy': tr('轮到你：选择命中路径，或点击一层继续追踪。', 'Your turn: choose a hit path or inspect a storage level.'),
    'pipeline-overlap': tr('轮到你：推进一个时钟，观察多条指令如何重叠。', 'Your turn: advance one clock and watch instructions overlap.'),
    'hazard-lab': tr('轮到你：选择暂停、转发或清空，比较周期代价。', 'Your turn: choose stall, forward, or flush and compare the cost.'),
    'performance-lab': tr('轮到你：调整任意参数，让优化通道发生变化。', 'Your turn: tune any parameter and change the optimized lane.'),
    'service-flow': '',
    'instruction-cycle': '',
    'process-lab': '',
    'concept-constellation': tr('轮到你：选择一个概念，观察它与核心主题的连接。', 'Your turn: choose an idea and inspect its connection to the core.'),
    'causal-chain': tr('轮到你：点击链条中的一步，检查原因如何传递。', 'Your turn: inspect one link and trace how the cause travels.'),
    'timeline-river': tr('轮到你：选择一个阶段，查看这一刻发生了什么变化。', 'Your turn: choose a stage and inspect what changed there.'),
    'comparison-studio': tr('轮到你：切换比较视角，找出决定差异的条件。', 'Your turn: switch perspectives and find the deciding condition.'),
    'system-network': tr('轮到你：选择一个节点，追踪作用或信息流向。', 'Your turn: choose a node and trace the flow through the system.'),
    'state-machine': tr('轮到你：选择一个状态，观察触发条件和下一步。', 'Your turn: choose a state and inspect its trigger and next step.'),
    'case-lab': tr('轮到你：打开一条证据，再判断案例结论。', 'Your turn: open one piece of evidence before judging the case.'),
    'parameter-lab': tr('轮到你：调整一个条件，观察结果如何改变。', 'Your turn: adjust one condition and observe the response.'),
  }[cinematicKind] : '')

  useEffect(() => setCheckOpen(false), [scene?.id])

  const clearControlsTimer = useCallback(() => {
    if (controlsTimerRef.current !== null) {
      window.clearTimeout(controlsTimerRef.current)
      controlsTimerRef.current = null
    }
  }, [])

  const revealControls = useCallback(() => {
    clearControlsTimer()
    setControlsVisible(true)
    if (directorActive && directorPlaying && !directorAwaitingInteraction && !directorTransitioning) {
      controlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2600)
    }
  }, [clearControlsTimer, directorActive, directorAwaitingInteraction, directorPlaying, directorTransitioning])

  useEffect(() => {
    revealControls()
    return clearControlsTimer
  }, [clearControlsTimer, revealControls])

  useEffect(() => () => {
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current)
  }, [])

  useEffect(() => {
    if (!directorActive) return undefined
    const onKeyDown = () => revealControls()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [directorActive, revealControls])

  useEffect(() => {
    setDirectorAwaitingInteraction(false)
  }, [activeIndex])

  const stopDirector = useCallback(() => {
    setDirectorActive(false)
    setDirectorPlaying(false)
    setDirectorAwaitingInteraction(false)
    setControlsVisible(true)
    clearControlsTimer()
  }, [clearControlsTimer])

  const selectSceneManually = useCallback((index: number) => {
    stopDirector()
    onSelectScene(index)
  }, [onSelectScene, stopDirector])

  const toggleDirector = useCallback(() => {
    setOverviewOpen(false)
    setCheckOpen(false)
    if (!directorActive) {
      onModeChange('guided')
      setDirectorActive(true)
      setDirectorPlaying(true)
      setDirectorAwaitingInteraction(false)
      return
    }
    if (directorAwaitingInteraction) return
    setDirectorPlaying(value => !value)
  }, [directorActive, directorAwaitingInteraction, onModeChange])

  const handleDirectorEvent = useCallback((event: CinematicDirectorEvent) => {
    if (event.outcome && scene) {
      onInteractionOutcome(scene, event.outcome as DynamicExplanationInteractionOutcome)
    }
    if (event.type === 'awaiting-interaction') {
      setDirectorAwaitingInteraction(true)
      setDirectorPlaying(false)
      setControlsVisible(true)
      return
    }
    if (event.type === 'interaction-complete') {
      setDirectorAwaitingInteraction(false)
      if (directorActive) setDirectorPlaying(true)
      return
    }
    if (event.type === 'manual-pause') {
      setDirectorAwaitingInteraction(false)
      setDirectorPlaying(false)
      return
    }
    if (event.type === 'toggle-play') {
      if (!directorAwaitingInteraction) setDirectorPlaying(value => !value)
      return
    }
    if (event.type !== 'scene-complete' || transitionTimerRef.current !== null) return
    setDirectorTransitioning(true)
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null
      if (nextIndex === null) {
        setDirectorActive(false)
        setDirectorPlaying(false)
      }
      onAdvance()
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => setDirectorTransitioning(false)))
    }, 320)
  }, [directorActive, directorAwaitingInteraction, nextIndex, onAdvance, onInteractionOutcome, scene])

  if (!scene) return null

  return (
    <section className={`lesson-theater palette-sage${overviewOpen ? ' is-overview' : ''}${cinematicKind && !overviewOpen ? ' is-cinematic' : ''}${directorActive ? ' is-director-mode' : ''}${directorPlaying ? ' is-director-playing' : ''}${directorAwaitingInteraction ? ' is-director-waiting' : ''}${directorTransitioning ? ' is-director-transitioning' : ''}${controlsVisible ? '' : ' controls-hidden'}`} aria-label={tr('动态讲解剧场', 'Dynamic lesson theater')} onPointerMove={revealControls} onPointerDown={revealControls}>
      <header className="lesson-theater-bar">
        <button type="button" className="lesson-exit" onClick={onExit} aria-label={tr('退出讲解', 'Exit lesson')}><X size={18} /><span>{tr('退出讲解', 'Exit lesson')}</span></button>
        <div className="lesson-theater-title">
          <strong>{data.title}</strong>
          <span>{learningMode === 'quick'
            ? tr(`关键路径 ${activeRoutePosition + 1}/${routeIndexes.length}`, `Quick path ${activeRoutePosition + 1}/${routeIndexes.length}`)
            : tr(`第 ${activeIndex + 1} 幕，共 ${data.scenes.length} 幕`, `Scene ${activeIndex + 1} of ${data.scenes.length}`)}</span>
        </div>
        <div className="lesson-theater-actions">
          {directorAvailable && cinematicKind && !overviewOpen && <button type="button" className={directorActive ? 'active director-toggle' : 'director-toggle'} aria-label={directorAwaitingInteraction ? tr('请完成当前操作', 'Complete the current action') : directorPlaying ? tr('暂停连续讲解', 'Pause director mode') : directorActive ? tr('继续连续讲解', 'Resume director mode') : tr('开始连续讲解', 'Start director mode')} aria-pressed={directorActive && directorPlaying} onClick={toggleDirector}>{directorPlaying ? <CirclePause size={16} /> : <CirclePlay size={16} />}<span>{directorAwaitingInteraction ? tr('请完成操作', 'Complete action') : directorActive && !directorPlaying ? tr('继续连续讲解', 'Resume director') : directorPlaying ? tr('暂停连续讲解', 'Pause director') : tr('连续讲解', 'Director mode')}</span></button>}
          <button type="button" className={overviewOpen ? 'active' : ''} aria-pressed={overviewOpen} aria-label={overviewOpen ? tr('返回当前幕', 'Return to scene') : tr('查看课程路径', 'Lesson path')} onClick={() => setOverviewOpen(value => !value)}><ListTree size={16} /><span>{overviewOpen ? tr('返回当前幕', 'Return to scene') : tr('查看课程路径', 'Lesson path')}</span></button>
          {onEdit && <button type="button" className={editing ? 'active' : ''} aria-pressed={editing} aria-label={editing ? tr('继续讲解', 'Resume lesson') : tr('编辑内容', 'Edit content')} onClick={onEdit}><PenLine size={16} /><span>{editing ? tr('继续讲解', 'Resume lesson') : tr('编辑内容', 'Edit content')}</span></button>}
        </div>
      </header>

      <div className="lesson-theater-body">
        <nav className="lesson-scene-rail" aria-label={tr('讲解场景', 'Lesson scenes')}>
          <div className="lesson-rail-heading"><span>{learningMode === 'quick' ? tr('关键路径', 'Quick path') : tr('课程路径', 'Lesson path')}</span><strong>{routeCompletedCount}/{routeIndexes.length}</strong></div>
          <div className="lesson-scene-list">
            {routeIndexes.map(index => {
              const item = data.scenes[index]
              const engine = inferEngine(item)
              const phase = item.continuity?.teaching_phase || inferPhase(index, data.scenes.length)
              const active = index === activeIndex
              const isComplete = completed.has(item.id)
              return (
                  <button type="button" className={`${active ? 'active' : ''}${isComplete ? ' completed' : ''} path-${item.path_role || 'main'}`} aria-current={active ? 'step' : undefined} key={item.id} onClick={() => { selectSceneManually(index); setOverviewOpen(false) }}>
                  <i>{isComplete ? <Check size={13} /> : String(index + 1).padStart(2, '0')}</i>
                  <span><small>{item.path_role === 'remediation' ? tr('纠错支线', 'Remediation') : item.path_role === 'advanced' ? tr('进阶支线', 'Advanced') : phase ? tr(phaseNames[phase].zh, phaseNames[phase].en) : tr(engineNames[engine].zh, engineNames[engine].en)}</small><b>{item.title}</b></span>
                </button>
              )
            })}
          </div>
        </nav>

        <main className="lesson-scene-workspace">
          {overviewOpen ? (
            <section className="lesson-overview" aria-label={tr('完整讲解路径', 'Full lesson path')}>
              <header><span>{learningMode === 'quick' ? tr('关键路径', 'Quick path') : tr('完整讲解路径', 'Full lesson path')}</span><h1>{data.title}</h1><p>{data.summary}</p>{data.director_profile && <div className="lesson-director-brief"><strong>{data.director_profile.thread_label}</strong><span>{data.director_profile.knowledge_structure || data.director_profile.domain}</span><p>{data.director_profile.teaching_arc}</p></div>}</header>
              <div className="lesson-overview-flow">
                {routeIndexes.map(index => {
                   const item = data.scenes[index]
                   const engine = inferEngine(item)
                   const phase = item.continuity?.teaching_phase || inferPhase(index, data.scenes.length)
                   return (
                    <button type="button" className={`${index === activeIndex ? 'active' : completed.has(item.id) ? 'completed' : ''} path-${item.path_role || 'main'}`} key={item.id} onClick={() => { selectSceneManually(index); setOverviewOpen(false) }}>
                      <i>{String(index + 1).padStart(2, '0')}</i>
                      <span>
                        <small>{item.path_role === 'remediation' ? tr('纠错支线', 'Remediation') : item.path_role === 'advanced' ? tr('进阶支线', 'Advanced') : phase ? tr(phaseNames[phase].zh, phaseNames[phase].en) : tr(engineNames[engine].zh, engineNames[engine].en)}</small>
                        <strong>{item.title}</strong>
                        <p>{item.continuity?.passes || item.key_point}</p>
                        {Boolean(item.branching?.routes.length) && <span className="lesson-branch-exits">{item.branching?.routes.map(route => <em className={`condition-${route.condition}`} key={`${item.id}-${route.condition}`}>{route.label}</em>)}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ) : (
            <>
              {cinematicKind
                ? <CinematicKnowledgeStage key={scene.id} scene={scene} language={language} learningMode={learningMode} showNarration={showNarration} onRevealNarration={onRevealNarration} director={{ active: directorActive, playing: directorPlaying }} voice={{ enabled: voiceEnabled, rate: speechRate, onToggle: () => setVoiceEnabled(value => !value), onRateChange: () => setSpeechRate(current => current >= 1.14 ? .85 : current >= .99 ? 1.15 : 1) }} onDirectorEvent={handleDirectorEvent} story={{ index: activeIndex, total: data.scenes.length, threadLabel: data.director_profile?.thread_label || data.title, chapterLabel: scene.stage?.chapter_label || scene.title, previousConclusion: previousOutcome?.detail || scene.continuity?.receives || continuitySource?.key_point, currentQuestion: continuitySource?.continuity?.next_question || scene.stage?.focal_question || scene.key_point, previousOutcome, receives: scene.continuity?.receives, phaseLabel: scene.path_role === 'remediation' ? tr('纠错支线', 'Remediation') : scene.path_role === 'advanced' ? tr('进阶支线', 'Advanced') : tr(phaseNames[scene.continuity?.teaching_phase || inferPhase(activeIndex, data.scenes.length)].zh, phaseNames[scene.continuity?.teaching_phase || inferPhase(activeIndex, data.scenes.length)].en) }} />
                : <DynamicProcessTheater key={scene.id} scene={scene} language={language} learningMode={learningMode} showNarration={showNarration} onRevealNarration={onRevealNarration} onComplete={onAdvance} />}
              {directorAwaitingInteraction && interactionPrompt && <div className="director-interaction-prompt" role="status"><MousePointerClick size={18} /><span><strong>{tr('讲解暂停在这里', 'The lesson is waiting here')}</strong>{interactionPrompt}</span></div>}
              {scene.check && checkOpen && (
                <section className="lesson-check" aria-label={tr('理解检查', 'Understanding check')}>
                  <button type="button" className="lesson-check-close" onClick={() => setCheckOpen(false)} aria-label={tr('关闭理解检查', 'Close understanding check')}><X size={15} /></button>
                  <div><span>{tr('理解检查', 'Understanding check')}</span><strong>{scene.check.prompt}</strong>{checkpoint && <small>{checkpoint.correct ? tr('此前已经答对', 'Previously correct') : tr(`此前尝试 ${checkpoint.attempts} 次`, `${checkpoint.attempts} previous attempts`)}</small>}</div>
                  <div className="lesson-check-options">
                    {scene.check.options.map(option => {
                      const correct = checked && option === scene.check?.answer
                      const incorrect = checked && option === selectedAnswer && option !== scene.check?.answer
                      return <button type="button" disabled={checked} className={correct ? 'correct' : incorrect ? 'incorrect' : ''} key={option} onClick={() => onAnswer(option)}>{correct && <Check size={14} />}{option}</button>
                    })}
                  </div>
                  {checked && <p>{scene.check.explanation}</p>}
                  {!showNarration && <button type="button" className="lesson-reveal" onClick={onRevealNarration}><Eye size={14} />{tr('揭晓讲解', 'Reveal explanation')}</button>}
                </section>
              )}
            </>
          )}
        </main>
      </div>

      <footer className="lesson-theater-footer">
        {activeBranchDecision && (
          <div className={`lesson-branch-decision condition-${activeBranchDecision.condition}`} role="status">
            <span>{activeBranchDecision.condition === 'incorrect' || activeBranchDecision.condition === 'blocked' || activeBranchDecision.condition === 'incomplete'
              ? tr('路线已调整', 'Route adjusted')
              : tr('理解已确认', 'Understanding confirmed')}</span>
            <strong>{activeBranchDecision.label}</strong>
            <p>{activeBranchDecision.reason}</p>
          </div>
        )}
        {completionNotice && (
          <div className="lesson-route-notice" role="status">
            <div>
              <strong>{completionNotice === 'overview'
                ? tr('关键路径已经完成', 'Quick path complete')
                : tr('还有场景尚未完成', 'Some scenes are still incomplete')}</strong>
              <p>{completionNotice === 'overview'
                ? tr('继续完整推演，补齐被压缩的过程和细节。', 'Continue the guided walkthrough to cover the compressed steps and details.')
                : tr('从第一个未完成场景继续，完成后即可结束本次讲解。', 'Continue from the first incomplete scene to finish this lesson.')}</p>
            </div>
            {firstIncompleteIndex >= 0 && (
              <button type="button" onClick={() => {
                if (learningMode === 'quick') onModeChange('guided')
                onSelectScene(firstIncompleteIndex)
              }}>{completionNotice === 'overview' ? tr('继续完整推演', 'Continue guided') : tr('继续未完成场景', 'Continue lesson')}</button>
            )}
          </div>
        )}
        <div className="lesson-scene-controls">
          <button type="button" disabled={previousIndex < 0} aria-label={tr('上一幕', 'Previous scene')} onClick={onBack}><ChevronLeft size={17} /><span>{tr('上一幕', 'Previous')}</span></button>
          <div><span>{tr('当前幕', 'Current scene')}</span><strong>{scene.title}</strong></div>
          <button type="button" className="next" aria-label={nextIndex === null ? tr('完成讲解', 'Finish lesson') : tr('完成并进入下一幕', 'Complete and continue')} onClick={() => { stopDirector(); onAdvance() }}><span>{nextIndex === null ? tr('完成讲解', 'Finish lesson') : tr('完成并进入下一幕', 'Complete and continue')}</span><ChevronRight size={17} /></button>
        </div>
        <div className="lesson-mode-actions">
          {scene.check && <button type="button" className={`lesson-check-toggle${checkOpen ? ' active' : ''}`} aria-pressed={checkOpen} onClick={() => setCheckOpen(value => !value)}>{tr('理解检查', 'Check')}</button>}
          <div className="lesson-mode-switch" aria-label={tr('选择学习节奏', 'Choose learning pace')}>
            {(['quick', 'guided', 'challenge'] as LearningMode[]).map(mode => <button type="button" className={learningMode === mode ? 'active' : ''} aria-pressed={learningMode === mode} key={mode} onClick={() => { stopDirector(); onModeChange(mode) }}>{mode === 'quick' ? tr('关键路径', 'Quick') : mode === 'guided' ? tr('完整推演', 'Guided') : tr('先预测', 'Challenge')}</button>)}
          </div>
        </div>
      </footer>
    </section>
  )
}
