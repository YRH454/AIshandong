import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, List, RotateCcw, Volume2, VolumeX, X } from 'lucide-react'
import { PageFlip } from 'page-flip'
import './StudyArchiveBookReader.css'

type ReaderBook = {
  id: string
  short: string
  title: string
  subtitle: string
  tag: string
  color: string
  accent: string
}

type ReaderPage = {
  kicker: string
  title: string
  body: string
  points?: string[]
  visual?: 'definition' | 'steps' | 'formula' | 'compare' | 'checklist' | 'quote'
}

type Props = {
  book: ReaderBook
  onClose: () => void
}

const pageCopy: Record<string, ReaderPage[]> = {
  probability: [
    { kicker: '01 / 直觉', title: '先问：在什么条件下？', body: '条件概率不是把世界切成两半，而是当新信息到来时，重新整理我们对结果的判断。先锁定“已经知道的条件”，再讨论目标事件。', points: ['样本空间会缩小', '信息改变判断，不改变事实', '分母永远对应已知条件'], visual: 'definition' },
    { kicker: '02 / 结构', title: '三个位置，组成一条推理链', body: '把事件写成 A 和 B：P(A|B) 读作“在 B 已发生时 A 的概率”。竖线不是除法装饰，而是一道边界，提醒我们先站到 B 的范围里。', points: ['目标事件：A', '已知条件：B', '交集：A 与 B 同时发生'], visual: 'steps' },
    { kicker: '03 / 例子', title: '从抽签看见分母的变化', body: '袋子里有红球和蓝球。第一次抽到红球后，袋子里的剩余构成发生了变化。第二次抽到红球的概率，要在“第一次已经是红球”的新范围中重新计算。', points: ['先写已知条件', '再数条件范围里的结果', '最后比较目标与范围'], visual: 'formula' },
    { kicker: '04 / 边界', title: '相关，不等于因果', body: '看到两个事件同时出现，只能说明它们在当前数据里有关联。要说一个事件导致另一个事件，还需要时间顺序、机制与排除替代解释。', points: ['相关：一起变化', '因果：改变一个会影响另一个', '混杂变量会制造假象'], visual: 'compare' },
    { kicker: '05 / 带走', title: '一张小卡片', body: '遇到条件概率题，先圈出“已知什么”，再决定样本空间。只要分母选对，公式通常只是把这条自然语言推理写得更短。', points: ['条件先行', '范围收窄', '结果复核'], visual: 'checklist' },
  ],
  data: [
    { kicker: '01 / 直觉', title: '数据结构，是安排关系的方式', body: '同一批数据，放进不同结构里，会拥有完全不同的访问路径。结构不是外壳，它决定了我们如何找到、插入和删除信息。', points: ['数组：连续的格子', '链表：一串带指针的节点', '树：从上到下的层级'], visual: 'definition' },
    { kicker: '02 / 路径', title: '节点、边与方向', body: '把对象画成节点，把关系画成边，复杂系统就有了可追踪的地图。边可以有方向，也可以带权重，表达“从哪里到哪里”和“代价是多少”。', points: ['节点承载对象', '边承载关系', '路径承载过程'], visual: 'steps' },
    { kicker: '03 / 选择', title: '查找速度来自结构', body: '线性查找要一个个看；二分查找每次砍掉一半范围。速度差异不只是算法技巧，更是数据是否保持了可利用的顺序。', points: ['无序：逐个检查', '有序：折半定位', '索引：先找到入口'], visual: 'formula' },
    { kicker: '04 / 权衡', title: '没有“永远最好”的结构', body: '让读取更快，可能会让写入更麻烦；让内存更紧凑，可能会牺牲修改的灵活性。选择结构，就是在目标之间做取舍。', points: ['时间', '空间', '更新频率'], visual: 'compare' },
    { kicker: '05 / 带走', title: '先画关系，再写代码', body: '当数据开始变复杂，先用节点和箭头画出它的真实关系。能画清楚，通常就能选出更合适的结构。', points: ['对象是什么', '关系是什么', '最常见的操作是什么'], visual: 'checklist' },
  ],
  reading: [
    { kicker: '01 / 入口', title: '阅读不是从第一页开始', body: '面对一篇陌生材料，先看标题、摘要、图表和结论。先建立地图，再进入细节，理解会比逐行翻译更稳定。', points: ['先看问题', '再看证据', '最后看结论'], visual: 'definition' },
    { kicker: '02 / 线索', title: '把问题写在页边', body: '带着问题阅读，注意力会自动寻找相关证据。每一页只留下一个可回答的问题，材料就会从“很多字”变成一条线索。', points: ['作者想解决什么', '证据在哪里', '还有什么没有解释'], visual: 'steps' },
    { kicker: '03 / 证据', title: '观点和证据要分开', body: '一句话听起来很有道理，不代表它已经被证明。把主张、依据、限制分别标记，才能看见论证真正站在哪里。', points: ['主张：作者要你相信什么', '依据：凭什么这样说', '限制：在哪些情况下不成立'], visual: 'formula' },
    { kicker: '04 / 复述', title: '用自己的话重建结构', body: '读完一段后合上原文，用三句话复述：它在讨论什么、用了什么证据、得出了什么结论。复述比划线更能检验理解。', points: ['一句主题', '一句依据', '一句结论'], visual: 'quote' },
    { kicker: '05 / 带走', title: '一套可重复的阅读动作', body: '预览、提问、取证、复述、回看。把动作固定下来，阅读就不再依赖“今天状态好不好”。', points: ['预览', '提问', '取证', '复述', '回看'], visual: 'checklist' },
  ],
  physics: [
    { kicker: '01 / 视角', title: '先把尺度放对', body: '在深空问题里，距离、时间和速度常常同时变大。先选一把合适的尺度尺，才能把看似遥远的轨道变成可以比较的运动。', points: ['距离：从米到天文单位', '时间：从秒到周期', '速度：方向与大小同时看'], visual: 'definition' },
    { kicker: '02 / 轨道', title: '轨道是持续“掉下去”', body: '行星一直被恒星的引力拉向中心，同时又沿切线方向运动。两种趋势叠加，才形成了绕行，而不是直接坠落。', points: ['引力改变方向', '惯性保持前进', '轨道是两者的平衡'], visual: 'steps' },
    { kicker: '03 / 周期', title: '更远，通常更慢', body: '轨道半径变大，绕行一周需要的路程也变长。周期不只是日历上的数字，它记录了一个系统的空间尺度。', points: ['半径变大', '路程变长', '周期随之增加'], visual: 'formula' },
    { kicker: '04 / 观测', title: '我们看到的总是过去', body: '光需要时间抵达观测者，所以望远镜看到的星体，是它曾经发出的样子。越远的目标，时间延迟越明显。', points: ['光速有限', '距离就是时间差', '观测也是回望历史'], visual: 'compare' },
    { kicker: '05 / 带走', title: '把宇宙问题拆成三问', body: '它离我们多远？它如何运动？我们看到的是哪个时刻？用这三问，就能把很多宏大的天文现象放回可理解的框架。', points: ['尺度', '运动', '时间'], visual: 'checklist' },
  ],
  history: [
    { kicker: '01 / 入口', title: '历史不是一串孤立的年份', body: '事件会留下制度，制度会塑造选择，选择又会改变下一段历史。把人物、事件和观念放进关系里，时间才开始有方向。', points: ['事件发生了什么', '谁拥有选择权', '什么观念被留下'], visual: 'definition' },
    { kicker: '02 / 脉络', title: '先找转折，再填细节', body: '面对一长段年代，先找出资源、技术、权力或思想发生变化的节点。转折点像书脊，细节会自然归位。', points: ['变化前', '触发点', '变化后'], visual: 'steps' },
    { kicker: '03 / 视角', title: '同一事件，可以有多种叙述', body: '不同群体站在不同位置，会看到不同的代价与机会。比较叙述，不是为了找一个“唯一声音”，而是为了看见被遮住的部分。', points: ['谁在讲述', '谁被省略', '谁承担后果'], visual: 'compare' },
    { kicker: '04 / 证据', title: '材料有重量，也有缺口', body: '档案、遗物和口述各自擅长说明不同问题。可靠的历史判断，不只引用材料，也会明确材料没有告诉我们的东西。', points: ['材料来源', '形成时间', '可能的偏差'], visual: 'formula' },
    { kicker: '05 / 带走', title: '用一条时间线复盘', body: '把三个节点写下来：之前的条件、关键的转折、之后留下的影响。历史的意义，往往藏在“后来发生了什么”。', points: ['条件', '转折', '余波'], visual: 'checklist' },
  ],
  algorithm: [
    { kicker: '01 / 入口', title: '算法是一条可重复的路线', body: '它不是神秘的技巧，而是把一个问题拆成清晰步骤：输入什么、每一步做什么、最后得到什么。别人可以照着走到同一个结果，路线才算可靠。', points: ['输入', '规则', '输出'], visual: 'definition' },
    { kicker: '02 / 拆解', title: '先把大问题切成小动作', body: '排序、查找、推荐看起来不同，背后都可以拆成很小的判断。每一步只做一件事，下一步才知道该往哪里走。', points: ['当前知道什么', '下一步要判断什么', '何时停止'], visual: 'steps' },
    { kicker: '03 / 规模', title: '快慢要放在规模里比较', body: '一个方法在十个数据上很顺手，不代表面对十万条记录也合适。复杂度关注的是数据变大后，工作量怎样增长。', points: ['一次一次增加', '每次减半', '规模决定差距'], visual: 'formula' },
    { kicker: '04 / 选择', title: '每一种捷径都有前提', body: '贪心策略每一步挑看起来最好的选择；动态规划会记录已经算过的结果。没有通用赢家，关键是识别问题是否满足它的前提。', points: ['局部选择', '历史记录', '问题结构'], visual: 'compare' },
    { kicker: '05 / 带走', title: '先写样例，再写路线', body: '拿两个极小样例走一遍：正常情况和边界情况。只要每一步都能解释，代码实现通常不会离正确答案太远。', points: ['一个普通样例', '一个边界样例', '逐步追踪'], visual: 'checklist' },
  ],
  calculus: [
    { kicker: '01 / 直觉', title: '微积分在描述连续的变化', body: '当一件事不是一下子跳到终点，而是在每个瞬间都略有不同，微积分就提供了一种更精细的语言：看变化，也看积累。', points: ['连续变化', '局部瞬间', '整体累积'], visual: 'definition' },
    { kicker: '02 / 微分', title: '导数问的是：此刻变得多快', body: '导数不只是公式里的符号，它是在一个很小的范围里观察趋势。斜率越大，变化越快；斜率为零，可能正站在转折处。', points: ['当前斜率', '变化方向', '变化速度'], visual: 'steps' },
    { kicker: '03 / 积分', title: '积分把许多微小部分累起来', body: '把速度在每一小段时间里的贡献累积，就得到路程；把每一条很窄的面积相加，就得到整体面积。积分关心“总共留下了多少”。', points: ['切成小份', '逐份累加', '回到整体'], visual: 'formula' },
    { kicker: '04 / 对照', title: '变化和积累是一对镜子', body: '导数从整体曲线里读局部变化，积分从局部贡献里拼回整体结果。一个从远处走近，一个从细节走远。', points: ['从整体到局部', '从局部到整体', '相互校验'], visual: 'compare' },
    { kicker: '05 / 带走', title: '先画图，再碰符号', body: '看到题目，先问曲线是上升还是下降、哪里变快、哪里在累积。图像能让很多抽象符号先拥有直觉。', points: ['画坐标', '标趋势', '再计算'], visual: 'checklist' },
  ],
  coding: [
    { kicker: '01 / 入口', title: '程序是边界清楚的协作', body: '一段代码要先说清楚它接收什么、保存什么、交付什么。把输入、状态和输出分开，复杂问题才不会在同一个地方打结。', points: ['输入', '状态', '输出'], visual: 'definition' },
    { kicker: '02 / 结构', title: '让每个模块只负责一件事', body: '界面负责呈现，函数负责计算，数据层负责保存。职责清楚时，改动会停在该停的位置，不会牵动整间房子。', points: ['单一职责', '清楚接口', '可替换模块'], visual: 'steps' },
    { kicker: '03 / 调试', title: '错误是线索，不是判决', body: '当结果不对，不要立刻盯着最后一行。先复现问题，再观察输入和中间状态，缩小范围后再做一次小改动。', points: ['稳定复现', '查看中间值', '小步验证'], visual: 'formula' },
    { kicker: '04 / 取舍', title: '能读懂，才容易持续修改', body: '短代码不一定更好，聪明技巧也不一定更适合团队。清晰的命名、有限的层级和可测试的函数，常常比炫技更有价值。', points: ['可读性', '可测试性', '维护成本'], visual: 'compare' },
    { kicker: '05 / 带走', title: '每次只解决一个小问题', body: '把需求写成一句可以验证的话，然后先让最小版本跑起来。稳定之后再加功能，会比一开始就堆满细节更快。', points: ['定义完成', '做最小版本', '运行验证'], visual: 'checklist' },
  ],
  biology: [
    { kicker: '01 / 入口', title: '生命是层层协作的系统', body: '细胞组成组织，组织形成器官，个体又处在生态网络里。看生命问题时，先确认自己正在观察哪一层。', points: ['细胞', '个体', '生态系统'], visual: 'definition' },
    { kicker: '02 / 流动', title: '物质、能量和信息不断流动', body: '营养进入细胞，能量支持活动，遗传信息指导合成。生命并不是静止结构，而是一套持续交换、持续调整的过程。', points: ['物质进出', '能量转换', '信息传递'], visual: 'steps' },
    { kicker: '03 / 平衡', title: '稳定来自持续的反馈', body: '体温、血糖和种群数量都不会永远不变。系统通过感受偏差、发出调节、再观察结果，维持一个可生存的范围。', points: ['发现偏差', '启动调节', '回到范围'], visual: 'formula' },
    { kicker: '04 / 关系', title: '一个变化会沿网络传开', body: '植物、动物、微生物彼此依赖。减少一个环节，影响不一定只停在它身上，而会通过食物、环境和竞争扩散开。', points: ['相互依赖', '连锁影响', '系统视角'], visual: 'compare' },
    { kicker: '05 / 带走', title: '先问：它和谁相连', body: '面对生命现象，除了记名称，还可以追问来源、去向和反馈。顺着连接看，比孤立地背一个名词更容易理解。', points: ['所在层级', '输入与输出', '反馈关系'], visual: 'checklist' },
  ],
  economics: [
    { kicker: '01 / 入口', title: '经济学从有限开始', body: '时间、金钱和注意力都有限，而想做的事总是更多。经济学不是教人只看钱，而是帮助我们看清取舍如何发生。', points: ['资源有限', '目标很多', '必须选择'], visual: 'definition' },
    { kicker: '02 / 代价', title: '选择的代价常常藏在放弃里', body: '选择一件事，意味着把时间和资源从别处移开。机会成本不是账单上的数字，而是那些本来可以发生、却没有发生的选项。', points: ['得到什么', '放弃什么', '谁承担代价'], visual: 'steps' },
    { kicker: '03 / 激励', title: '规则会改变人们的行动', body: '奖励、惩罚、信息和限制都会改变选择。当环境变了，行为为什么随之变化，往往比“大家应该怎样做”更值得观察。', points: ['看到的奖励', '承担的风险', '可获得的信息'], visual: 'formula' },
    { kicker: '04 / 交换', title: '交换不是简单的一来一回', body: '双方愿意交换，通常因为他们对同一件物品的用途、时间或风险有不同判断。理解差异，才能理解交易为什么发生。', points: ['不同需求', '不同信息', '不同时间偏好'], visual: 'compare' },
    { kicker: '05 / 带走', title: '把日常决定写成一张账', body: '下次面对选择时，写下资源、替代方案和真正想要的结果。把看不见的代价说出来，判断会更平静。', points: ['资源', '替代方案', '长期结果'], visual: 'checklist' },
  ],
  writing: [
    { kicker: '01 / 入口', title: '写作先要有一句站得住的话', body: '开头不必急着铺很多背景。先写清楚自己想让读者相信什么，这句话会成为后续材料和段落的方向标。', points: ['中心观点', '读者对象', '写作目的'], visual: 'definition' },
    { kicker: '02 / 结构', title: '每一段只推进一个小台阶', body: '好段落不是一堆句子，而是一段小型论证：提出一个点，给出解释或证据，再把它带回整体观点。', points: ['段落主张', '支持材料', '回扣主题'], visual: 'steps' },
    { kicker: '03 / 证据', title: '材料要回答“所以呢”', body: '引用案例、数据或经历之后，别把解释留给读者。说明它如何支持你的观点，材料才会真正成为论证的一部分。', points: ['材料是什么', '说明了什么', '与观点怎样连接'], visual: 'formula' },
    { kicker: '04 / 修改', title: '修改是在清理读者的岔路', body: '读一遍时，找出每一个可能让人停顿的地方：指代不清、顺序跳跃、句子太长。删掉不服务主线的内容，就是给读者让路。', points: ['删重复', '换顺序', '补连接'], visual: 'compare' },
    { kicker: '05 / 带走', title: '先写出来，再把它写清楚', body: '初稿负责把想法放到桌面上，修改负责让它们排成队。不要试图一次完成两件事，节奏会更轻松。', points: ['先成形', '再整理', '最后朗读'], visual: 'checklist' },
  ],
  psychology: [
    { kicker: '01 / 入口', title: '注意力是一扇有限的门', body: '我们并不是同时处理所有信息，而是在不断挑选什么值得进入。环境越嘈杂，越需要主动给重要内容留出入口。', points: ['信息很多', '入口有限', '需要选择'], visual: 'definition' },
    { kicker: '02 / 负荷', title: '工作记忆更像一张小桌子', body: '桌面太满时，新东西就没有位置。把任务分段、外化成笔记、一次只处理一件事，能让思考从拥挤里恢复。', points: ['分成小块', '写到外部', '减少干扰'], visual: 'steps' },
    { kicker: '03 / 习惯', title: '提示会悄悄拉动行为', body: '固定的地点、时间和起始动作会成为线索。把想做的事放在顺手的位置，把干扰藏远一点，行动会少一点依赖意志力。', points: ['环境提示', '微小开始', '即时反馈'], visual: 'formula' },
    { kicker: '04 / 记忆', title: '回忆比重读更能留下痕迹', body: '重新看一遍会带来熟悉感，但尝试从脑中取出内容，才会暴露真正的空白。小测、复述和间隔回顾都在训练这条路径。', points: ['主动提取', '发现空白', '间隔复习'], visual: 'compare' },
    { kicker: '05 / 带走', title: '为专注安排一小段仪式', body: '准备一个明确的开始动作：放下手机、打开资料、写下一个问题。只要起点足够小，大脑更容易愿意继续走。', points: ['固定起点', '短时专注', '及时休息'], visual: 'checklist' },
  ],
}

function buildPages(book: ReaderBook): Array<ReaderPage & { cover?: boolean }> {
  const chapterPages = pageCopy[book.id] || pageCopy.probability
  return [
    { kicker: 'STUDY ARCHIVE / 05', title: book.title, body: book.subtitle, points: [book.tag, '点击页角或拖动翻页', '把一个概念读成一条路径'], visual: 'quote', cover: true },
    ...chapterPages,
    { kicker: 'END OF THIS NOTE', title: '合上书，也留下一个问题', body: '今天的理解从这里开始。回到书架，换一本书，或者把刚才的概念带回自己的学习资料里。', points: ['返回书房', '继续探索', '下次从问题开始'], visual: 'quote', cover: true },
  ]
}

function PageVisual({ visual, accent, points }: { visual?: ReaderPage['visual']; accent: string; points: string[] }) {
  if (visual === 'formula') return <div className="study-reader-visual study-reader-formula" style={{ '--reader-accent': accent } as CSSProperties}><span>P(理解)</span><b>＝</b><span>问题 × 证据</span><small>把复杂内容拆成可验证的关系</small></div>
  if (visual === 'compare') return <div className="study-reader-visual study-reader-compare" style={{ '--reader-accent': accent } as CSSProperties}><div><b>看见</b><span>{points[0] || '事实'}</span></div><i>↔</i><div><b>追问</b><span>{points[1] || '原因'}</span></div></div>
  if (visual === 'quote') return <div className="study-reader-visual study-reader-quote" style={{ '--reader-accent': accent } as CSSProperties}><span>“</span><p>{points[0] || '每一次理解，都是一次重新排列。'}</p><span>”</span></div>
  if (visual === 'checklist') return <div className="study-reader-visual study-reader-checklist" style={{ '--reader-accent': accent } as CSSProperties}>{points.slice(0, 5).map((point, index) => <span key={point}><b>{String(index + 1).padStart(2, '0')}</b>{point}</span>)}</div>
  return <div className={`study-reader-visual study-reader-${visual === 'steps' ? 'steps' : 'definition'}`} style={{ '--reader-accent': accent } as CSSProperties}>{points.slice(0, 3).map((point, index) => <span key={point}><b>{index + 1}</b>{point}</span>)}</div>
}

export default function StudyArchiveBookReader({ book, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const pageFlipRef = useRef<PageFlip | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const soundEnabledRef = useRef(true)
  const pages = useMemo(() => buildPages(book), [book])
  const [activePage, setActivePage] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [readerError, setReaderError] = useState(false)

  useEffect(() => {
    soundEnabledRef.current = soundEnabled
  }, [soundEnabled])

  useEffect(() => {
    let cancelled = false
    let pageFlip: PageFlip | null = null
    let timer: number | null = null

    // PageFlip mutates the host element. Delaying setup by one task keeps it
    // safe under React StrictMode's mount → cleanup → remount probe.
    const init = () => {
      if (cancelled) return
      const root = rootRef.current
      if (!root) return
      const pageNodes = Array.from(root.querySelectorAll<HTMLElement>('.study-reader-page'))
      if (pageNodes.length < 2) {
        timer = window.setTimeout(init, 24)
        return
      }

      try {
        pageFlip = new PageFlip(root, {
          width: 430,
          height: 575,
          size: 'stretch',
          minWidth: 285,
          maxWidth: 510,
          minHeight: 390,
          maxHeight: 690,
          showCover: true,
          usePortrait: true,
          autoSize: false,
          drawShadow: true,
          maxShadowOpacity: .46,
          flippingTime: 860,
          mobileScrollSupport: true,
          clickEventForward: true,
          showPageCorners: true,
        })
        const onFlip = (event: { data: number | string | { page: number } }) => {
          const page = typeof event.data === 'number' ? event.data : typeof event.data === 'object' && event.data ? event.data.page : 0
          setActivePage(page)
          const audio = audioRef.current
          if (soundEnabledRef.current && audio) {
            audio.currentTime = 0
            void audio.play().catch(() => undefined)
          }
        }
        pageFlip.on('flip', onFlip)
        pageFlip.loadFromHTML(pageNodes)
        pageFlipRef.current = pageFlip
        setReaderError(false)
      } catch {
        setReaderError(true)
        pageFlip?.off('flip')
        try { pageFlip?.destroy() } catch { /* keep the reader fallback visible */ }
        pageFlip = null
      }
    }

    timer = window.setTimeout(init, 40)
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
      pageFlip?.off('flip')
      try { pageFlip?.destroy() } catch { /* the host may already be gone */ }
      if (pageFlipRef.current === pageFlip) pageFlipRef.current = null
    }
  }, [pages])

  useEffect(() => {
    const audio = new Audio('/learning-house-reference/sounds/cfl_turningpages-belem-breeze-487596.ogg')
    audio.preload = 'auto'
    audio.volume = .14
    audioRef.current = audio
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') pageFlipRef.current?.flipNext('top')
      if (event.key === 'ArrowLeft') pageFlipRef.current?.flipPrev('top')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [onClose])

  const current = pages[activePage] || pages[0]
  const progress = Math.min(100, Math.round(((activePage + 1) / pages.length) * 100))

  return <div className="study-reader-layer" role="dialog" aria-modal="true" aria-label={`阅读：${book.title}`}>
    <header className="study-reader-topbar">
      <button type="button" className="study-reader-back" onClick={onClose}><ArrowLeft size={17} /><span>返回学习档案馆</span></button>
      <div className="study-reader-heading"><span><BookOpen size={14} />正在阅读</span><b>{book.title}</b></div>
      <div className="study-reader-tools">
        <button type="button" onClick={() => setSoundEnabled(value => !value)} aria-label={soundEnabled ? '关闭翻页音效' : '开启翻页音效'} title={soundEnabled ? '关闭翻页音效' : '开启翻页音效'}>{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
        <button type="button" onClick={onClose} aria-label="关闭阅读器" title="关闭阅读器"><X size={18} /></button>
      </div>
    </header>

    <main className="study-reader-main">
      <aside className="study-reader-index" aria-label="章节导航">
        <div className="study-reader-index-title"><List size={15} /><span>章节</span><b>{String(activePage + 1).padStart(2, '0')} / {String(pages.length).padStart(2, '0')}</b></div>
        <nav>{pages.map((page, index) => <button type="button" key={`${page.title}-${index}`} className={activePage === index ? 'active' : ''} onClick={() => pageFlipRef.current?.turnToPage(index)}><i style={{ background: index === 0 || index === pages.length - 1 ? book.color : book.accent }} /><span><small>{page.kicker}</small><b>{page.title}</b></span></button>)}</nav>
      </aside>

      <section className="study-reader-stage">
        <div className="study-reader-stage-meta"><span>{book.tag}</span><b>{progress}% 阅读进度</b></div>
        <div className="study-reader-book-shadow" style={{ background: book.accent }} />
        <div className="study-reader-book" ref={rootRef} style={{ '--reader-accent': book.accent, '--reader-cover': book.color } as CSSProperties}>
          {pages.map((page, index) => <article className={`study-reader-page${page.cover ? ' is-cover' : ''}`} data-density={page.cover ? 'hard' : 'soft'} key={`${page.title}-${index}`}>
            <div className="study-reader-page-inner">
              <div className="study-reader-page-kicker">{page.kicker}</div>
              <div className="study-reader-page-number">{String(index + 1).padStart(2, '0')}</div>
              <h1>{page.title}</h1>
              <p>{page.body}</p>
              {page.points && <PageVisual visual={page.visual} accent={book.accent} points={page.points} />}
              <footer><span>{book.short}</span><i>{index === 0 ? 'OPEN' : index === pages.length - 1 ? 'CLOSE' : 'RHYME STUDY ARCHIVE'}</i></footer>
            </div>
          </article>)}
        </div>
        {readerError && <div className="study-reader-error" role="status">
          <BookOpen size={20} />
          <b>翻页交互暂时不可用</b>
          <span>仍可通过左侧章节导航阅读本册内容。</span>
        </div>}
        <p className="study-reader-gesture">拖动书页，或点击左右页角翻页</p>
      </section>

      <aside className="study-reader-current" aria-live="polite">
        <span>当前页</span>
        <b>{current.kicker}</b>
        <h2>{current.title}</h2>
        <p>{current.body}</p>
        <div className="study-reader-progress"><i style={{ transform: `scaleX(${progress / 100})`, background: book.accent }} /></div>
        <small>左右方向键也可以翻页</small>
      </aside>
    </main>

    <footer className="study-reader-bottom">
      <button type="button" onClick={() => pageFlipRef.current?.flipPrev('bottom')} disabled={activePage <= 0}><ChevronLeft size={17} />上一页</button>
      <span><b>{String(activePage + 1).padStart(2, '0')}</b><i>/</i>{String(pages.length).padStart(2, '0')}</span>
      <button type="button" onClick={() => pageFlipRef.current?.flipNext('bottom')} disabled={activePage >= pages.length - 1}>下一页<ChevronRight size={17} /></button>
      <button type="button" className="study-reader-reset" onClick={() => pageFlipRef.current?.turnToPage(0)} title="回到封面" aria-label="回到封面"><RotateCcw size={15} /></button>
    </footer>
  </div>
}
