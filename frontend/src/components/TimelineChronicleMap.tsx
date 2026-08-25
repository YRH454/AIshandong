import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarRange,
  CirclePause,
  CirclePlay,
  Clock3,
  Eye,
  Flag,
  History,
  Milestone,
  PenLine,
  Sparkles,
  Waypoints,
} from 'lucide-react'
import type { KnowledgeMapData, KnowledgeMapNode } from './EditableKnowledgeMap'
import { createSemanticNodePicker } from './knowledgeMapSemantic'

type TimelineChronicleMapProps = {
  data: KnowledgeMapData
  language?: 'zh-CN' | 'en'
  onNodeSelect: (nodeId: string) => void
  onEdit?: () => void
  inspectOnly?: boolean
}

type ChronicleStage = {
  id: string
  role: string
  node: KnowledgeMapNode
  icon: React.ReactNode
  period?: string
}

const EMPTY_ROOT: KnowledgeMapNode = {
  id: 'empty-timeline-root',
  label: '',
  role: 'core',
  kind: 'core',
  detail: '',
}

function compact(value: string | undefined, limit: number) {
  const text = value?.trim() || ''
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function firstMeaningful(...values: Array<string | undefined>) {
  return values.find(value => value?.trim())?.trim() || ''
}

function explicitPeriod(node: KnowledgeMapNode) {
  const source = `${node.label} ${node.group || ''} ${node.detail} ${node.example || ''}`
  const patterns = [
    /公元前?\s*\d{1,4}\s*年?/i,
    /\b\d{1,4}\s*(?:BC|BCE|AD|CE)\b/i,
    /\d{1,4}\s*年/,
    /\b(?:1\d{3}|20\d{2})\b/i,
    /\b\d{1,2}(?:st|nd|rd|th)\s+centur(?:y|ies)\b/i,
    /\d{1,2}\s*世纪|[一二三四五六七八九十]+世纪/,
    /\b(?:1\d{3}|20\d{2})s\b/i,
    /\d{2,4}\s*年代/,
  ]
  return patterns.map(pattern => source.match(pattern)?.[0]).find(Boolean)
}

/** Timeline maps behave like a readable chronicle. A learner moves one era at
 * a time while the surrounding stages remain visible as historical context. */
export function TimelineChronicleMap({ data, language = 'zh-CN', onNodeSelect, onEdit, inspectOnly = false }: TimelineChronicleMapProps) {
  const zh = language !== 'en'
  const root = data.nodes.find(node => node.role === 'core') || data.nodes[0] || EMPTY_ROOT
  const nodes = data.nodes.filter(node => node.id !== root.id).sort((a, b) => (a.order || 99) - (b.order || 99))
  const pick = createSemanticNodePicker(nodes)
  const origin = pick('origin', ['起源', '开端', '初始', '最初'], 0)
  const earlyPhase = pick('early_phase', ['早期', '萌芽', '形成'], 1)
  const turningPoint = pick('turning_point', ['转折', '突破', '转向'], 2)
  const evolution = pick('evolution', ['演变', '发展', '推进', '扩展'], 3)
  const milestoneNode = pick('milestone', ['里程碑', '阶段成果', '重要事件'], 4)
  const currentState = pick('current_state', ['当前', '现状', '如今'], 5)
  const retrospect = pick('retrospect', ['回望', '启示', '复盘'], 6)

  const copy = zh ? {
    map: '时间脉络图', edit: '编辑图解', chronicle: '主题发展长卷', overview: '完整脉络', previous: '上一阶段', next: '下一阶段',
    play: '自动播放', pause: '暂停播放', restart: '从头回看', chapter: '当前阶段', shift: '关键变化', before: '此前状态', after: '此后影响',
    evidence: '查看本阶段依据', origin: '起源', early: '早期形成', turning: '关键转折', evolution: '持续演变', milestone: '阶段里程碑', current: '当前状态', retrospect: '回望启示',
    noBefore: '这是脉络的起点', noAfter: '由此进入下一阶段', completed: '已经走完整条脉络', hint: '点击下方节点，或使用左右方向键切换阶段。',
    inspect: '阶段内容由智能体根据当前主题生成；点击可以查看完整知识说明。', conceptual: '当前主题没有明确年份，因此按概念形成和问题解决顺序组织。', dated: '当前主题包含明确时间信息，节点按年代顺序组织。',
  } : {
    map: 'Timeline chronicle', edit: 'Edit map', chronicle: 'Topic chronicle', overview: 'Full timeline', previous: 'Previous stage', next: 'Next stage',
    play: 'Auto play', pause: 'Pause', restart: 'Restart', chapter: 'Current stage', shift: 'Key change', before: 'Before', after: 'After',
    evidence: 'Open stage evidence', origin: 'Origin', early: 'Early formation', turning: 'Turning point', evolution: 'Evolution', milestone: 'Milestone', current: 'Current state', retrospect: 'Retrospect',
    noBefore: 'This is the beginning', noAfter: 'This opens the next stage', completed: 'The complete chronicle is now visible', hint: 'Choose a marker below or use the arrow keys to change stages.',
    inspect: 'Stages are generated from the current topic. Select one for its complete explanation.', conceptual: 'No literal dates were found, so stages follow conceptual formation and problem-solving order.', dated: 'Explicit time references were found, so markers follow chronological order.',
  }

  const stages = [
    origin && { id: 'origin', role: copy.origin, node: origin, icon: <Flag size={18} />, period: explicitPeriod(origin) },
    earlyPhase && { id: 'early', role: copy.early, node: earlyPhase, icon: <Clock3 size={18} />, period: explicitPeriod(earlyPhase) },
    turningPoint && { id: 'turning', role: copy.turning, node: turningPoint, icon: <Waypoints size={18} />, period: explicitPeriod(turningPoint) },
    evolution && { id: 'evolution', role: copy.evolution, node: evolution, icon: <History size={18} />, period: explicitPeriod(evolution) },
    milestoneNode && { id: 'milestone', role: copy.milestone, node: milestoneNode, icon: <Milestone size={18} />, period: explicitPeriod(milestoneNode) },
    currentState && { id: 'current', role: copy.current, node: currentState, icon: <CalendarRange size={18} />, period: explicitPeriod(currentState) },
    retrospect && { id: 'retrospect', role: copy.retrospect, node: retrospect, icon: <BookOpenCheck size={18} />, period: explicitPeriod(retrospect) },
  ].filter(Boolean) as ChronicleStage[]

  const [activeIndex, setActiveIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const safeIndex = Math.min(activeIndex, Math.max(stages.length - 1, 0))
  const active = stages[safeIndex]
  const previousStage = stages[safeIndex - 1]
  const nextStage = stages[safeIndex + 1]

  useEffect(() => {
    if (!playing || stages.length < 2) return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setPlaying(false)
      return
    }
    const timer = window.setTimeout(() => {
      setActiveIndex(current => {
        if (current >= stages.length - 1) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, 2600)
    return () => window.clearTimeout(timer)
  }, [activeIndex, playing, stages.length])

  function moveTo(index: number) {
    setPlaying(false)
    setActiveIndex(Math.max(0, Math.min(stages.length - 1, index)))
  }

  function togglePlayback() {
    if (safeIndex >= stages.length - 1) setActiveIndex(0)
    setPlaying(current => !current)
  }

  if (!active || data.nodes.length === 0) return null

  const beforeText = firstMeaningful(active.node.visual?.before, previousStage?.node.label, copy.noBefore)
  const afterText = firstMeaningful(active.node.visual?.after, nextStage?.node.label, copy.noAfter)
  const changeText = firstMeaningful(active.node.visual?.headline, active.node.visual?.formula, active.node.detail)
  const progress = stages.length > 1 ? safeIndex / (stages.length - 1) * 100 : 100
  const hasExplicitPeriods = stages.some(stage => Boolean(stage.period))

  return <section
    className={`timeline-chronicle-map ${playing ? 'is-playing' : ''}`}
    aria-label={copy.map}
    tabIndex={0}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft') moveTo(safeIndex - 1)
      if (event.key === 'ArrowRight') moveTo(safeIndex + 1)
    }}
  >
    <header className="chronicle-head">
      <button type="button" className="chronicle-topic" onClick={() => onNodeSelect(root.id)}>
        <History size={21} aria-hidden="true" />
        <span><small>{copy.chronicle}</small><strong>{root.label}</strong></span>
      </button>
      <p>{compact(root.detail, 150)}</p>
      {onEdit && <button type="button" className="chronicle-edit" onClick={onEdit}><PenLine size={14} />{copy.edit}</button>}
    </header>

    <div className="chronicle-stage">
      <div className="chronicle-stage-index" aria-hidden="true">{String(safeIndex + 1).padStart(2, '0')}</div>
      <aside className={`chronicle-neighbor chronicle-before ${previousStage ? '' : 'is-empty'}`}>
        <span>{copy.before}</span>
        {previousStage ? <button type="button" onClick={() => moveTo(safeIndex - 1)}><ArrowLeft size={16} /><strong>{previousStage.node.label}</strong><small>{compact(previousStage.node.detail, 82)}</small></button> : <p>{copy.noBefore}</p>}
      </aside>

      <article className="chronicle-active-chapter" key={active.node.id}>
        <div className="chronicle-chapter-meta">
          <span>{copy.chapter} · {String(safeIndex + 1).padStart(2, '0')}</span>
          <em>{active.role}</em>
        </div>
        <div className="chronicle-chapter-icon" aria-hidden="true">{active.icon}</div>
        <h2>{active.node.label}</h2>
        <p>{active.node.detail}</p>
        {active.node.visual?.formula && <code>{active.node.visual.formula}</code>}
        {active.node.example && <blockquote><Sparkles size={15} /><span>{active.node.example}</span></blockquote>}
        <button type="button" className="chronicle-evidence" onClick={() => onNodeSelect(active.node.id)}><Eye size={15} />{copy.evidence}</button>
      </article>

      <div className="chronicle-mobile-controls" aria-label={copy.overview}>
        <button type="button" aria-label={copy.previous} disabled={safeIndex === 0} onClick={() => moveTo(safeIndex - 1)}><ArrowLeft size={16} /></button>
        <button type="button" onClick={togglePlayback}>{playing ? <CirclePause size={17} /> : <CirclePlay size={17} />}{playing ? copy.pause : safeIndex === stages.length - 1 ? copy.restart : copy.play}</button>
        <button type="button" aria-label={copy.next} disabled={safeIndex === stages.length - 1} onClick={() => moveTo(safeIndex + 1)}><ArrowRight size={16} /></button>
      </div>

      <aside className={`chronicle-neighbor chronicle-after ${nextStage ? '' : 'is-empty'}`}>
        <span>{copy.after}</span>
        {nextStage ? <button type="button" onClick={() => moveTo(safeIndex + 1)}><strong>{nextStage.node.label}</strong><small>{compact(nextStage.node.detail, 82)}</small><ArrowRight size={16} /></button> : <p>{copy.completed}</p>}
      </aside>

      <section className="chronicle-change-strip" aria-label={copy.shift}>
        <div><span>{copy.before}</span><strong>{compact(beforeText, 56)}</strong></div>
        <div className="chronicle-change-core"><Waypoints size={19} /><span>{copy.shift}</span><strong>{compact(changeText, 82)}</strong></div>
        <div><span>{copy.after}</span><strong>{compact(afterText, 56)}</strong></div>
      </section>
    </div>

    <footer className="chronicle-navigation">
      <div className="chronicle-controls">
        <button type="button" aria-label={copy.previous} disabled={safeIndex === 0} onClick={() => moveTo(safeIndex - 1)}><ArrowLeft size={16} /></button>
        <button type="button" className="chronicle-play" onClick={togglePlayback}>
          {playing ? <CirclePause size={17} /> : <CirclePlay size={17} />}{playing ? copy.pause : safeIndex === stages.length - 1 ? copy.restart : copy.play}
        </button>
        <button type="button" aria-label={copy.next} disabled={safeIndex === stages.length - 1} onClick={() => moveTo(safeIndex + 1)}><ArrowRight size={16} /></button>
      </div>

      <div className="chronicle-rail" role="tablist" aria-label={copy.overview}>
        <i className="chronicle-rail-progress" style={{ width: `${progress}%` }} aria-hidden="true" />
        {stages.map((stage, index) => <button
          type="button"
          role="tab"
          aria-selected={safeIndex === index}
          className={`${safeIndex === index ? 'active' : ''} ${index < safeIndex ? 'passed' : ''}`}
          key={stage.id}
          onClick={() => moveTo(index)}
        >
          <span>{index + 1}</span><strong>{stage.period || stage.role}</strong><small>{stage.node.label}</small>
        </button>)}
      </div>
      <p className="chronicle-hint">{inspectOnly ? copy.inspect : hasExplicitPeriods ? copy.dated : copy.conceptual} <span>{copy.hint}</span></p>
    </footer>
  </section>
}
