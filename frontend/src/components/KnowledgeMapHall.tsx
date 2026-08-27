import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { TrackballControls } from '@react-three/drei'
import R3fForceGraph, { type GraphMethods } from 'r3f-forcegraph'
import { ArrowLeft, X } from 'lucide-react'
import largeGraphTopology from '../data/r3f-large-graph-topology.json'
import './KnowledgeMapHall.css'

export type KnowledgeHallNode = {
  id: string
  label: string
  role: 'core' | 'branch' | 'detail'
  kind?: 'core' | 'foundation' | 'principle' | 'process' | 'example' | 'pitfall'
  group?: string
  detail: string
  example?: string
  mistake?: string
}

export type KnowledgeHallMap = {
  id: string
  title: string
  topic: string
  summary: string
  mapType?: string
  nodes: KnowledgeHallNode[]
  edges: Array<{ from: string; to: string; label?: string }>
  learningPath?: string[]
}

type Props = {
  // Kept for the existing app entry point. This room is intentionally no longer
  // bound to the current learning topic.
  maps: KnowledgeHallMap[]
  onExit: () => void
  onOpenMap?: (id: string) => void
}

type StarNode = KnowledgeHallNode & {
  group: string
  constellationId: string
  constellationTitle: string
  val: number
}
type StarLink = { source: string; target: string; particles?: number }
type StarGroup = { id: string; title: string; overview: string; items: Array<[string, string]> }
type SemanticLens = {
  label: string
  kind: NonNullable<KnowledgeHallNode['kind']>
  describe: (topic: string, seed: string, group: StarGroup) => string
}
type SemanticLayer = {
  id: string
  label: string
  detailPrefix: string
}

const STAR_GROUPS: StarGroup[] = [
  {
    id: 'learning', title: '学习与思维', overview: '理解世界、建立判断和持续成长的知识星群。', items: [
      ['刻意练习', '把目标拆成可反馈的小动作，反复修正薄弱环节。'], ['费曼表达', '能用简单语言讲清楚，才说明真正理解。'], ['间隔重复', '在将忘未忘时复习，比集中刷题更稳固。'], ['问题建模', '先定义问题和约束，再选择解决方法。'], ['信息筛选', '区分事实、观点、证据和情绪化表达。'], ['深度工作', '在无干扰时段完成高认知负荷任务。'], ['复盘习惯', '记录结果、原因和下一次可以改变的动作。'], ['阅读方法', '带着问题阅读，标注结构而不是只划重点。'],
    ],
  },
  {
    id: 'body', title: '身体与运动', overview: '身体能力、恢复和长期健康构成的星群。', items: [
      ['有氧耐力', '稳定心率区间训练能提升持续活动能力。'], ['力量训练', '渐进超负荷让肌肉、骨骼和动作控制逐步适应。'], ['运动热身', '先提高体温和关节活动度，再进入主训练。'], ['睡眠周期', '规律入睡时间和完整睡眠有助于恢复与记忆巩固。'], ['基础营养', '蛋白质、碳水、脂肪和微量元素共同支持活动。'], ['柔韧恢复', '恢复日、轻活动和拉伸能帮助管理训练疲劳。'], ['动作技术', '动作质量优先于重量与次数，避免代偿受伤。'], ['心肺恢复', '运动后逐步降强度，比骤停更有利于身体恢复。'],
    ],
  },
  {
    id: 'life', title: '生活与秩序', overview: '让日常稳定运转的微小系统与生活常识。', items: [
      ['时间分块', '把高优先级任务放进具体时间块，减少模糊待办。'], ['环境整理', '降低找东西和切换任务的摩擦，注意力会更集中。'], ['风险预案', '提前准备备份、联系人和关键资料，降低突发成本。'], ['饮食节律', '稳定进餐节奏有助于能量管理与身体信号识别。'], ['数字清洁', '定期整理文件、通知和订阅，让信息环境保持可控。'], ['家务系统', '用清单和固定频率处理重复事务，避免集中堆积。'], ['个人边界', '清楚表达可接受与不可接受的范围，保护时间与精力。'], ['仪式感', '可重复的小仪式能帮助大脑切换到休息或专注状态。'],
    ],
  },
  {
    id: 'relationship', title: '关系与表达', overview: '沟通、协作与理解他人的社会能力星群。', items: [
      ['倾听反馈', '复述对方重点并确认理解，避免把猜测当事实。'], ['非暴力沟通', '描述观察、感受、需要与请求，减少指责性表达。'], ['冲突协商', '先找共同目标，再讨论分歧与可交换条件。'], ['合作分工', '明确责任边界、交付物和检查节点，协作才可执行。'], ['情绪识别', '为情绪命名能帮助区分感受、需求和行为。'], ['说服结构', '先建立共同前提，再给证据和具体行动建议。'], ['感谢表达', '具体说出对方做了什么，比笼统赞美更能建立连接。'], ['关系维护', '低频但稳定的联系，常比一次性热情更可持续。'],
    ],
  },
  {
    id: 'money', title: '财富与经济', overview: '金钱、风险和资源配置相关的基本知识星群。', items: [
      ['现金流', '收入减去支出后的可用资金决定短期安全感。'], ['预算意识', '为固定、弹性和储蓄目标分别留出空间。'], ['复利思维', '长期稳定积累的增长，往往胜过短期频繁追逐。'], ['风险分散', '不要把所有资源压在单一资产、行业或判断上。'], ['机会成本', '选择一件事，也意味着放弃另一件事的收益。'], ['消费决策', '区分即时欲望、真实需求和长期价值。'], ['信用记录', '按时履约和理性负债会影响未来融资成本。'], ['价格认知', '价格不等于价值，要考虑质量、时间和替代选择。'],
    ],
  },
  {
    id: 'technology', title: '技术与探索', overview: '理解数字世界与创造工具的技术星群。', items: [
      ['编程思维', '把复杂任务拆成输入、规则、过程和输出。'], ['数据素养', '先问数据从哪里来、是否完整，再解释结论。'], ['网络安全', '使用强密码、双重验证并警惕陌生链接。'], ['人工智能', '模型擅长模式生成，但结果仍需要验证和判断。'], ['开源协作', '阅读许可、记录来源、贡献修改是协作的基础。'], ['产品设计', '先理解真实用户场景，再决定功能与界面。'], ['系统思维', '关注组件之间的反馈、延迟和意外后果。'], ['数字隐私', '控制授权范围，理解个人数据如何被收集和使用。'],
    ],
  },
  {
    id: 'art', title: '艺术与审美', overview: '观察、感受和创造构成的审美星群。', items: [
      ['构图平衡', '用主次、留白和视觉重量组织画面注意力。'], ['色彩关系', '冷暖、明暗和饱和度共同决定画面的情绪。'], ['音乐节奏', '节拍、重音与停顿塑造身体能感受到的结构。'], ['叙事视角', '选择谁来讲述，会改变观众理解同一事件的方式。'], ['设计层级', '清晰的字号、对比和间距告诉人们先看什么。'], ['建筑空间', '光线、尺度、材料和动线共同塑造空间体验。'], ['风格来源', '理解文化脉络，才能让借鉴超越简单复制。'], ['审美训练', '持续观察并说出喜欢或不喜欢的具体原因。'],
    ],
  },
  {
    id: 'world', title: '旅行与世界', overview: '地理、文化和移动经验构成的世界星群。', items: [
      ['地图意识', '用距离、方向和地形理解一个地方的关系。'], ['旅行规划', '把交通、住宿、预算和安全预案放在同一时间线上。'], ['文化礼仪', '尊重当地习惯，先观察再行动。'], ['语言入口', '学会问候、道谢、求助和确认信息能降低陌生感。'], ['城市漫游', '步行和公共交通能更好感受街区尺度与生活节奏。'], ['世界遗产', '遗产不仅是景点，也承载人类共同的历史与选择。'], ['地理气候', '气候、海拔和季节会改变衣物、路线和风险。'], ['摄影观察', '先感受现场，再选择构图和记录时机。'],
    ],
  },
  {
    id: 'nature', title: '自然与科学', overview: '从宇宙到生态系统的观察与求证星群。', items: [
      ['科学方法', '提出假设、设计检验、接受证据修正结论。'], ['生态平衡', '物种、能量和环境条件通过关系网彼此影响。'], ['天气系统', '气压、温度和水汽变化共同塑造日常天气。'], ['星空观测', '星体位置随时间变化，观测需要耐心和参照。'], ['生物多样性', '多样性提升生态系统面对变化时的韧性。'], ['物理直觉', '力、能量、运动和约束帮助解释很多日常现象。'], ['化学材料', '材料性质源于结构与成分，使用方式也会改变风险。'], ['环境行动', '减少浪费、延长使用和正确回收都是可执行的选择。'],
    ],
  },
  {
    id: 'mind', title: '心灵与成长', overview: '自我理解、韧性和内在秩序构成的星群。', items: [
      ['自我觉察', '分辨自己正在想什么、感受什么和真正需要什么。'], ['成长型思维', '把能力视为可练习的过程，而不是固定标签。'], ['压力调节', '识别压力来源，再用休息、支持和行动分担负荷。'], ['注意力管理', '把注意力放回当下可控制的动作，而不是无限担忧。'], ['价值排序', '重要选择前先确认自己最在意的原则。'], ['失败复原', '把失败当作反馈，保留经验而不是只保留否定。'], ['好奇心', '允许不知道，并用问题打开新的理解路径。'], ['独处能力', '独处不是隔离，而是和自己建立稳定的关系。'],
    ],
  },
  {
    id: 'culture', title: '文化与历史', overview: '时间、记忆与群体经验交织的文化星群。', items: [
      ['历史证据', '区分一手材料、转述和后世解释。'], ['公共叙事', '同一事件会因立场、材料和视角出现不同讲法。'], ['宗教建筑', '建筑形制、光线和仪式共同承载信仰与审美。'], ['地方文化', '方言、食物、节日和日常习惯保存着地方记忆。'], ['博物馆阅读', '先看展品来源与年代，再理解它讲述的关系。'], ['符号意义', '图像、颜色和物件会在具体文化中获得特殊含义。'], ['民俗观察', '从日常实践理解传统，比只看标签更接近真实生活。'], ['跨文化理解', '避免把单个经历推广成对整个群体的判断。'],
    ],
  },
  {
    id: 'creation', title: '创造与行动', overview: '把想法落地、持续推进与完成作品的行动星群。', items: [
      ['灵感捕捉', '及时记录模糊想法，给它们留下再次生长的入口。'], ['原型验证', '先做可感受的最小版本，再根据反馈扩展。'], ['项目拆解', '把结果拆成里程碑和下一步可执行动作。'], ['节奏管理', '在冲刺、恢复和复盘之间找到可以持续的速度。'], ['作品归档', '保留过程稿、版本和来源，方便回顾与展示。'], ['迭代意识', '第一版的使命是暴露问题，而不是一次完美。'], ['公开表达', '把作品讲清楚，能获得理解、反馈和合作机会。'], ['完成能力', '为项目设置结束标准，避免永远停在准备阶段。'],
    ],
  },
]

// The 1,238-node / 2,602-link topology below is the upstream large-graph
// example, kept intact so its organic "galaxy" structure is not flattened
// into a tree. Each source node is replaced by a distinct, inspectable RHYME
// knowledge atom; no empty decorative stars are introduced.
const SEMANTIC_LENSES: SemanticLens[] = [
  { label: '核心概念', kind: 'foundation', describe: (topic, seed) => `「${topic}」的基本认识：${seed}` },
  { label: '关键问题', kind: 'principle', describe: topic => `理解${topic}时，可以先追问：它解决的究竟是什么问题？` },
  { label: '观察线索', kind: 'example', describe: topic => `在真实情境中，留意与${topic}有关的信号、变化与反馈。` },
  { label: '运行原理', kind: 'principle', describe: (topic, _seed, group) => `${topic}会和「${group.title}」中的其他因素相互影响，而不是单独发生。` },
  { label: '实践方法', kind: 'process', describe: topic => `把${topic}拆成一件今天能开始的小行动，再根据结果调整。` },
  { label: '微型练习', kind: 'process', describe: topic => `为${topic}设计一次 10 分钟的练习：记录行动、感受与一个可改进之处。` },
  { label: '工具资源', kind: 'example', describe: topic => `尝试为${topic}建立一个可靠的工具、清单、记录方式或参考来源。` },
  { label: '常见误区', kind: 'pitfall', describe: topic => `不要把${topic}简化成口号；脱离目标、条件和反馈的做法通常难以持续。` },
  { label: '作用边界', kind: 'pitfall', describe: topic => `${topic}并非在所有场景都同样适用，资源、阶段与个人状态会改变它的作用。` },
  { label: '关联视角', kind: 'principle', describe: (topic, _seed, group) => `把${topic}放回「${group.title}」这片星群，能看到它和其他选择之间的关系。` },
  { label: '进展标记', kind: 'example', describe: topic => `判断${topic}是否在成长，不只看结果，也看是否形成了可重复的过程。` },
  { label: '证据意识', kind: 'foundation', describe: topic => `面对${topic}的说法时，先区分个人经验、可验证证据与尚待确认的推测。` },
  { label: '反思提示', kind: 'process', describe: topic => `回顾${topic}时，写下：什么有效、什么无效、下一次愿意尝试什么？` },
]

// The two layers are not decorative duplicates: one keeps the concepts,
// evidence and relationships in view, while the other turns the same themes
// into practical observation and action. Both retain the upstream topology.
const SEMANTIC_LAYERS: SemanticLayer[] = [
  { id: 'insight', label: '理解层', detailPrefix: '从理解角度看，' },
  { id: 'practice', label: '行动层', detailPrefix: '落到真实行动时，' },
]

type UpstreamNodeRef = string | number | { id?: string | number }

function sourceId(value: UpstreamNodeRef) {
  return typeof value === 'object' ? String(value.id ?? '') : String(value)
}

// r3f-forcegraph resolves link endpoint IDs to mutable node objects at runtime.
// Take a clean ID-only snapshot here, so a hot reload can never reuse those
// mutated endpoint objects when the star field is rebuilt.
const upstreamTopology = {
  nodes: (largeGraphTopology.nodes as Array<{ id: string | number }>).map(node => ({ id: String(node.id) })),
  links: (largeGraphTopology.links as Array<{ source: UpstreamNodeRef; target: UpstreamNodeRef }>).map(link => ({
    source: sourceId(link.source),
    target: sourceId(link.target),
  })),
}

function createStarMap() {
  const knowledgeAtoms = STAR_GROUPS.flatMap(group => group.items.flatMap(([topic, seed], topicIndex) => (
    SEMANTIC_LENSES.map((lens, lensIndex) => ({
      label: `${topic} · ${lens.label}`,
      detail: lens.describe(topic, seed, group),
      kind: lens.kind,
      role: lensIndex === 0 ? 'branch' as const : 'detail' as const,
      group: `${group.id}-${topicIndex + 1}`,
      constellationId: group.id,
      constellationTitle: group.title,
    }))
  )))

  const degree = new Map<string, number>()
  upstreamTopology.links.forEach(({ source, target }) => {
    degree.set(source, (degree.get(source) || 0) + 1)
    degree.set(target, (degree.get(target) || 0) + 1)
  })

  const nodes: StarNode[] = []
  const links: StarLink[] = []

  SEMANTIC_LAYERS.forEach((layer, layerIndex) => {
    upstreamTopology.nodes.forEach((sourceNode, index) => {
      const atom = knowledgeAtoms[index]
      nodes.push({
        id: `${layer.id}:${sourceNode.id}`,
        ...atom,
        label: `${layer.label} · ${atom.label}`,
        detail: `${layer.detailPrefix}${atom.detail}`,
        val: (.76 + Math.min(3.15, Math.sqrt(degree.get(sourceNode.id) || 1) * .38)) * (layerIndex === 0 ? 1 : .9),
      })
    })
    upstreamTopology.links.forEach(({ source, target }) => {
      links.push({
        source: `${layer.id}:${source}`,
        target: `${layer.id}:${target}`,
        particles: layerIndex === 0 ? 1 : 0,
      })
    })
  })

  // Sparse bridges connect the two real knowledge layers without collapsing
  // the field into a single ball of lines.
  upstreamTopology.nodes.forEach((sourceNode, index) => {
    if (index % 43 === 0) {
      links.push({ source: `insight:${sourceNode.id}`, target: `practice:${sourceNode.id}`, particles: 0 })
    }
  })

  return { nodes, links }
}

const STAR_MAP = createStarMap()

function GraphViz({ onHover }: { onHover: (node: StarNode | null) => void }) {
  const graphRef = useRef<GraphMethods | undefined>(undefined)
  const graphData = useMemo(() => STAR_MAP, [])
  useFrame(() => graphRef.current?.tickFrame())

  // Direct adaptation of the r3f-forcegraph large-graph scene: the star-field
  // interaction and visual language stay upstream; only the data is ours.
  return <R3fForceGraph
    ref={graphRef}
    graphData={graphData}
    nodeAutoColorBy="group"
    nodeRelSize={4.8}
    nodeOpacity={.94}
    linkWidth={.76}
    linkOpacity={.6}
    linkDirectionalParticles="particles"
    linkDirectionalParticleWidth={.9}
    onNodeHover={node => {
      document.body.style.cursor = node ? 'pointer' : ''
      onHover(node ? node as StarNode : null)
    }}
    onNodeClick={node => onHover(node as StarNode)}
  />
}

function StarCanvas({ onHover }: { onHover: (node: StarNode | null) => void }) {
  return <Canvas className="knowledge-hall-canvas" flat camera={{ position: [0, 0, 1180], far: 8000 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}>
    <TrackballControls />
    <color attach="background" args={[0, 0, .01]} />
    <ambientLight color={0xcccccc} intensity={Math.PI} />
    <directionalLight intensity={.6 * Math.PI} />
    <GraphViz onHover={onHover} />
  </Canvas>
}

export default function KnowledgeMapHall({ onExit }: Props) {
  const [hovered, setHovered] = useState<StarNode | null>(null)
  const focused = hovered

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onExit() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onExit])

  return createPortal(<div className="knowledge-hall-layer" role="dialog" aria-modal="true" aria-label="万象星海">
    <section className="knowledge-hall">
      <div className="knowledge-hall-stage">
        <StarCanvas onHover={setHovered} />
        <header className="knowledge-hall-topbar">
          <button type="button" className="knowledge-hall-back" onClick={onExit}><ArrowLeft size={15} />返回学习屋</button>
          <span className="knowledge-hall-title">万象星海 · LIFE CONSTELLATIONS</span>
          <button type="button" className="knowledge-hall-close" onClick={onExit} aria-label="关闭万象星海"><X size={18} /></button>
        </header>

        <div className="knowledge-hall-hint">拖动旋转 · 滚轮缩放 · 每一颗星都有它自己的意义</div>
        <div className="knowledge-hall-count">{STAR_MAP.nodes.length} STARS · {STAR_GROUPS.length} CONSTELLATIONS</div>

        {focused && <aside className="knowledge-hall-node-peek" aria-live="polite">
          <span>掠过的星点 · {focused.constellationTitle}</span>
          <strong>{focused.label}</strong>
          <p>{focused.detail}</p>
        </aside>}
      </div>
    </section>
  </div>, document.body)
}
