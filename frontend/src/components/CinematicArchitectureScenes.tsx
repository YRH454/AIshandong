import { useMemo, useState, type CSSProperties } from 'react'
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Check,
  CircleGauge,
  Clock3,
  Cpu,
  Database,
  FastForward,
  Gauge,
  HardDrive,
  Layers3,
  MemoryStick,
  Pause,
  Play,
  RotateCcw,
  Route,
  Sparkles,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import type { DynamicExplanationBeat } from './dynamicExplanation'

export type ArchitectureSceneProps = {
  beats: DynamicExplanationBeat[]
  safeStep: number
  activeBeat?: DynamicExplanationBeat
  environment: string
  moveTo: (next: number) => void
  tr: (chinese: string, english: string) => string
  onInteraction?: () => void
}

function scaledPhase(safeStep: number, beats: DynamicExplanationBeat[], phaseCount: number) {
  if (phaseCount <= 1 || beats.length <= 1) return 0
  return Math.min(phaseCount - 1, Math.round(safeStep / (beats.length - 1) * (phaseCount - 1)))
}

function toBeat(index: number, count: number, beats: DynamicExplanationBeat[]) {
  if (count <= 1 || beats.length <= 1) return 0
  return Math.round(index / (count - 1) * (beats.length - 1))
}

export function StorageHierarchyScene({ beats, safeStep, activeBeat, environment, moveTo, tr, onInteraction }: ArchitectureSceneProps) {
  const phase = scaledPhase(safeStep, beats, 5)
  const [requestKind, setRequestKind] = useState<'hit' | 'miss'>('miss')
  const layers = [
    { id: 'register', label: tr('寄存器', 'Registers'), latency: '1 cycle', capacity: '32 × 64 bit', icon: Cpu },
    { id: 'l1', label: 'L1 Cache', latency: '4 cycles', capacity: '64 KB', icon: Zap },
    { id: 'l2', label: 'L2 Cache', latency: '12 cycles', capacity: '1 MB', icon: Layers3 },
    { id: 'ram', label: tr('主存 RAM', 'Main memory'), latency: '100 cycles', capacity: '16 GB', icon: MemoryStick },
    { id: 'disk', label: tr('固态硬盘', 'SSD'), latency: '≈ 100 μs', capacity: '1 TB', icon: HardDrive },
  ]
  const resolvedPhase = requestKind === 'hit' ? Math.min(phase, 1) : phase
  const current = layers[resolvedPhase]

  return (
    <div className={`storage-hierarchy-stage storage-phase-${resolvedPhase}`}>
      <header className="storage-stage-head">
        <div><Database size={21} /><span>{environment}</span><strong>{tr('R2 与 R3 正等待送入 CPU', 'R2 and R3 are waiting to reach the CPU')}</strong></div>
        <div className="storage-request-switch" aria-label={tr('选择访问结果', 'Choose access result')}>
          <button type="button" className={requestKind === 'hit' ? 'active' : ''} onClick={() => { onInteraction?.(); setRequestKind('hit'); moveTo(toBeat(1, 5, beats)) }}>{tr('L1 命中', 'L1 hit')}</button>
          <button type="button" className={requestKind === 'miss' ? 'active' : ''} onClick={() => { onInteraction?.(); setRequestKind('miss') }}>{tr('逐层未命中', 'Miss and descend')}</button>
        </div>
      </header>

      <div className="storage-tower-shell">
        <div className="storage-latency-axis" aria-hidden="true"><span>{tr('更快 · 更小', 'Faster · smaller')}</span><i /><ArrowDown size={18} /><span>{tr('更慢 · 更大', 'Slower · larger')}</span></div>
        <div className="storage-tower">
          {layers.map((layer, index) => {
            const Icon = layer.icon
            return (
              <button
                type="button"
                className={`${index === resolvedPhase ? 'active' : ''}${index < resolvedPhase ? 'visited' : ''}`}
                style={{ '--storage-level': index } as CSSProperties}
                onClick={() => { onInteraction?.(); moveTo(toBeat(index, layers.length, beats)) }}
                key={layer.id}
              >
                <Icon size={20} />
                <span><small>{tr(`第 ${index + 1} 层`, `Level ${index + 1}`)}</small><strong>{layer.label}</strong></span>
                <span><small>{tr('典型延迟', 'Typical latency')}</small><b>{layer.latency}</b></span>
                <span><small>{tr('示意容量', 'Illustrative capacity')}</small><b>{layer.capacity}</b></span>
                <i>{index < resolvedPhase ? tr('未命中', 'Miss') : index === resolvedPhase ? tr('当前访问', 'Active') : tr('等待', 'Waiting')}</i>
              </button>
            )
          })}
          <div className={`storage-data-capsule capsule-level-${resolvedPhase}`} aria-live="polite"><Sparkles size={14} /><span>R2=7 · R3=5</span></div>
        </div>
        <aside className="storage-inspector">
          <span>{requestKind === 'hit' ? tr('命中路径', 'Hit path') : tr('访问追踪', 'Access trace')}</span>
          <strong>{current.label}</strong>
          <p>{requestKind === 'hit'
            ? tr('数据在 L1 Cache 被找到，不必继续访问更慢的层级。', 'The data is found in L1 Cache, so slower layers are skipped.')
            : tr('每次未命中都会把请求送往更大但更慢的下一层，直到找到数据。', 'Each miss sends the request to a larger but slower level until the data is found.')}</p>
          <dl><div><dt>{tr('当前代价', 'Current cost')}</dt><dd>{current.latency}</dd></div><div><dt>{tr('正在寻找', 'Looking for')}</dt><dd>R2 / R3</dd></div><div><dt>{tr('下一步', 'Next')}</dt><dd>{resolvedPhase >= 4 ? tr('回填并返回 CPU', 'Refill and return') : layers[resolvedPhase + 1]?.label}</dd></div></dl>
          <small>{activeBeat?.label || tr('点击任意层，观察请求如何改变路径', 'Select a level to inspect the request path')}</small>
        </aside>
      </div>
    </div>
  )
}

export function PipelineOverlapScene({ beats, safeStep, activeBeat, moveTo, tr, onInteraction }: ArchitectureSceneProps) {
  const clock = scaledPhase(safeStep, beats, 8)
  const stages = ['IF', 'ID', 'EX', 'MEM', 'WB']
  const instructions = ['ADD R1,R2,R3', 'SUB R4,R1,R5', 'LW R6,0(R1)', 'AND R7,R6,R8']

  return (
    <div className="pipeline-overlap-stage">
      <header className="pipeline-stage-head">
        <div><Clock3 size={20} /><span>{tr('同一个时钟里，多条指令占据不同工位', 'Several instructions occupy different stations in one clock')}</span></div>
        <button type="button" onClick={() => { onInteraction?.(); moveTo(Math.min(safeStep + 1, beats.length - 1)) }} disabled={safeStep >= beats.length - 1}><Play size={15} />{tr('推进一个时钟', 'Advance one clock')}</button>
      </header>
      <div className="pipeline-clock-ruler" style={{ '--active-clock': clock } as CSSProperties}>
        {Array.from({ length: 8 }, (_, index) => <button type="button" className={index === clock ? 'active' : index < clock ? 'visited' : ''} onClick={() => { onInteraction?.(); moveTo(toBeat(index, 8, beats)) }} key={index}><span>T{index + 1}</span></button>)}
      </div>
      <div className="pipeline-factory">
        <div className="pipeline-stage-labels"><span />{stages.map(stage => <strong key={stage}>{stage}</strong>)}</div>
        {instructions.map((instruction, row) => (
          <div className="pipeline-instruction-row" key={instruction}>
            <strong>{instruction}</strong>
            {stages.map((stage, column) => {
              const occupiedClock = row + column
              const visible = occupiedClock <= clock
              const active = occupiedClock === clock
              return <div className={`${visible ? 'occupied' : ''}${active ? ' active' : ''}`} key={stage}><span>{visible ? stage : ''}</span>{active && <i />}</div>
            })}
          </div>
        ))}
        <div className="pipeline-clock-beam" style={{ '--clock-ratio': clock / 7 } as CSSProperties} aria-hidden="true" />
      </div>
      <footer className="pipeline-throughput-readout">
        <div><span>{tr('当前时钟', 'Clock')}</span><strong>T{clock + 1}</strong></div>
        <div><span>{tr('并行中的指令', 'Instructions in flight')}</span><strong>{Math.min(4, clock + 1, 8 - clock + 3)}</strong></div>
        <div><span>{tr('已完成', 'Completed')}</span><strong>{Math.max(0, clock - 3)}</strong></div>
        <p>{activeBeat?.detail || tr('流水线提高的是吞吐率：工位并行工作，而不是让单条指令跳过阶段。', 'Pipelining improves throughput: stations work in parallel without letting one instruction skip stages.')}</p>
      </footer>
    </div>
  )
}

type HazardStrategy = 'stall' | 'forward' | 'flush'

export function HazardLabScene({ beats, safeStep, activeBeat, moveTo, tr, onInteraction }: ArchitectureSceneProps) {
  const [strategy, setStrategy] = useState<HazardStrategy>('forward')
  const phase = scaledPhase(safeStep, beats, 4)
  const strategies = {
    stall: { label: tr('暂停等待', 'Stall'), cycles: 9, icon: Pause, note: tr('插入气泡，等待 R1 写回后再继续。最直观，但浪费周期。', 'Insert bubbles until R1 is written back. Simple, but it wastes cycles.') },
    forward: { label: tr('数据转发', 'Forward'), cycles: 7, icon: FastForward, note: tr('把 ALU 结果直接送回下一条指令的输入端，绕过写回等待。', 'Route the ALU result directly into the next instruction, bypassing write-back wait.') },
    flush: { label: tr('清空重取', 'Flush'), cycles: 11, icon: RotateCcw, note: tr('清空错误路径并重新取指，适用于分支判断错误，不适合普通数据相关。', 'Discard the wrong path and refetch. Useful for branch mistakes, not ordinary data dependence.') },
  }
  const selected = strategies[strategy]

  return (
    <div className={`hazard-lab-stage hazard-${strategy} hazard-phase-${phase}`}>
      <header className="hazard-stage-head"><TriangleAlert size={21} /><div><span>{tr('检测到 RAW 数据相关', 'RAW data hazard detected')}</span><strong>SUB R4, <em>R1</em>, R5 {tr('正在等待上一条 ADD 的结果', 'needs the previous ADD result')}</strong></div></header>
      <div className="hazard-workbench">
        <section className="hazard-instruction-stack">
          <article className="producer"><span>{tr('生产者', 'Producer')}</span><strong>ADD R1, R2, R3</strong><div><i>EX</i><ArrowRight size={16} /><b>R1 = 12</b><ArrowRight size={16} /><i>WB</i></div></article>
          <article className="consumer"><span>{tr('消费者', 'Consumer')}</span><strong>SUB R4, R1, R5</strong><div><i>ID</i><ArrowRight size={16} /><b>R1 = ?</b><ArrowRight size={16} /><i>EX</i></div></article>
          <div className={`hazard-route hazard-route-${strategy}`} aria-hidden="true"><Route size={18} /><span>{strategy === 'forward' ? tr('EX/MEM → ALU 输入', 'EX/MEM → ALU input') : strategy === 'stall' ? tr('等待 WB', 'Wait for WB') : tr('清空 IF/ID', 'Flush IF/ID')}</span></div>
        </section>
        <section className="hazard-strategy-console">
          <span>{tr('选择处理策略', 'Choose a response')}</span>
          <div>{(Object.keys(strategies) as HazardStrategy[]).map(key => { const item = strategies[key]; const Icon = item.icon; return <button type="button" className={strategy === key ? 'active' : ''} onClick={() => { onInteraction?.(); setStrategy(key); moveTo(toBeat(key === 'stall' ? 1 : key === 'forward' ? 2 : 3, 4, beats)) }} key={key}><Icon size={18} /><strong>{item.label}</strong><small>{item.cycles} cycles</small></button> })}</div>
          <p>{selected.note}</p>
        </section>
        <aside className="hazard-cycle-result"><CircleGauge size={23} /><span>{tr('完成这组指令', 'Complete this instruction pair')}</span><strong>{selected.cycles}</strong><small>cycles</small><div><i style={{ '--hazard-cost': selected.cycles / 11 } as CSSProperties} /></div><p>{strategy === 'forward' ? tr('本题最佳：结果提前到达，少等待 2 个周期。', 'Best here: the result arrives early, saving two cycles.') : strategy === 'stall' ? tr('正确但保守：不会出错，却牺牲吞吐率。', 'Correct but conservative: safe at the cost of throughput.') : tr('策略不匹配：数据冒险不需要清空整条前端流水线。', 'Mismatched strategy: this data hazard does not require flushing the front end.')}</p></aside>
      </div>
      <footer className="hazard-verdict"><span>{activeBeat?.label || tr('策略实验', 'Strategy experiment')}</span><strong>{strategy === 'forward' ? <><Check size={16} />{tr('转发路径成立', 'Forwarding path works')}</> : <>{tr('比较代价后再选择', 'Compare the cost before choosing')}</>}</strong></footer>
    </div>
  )
}

export function PerformanceLabScene({ beats, safeStep, activeBeat, moveTo, tr, onInteraction }: ArchitectureSceneProps) {
  const [cacheHit, setCacheHit] = useState(88)
  const [prediction, setPrediction] = useState(82)
  const [memoryLatency, setMemoryLatency] = useState(120)
  const phase = scaledPhase(safeStep, beats, 4)
  const result = useMemo(() => {
    const memoryPenalty = (100 - cacheHit) / 100 * memoryLatency / 34
    const branchPenalty = (100 - prediction) / 100 * 2.4
    const cpi = 1 + memoryPenalty + branchPenalty
    const throughput = 100 / cpi
    return { cpi, throughput, gain: Math.max(0, (2.7 - cpi) / 2.7 * 100) }
  }, [cacheHit, memoryLatency, prediction])
  const bottleneck = cacheHit < 82
    ? tr('缓存未命中正在拖慢取数', 'Cache misses are slowing data access')
    : prediction < 78
      ? tr('分支误判正在清空流水线', 'Branch misses are flushing the pipeline')
      : memoryLatency > 150
        ? tr('主存往返成为最长等待', 'Memory round trips are the longest wait')
        : tr('三处瓶颈已经接近平衡', 'The three bottlenecks are close to balanced')
  const optimizedDuration = Math.min(1, result.cpi / 2.7)

  return (
    <div className="performance-lab-stage">
      <header className="performance-stage-head"><Gauge size={22} /><div><span>{tr('把最后的优化决策交给你', 'The final optimization decision is yours')}</span><strong>{tr('调整参数，观察同一条指令链的相对性能变化', 'Tune the parameters and observe the relative performance of the same instruction chain')}</strong></div><button type="button" onClick={() => { setCacheHit(88); setPrediction(82); setMemoryLatency(120); moveTo(0) }}><RotateCcw size={15} />{tr('恢复基线', 'Reset baseline')}</button></header>
      <div className="performance-race-scene" style={{ '--optimized-speed': `${2.8 + optimizedDuration * 2.2}s`, '--performance-gain': result.gain / 100 } as CSSProperties}>
        <section className="performance-raceway">
          <header><div><Activity size={20} /><span>{tr('同一条指令链，两种运行状态', 'The same instruction chain in two runtime states')}</span></div><strong>{bottleneck}</strong></header>
          <div className="performance-lane baseline-lane">
            <div className="lane-identity"><span>{tr('基线通道', 'Baseline')}</span><strong>2.70 CPI</strong></div>
            <div className="lane-track"><i /><span className="lane-node fetch">ADD</span><span className="lane-node cache">CACHE<small>{tr('等待', 'wait')}</small></span><span className="lane-node branch">BRANCH<small>{tr('重取', 'refetch')}</small></span><span className="lane-node memory">MEM<small>180c</small></span><span className="lane-finish"><Check size={15} />{tr('完成', 'done')}</span><b className="lane-packet baseline-packet">R1←12</b></div>
          </div>
          <div className="performance-lane optimized-lane">
            <div className="lane-identity"><span>{tr('你的优化通道', 'Your optimized lane')}</span><strong>{result.cpi.toFixed(2)} CPI</strong></div>
            <div className="lane-track"><i /><span className={`lane-node fetch ${phase >= 0 ? 'active' : ''}`}>ADD</span><span className={`lane-node cache ${phase >= 1 ? 'active' : ''}`}>CACHE<small>{cacheHit}% hit</small></span><span className={`lane-node branch ${phase >= 2 ? 'active' : ''}`}>BRANCH<small>{prediction}%</small></span><span className={`lane-node memory ${phase >= 3 ? 'active' : ''}`}>MEM<small>{memoryLatency}c</small></span><span className="lane-finish"><Check size={15} />{tr('完成', 'done')}</span><b className="lane-packet optimized-packet">R1←12</b></div>
          </div>
          <div className="performance-race-result"><span>{tr('相对基线提前', 'Ahead of baseline')}</span><strong>{result.gain.toFixed(1)}%</strong><small>{tr(`相对吞吐 ${result.throughput.toFixed(1)} / 100`, `Relative throughput ${result.throughput.toFixed(1)} / 100`)}</small></div>
          <p>{activeBeat?.detail || tr('优化不是单独追求某个数字，而是让整条指令路径更少等待、更少返工。', 'Optimization is not about one number; it is about reducing waiting and rework across the whole instruction path.')}</p>
        </section>
        <section className="performance-tuning-deck">
          <label><span><strong>{tr('缓存命中率', 'Cache hit rate')}</strong><b>{cacheHit}%</b></span><input type="range" min="60" max="99" value={cacheHit} onPointerDown={onInteraction} onChange={event => { onInteraction?.(); setCacheHit(Number(event.target.value)); moveTo(toBeat(1, 4, beats)) }} /><small>{tr('减少慢速主存访问', 'Avoid slow memory trips')}</small></label>
          <label><span><strong>{tr('分支预测准确率', 'Branch prediction')}</strong><b>{prediction}%</b></span><input type="range" min="50" max="99" value={prediction} onPointerDown={onInteraction} onChange={event => { onInteraction?.(); setPrediction(Number(event.target.value)); moveTo(toBeat(2, 4, beats)) }} /><small>{tr('减少错误路径清空', 'Reduce wrong-path flushes')}</small></label>
          <label><span><strong>{tr('主存访问延迟', 'Memory latency')}</strong><b>{memoryLatency} cycles</b></span><input type="range" min="40" max="240" step="10" value={memoryLatency} onPointerDown={onInteraction} onChange={event => { onInteraction?.(); setMemoryLatency(Number(event.target.value)); moveTo(toBeat(3, 4, beats)) }} /><small>{tr('缩短未命中惩罚', 'Shorten the miss penalty')}</small></label>
          <p>{tr('这里是用于理解趋势的相对教学模型，不代表真实硬件跑分。拖动参数后，两条通道的差距会立即改变。', 'This is a relative teaching model, not a hardware benchmark. Tuning the parameters immediately changes the gap between the two lanes.')}</p>
        </section>
      </div>
    </div>
  )
}
