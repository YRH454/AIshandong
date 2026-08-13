import { Archive, ArrowLeft, Check, ChevronLeft, ChevronRight, Library, Play, RefreshCw, Save, Sparkles, X } from 'lucide-react'
import type { PracticeMode } from '../services/api'

export type PracticePackEntry = {
  id: string
  mode: Exclude<PracticeMode, 'standard'>
  title: string
  summary: string
  status?: 'draft' | 'saved' | 'deleted' | 'generating' | 'error'
  questionCount: number
  minutes: number
  completedAttempts?: number
}

type PracticePackBookletProps = {
  course: string
  topic: string
  entries: PracticePackEntry[]
  activeEntryId: string | null
  persisted: boolean
  language: 'zh-CN' | 'en'
  onClose: () => void
  onSelect: (id: string) => void
  onStart: (id: string) => void
  onRetry?: (id: string) => void
  onSave?: () => void
  onOpenLibrary?: () => void
}

const order: Exclude<PracticeMode, 'standard'>[] = ['similar', 'variants', 'special', 'mock', 'coding', 'oral']

const meta: Record<Exclude<PracticeMode, 'standard'>, { label: string; labelEn: string; detail: string; detailEn: string }> = {
  similar: { label: '同类题', labelEn: 'Similar questions', detail: '先确认你是否能稳定复现核心方法。', detailEn: 'Check whether you can reliably repeat the core method.' },
  variants: { label: '变式题', labelEn: 'Variants', detail: '通过条件变化检验迁移，而不是只记住原题。', detailEn: 'Test transfer through changed conditions, not memorised answers.' },
  special: { label: '专项训练', labelEn: 'Targeted practice', detail: '围绕薄弱知识点递进补强。', detailEn: 'Strengthen weak knowledge points progressively.' },
  mock: { label: '模拟试卷', labelEn: 'Mock exam', detail: '在限时条件下完成一次综合检验。', detailEn: 'Complete one integrated check under time pressure.' },
  coding: { label: '编程实验', labelEn: 'Coding lab', detail: '把概念落实为可验证的代码与测试。', detailEn: 'Turn concepts into verifiable code and tests.' },
  oral: { label: '口述测验', labelEn: 'Oral check', detail: '用自己的话说清楚原因、条件和过程。', detailEn: 'Explain the reasons, conditions, and process in your own words.' },
}

function isReady(entry: PracticePackEntry) {
  return entry.status !== 'generating' && entry.status !== 'error'
}

export function PracticePackBooklet({
  course,
  topic,
  entries,
  activeEntryId,
  persisted,
  language,
  onClose,
  onSelect,
  onStart,
  onRetry,
  onSave,
  onOpenLibrary,
}: PracticePackBookletProps) {
  const ordered = [...entries].sort((left, right) => order.indexOf(left.mode) - order.indexOf(right.mode))
  const activeIndex = Math.max(0, ordered.findIndex(entry => entry.id === activeEntryId))
  const active = ordered[activeIndex] || ordered[0]
  const readyCount = ordered.filter(isReady).length
  const completedCount = ordered.filter(entry => (entry.completedAttempts || 0) > 0).length
  const copy = (chinese: string, english: string) => language === 'en' ? english : chinese

  if (!active) return null
  const activeMeta = meta[active.mode]
  const previous = ordered[activeIndex - 1]
  const next = ordered[activeIndex + 1]

  return (
    <section className="practice-pack-booklet-layer" role="dialog" aria-modal="true" aria-label={copy('练习资源册', 'Practice pack')}>
      <header className="practice-pack-booklet-topbar">
        <button className="practice-pack-booklet-return" type="button" onClick={onClose}><ArrowLeft size={17} />{copy('返回对话', 'Back to chat')}</button>
        <div className="practice-pack-booklet-title"><span><Archive size={14} />{copy('练习资源包', 'Practice pack')}</span><b>{course} / {topic}</b></div>
        <div className="practice-pack-booklet-topbar-actions">
          {persisted && onOpenLibrary ? <button type="button" onClick={onOpenLibrary}><Library size={15} />{copy('资料库', 'Library')}</button>
            : onSave ? <button className="practice-pack-booklet-save" type="button" onClick={onSave}><Save size={15} />{copy('保存整包', 'Save pack')}</button> : null}
          <button className="practice-pack-booklet-close" type="button" aria-label={copy('关闭练习资源册', 'Close practice pack')} onClick={onClose}><X size={18} /></button>
        </div>
      </header>

      <div className="practice-pack-booklet-shell">
        <aside className="practice-pack-booklet-index" aria-label={copy('训练目录', 'Training contents')}>
          <div className="practice-pack-booklet-index-head"><span>{copy('六种训练', 'Six training modes')}</span><b>{completedCount} / {ordered.length}</b></div>
          <nav>
            {ordered.map((entry, index) => {
              const activeItem = entry.id === active.id
              const ready = isReady(entry)
              return <button key={entry.id} type="button" className={`${activeItem ? 'active ' : ''}${ready ? 'ready' : entry.status === 'error' ? 'failed' : 'waiting'}`} aria-current={activeItem ? 'page' : undefined} onClick={() => onSelect(entry.id)}>
                <span className="practice-pack-index-number">{index + 1}</span>
                <span><b>{language === 'en' ? meta[entry.mode].labelEn : meta[entry.mode].label}</b><small>{ready ? `${entry.questionCount} ${copy('题', 'items')} · ${entry.minutes}${copy(' 分钟', ' min')}` : entry.status === 'error' ? copy('暂未完成', 'Not completed') : copy('正在准备', 'Preparing')}</small></span>
                {(entry.completedAttempts || 0) > 0 ? <Check size={15} /> : ready ? <ChevronRight size={15} /> : <Sparkles size={14} />}
              </button>
            })}
          </nav>
        </aside>

        <main className="practice-pack-booklet-page">
          <header className="practice-pack-booklet-page-head">
            <div><span>{language === 'en' ? activeMeta.labelEn : activeMeta.label}</span><h1>{active.title}</h1><p>{active.summary}</p></div>
            <span className={isReady(active) ? 'practice-pack-booklet-state ready' : active.status === 'error' ? 'practice-pack-booklet-state failed' : 'practice-pack-booklet-state'}>{isReady(active) ? copy('已就绪', 'Ready') : active.status === 'error' ? copy('未完成', 'Not completed') : copy('正在生成', 'Preparing')}</span>
          </header>
          <div className="practice-pack-booklet-page-scroll">
            {isReady(active) ? <>
              <section className="practice-pack-brief"><p>{language === 'en' ? activeMeta.detailEn : activeMeta.detail}</p><div><span>{active.questionCount} {copy('题', 'items')}</span><span>{copy('预计', 'About')} {active.minutes} {copy('分钟', 'min')}</span>{(active.completedAttempts || 0) > 0 && <span>{copy(`已完成 ${active.completedAttempts} 次`, `${active.completedAttempts} completed`)}</span>}</div></section>
              <section className="practice-pack-start"><div><b>{(active.completedAttempts || 0) > 0 ? copy('继续下一轮训练', 'Continue training') : copy('准备开始', 'Ready to begin')}</b><p>{copy('答题、批改与错题复盘会在这里连续完成，结束后可直接切换下一种训练。', 'Answer, review, and error follow-up happen in one continuous flow. Then move to the next training mode.')}</p></div><button type="button" onClick={() => onStart(active.id)}><Play size={16} fill="currentColor" />{copy('开始本组训练', 'Start this training')}</button></section>
              <section className="practice-pack-route"><b>{copy('建议顺序', 'Suggested route')}</b><ol>{ordered.map((entry, index) => <li className={index < activeIndex ? 'done' : index === activeIndex ? 'current' : ''} key={entry.id}><span>{index + 1}</span><div><strong>{language === 'en' ? meta[entry.mode].labelEn : meta[entry.mode].label}</strong><small>{language === 'en' ? meta[entry.mode].detailEn : meta[entry.mode].detail}</small></div></li>)}</ol></section>
            </> : <div className="practice-pack-booklet-preparing" role="status" aria-live="polite"><span><Sparkles size={21} /></span><div><h2>{active.status === 'error' ? copy('这一组暂未完成', 'This set did not finish') : copy('正在准备这一组训练', 'Preparing this set')}</h2><p>{active.status === 'error' ? copy('其他已经完成的训练仍可直接开始。你可以只重试这一组，不会影响已经完成的内容。', 'Other completed training sets are still available. Retry only this set without affecting completed work.') : copy('资源册会随着生成进度自动补齐这一组。', 'This booklet will fill in this set as soon as it is ready.')}</p>{active.status === 'error' && onRetry && <button className="practice-pack-retry" type="button" onClick={() => onRetry(active.id)}><RefreshCw size={15} />{copy('只重试这一组', 'Retry this set')}</button>}</div></div>}
          </div>
        </main>
      </div>
      <footer className="practice-pack-booklet-pagination"><button type="button" disabled={!previous} onClick={() => previous && onSelect(previous.id)}><ChevronLeft size={17} />{copy('上一组', 'Previous')}</button><span>{activeIndex + 1} / {ordered.length} · {readyCount} {copy('组已就绪', 'ready')}</span><button type="button" disabled={!next} onClick={() => next && onSelect(next.id)}>{copy('下一组', 'Next')}<ChevronRight size={17} /></button></footer>
    </section>
  )
}
