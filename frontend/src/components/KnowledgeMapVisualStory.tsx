import { AlertTriangle, ArrowDown, ArrowRight, Braces, ChevronDown, ChevronUp, FlaskConical, GitBranch, Sigma } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type TouchEvent, type WheelEvent } from 'react'
import type { KnowledgeMapData, KnowledgeMapNode, KnowledgeMapVisualScene, KnowledgeMapVisualSceneKind } from './EditableKnowledgeMap'
import { FormulaText } from './FormulaText'

type StoryScene = KnowledgeMapVisualScene & { nodes: KnowledgeMapNode[]; supportingNodes: KnowledgeMapNode[] }

const sceneThemes: Record<KnowledgeMapVisualSceneKind, NonNullable<KnowledgeMapVisualScene['theme']>> = {
  flow_route: 'cobalt', stack_tower: 'violet', input_output_lab: 'teal', compare_split: 'amber',
  formula_board: 'ink', code_trace: 'coral', cause_chain: 'lime', pitfall_fork: 'rose',
}

const sceneLabels: Record<KnowledgeMapVisualSceneKind, { zh: string; en: string }> = {
  flow_route: { zh: '过程路线', en: 'Process route' }, stack_tower: { zh: '层级展开', en: 'Layered stack' },
  input_output_lab: { zh: '输入实验', en: 'Input lab' }, compare_split: { zh: '关键对照', en: 'Key contrast' },
  formula_board: { zh: '公式推演', en: 'Formula trail' }, code_trace: { zh: '代码执行', en: 'Code trace' },
  cause_chain: { zh: '因果链路', en: 'Causal chain' }, pitfall_fork: { zh: '错误岔路', en: 'Pitfall fork' },
}

function clean(value: unknown, limit = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, limit)
}

function nodeVisualText(node?: KnowledgeMapNode) {
  if (!node) return ''
  const visual = node.visual
  if (visual?.formula) return visual.formula
  if (visual?.code) return visual.code
  if (visual?.headline) return visual.headline
  if (visual?.items?.length) return visual.items.join(' → ')
  return node.detail || node.label
}

function orderedNodes(data: KnowledgeMapData) {
  const core = data.nodes.find(node => node.role === 'core') || data.nodes[0]
  return data.learning_path
    .map(id => data.nodes.find(node => node.id === id))
    .filter((node): node is KnowledgeMapNode => Boolean(node))
    .filter(node => node.id !== core?.id)
}

function fallbackScenes(data: KnowledgeMapData): KnowledgeMapVisualScene[] {
  const core = data.nodes.find(node => node.role === 'core') || data.nodes[0]
  const ordered = orderedNodes(data)
  const byKind = (kind: NonNullable<KnowledgeMapNode['kind']>) => data.nodes.filter(node => node.kind === kind)
  const process = Array.from(new Map([...byKind('process'), ...data.nodes.filter(node => ['sequence', 'stack'].includes(node.visual?.kind || ''))].map(node => [node.id, node])).values())
  const example = byKind('example')[0] || data.nodes.find(node => node.visual?.kind === 'input_output')
  const principle = byKind('principle')[0] || data.nodes.find(node => node.visual?.kind === 'formula')
  const pitfall = byKind('pitfall')[0] || data.nodes.find(node => node.visual?.kind === 'warning')
  const scenes: KnowledgeMapVisualScene[] = []

  if (process.length >= 2 || ordered.length >= 3) {
    const nodes = (process.length >= 2 ? process : ordered).slice(0, 5)
    scenes.push({
      id: 'route', kind: 'flow_route', theme: 'cobalt', title: core ? `顺着“${core.label}”走一遍` : '把过程走一遍',
      statement: '把抽象关系改成有先后顺序的理解路线。', takeaway: nodes.map(node => node.label).join(' → '),
      node_ids: nodes.map(node => node.id), steps: nodes.map(node => nodeVisualText(node)),
    })
  }
  if (process.length >= 2) {
    scenes.push({
      id: 'stack', kind: 'stack_tower', theme: 'violet', title: '层层展开，再逐层回到结果',
      statement: '每一层只处理当前这一层该做的事，避免在脑中把所有步骤混在一起。',
      node_ids: process.slice(0, 5).map(node => node.id), steps: process.slice(0, 5).map(node => node.label),
    })
  }
  if (example) {
    scenes.push({
      id: 'lab', kind: 'input_output_lab', theme: 'teal', title: `把“${example.label}”放进实验台`,
      statement: '用一次具体的输入、处理与输出验证理解。', node_ids: [example.id],
      input: example.visual?.input || example.visual?.items?.[0] || example.example || '给定一个具体输入',
      output: example.visual?.output || example.visual?.items?.[1] || example.detail || '观察结果如何产生',
    })
  }
  if (principle) {
    scenes.push({
      id: 'formula', kind: 'formula_board', theme: 'ink', title: `“${principle.label}”的关系式`,
      statement: '先看关系，再回到每一个概念的位置。', node_ids: [principle.id],
      formula: principle.visual?.formula || nodeVisualText(principle), takeaway: principle.detail,
    })
  }
  if (pitfall) {
    scenes.push({
      id: 'fork', kind: 'pitfall_fork', theme: 'rose', title: `“${pitfall.label}”的两条岔路`,
      statement: '把常见错误和正确判断同时看清楚。', node_ids: [pitfall.id],
      left: pitfall.mistake || pitfall.visual?.before || '忽略必要条件，沿错误路径继续',
      right: pitfall.visual?.after || pitfall.detail || '先检查关键条件，再继续下一步',
    })
  }
  if (scenes.length < 3 && ordered.length >= 2) {
    const used = new Set(scenes.flatMap(scene => scene.node_ids))
    const pair = ordered.filter(node => !used.has(node.id)).slice(0, 3)
    if (pair.length >= 2) scenes.push({
      id: 'chain', kind: 'cause_chain', theme: 'lime', title: '把关系连成一条因果线',
      statement: '每一步都解释下一步为什么会发生。', node_ids: pair.map(node => node.id), steps: pair.map(node => node.label),
    })
  }
  return scenes.slice(0, 5)
}

function resolvedScenes(data: KnowledgeMapData) {
  const rawScenes = Array.isArray(data.visual_scenes) && data.visual_scenes.length ? data.visual_scenes : fallbackScenes(data)
  return rawScenes.map((scene, index) => {
    const nodes = (scene.node_ids || []).map(id => data.nodes.find(node => node.id === id)).filter((node): node is KnowledgeMapNode => Boolean(node))
    const safeNodes = nodes.length ? nodes : orderedNodes(data).slice(index, index + 3)
    const usedIds = new Set(safeNodes.map(node => node.id))
    const supportingNodes = [...orderedNodes(data), ...data.nodes.filter(node => node.role !== 'core')]
      .filter(node => !usedIds.has(node.id))
      .filter((node, nodeIndex, items) => items.findIndex(item => item.id === node.id) === nodeIndex)
      .slice(0, 5)
    return { ...scene, id: clean(scene.id, 48) || `scene-${index + 1}`, nodes: safeNodes, supportingNodes } as StoryScene
  }).filter(scene => scene.nodes.length > 0)
}

type SceneNote = { title: string; body: string; cue?: string; index: number }

function compactText(value: string | undefined, limit = 88) {
  const text = clean(value, limit + 8)
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

function isSubstantive(value: string) {
  return clean(value, 160).length >= 22
}

function sceneNotes(scene: StoryScene, limit = 5): SceneNote[] {
  const stepTexts = (scene.steps || []).map(step => clean(step, 150)).filter(Boolean)
  const uniqueNodes = Array.from(new Map([...scene.nodes, ...scene.supportingNodes].map(node => [node.id, node])).values())
  const directedNotes: SceneNote[] = (scene.design?.annotations || [])
    .map((annotation, index) => ({
      title: clean(annotation.title, 52),
      body: compactText(annotation.body, 118),
      cue: clean(annotation.label, 28) || undefined,
      index,
    }))
    .filter(note => note.title && note.body)
  const notes: SceneNote[] = [...directedNotes]
  uniqueNodes.forEach((node, nodeIndex) => {
    if (notes.length >= limit || notes.some(note => note.title === node.label)) return
    const index = notes.length
    const step = stepTexts[nodeIndex] || ''
    const candidates = [node.detail, node.example || '', node.visual?.headline || '', step, ...(node.visual?.items || [])]
      .map(item => clean(item, 160))
      .filter(Boolean)
    const body = candidates.find(isSubstantive) || candidates[0] || node.label
    const cue = step && step !== body && isSubstantive(step) ? compactText(step, 62) : undefined
    notes.push({ title: node.label, body: compactText(body, 118), cue, index })
  })
  for (const step of stepTexts) {
    if (notes.length >= limit || notes.some(note => note.body === compactText(step, 118))) continue
    notes.push({ title: `${scene.title} · ${notes.length + 1}`, body: compactText(step, 118), index: notes.length })
  }
  return notes.slice(0, limit)
}

function sceneStudyCues(scene: StoryScene, zh: boolean) {
  const notes = sceneNotes(scene, 4)
  const first = notes[0]
  const second = notes[1] || first
  const third = notes[2] || second
  const fourth = notes[3] || third
  return [
    { label: zh ? '先抓住' : 'Start with', title: first?.title || scene.title, body: first?.body || scene.statement },
    { label: zh ? '再连接' : 'Connect', title: second?.title || scene.title, body: second?.body || scene.takeaway || scene.statement },
    { label: zh ? '应用线索' : 'Apply', title: third?.title || scene.title, body: third?.body || scene.takeaway || scene.statement },
    { label: zh ? '复述检查' : 'Recall', title: zh ? '用自己的话说清关系' : 'Explain it in your words', body: scene.design?.review_prompt || (zh
      ? `试着说明「${first?.title || scene.title}」如何和「${fourth?.title || second?.title || scene.title}」共同影响结果。`
      : `Explain how ${first?.title || scene.title} connects to ${fourth?.title || second?.title || scene.title}.`) },
  ]
}

function SceneGraphic({ scene, zh }: { scene: StoryScene; zh: boolean }) {
  const notes = sceneNotes(scene)
  const steps = notes.map(note => note.body)
  const finalNode = scene.nodes[scene.nodes.length - 1]
  const left = scene.left || scene.nodes[0]?.mistake || scene.nodes[0]?.visual?.before || (zh ? '错误理解' : 'Wrong interpretation')
  const right = scene.right || finalNode?.detail || finalNode?.visual?.after || (zh ? '正确理解' : 'Correct understanding')
  const input = scene.input || scene.nodes[0]?.visual?.input || (zh ? '具体输入' : 'Concrete input')
  const output = scene.output || finalNode?.visual?.output || nodeVisualText(finalNode)

  if (scene.kind === 'flow_route') return <div className="story-route story-route-rich" aria-label={scene.title}><div className="story-route-rail" />{notes.map((note, index) => <article className="story-route-stop" key={`${note.title}-${index}`}><i>{index + 1}</i><div><b><FormulaText>{note.title}</FormulaText></b><span><FormulaText>{note.body}</FormulaText></span>{note.cue && <small><FormulaText>{note.cue}</FormulaText></small>}</div>{index < notes.length - 1 && <ArrowDown size={16} />}</article>)}<footer><b>{zh ? '最后得到' : 'Outcome'}</b><span><FormulaText>{scene.takeaway || steps.at(-1)}</FormulaText></span></footer></div>
  if (scene.kind === 'stack_tower') return <div className="story-stack story-stack-rich" aria-label={scene.title}><div className="story-stack-rail" />{[...notes].reverse().map((note, index) => <article className="story-stack-layer" key={`${note.title}-${index}`}><span>{notes.length - index}</span><div><b><FormulaText>{note.title}</FormulaText></b><small><FormulaText>{note.body}</FormulaText></small>{note.cue && <em><FormulaText>{note.cue}</FormulaText></em>}</div></article>)}<footer><b>{zh ? '阅读顺序' : 'Reading order'}</b><span>{zh ? '向下拆解，再向上组合结果' : 'Unpack downward, then combine upward.'}</span></footer></div>
  if (scene.kind === 'input_output_lab') return <div className="story-lab story-lab-rich" aria-label={scene.title}><article className="story-lab-panel story-lab-input"><small>{zh ? '给定输入' : 'Input'}</small><b><FormulaText>{input}</FormulaText></b><span><FormulaText>{notes[0]?.body}</FormulaText></span></article><div className="story-lab-core"><FlaskConical size={28} /><small>{zh ? '发生什么' : 'What changes'}</small><b><FormulaText>{scene.nodes[0]?.label || (zh ? '变化' : 'Transform')}</FormulaText></b><span>{notes.slice(1, 3).map(note => <i key={note.title}><FormulaText>{note.title}</FormulaText></i>)}</span></div><article className="story-lab-panel story-lab-output"><small>{zh ? '观察输出' : 'Output'}</small><b><FormulaText>{output}</FormulaText></b><span><FormulaText>{scene.takeaway || notes.at(-1)?.body}</FormulaText></span></article><ArrowRight className="story-lab-arrow first" size={19} /><ArrowRight className="story-lab-arrow second" size={19} /><footer>{notes.slice(0, 3).map((note, index) => <article key={note.title}><i>{index + 1}</i><div><b><FormulaText>{note.title}</FormulaText></b><span><FormulaText>{note.body}</FormulaText></span></div></article>)}</footer></div>
  if (scene.kind === 'compare_split') return <div className="story-compare story-compare-rich" aria-label={scene.title}><article><span>{zh ? '情况 A' : 'Case A'}</span><b><FormulaText>{left}</FormulaText></b><small><FormulaText>{notes[0]?.body}</FormulaText></small></article><i>{zh ? '关键差异' : 'Key difference'}</i><article><span>{zh ? '情况 B' : 'Case B'}</span><b><FormulaText>{right}</FormulaText></b><small><FormulaText>{notes.at(-1)?.body}</FormulaText></small></article><footer><FormulaText>{scene.takeaway || (zh ? '先确认条件，再决定采用哪条路径。' : 'Confirm the condition before choosing a path.')}</FormulaText></footer></div>
  if (scene.kind === 'formula_board') return <div className="story-formula story-formula-rich" aria-label={scene.title}><header><Sigma size={29} /><span>{zh ? '核心关系' : 'Core relation'}</span></header><strong><FormulaText>{scene.formula || nodeVisualText(scene.nodes[0])}</FormulaText></strong><p><FormulaText>{scene.takeaway || scene.nodes[0]?.detail}</FormulaText></p><div>{notes.map((note, index) => <article key={note.title}><i>{index + 1}</i><b><FormulaText>{note.title}</FormulaText></b><span><FormulaText>{note.body}</FormulaText></span></article>)}</div><footer><b>{zh ? '判断时先问' : 'Ask first'}</b><span><FormulaText>{zh ? `「${notes[0]?.title || scene.title}」成立需要满足什么条件？` : `What must be true for ${notes[0]?.title || scene.title} to hold?`}</FormulaText></span></footer></div>
  if (scene.kind === 'code_trace') return <div className="story-code story-code-rich" aria-label={scene.title}><header><Braces size={17} /><span>{zh ? '运行追踪' : 'Runtime trace'}</span><i>● ● ●</i></header><pre><FormulaText>{scene.code || scene.nodes[0]?.visual?.code || steps.join('\n')}</FormulaText></pre><ol>{notes.slice(0, 4).map((note, index) => <li key={note.title}><i>{index + 1}</i><div><b><FormulaText>{note.title}</FormulaText></b><span><FormulaText>{note.body}</FormulaText></span></div></li>)}</ol><footer>{scene.nodes.slice(0, 3).map(node => <span key={node.id}><FormulaText>{node.label}</FormulaText></span>)}</footer></div>
  if (scene.kind === 'cause_chain') return <div className="story-cause story-cause-rich" aria-label={scene.title}>{notes.map((note, index) => <div key={`${note.title}-${index}`}><article><i>{index + 1}</i><b><FormulaText>{note.title}</FormulaText></b><span><FormulaText>{note.body}</FormulaText></span></article>{index < notes.length - 1 && <ArrowRight size={19} />}</div>)}</div>
  return <div className="story-fork story-fork-rich" aria-label={scene.title}><div className="story-fork-sign"><GitBranch size={25} /><span>{zh ? '判断点' : 'Decision'}</span></div><article className="story-fork-wrong"><span>{zh ? '错误路径' : 'Wrong path'}</span><AlertTriangle size={17} /><b><FormulaText>{left}</FormulaText></b><small><FormulaText>{notes[0]?.body}</FormulaText></small><em><FormulaText>{zh ? `后果：${notes[1]?.body || '结果无法可靠成立。'}` : `Result: ${notes[1]?.body || 'the result is no longer reliable.'}`}</FormulaText></em></article><article className="story-fork-right"><span>{zh ? '正确路径' : 'Right path'}</span><b><FormulaText>{right}</FormulaText></b><small><FormulaText>{scene.takeaway || notes.at(-1)?.body}</FormulaText></small><em><FormulaText>{zh ? `动作：${notes[2]?.body || '确认前提后再继续。'}` : `Action: ${notes[2]?.body || 'verify the prerequisite before continuing.'}`}</FormulaText></em><ArrowRight size={17} /></article><footer><b>{zh ? '复盘提示' : 'Review cue'}</b><span><FormulaText>{zh ? `先检查「${notes[0]?.title || '关键条件'}」，再继续下一步。` : `Check ${notes[0]?.title || 'the key condition'} before continuing.`}</FormulaText></span></footer></div>
}

function editableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export function KnowledgeMapVisualStory({
  data, overview, language = 'zh-CN', onReviewPractice, reviewPracticeGenerating = false,
}: {
  data: KnowledgeMapData
  overview: ReactNode
  language?: 'zh-CN' | 'en'
  onReviewPractice?: () => void
  reviewPracticeGenerating?: boolean
}) {
  const zh = language !== 'en'
  const scenes = resolvedScenes(data)
  const [activeSlide, setActiveSlide] = useState(0)
  const activeSlideRef = useRef(0)
  const deckRef = useRef<HTMLElement | null>(null)
  const inputLocked = useRef(false)
  const unlockTimer = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const slideCount = scenes.length + 1

  const setSlide = useCallback((next: number) => {
    const bounded = Math.max(0, Math.min(slideCount - 1, next))
    if (inputLocked.current || bounded === activeSlideRef.current) return
    inputLocked.current = true
    activeSlideRef.current = bounded
    setActiveSlide(bounded)
    if (unlockTimer.current !== null) window.clearTimeout(unlockTimer.current)
    unlockTimer.current = window.setTimeout(() => { inputLocked.current = false }, 620)
  }, [slideCount])

  useEffect(() => {
    if (activeSlideRef.current >= slideCount) {
      activeSlideRef.current = Math.max(0, slideCount - 1)
      setActiveSlide(activeSlideRef.current)
    }
  }, [slideCount])

  useEffect(() => { deckRef.current?.scrollTo({ top: 0, left: 0 }) }, [activeSlide])

  useEffect(() => () => {
    if (unlockTimer.current !== null) window.clearTimeout(unlockTimer.current)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (editableTarget(event.target)) return
      if (['ArrowDown', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); setSlide(activeSlideRef.current + 1) }
      if (['ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); setSlide(activeSlideRef.current - 1) }
      if (event.key === 'Home') { event.preventDefault(); setSlide(0) }
      if (event.key === 'End') { event.preventDefault(); setSlide(slideCount - 1) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setSlide, slideCount])

  function onWheel(event: WheelEvent<HTMLElement>) {
    if (Math.abs(event.deltaY) < 8 || editableTarget(event.target)) return
    event.preventDefault()
    setSlide(activeSlideRef.current + (event.deltaY > 0 ? 1 : -1))
  }

  function onTouchStart(event: TouchEvent<HTMLElement>) { touchStartY.current = event.touches[0]?.clientY ?? null }
  function onTouchEnd(event: TouchEvent<HTMLElement>) {
    if (touchStartY.current === null) return
    const endY = event.changedTouches[0]?.clientY ?? touchStartY.current
    const distance = touchStartY.current - endY
    touchStartY.current = null
    if (Math.abs(distance) >= 46) setSlide(activeSlideRef.current + (distance > 0 ? 1 : -1))
  }

  return <section ref={deckRef} className="map-slide-deck" aria-label={zh ? '沉浸式知识图解' : 'Immersive knowledge map'} tabIndex={0} onWheel={onWheel} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
    <div className="map-slide-track" style={{ '--map-slide-index': activeSlide } as CSSProperties}>
      <section className={`map-slide map-slide-overview ${activeSlide === 0 ? 'is-active' : ''}`} aria-hidden={activeSlide !== 0}>{overview}</section>
      {scenes.map((scene, index) => {
        const slideIndex = index + 1
        const studyCues = sceneStudyCues(scene, zh)
        return <article className={`map-slide map-visual-scene scene-${scene.kind} theme-${scene.theme || sceneThemes[scene.kind]} direction-${scene.design?.visual_language || 'quiet_editorial'} composition-${scene.design?.composition || scene.kind} ${activeSlide === slideIndex ? 'is-active' : ''}`} aria-hidden={activeSlide !== slideIndex} key={scene.id}>
          <div className="map-scene-copy"><span>{sceneLabels[scene.kind][zh ? 'zh' : 'en']}</span><h2><FormulaText>{scene.title}</FormulaText></h2><p><FormulaText>{scene.statement}</FormulaText></p>{scene.takeaway && <strong><FormulaText>{scene.takeaway}</FormulaText></strong>}<aside className="map-scene-reading-points"><header><b>{zh ? '这一幕怎么学' : 'How to read this scene'}</b><span>{zh ? '把图里的信息带走，而不只是看完。' : 'Use the diagram to build an explanation, not just a glance.'}</span></header><div>{studyCues.slice(0, 3).map(cue => <article key={`${cue.label}-${cue.title}`}><small>{cue.label}</small><section><b><FormulaText>{cue.title}</FormulaText></b><p><FormulaText>{cue.body}</FormulaText></p></section></article>)}</div><p className="map-scene-review-prompt"><b>{studyCues[3]?.label}</b><span><FormulaText>{studyCues[3]?.body}</FormulaText></span></p></aside><div>{[...scene.nodes, ...scene.supportingNodes].slice(0, 5).map(node => <i key={node.id}><FormulaText>{node.label}</FormulaText></i>)}</div></div>
          <div className="map-scene-art"><SceneGraphic scene={scene} zh={zh} /></div>
        </article>
      })}
    </div>
    <nav className="map-slide-navigation" aria-label={zh ? '图解翻页控制' : 'Map slide controls'}>
      <button type="button" onClick={() => setSlide(activeSlide - 1)} disabled={activeSlide === 0} aria-label={zh ? '上一张图解' : 'Previous visual'}><ChevronUp size={17} /></button>
      <span><b>{String(activeSlide + 1).padStart(2, '0')}</b><i>/</i>{String(slideCount).padStart(2, '0')}</span>
      <button type="button" onClick={() => setSlide(activeSlide + 1)} disabled={activeSlide === slideCount - 1} aria-label={zh ? '下一张图解' : 'Next visual'}><ChevronDown size={17} /></button>
    </nav>
    <div className="map-slide-dots" aria-label={zh ? '图解页码' : 'Visual pages'}>{Array.from({ length: slideCount }, (_, index) => <button type="button" className={activeSlide === index ? 'active' : ''} key={index} onClick={() => setSlide(index)} aria-label={zh ? `前往第 ${index + 1} 张图解` : `Go to visual ${index + 1}`} aria-current={activeSlide === index ? 'step' : undefined} />)}</div>
    {onReviewPractice && activeSlide === slideCount - 1 && <button type="button" className="map-slide-practice" disabled={reviewPracticeGenerating} onClick={onReviewPractice}>{reviewPracticeGenerating ? (zh ? '正在生成练习…' : 'Generating practice…') : (zh ? '用专项练习检验理解' : 'Check with targeted practice')}<ArrowRight size={15} /></button>}
  </section>
}
