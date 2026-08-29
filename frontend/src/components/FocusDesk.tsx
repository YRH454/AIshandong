import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Coffee,
  ListTodo,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  X,
} from 'lucide-react'
import type { CSSProperties, FormEvent } from 'react'
import './FocusDesk.css'

export type FocusDeskLanguage = 'zh-CN' | 'en'

export type FocusDeskSeedTask = {
  id: string
  title: string
  detail?: string
  titleEn?: string
  detailEn?: string
}

type FocusTask = FocusDeskSeedTask & {
  completed: boolean
  createdAt: number
}

type FocusDeskMode = 'focus' | 'break'

type FocusDeskState = {
  tasks: FocusTask[]
  selectedTaskId: string | null
  mode: FocusDeskMode
  focusSeconds: number
  breakSeconds: number
  remainingSeconds: number
  running: boolean
  startedAt: number | null
  focusSecondsToday: number
  completedSessionsToday: number
  statsDate: string
}

type FocusDeskProps = {
  language: FocusDeskLanguage
  course?: string
  topic?: string
  seedTasks?: FocusDeskSeedTask[]
  onClose: () => void
}

const STORAGE_KEY = 'rhyme-focus-desk-v1'
const PRESETS = [
  { focus: 15 * 60, rest: 5 * 60, label: '15 / 5', labelEn: '15 / 5' },
  { focus: 25 * 60, rest: 5 * 60, label: '25 / 5', labelEn: '25 / 5' },
  { focus: 50 * 60, rest: 10 * 60, label: '50 / 10', labelEn: '50 / 10' },
] as const

function todayKey() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function uniqueSeedTasks(seedTasks: FocusDeskSeedTask[]) {
  return [...new Map(seedTasks.filter(task => task.id && task.title).map(task => [task.id, task])).values()]
}

function createDefaultState(seedTasks: FocusDeskSeedTask[] = []): FocusDeskState {
  const tasks = uniqueSeedTasks(seedTasks).map(task => ({ ...task, completed: false, createdAt: Date.now() }))
  return {
    tasks,
    selectedTaskId: tasks[0]?.id || null,
    mode: 'focus',
    focusSeconds: 25 * 60,
    breakSeconds: 5 * 60,
    remainingSeconds: 25 * 60,
    running: false,
    startedAt: null,
    focusSecondsToday: 0,
    completedSessionsToday: 0,
    statsDate: todayKey(),
  }
}

function isFocusDeskState(value: unknown): value is FocusDeskState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<FocusDeskState>
  return Array.isArray(state.tasks)
    && (state.mode === 'focus' || state.mode === 'break')
    && typeof state.remainingSeconds === 'number'
    && typeof state.focusSeconds === 'number'
    && typeof state.breakSeconds === 'number'
    && typeof state.running === 'boolean'
}

function readState(seedTasks: FocusDeskSeedTask[]) {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!isFocusDeskState(parsed)) return createDefaultState(seedTasks)
    const current = parsed as FocusDeskState
    const today = todayKey()
    const tasks = current.tasks
      .filter(task => task && typeof task.id === 'string' && typeof task.title === 'string')
      .map(task => ({ ...task, completed: Boolean(task.completed), createdAt: task.createdAt || Date.now() }))
    const existingIds = new Set(tasks.map(task => task.id))
    const additions = uniqueSeedTasks(seedTasks)
      .filter(task => !existingIds.has(task.id))
      .map(task => ({ ...task, completed: false, createdAt: Date.now() }))
    const nextTasks = [...tasks, ...additions]
    const statsAreFresh = current.statsDate === today
    const selectedTaskId = nextTasks.some(task => task.id === current.selectedTaskId)
      ? current.selectedTaskId
      : nextTasks[0]?.id || null
    return {
      ...createDefaultState(),
      ...current,
      tasks: nextTasks,
      selectedTaskId,
      startedAt: typeof current.startedAt === 'number' ? current.startedAt : null,
      focusSecondsToday: statsAreFresh ? Math.max(0, current.focusSecondsToday || 0) : 0,
      completedSessionsToday: statsAreFresh ? Math.max(0, current.completedSessionsToday || 0) : 0,
      statsDate: today,
    }
  } catch {
    return createDefaultState(seedTasks)
  }
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

function formatMinutes(seconds: number) {
  const minutes = Math.round(Math.max(0, seconds) / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

function localisedTaskText(task: FocusTask, language: FocusDeskLanguage, field: 'title' | 'detail') {
  if (language === 'en') {
    if (field === 'title' && task.titleEn) return task.titleEn
    if (field === 'detail' && task.detailEn) return task.detailEn
  }
  return field === 'title' ? task.title : task.detail
}

export function FocusDesk({ language, course, topic, seedTasks = [], onClose }: FocusDeskProps) {
  const [state, setState] = useState<FocusDeskState>(() => readState(seedTasks))
  const [clock, setClock] = useState(() => Date.now())
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [phaseMessage, setPhaseMessage] = useState('')
  const phaseFinishedRef = useRef(false)

  const t = useCallback((chinese: string, english: string) => language === 'en' ? english : chinese, [language])
  const seedSignature = useMemo(() => seedTasks.map(task => `${task.id}:${task.title}`).join('|'), [seedTasks])

  useEffect(() => {
    const parsed = readState(seedTasks)
    setState(current => {
      const existingIds = new Set(current.tasks.map(task => task.id))
      const additions = parsed.tasks.filter(task => !existingIds.has(task.id))
      const hasContextSeed = seedTasks.some(task => task.id !== 'focus-first-question')
      const withoutBootstrap = hasContextSeed
        ? current.tasks.filter(task => task.id !== 'focus-first-question' && !/^明确今天要解决|^Define the first question/.test(task.title))
        : current.tasks
      return additions.length || withoutBootstrap.length !== current.tasks.length
        ? { ...current, tasks: [...withoutBootstrap, ...additions], selectedTaskId: withoutBootstrap.some(task => task.id === current.selectedTaskId) ? current.selectedTaskId : additions[0]?.id || withoutBootstrap[0]?.id || null }
        : current
    })
    // The signature makes newly generated study-plan tasks available without replacing personal tasks.
  }, [seedSignature, seedTasks])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (!state.running) return
    const update = () => setClock(Date.now())
    update()
    const timer = window.setInterval(update, 500)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [state.running])

  const elapsedSinceStart = state.running && state.startedAt ? Math.floor((clock - state.startedAt) / 1000) : 0
  const remainingSeconds = Math.max(0, state.remainingSeconds - elapsedSinceStart)
  const phaseTotal = state.mode === 'focus' ? state.focusSeconds : state.breakSeconds
  const progress = phaseTotal > 0 ? Math.min(1, Math.max(0, 1 - remainingSeconds / phaseTotal)) : 0
  const completedCount = state.tasks.filter(task => task.completed).length
  const selectedTask = state.tasks.find(task => task.id === state.selectedTaskId) || null
  const taskProgress = state.tasks.length ? completedCount / state.tasks.length : 0

  useEffect(() => {
    if (!state.running || remainingSeconds > 0 || phaseFinishedRef.current) return
    phaseFinishedRef.current = true
    setState(current => {
      const finishedFocus = current.mode === 'focus'
      return {
        ...current,
        mode: finishedFocus ? 'break' : 'focus',
        remainingSeconds: finishedFocus ? current.breakSeconds : current.focusSeconds,
        running: false,
        startedAt: null,
        focusSecondsToday: finishedFocus ? current.focusSecondsToday + current.focusSeconds : current.focusSecondsToday,
        completedSessionsToday: finishedFocus ? current.completedSessionsToday + 1 : current.completedSessionsToday,
      }
    })
    setPhaseMessage(state.mode === 'focus'
      ? t('专注完成，休息一下再继续。', 'Focus complete. Take a short break before continuing.')
      : t('休息结束，准备进入下一轮专注。', 'Break complete. Ready for the next focus round.'))
  }, [remainingSeconds, state.mode, state.running, t])

  function startTimer() {
    phaseFinishedRef.current = false
    setPhaseMessage('')
    setClock(Date.now())
    setState(current => ({ ...current, running: true, startedAt: Date.now() }))
  }

  function pauseTimer() {
    const now = Date.now()
    setState(current => {
      const elapsed = current.startedAt ? Math.floor((now - current.startedAt) / 1000) : 0
      return { ...current, remainingSeconds: Math.max(0, current.remainingSeconds - elapsed), running: false, startedAt: null }
    })
  }

  function resetTimer() {
    phaseFinishedRef.current = false
    setPhaseMessage('')
    setState(current => ({
      ...current,
      remainingSeconds: current.mode === 'focus' ? current.focusSeconds : current.breakSeconds,
      running: false,
      startedAt: null,
    }))
  }

  function choosePreset(focus: number, rest: number) {
    phaseFinishedRef.current = false
    setPhaseMessage('')
    setState(current => ({
      ...current,
      focusSeconds: focus,
      breakSeconds: rest,
      remainingSeconds: current.mode === 'focus' ? focus : rest,
      running: false,
      startedAt: null,
    }))
  }

  function switchMode(mode: FocusDeskMode) {
    if (state.running || state.mode === mode) return
    phaseFinishedRef.current = false
    setPhaseMessage('')
    setState(current => ({ ...current, mode, remainingSeconds: mode === 'focus' ? current.focusSeconds : current.breakSeconds }))
  }

  function toggleTask(taskId: string) {
    setState(current => ({
      ...current,
      selectedTaskId: taskId,
      tasks: current.tasks.map(task => task.id === taskId ? { ...task, completed: !task.completed } : task),
    }))
  }

  function selectTask(taskId: string) {
    setState(current => ({ ...current, selectedTaskId: taskId }))
  }

  function deleteTask(taskId: string) {
    setState(current => {
      const tasks = current.tasks.filter(task => task.id !== taskId)
      return { ...current, tasks, selectedTaskId: current.selectedTaskId === taskId ? tasks[0]?.id || null : current.selectedTaskId }
    })
  }

  function clearCompleted() {
    setState(current => {
      const tasks = current.tasks.filter(task => !task.completed)
      return { ...current, tasks, selectedTaskId: tasks.some(task => task.id === current.selectedTaskId) ? current.selectedTaskId : tasks[0]?.id || null }
    })
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = newTaskTitle.trim()
    if (!title) return
    const task: FocusTask = { id: `focus-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title, completed: false, createdAt: Date.now() }
    setState(current => ({ ...current, tasks: [...current.tasks, task], selectedTaskId: task.id }))
    setNewTaskTitle('')
  }

  const ringStyle = { '--focus-progress': `${progress * 360}deg` } as CSSProperties
  const roomLabel = [course, topic].filter(Boolean).join(' · ') || t('当前学习', 'Current study')

  return (
    <div className="focus-desk-layer" role="dialog" aria-modal="true" aria-label={t('专注工作台', 'Focus desk')}>
      <div className="focus-desk-shell">
        <header className="focus-desk-topbar">
          <button className="focus-desk-back" type="button" onClick={onClose}>
            <ArrowLeft size={17} strokeWidth={1.9} />
            <span>{t('返回学习空间', 'Back to learning')}</span>
          </button>
          <div className="focus-desk-title">
            <span className="focus-desk-eyebrow"><Target size={14} />{t('今日学习节奏', 'TODAY · LEARNING RHYTHM')}</span>
            <h1>{t('专注工作台', 'Focus desk')}</h1>
            <p>{roomLabel}</p>
          </div>
          <button className="focus-desk-close" type="button" aria-label={t('关闭专注工作台', 'Close focus desk')} onClick={onClose}><X size={18} /></button>
        </header>

        <main className="focus-desk-main">
          <section className="focus-desk-timer-panel">
            <div className="focus-desk-panel-head">
              <div>
                <span className="focus-desk-kicker">{state.mode === 'focus' ? t('专注中', 'FOCUS') : t('休息中', 'BREAK')}</span>
                <h2>{state.mode === 'focus' ? t('把注意力放在一件事上', 'Stay with one meaningful thing') : t('让大脑恢复一点空间', 'Give your mind some room')}</h2>
              </div>
              <span className={`focus-desk-live-dot${state.running ? ' is-running' : ''}`} aria-label={state.running ? t('计时进行中', 'Timer running') : t('计时已暂停', 'Timer paused')} />
            </div>

            <div className="focus-desk-mode-switch" role="tablist" aria-label={t('计时模式', 'Timer mode')}>
              <button type="button" role="tab" aria-selected={state.mode === 'focus'} className={state.mode === 'focus' ? 'active' : ''} disabled={state.running} onClick={() => switchMode('focus')}><Clock3 size={15} />{t('专注', 'Focus')}</button>
              <button type="button" role="tab" aria-selected={state.mode === 'break'} className={state.mode === 'break' ? 'active' : ''} disabled={state.running} onClick={() => switchMode('break')}><Coffee size={15} />{t('休息', 'Break')}</button>
            </div>

            <div className="focus-desk-ring" style={ringStyle}>
              <div className="focus-desk-ring-inner">
                <span>{state.mode === 'focus' ? t('本轮专注', 'FOCUS ROUND') : t('短暂休息', 'SHORT BREAK')}</span>
                <strong aria-live="off">{formatTime(remainingSeconds)}</strong>
                <small>{selectedTask ? localisedTaskText(selectedTask, language, 'title') : t('选择一个今日任务', 'Choose a task for today')}</small>
              </div>
            </div>

            <div className="focus-desk-controls">
              <button className="focus-desk-primary-action" type="button" onClick={state.running ? pauseTimer : startTimer}>
                {state.running ? <Pause size={17} /> : <Play size={17} />}
                {state.running ? t('暂停', 'Pause') : state.mode === 'break' ? t('开始休息', 'Start break') : t('开始专注', 'Start focus')}
              </button>
              <button className="focus-desk-reset" type="button" onClick={resetTimer} aria-label={t('重置计时器', 'Reset timer')}><RotateCcw size={16} />{t('重置', 'Reset')}</button>
            </div>

            <div className="focus-desk-presets">
              <span>{t('快速预设', 'Quick presets')}</span>
              <div>
                {PRESETS.map(preset => (
                  <button key={preset.focus} type="button" className={state.focusSeconds === preset.focus && state.breakSeconds === preset.rest ? 'active' : ''} disabled={state.running} onClick={() => choosePreset(preset.focus, preset.rest)}>{language === 'en' ? preset.labelEn : preset.label}</button>
                ))}
              </div>
            </div>
            {phaseMessage && <p className="focus-desk-phase-message" role="status"><CheckCircle2 size={15} />{phaseMessage}</p>}
          </section>

          <section className="focus-desk-task-panel">
            <div className="focus-desk-task-head">
              <div>
                <span className="focus-desk-kicker"><ListTodo size={14} />{t('今日任务', 'TODAY’S TASKS')}</span>
                <h2>{t('清单少一点，完成感多一点', 'A short list with visible progress')}</h2>
              </div>
              <div className="focus-desk-task-count"><b>{completedCount}</b><span>/ {state.tasks.length || 0}</span></div>
            </div>

            <div className="focus-desk-task-progress" aria-label={t(`已完成 ${completedCount} 项`, `${completedCount} tasks complete`)}><span style={{ width: `${taskProgress * 100}%` }} /></div>

            <form className="focus-desk-add-task" onSubmit={addTask}>
              <input value={newTaskTitle} onChange={event => setNewTaskTitle(event.target.value)} placeholder={t('添加一个今天要完成的任务…', 'Add a task for today…')} maxLength={120} />
              <button type="submit" aria-label={t('添加任务', 'Add task')}><Plus size={17} /></button>
            </form>

            <div className="focus-desk-task-list">
              {state.tasks.length === 0 ? (
                <div className="focus-desk-empty-tasks"><ListTodo size={21} /><b>{t('先写下一个小目标', 'Start with one small goal')}</b><span>{t('例如：读完一节资料并写下三条要点。', 'For example: read one section and write down three takeaways.')}</span></div>
              ) : state.tasks.map(task => (
                <article className={`focus-desk-task${task.completed ? ' is-complete' : ''}${task.id === state.selectedTaskId ? ' is-selected' : ''}`} key={task.id}>
                  <button className="focus-desk-task-check" type="button" aria-label={task.completed ? t('标记为未完成', 'Mark as pending') : t('标记为完成', 'Mark as complete')} aria-pressed={task.completed} onClick={() => toggleTask(task.id)}><Check size={15} /></button>
                  <button className="focus-desk-task-copy" type="button" onClick={() => selectTask(task.id)}>
                    <b>{localisedTaskText(task, language, 'title')}</b>
                    {localisedTaskText(task, language, 'detail') && <span>{localisedTaskText(task, language, 'detail')}</span>}
                  </button>
                  <button className="focus-desk-task-delete" type="button" aria-label={t('删除任务', 'Delete task')} onClick={() => deleteTask(task.id)}><Trash2 size={14} /></button>
                </article>
              ))}
            </div>

            {completedCount > 0 && <button className="focus-desk-clear-completed" type="button" onClick={clearCompleted}>{t('清除已完成任务', 'Clear completed')}</button>}

            <div className="focus-desk-selected-note">
              <span>{t('当前专注对象', 'CURRENT FOCUS')}</span>
              <b>{selectedTask ? localisedTaskText(selectedTask, language, 'title') : t('还没有选择任务', 'No task selected yet')}</b>
              <small>{selectedTask ? t('计时开始后，把这一件事做到一个清晰的停顿点。', 'When the timer starts, stay with this task until a clear stopping point.') : t('从上面的清单选择一个任务，计时会围绕它展开。', 'Select a task above and the timer will keep it in view.')}</small>
            </div>
          </section>
        </main>

        <footer className="focus-desk-stats">
          <div className="focus-desk-stat"><span>{t('今日专注', 'FOCUS TODAY')}</span><b>{formatMinutes(state.focusSecondsToday)}</b><small>{t('累计完成的专注时长', 'Total focused time')}</small></div>
          <div className="focus-desk-stat"><span>{t('完成轮次', 'ROUNDS')}</span><b>{state.completedSessionsToday}</b><small>{t('每完成一轮专注计入一次', 'One completed focus round')}</small></div>
          <div className="focus-desk-stat"><span>{t('清单进度', 'TASK PROGRESS')}</span><b>{state.tasks.length ? `${Math.round(taskProgress * 100)}%` : '—'}</b><small>{t('今天的任务完成度', 'Today’s task completion')}</small></div>
          <div className="focus-desk-footer-hint"><Target size={16} /><span>{t('小步开始，完成比堆满清单更重要。', 'Start small. Finishing matters more than filling the list.')}</span></div>
        </footer>
      </div>
    </div>
  )
}
