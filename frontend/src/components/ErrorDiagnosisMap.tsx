import { useEffect, useMemo, useState } from 'react'
import {
  AlertOctagon,
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  GitFork,
  PenLine,
  Play,
  RefreshCcw,
  RotateCcw,
  SearchCheck,
  ShieldAlert,
  Stethoscope,
  Wrench,
  XCircle,
} from 'lucide-react'
import type { KnowledgeMapData, KnowledgeMapNode } from './EditableKnowledgeMap'
import { createSemanticNodePicker } from './knowledgeMapSemantic'
import { FormulaText } from './FormulaText'

type ErrorDiagnosisMapProps = {
  data: KnowledgeMapData
  language?: 'zh-CN' | 'en'
  onNodeSelect: (nodeId: string) => void
  onEdit?: () => void
  inspectOnly?: boolean
}

type DiagnosisState = 'idle' | 'tracing_error' | 'error_found' | 'applying_fix' | 'verified'
type SymptomKey = 'origin' | 'signal' | 'missing'

type DiagnosisStep = {
  id: string
  stage: string
  node?: KnowledgeMapNode
}

const EMPTY_ROOT: KnowledgeMapNode = {
  id: 'empty-diagnosis-root',
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

/** A decision-map is presented as a diagnosis desk: learners first trace how
 * one missed condition propagates into a wrong result, then apply the
 * generated correction and verify the repaired reasoning chain. */
export function ErrorDiagnosisMap({ data, language = 'zh-CN', onNodeSelect, onEdit, inspectOnly = false }: ErrorDiagnosisMapProps) {
  const zh = language !== 'en'
  const root = data.nodes.find(node => node.role === 'core') || data.nodes[0] || EMPTY_ROOT
  const nodes = data.nodes.filter(node => node.id !== root.id).sort((a, b) => (a.order || 99) - (b.order || 99))
  const pick = createSemanticNodePicker(nodes)
  const errorOrigin = pick('error_origin', ['错误起点', '起点', '症状'], 0)
  const missingCondition = pick('missing_condition', ['遗漏条件', '漏掉', '条件'], 1)
  const wrongBranch = pick('wrong_branch', ['错误分支', '错误判断', '分岔'], 2)
  const consequence = pick('consequence', ['后续影响', '错误后果', '后果'], 3)
  const warningSignal = pick('warning_signal', ['发现信号', '检查信号', '警告'], 4)
  const correction = pick('correction', ['纠正动作', '正确动作', '修正'], 5)
  const resultCheck = pick('result_check', ['结果复核', '复核结果', '确认'], 6)

  const copy = zh ? {
    map: '常见误判诊断图', edit: '编辑图解', intake: '选择诊断入口', intakeHint: '从最接近你当前困惑的现象开始，诊断链会追踪到真正的遗漏条件。',
    origin: '从错误表现开始', signal: '从异常信号开始', missing: '直接检查条件', desk: '推理故障排查台', deskHint: '红色路径说明错误如何传播；修正后，绿色路径负责重新复核。',
    errorRoute: '错误传播路径', repairRoute: '修正与复核路径', start: '开始诊断', tracing: '正在追踪', found: '已定位根因', apply: '应用修正', applying: '正在修正', verified: '复核通过', again: '重新检查',
    symptom: '当前症状', rootCause: '根因定位', impact: '错误后果', report: '诊断报告', waiting: '等待开始诊断', pending: '尚未追踪到这里',
    repair: '建议修正', check: '复核结果', openEvidence: '查看知识依据', traceComplete: '错误传播链已完整定位', repairComplete: '修正链已完成复核',
    reportIdle: '选择一个入口并开始诊断。图解不会替你执行真实计算，而是帮助你检查这类误判的知识链。',
    reportTracing: '正在沿错误判断向后追踪，观察遗漏条件如何改变后续结论。',
    reportFound: '根因已经定位。先核对遗漏条件，再应用生成的纠正动作。',
    reportApplying: '正在把正确条件放回推理链，并沿正确路径重新检查结果。',
    reportVerified: '知识链已经完成复核。遇到相似题目时，优先寻找右侧列出的异常信号。',
    inspect: '这是诊断知识链；点击任一节点可查看智能体生成的完整解释。', diagnosisNo: '诊断单', causeLabel: '本次根因', actionLabel: '修正动作', resultLabel: '复核结论',
  } : {
    map: 'Misconception diagnosis map', edit: 'Edit map', intake: 'Choose a diagnosis entry', intakeHint: 'Start with the symptom closest to your confusion. The chain will trace it back to the missed condition.',
    origin: 'Start from the error', signal: 'Start from a warning', missing: 'Inspect the condition', desk: 'Reasoning diagnosis desk', deskHint: 'The red route shows error propagation; the green route verifies the repaired chain.',
    errorRoute: 'Error propagation', repairRoute: 'Correction and verification', start: 'Start diagnosis', tracing: 'Tracing', found: 'Root cause found', apply: 'Apply correction', applying: 'Applying fix', verified: 'Verified', again: 'Check again',
    symptom: 'Current symptom', rootCause: 'Root cause', impact: 'Consequence', report: 'Diagnosis report', waiting: 'Waiting for diagnosis', pending: 'Not reached yet',
    repair: 'Suggested correction', check: 'Verification result', openEvidence: 'Open evidence', traceComplete: 'Error chain fully located', repairComplete: 'Repair chain verified',
    reportIdle: 'Choose an entry and start. This map does not execute real calculations; it helps inspect the knowledge chain behind a misconception.',
    reportTracing: 'Tracing forward from the wrong judgement to reveal how the missed condition changes the conclusion.',
    reportFound: 'The root cause is located. Inspect the missed condition before applying the generated correction.',
    reportApplying: 'Putting the correct condition back into the reasoning chain and checking the result again.',
    reportVerified: 'The knowledge chain is verified. In similar questions, look first for the warning signal listed here.',
    inspect: 'This is a diagnostic knowledge chain. Select any node for the full agent-generated explanation.', diagnosisNo: 'Diagnosis', causeLabel: 'Root cause', actionLabel: 'Correction', resultLabel: 'Verification',
  }

  const symptoms = useMemo(() => ({
    origin: { label: copy.origin, node: errorOrigin, icon: <AlertOctagon size={18} /> },
    signal: { label: copy.signal, node: warningSignal, icon: <SearchCheck size={18} /> },
    missing: { label: copy.missing, node: missingCondition, icon: <ClipboardCheck size={18} /> },
  }), [copy.missing, copy.origin, copy.signal, errorOrigin, missingCondition, warningSignal])

  const errorSteps = useMemo<DiagnosisStep[]>(() => [
    { id: 'origin', stage: copy.symptom, node: errorOrigin },
    { id: 'missing', stage: copy.rootCause, node: missingCondition },
    { id: 'wrong', stage: copy.errorRoute, node: wrongBranch },
    { id: 'consequence', stage: copy.impact, node: consequence },
  ].filter(step => step.node), [consequence, copy.errorRoute, copy.impact, copy.rootCause, copy.symptom, errorOrigin, missingCondition, wrongBranch])

  const repairSteps = useMemo<DiagnosisStep[]>(() => [
    { id: 'signal', stage: copy.symptom, node: warningSignal },
    { id: 'correction', stage: copy.repair, node: correction },
    { id: 'check', stage: copy.check, node: resultCheck },
  ].filter(step => step.node), [copy.check, copy.repair, copy.symptom, correction, resultCheck, warningSignal])

  const [diagnosisState, setDiagnosisState] = useState<DiagnosisState>('idle')
  const [symptom, setSymptom] = useState<SymptomKey>('origin')
  const [errorIndex, setErrorIndex] = useState(-1)
  const [repairIndex, setRepairIndex] = useState(-1)

  useEffect(() => {
    if (diagnosisState !== 'tracing_error') return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setErrorIndex(Math.max(errorSteps.length - 1, 0))
      setDiagnosisState('error_found')
      return
    }
    const timer = window.setTimeout(() => {
      if (errorIndex >= errorSteps.length - 1) setDiagnosisState('error_found')
      else setErrorIndex(current => current + 1)
    }, 620)
    return () => window.clearTimeout(timer)
  }, [diagnosisState, errorIndex, errorSteps.length])

  useEffect(() => {
    if (diagnosisState !== 'applying_fix') return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setRepairIndex(Math.max(repairSteps.length - 1, 0))
      setDiagnosisState('verified')
      return
    }
    const timer = window.setTimeout(() => {
      if (repairIndex >= repairSteps.length - 1) setDiagnosisState('verified')
      else setRepairIndex(current => current + 1)
    }, 680)
    return () => window.clearTimeout(timer)
  }, [diagnosisState, repairIndex, repairSteps.length])

  function chooseSymptom(next: SymptomKey) {
    setSymptom(next)
    setDiagnosisState('idle')
    setErrorIndex(-1)
    setRepairIndex(-1)
  }

  function startDiagnosis() {
    setErrorIndex(0)
    setRepairIndex(-1)
    setDiagnosisState('tracing_error')
  }

  function applyCorrection() {
    setRepairIndex(0)
    setDiagnosisState('applying_fix')
  }

  function resetDiagnosis() {
    setDiagnosisState('idle')
    setErrorIndex(-1)
    setRepairIndex(-1)
  }

  const activeSymptom = symptoms[symptom]
  const reportText = diagnosisState === 'idle' ? copy.reportIdle
    : diagnosisState === 'tracing_error' ? copy.reportTracing
      : diagnosisState === 'error_found' ? copy.reportFound
        : diagnosisState === 'applying_fix' ? copy.reportApplying
          : copy.reportVerified
  const statusLabel = diagnosisState === 'idle' ? copy.waiting
    : diagnosisState === 'tracing_error' ? copy.tracing
      : diagnosisState === 'error_found' ? copy.found
        : diagnosisState === 'applying_fix' ? copy.applying
          : copy.verified

  if (data.nodes.length === 0) return null

  return <section className={`error-diagnosis-map state-${diagnosisState}`} aria-label={copy.map}>
    <header className="diagnosis-map-head">
      <button type="button" className="diagnosis-map-topic" onClick={() => onNodeSelect(root.id)}>
        <Stethoscope size={21} aria-hidden="true" />
        <span><small>{copy.map}</small><strong><FormulaText>{root.label}</FormulaText></strong></span>
      </button>
      <p><FormulaText>{compact(root.detail, 150)}</FormulaText></p>
      {onEdit && <button type="button" className="diagnosis-map-edit" onClick={onEdit}><PenLine size={14} />{copy.edit}</button>}
    </header>

    <div className="diagnosis-workspace">
      <aside className="diagnosis-intake">
        <div className="diagnosis-section-number">01</div>
        <h2>{copy.intake}</h2>
        <p>{copy.intakeHint}</p>
        <div className="diagnosis-symptom-list" role="radiogroup" aria-label={copy.intake}>
          {(Object.keys(symptoms) as SymptomKey[]).map(key => {
            const option = symptoms[key]
            return <button
              type="button"
              role="radio"
              aria-checked={symptom === key}
              className={symptom === key ? 'active' : ''}
              key={key}
              disabled={diagnosisState === 'tracing_error' || diagnosisState === 'applying_fix'}
              onClick={() => chooseSymptom(key)}
            >
              <span>{option.icon}</span>
              <span><strong><FormulaText>{option.label}</FormulaText></strong><small><FormulaText>{compact(option.node?.detail || option.node?.label, 74)}</FormulaText></small></span>
            </button>
          })}
        </div>
        <section className="diagnosis-current-symptom">
          <span>{copy.symptom}</span>
          <strong><FormulaText>{activeSymptom.node?.label || root.label}</FormulaText></strong>
          <p><FormulaText>{compact(firstMeaningful(activeSymptom.node?.mistake, activeSymptom.node?.detail, root.detail), 160)}</FormulaText></p>
          {activeSymptom.node && <button type="button" onClick={() => onNodeSelect(activeSymptom.node!.id)}><Eye size={14} />{copy.openEvidence}</button>}
        </section>
      </aside>

      <main className="diagnosis-routing-desk">
        <div className="diagnosis-desk-heading">
          <div><span>02</span><h2>{copy.desk}</h2><p>{copy.deskHint}</p></div>
          <em className={`diagnosis-status status-${diagnosisState}`}>{statusLabel}</em>
        </div>

        <section className="diagnosis-route error-route" aria-label={copy.errorRoute}>
          <header><span><XCircle size={17} />{copy.errorRoute}</span><small>{diagnosisState === 'error_found' || diagnosisState === 'applying_fix' || diagnosisState === 'verified' ? copy.traceComplete : copy.pending}</small></header>
          <ol>
            {errorSteps.map((step, index) => {
              const reached = errorIndex >= index
              const active = diagnosisState === 'tracing_error' && errorIndex === index
              return <li className={`${reached ? 'reached' : ''} ${active ? 'active' : ''}`} key={step.id}>
                <button type="button" onClick={() => step.node && onNodeSelect(step.node.id)}>
                  <span className="route-index">{String(index + 1).padStart(2, '0')}</span>
                  <span><small>{step.stage}</small><strong><FormulaText>{step.node?.label}</FormulaText></strong><p><FormulaText>{compact(firstMeaningful(step.node?.mistake, step.node?.detail), 92)}</FormulaText></p></span>
                </button>
                {index < errorSteps.length - 1 && <ArrowRight size={18} aria-hidden="true" />}
              </li>
            })}
          </ol>
        </section>

        <div className="diagnosis-fork-marker" aria-hidden="true">
          <span><GitFork size={20} /></span><ArrowDown size={18} />
        </div>

        <section className="diagnosis-route repair-route" aria-label={copy.repairRoute}>
          <header><span><Wrench size={17} />{copy.repairRoute}</span><small>{diagnosisState === 'verified' ? copy.repairComplete : copy.pending}</small></header>
          <ol>
            {repairSteps.map((step, index) => {
              const reached = repairIndex >= index
              const active = diagnosisState === 'applying_fix' && repairIndex === index
              return <li className={`${reached ? 'reached' : ''} ${active ? 'active' : ''}`} key={step.id}>
                <button type="button" onClick={() => step.node && onNodeSelect(step.node.id)}>
                  <span className="route-index">{String(index + 1).padStart(2, '0')}</span>
                  <span><small>{step.stage}</small><strong><FormulaText>{step.node?.label}</FormulaText></strong><p><FormulaText>{compact(firstMeaningful(step.node?.example, step.node?.detail), 106)}</FormulaText></p></span>
                </button>
                {index < repairSteps.length - 1 && <ArrowRight size={18} aria-hidden="true" />}
              </li>
            })}
          </ol>
        </section>

        <div className="diagnosis-primary-action">
          {diagnosisState === 'idle' && <button type="button" onClick={startDiagnosis}><Play size={16} />{copy.start}</button>}
          {diagnosisState === 'tracing_error' && <button type="button" disabled><RefreshCcw size={16} />{copy.tracing}</button>}
          {diagnosisState === 'error_found' && <button type="button" onClick={applyCorrection}><Wrench size={16} />{copy.apply}</button>}
          {diagnosisState === 'applying_fix' && <button type="button" disabled><RefreshCcw size={16} />{copy.applying}</button>}
          {diagnosisState === 'verified' && <button type="button" onClick={resetDiagnosis}><RotateCcw size={16} />{copy.again}</button>}
        </div>
      </main>

      <aside className="diagnosis-report">
        <div className="diagnosis-report-number">03</div>
        <header>
          <span><ClipboardCheck size={19} />{copy.report}</span>
          <small>{copy.diagnosisNo} · {root.id.slice(-4).toUpperCase()}</small>
        </header>
        <div className={`diagnosis-report-verdict state-${diagnosisState}`}>
          {diagnosisState === 'verified' ? <BadgeCheck size={30} /> : diagnosisState === 'error_found' ? <ShieldAlert size={30} /> : <SearchCheck size={30} />}
          <strong>{statusLabel}</strong>
          <p>{reportText}</p>
        </div>
        <dl>
          <div className={errorIndex >= 1 ? 'revealed' : ''}>
            <dt>{copy.causeLabel}</dt>
            <dd><FormulaText>{errorIndex >= 1 ? compact(missingCondition?.detail || missingCondition?.label, 135) : copy.pending}</FormulaText></dd>
          </div>
          <div className={repairIndex >= 1 ? 'revealed' : ''}>
            <dt>{copy.actionLabel}</dt>
            <dd><FormulaText>{repairIndex >= 1 ? compact(correction?.detail || correction?.label, 135) : copy.pending}</FormulaText></dd>
          </div>
          <div className={diagnosisState === 'verified' ? 'revealed success' : ''}>
            <dt>{copy.resultLabel}</dt>
            <dd><FormulaText>{diagnosisState === 'verified' ? compact(resultCheck?.detail || resultCheck?.label, 135) : copy.pending}</FormulaText></dd>
          </div>
        </dl>
        {diagnosisState === 'verified' && resultCheck && <button type="button" className="diagnosis-report-evidence" onClick={() => onNodeSelect(resultCheck.id)}><CheckCircle2 size={15} />{copy.openEvidence}</button>}
        <small className="diagnosis-report-note">{inspectOnly ? copy.inspect : copy.inspect}</small>
      </aside>
    </div>
  </section>
}
