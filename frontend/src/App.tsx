import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  Archive, ArrowLeft, ArrowUp, AudioLines, BookOpen, Check, ChevronRight, CirclePlay, ClipboardCheck,
  Code2, FileDown, FileQuestion, FileText, FolderOpen, History, Image, LayoutTemplate, Library, Map as MapIcon,
  Menu, Mic, NotebookTabs, Paperclip, PenLine, Presentation, RotateCcw, Save, Search, Settings2,
  Sparkles, Star, Tags, Trash2, Trees, Video, Waves, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mascot from './assets/xuejing-slime-logo.png'
import {
  favoriteLearningArtifact,
  findLearningArtifactDuplicates,
  generateLearningDocument,
  getLearningArtifacts,
  getLearningArtifactVersions,
  getTutorHistory,
  getTutorSessions,
  permanentlyDeleteLearningArtifact,
  readTutorStream,
  restoreLearningArtifact,
  restoreLearningArtifactVersion,
  saveLearningArtifact,
  streamTutorChat,
  trashLearningArtifact,
  updateLearningArtifact,
} from './services/api'
import type { LearningArtifactRecord, LearningState, TutorMessage, TutorSessionSummary } from './services/api'
import './App.css'

type IconName =
  | 'archive'
  | 'arrow-left'
  | 'arrow-up'
  | 'audio'
  | 'book'
  | 'check'
  | 'chevron'
  | 'clipboard'
  | 'code'
  | 'download'
  | 'file-question'
  | 'file'
  | 'folder'
  | 'history'
  | 'image'
  | 'layout'
  | 'library'
  | 'map'
  | 'menu'
  | 'mic'
  | 'notebook'
  | 'paperclip'
  | 'pen'
  | 'play'
  | 'presentation'
  | 'restore'
  | 'save'
  | 'search'
  | 'settings'
  | 'spark'
  | 'star'
  | 'tags'
  | 'trash'
  | 'trees'
  | 'video'
  | 'waves'
  | 'x'

type View = 'welcome' | 'chat' | 'library'
type LibraryMode = 'recent' | 'course' | 'favorite' | 'trash'
type SaveMode = 'save' | 'edit'
type SaveStrategy = 'version' | 'update' | 'separate'
type DeleteMode = 'trash' | 'permanent'
type GenerationCategory = 'universal' | 'quick' | 'deep' | 'practice' | 'review' | 'submit'
type ArtifactKind =
  | 'notes' | 'practice' | 'map' | 'interactive' | 'video'
  | 'summary' | 'question' | 'compare' | 'audio'
  | 'chapter' | 'page-guide' | 'formula' | 'glossary' | 'study-pack' | 'plan'
  | 'similar' | 'variants' | 'special' | 'mock' | 'coding' | 'oral'
  | 'cards' | 'review' | 'mistakes' | 'cram' | 'checklist'
  | 'report' | 'slides' | 'infographic' | 'webpage'
type ThemeId = 'cloud' | 'night' | 'forest' | 'paper' | 'violet' | 'marine' | 'dawn' | 'rose' | 'ink' | 'aurora'

type GeneratorOption = {
  kind: ArtifactKind
  label: string
  description: string
  icon: IconName
  category: GenerationCategory
  format: string
  title: string
  summary: string
  details: string[]
}

type Attachment = {
  name: string
  size: string
  type: 'image' | 'file'
  status: 'reading' | 'ready'
}

type Artifact = {
  id: string
  backendId?: number
  qaId?: string
  kind: ArtifactKind
  title: string
  summary: string
  details: string[]
  content?: string
  source: string
  sessionId?: number
  course: string
  topic: string
  recommendedCourse: string
  recommendedTopic: string
  classificationSource: LearningArtifactRecord['classification_source']
  classificationConfidence: number
  classificationOverridden: boolean
  saved: boolean
  favorite: boolean
  versionGroupId: number
  version: number
  createdAt?: string
  updatedAt?: string
  deletedAt?: string
  status?: 'draft' | 'saved' | 'deleted' | 'generating' | 'error'
  purpose?: DocumentPurpose
  depth?: DocumentDepth
  style?: DocumentStyle
}

type ChatTurn = {
  id: string
  prompt: string
  attachment?: string
  response: string
  artifacts: Artifact[]
  loading?: boolean
  error?: boolean
}

type DocumentPurpose = 'review' | 'preview' | 'exam'
type DocumentDepth = 'concise' | 'standard' | 'deep'
type DocumentStyle = 'plain' | 'notes' | 'exam'
type DocumentSetup = {
  turnId: string
  purpose: DocumentPurpose
  depth: DocumentDepth
  style: DocumentStyle
}

const LOCAL_USER_ID = 1
const emptyLearningState: LearningState = {
  subject: '',
  goal: '',
  knowledge_points: [],
  weak_points: [],
  deadline: '',
  level: '',
  current_topic: '',
}

const defaultDocumentSetup = (turnId: string): DocumentSetup => ({
  turnId,
  purpose: 'review',
  depth: 'standard',
  style: 'plain',
})

const documentPurposes: Array<{ id: DocumentPurpose; label: string }> = [
  { id: 'review', label: '课后复习' },
  { id: 'preview', label: '课前预习' },
  { id: 'exam', label: '考前冲刺' },
]
const documentDepths: Array<{ id: DocumentDepth; label: string }> = [
  { id: 'concise', label: '精简' },
  { id: 'standard', label: '标准' },
  { id: 'deep', label: '深入' },
]
const documentStyles: Array<{ id: DocumentStyle; label: string }> = [
  { id: 'plain', label: '通俗讲解' },
  { id: 'notes', label: '课堂笔记' },
  { id: 'exam', label: '考试重点' },
]

const lucideIcons: Record<IconName, LucideIcon> = {
  archive: Archive,
  'arrow-left': ArrowLeft,
  'arrow-up': ArrowUp,
  audio: AudioLines,
  book: BookOpen,
  check: Check,
  chevron: ChevronRight,
  clipboard: ClipboardCheck,
  code: Code2,
  download: FileDown,
  'file-question': FileQuestion,
  file: FileText,
  folder: FolderOpen,
  history: History,
  image: Image,
  layout: LayoutTemplate,
  library: Library,
  map: MapIcon,
  menu: Menu,
  mic: Mic,
  notebook: NotebookTabs,
  paperclip: Paperclip,
  pen: PenLine,
  play: CirclePlay,
  presentation: Presentation,
  restore: RotateCcw,
  save: Save,
  search: Search,
  settings: Settings2,
  spark: Sparkles,
  star: Star,
  tags: Tags,
  trash: Trash2,
  trees: Trees,
  video: Video,
  waves: Waves,
  x: X,
}

const themes: Array<{ id: ThemeId; label: string; description: string; icon: IconName }> = [
  { id: 'cloud', label: '云白', description: '明亮、专注的默认工作台', icon: 'spark' },
  { id: 'night', label: '夜航', description: '适合深夜学习的低刺激深色', icon: 'settings' },
  { id: 'forest', label: '松林', description: '安静的深绿书桌氛围', icon: 'trees' },
  { id: 'paper', label: '琥珀纸页', description: '温暖的纸张与笔记质感', icon: 'book' },
  { id: 'violet', label: '雾紫', description: '克制柔和的灵感空间', icon: 'spark' },
  { id: 'marine', label: '深海', description: '深蓝背景下的沉浸阅读', icon: 'waves' },
  { id: 'dawn', label: '晨曦', description: '清晨学习的柔暖光线', icon: 'spark' },
  { id: 'rose', label: '樱雾', description: '舒缓的粉灰色阅读桌面', icon: 'book' },
  { id: 'ink', label: '墨夜', description: '专注代码与夜读的深灰界面', icon: 'settings' },
  { id: 'aurora', label: '极光', description: '低饱和青紫色学习空间', icon: 'waves' },
]

const artifactOptions: GeneratorOption[] = [
  {
    kind: 'notes', label: '学习文档', description: '讲义、报告与可编辑文档', icon: 'notebook', category: 'universal', format: '在线 · Word · PDF',
    title: '学习文档', summary: '在线阅读 · Word · PDF', details: ['自动匹配题目、课件、论文或代码模板', '保留核心结论、来源和知识结构', '同一内容可下载 Word 与 PDF'],
  },
  {
    kind: 'practice', label: '练习测验', description: '网页答题并支持打印', icon: 'file-question', category: 'universal', format: '互动页 · PDF',
    title: '练习测验', summary: '12 题 · 网页作答 · 可导出 PDF', details: ['根据当前内容生成分层题目', '答案默认在完成后显示', '包含逐题解析和知识点定位'],
  },
  {
    kind: 'map', label: '知识图解', description: '把关系和步骤画清楚', icon: 'map', category: 'universal', format: 'PNG · SVG',
    title: '知识图解', summary: '知识结构 · 解题流程 · PNG / SVG', details: ['自动选择知识图、流程图或对比图', '公式和技术文字使用可控矢量渲染', '支持高清图片和 SVG 导出'],
  },
  {
    kind: 'interactive', label: '动态讲解', description: '可播放、暂停的互动网页', icon: 'play', category: 'universal', format: 'HTML',
    title: '动态讲解', summary: 'HTML · 分步播放 · 含互动检查', details: ['分步展示变量、流程或解题过程', '支持暂停、重播和调节速度', '可加入点击解释与中途测验'],
  },
  {
    kind: 'video', label: '讲解视频', description: '配音、字幕和动态画面', icon: 'video', category: 'universal', format: 'MP4',
    title: '讲解视频', summary: 'MP4 · 配音 · 字幕 · 约 3 分钟', details: ['先生成讲解脚本和镜头结构', '严谨内容优先由动态页面渲染', '辅助场景可调用视频生成模型'],
  },

  { kind: 'summary', label: '一页速览', description: '快速抓住核心内容', icon: 'file', category: 'quick', format: '在线 · PDF', title: '一页速览', summary: '核心结论 · 阅读顺序 · 约 2 分钟', details: ['压缩为一页重点', '标出必须先懂的概念', '给出下一步阅读建议'] },
  { kind: 'question', label: '题目讲解单', description: '从题意到反思完整拆解', icon: 'file-question', category: 'quick', format: '在线 · Word · PDF', title: '题目讲解单', summary: '题意 · 思路 · 步骤 · 反思', details: ['定位考查知识点', '分步解释关键推理', '补充常见错误与自检问题'] },
  { kind: 'compare', label: '概念对比', description: '分清相近概念和使用条件', icon: 'layout', category: 'quick', format: '表格 · 图片', title: '概念对比表', summary: '定义 · 差异 · 适用场景', details: ['对齐比较维度', '突出易混点', '附带判断示例'] },
  { kind: 'audio', label: '音频讲解', description: '把当前内容变成可听笔记', icon: 'audio', category: 'quick', format: 'MP3', title: '音频讲解', summary: 'MP3 · 章节播报 · 重点回顾', details: ['生成自然口语讲稿', '重点处加入停顿和提示', '适合通勤或睡前复习'] },

  { kind: 'chapter', label: '完整章节讲义', description: '系统整理知识、例题和易错点', icon: 'notebook', category: 'deep', format: 'Word · PDF', title: '完整章节讲义', summary: '知识结构 · 例题 · 易错点 · 自检', details: ['建立完整章节结构', '加入典型例题和解析', '结尾提供掌握检查'] },
  { kind: 'page-guide', label: '逐页讲解', description: '沿着原资料逐页说明', icon: 'book', category: 'deep', format: '在线 · PDF', title: '逐页讲解', summary: '保留页码 · 原文引用 · 补充解释', details: ['按原资料顺序讲解', '保留页码和引用位置', '对难点补充通俗解释'] },
  { kind: 'formula', label: '公式手册', description: '公式、条件和典型用法', icon: 'clipboard', category: 'deep', format: 'Word · PDF', title: '公式手册', summary: '公式 · 符号 · 条件 · 例题', details: ['统一公式符号', '说明适用条件', '每个公式附典型用法'] },
  { kind: 'glossary', label: '术语表', description: '中英文术语和关联概念', icon: 'tags', category: 'deep', format: '在线 · Word', title: '术语表', summary: '术语 · 定义 · 英文 · 关联概念', details: ['提取高频术语', '给出简明定义', '连接相近和前置概念'] },
  { kind: 'study-pack', label: '章节学习包', description: '讲义、练习、卡片一次生成', icon: 'archive', category: 'deep', format: '资料包', title: '章节学习包', summary: '讲义 + 练习 + 卡片 + 知识图', details: ['生成一份完整讲义', '生成一组分层练习', '附带记忆卡和知识图'] },
  { kind: 'plan', label: '学习计划', description: '把目标拆成每日任务', icon: 'spark', category: 'deep', format: '在线 · PDF', title: '学习计划', summary: '目标 · 阶段 · 每日任务 · 调整规则', details: ['拆解学习范围', '安排每天的核心任务', '根据练习结果预留调整点'] },

  { kind: 'similar', label: '同类题', description: '保持结构相近的针对练习', icon: 'file-question', category: 'practice', format: '互动页 · PDF', title: '同类题训练', summary: '6 题 · 同知识点 · 答案隐藏', details: ['复用当前题目结构', '更换数据与表述', '逐题提供解析'] },
  { kind: 'variants', label: '变式题', description: '改变条件和问法验证迁移', icon: 'spark', category: 'practice', format: '互动页 · PDF', title: '变式题训练', summary: '5 题 · 条件变化 · 迁移检查', details: ['改变题目条件', '改变问题方向', '验证是否真正理解'] },
  { kind: 'special', label: '专项训练', description: '集中攻克一个薄弱知识点', icon: 'clipboard', category: 'practice', format: '互动页', title: '专项训练', summary: '薄弱点定位 · 递进训练 · 即时反馈', details: ['从基础题逐步增加难度', '记录每一步错误', '完成后给出补缺建议'] },
  { kind: 'mock', label: '模拟试卷', description: '按题型、分值和时间组卷', icon: 'file', category: 'practice', format: '在线 · PDF', title: '模拟试卷', summary: '限时测验 · 分值 · 答案解析', details: ['按目标考试设置题型', '支持网页计时答题', '完成后生成分析报告'] },
  { kind: 'coding', label: '编程实验', description: '代码任务、测试用例和提示', icon: 'code', category: 'practice', format: '代码 · HTML', title: '编程实验', summary: '任务说明 · 初始代码 · 测试用例', details: ['给出可运行的初始代码', '设计逐步提示', '用测试用例验证结果'] },
  { kind: 'oral', label: '口述测验', description: '通过追问检查是否会解释', icon: 'mic', category: 'practice', format: '语音互动', title: '口述测验', summary: '提问 · 追问 · 评分标准', details: ['从核心概念开始提问', '根据回答继续追问', '输出表达和理解反馈'] },

  { kind: 'cards', label: '记忆卡片', description: '概念、公式和快速回忆', icon: 'archive', category: 'review', format: '互动卡 · PDF', title: '记忆卡片', summary: '18 张 · 问答式 · 支持复习', details: ['核心定义与判定条件', '公式和解题触发词', '常见混淆点对照'] },
  { kind: 'review', label: '错题复盘', description: '错误归因和补缺训练', icon: 'tags', category: 'review', format: '在线 · Word', title: '错题复盘', summary: '错误归因 · 补缺讲解 · 变式题', details: ['定位错误发生在哪一步', '补齐对应知识缺口', '用变式题重新验证'] },
  { kind: 'mistakes', label: '易错点清单', description: '集中整理陷阱和判别方法', icon: 'clipboard', category: 'review', format: 'PDF · 图片', title: '易错点清单', summary: '高频陷阱 · 判别方法 · 示例', details: ['提取常见错误', '给出快速判别方法', '附带正反例对照'] },
  { kind: 'cram', label: '考前速记', description: '只保留高频结论和公式', icon: 'file', category: 'review', format: 'PDF · 图片', title: '考前速记', summary: '高频结论 · 公式 · 最后检查', details: ['删除低优先级内容', '压缩为考前阅读长度', '标出最后必须确认的知识点'] },
  { kind: 'checklist', label: '复习清单', description: '今天需要回忆和重做什么', icon: 'check', category: 'review', format: '在线 · PDF', title: '复习清单', summary: '回忆 · 重做 · 检查 · 完成状态', details: ['安排主动回忆任务', '加入需要重做的题目', '记录完成和遗忘情况'] },

  { kind: 'report', label: '课程报告', description: '整理成可提交的正式文档', icon: 'download', category: 'submit', format: 'Word · PDF', title: '课程报告', summary: '正式结构 · 图表 · Word / PDF', details: ['按报告结构重组内容', '加入必要图表与引用', '提供 Word 和 PDF 版本'] },
  { kind: 'slides', label: '演示文稿', description: '生成汇报结构和页面内容', icon: 'presentation', category: 'submit', format: 'PPTX', title: '演示文稿', summary: '汇报逻辑 · 页面内容 · 演讲提示', details: ['建立清晰叙事顺序', '每页只保留一个重点', '附带口头讲解提示'] },
  { kind: 'infographic', label: '信息图', description: '把重点整理成一张长图', icon: 'image', category: 'submit', format: 'PNG · SVG', title: '学习信息图', summary: '一张长图 · 结构清晰 · 可分享', details: ['提取适合视觉展示的重点', '保持清晰阅读层级', '输出高清 PNG 与 SVG'] },
  { kind: 'webpage', label: '讲解网页', description: '生成可分享的互动页面', icon: 'layout', category: 'submit', format: 'HTML', title: '互动讲解网页', summary: 'HTML · 图文 · 互动组件', details: ['组合文字、图解和小测验', '适配电脑与手机', '可作为独立页面分享'] },
]

const primaryArtifactOptions = artifactOptions.filter(item => item.category === 'universal')
const generationCategories: Array<{ id: Exclude<GenerationCategory, 'universal'>; label: string; hint: string }> = [
  { id: 'quick', label: '快速看懂', hint: '先抓住重点' },
  { id: 'deep', label: '系统学习', hint: '建立完整结构' },
  { id: 'practice', label: '做题训练', hint: '练习与测验' },
  { id: 'review', label: '记忆复习', hint: '记住并回看' },
  { id: 'submit', label: '汇报提交', hint: '导出与展示' },
]

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const Glyph = lucideIcons[name]
  return <Glyph aria-hidden="true" className="icon" size={size} strokeWidth={1.8} />
}

function BrandSymbol() {
  return <img className="brand-mascot" src={mascot} alt="" aria-hidden="true" />
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatLibraryDate(value?: string) {
  if (!value) return ''
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date)
}

function artifactFromRecord(record: LearningArtifactRecord): Artifact {
  const source = record.source_prompt || '本次对话'
  return {
    id: `artifact-${record.id}`,
    backendId: record.id,
    qaId: record.qa_id,
    sessionId: record.session_id,
    kind: record.kind,
    title: record.title,
    summary: record.summary,
    details: record.highlights,
    content: record.content,
    source: source.length > 72 ? `${source.slice(0, 72)}…` : source,
    course: record.course_name || '未分类课程',
    topic: record.topic_name || '未分类主题',
    recommendedCourse: record.recommended_course_name || record.course_name || '未分类课程',
    recommendedTopic: record.recommended_topic_name || record.topic_name || '未分类主题',
    classificationSource: record.classification_source || 'fallback',
    classificationConfidence: record.classification_confidence || 0,
    classificationOverridden: record.classification_overridden,
    saved: record.status === 'saved',
    favorite: record.is_favorite,
    versionGroupId: record.version_group_id || record.id,
    version: record.version || 1,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    deletedAt: record.deleted_at,
    status: record.status,
    purpose: record.purpose,
    depth: record.depth,
    style: record.style,
  }
}

function attachArtifacts(turns: ChatTurn[], records: LearningArtifactRecord[]) {
  const byQa = records.reduce<Record<string, Artifact[]>>((groups, record) => {
    groups[record.qa_id] = [...(groups[record.qa_id] || []), artifactFromRecord(record)]
    return groups
  }, {})
  return turns.map(turn => ({ ...turn, artifacts: byQa[turn.id] || [] }))
}

function messagesToTurns(messages: TutorMessage[]): ChatTurn[] {
  const restored: ChatTurn[] = []
  for (const message of messages) {
    if (message.role === 'user') {
      restored.push({
        id: message.id || `history-${restored.length}`,
        prompt: message.content,
        response: '',
        artifacts: [],
      })
      continue
    }
    const pending = [...restored].reverse().find(turn => !turn.response)
    if (pending) {
      pending.id = message.id || pending.id
      pending.response = message.content
    }
  }
  return restored.map(turn => turn.response
    ? turn
    : { ...turn, response: '这条问题尚未完成回答，可以重新发送后继续。', error: true })
}

function App() {
  const [view, setView] = useState<View>('welcome')
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessions, setSessions] = useState<TutorSessionSummary[]>([])
  const [learningState, setLearningState] = useState<LearningState>(emptyLearningState)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [selectedKind, setSelectedKind] = useState<ArtifactKind | null>(null)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generatorCatalogOpen, setGeneratorCatalogOpen] = useState(false)
  const [generatorTurnId, setGeneratorTurnId] = useState<string | null>(null)
  const [generatorCategory, setGeneratorCategory] = useState<Exclude<GenerationCategory, 'universal'>>('quick')
  const [generatorSearch, setGeneratorSearch] = useState('')
  const [recording, setRecording] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [documentSetup, setDocumentSetup] = useState<DocumentSetup | null>(null)
  const [documentGenerating, setDocumentGenerating] = useState(false)
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | null>(null)
  const [saveTarget, setSaveTarget] = useState<Artifact | null>(null)
  const [saveMode, setSaveMode] = useState<SaveMode>('save')
  const [saveRecommendedCourse, setSaveRecommendedCourse] = useState('未分类课程')
  const [saveRecommendedTopic, setSaveRecommendedTopic] = useState('未分类主题')
  const [saveRecommendationSource, setSaveRecommendationSource] = useState<LearningArtifactRecord['classification_source']>('fallback')
  const [saveTitle, setSaveTitle] = useState('')
  const [saveCourse, setSaveCourse] = useState('')
  const [saveTopic, setSaveTopic] = useState('')
  const [saveLocationOpen, setSaveLocationOpen] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [duplicateMatches, setDuplicateMatches] = useState<Artifact[]>([])
  const [duplicateStrategy, setDuplicateStrategy] = useState<SaveStrategy>('version')
  const [duplicateCheckComplete, setDuplicateCheckComplete] = useState(false)
  const [libraryItems, setLibraryItems] = useState<Artifact[]>([])
  const [trashedItems, setTrashedItems] = useState<Artifact[]>([])
  const [libraryPreviewId, setLibraryPreviewId] = useState<string | null>(null)
  const [libraryMode, setLibraryMode] = useState<LibraryMode>('recent')
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryTopic, setLibraryTopic] = useState<{ course: string; topic: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Artifact | null>(null)
  const [deleteMode, setDeleteMode] = useState<DeleteMode>('trash')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [undoTrashId, setUndoTrashId] = useState<number | null>(null)
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [versionHistoryBusy, setVersionHistoryBusy] = useState(false)
  const [versionItems, setVersionItems] = useState<Artifact[]>([])
  const [versionPreview, setVersionPreview] = useState<Artifact | null>(null)
  const [versionRestoreId, setVersionRestoreId] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const [theme, setTheme] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('rhyme-theme') ?? localStorage.getItem('xuejing-theme')
    return themes.some(item => item.id === saved) ? saved as ThemeId : 'cloud'
  })

  useEffect(() => {
    localStorage.setItem('rhyme-theme', theme)
  }, [theme])

  useEffect(() => {
    setVersionHistoryOpen(false)
    setVersionItems([])
    setVersionPreview(null)
  }, [libraryPreviewId])

  useEffect(() => {
    let cancelled = false
    async function restoreLatestConversation() {
      try {
        const data = await getTutorSessions(LOCAL_USER_ID) as { sessions: TutorSessionSummary[] }
        if (cancelled) return
        const restoredSessions = data.sessions || []
        setSessions(restoredSessions)
        const [savedData, deletedData] = await Promise.all([
          getLearningArtifacts(LOCAL_USER_ID, { status: 'saved' }).catch(() => ({ artifacts: [] })),
          getLearningArtifacts(LOCAL_USER_ID, { status: 'deleted' }).catch(() => ({ artifacts: [] })),
        ])
        if (cancelled) return
        setLibraryItems(savedData.artifacts.map(artifactFromRecord))
        setTrashedItems(deletedData.artifacts.map(artifactFromRecord))
        if (restoredSessions.length > 0) {
          const latest = restoredSessions[0]
          const [history, artifactData] = await Promise.all([
            getTutorHistory(LOCAL_USER_ID, latest.id),
            getLearningArtifacts(LOCAL_USER_ID, { sessionId: latest.id }).catch(() => ({ artifacts: [] })),
          ])
          if (cancelled) return
          setSessionId(latest.id)
          setTurns(attachArtifacts(messagesToTurns(history.messages), artifactData.artifacts))
          setLearningState(history.learning_state || emptyLearningState)
          setView('chat')
        }
      } catch {
        if (!cancelled) setNotice('暂时无法连接本地服务，请确认后端已经启动。')
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }
    void restoreLatestConversation()
    return () => { cancelled = true }
  }, [])

  const selectedOption = artifactOptions.find(item => item.kind === selectedKind)
  const canSend = Boolean(input.trim() || attachment) && !sending
  const activeSession = sessions.find(item => item.id === sessionId)
  const conversationTitle = activeSession?.title || turns[0]?.prompt || '学习对话'
  const hasLearningState = Boolean(
    learningState.subject || learningState.goal || learningState.deadline || learningState.current_topic
    || learningState.knowledge_points.length || learningState.weak_points.length,
  )
  const generatorContext = generatorTurnId
    ? turns.find(turn => turn.id === generatorTurnId)?.prompt || '当前对话内容'
    : input.trim() || attachment?.name || '当前对话内容'
  const generatorResults = useMemo(() => {
    const query = generatorSearch.trim().toLowerCase()
    const candidates = artifactOptions.filter(item => item.category !== 'universal')
    if (query) {
      const directMatches = candidates.filter(item => `${item.label}${item.description}${item.format}`.toLowerCase().includes(query))
      if (directMatches.length > 0) return directMatches

      const matchedCategories = new Set<GenerationCategory>()
      if (/看懂|解释|讲解|摘要|快速|重点/.test(query)) matchedCategories.add('quick')
      if (/系统|完整|章节|公式|术语|计划/.test(query)) matchedCategories.add('deep')
      if (/做题|练习|测验|试卷|编程|训练/.test(query)) matchedCategories.add('practice')
      if (/复习|记忆|背诵|考前|冲刺|错题/.test(query)) matchedCategories.add('review')
      if (/汇报|提交|作业|报告|演示|分享/.test(query)) matchedCategories.add('submit')

      const formatMatches = candidates.filter(item => {
        if (/word|文档/.test(query) && /Word/.test(item.format)) return true
        if (/pdf|打印/.test(query) && /PDF/.test(item.format)) return true
        if (/图片|图像|png|svg/.test(query) && /PNG|SVG|图片/.test(item.format)) return true
        if (/音频|mp3|听/.test(query) && /MP3|语音/.test(item.format)) return true
        if (/视频|mp4/.test(query) && /MP4/.test(item.format)) return true
        if (/网页|html|互动/.test(query) && /HTML|互动页/.test(item.format)) return true
        return false
      })
      const intentMatches = candidates.filter(item => matchedCategories.has(item.category))
      return [...new Map([...intentMatches, ...formatMatches].map(item => [item.kind, item])).values()]
    }
    return candidates.filter(item => item.category === generatorCategory)
  }, [generatorCategory, generatorSearch])
  const activeLibraryItems = libraryMode === 'trash' ? trashedItems : libraryItems
  const filteredLibraryItems = useMemo(() => {
    const query = librarySearch.trim().toLowerCase()
    return activeLibraryItems.filter(item => {
      if (libraryMode === 'favorite' && !item.favorite) return false
      if (!query) return true
      return `${item.title}${item.summary}${item.course}${item.topic}${item.details.join('')}`.toLowerCase().includes(query)
    })
  }, [activeLibraryItems, libraryMode, librarySearch])
  const libraryCourseGroups = useMemo(() => {
    const courses = filteredLibraryItems.reduce<Record<string, Record<string, Artifact[]>>>((groups, item) => {
      groups[item.course] ||= {}
      groups[item.course][item.topic] = [...(groups[item.course][item.topic] || []), item]
      return groups
    }, {})
    return Object.entries(courses)
  }, [filteredLibraryItems])
  const libraryPreview = [...libraryItems, ...trashedItems].find(item => item.id === libraryPreviewId) || null
  const readerArtifact = versionPreview || libraryPreview
  const libraryTopicItems = libraryTopic
    ? filteredLibraryItems.filter(item => item.course === libraryTopic.course && item.topic === libraryTopic.topic)
    : []
  const libraryCourseOptions = useMemo(
    () => [...new Set(libraryItems.map(item => item.course).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [libraryItems],
  )
  const libraryTopicOptions = useMemo(
    () => [...new Set(libraryItems
      .filter(item => item.course === saveCourse)
      .map(item => item.topic)
      .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [libraryItems, saveCourse],
  )

  function newChat() {
    if (sending) {
      setNotice('请等待当前回答完成后再新建对话。')
      return
    }
    setView('welcome')
    setTurns([])
    setSessionId(null)
    setLearningState({ ...emptyLearningState })
    setInput('')
    setAttachment(null)
    setSelectedKind(null)
    setGenerateOpen(false)
    setGeneratorCatalogOpen(false)
    setDocumentSetup(null)
    setExpandedArtifactId(null)
    setSidebarOpen(false)
  }

  async function openSession(targetSessionId: number) {
    if (sending && targetSessionId !== sessionId) {
      setNotice('请等待当前回答完成后再切换对话。')
      return
    }
    setHistoryLoading(true)
    try {
      const [history, artifactData] = await Promise.all([
        getTutorHistory(LOCAL_USER_ID, targetSessionId),
        getLearningArtifacts(LOCAL_USER_ID, { sessionId: targetSessionId }).catch(() => ({ artifacts: [] })),
      ])
      setSessionId(targetSessionId)
      setTurns(attachArtifacts(messagesToTurns(history.messages), artifactData.artifacts))
      setLearningState(history.learning_state || emptyLearningState)
      setView('chat')
      setDocumentSetup(null)
      setExpandedArtifactId(null)
      setSidebarOpen(false)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '读取历史对话失败。')
    } finally {
      setHistoryLoading(false)
    }
  }

  async function refreshSessions() {
    try {
      const data = await getTutorSessions(LOCAL_USER_ID) as { sessions: TutorSessionSummary[] }
      setSessions(data.sessions || [])
    } catch {
      setNotice('回答已保留，但历史列表暂时刷新失败。')
    }
  }

  function chooseArtifact(kind: ArtifactKind) {
    setSelectedKind(kind)
    setGenerateOpen(false)
  }

  function openGeneratorCatalog(turnId: string | null = null) {
    setGeneratorTurnId(turnId)
    setGeneratorSearch('')
    setGeneratorCategory('quick')
    setGenerateOpen(false)
    setGeneratorCatalogOpen(true)
  }

  function chooseFromCatalog(kind: ArtifactKind) {
    if (generatorTurnId) generateForTurn(generatorTurnId, kind)
    else chooseArtifact(kind)
    setGeneratorCatalogOpen(false)
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>, type: Attachment['type']) {
    const file = event.target.files?.[0]
    if (!file) return
    setAttachment({ name: file.name, size: formatFileSize(file.size), type, status: 'reading' })
    setNotice('正在解析资料并识别知识点…')
    window.setTimeout(() => {
      setAttachment(current => current?.name === file.name ? { ...current, status: 'ready' } : current)
      setNotice('资料已解析，可以提问或选择生成类型。')
    }, 700)
    event.target.value = ''
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSend) return

    const prompt = input.trim() || `请分析这份资料：${attachment?.name}`
    const requestedKind = selectedKind
    const turnId = `pending-${Date.now()}`
    const previousSessionId = sessionId
    setTurns(current => [...current, {
      id: turnId,
      prompt,
      attachment: attachment?.name,
      response: '',
      artifacts: [],
      loading: true,
    }])
    setView('chat')
    setSending(true)
    setInput('')
    setAttachment(null)
    setSelectedKind(null)
    setGenerateOpen(false)

    try {
      const response = await streamTutorChat(LOCAL_USER_ID, previousSessionId, prompt, 'text')
      await readTutorStream(response, streamEvent => {
        if (streamEvent.type === 'chunk') {
          setTurns(current => current.map(turn => turn.id === turnId
            ? { ...turn, response: turn.response + streamEvent.content }
            : turn))
        }
        if (streamEvent.type === 'done') {
          setSessionId(streamEvent.session_id)
          setLearningState(streamEvent.learning_state || emptyLearningState)
          setTurns(current => current.map(turn => turn.id === turnId
            ? { ...turn, id: streamEvent.qa_id, loading: false }
            : turn))
          if (requestedKind === 'notes') setDocumentSetup(defaultDocumentSetup(streamEvent.qa_id))
          else if (requestedKind) {
            setNotice(`${artifactOptions.find(item => item.kind === requestedKind)?.label}将在后续阶段接通，当前先完成学习文档。`)
          }
        }
      })
      await refreshSessions()
    } catch (error) {
      const message = error instanceof Error ? error.message : '本地服务暂时无法回答'
      setTurns(current => current.map(turn => turn.id === turnId
        ? { ...turn, response: `${message}。请检查后端连接后重试。`, loading: false, error: true }
        : turn))
      setInput(prompt)
      setNotice(message)
    } finally {
      setSending(false)
    }
  }

  function generateForTurn(turnId: string, kind: ArtifactKind) {
    if (kind === 'notes') {
      setDocumentSetup(current => current?.turnId === turnId ? null : defaultDocumentSetup(turnId))
      return
    }
    setNotice(`${artifactOptions.find(item => item.kind === kind)?.label}将在后续阶段接通，当前先完成学习文档。`)
  }

  async function runDocumentGeneration() {
    if (!documentSetup || !sessionId || documentGenerating) return
    const turn = turns.find(item => item.id === documentSetup.turnId)
    if (!turn || turn.id.startsWith('pending-')) {
      setNotice('这条回答还没有保存完成，请稍后重试。')
      return
    }
    const loadingId = `generating-${Date.now()}`
    const loadingArtifact: Artifact = {
      id: loadingId,
      kind: 'notes',
      title: '正在整理学习文档…',
      summary: '千问正在提取知识结构、例子、易错点和自测问题。',
      details: ['读取当前问题与回答', '结合学习状态重新组织内容'],
      source: turn.prompt,
      course: learningState.subject || '未分类课程',
      topic: learningState.current_topic || '本次学习',
      recommendedCourse: learningState.subject || '未分类课程',
      recommendedTopic: learningState.current_topic || '本次学习',
      classificationSource: 'learning_state',
      classificationConfidence: 0.9,
      classificationOverridden: false,
      saved: false,
      favorite: false,
      versionGroupId: 0,
      version: 1,
      status: 'generating',
      ...documentSetup,
    }
    setDocumentGenerating(true)
    setDocumentSetup(null)
    setTurns(current => current.map(item => item.id === turn.id
      ? { ...item, artifacts: [...item.artifacts, loadingArtifact] }
      : item))
    try {
      const data = await generateLearningDocument(
        LOCAL_USER_ID,
        sessionId,
        turn.id,
        {
          purpose: loadingArtifact.purpose || 'review',
          depth: loadingArtifact.depth || 'standard',
          style: loadingArtifact.style || 'plain',
        },
      )
      const generated = artifactFromRecord(data.artifact)
      setTurns(current => current.map(item => item.id === turn.id
        ? { ...item, artifacts: item.artifacts.map(artifact => artifact.id === loadingId ? generated : artifact) }
        : item))
      setExpandedArtifactId(generated.id)
      setNotice('学习文档已生成，作为临时资料保存在当前对话。')
    } catch (error) {
      const message = error instanceof Error ? error.message : '学习文档生成失败'
      setTurns(current => current.map(item => item.id === turn.id
        ? {
            ...item,
            artifacts: item.artifacts.map(artifact => artifact.id === loadingId
              ? { ...artifact, title: '生成没有完成', summary: message, details: ['可以重新选择设置后再试'], status: 'error' }
              : artifact),
          }
        : item))
      setNotice(message)
    } finally {
      setDocumentGenerating(false)
    }
  }

  function resetDuplicateDecision() {
    setDuplicateMatches([])
    setDuplicateStrategy('version')
    setDuplicateCheckComplete(false)
  }

  function closeSave() {
    setSaveTarget(null)
    resetDuplicateDecision()
  }

  function openSave(artifact: Artifact, mode: SaveMode = 'save') {
    const stateCourse = learningState.subject || ''
    const stateTopic = learningState.current_topic || learningState.knowledge_points[0] || ''
    const artifactCourse = artifact.recommendedCourse || artifact.course || ''
    const artifactTopic = artifact.recommendedTopic || artifact.topic || ''
    const recommendedCourse = artifactCourse && artifactCourse !== '未分类课程'
      ? artifactCourse
      : stateCourse || '未分类课程'
    const recommendedTopic = artifactTopic && artifactTopic !== '未分类主题' && artifactTopic !== '本次学习'
      ? artifactTopic
      : stateTopic || '未分类主题'
    const recommendationSource = artifact.classificationSource === 'fallback' && stateCourse && stateTopic
      ? 'learning_state'
      : artifact.classificationSource
    setSaveTarget(artifact)
    setSaveMode(mode)
    setSaveRecommendedCourse(recommendedCourse)
    setSaveRecommendedTopic(recommendedTopic)
    setSaveRecommendationSource(recommendationSource)
    setSaveTitle(artifact.title)
    setSaveCourse(mode === 'edit' ? artifact.course : recommendedCourse)
    setSaveTopic(mode === 'edit' ? artifact.topic : recommendedTopic)
    setSaveLocationOpen(mode === 'edit' || recommendedCourse === '未分类课程' || recommendedTopic === '未分类主题')
    resetDuplicateDecision()
  }

  async function confirmSave() {
    if (!saveTarget || !saveTitle.trim() || !saveCourse.trim() || !saveTopic.trim()) return
    setSaveBusy(true)
    try {
      const target = saveTarget
      let resolvedStrategy: SaveStrategy = 'separate'
      let duplicateArtifactId: number | undefined
      if (saveMode === 'save' && target.backendId) {
        if (!duplicateCheckComplete) {
          const result = await findLearningArtifactDuplicates(
            target.backendId,
            LOCAL_USER_ID,
            saveTitle.trim(),
            saveCourse.trim(),
            saveTopic.trim(),
          )
          const matches = result.duplicates.map(artifactFromRecord)
          setDuplicateMatches(matches)
          setDuplicateCheckComplete(true)
          if (matches.length > 0) {
            setDuplicateStrategy('version')
            return
          }
        } else if (duplicateMatches.length > 0) {
          resolvedStrategy = duplicateStrategy
          duplicateArtifactId = duplicateMatches[0].backendId
        }
      }

      let savedArtifact: Artifact
      if (target.backendId) {
        const response = saveMode === 'edit'
          ? await updateLearningArtifact(
            target.backendId,
            LOCAL_USER_ID,
            saveTitle.trim(),
            saveCourse.trim(),
            saveTopic.trim(),
          )
          : await saveLearningArtifact(
            target.backendId,
            LOCAL_USER_ID,
            saveTitle.trim(),
            saveCourse.trim(),
            saveTopic.trim(),
            resolvedStrategy,
            duplicateArtifactId,
          )
        savedArtifact = artifactFromRecord(response.artifact)
      } else {
        savedArtifact = {
            ...saveTarget,
            title: saveTitle.trim(),
            course: saveCourse.trim(),
            topic: saveTopic.trim(),
            recommendedCourse: saveRecommendedCourse,
            recommendedTopic: saveRecommendedTopic,
            classificationSource: saveRecommendationSource,
            classificationOverridden: saveCourse.trim() !== saveRecommendedCourse || saveTopic.trim() !== saveRecommendedTopic,
            saved: true,
            status: 'saved' as const,
          }
      }
      setTurns(current => current.map(turn => ({
        ...turn,
        artifacts: turn.artifacts
          .map(item => item.id === target.id || item.id === savedArtifact.id ? savedArtifact : item)
          .filter((item, index, items) => items.findIndex(entry => entry.id === item.id) === index),
      })))
      setLibraryItems(current => [savedArtifact, ...current.filter(item => (
        item.id !== savedArtifact.id && item.versionGroupId !== savedArtifact.versionGroupId
      ))])
      closeSave()
      if (saveMode === 'edit') {
        setNotice(`已调整到 ${savedArtifact.course} / ${savedArtifact.topic}`)
      } else if (resolvedStrategy === 'version') {
        setNotice(`已保存为 v${savedArtifact.version}，资料库继续显示最新版`)
      } else if (resolvedStrategy === 'update') {
        setNotice('已用本次内容更新原资料')
      } else if (duplicateMatches.length > 0) {
        setNotice('已作为独立资料保存')
      } else {
        setNotice(`${savedArtifact.classificationOverridden ? '已按你的选择整理到' : '已整理到'} ${savedArtifact.course} / ${savedArtifact.topic}`)
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保存学习资料失败')
    } finally {
      setSaveBusy(false)
    }
  }

  async function toggleArtifactFavorite(artifact: Artifact) {
    if (!artifact.backendId) return
    try {
      const updated = artifactFromRecord((await favoriteLearningArtifact(
        artifact.backendId,
        LOCAL_USER_ID,
        !artifact.favorite,
      )).artifact)
      setTurns(current => current.map(turn => ({
        ...turn,
        artifacts: turn.artifacts.map(item => item.id === updated.id ? updated : item),
      })))
      setLibraryItems(current => current.map(item => item.id === updated.id ? updated : item))
      setNotice(updated.favorite ? '已收藏这份资料' : '已取消收藏')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '更新收藏状态失败')
    }
  }

  async function toggleVersionHistory(artifact: Artifact) {
    if (!artifact.backendId) return
    if (versionHistoryOpen) {
      setVersionHistoryOpen(false)
      setVersionPreview(null)
      return
    }
    setVersionHistoryBusy(true)
    try {
      const result = await getLearningArtifactVersions(artifact.backendId, LOCAL_USER_ID)
      setVersionItems(result.versions.map(artifactFromRecord))
      setVersionHistoryOpen(true)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '获取版本记录失败')
    } finally {
      setVersionHistoryBusy(false)
    }
  }

  async function restoreVersion(artifact: Artifact) {
    if (!artifact.backendId) return
    setVersionRestoreId(artifact.backendId)
    try {
      const restored = artifactFromRecord((await restoreLearningArtifactVersion(
        artifact.backendId,
        LOCAL_USER_ID,
      )).artifact)
      setLibraryItems(current => [restored, ...current.filter(item => item.versionGroupId !== restored.versionGroupId)])
      setTurns(current => current.map(turn => ({
        ...turn,
        artifacts: turn.artifacts.map(item => item.versionGroupId === restored.versionGroupId ? restored : item),
      })))
      setLibraryPreviewId(restored.id)
      setVersionPreview(null)
      setVersionHistoryOpen(false)
      setNotice(`已将 v${artifact.version} 恢复为最新的 v${restored.version}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '恢复这个版本失败')
    } finally {
      setVersionRestoreId(null)
    }
  }

  function switchLibraryMode(mode: LibraryMode) {
    setLibraryMode(mode)
    setLibraryPreviewId(null)
    setLibraryTopic(null)
  }

  function openDeleteConfirmation(artifact: Artifact, mode: DeleteMode) {
    setDeleteTarget(artifact)
    setDeleteMode(mode)
  }

  async function confirmDeleteArtifact() {
    if (!deleteTarget?.backendId) return
    setDeleteBusy(true)
    try {
      if (deleteMode === 'permanent') {
        await permanentlyDeleteLearningArtifact(deleteTarget.backendId, LOCAL_USER_ID)
        setTrashedItems(current => current.filter(item => item.versionGroupId !== deleteTarget.versionGroupId))
        setLibraryPreviewId(null)
        setNotice('资料已永久删除')
      } else {
        const deletedArtifact = artifactFromRecord((await trashLearningArtifact(
          deleteTarget.backendId,
          LOCAL_USER_ID,
        )).artifact)
        setLibraryItems(current => current.filter(item => item.versionGroupId !== deletedArtifact.versionGroupId))
        setTrashedItems(current => [deletedArtifact, ...current.filter(item => item.versionGroupId !== deletedArtifact.versionGroupId)])
        setTurns(current => current.map(turn => ({
          ...turn,
          artifacts: turn.artifacts.filter(item => item.versionGroupId !== deletedArtifact.versionGroupId),
        })))
        setLibraryPreviewId(null)
        setLibraryTopic(null)
        setUndoTrashId(deletedArtifact.backendId || null)
        setNotice('已移到回收站，可撤销')
      }
      setDeleteTarget(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : deleteMode === 'permanent' ? '永久删除资料失败' : '移到回收站失败')
    } finally {
      setDeleteBusy(false)
    }
  }

  async function restoreArtifact(artifact: Artifact, fromUndo = false) {
    if (!artifact.backendId) return
    try {
      const restoredArtifact = artifactFromRecord((await restoreLearningArtifact(
        artifact.backendId,
        LOCAL_USER_ID,
      )).artifact)
      setTrashedItems(current => current.filter(item => item.versionGroupId !== restoredArtifact.versionGroupId))
      setLibraryItems(current => [restoredArtifact, ...current.filter(item => item.versionGroupId !== restoredArtifact.versionGroupId)])
      setTurns(current => current.map(turn => turn.id === restoredArtifact.qaId && !turn.artifacts.some(item => item.versionGroupId === restoredArtifact.versionGroupId)
        ? { ...turn, artifacts: [...turn.artifacts, restoredArtifact] }
        : turn))
      setLibraryPreviewId(null)
      setLibraryMode('recent')
      setUndoTrashId(null)
      setNotice(fromUndo ? '已撤销删除，资料已恢复' : '资料已恢复到资料库')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '恢复资料失败')
    }
  }

  async function undoLastTrash() {
    const artifact = trashedItems.find(item => item.backendId === undoTrashId)
    if (!artifact) {
      setUndoTrashId(null)
      setNotice('这份资料已经不在回收站中')
      return
    }
    await restoreArtifact(artifact, true)
  }

  async function openArtifactSource(artifact: Artifact) {
    if (!artifact.sessionId) return
    setLibraryPreviewId(null)
    setLibraryTopic(null)
    await openSession(artifact.sessionId)
    setNotice('已回到生成这份资料的对话。')
  }

  function toggleRecording() {
    if (!recording) {
      setRecording(true)
      setNotice('正在聆听，再次点击即可结束。')
      return
    }
    setRecording(false)
    setInput(current => current || '请帮我梳理这部分内容的核心知识和易错点')
    setNotice('语音已转成文字，你可以修改后发送。')
  }

  return (
    <div className="app-frame" data-theme={theme}>
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label="主导航">
        <div className="brand-row">
          <span className="brand-mark"><BrandSymbol /></span>
          <span className="brand-copy"><strong>RHYME</strong><small>Learning Agent</small></span>
          <button className="mobile-close icon-button" aria-label="关闭导航" onClick={() => setSidebarOpen(false)}><Icon name="x" /></button>
        </div>

        <button className="new-chat" onClick={newChat}>
          <Icon name="pen" size={17} />
          <span>新学习对话</span>
        </button>

        <nav className="primary-nav" aria-label="学习空间">
          <button className={view === 'library' ? 'nav-item active' : 'nav-item'} onClick={() => { setView('library'); setLibraryPreviewId(null); setLibraryTopic(null); setSidebarOpen(false) }}>
            <Icon name="library" size={18} />
            <span>资料库</span>
            {libraryItems.length > 0 && <span className="nav-count">{libraryItems.length}</span>}
          </button>
        </nav>

        <div className="sidebar-section">
          <div className="section-label">最近</div>
          {historyLoading && sessions.length === 0 ? (
            <p className="history-empty">正在恢复本地对话…</p>
          ) : sessions.length === 0 ? (
            <p className="history-empty">开始一次对话后，会保存在这里。</p>
          ) : (
            sessions.map(item => (
              <button
                className={view === 'chat' && sessionId === item.id ? 'history-item current' : 'history-item'}
                key={item.id}
                onClick={() => void openSession(item.id)}
                disabled={sending && sessionId !== item.id}
              >
                <span className="history-icon"><Icon name="book" size={15} /></span>
                <span>{item.title || item.preview}</span>
              </button>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <button className="profile-button">
            <span className="profile-avatar">姚</span>
            <span><b>姚瑞辉</b><small>本地学习空间</small></span>
            <Icon name="chevron" size={15} />
          </button>
        </div>
      </aside>

      <main className={`workbench ${view === 'welcome' ? 'workbench-welcome' : ''}`}>
        <header className="topbar">
          <button className="desktop-menu icon-button" aria-label="展开导航" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>
          <strong className="conversation-heading">
            {view === 'library' ? '资料库' : view === 'chat' ? conversationTitle : ''}
          </strong>
          <button className="top-action" onClick={() => setSettingsOpen(true)} aria-label="外观设置" title="外观设置"><Icon name="settings" size={18} /></button>
        </header>

        <section className={`conversation ${view === 'chat' ? 'conversation-thread' : ''}`}>
          {view === 'welcome' && (
            <div className="welcome-state">
              <h1>从一个问题开始</h1>
              <p>上传题目、课件或笔记。RHYME 会理解内容，再帮你整理成可继续编辑的学习资料。</p>
            </div>
          )}

          {view === 'chat' && (
            <div className="thread-content">
              {hasLearningState && (
                <div className="learning-state-strip" aria-label="当前学习状态">
                  <span className="learning-state-label">当前学习</span>
                  {learningState.subject && <b>{learningState.subject}</b>}
                  {learningState.current_topic && <span>主题 · {learningState.current_topic}</span>}
                  {learningState.goal && <span>目标 · {learningState.goal}</span>}
                  {learningState.deadline && <span>截止 · {learningState.deadline}</span>}
                  {learningState.knowledge_points.length > 0 && <span>知识点 · {learningState.knowledge_points.slice(0, 3).join('、')}</span>}
                  {learningState.weak_points.length > 0 && <span>薄弱 · {learningState.weak_points.slice(0, 2).join('、')}</span>}
                </div>
              )}
              {turns.map(turn => (
                <div className="turn" key={turn.id}>
                  <div className="message user-message">
                    {turn.attachment && <span className="message-attachment"><Icon name="paperclip" size={15} />{turn.attachment}</span>}
                    <p>{turn.prompt}</p>
                  </div>

                  <div className="assistant-message">
                    <div className="agent-avatar"><BrandSymbol /></div>
                    <div className="assistant-content">
                      <div className={turn.error ? 'assistant-response error' : 'assistant-response'} aria-live={turn.loading ? 'polite' : undefined}>
                        {turn.response
                          ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.response}</ReactMarkdown>
                          : turn.loading && <span className="thinking-label">正在结合你的学习背景思考…</span>}
                        {turn.loading && turn.response && <span className="stream-caret" aria-hidden="true" />}
                      </div>

                      {turn.artifacts.map(artifact => {
                        const option = artifactOptions.find(item => item.kind === artifact.kind)
                        return (
                          <article className={`artifact-card artifact-${artifact.status || 'draft'}`} key={artifact.id}>
                            <div className="artifact-head">
                              <span className="artifact-icon"><Icon name={option?.icon || 'file'} size={18} /></span>
                              <div>
                                <span>{option?.label}</span>
                                <h2>{artifact.title}</h2>
                              </div>
                              <span className={artifact.saved ? 'artifact-status saved' : `artifact-status ${artifact.status || ''}`}>
                                {artifact.saved
                                  ? <><Icon name="check" size={13} />已保存</>
                                  : artifact.status === 'generating'
                                    ? <><Sparkles aria-hidden="true" size={13} />生成中</>
                                    : artifact.status === 'error' ? '未完成' : '临时资料'}
                              </span>
                            </div>
                            <p className="artifact-summary">{artifact.summary}</p>
                            <ul className="artifact-details">
                              {artifact.details.map(item => <li key={item}>{item}</li>)}
                            </ul>
                            {artifact.content && expandedArtifactId === artifact.id && (
                              <div className="artifact-document">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.content}</ReactMarkdown>
                              </div>
                            )}
                            <div className="artifact-source"><Icon name="paperclip" size={14} />基于 {artifact.source}</div>
                            {artifact.status !== 'generating' && (
                              <div className="artifact-actions">
                                {artifact.content && (
                                  <button type="button" onClick={() => setExpandedArtifactId(current => current === artifact.id ? null : artifact.id)}>
                                    {expandedArtifactId === artifact.id ? '收起全文' : '展开全文'}
                                  </button>
                                )}
                                <button type="button" onClick={() => setDocumentSetup({
                                  turnId: turn.id,
                                  purpose: artifact.purpose || 'review',
                                  depth: artifact.depth || 'standard',
                                  style: artifact.style || 'plain',
                                })}>{artifact.status === 'error' ? '重新设置' : '重新生成'}</button>
                                {artifact.status !== 'error' && (
                                  <button className="artifact-save" type="button" onClick={() => {
                                    if (artifact.saved) {
                                      setLibraryPreviewId(artifact.id)
                                      setView('library')
                                    } else openSave(artifact)
                                  }}>
                                    <Icon name={artifact.saved ? 'check' : 'save'} size={15} />
                                    {artifact.saved ? '查看资料库' : '保存到资料库'}
                                  </button>
                                )}
                              </div>
                            )}
                          </article>
                        )
                      })}

                      {!turn.loading && !turn.error && <div className="generation-dock">
                        <div className="next-actions" aria-label="常用生成内容">
                          <span>基于当前内容生成</span>
                          {primaryArtifactOptions.map(item => (
                            <button key={item.kind} type="button" onClick={() => generateForTurn(turn.id, item.kind)}>
                              <Icon name={item.icon} size={15} />{item.label}
                            </button>
                          ))}
                        </div>
                        <button className="more-generation" type="button" onClick={() => openGeneratorCatalog(turn.id)}>
                          <Sparkles aria-hidden="true" size={15} strokeWidth={1.8} />
                          <span>生成更多内容</span>
                          <ChevronRight aria-hidden="true" size={14} strokeWidth={1.8} />
                        </button>
                        {documentSetup?.turnId === turn.id && (
                          <section className="document-setup" aria-label="设置学习文档">
                            <div className="document-setup-head">
                              <div><b>生成学习文档</b><span>只整理这次问题和回答，不会脱离上下文发挥。</span></div>
                              <button type="button" aria-label="关闭学习文档设置" onClick={() => setDocumentSetup(null)}><Icon name="x" size={15} /></button>
                            </div>
                            <div className="document-setting-row">
                              <span>用途</span>
                              <div>{documentPurposes.map(item => (
                                <button key={item.id} type="button" aria-pressed={documentSetup.purpose === item.id} onClick={() => setDocumentSetup(current => current ? { ...current, purpose: item.id } : current)}>{item.label}</button>
                              ))}</div>
                            </div>
                            <div className="document-setting-row">
                              <span>深度</span>
                              <div>{documentDepths.map(item => (
                                <button key={item.id} type="button" aria-pressed={documentSetup.depth === item.id} onClick={() => setDocumentSetup(current => current ? { ...current, depth: item.id } : current)}>{item.label}</button>
                              ))}</div>
                            </div>
                            <div className="document-setting-row">
                              <span>风格</span>
                              <div>{documentStyles.map(item => (
                                <button key={item.id} type="button" aria-pressed={documentSetup.style === item.id} onClick={() => setDocumentSetup(current => current ? { ...current, style: item.id } : current)}>{item.label}</button>
                              ))}</div>
                            </div>
                            <div className="document-setup-foot">
                              <span><Icon name="spark" size={14} />将结合当前学习状态</span>
                              <button type="button" onClick={() => void runDocumentGeneration()} disabled={documentGenerating}><Icon name="spark" size={15} />开始生成</button>
                            </div>
                          </section>
                        )}
                      </div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'library' && (
            <div className="library-page">
              {libraryPreview ? (
                <article className="library-reader">
                  <button className="library-back" type="button" onClick={() => setLibraryPreviewId(null)}>
                    <Icon name="arrow-left" size={15} />返回资料库
                  </button>
                  <div className="library-reader-head">
                    <div>
                      <span>{libraryPreview.status === 'deleted' ? '回收站 / ' : ''}{readerArtifact?.course} / {readerArtifact?.topic}</span>
                      <h1>{readerArtifact?.title}</h1>
                      <small>{versionPreview ? `历史版本 v${versionPreview.version}` : libraryPreview.status === 'deleted' ? '已移入回收站' : '学习资料'}{!versionPreview && libraryPreview.version > 1 ? ` · v${libraryPreview.version}` : ''}</small>
                    </div>
                    {libraryPreview.status !== 'deleted' && (
                      <div className="reader-head-actions">
                        {libraryPreview.version > 1 && (
                          <button className={versionHistoryOpen ? 'reader-version active' : 'reader-version'} type="button" aria-expanded={versionHistoryOpen} onClick={() => void toggleVersionHistory(libraryPreview)} disabled={versionHistoryBusy}>
                            <Icon name="history" size={16} />{versionHistoryBusy ? '加载中…' : '版本记录'}
                          </button>
                        )}
                        <button
                          className={libraryPreview.favorite ? 'reader-favorite active' : 'reader-favorite'}
                          type="button"
                          aria-pressed={libraryPreview.favorite}
                          onClick={() => void toggleArtifactFavorite(libraryPreview)}
                        >
                          <Icon name="star" size={16} />{libraryPreview.favorite ? '已收藏' : '收藏'}
                        </button>
                      </div>
                    )}
                  </div>
                  {versionHistoryOpen && (
                    <section className="version-history" aria-label="版本记录">
                      <div className="version-history-head"><b>版本记录</b><button type="button" aria-label="关闭版本记录" onClick={() => { setVersionHistoryOpen(false); setVersionPreview(null) }}><Icon name="x" size={14} /></button></div>
                      <div className="version-list">
                        {versionItems.map(item => (
                          <div className={versionPreview?.id === item.id ? 'version-row selected' : 'version-row'} key={item.id}>
                            <button className="version-main" type="button" onClick={() => setVersionPreview(item)}>
                              <span>v{item.version}</span>
                              <span><b>{item.title}</b><small>{item.version === libraryPreview.version ? '当前最新版' : formatLibraryDate(item.createdAt || item.updatedAt)}</small></span>
                            </button>
                            {item.version < libraryPreview.version && (
                              <button className="version-restore" type="button" disabled={versionRestoreId !== null} onClick={() => void restoreVersion(item)}>{versionRestoreId === item.backendId ? '恢复中…' : '恢复为最新版'}</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {versionPreview && (
                    <div className="version-preview-notice"><span>正在查看 v{versionPreview.version}，内容不会自动覆盖最新版。</span><button type="button" onClick={() => setVersionPreview(null)}>返回最新版</button></div>
                  )}
                  <p>{readerArtifact?.summary}</p>
                  <div className="library-reader-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{readerArtifact?.content || ''}</ReactMarkdown>
                  </div>
                  <div className="library-reader-actions">
                    {libraryPreview.status === 'deleted' ? (
                      <div className="library-reader-action-group">
                        <button type="button" onClick={() => void restoreArtifact(libraryPreview)}><Icon name="restore" size={14} />恢复资料</button>
                        <button className="danger-action" type="button" onClick={() => openDeleteConfirmation(libraryPreview, 'permanent')}><Icon name="trash" size={14} />永久删除</button>
                      </div>
                    ) : (
                      <div className="library-reader-action-group">
                        <button type="button" onClick={() => void openArtifactSource(libraryPreview)}><Icon name="paperclip" size={14} />回到来源对话</button>
                        <button type="button" onClick={() => openSave(libraryPreview, 'edit')}><Icon name="pen" size={14} />整理资料</button>
                        <button className="danger-action" type="button" onClick={() => openDeleteConfirmation(libraryPreview, 'trash')}><Icon name="trash" size={14} />删除资料</button>
                      </div>
                    )}
                    <span>来源：{readerArtifact?.source}</span>
                  </div>
                </article>
              ) : libraryTopic ? (
                <div className="library-topic-page">
                  <button className="library-back" type="button" onClick={() => setLibraryTopic(null)}>
                    <Icon name="arrow-left" size={15} />返回课程
                  </button>
                  <div className="library-topic-heading">
                    <div><span>{libraryTopic.course}</span><h1>{libraryTopic.topic}</h1></div>
                    <span>{libraryTopicItems.length} 份资料</span>
                  </div>
                  <div className="library-list">
                    {libraryTopicItems.map(item => {
                      const option = artifactOptions.find(entry => entry.kind === item.kind)
                      return (
                        <button className="library-row" key={item.id} onClick={() => setLibraryPreviewId(item.id)}>
                          <span className="library-row-icon"><Icon name={option?.icon || 'file'} size={17} /></span>
                          <span className="library-row-copy"><b>{item.title}</b><small>{option?.label || '学习资料'}{item.version > 1 ? ` · v${item.version}` : ''} · {item.summary}</small></span>
                          {item.favorite && <span className="library-row-star" aria-label="已收藏"><Icon name="star" size={14} /></span>}
                          <Icon name="chevron" size={16} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div className="library-heading">
                    <div><h1>{libraryMode === 'trash' ? '回收站' : '资料库'}</h1><p>{libraryMode === 'trash' ? '删除的资料可以恢复，也可以永久清除。' : '按课程和主题自动整理。'}</p></div>
                    <span>{activeLibraryItems.length} 份资料</span>
                  </div>

                  <div className="library-toolbar">
                    <label className="library-search">
                      <Icon name="search" size={16} />
                      <input value={librarySearch} onChange={event => setLibrarySearch(event.target.value)} placeholder={libraryMode === 'trash' ? '搜索回收站' : '搜索标题、课程或知识点'} aria-label={libraryMode === 'trash' ? '搜索回收站' : '搜索资料'} />
                      {librarySearch && <button type="button" aria-label="清空资料搜索" onClick={() => setLibrarySearch('')}><Icon name="x" size={14} /></button>}
                    </label>
                    <div className="library-modes" aria-label="资料视图">
                      <button type="button" aria-pressed={libraryMode === 'recent'} onClick={() => switchLibraryMode('recent')}>最近</button>
                      <button type="button" aria-pressed={libraryMode === 'course'} onClick={() => switchLibraryMode('course')}>按课程</button>
                      <button type="button" aria-pressed={libraryMode === 'favorite'} onClick={() => switchLibraryMode('favorite')}><Icon name="star" size={14} />收藏</button>
                      <button className="trash-mode" type="button" aria-pressed={libraryMode === 'trash'} onClick={() => switchLibraryMode('trash')}><Icon name="trash" size={14} />回收站{trashedItems.length > 0 ? ` ${trashedItems.length}` : ''}</button>
                    </div>
                  </div>

                  {libraryMode === 'trash' && trashedItems.length === 0 ? (
                    <div className="library-zero library-trash-empty">
                      <Icon name="trash" size={20} />
                      <p>回收站是空的。</p>
                      <small>从资料阅读页删除的内容会暂时保留在这里。</small>
                    </div>
                  ) : libraryMode !== 'trash' && libraryItems.length === 0 ? (
                    <div className="library-empty">
                      <span><Icon name="library" size={24} /></span>
                      <h2>还没有保存资料</h2>
                      <p>对话中生成的资料会先暂存，确认后再按课程和主题收进这里。</p>
                      <button onClick={newChat}>开始学习对话</button>
                    </div>
                  ) : filteredLibraryItems.length === 0 ? (
                    <div className="library-zero">
                      <Icon name={libraryMode === 'favorite' ? 'star' : 'search'} size={20} />
                      <p>{libraryMode === 'favorite' && !librarySearch ? '还没有收藏资料。' : '没有找到匹配的资料。'}</p>
                    </div>
                  ) : libraryMode === 'course' ? (
                    libraryCourseGroups.map(([course, topics]) => {
                      const courseCount = Object.values(topics).reduce((count, items) => count + items.length, 0)
                      return (
                        <section className="library-course" key={course}>
                          <h2>{course}<span>{courseCount} 份</span></h2>
                          <div className="library-topic-list">
                            {Object.entries(topics).map(([topic, items]) => {
                              const typeNames = [...new Set(items.map(item => artifactOptions.find(option => option.kind === item.kind)?.label || '学习资料'))].slice(0, 3)
                              return (
                                <button className="library-topic-row" type="button" key={topic} onClick={() => setLibraryTopic({ course, topic })}>
                                  <span className="library-topic-icon"><Icon name="book" size={17} /></span>
                                  <span><b>{topic}</b><small>{items.length} 份资料 · {typeNames.join('、')}</small></span>
                                  <Icon name="chevron" size={16} />
                                </button>
                              )
                            })}
                          </div>
                        </section>
                      )
                    })
                  ) : (
                    <div className="library-list">
                      {filteredLibraryItems.map(item => {
                        const option = artifactOptions.find(entry => entry.kind === item.kind)
                        return (
                          <button className="library-row" key={item.id} onClick={() => setLibraryPreviewId(item.id)}>
                            <span className="library-row-icon"><Icon name={libraryMode === 'trash' ? 'trash' : option?.icon || 'file'} size={17} /></span>
                            <span className="library-row-copy"><b>{item.title}</b><small>{libraryMode === 'trash' ? `${item.course} / ${item.topic}${item.deletedAt ? ` · ${formatLibraryDate(item.deletedAt)} 删除` : ''}` : `${item.course} / ${item.topic} · ${option?.label || '学习资料'}${item.version > 1 ? ` · v${item.version}` : ''}`}</small></span>
                            {libraryMode !== 'trash' && item.favorite && <span className="library-row-star" aria-label="已收藏"><Icon name="star" size={14} /></span>}
                            <Icon name="chevron" size={16} />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>

        {view !== 'library' && (
          <form className={`composer-wrap ${view === 'welcome' ? 'composer-welcome' : ''}`} onSubmit={submit}>
            {(attachment || selectedOption) && (
              <div className="context-tray">
                {attachment && (
                  <span className="context-chip">
                    <Icon name={attachment.type === 'image' ? 'image' : 'file'} size={15} />
                    <span><b>{attachment.name}</b><small>{attachment.status === 'reading' ? '解析中…' : `已解析 · ${attachment.size}`}</small></span>
                    <button type="button" aria-label="移除附件" onClick={() => setAttachment(null)}><Icon name="x" size={13} /></button>
                  </span>
                )}
                {selectedOption && (
                  <span className="context-chip recipe-chip">
                    <Icon name={selectedOption.icon} size={15} />
                    <span><b>生成 {selectedOption.label}</b><small>{selectedOption.description}</small></span>
                    <button type="button" aria-label="移除生成类型" onClick={() => setSelectedKind(null)}><Icon name="x" size={13} /></button>
                  </span>
                )}
              </div>
            )}

            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              disabled={sending}
              rows={1}
              placeholder={selectedOption ? `描述你想生成的${selectedOption.label}…` : attachment ? '告诉我如何处理这份资料…' : '输入你的学习目标或问题…'}
              aria-label="输入学习目标或问题"
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />

            {generateOpen && (
              <div className="generate-menu" role="menu" aria-label="选择生成资料类型">
                <div className="generate-menu-head"><b>常用生成</b><span>适用于任何问题或资料</span></div>
                <div className="generate-options">
                  {primaryArtifactOptions.map(item => (
                    <button key={item.kind} type="button" role="menuitem" onClick={() => chooseArtifact(item.kind)}>
                      <span><Icon name={item.icon} size={17} /></span>
                      <span><b>{item.label}</b><small>{item.format}</small></span>
                    </button>
                  ))}
                </div>
                <button className="generate-menu-more" type="button" onClick={() => openGeneratorCatalog()}>
                  <span><b>生成更多内容</b><small>按学习目的选择专业产物</small></span>
                  <Icon name="chevron" size={16} />
                </button>
              </div>
            )}

            <div className="composer-tools">
              <input id="photo-input" className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={event => handleFile(event, 'image')} />
              <label className="composer-tool" htmlFor="photo-input"><Icon name="image" size={17} /><span>拍题</span></label>

              <input id="file-input" className="visually-hidden" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,image/*" onChange={event => handleFile(event, 'file')} />
              <label className="composer-tool" htmlFor="file-input"><Icon name="paperclip" size={17} /><span>上传</span></label>

              <button className={recording ? 'composer-tool active' : 'composer-tool'} type="button" onClick={toggleRecording} aria-pressed={recording}>
                <Icon name="mic" size={17} /><span>{recording ? '结束' : '语音'}</span>
              </button>

              <button className={generateOpen || selectedKind ? 'composer-tool active' : 'composer-tool'} type="button" onClick={() => setGenerateOpen(current => !current)} aria-expanded={generateOpen}>
                <Icon name="spark" size={17} /><span>生成</span>
              </button>

              <button className="send-button" type="submit" aria-label={sending ? '正在回答' : '发送'} disabled={!canSend}><Icon name="arrow-up" size={19} /></button>
            </div>
          </form>
        )}
      </main>

      {generatorCatalogOpen && (
        <div className="sheet-layer">
          <button className="sheet-backdrop" aria-label="关闭生成内容面板" onClick={() => setGeneratorCatalogOpen(false)} />
          <aside className="generator-panel" role="dialog" aria-modal="true" aria-labelledby="generator-panel-title">
            <div className="sheet-head">
              <div><h2 id="generator-panel-title">生成更多内容</h2><p>先选择你想达到的学习目的。</p></div>
              <button className="icon-button" aria-label="关闭生成内容面板" onClick={() => setGeneratorCatalogOpen(false)}><Icon name="x" size={18} /></button>
            </div>

            <div className="generator-context">
              <span>当前依据</span>
              <b>{generatorContext}</b>
            </div>

            <div className="generator-search">
              <Icon name="search" size={16} />
              <input
                id="generator-search-input"
                aria-label="搜索生成内容"
                value={generatorSearch}
                onChange={event => setGeneratorSearch(event.target.value)}
                placeholder="描述需求，如“做一份考前复习资料”"
              />
              {generatorSearch && <button type="button" aria-label="清空搜索" onClick={() => setGeneratorSearch('')}><Icon name="x" size={14} /></button>}
            </div>

            <div className="generator-categories" role="tablist" aria-label="生成内容分类">
              {generationCategories.map(category => (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={!generatorSearch && generatorCategory === category.id}
                  className={!generatorSearch && generatorCategory === category.id ? 'active' : ''}
                  onClick={() => { setGeneratorCategory(category.id); setGeneratorSearch('') }}
                >
                  <b>{category.label}</b><small>{category.hint}</small>
                </button>
              ))}
            </div>

            <div className="generator-section-head">
              <b>{generatorSearch ? '搜索结果' : generationCategories.find(item => item.id === generatorCategory)?.label}</b>
              <span>{generatorResults.length} 种内容</span>
            </div>

            {generatorResults.length > 0 ? (
              <div className="generator-list">
                {generatorResults.map(item => (
                  <button key={item.kind} type="button" onClick={() => chooseFromCatalog(item.kind)}>
                    <span className="generator-list-icon"><Icon name={item.icon} size={17} /></span>
                    <span className="generator-list-copy"><b>{item.label}</b><small>{item.description}</small></span>
                    <span className="generator-format">{item.format}</span>
                    <Icon name="chevron" size={15} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="generator-empty"><Icon name="search" size={20} /><p>没有完全匹配的类型，可以换个关键词试试。</p></div>
            )}
          </aside>
        </div>
      )}

      {saveTarget && (
        <div className="sheet-layer">
          <button className="sheet-backdrop" aria-label="取消保存" onClick={closeSave} />
          <aside className="save-sheet" role="dialog" aria-modal="true" aria-labelledby="save-title">
            <div className="sheet-head">
              <div>
                <h2 id="save-title">{saveMode === 'edit' ? '整理资料' : '保存到资料库'}</h2>
                <p>{saveMode === 'edit' ? '名称和归属可以随时调整。' : '智能体已经根据当前学习内容推荐位置。'}</p>
              </div>
              <button className="icon-button" aria-label="取消保存" onClick={closeSave}><Icon name="x" size={18} /></button>
            </div>
            <label className="field-label" htmlFor="artifact-title">资料名称</label>
            <input id="artifact-title" className="text-field" value={saveTitle} onChange={event => { setSaveTitle(event.target.value); resetDuplicateDecision() }} />
            <div className="save-path-block">
              <div className="save-path-label">
                <span>{saveMode === 'edit' ? '当前位置' : '建议位置'}</span>
                <button type="button" onClick={() => setSaveLocationOpen(current => !current)}>{saveLocationOpen ? '收起' : '修改'}</button>
              </div>
              <div className="save-path-preview">
                <Icon name="book" size={16} /><b>{saveCourse || '未分类课程'}</b><Icon name="chevron" size={14} /><b>{saveTopic || '未分类主题'}</b>
              </div>
              {saveMode === 'save' && (
                <div className="save-path-context">
                  <span><Icon name="spark" size={13} />{
                    saveRecommendationSource === 'memory' ? '按你之前的整理习惯推荐'
                      : saveRecommendationSource === 'library' ? '匹配到资料库中的已有主题'
                        : saveRecommendationSource === 'learning_state' ? '根据当前课程和学习主题推荐'
                          : saveRecommendationSource === 'llm' ? '智能体根据资料内容推荐'
                            : '暂未识别明确归属，可以自行填写'
                  }</span>
                  {(saveCourse.trim() !== saveRecommendedCourse.trim() || saveTopic.trim() !== saveRecommendedTopic.trim()) && (
                    <b>将按你的选择保存</b>
                  )}
                </div>
              )}
              {saveLocationOpen && (
                <div className="save-path-fields">
                  <label>课程<input list="library-course-options" value={saveCourse} onChange={event => { setSaveCourse(event.target.value); resetDuplicateDecision() }} placeholder="选择或输入课程" /></label>
                  <label>主题<input list="library-topic-options" value={saveTopic} onChange={event => { setSaveTopic(event.target.value); resetDuplicateDecision() }} placeholder="选择或输入主题" /></label>
                  <datalist id="library-course-options">{libraryCourseOptions.map(course => <option key={course} value={course} />)}</datalist>
                  <datalist id="library-topic-options">{libraryTopicOptions.map(topic => <option key={topic} value={topic} />)}</datalist>
                </div>
              )}
            </div>
            {saveMode === 'save' && duplicateMatches.length > 0 && (
              <section className="duplicate-panel" aria-labelledby="duplicate-title">
                <div className="duplicate-head">
                  <span><Icon name="history" size={16} /></span>
                  <div><b id="duplicate-title">发现相似资料</b><small>同一课程和主题下已有相近内容，请选择保存方式。</small></div>
                </div>
                <div className="duplicate-existing">
                  <b>{duplicateMatches[0].title}</b>
                  <span>{duplicateMatches[0].course} / {duplicateMatches[0].topic} · 当前 v{duplicateMatches[0].version}</span>
                </div>
                <div className="duplicate-options" role="radiogroup" aria-label="选择重复资料的保存方式">
                  <button type="button" role="radio" aria-checked={duplicateStrategy === 'version'} onClick={() => setDuplicateStrategy('version')}>
                    <span><b>保存为新版本</b><small>保留旧内容，资料库只显示最新的 v{duplicateMatches[0].version + 1}</small></span><em>推荐</em>
                  </button>
                  <button type="button" role="radio" aria-checked={duplicateStrategy === 'update'} onClick={() => setDuplicateStrategy('update')}>
                    <span><b>更新原资料</b><small>用本次生成内容覆盖当前最新版</small></span>
                  </button>
                  <button type="button" role="radio" aria-checked={duplicateStrategy === 'separate'} onClick={() => setDuplicateStrategy('separate')}>
                    <span><b>单独保存</b><small>作为另一份独立资料保留</small></span>
                  </button>
                </div>
              </section>
            )}
            <div className="save-source"><Icon name="paperclip" size={15} /><span>来源</span><b>{saveTarget.source}</b></div>
            <div className="sheet-actions">
              <button type="button" onClick={closeSave}>取消</button>
              <button type="button" className="primary" onClick={() => void confirmSave()} disabled={!saveTitle.trim() || !saveCourse.trim() || !saveTopic.trim() || saveBusy}><Icon name="save" size={16} />{saveBusy ? (duplicateCheckComplete ? '保存中…' : '检查中…') : saveMode === 'edit' ? '保存调整' : duplicateMatches.length > 0 ? '按选择保存' : '确认保存'}</button>
            </div>
          </aside>
        </div>
      )}

      {deleteTarget && (
        <div className="confirm-layer">
          <button className="confirm-backdrop" aria-label="取消删除" onClick={() => !deleteBusy && setDeleteTarget(null)} />
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description">
            <span className="confirm-icon"><Icon name="trash" size={19} /></span>
            <h2 id="delete-dialog-title">{deleteMode === 'permanent' ? '永久删除这份资料？' : '将这份资料移到回收站？'}</h2>
            <p id="delete-dialog-description">{deleteMode === 'permanent'
              ? `“${deleteTarget.title}”删除后无法恢复。`
              : `“${deleteTarget.title}”会从资料库中移除，你仍可在回收站恢复。`}</p>
            <div className="confirm-actions">
              <button type="button" autoFocus disabled={deleteBusy} onClick={() => setDeleteTarget(null)}>取消</button>
              <button className="danger" type="button" disabled={deleteBusy} onClick={() => void confirmDeleteArtifact()}>{deleteBusy ? '处理中…' : deleteMode === 'permanent' ? '永久删除' : '移到回收站'}</button>
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="sheet-layer">
          <button className="sheet-backdrop" aria-label="关闭外观设置" onClick={() => setSettingsOpen(false)} />
          <aside className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="appearance-title">
            <div className="sheet-head">
              <div><h2 id="appearance-title">外观与主题</h2><p>选择更适合当前学习状态的桌面氛围。</p></div>
              <button className="icon-button" aria-label="关闭外观设置" onClick={() => setSettingsOpen(false)}><Icon name="x" size={18} /></button>
            </div>
            <div className="theme-options" role="radiogroup" aria-label="选择界面主题">
              {themes.map(item => (
                <button key={item.id} type="button" role="radio" aria-checked={theme === item.id} className={theme === item.id ? 'theme-option selected' : 'theme-option'} onClick={() => setTheme(item.id)}>
                  <span className="theme-preview" data-preview={item.id} />
                  <span><b>{item.label}</b><small>{item.description}</small></span>
                  {theme === item.id && <Icon name="check" size={15} />}
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      {notice && (
        <div className="feedback-toast" role="status" aria-live="polite">
          <Icon name="check" size={15} />
          <span>{notice}</span>
          {notice === '已移到回收站，可撤销' && undoTrashId && (
            <button className="toast-action" type="button" onClick={() => void undoLastTrash()}>撤销</button>
          )}
          <button className="toast-close" type="button" aria-label="关闭提示" onClick={() => { setNotice(''); setUndoTrashId(null) }}><Icon name="x" size={13} /></button>
        </div>
      )}
    </div>
  )
}

export default App
