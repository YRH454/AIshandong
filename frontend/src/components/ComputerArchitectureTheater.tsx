import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Binary,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Code2,
  Cpu,
  Database,
  Eye,
  Gauge,
  MemoryStick,
  PenLine,
  RotateCcw,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import type { DynamicExplanationCheckpoint, DynamicExplanationData } from './dynamicExplanation'

type LearningMode = 'quick' | 'guided' | 'challenge'
type MachineModule = 'editor' | 'compiler' | 'queue' | 'cpu' | 'cache' | 'memory' | 'output'

type ComputerArchitectureTheaterProps = {
  data: DynamicExplanationData
  language: 'zh-CN' | 'en'
  activeIndex: number
  playing: boolean
  learningMode: LearningMode
  selectedAnswer?: string
  checkpoint?: DynamicExplanationCheckpoint
  showNarration: boolean
  editing?: boolean
  onExit: () => void
  onTogglePlaying: () => void
  onSelectScene: (index: number) => void
  onAdvance: () => void
  onRestart: () => void
  onModeChange: (mode: LearningMode) => void
  onAnswer: (answer: string) => void
  onRevealNarration: () => void
  onEdit?: () => void
}

type RuntimeStep = {
  id: string
  module: MachineModule
  from?: MachineModule
  titleZh: string
  titleEn: string
  detailZh: string
  detailEn: string
  instruction: number
}

const modulePoints: Record<MachineModule, { x: number; y: number }> = {
  editor: { x: 11, y: 34 },
  compiler: { x: 29, y: 21 },
  queue: { x: 47, y: 18 },
  cpu: { x: 50, y: 48 },
  cache: { x: 73, y: 35 },
  memory: { x: 88, y: 54 },
  output: { x: 69, y: 78 },
}

const baseSteps: RuntimeStep[] = [
  { id: 'source', module: 'editor', titleZh: '写入输入', titleEn: 'Set the input', detailZh: '源代码只描述目标。此时 a 与 b 还没有进入处理器。', detailEn: 'Source code describes the goal. Values a and b have not entered the processor yet.', instruction: 0 },
  { id: 'compile', module: 'compiler', from: 'editor', titleZh: '翻译为机器指令', titleEn: 'Compile into instructions', detailZh: '编译器把一行表达式拆成加载、相加和写回四条可执行指令。', detailEn: 'The compiler expands one expression into load, add, and store instructions.', instruction: 1 },
  { id: 'queue', module: 'queue', from: 'compiler', titleZh: '指令进入队列', titleEn: 'Queue the instructions', detailZh: '处理器按顺序取出指令。队列让控制单元知道下一步该做什么。', detailEn: 'The processor fetches instructions in order. The queue tells the control unit what comes next.', instruction: 1 },
  { id: 'fetch-a', module: 'cache', from: 'queue', titleZh: '读取第一个操作数', titleEn: 'Fetch the first operand', detailZh: 'CPU 先询问 Cache。命中时走短路径，未命中时继续访问内存。', detailEn: 'The CPU checks cache first. A hit takes the short path; a miss continues to memory.', instruction: 1 },
  { id: 'fetch-b', module: 'memory', from: 'cache', titleZh: '取得第二个操作数', titleEn: 'Fetch the second operand', detailZh: '数据沿总线返回 CPU，并写入通用寄存器等待运算。', detailEn: 'Data returns to the CPU over the bus and waits in general-purpose registers.', instruction: 2 },
  { id: 'registers', module: 'cpu', from: 'memory', titleZh: '寄存器准备完毕', titleEn: 'Registers are ready', detailZh: 'R1 和 R2 已经拥有两个操作数，控制单元把它们交给 ALU。', detailEn: 'R1 and R2 now hold both operands, so the control unit sends them to the ALU.', instruction: 3 },
  { id: 'execute', module: 'cpu', from: 'cpu', titleZh: 'ALU 执行加法', titleEn: 'ALU performs addition', detailZh: '算术逻辑单元完成二进制加法，结果先进入 R3，而不是直接出现在屏幕上。', detailEn: 'The ALU completes binary addition. The result enters R3 before it reaches the screen.', instruction: 3 },
  { id: 'store', module: 'cache', from: 'cpu', titleZh: '写回结果', titleEn: 'Store the result', detailZh: '结果从寄存器写回缓存与内存，程序状态因此发生持久变化。', detailEn: 'The register value is written back to cache and memory, changing program state.', instruction: 4 },
  { id: 'output', module: 'output', from: 'cache', titleZh: '程序输出完成', titleEn: 'Output is ready', detailZh: '输出设备读取 result。现在看到的数字，是整条指令与数据路径共同工作的结果。', detailEn: 'The output reads result. The visible number is produced by the whole instruction and data path.', instruction: 4 },
]

const moduleLabels: Record<MachineModule, { zh: string; en: string; captionZh: string; captionEn: string }> = {
  editor: { zh: '代码编辑器', en: 'Code editor', captionZh: '人类表达', captionEn: 'Human intent' },
  compiler: { zh: '编译器', en: 'Compiler', captionZh: '翻译规则', captionEn: 'Translation' },
  queue: { zh: '指令队列', en: 'Instruction queue', captionZh: '执行顺序', captionEn: 'Execution order' },
  cpu: { zh: '中央处理器', en: 'CPU', captionZh: '控制与运算', captionEn: 'Control and compute' },
  cache: { zh: '高速缓存', en: 'Cache', captionZh: '短路径数据', captionEn: 'Fast-path data' },
  memory: { zh: '内存', en: 'Memory', captionZh: '程序状态', captionEn: 'Program state' },
  output: { zh: '输出', en: 'Output', captionZh: '可见结果', captionEn: 'Visible result' },
}

function formatBinary(value: number) {
  return Math.max(0, value).toString(2).padStart(8, '0')
}

export function ComputerArchitectureTheater({
  data,
  language,
  activeIndex,
  playing,
  learningMode,
  selectedAnswer,
  checkpoint,
  showNarration,
  editing = false,
  onExit,
  onTogglePlaying,
  onSelectScene,
  onAdvance,
  onRestart,
  onModeChange,
  onAnswer,
  onRevealNarration,
  onEdit,
}: ComputerArchitectureTheaterProps) {
  const tr = (chinese: string, english: string) => language === 'en' ? english : chinese
  const [step, setStep] = useState(0)
  const [inputA, setInputA] = useState(6)
  const [inputB, setInputB] = useState(9)
  const [cacheHit, setCacheHit] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [inspectedModule, setInspectedModule] = useState<MachineModule | null>(null)
  const [checkpointOpen, setCheckpointOpen] = useState(false)
  const result = inputA + inputB
  const safeStep = Math.min(step, baseSteps.length - 1)
  const currentStep = baseSteps[safeStep]
  const currentSceneIndex = Math.min(data.scenes.length - 1, Math.floor((safeStep / Math.max(baseSteps.length - 1, 1)) * data.scenes.length))
  const sourceScene = data.scenes[currentSceneIndex] || data.scenes[activeIndex]
  const currentPoint = modulePoints[currentStep.module]
  const checked = Boolean(selectedAnswer)

  const instructions = useMemo(() => [
    `result = ${inputA} + ${inputB}`,
    `LOAD R1, [a]`,
    `LOAD R2, [b]`,
    `ADD R3, R1, R2`,
    `STORE [result], R3`,
  ], [inputA, inputB])

  const machineState = useMemo(() => ({
    r1: safeStep >= 4 ? inputA : null,
    r2: safeStep >= 5 ? inputB : null,
    r3: safeStep >= 6 ? result : null,
    cacheA: safeStep >= 3 && cacheHit ? inputA : null,
    cacheResult: safeStep >= 7 ? result : null,
    memoryResult: safeStep >= 7 ? result : null,
    output: safeStep >= 8 ? result : null,
  }), [cacheHit, inputA, inputB, result, safeStep])

  useEffect(() => {
    if (currentSceneIndex !== activeIndex) onSelectScene(currentSceneIndex)
  }, [activeIndex, currentSceneIndex, onSelectScene])

  useEffect(() => {
    if (!playing) return undefined
    const timer = window.setInterval(() => {
      setStep(current => {
        if (current >= baseSteps.length - 1) {
          window.setTimeout(onTogglePlaying, 0)
          return current
        }
        return current + 1
      })
    }, 1500 / speed)
    return () => window.clearInterval(timer)
  }, [onTogglePlaying, playing, speed])

  const resetRuntime = () => {
    setStep(0)
    setInspectedModule(null)
    setCheckpointOpen(false)
    if (playing) onTogglePlaying()
    onRestart()
  }

  const moveStep = (next: number) => {
    if (playing) onTogglePlaying()
    if (next > baseSteps.length - 1) {
      onAdvance()
      return
    }
    setStep(Math.max(0, next))
    setInspectedModule(null)
  }

  const moduleDescription = inspectedModule ? moduleLabels[inspectedModule] : null
  const narrationVisible = learningMode !== 'challenge' || showNarration
  const packetStyle = {
    '--packet-x': `${currentPoint.x}%`,
    '--packet-y': `${currentPoint.y}%`,
  } as CSSProperties

  return (
    <section className={`computer-theater${playing ? ' is-playing' : ''}${cacheHit ? ' cache-hit' : ' cache-miss'}`} aria-label={tr('计算机运行剧场', 'Computer runtime theater')}>
      <header className="computer-theater-header">
        <button type="button" className="computer-exit" onClick={onExit}><X size={17} /><span>{tr('退出讲解', 'Exit')}</span></button>
        <div className="computer-title">
          <strong>{data.title}</strong>
          <span>{tr('观察一条指令如何穿过整台计算机', 'Watch one instruction travel through the whole computer')}</span>
        </div>
        <div className="computer-header-actions">
          {onEdit && <button type="button" className={editing ? 'active' : ''} onClick={onEdit}><PenLine size={15} /><span>{editing ? tr('继续讲解', 'Resume') : tr('编辑内容', 'Edit')}</span></button>}
        </div>
      </header>

      <div className="computer-workspace">
        <div className="computer-machine-scroll">
          <main className="computer-machine" aria-label={tr('完整计算机数据路径', 'Complete computer data path')}>
            <div className="machine-surface" aria-hidden="true" />
            <svg className="machine-buses" viewBox="0 0 1200 680" preserveAspectRatio="none" aria-hidden="true">
              <path className={safeStep >= 1 ? 'active complete' : ''} d="M155 232 C235 232 250 145 340 145" />
              <path className={safeStep >= 2 ? 'active complete' : ''} d="M390 145 H555" />
              <path className={safeStep >= 3 ? 'active complete' : ''} d="M585 170 C630 210 690 220 790 230" />
              <path className={!cacheHit && safeStep >= 3 ? 'active long-route' : ''} d="M850 245 C970 245 1000 335 1040 365" />
              <path className={safeStep >= 5 ? 'active complete' : ''} d="M1015 385 C900 385 785 370 655 350" />
              <path className={safeStep >= 7 ? 'active complete' : ''} d="M650 405 C720 430 765 500 810 535" />
              <path className={safeStep >= 8 ? 'active complete' : ''} d="M820 535 C790 570 755 585 700 585" />
            </svg>

            <button type="button" className={`machine-module module-editor${currentStep.module === 'editor' ? ' active' : ''}`} onClick={() => setInspectedModule('editor')}>
              <span className="module-heading"><Code2 size={16} /><b>{tr('代码编辑器', 'Code editor')}</b></span>
              <code><i>const</i> a = <strong>{inputA}</strong></code>
              <code><i>const</i> b = <strong>{inputB}</strong></code>
              <code className={safeStep === 0 ? 'executing' : ''}>result = a + b</code>
            </button>

            <button type="button" className={`machine-module module-compiler${currentStep.module === 'compiler' ? ' active' : ''}`} onClick={() => setInspectedModule('compiler')}>
              <span className="module-heading"><Binary size={16} /><b>{tr('编译器', 'Compiler')}</b></span>
              <div className="compiler-sheets"><i /><i /><i /></div>
              <small>{safeStep >= 1 ? tr('4 条指令已生成', '4 instructions emitted') : tr('等待源代码', 'Waiting for source')}</small>
            </button>

            <button type="button" className={`machine-module module-queue${currentStep.module === 'queue' ? ' active' : ''}`} onClick={() => setInspectedModule('queue')}>
              <span className="module-heading"><Gauge size={16} /><b>{tr('指令队列', 'Instruction queue')}</b></span>
              <div className="instruction-chips">
                {instructions.slice(1).map((instruction, index) => <i className={index + 1 === currentStep.instruction ? 'active' : index + 1 < currentStep.instruction ? 'done' : ''} key={instruction}>{index + 1}</i>)}
              </div>
            </button>

            <button type="button" className={`machine-module module-cpu${currentStep.module === 'cpu' ? ' active' : ''}`} onClick={() => setInspectedModule('cpu')}>
              <span className="cpu-cap"><Cpu size={18} /><span><b>{tr('中央处理器', 'CPU')}</b><small>{tr('控制单元 + 寄存器 + ALU', 'Control + registers + ALU')}</small></span></span>
              <div className="cpu-die">
                <div className="control-unit"><small>CONTROL</small><strong>{safeStep < 5 ? 'FETCH' : safeStep < 7 ? 'EXEC' : 'STORE'}</strong></div>
                <div className={`alu${safeStep === 6 ? 'active' : ''}`}><Zap size={16} /><small>ALU</small><strong>{safeStep >= 6 ? `${inputA} + ${inputB}` : 'WAIT'}</strong></div>
                <div className="register-bank">
                  <span><i>R1</i><b>{machineState.r1 ?? '----'}</b></span>
                  <span><i>R2</i><b>{machineState.r2 ?? '----'}</b></span>
                  <span className={safeStep >= 6 ? 'active' : ''}><i>R3</i><b>{machineState.r3 ?? '----'}</b></span>
                </div>
              </div>
            </button>

            <button type="button" className={`machine-module module-cache${currentStep.module === 'cache' ? ' active' : ''}`} onClick={() => setInspectedModule('cache')}>
              <span className="module-heading"><Database size={16} /><b>{tr('高速缓存', 'Cache')}</b></span>
              <div className="cache-lines">
                <span className={safeStep === 3 ? 'active' : ''}><i>A0</i><b>{machineState.cacheA ?? (cacheHit ? inputA : 'MISS')}</b></span>
                <span><i>B0</i><b>{safeStep >= 4 && cacheHit ? inputB : '--'}</b></span>
                <span className={safeStep >= 7 ? 'active' : ''}><i>R0</i><b>{machineState.cacheResult ?? '--'}</b></span>
              </div>
              <small className="cache-status">{cacheHit ? tr('命中：使用短路径', 'Hit: short path') : tr('未命中：转向内存', 'Miss: continue to memory')}</small>
            </button>

            <button type="button" className={`machine-module module-memory${currentStep.module === 'memory' ? ' active' : ''}`} onClick={() => setInspectedModule('memory')}>
              <span className="module-heading"><MemoryStick size={16} /><b>{tr('内存', 'Memory')}</b></span>
              <div className="memory-banks">
                <span><i>a</i><b>{inputA}</b><small>{formatBinary(inputA)}</small></span>
                <span><i>b</i><b>{inputB}</b><small>{formatBinary(inputB)}</small></span>
                <span className={safeStep >= 7 ? 'active' : ''}><i>result</i><b>{machineState.memoryResult ?? '--'}</b><small>{machineState.memoryResult === null ? '--------' : formatBinary(machineState.memoryResult)}</small></span>
              </div>
            </button>

            <button type="button" className={`machine-module module-output${currentStep.module === 'output' ? ' active' : ''}`} onClick={() => setInspectedModule('output')}>
              <span>{tr('程序输出', 'Program output')}</span>
              <strong>{machineState.output ?? '...'}</strong>
              <small>{safeStep >= 8 ? tr('执行完成', 'Execution complete') : tr('等待结果', 'Waiting')}</small>
            </button>

            <div className="data-packet" style={packetStyle} aria-hidden="true"><span>{safeStep >= 6 ? result : safeStep >= 4 ? inputB : inputA}</span></div>

            <section className={`machine-annotation annotation-${currentStep.module}`} aria-live="polite">
              <span>{tr(currentStep.titleZh, currentStep.titleEn)}</span>
              <strong>{instructions[currentStep.instruction]}</strong>
              {narrationVisible
                ? <p>{tr(currentStep.detailZh, currentStep.detailEn)}</p>
                : <div className="machine-prediction"><p>{sourceScene?.check?.prompt || tr('先判断接下来哪一个部件会改变。', 'Predict which component changes next.')}</p><button type="button" onClick={onRevealNarration}><Eye size={14} />{tr('揭晓过程', 'Reveal')}</button></div>}
              {sourceScene?.key_point && <small><Sparkles size={13} />{sourceScene.key_point}</small>}
            </section>

            {inspectedModule && moduleDescription && (
              <section className={`module-inspector inspect-${inspectedModule}`}>
                <button type="button" onClick={() => setInspectedModule(null)} aria-label={tr('关闭部件说明', 'Close module details')}><X size={14} /></button>
                <span>{tr(moduleDescription.captionZh, moduleDescription.captionEn)}</span>
                <strong>{tr(moduleDescription.zh, moduleDescription.en)}</strong>
                <p>{inspectedModule === currentStep.module
                  ? tr(currentStep.detailZh, currentStep.detailEn)
                  : tr('这个部件始终保留在整台机器中。继续播放可以观察它何时接管数据。', 'This component remains in the machine. Continue playback to see when it takes control of the data.')}</p>
              </section>
            )}
          </main>
        </div>

        <aside className="computer-control-deck">
          <div className="control-inputs">
            <label><span>a</span><input type="number" min="0" max="99" value={inputA} onChange={event => { setInputA(Math.max(0, Math.min(99, Number(event.target.value) || 0))); resetRuntime() }} /></label>
            <label><span>b</span><input type="number" min="0" max="99" value={inputB} onChange={event => { setInputB(Math.max(0, Math.min(99, Number(event.target.value) || 0))); resetRuntime() }} /></label>
            <button type="button" className={cacheHit ? 'active' : ''} onClick={() => { setCacheHit(true); resetRuntime() }}>{tr('Cache 命中', 'Cache hit')}</button>
            <button type="button" className={!cacheHit ? 'active miss' : ''} onClick={() => { setCacheHit(false); resetRuntime() }}>{tr('Cache 未命中', 'Cache miss')}</button>
          </div>

          <div className="computer-transport">
            <button type="button" onClick={resetRuntime} aria-label={tr('重新执行', 'Restart')}><RotateCcw size={16} /></button>
            <button type="button" onClick={() => moveStep(safeStep - 1)} disabled={safeStep === 0}><ChevronLeft size={18} /></button>
            <button type="button" className="computer-play" onClick={onTogglePlaying}>{playing ? <CirclePause size={18} /> : <CirclePlay size={18} />}{playing ? tr('暂停', 'Pause') : tr('运行', 'Run')}</button>
            <button type="button" onClick={() => moveStep(safeStep + 1)}>{safeStep === baseSteps.length - 1 ? <Check size={18} /> : <ChevronRight size={18} />}</button>
          </div>

          <div className="computer-progress">
            <input aria-label={tr('执行进度', 'Execution progress')} type="range" min="0" max={baseSteps.length - 1} value={safeStep} onChange={event => moveStep(Number(event.target.value))} />
            <span>{safeStep + 1}/{baseSteps.length}</span>
          </div>

          <div className="computer-options">
            <div className="computer-learning-modes">
              {(['quick', 'guided', 'challenge'] as LearningMode[]).map(mode => <button type="button" className={learningMode === mode ? 'active' : ''} key={mode} onClick={() => onModeChange(mode)}>{mode === 'quick' ? tr('快速', 'Quick') : mode === 'guided' ? tr('完整', 'Guided') : tr('预测', 'Challenge')}</button>)}
            </div>
            {sourceScene?.check && <button type="button" className="computer-check-toggle" disabled={safeStep < 6} onClick={() => setCheckpointOpen(value => !value)}>{tr('理解检查', 'Check')}</button>}
            <label><span>{tr('速度', 'Speed')}</span><select value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.5">1.5×</option></select></label>
          </div>
        </aside>

        {sourceScene?.check && safeStep >= 6 && checkpointOpen && (
          <section className="computer-checkpoint">
            <button className="computer-check-close" type="button" onClick={() => setCheckpointOpen(false)} aria-label={tr('关闭理解检查', 'Close check')}><X size={14} /></button>
            <div><strong>{sourceScene.check.prompt}</strong>{checkpoint && <span>{tr(`已尝试 ${checkpoint.attempts} 次`, `${checkpoint.attempts} attempts`)}</span>}</div>
            <div>{sourceScene.check.options.map(option => <button type="button" className={checked ? option === sourceScene.check?.answer ? 'correct' : option === selectedAnswer ? 'incorrect' : '' : ''} disabled={checked} key={option} onClick={() => onAnswer(option)}>{option}</button>)}</div>
            {checked && <p>{sourceScene.check.explanation}</p>}
          </section>
        )}
      </div>
    </section>
  )
}
