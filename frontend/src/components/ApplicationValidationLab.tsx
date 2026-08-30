import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  ClipboardPenLine,
  Eye,
  FileInput,
  FlaskConical,
  Gauge,
  PenLine,
  Play,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react'
import { type KnowledgeMapData, type KnowledgeMapNode } from './EditableKnowledgeMap'
import { createSemanticNodePicker } from './knowledgeMapSemantic'
import { FormulaText } from './FormulaText'

type ApplicationValidationLabProps = {
  data: KnowledgeMapData
  language?: 'zh-CN' | 'en'
  onNodeSelect: (nodeId: string) => void
  onEdit?: () => void
  inspectOnly?: boolean
}

type ScenarioKey = 'base' | 'variation' | 'boundary'
type RunState = 'idle' | 'running' | 'complete'

type LabStep = {
  id: string
  label: string
  node?: KnowledgeMapNode
  icon: ReactNode
  detail: string
}

const EMPTY_ROOT: KnowledgeMapNode = {
  id: 'empty-lab-root',
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

function orderedNodes(data: KnowledgeMapData, root: KnowledgeMapNode) {
  return data.nodes.filter(node => node.id !== root.id).sort((a, b) => (a.order || 99) - (b.order || 99))
}

/** Lab maps behave like a small verification bench. Learners can switch the
 * tested condition, run the reasoning sequence and compare the observation
 * with the expected result without leaving the map. */
export function ApplicationValidationLab({ data, language = 'zh-CN', onNodeSelect, onEdit, inspectOnly = false }: ApplicationValidationLabProps) {
  const zh = language !== 'en'
  const root = data.nodes.find(node => node.role === 'core') || data.nodes[0] || EMPTY_ROOT

  const nodes = orderedNodes(data, root)
  const pick = createSemanticNodePicker(nodes)
  const setup = pick('setup', ['案例', '设定', '情境', '准备'], 0)
  const input = pick('input', ['输入', '条件', '已知'], 1)
  const execution = pick('execution', ['执行', '动作', '套用', '规则'], 2)
  const observation = pick('observation', ['观察', '变化', '记录'], 3)
  const result = pick('result', ['结果', '输出', '解释'], 4)
  const variation = pick('variation', ['变式', '变量', '迁移', '改变'], 5)
  const boundary = pick('boundary', ['边界', '不能', '限制', '复盘'], 6)

  const copy = zh ? {
    map: '应用验证实验图', edit: '编辑图解', caseTitle: '选择验证情境', base: '原始案例', variation: '改变一个条件', boundary: '测试边界',
    inputLabel: '本次输入', inputHelp: '可以修改这段输入，再沿图解检查推理过程。', emptyInput: '请先写下要验证的输入或情境。',
    run: '开始验证', running: '正在验证', rerun: '重新验证', reset: '恢复输入', stage: '验证过程', stageHint: '每次只推进一个观察步骤。',
    expected: '预期结果', observed: '本次观察', waiting: '运行后显示观察结果', pass: '验证链成立', caution: '边界条件已识别',
    needsReview: '自定义输入待核对', customExpected: '需按当前执行规则重新推导', customObserved: '输入已经进入验证链，但它不属于智能体生成的预设案例。请打开知识依据，按执行规则核对结果。',
    baseSummary: '使用原案例检查规则能否完整得到结果。', variationSummary: '只改变一个条件，观察结论是否随之变化。', boundarySummary: '把输入推到适用范围边缘，检查规则何时失效。',
    setup: '设定情境', input: '读取输入', execution: '应用规则', observation: '记录变化', result: '核对结果',
    evidence: '查看知识依据', variantTitle: '继续改变条件', useVariation: '使用这个变式', useBoundary: '使用这个边界',
    inspect: '点击节点可以查看完整说明。', complete: '验证完成', idle: '等待运行',
  } : {
    map: 'Application validation lab', edit: 'Edit map', caseTitle: 'Choose a test case', base: 'Base case', variation: 'Change one condition', boundary: 'Test the boundary',
    inputLabel: 'Test input', inputHelp: 'Edit the input, then follow the map to inspect the reasoning.', emptyInput: 'Enter an input or situation before running the check.',
    run: 'Run validation', running: 'Validating', rerun: 'Run again', reset: 'Restore input', stage: 'Validation sequence', stageHint: 'Advance one observable step at a time.',
    expected: 'Expected result', observed: 'Observed result', waiting: 'Run the validation to reveal the observation', pass: 'Reasoning chain verified', caution: 'Boundary identified',
    needsReview: 'Custom input needs review', customExpected: 'Derive again with the current execution rule', customObserved: 'The input entered the validation chain, but it is not an agent-generated preset. Open the evidence and verify it against the execution rule.',
    baseSummary: 'Use the original example to check whether the rule reaches the result.', variationSummary: 'Change one condition and observe whether the conclusion changes.', boundarySummary: 'Push the input to the edge of its valid range and inspect failure.',
    setup: 'Set the case', input: 'Read input', execution: 'Apply rule', observation: 'Record change', result: 'Check result',
    evidence: 'Open evidence', variantTitle: 'Try another condition', useVariation: 'Use this variation', useBoundary: 'Use this boundary',
    inspect: 'Select any node for the full explanation.', complete: 'Validation complete', idle: 'Ready to run',
  }

  const scenarios = useMemo(() => ({
    base: {
      label: copy.base,
      summary: copy.baseSummary,
      node: input || setup,
      input: firstMeaningful(input?.visual?.input, input?.example, setup?.example, input?.detail, setup?.detail, root.example),
      expected: firstMeaningful(result?.visual?.output, result?.visual?.formula, result?.example, result?.detail),
      observed: firstMeaningful(observation?.visual?.output, observation?.visual?.after, observation?.example, observation?.detail, result?.detail),
      tone: 'pass' as const,
    },
    variation: {
      label: copy.variation,
      summary: copy.variationSummary,
      node: variation,
      input: firstMeaningful(variation?.visual?.after, variation?.visual?.input, variation?.example, variation?.detail, input?.visual?.input),
      expected: firstMeaningful(variation?.visual?.output, variation?.visual?.after, variation?.example, result?.visual?.output, result?.detail),
      observed: firstMeaningful(variation?.visual?.output, variation?.visual?.after, variation?.example, variation?.detail, observation?.detail),
      tone: 'pass' as const,
    },
    boundary: {
      label: copy.boundary,
      summary: copy.boundarySummary,
      node: boundary,
      input: firstMeaningful(boundary?.visual?.input, boundary?.example, boundary?.mistake, boundary?.detail, input?.visual?.input),
      expected: firstMeaningful(boundary?.visual?.output, boundary?.mistake, boundary?.detail, result?.mistake),
      observed: firstMeaningful(boundary?.visual?.output, boundary?.mistake, boundary?.detail, result?.mistake),
      tone: 'caution' as const,
    },
  }), [boundary, copy.base, copy.baseSummary, copy.boundary, copy.boundarySummary, copy.variation, copy.variationSummary, input, observation, result, root.example, setup, variation])

  const [scenario, setScenario] = useState<ScenarioKey>('base')
  const [inputValue, setInputValue] = useState(scenarios.base.input)
  const [runState, setRunState] = useState<RunState>('idle')
  const [activeStep, setActiveStep] = useState(-1)
  const [inputError, setInputError] = useState('')
  const activeScenario = scenarios[scenario]

  const steps = useMemo<LabStep[]>(() => {
    const scenarioNode = scenario === 'base' ? input : activeScenario.node || input
    return [
      { id: 'setup', label: copy.setup, node: setup, icon: <FlaskConical size={19} />, detail: firstMeaningful(setup?.detail, root.detail) },
      { id: 'input', label: copy.input, node: scenarioNode, icon: <FileInput size={19} />, detail: inputValue || firstMeaningful(scenarioNode?.detail, input?.detail) },
      { id: 'execution', label: copy.execution, node: execution, icon: <Gauge size={19} />, detail: firstMeaningful(execution?.visual?.formula, execution?.visual?.code, execution?.detail) },
      { id: 'observation', label: copy.observation, node: scenario === 'base' ? observation : activeScenario.node || observation, icon: <Eye size={19} />, detail: firstMeaningful(activeScenario.observed, observation?.detail) },
      { id: 'result', label: copy.result, node: scenario === 'boundary' ? boundary || result : result, icon: scenario === 'boundary' ? <ShieldAlert size={19} /> : <BadgeCheck size={19} />, detail: firstMeaningful(result?.visual?.output, result?.example, result?.detail) },
    ].filter(step => step.node || step.detail)
  }, [activeScenario, boundary, copy.execution, copy.input, copy.observation, copy.result, copy.setup, execution, input, inputValue, observation, result, root.detail, scenario, setup])

  useEffect(() => {
    setInputValue(activeScenario.input)
    setRunState('idle')
    setActiveStep(-1)
    setInputError('')
  }, [activeScenario])

  useEffect(() => {
    if (runState !== 'running') return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setActiveStep(Math.max(steps.length - 1, 0))
      setRunState('complete')
      return
    }
    const timer = window.setTimeout(() => {
      if (activeStep >= steps.length - 1) setRunState('complete')
      else setActiveStep(current => current + 1)
    }, 620)
    return () => window.clearTimeout(timer)
  }, [activeStep, runState, steps.length])

  function chooseScenario(next: ScenarioKey) {
    setScenario(next)
  }

  function runValidation() {
    if (!inputValue.trim()) {
      setInputError(copy.emptyInput)
      return
    }
    setInputError('')
    setActiveStep(0)
    setRunState('running')
  }

  function resetInput() {
    setInputValue(activeScenario.input)
    setInputError('')
    setRunState('idle')
    setActiveStep(-1)
  }

  const currentStep = activeStep >= 0 ? steps[Math.min(activeStep, steps.length - 1)] : steps[0]
  const appliedRule = firstMeaningful(execution?.visual?.formula, execution?.visual?.headline, execution?.label, execution?.detail)
  const isCustomInput = Boolean(activeScenario.input.trim()) && inputValue.trim() !== activeScenario.input.trim()
  const expectedResult = isCustomInput ? copy.customExpected : activeScenario.expected
  const visibleOutput = runState === 'complete' ? (isCustomInput ? copy.customObserved : activeScenario.observed) : copy.waiting
  const verdictTone = isCustomInput ? 'review' : activeScenario.tone

  if (data.nodes.length === 0) return null

  return <section className={`application-validation-lab state-${runState} scenario-${scenario}`} aria-label={copy.map}>
    <header className="application-lab-head">
      <button type="button" className="application-lab-topic" onClick={() => onNodeSelect(root.id)}>
        <FlaskConical size={20} aria-hidden="true" />
        <strong><FormulaText>{root.label}</FormulaText></strong>
      </button>
      <p><FormulaText>{compact(root.detail, 128)}</FormulaText></p>
      {onEdit && <button type="button" className="application-lab-edit" onClick={onEdit}><PenLine size={14} />{copy.edit}</button>}
    </header>

    <div className="application-lab-workbench">
      <aside className="application-case-panel">
        <h3>{copy.caseTitle}</h3>
        <div className="application-scenario-switch" role="tablist" aria-label={copy.caseTitle}>
          {(Object.keys(scenarios) as ScenarioKey[]).map(key => <button
            type="button"
            role="tab"
            aria-selected={scenario === key}
            className={scenario === key ? 'active' : ''}
            disabled={runState === 'running'}
            key={key}
            onClick={() => chooseScenario(key)}
          >{scenarios[key].label}</button>)}
        </div>
        <p className="application-scenario-summary">{activeScenario.summary}</p>

        <label className="application-input-field">
          <span>{copy.inputLabel}</span>
          <textarea
            value={inputValue}
            rows={6}
            disabled={runState === 'running'}
            aria-invalid={Boolean(inputError)}
            aria-describedby="application-input-help application-input-error"
            onChange={event => {
              setInputValue(event.target.value)
              setInputError('')
              setRunState('idle')
              setActiveStep(-1)
            }}
          />
          <small id="application-input-help">{copy.inputHelp}</small>
          {inputError && <em id="application-input-error" role="alert">{inputError}</em>}
        </label>

        <div className="application-run-actions">
          <button type="button" className="application-run-button" disabled={runState === 'running'} onClick={runValidation}>
            {runState === 'running' ? <RefreshCcw size={16} /> : runState === 'complete' ? <RotateCcw size={16} /> : <Play size={16} />}
            {runState === 'running' ? copy.running : runState === 'complete' ? copy.rerun : copy.run}
          </button>
          <button type="button" className="application-reset-button" disabled={runState === 'running' || inputValue === activeScenario.input} onClick={resetInput}><ClipboardPenLine size={15} />{copy.reset}</button>
        </div>
      </aside>

      <main className="application-experiment-stage">
        <div className="application-stage-heading">
          <div><h3>{copy.stage}</h3><p>{copy.stageHint}</p></div>
          <span className={`application-run-status status-${runState}`}>{runState === 'complete' ? copy.complete : runState === 'running' ? copy.running : copy.idle}</span>
        </div>

        <ol className="application-step-track">
          {steps.map((step, index) => {
            const reached = activeStep >= index
            const active = runState === 'running' && activeStep === index
            return <li key={step.id} className={`${reached ? 'reached' : ''} ${active ? 'active' : ''}`}>
              <button type="button" disabled={!step.node} onClick={() => step.node && onNodeSelect(step.node.id)} aria-label={`${step.label}: ${step.node?.label || step.detail}`}>
                <span className="application-step-icon">{step.icon}</span>
                <strong><FormulaText>{step.label}</FormulaText></strong>
                <small><FormulaText>{step.node?.label || compact(step.detail, 32)}</FormulaText></small>
              </button>
            </li>
          })}
        </ol>

        <section className="application-observation-window" aria-live="polite">
          <div className="application-observation-mark" aria-hidden="true">{currentStep?.icon || <Eye size={22} />}</div>
          <div>
            <h4><FormulaText>{currentStep?.label || copy.stage}</FormulaText></h4>
            <strong><FormulaText>{currentStep?.node?.label || root.label}</FormulaText></strong>
            <p><FormulaText>{compact(currentStep?.detail || root.detail, 220)}</FormulaText></p>
            {currentStep?.node?.visual?.formula && <code><FormulaText>{currentStep.node.visual.formula}</FormulaText></code>}
          </div>
          {currentStep?.node && <button type="button" onClick={() => onNodeSelect(currentStep.node!.id)}>{copy.evidence}</button>}
          <div className="application-observation-flow">
            <span><small>{copy.input}</small><strong><FormulaText>{compact(inputValue, 72)}</FormulaText></strong></span>
            <ArrowRight size={18} aria-hidden="true" />
            <span><small>{copy.execution}</small><strong><FormulaText>{compact(appliedRule, 72)}</FormulaText></strong></span>
            <ArrowRight size={18} aria-hidden="true" />
            <span className={runState === 'complete' ? 'revealed' : ''}><small>{copy.observed}</small><strong><FormulaText>{compact(visibleOutput, 84)}</FormulaText></strong></span>
          </div>
        </section>
      </main>

      <aside className={`application-verdict-sheet tone-${verdictTone}`} aria-live="polite">
        <div className="application-verdict-icon" aria-hidden="true">{verdictTone === 'caution' ? <ShieldAlert size={24} /> : verdictTone === 'review' ? <ClipboardPenLine size={24} /> : <BadgeCheck size={24} />}</div>
        <h3>{runState === 'complete' ? (verdictTone === 'review' ? copy.needsReview : verdictTone === 'caution' ? copy.caution : copy.pass) : copy.waiting}</h3>
        <section>
          <span>{copy.expected}</span>
          <p><FormulaText>{compact(expectedResult, 170) || copy.waiting}</FormulaText></p>
        </section>
        <section>
          <span>{copy.observed}</span>
          <p className={runState === 'complete' ? 'revealed' : ''}><FormulaText>{runState === 'complete' ? compact(visibleOutput, 190) : copy.waiting}</FormulaText></p>
        </section>
        {activeScenario.node && <button type="button" onClick={() => onNodeSelect(activeScenario.node!.id)}><Eye size={14} />{copy.evidence}</button>}
        <small>{inspectOnly ? copy.inspect : activeScenario.summary}</small>
      </aside>
    </div>

    <footer className="application-variation-dock">
      <h3>{copy.variantTitle}</h3>
      <div>
        {variation && <button type="button" className={scenario === 'variation' ? 'active' : ''} disabled={runState === 'running'} onClick={() => chooseScenario('variation')}>
          <SlidersHorizontal size={18} /><span><strong>{copy.useVariation}</strong><small>{compact(variation.detail, 88)}</small></span>
        </button>}
        {boundary && <button type="button" className={scenario === 'boundary' ? 'active' : ''} disabled={runState === 'running'} onClick={() => chooseScenario('boundary')}>
          <ShieldAlert size={18} /><span><strong>{copy.useBoundary}</strong><small>{compact(boundary.detail, 88)}</small></span>
        </button>}
      </div>
    </footer>
  </section>
}
