import { Archive, ArrowLeft, ChevronLeft, ChevronRight, Library, Save, Sparkles, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { FormulaText } from './FormulaText'

export type StudyBookletTemplate =
  | 'quick_overview'
  | 'system_guide'
  | 'problem_walkthrough'
  | 'concept_comparison'
  | 'formula_handbook'
  | 'glossary'
  | 'exam_cram'

export type StudyBookletDocument = {
  id: string
  title: string
  summary: string
  content?: string
  details: string[]
  status?: 'draft' | 'saved' | 'deleted' | 'generating' | 'error'
  documentTemplate?: StudyBookletTemplate
}

type LearningDocumentBookletProps = {
  course: string
  topic: string
  documents: StudyBookletDocument[]
  activeDocumentId: string | null
  language: 'zh-CN' | 'en'
  persisted: boolean
  onClose: () => void
  onSelect: (id: string) => void
  onSave?: () => void
  onOpenLibrary?: () => void
}

const templateOrder: StudyBookletTemplate[] = [
  'quick_overview',
  'system_guide',
  'problem_walkthrough',
  'concept_comparison',
  'formula_handbook',
  'glossary',
  'exam_cram',
]

const templateMeta: Record<StudyBookletTemplate, { label: string; labelEn: string; hint: string; hintEn: string }> = {
  quick_overview: { label: '一页速览', labelEn: 'Quick overview', hint: '先抓住主线，再决定从哪里开始。', hintEn: 'Get the main thread before going deeper.' },
  system_guide: { label: '系统讲义', labelEn: 'System guide', hint: '完整理解概念、例子与易错点。', hintEn: 'Build a durable understanding with examples and pitfalls.' },
  problem_walkthrough: { label: '题目精讲', labelEn: 'Problem walkthrough', hint: '沿着解题路径逐步推演。', hintEn: 'Work through the reasoning one step at a time.' },
  concept_comparison: { label: '概念对比', labelEn: 'Concept comparison', hint: '把相近概念的边界看清楚。', hintEn: 'Separate similar ideas and their boundaries.' },
  formula_handbook: { label: '公式手册', labelEn: 'Formula handbook', hint: '把公式、符号与适用条件放在一起。', hintEn: 'Keep formulas, notation, and conditions together.' },
  glossary: { label: '术语表', labelEn: 'Glossary', hint: '把关键术语连成可回看的索引。', hintEn: 'Build a revisitable index of key terms.' },
  exam_cram: { label: '考前速记', labelEn: 'Exam cram', hint: '压缩成临考前可以快速扫读的重点。', hintEn: 'Compress essentials for a fast final review.' },
}

function templateFor(document: StudyBookletDocument): StudyBookletTemplate {
  return document.documentTemplate || 'system_guide'
}

function isReady(document: StudyBookletDocument) {
  return Boolean(document.content) && document.status !== 'generating' && document.status !== 'error'
}

export function LearningDocumentBooklet({
  course,
  topic,
  documents,
  activeDocumentId,
  language,
  persisted,
  onClose,
  onSelect,
  onSave,
  onOpenLibrary,
}: LearningDocumentBookletProps) {
  const orderedDocuments = [...documents].sort((left, right) => (
    templateOrder.indexOf(templateFor(left)) - templateOrder.indexOf(templateFor(right))
  ))
  const activeIndex = Math.max(0, orderedDocuments.findIndex(document => document.id === activeDocumentId))
  const activeDocument = orderedDocuments[activeIndex] || orderedDocuments[0]
  const activeTemplate = activeDocument ? templateFor(activeDocument) : 'system_guide'
  const activeMeta = templateMeta[activeTemplate]
  const readyCount = orderedDocuments.filter(isReady).length
  const previousDocument = orderedDocuments[activeIndex - 1]
  const nextDocument = orderedDocuments[activeIndex + 1]
  const copy = (chinese: string, english: string) => language === 'en' ? english : chinese

  if (!activeDocument) return null

  return (
    <section className="study-booklet-layer" role="dialog" aria-modal="true" aria-label={copy('学习资料册', 'Study booklet')}>
      <header className="study-booklet-topbar">
        <button className="study-booklet-return" type="button" onClick={onClose}>
          <ArrowLeft size={17} />{copy('返回对话', 'Back to chat')}
        </button>
        <div className="study-booklet-title">
          <span><Archive size={14} />{copy('学习资料册', 'Study booklet')}</span>
          <b>{course} / {topic}</b>
        </div>
        <div className="study-booklet-topbar-actions">
          {persisted && onOpenLibrary ? (
            <button type="button" onClick={onOpenLibrary}><Library size={15} />{copy('资料库', 'Library')}</button>
          ) : onSave ? (
            <button className="study-booklet-save" type="button" onClick={onSave}><Save size={15} />{copy('保存整包', 'Save pack')}</button>
          ) : null}
          <button className="study-booklet-close" type="button" aria-label={copy('关闭学习资料册', 'Close study booklet')} onClick={onClose}><X size={18} /></button>
        </div>
      </header>

      <div className="study-booklet-shell">
        <aside className="study-booklet-index" aria-label={copy('资料册目录', 'Booklet contents')}>
          <div className="study-booklet-index-head">
            <span>{copy('本套资料', 'This study pack')}</span>
            <b>{readyCount} / {orderedDocuments.length}</b>
          </div>
          <nav>
            {orderedDocuments.map((document, index) => {
              const template = templateFor(document)
              const meta = templateMeta[template]
              const active = document.id === activeDocument.id
              const ready = isReady(document)
              return (
                <button
                  className={`${active ? 'active ' : ''}${ready ? 'ready' : document.status === 'error' ? 'failed' : 'waiting'}`}
                  type="button"
                  key={document.id}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onSelect(document.id)}
                >
                  <span className="study-booklet-index-number">{index + 1}</span>
                  <span><b>{language === 'en' ? meta.labelEn : meta.label}</b><small>{ready ? document.title : document.status === 'error' ? copy('暂未完成', 'Not completed') : copy('准备中', 'Preparing')}</small></span>
                  {ready ? <ChevronRight size={15} /> : <Sparkles size={14} />}
                </button>
              )
            })}
          </nav>
        </aside>

        <main className={`study-booklet-page template-${activeTemplate}`}>
          <div className="study-booklet-page-scroll">
            <header className="study-booklet-page-head">
              <div>
                <span>{language === 'en' ? activeMeta.labelEn : activeMeta.label}</span>
                <h1>{activeDocument.title}</h1>
                <p>{activeDocument.summary}</p>
              </div>
              <span className={isReady(activeDocument) ? 'study-booklet-state ready' : activeDocument.status === 'error' ? 'study-booklet-state failed' : 'study-booklet-state'}>
                {isReady(activeDocument) ? copy('已就绪', 'Ready') : activeDocument.status === 'error' ? copy('未完成', 'Not completed') : copy('正在生成', 'Preparing')}
              </span>
            </header>

            {isReady(activeDocument) ? (
              <div className="study-booklet-page-body">
              <section className="study-booklet-intro">
                <p>{language === 'en' ? activeMeta.hintEn : activeMeta.hint}</p>
                {activeDocument.details.length > 0 && (
                  <div className="study-booklet-keypoints">
                    {activeDocument.details.slice(0, 5).map(detail => <span key={detail}><FormulaText>{detail}</FormulaText></span>)}
                  </div>
                )}
              </section>
              <article className="study-booklet-content">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{activeDocument.content || ''}</ReactMarkdown>
              </article>
              </div>
            ) : (
              <div className="study-booklet-page-body">
                <div className="study-booklet-preparing" role="status" aria-live="polite">
                  <span><Sparkles size={21} /></span>
                  <div>
                    <h2>{activeDocument.status === 'error' ? copy('这一章没有完成', 'This chapter did not finish') : copy('正在整理这一章', 'Preparing this chapter')}</h2>
                    <p>{activeDocument.status === 'error'
                      ? copy('其他已完成的章节仍然可以阅读。', 'Other completed chapters are still available to read.')
                      : copy('资料册会随着生成进度自动补全这一章。', 'This chapter will appear here as soon as it is ready.')}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="study-booklet-pagination">
        <button type="button" disabled={!previousDocument} onClick={() => previousDocument && onSelect(previousDocument.id)}><ChevronLeft size={17} />{copy('上一章', 'Previous')}</button>
        <span>{activeIndex + 1} / {orderedDocuments.length}</span>
        <button type="button" disabled={!nextDocument} onClick={() => nextDocument && onSelect(nextDocument.id)}>{copy('下一章', 'Next')}<ChevronRight size={17} /></button>
      </footer>
    </section>
  )
}
