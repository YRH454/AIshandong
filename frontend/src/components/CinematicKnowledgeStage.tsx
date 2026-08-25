import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Binary,
  Boxes,
  ChefHat,
  Check,
  Clock3,
  CirclePause,
  CirclePlay,
  ClipboardList,
  CookingPot,
  Cpu,
  Database,
  MemoryStick,
  Monitor,
  MoveRight,
  RotateCcw,
  ScanLine,
  Sparkles,
  TimerReset,
  UserRound,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  Workflow,
  Zap,
} from 'lucide-react'
import type {
  DynamicExplanationBeat,
  DynamicExplanationInteractionOutcome,
  DynamicExplanationScene,
  DynamicExplanationStageKind,
} from './dynamicExplanation'
import { getCinematicStageKind } from './cinematicStage'
import {
  HazardLabScene,
  PerformanceLabScene,
  PipelineOverlapScene,
  StorageHierarchyScene,
} from './CinematicArchitectureScenes'
import { UniversalKnowledgeScene } from './UniversalKnowledgeScenes'

type LearningMode = 'quick' | 'guided' | 'challenge'

type CinematicKnowledgeStageProps = {
  scene: DynamicExplanationScene
  language: 'zh-CN' | 'en'
  learningMode: LearningMode
  showNarration: boolean
  onRevealNarration?: () => void
  director?: {
    active: boolean
    playing: boolean
  }
  voice?: {
    enabled: boolean
    rate: number
    onToggle: () => void
    onRateChange: () => void
  }
  onDirectorEvent?: (event: CinematicDirectorEvent) => void
  story?: {
    index: number
    total: number
    threadLabel: string
    chapterLabel: string
    previousConclusion?: string
    currentQuestion?: string
    previousOutcome?: DynamicExplanationInteractionOutcome
    receives?: string
    phaseLabel?: string
  }
}

export type CinematicDirectorEvent = {
  type: 'awaiting-interaction' | 'interaction-complete' | 'scene-complete' | 'manual-pause' | 'toggle-play'
  kind: DynamicExplanationStageKind
  step: number
  total: number
  outcome?: DynamicExplanationInteractionOutcome
}

type StageActor = {
  id: string
  label: string
  role?: string
}

const fallbackActors: Record<DynamicExplanationStageKind, Array<{ label: string; role: string }>> = {
  'service-flow': [
    { label: '学习需求', role: '输入' },
    { label: '协调角色', role: '传递' },
    { label: '核心处理', role: '执行' },
    { label: '学习结果', role: '返回' },
  ],
  'number-transform': [
    { label: '原始数值', role: '输入' },
    { label: '固定宽度', role: '约束' },
    { label: '逐位变换', role: '处理' },
    { label: '最终编码', role: '结果' },
  ],
  'instruction-cycle': [
    { label: '取指', role: '读取' },
    { label: '译码', role: '解释' },
    { label: '执行', role: '计算' },
    { label: '访存', role: '交换' },
    { label: '写回', role: '完成' },
  ],
  'storage-hierarchy': [
    { label: '寄存器', role: '最快' },
    { label: '高速缓存', role: '命中' },
    { label: '主存', role: '回填' },
    { label: '磁盘', role: '后备' },
  ],
  'pipeline-overlap': [
    { label: '取指 IF', role: '阶段' },
    { label: '译码 ID', role: '阶段' },
    { label: '执行 EX', role: '阶段' },
    { label: '访存 MEM', role: '阶段' },
    { label: '写回 WB', role: '阶段' },
  ],
  'hazard-lab': [
    { label: '依赖检测', role: '发现' },
    { label: '暂停', role: '保守' },
    { label: '转发', role: '优化' },
    { label: '清空', role: '分支' },
  ],
  'performance-lab': [
    { label: '缓存命中率', role: '参数' },
    { label: '分支预测', role: '参数' },
    { label: '内存延迟', role: '参数' },
    { label: '相对吞吐', role: '结果' },
  ],
  'process-lab': [
    { label: '输入', role: '起点' },
    { label: '规则', role: '约束' },
    { label: '变化', role: '过程' },
    { label: '结果', role: '终点' },
  ],
  'concept-constellation': [
    { label: '核心概念', role: '中心' }, { label: '关键属性', role: '分支' }, { label: '成立条件', role: '边界' }, { label: '实际应用', role: '连接' },
  ],
  'causal-chain': [
    { label: '起因', role: '输入' }, { label: '作用机制', role: '传递' }, { label: '中间变化', role: '演化' }, { label: '最终结果', role: '输出' },
  ],
  'timeline-river': [
    { label: '起点', role: '阶段' }, { label: '发展', role: '阶段' }, { label: '转折', role: '阶段' }, { label: '影响', role: '阶段' },
  ],
  'comparison-studio': [
    { label: '方案 A', role: '对照' }, { label: '关键条件', role: '变量' }, { label: '方案 B', role: '对照' }, { label: '选择依据', role: '结论' },
  ],
  'system-network': [
    { label: '输入节点', role: '来源' }, { label: '处理节点', role: '连接' }, { label: '协调节点', role: '调节' }, { label: '输出节点', role: '结果' },
  ],
  'state-machine': [
    { label: '初始状态', role: '状态' }, { label: '触发条件', role: '转换' }, { label: '中间状态', role: '状态' }, { label: '结束状态', role: '状态' },
  ],
  'case-lab': [
    { label: '案例背景', role: '证据' }, { label: '关键线索', role: '证据' }, { label: '判断过程', role: '推理' }, { label: '案例结论', role: '结论' },
  ],
  'parameter-lab': [
    { label: '输入条件', role: '参数' }, { label: '变化范围', role: '参数' }, { label: '响应趋势', role: '观察' }, { label: '稳定结论', role: '结果' },
  ],
}

const fallbackEnvironment: Record<DynamicExplanationStageKind, { zh: string; en: string }> = {
  'service-flow': { zh: '一张正在运转的服务工作台', en: 'A working service floor' },
  'number-transform': { zh: '一座逐位变换的数字工坊', en: 'A bit-by-bit number workshop' },
  'instruction-cycle': { zh: '一条可暂停的指令生产线', en: 'A pausable instruction line' },
  'storage-hierarchy': { zh: '一座从寄存器延伸到磁盘的存储塔', en: 'A storage tower from registers to disk' },
  'pipeline-overlap': { zh: '一条多指令重叠运行的五级装配线', en: 'A five-stage line with overlapping instructions' },
  'hazard-lab': { zh: '一间比较暂停、转发与清空的冲突实验室', en: 'A hazard lab comparing stall, forward, and flush' },
  'performance-lab': { zh: '两条可比较、可调节的指令竞速通道', en: 'Two comparable, tunable instruction race lanes' },
  'process-lab': { zh: '一座可以逐步观察的过程实验台', en: 'A step-by-step process lab' },
  'concept-constellation': { zh: '围绕核心主题展开的概念星图', en: 'A constellation unfolding around one core idea' },
  'causal-chain': { zh: '从起因连续传递到结果的机制链', en: 'A mechanism chain from cause to outcome' },
  'timeline-river': { zh: '沿时间与阶段不断变化的演化河流', en: 'A river of change across time and stages' },
  'comparison-studio': { zh: '把两种路径放在同一条件下比较的工作室', en: 'A studio comparing two paths under one condition' },
  'system-network': { zh: '展示节点、连接与传递方向的系统网络', en: 'A system network of nodes, links, and transfers' },
  'state-machine': { zh: '由条件推动状态转换的循环空间', en: 'A state space driven by transition conditions' },
  'case-lab': { zh: '用证据逐步形成判断的案例实验室', en: 'A case lab that builds a conclusion from evidence' },
  'parameter-lab': { zh: '调整条件并观察结果变化的参数实验台', en: 'A parameter bench for observing responsive change' },
}

function quickRoute(beats: DynamicExplanationBeat[]) {
  if (beats.length <= 4) return beats
  return [beats[0], beats[Math.floor((beats.length - 1) / 2)], beats[beats.length - 1]]
}

function ensureActors(scene: DynamicExplanationScene, kind: DynamicExplanationStageKind): StageActor[] {
  const stageActors = scene.stage?.zones?.map(zone => ({ id: zone.id, label: zone.label, role: zone.role })) || []
  const simulationActors = scene.simulation?.actors || []
  const visualActors = scene.visual.items.map((label, index) => ({ id: `visual-${index + 1}`, label, role: '' }))
  const selected = stageActors.length >= 3 ? stageActors : simulationActors.length >= 3 ? simulationActors : visualActors
  const desiredCount = kind === 'instruction-cycle' || kind === 'pipeline-overlap' || universalKinds.has(kind) ? 5 : 4
  const result = selected.slice(0, desiredCount)
  const fallbacks = fallbackActors[kind]
  while (result.length < Math.min(desiredCount, fallbacks.length)) {
    const index = result.length
    result.push({ id: `fallback-${index + 1}`, ...fallbacks[index] })
  }
  return result
}

function splitLegacyNarration(narration: string) {
  const sentences = narration
    .split(/(?<=[。！？!?；;])/u)
    .map(item => item.trim())
    .filter(Boolean)
  if (sentences.length > 1) return sentences
  return narration
    .split(/(?<=[，,、])/u)
    .map(item => item.trim())
    .filter(Boolean)
}

function ensureBeats(scene: DynamicExplanationScene, actors: StageActor[]): DynamicExplanationBeat[] {
  if (scene.director_beats?.length) return scene.director_beats
  if (scene.simulation?.beats?.length) return scene.simulation.beats
  const cueNarrations = scene.stage?.cues?.map(cue => cue.caption.trim()).filter(Boolean) || []
  const narrationParts = splitLegacyNarration(scene.narration)
  return actors.map((actor, index) => {
    const visualItem = scene.visual.items[index]
    const fallbackNarration = index === actors.length - 1
      ? scene.key_point
      : visualItem && visualItem !== actor.label
        ? `${actor.label}：${visualItem}`
        : actor.role
          ? `${actor.label}负责${actor.role}，这个条件也需要成立。`
          : scene.visual.example || `${actor.label}是当前推演的关键对象。`
    const narration = cueNarrations[index] || narrationParts[index] || fallbackNarration
    return {
      id: `stage-beat-${index + 1}`,
      label: actor.label,
      detail: narration,
      narration,
      action: index === 0 ? 'spawn' : index === actors.length - 1 ? 'resolve' : 'move',
      target: actor.id,
      from: index > 0 ? actors[index - 1].id : undefined,
      to: actor.id,
    }
  })
}

function estimatedBeatDuration(beat: DynamicExplanationBeat | undefined, text: string, rate: number) {
  if (beat?.duration_ms) return Math.max(1600, Math.min(8000, beat.duration_ms / Math.max(.75, rate)))
  const units = text.replace(/\s+/g, '').length
  return Math.max(1900, Math.min(6800, (900 + units * 105) / Math.max(.75, rate)))
}

function bitString(value: number, width = 8) {
  const normalized = ((value % 2 ** width) + 2 ** width) % 2 ** width
  return normalized.toString(2).padStart(width, '0')
}

type StageSceneProps = {
  actors: StageActor[]
  beats: DynamicExplanationBeat[]
  safeStep: number
  activeBeat?: DynamicExplanationBeat
  progress: number
  environment: string
  moveTo: (next: number) => void
  tr: (chinese: string, english: string) => string
  initialInput: number
  sourceBits: string
  invertedBits: string
  resultBits: string
  onInteraction?: (outcome?: DynamicExplanationInteractionOutcome) => void
}

const interactionKinds = new Set<DynamicExplanationStageKind>([
  'number-transform',
  'storage-hierarchy',
  'pipeline-overlap',
  'hazard-lab',
  'performance-lab',
  'concept-constellation',
  'causal-chain',
  'timeline-river',
  'comparison-studio',
  'system-network',
  'state-machine',
  'case-lab',
  'parameter-lab',
])

const universalKinds = new Set<DynamicExplanationStageKind>([
  'concept-constellation', 'causal-chain', 'timeline-river', 'comparison-studio',
  'system-network', 'state-machine', 'case-lab', 'parameter-lab',
])

function scaledPhase(safeStep: number, beats: DynamicExplanationBeat[], phaseCount: number) {
  if (phaseCount <= 1 || beats.length <= 1) return 0
  return Math.min(phaseCount - 1, Math.round(safeStep / (beats.length - 1) * (phaseCount - 1)))
}

function ServiceFlowScene({ actors, beats, safeStep, activeBeat, environment, moveTo, tr }: StageSceneProps) {
  const phase = scaledPhase(safeStep, beats, 5)
  const actorLabel = (pattern: RegExp, fallback: string) => actors.find(actor => pattern.test(`${actor.label} ${actor.role || ''}`))?.label || fallback
  const guestLabel = actorLabel(/顾客|用户|输入|guest|user|input/i, tr('顾客', 'Guest'))
  const waiterLabel = actorLabel(/服务员|总线|传递|server|waiter|bus|route/i, tr('服务员', 'Server'))
  const kitchenLabel = actorLabel(/厨师|处理|执行|cpu|chef|process|execute/i, tr('厨房与 CPU', 'Kitchen and CPU'))
  const pantryLabel = actorLabel(/内存|存储|冷藏|仓库|memory|storage|pantry/i, tr('内存与存储', 'Memory and storage'))
  const phases = [
    tr('顾客发起请求', 'Guest sends a request'),
    tr('服务员记录并传递', 'Server records and routes it'),
    tr('厨房解析并执行', 'Kitchen interprets and executes'),
    tr('存储区提供材料', 'Storage supplies resources'),
    tr('结果返回顾客', 'Result returns to the guest'),
  ]
  const phaseHardware = [tr('输入设备', 'Input'), tr('系统总线', 'System bus'), 'CPU', tr('内存', 'Memory'), tr('输出设备', 'Output')]

  return (
    <div className={`service-flow-stage service-phase-${phase}`}>
      <div className="service-floor-heading">
        <UtensilsCrossed size={19} />
        <div><strong>{environment}</strong><span>{phases[phase]}</span></div>
      </div>

      <div className="service-floorplan" aria-label={tr('餐厅服务流程俯视图', 'Restaurant service flow floorplan')}>
        <button type="button" className={`service-zone guest-zone ${phase === 0 || phase === 4 ? 'active' : ''}`} onClick={() => moveTo(0)}>
          <span className="service-zone-tag">{phaseHardware[0]}</span>
          <div className="restaurant-table" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="guest-seat"><UserRound size={25} /><Bell className="guest-bell" size={17} /></div>
          <strong>{guestLabel}</strong>
          <small>{tr('提出需求，接收最终结果', 'Sends the request and receives the result')}</small>
        </button>

        <div className="service-aisle" aria-hidden="true">
          <i className="aisle-line" />
          <MoveRight size={18} />
          <span>{tr('请求与结果通道', 'Request and result route')}</span>
        </div>

        <button type="button" className={`service-zone waiter-zone ${phase === 1 ? 'active' : ''}`} onClick={() => moveTo(Math.min(1, beats.length - 1))}>
          <span className="service-zone-tag">{phaseHardware[1]}</span>
          <div className="waiter-console"><ClipboardList size={25} /><i /><i /><i /></div>
          <strong>{waiterLabel}</strong>
          <small>{tr('把自然语言需求整理成可执行订单', 'Turns the request into an executable order')}</small>
        </button>

        <button type="button" className={`service-zone kitchen-zone ${phase === 2 ? 'active' : ''}`} onClick={() => moveTo(Math.min(2, beats.length - 1))}>
          <span className="service-zone-tag">{phaseHardware[2]}</span>
          <div className="kitchen-pass"><ChefHat size={24} /><span>{tr('解析', 'Decode')}</span><span>{tr('执行', 'Execute')}</span></div>
          <div className="stove-line" aria-hidden="true"><CookingPot size={24} /><i /><i /><i /></div>
          <strong>{kitchenLabel}</strong>
          <small>{tr('按规则处理订单并组织结果', 'Processes the order and assembles the result')}</small>
        </button>

        <button type="button" className={`service-zone pantry-zone ${phase === 3 ? 'active' : ''}`} onClick={() => moveTo(Math.min(3, beats.length - 1))}>
          <span className="service-zone-tag">{phaseHardware[3]}</span>
          <div className="pantry-shelves" aria-hidden="true"><Database size={22} /><i /><i /><i /><i /><i /><i /></div>
          <strong>{pantryLabel}</strong>
          <small>{tr('暂存指令、数据与中间结果', 'Holds instructions, data, and intermediate results')}</small>
        </button>

        <div className="service-pass-window" aria-hidden="true"><span>{tr('出餐口', 'Service pass')}</span><i /><i /><i /></div>
        <div className="service-order-rail" aria-hidden="true"><i /><i /><i /></div>

        <div className={`service-order-ticket ticket-phase-${phase}`} aria-live="polite">
          {phase === 4 ? <Check size={17} /> : <ClipboardList size={17} />}
          <div><small>{phaseHardware[phase]}</small><strong>{activeBeat?.value || activeBeat?.label || phases[phase]}</strong></div>
        </div>
        <div className={`service-waiter waiter-phase-${phase}`} aria-hidden="true"><UserRound size={21} /><span>{tr('传递', 'Route')}</span></div>
        <div className={`service-result-tray tray-phase-${phase}`} aria-hidden="true"><UtensilsCrossed size={17} /><span>{tr('处理结果', 'Result')}</span></div>
      </div>

      <div className="service-phase-strip">
        {phases.map((label, index) => (
          <button type="button" className={index === phase ? 'active' : index < phase ? 'visited' : ''} onClick={() => moveTo(Math.round(index / 4 * Math.max(0, beats.length - 1)))} key={label}>
            <i>{index < phase ? <Check size={12} /> : index + 1}</i><span>{label}</span><small>{phaseHardware[index]}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

function NumberTransformScene({ beats, safeStep, activeBeat, moveTo, tr, initialInput, sourceBits, invertedBits, resultBits, onInteraction }: StageSceneProps) {
  const phase = scaledPhase(safeStep, beats, 3)
  const [spotlightBit, setSpotlightBit] = useState(0)
  const isNegative = initialInput < 0
  const rows = [
    { label: tr('原始绝对值', 'Magnitude'), action: tr('固定 8 位宽度', 'Fix the width to 8 bits'), bits: sourceBits },
    { label: tr('逐位取反', 'Invert each bit'), action: isNegative ? tr('0 变 1，1 变 0', 'Turn 0 into 1 and 1 into 0') : tr('正数保持原编码', 'Positive values keep their encoding'), bits: invertedBits },
    { label: tr('加一结果', 'Add-one result'), action: isNegative ? tr('从最低位向左传播进位', 'Propagate the carry from the least significant bit') : tr('直接得到正数补码', 'Use the positive binary value directly'), bits: resultBits },
  ]
  const carryIndexes = new Set<number>()
  if (isNegative) {
    for (let index = invertedBits.length - 1; index >= 0; index -= 1) {
      carryIndexes.add(index)
      if (invertedBits[index] === '0') break
    }
  }

  return (
    <div className={`number-transform-stage number-phase-${phase}`}>
      <div className="number-lab-summary">
        <div className="number-input-dial"><span>{tr('十进制输入', 'Decimal input')}</span><strong>{initialInput}</strong><small>{tr('目标：8 位补码', 'Target: 8-bit complement')}</small></div>
        <div className="number-range"><span>{tr('可表示范围', 'Representable range')}</span><strong>-128 <i>到</i> 127</strong></div>
        <div className="number-sign-note"><Binary size={19} /><p><strong>{tr('符号位', 'Sign bit')}</strong><span>{tr('最高位为 1 表示负数，为 0 表示非负数', 'The highest bit is 1 for negative values and 0 otherwise')}</span></p></div>
      </div>

      <div className="number-mechanical-bench">
        <div className="number-bench-head">
          <div><TimerReset size={22} /><span>{tr('逐位变换实验台', 'Bit transformation workbench')}</span></div>
          <strong>{activeBeat?.label || rows[phase].action}</strong>
        </div>
        <div className="number-row-stack">
          {rows.map((row, rowIndex) => (
            <button type="button" className={`number-transform-row ${rowIndex === phase ? 'active' : ''} ${rowIndex < phase ? 'complete' : ''}`} onClick={() => { onInteraction?.({ kind: 'number-transform', label: row.label, detail: row.action, value: row.bits }); moveTo(Math.round(rowIndex / 2 * Math.max(0, beats.length - 1))) }} key={row.label}>
              <div className="number-row-label"><small>{rowIndex + 1}</small><span><strong>{row.label}</strong><em>{row.action}</em></span></div>
              <div className="number-bit-array">
                {row.bits.split('').map((bit, index) => (
                  <i
                    className={`${index === 0 ? 'sign-bit' : ''} ${rowIndex === 2 && carryIndexes.has(index) ? 'carry-bit' : ''}`}
                    style={{ '--bit-delay': `${index * 52}ms` } as CSSProperties}
                    key={`${rowIndex}-${index}`}
                  >
                    <small>{7 - index}</small><strong>{bit}</strong>
                    {rowIndex === 2 && carryIndexes.has(index) && <em>{index === Math.min(...carryIndexes) ? '+1' : tr('进位', 'carry')}</em>}
                  </i>
                ))}
              </div>
              <Check className="number-row-check" size={18} />
            </button>
          ))}
        </div>
        <div className="number-carry-track" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <i className={phase === 2 && carryIndexes.has(index) ? 'active' : ''} key={index}><MoveRight size={13} /></i>)}
        </div>
        <div className="number-bit-probe">
          <span>{tr('检查某一位', 'Inspect a bit')}</span>
          <div>{resultBits.split('').map((bit, index) => <button type="button" className={spotlightBit === index ? 'active' : ''} onClick={() => { const detail = index === 0 ? tr(`最高位是符号位，当前值 ${bit} 表示负数。`, `The sign bit is ${bit}, marking a negative value.`) : tr(`b${7 - index} 的权重是 ${2 ** (7 - index)}，当前编码为 ${bit}。`, `b${7 - index} has weight ${2 ** (7 - index)} and stores ${bit}.`); onInteraction?.({ kind: 'number-transform', label: `b${7 - index} = ${bit}`, detail, value: resultBits }); setSpotlightBit(index) }} key={index}><small>b{7 - index}</small><strong>{bit}</strong></button>)}</div>
          <p>{spotlightBit === 0 ? tr(`最高位是符号位：${resultBits[0]} 表示这个补码为负数。`, `The highest bit is the sign bit: ${resultBits[0]} marks this complement as negative.`) : tr(`b${7 - spotlightBit} 的权重是 ${2 ** (7 - spotlightBit)}，当前编码为 ${resultBits[spotlightBit]}。`, `b${7 - spotlightBit} has weight ${2 ** (7 - spotlightBit)} and currently stores ${resultBits[spotlightBit]}.`)}</p>
        </div>
      </div>

      <div className="number-result-panel">
        <ScanLine size={22} />
        <span>{tr('最终补码', 'Final complement')}</span>
        <strong>{resultBits}</strong>
        <div><small>{tr('十六进制', 'Hex')}</small><b>0x{Number.parseInt(resultBits, 2).toString(16).toUpperCase().padStart(2, '0')}</b></div>
        <p>{tr('每一步都保留在画面中，便于检查变换是否正确。', 'Every step stays visible so the transformation can be checked.')}</p>
      </div>
    </div>
  )
}

function InstructionCycleScene({ beats, safeStep, activeBeat, moveTo, tr }: StageSceneProps) {
  const phase = scaledPhase(safeStep, beats, 5)
  const hardwarePhases = [tr('取指', 'Fetch'), tr('译码', 'Decode'), tr('执行', 'Execute'), tr('访存', 'Memory'), tr('写回', 'Write back')]
  const activeHardware = [
    ['pc', 'imem'],
    ['control'],
    ['registers', 'alu'],
    ['memory'],
    ['writeback', 'registers'],
  ][phase]
  const isActive = (id: string) => activeHardware.includes(id)
  const clickPhase = (index: number) => moveTo(Math.round(index / 4 * Math.max(0, beats.length - 1)))

  return (
    <div className={`instruction-cycle-stage cpu-phase-${phase}`}>
      <div className="cpu-clock-line" aria-hidden="true">
        <Clock3 size={17} />
        {hardwarePhases.map((label, index) => <i className={index === phase ? 'active' : index < phase ? 'visited' : ''} key={label}><span>{index + 1}</span><small>{label}</small></i>)}
      </div>

      <div className="cpu-blueprint" aria-label={tr('CPU 指令执行硬件剖面', 'CPU instruction execution hardware cutaway')}>
        <button type="button" className={`hardware-block pc-block ${isActive('pc') ? 'active' : ''}`} onClick={() => clickPhase(0)}>
          <Clock3 size={20} /><span>PC</span><strong>0x0040</strong><small>{tr('下一条指令地址', 'Next instruction address')}</small>
        </button>
        <button type="button" className={`hardware-block imem-block ${isActive('imem') ? 'active' : ''}`} onClick={() => clickPhase(0)}>
          <MemoryStick size={21} /><span>{tr('指令存储器', 'Instruction memory')}</span><strong>ADD R1, R2, R3</strong><small>{tr('读取指令字', 'Read instruction word')}</small>
        </button>
        <button type="button" className={`hardware-block control-block ${isActive('control') ? 'active' : ''}`} onClick={() => clickPhase(1)}>
          <Cpu size={25} /><span>{tr('控制单元', 'Control unit')}</span><strong>{phase === 1 ? 'opcode: ADD' : tr('等待译码', 'Awaiting decode')}</strong><div><i>RegWrite</i><i>ALUSrc</i><i>MemRead</i></div>
        </button>
        <button type="button" className={`hardware-block registers-block ${isActive('registers') ? 'active' : ''}`} onClick={() => clickPhase(2)}>
          <Database size={22} /><span>{tr('寄存器文件', 'Register file')}</span>
          <div className="register-values"><i><small>R1</small><b>{phase >= 4 ? '12' : '0'}</b></i><i><small>R2</small><b>7</b></i><i><small>R3</small><b>5</b></i></div>
        </button>
        <button type="button" className={`hardware-block alu-block ${isActive('alu') ? 'active' : ''}`} onClick={() => clickPhase(2)}>
          <Zap size={25} /><span>ALU</span><strong>{phase >= 2 ? '7 + 5 = 12' : tr('等待操作数', 'Awaiting operands')}</strong><small>{tr('算术与逻辑运算', 'Arithmetic and logic')}</small>
        </button>
        <button type="button" className={`hardware-block memory-block ${isActive('memory') ? 'active' : ''}`} onClick={() => clickPhase(3)}>
          <MemoryStick size={22} /><span>{tr('数据存储器', 'Data memory')}</span><strong>{phase === 3 ? tr('本指令无需读写', 'No access for this instruction') : tr('待命', 'Standby')}</strong><small>{tr('访存阶段仍会经过', 'The cycle still passes this stage')}</small>
        </button>
        <button type="button" className={`hardware-block writeback-block ${isActive('writeback') ? 'active' : ''}`} onClick={() => clickPhase(4)}>
          <Monitor size={22} /><span>{tr('写回通道', 'Write-back path')}</span><strong>{phase >= 4 ? 'R1 ← 12' : tr('等待结果', 'Awaiting result')}</strong><small>{tr('结果进入目标寄存器', 'Result enters the destination register')}</small>
        </button>

        <div className="cpu-bus-network" aria-hidden="true">
          <i className="bus bus-pc-imem" /><i className="bus bus-imem-control" /><i className="bus bus-control-registers" /><i className="bus bus-registers-alu" /><i className="bus bus-alu-memory" /><i className="bus bus-memory-writeback" /><i className="bus bus-writeback-registers" />
        </div>
        <div className={`instruction-packet instruction-packet-${phase}`} aria-hidden="true"><Sparkles size={14} /><span>ADD R1,R2,R3</span></div>
        <div className={`data-packet data-packet-${phase}`} aria-hidden="true"><Boxes size={14} /><span>{phase < 2 ? 'R2=7 · R3=5' : 'DATA 12'}</span></div>
      </div>

      <div className="cpu-stage-readout">
        <div><span>{hardwarePhases[phase]}</span><strong>{activeBeat?.label || hardwarePhases[phase]}</strong></div>
        <p>{phase === 0 && tr('程序计数器给出地址，指令存储器返回指令。', 'The program counter supplies an address and instruction memory returns the instruction.')}{phase === 1 && tr('控制单元拆解操作码与寄存器字段，生成控制信号。', 'The control unit separates the opcode and register fields, then emits control signals.')}{phase === 2 && tr('R2 与 R3 的数据进入 ALU，完成加法得到 12。', 'R2 and R3 enter the ALU and produce 12.')}{phase === 3 && tr('这条 ADD 不读取数据存储器，但流程仍经过访存阶段。', 'This ADD does not read data memory, but the cycle still passes through memory.')}{phase === 4 && tr('结果 12 通过独立写回通道进入 R1，指令完成。', 'The result 12 travels through the write-back path into R1, completing the instruction.')}</p>
        <div className="cpu-legend"><span><i />{tr('指令流', 'Instruction flow')}</span><span><i />{tr('数据流', 'Data flow')}</span></div>
      </div>
    </div>
  )
}

export function CinematicKnowledgeStage({ scene, language, learningMode, showNarration, onRevealNarration, director, voice, onDirectorEvent, story }: CinematicKnowledgeStageProps) {
  const kind = getCinematicStageKind(scene) || 'process-lab'
  const tr = (chinese: string, english: string) => language === 'en' ? english : chinese
  const actors = useMemo(() => ensureActors(scene, kind), [kind, scene])
  const fullBeats = useMemo(() => ensureBeats(scene, actors), [actors, scene])
  const beats = useMemo(() => learningMode === 'quick' ? quickRoute(fullBeats) : fullBeats, [fullBeats, learningMode])
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [interactionSatisfied, setInteractionSatisfied] = useState(false)
  const [interactionGateReached, setInteractionGateReached] = useState(false)
  const [handoffVisible, setHandoffVisible] = useState(Boolean(story?.previousConclusion))
  const waitingSentRef = useRef(false)
  const completionSentRef = useRef(false)
  const playbackTokenRef = useRef(0)
  const safeStep = Math.min(step, Math.max(0, beats.length - 1))
  const activeBeat = beats[safeStep]
  const cue = scene.stage?.cues?.find(item => item.beat_id === activeBeat?.id)
  const activeTarget = cue?.focus || cue?.to || activeBeat?.to || activeBeat?.target
  const activeActorIndex = Math.max(0, actors.findIndex(actor => actor.id === activeTarget))
  const progress = beats.length ? (safeStep + 1) / beats.length : 0
  const environment = scene.stage?.environment || tr(fallbackEnvironment[kind].zh, fallbackEnvironment[kind].en)
  const baseFocalQuestion = story?.currentQuestion || scene.stage?.focal_question || scene.check?.prompt || scene.key_point
  const focalQuestion = story?.previousOutcome
    ? `${story.previousOutcome.label} 已成为本幕条件：${baseFocalQuestion}`
    : baseFocalQuestion
  const activeDetail = activeBeat?.narration || cue?.caption || activeBeat?.detail || scene.narration
  const activeTone = activeBeat?.tone || (scene.path_role === 'remediation' ? 'correction' : scene.path_role === 'advanced' ? 'challenge' : safeStep === beats.length - 1 ? 'conclusion' : 'guide')
  const activeTargetLabel = actors.find(actor => actor.id === activeTarget)?.label || activeBeat?.label || scene.title
  const directorActive = Boolean(director?.active)
  const effectivePlaying = directorActive ? Boolean(director?.playing) : playing
  const explicitInteractionPause = beats.findIndex(beat => beat.pause_for_interaction)
  const interactionPauseStep = directorActive && (scene.stage?.requires_interaction || interactionKinds.has(kind)) && beats.length > 1
    ? explicitInteractionPause >= 0 ? explicitInteractionPause : Math.max(1, Math.min(beats.length - 1, Math.round((beats.length - 1) * .45)))
    : null
  const waitingForInteraction = interactionGateReached && !interactionSatisfied
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

  const emitDirectorEvent = useCallback((type: CinematicDirectorEvent['type'], outcome?: DynamicExplanationInteractionOutcome) => {
    onDirectorEvent?.({ type, kind, step: safeStep, total: beats.length, outcome })
  }, [beats.length, kind, onDirectorEvent, safeStep])

  useEffect(() => {
    setStep(0)
    setPlaying(false)
    setInteractionSatisfied(false)
    setInteractionGateReached(false)
    waitingSentRef.current = false
    completionSentRef.current = false
    playbackTokenRef.current += 1
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [learningMode, scene.id])

  useEffect(() => {
    if (!story?.previousConclusion) {
      setHandoffVisible(false)
      return undefined
    }
    setHandoffVisible(true)
    const timer = window.setTimeout(() => setHandoffVisible(false), 4200)
    return () => window.clearTimeout(timer)
  }, [scene.id, story?.previousConclusion])

  useEffect(() => {
    if (!waitingForInteraction || waitingSentRef.current) return
    waitingSentRef.current = true
    emitDirectorEvent('awaiting-interaction')
  }, [emitDirectorEvent, waitingForInteraction])

  useEffect(() => {
    if (!effectivePlaying || waitingForInteraction || !activeBeat) return undefined
    const token = playbackTokenRef.current + 1
    playbackTokenRef.current = token
    let fallbackTimer: number | null = null
    let finished = false
    const advance = () => {
      if (finished || token !== playbackTokenRef.current) return
      finished = true
      if (interactionPauseStep === safeStep && !interactionSatisfied) {
        setInteractionGateReached(true)
        return
      }
      if (safeStep >= beats.length - 1) {
        if (!directorActive) {
          setPlaying(false)
        } else if (!completionSentRef.current) {
          completionSentRef.current = true
          emitDirectorEvent('scene-complete')
        }
        return
      }
      setStep(current => Math.min(current + 1, beats.length - 1))
    }
    const duration = estimatedBeatDuration(activeBeat, activeDetail, voice?.rate || 1)
    if (voice?.enabled && speechSupported) {
      const utterance = new SpeechSynthesisUtterance(activeDetail)
      utterance.lang = language
      utterance.rate = voice.rate
      utterance.pitch = activeTone === 'question' ? 1.06 : activeTone === 'correction' ? .94 : 1
      const matchingVoice = window.speechSynthesis.getVoices().find(item => item.lang.toLowerCase().startsWith(language === 'en' ? 'en' : 'zh'))
      if (matchingVoice) utterance.voice = matchingVoice
      utterance.onend = advance
      utterance.onerror = event => {
        if (event.error === 'canceled' || event.error === 'interrupted') return
        fallbackTimer = window.setTimeout(advance, Math.min(1800, duration))
      }
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    } else {
      fallbackTimer = window.setTimeout(advance, duration)
    }
    return () => {
      playbackTokenRef.current += 1
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer)
      if (voice?.enabled && speechSupported) window.speechSynthesis.cancel()
    }
  }, [activeBeat, activeDetail, activeTone, beats.length, directorActive, effectivePlaying, emitDirectorEvent, interactionPauseStep, interactionSatisfied, language, safeStep, speechSupported, voice?.enabled, voice?.rate, waitingForInteraction])

  const moveTo = (next: number) => {
    setPlaying(false)
    setInteractionGateReached(false)
    setStep(Math.max(0, Math.min(next, beats.length - 1)))
  }

  const manualMoveTo = (next: number) => {
    if (directorActive) emitDirectorEvent('manual-pause')
    moveTo(next)
  }

  const handleInteraction = useCallback((outcome?: DynamicExplanationInteractionOutcome) => {
    setInteractionSatisfied(true)
    setInteractionGateReached(false)
    if (interactionGateReached && safeStep < beats.length - 1) {
      const resumeStep = Math.min(safeStep + 1, beats.length - 1)
      window.setTimeout(() => setStep(current => Math.max(current, resumeStep)), 0)
    }
    waitingSentRef.current = false
    emitDirectorEvent('interaction-complete', outcome || {
      kind,
      label: activeBeat?.label || scene.title,
      detail: activeBeat?.detail || scene.continuity?.passes || scene.key_point,
      value: activeBeat?.value,
    })
  }, [activeBeat?.detail, activeBeat?.label, activeBeat?.value, beats.length, emitDirectorEvent, interactionGateReached, kind, safeStep, scene.continuity?.passes, scene.key_point, scene.title])

  const initialInput = Number.isFinite(scene.simulation?.initial_input) ? Number(scene.simulation?.initial_input) : -5
  const sourceBits = bitString(Math.abs(initialInput))
  const invertedBits = initialInput < 0 ? sourceBits.split('').map(bit => bit === '0' ? '1' : '0').join('') : sourceBits
  const resultBits = bitString(initialInput)
  const sceneProps: StageSceneProps = { actors, beats, safeStep, activeBeat, progress, environment, moveTo, tr, initialInput, sourceBits, invertedBits, resultBits, onInteraction: handleInteraction }
  const architectureProps = { beats, safeStep, activeBeat, environment, moveTo, tr, onInteraction: handleInteraction }
  const storyIndex = story?.index ?? -1
  const storyTotal = story?.total || 0
  const branchBrief = scene.path_role === 'remediation' || scene.path_role === 'advanced' ? scene.branch_brief : undefined

  return (
    <section className={`cinematic-knowledge-stage cinematic-${kind} path-${scene.path_role || 'main'} tone-${activeTone}${directorActive ? ' is-director' : ''}${effectivePlaying ? ' is-director-playing' : ''}${waitingForInteraction ? ' is-awaiting-interaction' : ''}`} aria-label={tr('导演式动态讲解', 'Directed interactive lesson')}>
      <header className="cinematic-scene-copy">
        <div>
          <h1>{scene.title}</h1>
          <p>{showNarration ? activeDetail : focalQuestion}</p>
        </div>
        <aside className={branchBrief ? 'cinematic-branch-brief' : ''}>
          {branchBrief ? (
            <>
              <span className="cinematic-branch-mode">{scene.path_role === 'remediation' ? <ScanLine size={14} /> : <Sparkles size={14} />}{scene.path_role === 'remediation' ? tr('纠错实验', 'Correction lab') : tr('迁移挑战', 'Transfer challenge')}</span>
              <strong>{branchBrief.diagnosis}</strong>
              <p>{branchBrief.teaching_move}</p>
              <small>{tr('通过证据：', 'Success evidence: ')}{branchBrief.success_evidence}</small>
            </>
          ) : <strong>{scene.key_point}</strong>}
          {!showNarration && onRevealNarration && <button type="button" onClick={onRevealNarration}>{tr('揭晓这一幕', 'Reveal this scene')}</button>}
        </aside>
      </header>

      <div className={`cinematic-stage-window${storyIndex >= 0 ? ' has-story-thread' : ''}${story?.previousOutcome ? ' has-carried-result' : ''}`}>
        {storyIndex >= 0 && <div className="cinematic-story-thread" aria-label={tr('连续讲解主线', 'Continuous lesson thread')}><strong>{story?.threadLabel}</strong><span><b>{storyIndex + 1}/{storyTotal}</b>{story?.phaseLabel ? `${story.phaseLabel} · ` : ''}{story?.chapterLabel}</span><i><em style={{ '--story-progress': (storyIndex + 1) / Math.max(1, storyTotal) } as CSSProperties} /></i></div>}
        {handoffVisible && story?.previousConclusion && <div className="cinematic-scene-handoff" role="status"><small>{story.previousOutcome ? tr('你的操作成为本幕输入', 'Your action becomes this scene input') : tr('承接上一幕', 'From the previous scene')}</small><strong>{story.previousOutcome?.label || story.previousConclusion}</strong>{story.currentQuestion && <span><ArrowRight size={13} />{story.currentQuestion}</span>}</div>}
        {story?.previousOutcome && <div className="cinematic-carried-result"><small>{tr('已带入', 'Carried in')}</small><strong>{story.previousOutcome.label}</strong><span>{story.receives || story.previousOutcome.detail}</span></div>}
        {kind === 'service-flow' ? (
          <ServiceFlowScene {...sceneProps} />
        ) : kind === 'number-transform' ? (
          <NumberTransformScene {...sceneProps} />
        ) : kind === 'instruction-cycle' ? (
          <InstructionCycleScene {...sceneProps} />
        ) : kind === 'storage-hierarchy' ? (
          <StorageHierarchyScene {...architectureProps} />
        ) : kind === 'pipeline-overlap' ? (
          <PipelineOverlapScene {...architectureProps} />
        ) : kind === 'hazard-lab' ? (
          <HazardLabScene {...architectureProps} />
        ) : kind === 'performance-lab' ? (
          <PerformanceLabScene {...architectureProps} />
        ) : universalKinds.has(kind) ? (
          <UniversalKnowledgeScene kind={kind} scene={scene} {...sceneProps} />
        ) : (
          <div className="process-lab-stage">
            <div className="process-lab-core"><Workflow size={38} /><strong>{activeBeat?.label}</strong><p>{activeDetail}</p></div>
            {actors.map((actor, index) => <button type="button" className={index === activeActorIndex ? 'active' : ''} key={actor.id} onClick={() => moveTo(Math.min(index, beats.length - 1))}><span>{actor.role}</span><strong>{actor.label}</strong></button>)}
          </div>
        )}
      </div>

      <footer className="cinematic-transport">
        <button type="button" aria-label={tr('上一个变化', 'Previous change')} disabled={safeStep === 0} onClick={() => manualMoveTo(safeStep - 1)}><ArrowLeft size={18} /></button>
        <button type="button" className="cinematic-play" aria-pressed={effectivePlaying} onClick={() => directorActive ? emitDirectorEvent('toggle-play') : setPlaying(value => !value)}>{effectivePlaying ? <CirclePause size={19} /> : <CirclePlay size={19} />}<span>{waitingForInteraction ? tr('等待操作', 'Your turn') : effectivePlaying ? tr('暂停推演', 'Pause') : tr('继续推演', 'Continue')}</span></button>
        {voice && <div className="cinematic-voice-controls"><button type="button" className={voice.enabled ? 'active' : ''} disabled={!speechSupported} aria-pressed={voice.enabled} aria-label={speechSupported ? voice.enabled ? tr('关闭语音', 'Mute narration') : tr('开启语音', 'Enable narration') : tr('当前浏览器不支持语音', 'Speech is unavailable in this browser')} onClick={voice.onToggle}>{voice.enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}</button><button type="button" disabled={!voice.enabled || !speechSupported} aria-label={tr('切换讲解语速', 'Change narration speed')} onClick={voice.onRateChange}>{voice.rate.toFixed(2).replace(/0$/, '')}×</button></div>}
        <div className="cinematic-progress">
          <i><span style={{ '--scene-progress': progress } as CSSProperties} /></i>
          <strong className={`tone-${activeTone}`} aria-live="polite">{activeDetail}</strong>
          <small>{safeStep + 1}/{beats.length}</small>
          <em>{tr('画面聚焦：', 'Visual focus: ')}{activeTargetLabel}</em>
        </div>
        <button type="button" aria-label={tr('下一个变化', 'Next change')} disabled={safeStep >= beats.length - 1} onClick={() => manualMoveTo(safeStep + 1)}><ArrowRight size={18} /></button>
        <button type="button" aria-label={tr('重新播放本幕', 'Restart scene')} onClick={() => manualMoveTo(0)}><RotateCcw size={17} /></button>
      </footer>
    </section>
  )
}
