import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, CirclePause, CirclePlay, Eye, FastForward, Gauge, GripVertical, Lightbulb, Maximize2, PenLine, RotateCcw, Save, Sparkles, Target, X } from 'lucide-react'
import type { DynamicExplanationCheckpoint, DynamicExplanationData, DynamicExplanationScene } from './dynamicExplanation'

export type { DynamicExplanationData, DynamicExplanationScene } from './dynamicExplanation'

export type DynamicExplanationProgress = {
  activeSceneId: string
  completedSceneIds: string[]
  isCompleted: boolean
  checkpoints?: Record<string, DynamicExplanationCheckpoint>
}

type DynamicExplanationPlayerProps = {
  data: DynamicExplanationData
  language: 'zh-CN' | 'en'
  onSceneStarted?: (scene: DynamicExplanationScene, index: number) => void
  onSceneCompleted?: (scene: DynamicExplanationScene, index: number) => void
  onCompleted?: () => void
  progress?: DynamicExplanationProgress
  onProgressChange?: (progress: DynamicExplanationProgress) => void
  onCheckpoint?: (scene: DynamicExplanationScene, answer: string) => void
  onSavePresentation?: (presentation: DynamicExplanationData) => Promise<void>
  onRegenerateScene?: (presentation: DynamicExplanationData, scene: DynamicExplanationScene) => Promise<DynamicExplanationScene>
  saving?: boolean
  saveAsVersion?: boolean
  openImmersiveRequest?: number
}

type SceneVisualProps = {
  scene: DynamicExplanationScene
  language: DynamicExplanationPlayerProps['language']
  selectedItem: number
  onSelectItem: (index: number) => void
}

const constellationPositions = [
  ['18%', '20%'], ['78%', '18%'], ['84%', '63%'], ['59%', '82%'], ['13%', '69%'],
]
const emptyProgressSceneIds: string[] = []

const visualTypeOptions: Array<{ id: DynamicExplanationScene['visual_type']; zh: string; en: string }> = [
  { id: 'concept', zh: '概念星图', en: 'Concept constellation' },
  { id: 'journey', zh: '过程路径', en: 'Process journey' },
  { id: 'sequence', zh: '步骤推演', en: 'Step sequence' },
  { id: 'stack', zh: '层级调用', en: 'Layer stack' },
  { id: 'contrast', zh: '前后对比', en: 'Before and after' },
  { id: 'lab', zh: '例子实验台', en: 'Example lab' },
  { id: 'error-lab', zh: '易错实验', en: 'Misconception lab' },
  { id: 'code-trace', zh: '代码推演', en: 'Code trace' },
  { id: 'timeline', zh: '时间脉络', en: 'Timeline' },
  { id: 'network', zh: '节点流动', en: 'Network flow' },
  { id: 'map', zh: '知识收束', en: 'Knowledge map' },
]

type LearningMode = 'quick' | 'guided' | 'challenge'

const learningModes: Array<{ id: LearningMode; zh: string; en: string; descriptionZh: string; descriptionEn: string }> = [
  { id: 'quick', zh: '快速看懂', en: 'Quick view', descriptionZh: '只走关键场景，先建立整体理解。', descriptionEn: 'Take the essential scenes first.' },
  { id: 'guided', zh: '跟着推演', en: 'Guided walkthrough', descriptionZh: '完整走一遍过程与关键细节。', descriptionEn: 'Walk through the full reasoning.' },
  { id: 'challenge', zh: '考前自测', en: 'Exam challenge', descriptionZh: '先预测，再展开讲解验证想法。', descriptionEn: 'Predict first, then reveal the reasoning.' },
]

function formatDuration(seconds: number, language: DynamicExplanationPlayerProps['language']) {
  const minutes = Math.max(1, Math.round(seconds / 60))
  return language === 'en' ? `about ${minutes} min` : `约 ${minutes} 分钟`
}

function visualItems(scene: DynamicExplanationScene) {
  return scene.visual.items.length ? scene.visual.items : [scene.key_point]
}

function SceneVisual({ scene, language, selectedItem, onSelectItem }: SceneVisualProps) {
  const tr = (chinese: string, english: string) => language === 'en' ? english : chinese
  const visual = scene.visual
  const items = useMemo(() => visualItems(scene), [scene])
  const [sequenceOrder, setSequenceOrder] = useState<string[]>(items)
  const [draggedSequenceItem, setDraggedSequenceItem] = useState<string | null>(null)
  useEffect(() => {
    setSequenceOrder(items)
    setDraggedSequenceItem(null)
  }, [scene.id, items])
  const selected = items[Math.min(selectedItem, items.length - 1)] || scene.key_point
  const clickItem = (index: number) => onSelectItem(index)

  if (scene.visual_type === 'sequence' || scene.visual_type === 'journey') {
    const displayedItems = scene.visual_type === 'sequence' && sequenceOrder.length ? sequenceOrder : items
    const reorderStep = (target: string) => {
      if (scene.visual_type !== 'sequence' || !draggedSequenceItem || draggedSequenceItem === target) return
      setSequenceOrder(current => {
        const next = [...current]
        const from = next.indexOf(draggedSequenceItem)
        const to = next.indexOf(target)
        if (from < 0 || to < 0) return current
        next.splice(from, 1)
        next.splice(to, 0, draggedSequenceItem)
        return next
      })
      setDraggedSequenceItem(null)
    }
    return (
      <div className={scene.visual_type === 'sequence' ? 'presentation-visual presentation-journey sequence-sorting' : 'presentation-visual presentation-journey'} aria-label={tr('步骤演示', 'Step-by-step demonstration')}>
        <div className="journey-line" aria-hidden="true" />
        {displayedItems.map((item, index) => (
          <button
            className={items.indexOf(item) === selectedItem ? 'journey-stop active' : 'journey-stop'}
            key={`${item}-${index}`}
            style={{ '--journey-position': `${10 + (index * 80) / Math.max(displayedItems.length - 1, 1)}%` } as CSSProperties}
            type="button"
            draggable={scene.visual_type === 'sequence'}
            onDragStart={() => setDraggedSequenceItem(item)}
            onDragOver={event => event.preventDefault()}
            onDrop={() => reorderStep(item)}
            onDragEnd={() => setDraggedSequenceItem(null)}
            onClick={() => clickItem(items.indexOf(item))}
          >
            <span>{index + 1}</span>
            <strong>{item}</strong>
          </button>
        ))}
        <div className="journey-focus">
          <span>{scene.visual_type === 'sequence' ? tr('可拖动排序，按你的理解整理步骤', 'Drag to sort the steps your way') : tr('当前推演', 'Current step')}</span>
          <strong>{selected}</strong>
          <p>{visual.example || scene.key_point}</p>
        </div>
      </div>
    )
  }

  if (scene.visual_type === 'stack') {
    return (
      <div className="presentation-visual presentation-stack" aria-label={tr('层级过程', 'Layered process')}>
        <div className="stack-caption"><span>{visual.headline}</span><strong>{tr('逐层展开，再逐层返回', 'Expand layer by layer, then return')}</strong></div>
        <div className="stack-layers">
          {items.map((item, index) => (
            <button
              className={index === selectedItem ? 'stack-layer active' : 'stack-layer'}
              style={{ '--layer-offset': `${index * 13}px` } as CSSProperties}
              key={`${item}-${index}`}
              type="button"
              onClick={() => clickItem(index)}
            >
              <span>{items.length - index}</span><strong>{item}</strong>
            </button>
          ))}
        </div>
        <p className="stack-detail">{visual.example || selected}</p>
      </div>
    )
  }

  if (scene.visual_type === 'code-trace') {
    return (
      <div className="presentation-visual presentation-code-trace" aria-label={tr('代码与状态推演', 'Code and state trace')}>
        <div className="code-trace-heading"><span>{tr('逐步执行', 'Trace it')}</span><strong>{visual.headline}</strong></div>
        <div className="code-trace-lines">
          {items.map((item, index) => (
            <button className={index === selectedItem ? 'code-trace-line active' : 'code-trace-line'} key={`${item}-${index}`} type="button" onClick={() => clickItem(index)}>
              <i>{String(index + 1).padStart(2, '0')}</i><code>{item}</code>
            </button>
          ))}
        </div>
        <div className="code-trace-inspector"><span>{tr('当前状态', 'Current state')}</span><strong>{visual.example || selected}</strong></div>
      </div>
    )
  }

  if (scene.visual_type === 'timeline') {
    return (
      <div className="presentation-visual presentation-timeline" aria-label={tr('时间与阶段脉络', 'Timeline and stages')}>
        <div className="timeline-heading"><span>{tr('按顺序理解', 'Read in order')}</span><strong>{visual.headline}</strong></div>
        <div className="timeline-track" aria-hidden="true" />
        <div className="timeline-stops">
          {items.map((item, index) => (
            <button className={index === selectedItem ? 'timeline-stop active' : 'timeline-stop'} key={`${item}-${index}`} type="button" onClick={() => clickItem(index)}>
              <i>{index + 1}</i><span>{item}</span>
            </button>
          ))}
        </div>
        <p>{visual.example || selected}</p>
      </div>
    )
  }

  if (scene.visual_type === 'network') {
    return (
      <div className="presentation-visual presentation-network" aria-label={tr('节点流动图', 'Network flow')}>
        <div className="network-core"><span>{tr('流动的核心', 'Flow center')}</span><strong>{visual.headline}</strong></div>
        <div className="network-routes" aria-hidden="true"><i /><i /><i /></div>
        <div className="network-nodes">
          {items.map((item, index) => (
            <button className={index === selectedItem ? 'network-node active' : 'network-node'} key={`${item}-${index}`} type="button" onClick={() => clickItem(index)}>
              <i>{index + 1}</i><span>{item}</span>
            </button>
          ))}
        </div>
        <p>{visual.example || selected}</p>
      </div>
    )
  }

  if (scene.visual_type === 'compare' || scene.visual_type === 'contrast') {
    return (
      <div className="presentation-visual presentation-contrast" aria-label={tr('对比演示', 'Comparison')}>
        <button className={selectedItem === 0 ? 'contrast-field is-active' : 'contrast-field'} type="button" onClick={() => clickItem(0)}>
          <span>{tr('开始时', 'Before')}</span>
          <strong>{visual.before || items[0]}</strong>
        </button>
        <div className="contrast-pivot" aria-hidden="true"><span>{tr('理解发生在这里', 'The shift happens here')}</span></div>
        <button className={selectedItem === 1 ? 'contrast-field is-active' : 'contrast-field'} type="button" onClick={() => clickItem(1)}>
          <span>{tr('看清后', 'After')}</span>
          <strong>{visual.after || scene.key_point}</strong>
        </button>
      </div>
    )
  }

  if (scene.visual_type === 'example' || scene.visual_type === 'lab') {
    return (
      <div className="presentation-visual presentation-lab" aria-label={tr('例子实验台', 'Example workspace')}>
        <div className="lab-heading"><span>{tr('把概念放进一个具体场景', 'Put the idea into a concrete situation')}</span><strong>{visual.headline}</strong></div>
        <div className="lab-tokens">
          {items.map((item, index) => (
            <button key={`${item}-${index}`} type="button" className={index === selectedItem ? 'lab-token active' : 'lab-token'} onClick={() => clickItem(index)}>
              <i>{index + 1}</i>{item}
            </button>
          ))}
        </div>
        <div className="lab-answer"><span>{tr('观察', 'Observation')}</span><strong>{visual.example || selected}</strong></div>
      </div>
    )
  }

  if (scene.visual_type === 'pitfall' || scene.visual_type === 'error-lab') {
    return (
      <div className="presentation-visual presentation-pitfall" aria-label={tr('易错点实验', 'Common pitfall')}>
        <div className="pitfall-route danger"><span>{tr('容易走偏', 'The wrong path')}</span><strong>{visual.headline}</strong><p>{items[0] || scene.key_point}</p></div>
        <div className="pitfall-turn" aria-hidden="true"><i /></div>
        <div className="pitfall-route safe"><span>{tr('回到判断', 'The recovery')}</span><strong>{visual.after || scene.key_point}</strong><p>{visual.example || tr('找到能停止或校正的条件，再继续往下推。', 'Find the condition that stops or corrects the process, then continue.')}</p></div>
      </div>
    )
  }

  if (scene.visual_type === 'map' || scene.visual_type === 'recap') {
    return (
      <div className="presentation-visual presentation-map" aria-label={tr('知识收束图', 'Knowledge recap')}>
        <div className="map-center"><span>{tr('带走这一句', 'Take this with you')}</span><strong>{visual.headline}</strong></div>
        <div className="map-branches">
          {items.map((item, index) => (
            <button className={index === selectedItem ? 'map-branch active' : 'map-branch'} key={`${item}-${index}`} type="button" onClick={() => clickItem(index)}>
              <i>{index + 1}</i><span>{item}</span>
            </button>
          ))}
        </div>
        <p>{visual.example || selected}</p>
      </div>
    )
  }

  return (
    <div className="presentation-visual presentation-constellation" aria-label={tr('概念关系图', 'Concept constellation')}>
      <div className="constellation-orbit orbit-one" aria-hidden="true" />
      <div className="constellation-orbit orbit-two" aria-hidden="true" />
      <div className="constellation-core"><span>{tr('核心', 'Core')}</span><strong>{visual.headline}</strong></div>
      {items.slice(0, 5).map((item, index) => {
        const [x, y] = constellationPositions[index]
        return (
          <button
            className={index === selectedItem ? 'constellation-node active' : 'constellation-node'}
            key={`${item}-${index}`}
            style={{ '--node-x': x, '--node-y': y, '--node-delay': `${index * 110}ms` } as CSSProperties}
            type="button"
            onClick={() => clickItem(index)}
          >
            <i>{index + 1}</i><span>{item}</span>
          </button>
        )
      })}
      <p className="constellation-detail">{visual.example || selected}</p>
    </div>
  )
}

export function DynamicExplanationPlayer({ data, language, onSceneStarted, onSceneCompleted, onCompleted, progress, onProgressChange, onCheckpoint, onSavePresentation, onRegenerateScene, saving = false, saveAsVersion = true, openImmersiveRequest }: DynamicExplanationPlayerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [selectedVisualItem, setSelectedVisualItem] = useState(0)
  const [immersive, setImmersive] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [presentationDraft, setPresentationDraft] = useState<DynamicExplanationData | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [sceneRegenerating, setSceneRegenerating] = useState(false)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [completionNotice, setCompletionNotice] = useState<'earlier' | 'overview' | null>(null)
  const [learningMode, setLearningMode] = useState<LearningMode>('guided')
  const [revealedSceneIds, setRevealedSceneIds] = useState<Record<string, boolean>>({})
  const [remedialBySceneId, setRemedialBySceneId] = useState<Record<string, string>>({})
  const [, setProgressRevision] = useState(0)
  const startedScenes = useRef(new Set<string>())
  const completedScenes = useRef(new Set<string>())
  const completedExplanation = useRef(false)
  // The library parses saved JSON on every parent render. Its object reference can
  // change while the presentation itself has not, so use the content as the reset
  // boundary rather than the transient object identity.
  const dataFingerprint = JSON.stringify(data)
  const presentation = presentationDraft || data
  const visibleSceneIndexes = useMemo(() => {
    const all = presentation.scenes.map((_, index) => index)
    if (learningMode !== 'quick' || all.length <= 3) return all
    return [...new Set([0, Math.round((all.length - 1) / 2), all.length - 1])]
  }, [learningMode, presentation.scenes])
  const activeVisibleIndex = Math.max(0, visibleSceneIndexes.indexOf(activeIndex))
  const scene = presentation.scenes[activeIndex]
  const totalSeconds = useMemo(
    () => presentation.scenes.reduce((total, item) => total + Math.max(20, Number(item.suggested_seconds) || 42), 0),
    [presentation.scenes],
  )
  const tr = (chinese: string, english: string) => language === 'en' ? english : chinese
  const editorFailureMessage = (error: unknown, chinese: string, english: string) => (
    error instanceof Error && error.message && error.message !== 'Not Found'
      ? error.message
      : tr(chinese, english)
  )

  const progressActiveSceneId = progress?.activeSceneId || ''
  const progressCompletedSceneIds = progress?.completedSceneIds || emptyProgressSceneIds
  const progressIsCompleted = Boolean(progress?.isCompleted)

  useEffect(() => {
    setActiveIndex(0)
    setPlaying(false)
    setAnswers({})
    setSelectedVisualItem(0)
    setImmersive(false)
    setEditorOpen(false)
    setPresentationDraft(null)
    setDraggedIndex(null)
    setEditorError(null)
    setCompletionNotice(null)
    setLearningMode('guided')
    setRevealedSceneIds({})
    setRemedialBySceneId({})
    startedScenes.current.clear()
    completedScenes.current.clear()
    completedExplanation.current = false
  }, [dataFingerprint])

  useEffect(() => {
    if (!visibleSceneIndexes.includes(activeIndex)) {
      setActiveIndex(visibleSceneIndexes[0] || 0)
      setSelectedVisualItem(0)
    }
  }, [activeIndex, visibleSceneIndexes])

  useEffect(() => {
    if (presentationDraft) return
    const validSceneIds = new Set(data.scenes.map(item => item.id))
    const restoredCompleted = new Set(progressCompletedSceneIds.filter(id => validSceneIds.has(id)))
    const restoredIndex = data.scenes.findIndex(item => item.id === progressActiveSceneId)
    completedScenes.current = restoredCompleted
    completedExplanation.current = Boolean(progressIsCompleted && restoredCompleted.size === data.scenes.length)
    if (restoredIndex >= 0) setActiveIndex(restoredIndex)
    setProgressRevision(current => current + 1)
  }, [data, presentationDraft, progressActiveSceneId, progressCompletedSceneIds, progressIsCompleted])

  useEffect(() => {
    if (!scene || startedScenes.current.has(scene.id)) return
    startedScenes.current.add(scene.id)
    onSceneStarted?.(scene, activeIndex)
    if (!progressActiveSceneId) {
      onProgressChange?.({
        activeSceneId: scene.id,
        completedSceneIds: [...completedScenes.current],
        isCompleted: completedExplanation.current,
      })
    }
  }, [activeIndex, onProgressChange, onSceneStarted, progressActiveSceneId, scene])

  const completeScene = useCallback((index: number) => {
    const current = presentation.scenes[index]
    if (!current || completedScenes.current.has(current.id)) return
    completedScenes.current.add(current.id)
    setProgressRevision(value => value + 1)
    onSceneCompleted?.(current, index)
  }, [onSceneCompleted, presentation.scenes])

  const reportProgress = useCallback((index: number) => {
    const current = presentation.scenes[index]
    if (!current) return
    onProgressChange?.({
      activeSceneId: current.id,
      completedSceneIds: [...completedScenes.current],
      isCompleted: presentation.scenes.length > 0 && completedScenes.current.size === presentation.scenes.length,
    })
  }, [onProgressChange, presentation.scenes])

  const completeExplanation = useCallback(() => {
    completeScene(activeIndex)
    reportProgress(activeIndex)
    setPlaying(false)
    const completedRoute = visibleSceneIndexes.every(index => completedScenes.current.has(presentation.scenes[index]?.id))
    if (!completedRoute) {
      setCompletionNotice('earlier')
      return
    }
    if (completedScenes.current.size !== presentation.scenes.length) {
      setCompletionNotice('overview')
      return
    }
    if (completedExplanation.current) return
    completedExplanation.current = true
    setCompletionNotice(null)
    onCompleted?.()
  }, [activeIndex, completeScene, onCompleted, presentation.scenes, reportProgress, visibleSceneIndexes])

  const moveTo = useCallback((nextIndex: number) => {
    if (!scene) return
    completeScene(activeIndex)
    setCompletionNotice(null)
    if (nextIndex >= presentation.scenes.length) {
      completeExplanation()
      return
    }
    setActiveIndex(Math.max(0, nextIndex))
    setSelectedVisualItem(0)
    reportProgress(Math.max(0, nextIndex))
  }, [activeIndex, completeExplanation, completeScene, presentation.scenes.length, reportProgress, scene])

  useEffect(() => {
    if (!playing || !scene) return undefined
    const nextIndex = visibleSceneIndexes[activeVisibleIndex + 1] ?? presentation.scenes.length
    const timeout = window.setTimeout(() => moveTo(nextIndex), Math.max(9000, (scene.suggested_seconds || 42) * 1000))
    return () => window.clearTimeout(timeout)
  }, [activeVisibleIndex, moveTo, playing, presentation.scenes.length, scene, visibleSceneIndexes])

  useEffect(() => {
    if (!immersive) return undefined
    document.body.classList.add('interactive-presentation-open')
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImmersive(false)
      if (event.key === 'ArrowRight') moveTo(visibleSceneIndexes[activeVisibleIndex + 1] ?? presentation.scenes.length)
      if (event.key === 'ArrowLeft') moveTo(visibleSceneIndexes[Math.max(0, activeVisibleIndex - 1)] ?? 0)
      if (event.key === ' ' && event.target === document.body) {
        event.preventDefault()
        setPlaying(value => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('interactive-presentation-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [activeVisibleIndex, immersive, moveTo, presentation.scenes.length, visibleSceneIndexes])

  useEffect(() => {
    if (openImmersiveRequest) setImmersive(true)
  }, [openImmersiveRequest])

  if (!scene) return null

  const updateCurrentScene = (update: (current: DynamicExplanationScene) => DynamicExplanationScene) => {
    setEditorError(null)
    setPresentationDraft(current => {
      const base = current || data
      return {
        ...base,
        scenes: base.scenes.map((item, index) => index === activeIndex ? update(item) : item),
      }
    })
  }

  const moveScene = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= presentation.scenes.length) return
    const scenes = [...presentation.scenes]
    const [moved] = scenes.splice(fromIndex, 1)
    scenes.splice(toIndex, 0, moved)
    setPresentationDraft({ ...presentation, scenes })
    setEditorError(null)
    if (activeIndex === fromIndex) setActiveIndex(toIndex)
    else if (fromIndex < activeIndex && toIndex >= activeIndex) setActiveIndex(activeIndex - 1)
    else if (fromIndex > activeIndex && toIndex <= activeIndex) setActiveIndex(activeIndex + 1)
  }

  const savePresentation = async () => {
    if (!onSavePresentation || !presentationDraft) return
    setEditorError(null)
    try {
      await onSavePresentation(presentation)
      setPresentationDraft(null)
      setEditorOpen(false)
    } catch (error) {
      setEditorError(editorFailureMessage(error, '互动演示暂时无法保存，请稍后再试。', 'This presentation cannot be saved right now. Please try again.'))
    }
  }

  const regenerateCurrentScene = async () => {
    if (!onRegenerateScene || sceneRegenerating) return
    setSceneRegenerating(true)
    setEditorError(null)
    try {
      const regenerated = await onRegenerateScene(presentation, scene)
      updateCurrentScene(() => regenerated)
    } catch (error) {
      setEditorError(editorFailureMessage(error, 'AI 暂时无法重做这一页，请稍后再试。', 'AI could not remake this page. Please try again.'))
    } finally {
      setSceneRegenerating(false)
    }
  }

  const selectedAnswer = answers[scene.id]
  const checked = Boolean(selectedAnswer)
  const isLastScene = activeVisibleIndex === visibleSceneIndexes.length - 1
  const completedSceneCount = presentation.scenes.filter(item => completedScenes.current.has(item.id)).length
  const palette = presentation.palette || 'sage'
  const selectedMode = learningModes.find(item => item.id === learningMode) || learningModes[1]
  const showNarration = learningMode !== 'challenge' || Boolean(revealedSceneIds[scene.id])
  const currentRemedialAnswer = remedialBySceneId[scene.id]
  const persistedCheckpoint = progress?.checkpoints?.[scene.id]

  const chooseLearningMode = (mode: LearningMode) => {
    setLearningMode(mode)
    setPlaying(false)
    setCompletionNotice(null)
  }

  const answerCheckpoint = (answer: string) => {
    if (!scene.check || checked) return
    const correct = answer === scene.check.answer
    setAnswers(current => ({ ...current, [scene.id]: answer }))
    setRevealedSceneIds(current => ({ ...current, [scene.id]: true }))
    if (correct) setRemedialBySceneId(current => {
      const next = { ...current }
      delete next[scene.id]
      return next
    })
    else setRemedialBySceneId(current => ({ ...current, [scene.id]: answer }))
    onCheckpoint?.(scene, answer)
  }

  const learningModeControl = (surface: 'preview' | 'immersive') => (
    <div className={`presentation-learning-modes ${surface}`} aria-label={tr('选择学习节奏', 'Choose learning pace')}>
      <span>{tr('学习节奏', 'Learning pace')}</span>
      <div>
        {learningModes.map(item => (
          <button
            type="button"
            key={item.id}
            className={learningMode === item.id ? 'active' : ''}
            aria-pressed={learningMode === item.id}
            onClick={() => chooseLearningMode(item.id)}
          >
            {item.id === 'quick' ? <FastForward size={13} /> : item.id === 'guided' ? <Gauge size={13} /> : <Target size={13} />}
            {tr(item.zh, item.en)}
          </button>
        ))}
      </div>
      <p>{tr(selectedMode.descriptionZh, selectedMode.descriptionEn)}</p>
    </div>
  )

  const controls = (mode: 'preview' | 'immersive') => (
    <div className={`presentation-controls ${mode}`}>
      <button type="button" onClick={() => moveTo(visibleSceneIndexes[Math.max(0, activeVisibleIndex - 1)] ?? 0)} disabled={activeVisibleIndex === 0}><ChevronLeft size={16} />{tr('上一页', 'Previous')}</button>
      <span>{activeVisibleIndex + 1} / {visibleSceneIndexes.length}{learningMode === 'quick' ? tr(' · 快速路径', ' · quick path') : ''}</span>
      {isLastScene ? (
        <button className="presentation-finish" type="button" onClick={completeExplanation}><Check size={16} />{tr('完成讲解', 'Complete')}</button>
      ) : (
        <button className="presentation-next" type="button" onClick={() => moveTo(visibleSceneIndexes[activeVisibleIndex + 1] ?? presentation.scenes.length)}>{tr('下一页', 'Next')}<ChevronRight size={16} /></button>
      )}
      <button className="presentation-restart" type="button" onClick={() => { setPlaying(false); setActiveIndex(visibleSceneIndexes[0] || 0); setSelectedVisualItem(0); setCompletionNotice(null) }} aria-label={tr('从头播放', 'Restart')}><RotateCcw size={15} /></button>
      {completionNotice && !completedExplanation.current && <p className="presentation-completion-reminder" role="status">{completionNotice === 'overview'
        ? tr('快速路径已经走完。切换到“跟着推演”后，完成剩余场景即可结束整段讲解。', 'Quick view is complete. Switch to guided walkthrough to finish the remaining scenes.')
        : tr('先完成当前学习路径中的前面场景，再结束本次讲解。', 'Complete the earlier scenes in this learning path before finishing.')}</p>}
    </div>
  )

  const understandingCheck = scene.check && (
    <section className="presentation-check" aria-label={tr('理解检查', 'Understanding check')}>
      <div><span>{tr('停一下，先判断', 'Pause and predict')}</span><p>{scene.check.prompt}</p>{persistedCheckpoint && <small>{persistedCheckpoint.correct ? tr('此前已答对，可再做一次确认理解。', 'Previously confirmed. Try it once more to verify.') : tr(`此前已尝试 ${persistedCheckpoint.attempts} 次，这次换一种思路。`, `Tried ${persistedCheckpoint.attempts} time(s) before. Try a different line of thought.`)}</small>}</div>
      <div className="presentation-check-options">
        {scene.check.options.map(option => {
          const correct = checked && option === scene.check?.answer
          const incorrect = checked && option === selectedAnswer && option !== scene.check?.answer
          return (
            <button
              key={option}
              type="button"
              disabled={checked}
              className={correct ? 'correct' : incorrect ? 'incorrect' : ''}
              onClick={() => answerCheckpoint(option)}
            >
              {correct && <Check size={14} />}{option}
            </button>
          )
        })}
      </div>
      {checked && <p className="presentation-check-feedback">{scene.check.explanation}</p>}
      {currentRemedialAnswer && selectedAnswer && scene.check && (
        <aside className="presentation-adaptive-coach" aria-label={tr('自动补讲', 'Adaptive follow-up')}>
          <div><span><Lightbulb size={14} />{tr('自动补讲', 'Adaptive follow-up')}</span><strong>{tr('先把错因看清，再带着这一点继续推演。', 'See why this went wrong, then continue with the corrected idea.')}</strong></div>
          <p>{tr(`你选择了“${currentRemedialAnswer}”。正确判断是“${scene.check.answer}”。`, `You chose “${currentRemedialAnswer}”. The correct choice is “${scene.check.answer}”.`)}</p>
          <button type="button" onClick={() => { setSelectedVisualItem(0); setAnswers(current => { const next = { ...current }; delete next[scene.id]; return next }); setRemedialBySceneId(current => { const next = { ...current }; delete next[scene.id]; return next }) }}><Eye size={14} />{tr('带着提示再答一次', 'Try again with this hint')}</button>
        </aside>
      )}
    </section>
  )

  const immersiveStage = (
    <section className={`interactive-presentation palette-${palette}`} aria-label={tr('互动学习演示', 'Interactive learning presentation')}>
      <header className="presentation-topbar">
        <button className="presentation-exit" type="button" onClick={() => setImmersive(false)}><X size={17} />{tr('退出演示', 'Exit')}</button>
        <div><span>{tr('互动学习演示', 'Interactive learning presentation')}</span><strong>{presentation.title}</strong></div>
        <div className="presentation-top-actions">
          {onSavePresentation && <button className={editorOpen ? 'presentation-edit active' : 'presentation-edit'} type="button" aria-pressed={editorOpen} onClick={() => { setEditorOpen(value => !value); setEditorError(null) }}><PenLine size={15} />{editorOpen ? tr('继续播放', 'Resume') : tr('编辑演示', 'Edit')}</button>}
          <button className={playing ? 'presentation-autoplay active' : 'presentation-autoplay'} type="button" aria-pressed={playing} onClick={() => setPlaying(value => !value)}>
            {playing ? <CirclePause size={16} /> : <CirclePlay size={16} />}{playing ? tr('暂停', 'Pause') : tr('自动播放', 'Autoplay')}
          </button>
        </div>
      </header>

      {learningModeControl('immersive')}
      <nav className="presentation-scene-nav" aria-label={tr('演示目录', 'Presentation outline')}>
        {visibleSceneIndexes.map((index, visibleIndex) => {
          const item = presentation.scenes[index]
          return (
          <button className={index === activeIndex ? 'active' : completedScenes.current.has(item.id) ? 'completed' : index < activeIndex ? 'visited' : ''} type="button" key={item.id} aria-current={index === activeIndex ? 'step' : undefined} onClick={() => moveTo(index)}>
            <i>{visibleIndex + 1}</i><span>{item.title}</span>
          </button>
          )
        })}
      </nav>

      <main className={`presentation-main visual-${scene.visual_type} learning-mode-${learningMode}`} key={scene.id}>
        <div className="presentation-story">
          <span>{learningMode === 'challenge' && !showNarration ? tr('先预测，再验证', 'Predict, then verify') : tr('此刻要看懂', 'What to understand now')}</span>
          <h1>{scene.title}</h1>
          {showNarration
            ? <p>{scene.narration}</p>
            : <div className="presentation-prediction">
                <p>{scene.check?.prompt || tr('先暂停十秒，用自己的话预测：这一幕接下来要证明、变化或避免的是什么？', 'Pause for ten seconds and predict what this scene will prove, change, or prevent.')}</p>
                <button type="button" onClick={() => setRevealedSceneIds(current => ({ ...current, [scene.id]: true }))}><Eye size={14} />{tr('展开讲解验证想法', 'Reveal the explanation')}</button>
              </div>}
          <strong><Sparkles size={15} />{scene.key_point}</strong>
        </div>
        <SceneVisual scene={scene} language={language} selectedItem={selectedVisualItem} onSelectItem={setSelectedVisualItem} />
      </main>

      {editorOpen && onSavePresentation && (
        <aside className="presentation-editor-panel" aria-label={tr('编辑互动演示', 'Edit interactive presentation')}>
          <header className="presentation-editor-head">
            <div><h2>{tr('编辑演示', 'Edit presentation')}</h2><p>{tr('调整顺序、改写内容，或让 AI 只重做这一页。', 'Reorder scenes, refine the content, or ask AI to remake only this page.')}</p></div>
            <button type="button" onClick={() => { setEditorOpen(false); setEditorError(null) }} aria-label={tr('关闭编辑器', 'Close editor')}><X size={17} /></button>
          </header>

          <div className="presentation-editor-body">
            <section className="editor-scene-list" aria-label={tr('演示页面顺序', 'Presentation scene order')}>
              {presentation.scenes.map((item, index) => (
                <div
                  className={index === activeIndex ? 'editor-scene-row active' : 'editor-scene-row'}
                  draggable
                  key={item.id}
                  onDragStart={() => setDraggedIndex(index)}
                  onDragOver={event => event.preventDefault()}
                  onDrop={() => {
                    if (draggedIndex !== null) moveScene(draggedIndex, index)
                    setDraggedIndex(null)
                  }}
                  onDragEnd={() => setDraggedIndex(null)}
                >
                  <span className="editor-drag" aria-hidden="true"><GripVertical size={14} /></span>
                  <button type="button" onClick={() => { setActiveIndex(index); setSelectedVisualItem(0) }}><i>{index + 1}</i><span>{item.title}</span></button>
                  <div className="editor-scene-order">
                    <button type="button" disabled={index === 0} onClick={() => moveScene(index, index - 1)} aria-label={tr('上移本页', 'Move scene up')}><ArrowUp size={13} /></button>
                    <button type="button" disabled={index === presentation.scenes.length - 1} onClick={() => moveScene(index, index + 1)} aria-label={tr('下移本页', 'Move scene down')}><ArrowDown size={13} /></button>
                  </div>
                </div>
              ))}
            </section>

            <section className="editor-scene-form" aria-label={tr('编辑当前页面', 'Edit current scene')}>
              <label>{tr('本页标题', 'Scene title')}<input value={scene.title} maxLength={52} onChange={event => updateCurrentScene(current => ({ ...current, title: event.target.value }))} /></label>
              <label>{tr('讲解文字', 'Narration')}<textarea value={scene.narration} maxLength={420} rows={5} onChange={event => updateCurrentScene(current => ({ ...current, narration: event.target.value }))} /></label>
              <label>{tr('要记住的一句', 'Key takeaway')}<textarea value={scene.key_point} maxLength={110} rows={2} onChange={event => updateCurrentScene(current => ({ ...current, key_point: event.target.value }))} /></label>
              <label>{tr('画面结构', 'Visual format')}<select value={scene.visual_type} onChange={event => updateCurrentScene(current => ({ ...current, visual_type: event.target.value as DynamicExplanationScene['visual_type'] }))}>{visualTypeOptions.map(option => <option key={option.id} value={option.id}>{tr(option.zh, option.en)}</option>)}</select></label>
              <label>{tr('画面主标题', 'Visual headline')}<input value={scene.visual.headline} maxLength={92} onChange={event => updateCurrentScene(current => ({ ...current, visual: { ...current.visual, headline: event.target.value } }))} /></label>
              <label>{tr('画面节点', 'Visual points')}<textarea value={scene.visual.items.join('\n')} rows={4} placeholder={tr('每行一个节点', 'One point per line')} onChange={event => updateCurrentScene(current => ({ ...current, visual: { ...current.visual, items: event.target.value.split('\n').map(item => item.trim()).filter(Boolean).slice(0, 5) } }))} /></label>
            </section>
          </div>

          <footer className="presentation-editor-actions">
            {editorError && <p className="presentation-editor-error" role="alert">{editorError}</p>}
            {onRegenerateScene && <button type="button" disabled={sceneRegenerating || saving} onClick={() => void regenerateCurrentScene()}><Sparkles size={15} />{sceneRegenerating ? tr('正在重做本页', 'Remaking this scene') : tr('AI 重做本页', 'Remake this scene')}</button>}
            <button className="editor-save" type="button" disabled={!presentationDraft || saving} onClick={() => void savePresentation()}><Save size={15} />{saving ? tr('保存中', 'Saving') : saveAsVersion ? tr('保存为新版本', 'Save as new version') : tr('保存编辑', 'Save edits')}</button>
          </footer>
        </aside>
      )}

      {understandingCheck}
      {controls('immersive')}
    </section>
  )

  return (
    <section className={`dynamic-explanation-player palette-${palette}`} aria-label={tr('互动学习演示', 'Interactive learning presentation')}>
      <header className="dynamic-player-head">
        <div>
          <span>{tr(`${presentation.scenes.length} 个场景 · ${formatDuration(totalSeconds, language)}${completedSceneCount ? ` · 已完成 ${completedSceneCount}/${presentation.scenes.length}` : ''}`, `${presentation.scenes.length} scenes · ${formatDuration(totalSeconds, language)}${completedSceneCount ? ` · ${completedSceneCount}/${presentation.scenes.length} complete` : ''}`)}</span>
          <h2>{presentation.title}</h2>
          <p>{presentation.summary}</p>
        </div>
        <button className="presentation-open" type="button" onClick={() => setImmersive(true)}><Maximize2 size={16} />{tr(activeIndex > 0 && !completedExplanation.current ? '继续学习' : '沉浸学习', activeIndex > 0 && !completedExplanation.current ? 'Continue learning' : 'Open immersive view')}</button>
      </header>

      {learningModeControl('preview')}

      <div className={`presentation-preview-canvas learning-mode-${learningMode}`}>
        <div className="presentation-preview-copy"><span>{tr('当前场景', 'Current scene')}</span><strong>{scene.title}</strong><p>{scene.key_point}</p></div>
        <SceneVisual scene={scene} language={language} selectedItem={selectedVisualItem} onSelectItem={setSelectedVisualItem} />
      </div>

      <div className="presentation-preview-footer">
        <div className="presentation-scene-peek" aria-label={tr('场景目录', 'Scene outline')}>
          {visibleSceneIndexes.map((index, visibleIndex) => {
            const item = presentation.scenes[index]
            return <button type="button" className={index === activeIndex ? 'active' : completedScenes.current.has(item.id) ? 'completed' : ''} key={item.id} onClick={() => moveTo(index)}><i>{visibleIndex + 1}</i><span>{item.title}</span></button>
          })}
        </div>
        <button className={playing ? 'dynamic-autoplay active' : 'dynamic-autoplay'} type="button" aria-pressed={playing} onClick={() => setPlaying(value => !value)}>{playing ? <CirclePause size={15} /> : <CirclePlay size={15} />}{playing ? tr('暂停', 'Pause') : tr('自动播放', 'Autoplay')}</button>
      </div>

      {immersive && createPortal(<div className="interactive-presentation-layer" role="dialog" aria-modal="true">{immersiveStage}</div>, document.body)}
    </section>
  )
}
