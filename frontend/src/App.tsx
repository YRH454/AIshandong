import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, FormEvent } from 'react'
import {
  Archive, ArrowLeft, ArrowUp, AudioLines, BookOpen, Check, ChevronRight, CirclePlay, ClipboardCheck,
  Code2, FileDown, FileQuestion, FileText, FolderOpen, History, Image, LayoutTemplate, Library, Map as MapIcon,
  Languages, Menu, Mic, NotebookTabs, Palette, Paperclip, PenLine, Presentation, RotateCcw, Save, Search,
  Ellipsis, Pin, Share2, SlidersHorizontal, Sparkles, Star, Tags, Trash2, Trees, Video, Waves, X, ZoomIn,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mascot from './assets/xuejing-slime-logo.png'
import { EditableKnowledgeMap } from './components/EditableKnowledgeMap'
import {
  createImageAnalysisArtifact,
  collaborateKnowledgeMap,
  deleteTutorSession,
  favoriteLearningArtifact,
  findLearningArtifactDuplicates,
  generateLearningDocument,
  generateKnowledgeMap,
  generatePracticeSet,
  getKnowledgeMapProgress,
  getLearningArtifacts,
  getLearningArtifactVersions,
  getLibraryTopicReviews,
  getPracticeForArtifact,
  getTutorHistory,
  getTutorSessions,
  permanentlyDeleteLearningArtifact,
  readTutorStream,
  restoreLearningArtifact,
  restoreLearningArtifactVersion,
  saveLearningArtifact,
  submitPracticeAttempt,
  streamTutorChat,
  trashLearningArtifact,
  updateKnowledgeMap,
  updateKnowledgeMapNodeProgress,
  updateLearningArtifact,
  updateTutorSession,
  waitForGenerationJob,
} from './services/api'
import type {
  ImageStudyAnalysis, KnowledgeMapCollaboration, KnowledgeMapCollaborationSuggestion, KnowledgeMapNodeStatus, KnowledgeMapProgress, LearningArtifactRecord, LearningState, LibraryTopicReview, PracticeAttemptResult, PracticeAttemptSummary,
  PracticeSetRecord, TutorMessage, TutorSessionSummary,
} from './services/api'
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

type View = 'welcome' | 'chat' | 'library' | 'map-workspace'
type MapWorkspaceReturnView = Exclude<View, 'map-workspace'>
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
type InterfaceStyleId =
  | 'minimal' | 'study' | 'night' | 'editorial' | 'brutalist' | 'glass' | 'terminal'
  | 'swiss' | 'notebook' | 'pixel' | 'gallery' | 'ink' | 'candy' | 'blueprint'
type InterfaceLanguage = 'zh-CN' | 'en'
type InterfaceScale = 90 | 100 | 110 | 120 | 130
type SettingsView = 'menu' | 'language' | 'theme' | 'scale'
type SessionMenuMode = 'menu' | 'rename' | 'delete'

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
  id: string
  name: string
  size: string
  type: 'image' | 'file'
  status: 'reading' | 'ready' | 'error'
  dataUrl?: string
  error?: string
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
  topicMastery: number
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
  sourceMapArtifactId?: number
}

type ChatTurn = {
  id: string
  prompt: string
  attachment?: string
  images?: string[]
  imageAnalysis?: ImageStudyAnalysis
  imageAnalysisLoading?: boolean
  loadingPhase?: 'image_analysis' | 'retrieving' | 'answering'
  response: string
  artifacts: Artifact[]
  loading?: boolean
  error?: boolean
}

type KnowledgeMapNode = {
  id: string
  label: string
  role: 'core' | 'branch' | 'detail'
  kind?: 'core' | 'foundation' | 'principle' | 'process' | 'example' | 'pitfall'
  group?: string
  order?: number
  detail: string
  example?: string
  mistake?: string
  visual?: {
    kind?: 'definition' | 'sequence' | 'code' | 'input_output' | 'warning' | 'formula' | 'comparison' | 'stack'
    headline?: string
    items?: string[]
    code?: string
    input?: string
    output?: string
    formula?: string
    before?: string
    after?: string
  }
  position?: { x: number; y: number }
}

type KnowledgeMapData = {
  schema_version: number
  layout: 'mindmap' | 'flow'
  map_type?: 'concept_tree' | 'process_flow'
  groups?: string[]
  nodes: KnowledgeMapNode[]
  edges: Array<{ from: string; to: string; label?: string }>
  learning_path: string[]
}

type KnowledgeMapProgressState = Pick<KnowledgeMapProgress, 'progress' | 'summary'>

type DocumentPurpose = 'review' | 'preview' | 'exam'
type DocumentDepth = 'concise' | 'standard' | 'deep'
type DocumentStyle = 'plain' | 'notes' | 'exam'
type DocumentSetup = {
  turnId: string
  purpose: DocumentPurpose
  depth: DocumentDepth
  style: DocumentStyle
}

type PracticeRun = {
  artifact: Artifact
  practice: PracticeSetRecord
  attempts: PracticeAttemptSummary[]
  answers: Record<string, string>
  activeIndex: number
  result: PracticeAttemptResult | null
  topicMastery: number | null
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
  settings: SlidersHorizontal,
  spark: Sparkles,
  star: Star,
  tags: Tags,
  trash: Trash2,
  trees: Trees,
  video: Video,
  waves: Waves,
  x: X,
}

const interfaceStyles: Array<{ id: InterfaceStyleId; label: string; labelEn: string; description: string; descriptionEn: string; icon: IconName }> = [
  { id: 'minimal', label: '素白', labelEn: 'Minimal', description: '默认 · 白底黑字，内容优先', descriptionEn: 'Default · white canvas, black type', icon: 'spark' },
  { id: 'study', label: '安静书桌', labelEn: 'Study desk', description: '低饱和书桌与柔和分组', descriptionEn: 'Muted desk tones and soft grouping', icon: 'trees' },
  { id: 'night', label: '夜读', labelEn: 'Night reading', description: '暗色阅读与低干扰层级', descriptionEn: 'Dark reading with low-distraction hierarchy', icon: 'book' },
  { id: 'editorial', label: '编辑纸页', labelEn: 'Editorial', description: '杂志正文与宽阔阅读栏', descriptionEn: 'Magazine type and a generous reading column', icon: 'notebook' },
  { id: 'brutalist', label: '硬朗印刷', labelEn: 'Brutalist print', description: '高对比边框与实体按键', descriptionEn: 'High-contrast rules and solid controls', icon: 'layout' },
  { id: 'glass', label: '极光玻璃', labelEn: 'Aurora glass', description: '透明材质和漂浮层次', descriptionEn: 'Transparent material and floating layers', icon: 'waves' },
  { id: 'terminal', label: '终端学习', labelEn: 'Terminal study', description: '命令行密度与荧光提示', descriptionEn: 'Command-line density with luminous cues', icon: 'code' },
  { id: 'swiss', label: '瑞士海报', labelEn: 'Swiss poster', description: '网格、色块与强字重', descriptionEn: 'Grid, color blocks, and decisive type', icon: 'presentation' },
  { id: 'notebook', label: '校园笔记', labelEn: 'Campus notebook', description: '横线纸、页边与蓝墨水', descriptionEn: 'Ruled paper, margins, and blue ink', icon: 'pen' },
  { id: 'pixel', label: '像素课堂', labelEn: 'Pixel classroom', description: '复古显示器与像素化控件', descriptionEn: 'Retro display and pixel controls', icon: 'image' },
  { id: 'gallery', label: '空白画廊', labelEn: 'Blank gallery', description: '超大留白，内容如展签', descriptionEn: 'Generous whitespace and exhibition labels', icon: 'library' },
  { id: 'ink', label: '墨韵', labelEn: 'Ink', description: '宣纸、宋体和克制墨色', descriptionEn: 'Rice paper, Song type, and restrained ink', icon: 'book' },
  { id: 'candy', label: '千禧糖果', labelEn: 'Y2K candy', description: '圆润、明快的塑料质感', descriptionEn: 'Rounded, bright plastic material', icon: 'spark' },
  { id: 'blueprint', label: '学习蓝图', labelEn: 'Learning blueprint', description: '工程网格与翻转侧栏', descriptionEn: 'Engineering grid and inverted sidebar', icon: 'map' },
]

const interfaceScales: Array<{ value: InterfaceScale; label: string; description: string }> = [
  { value: 90, label: '90%', description: '紧凑' },
  { value: 100, label: '100%', description: '默认' },
  { value: 110, label: '110%', description: '舒适' },
  { value: 120, label: '120%', description: '更大' },
  { value: 130, label: '130%', description: '最大' },
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

function parseKnowledgeMap(content?: string): KnowledgeMapData | null {
  if (!content) return null
  try {
    const raw = JSON.parse(content) as Partial<KnowledgeMapData>
    if (!Array.isArray(raw.nodes) || raw.nodes.length < 3) return null
    const nodes = raw.nodes
      .filter((node): node is KnowledgeMapNode => Boolean(node?.id && node?.label))
      .slice(0, 10)
      .map((node, index) => ({
        id: String(node.id),
        label: String(node.label).slice(0, 24),
        role: (node.role === 'core' || node.role === 'detail' ? node.role : index === 0 ? 'core' : 'branch') as KnowledgeMapNode['role'],
        kind: ['core', 'foundation', 'principle', 'process', 'example', 'pitfall'].includes(String(node.kind))
          ? String(node.kind) as NonNullable<KnowledgeMapNode['kind']>
          : undefined,
        group: node.group ? String(node.group).slice(0, 20) : undefined,
        order: Number.isFinite(Number(node.order)) ? Math.max(1, Math.min(18, Number(node.order))) : undefined,
        detail: String(node.detail || ''),
        example: node.example ? String(node.example) : '',
        mistake: node.mistake ? String(node.mistake) : '',
        visual: node.visual && typeof node.visual === 'object'
          ? {
              kind: ['definition', 'sequence', 'code', 'input_output', 'warning', 'formula', 'comparison', 'stack'].includes(String(node.visual.kind))
                ? String(node.visual.kind) as NonNullable<NonNullable<KnowledgeMapNode['visual']>['kind']>
                : undefined,
              headline: node.visual.headline ? String(node.visual.headline).slice(0, 72) : '',
              items: Array.isArray(node.visual.items) ? node.visual.items.map(String).slice(0, 3) : [],
              code: node.visual.code ? String(node.visual.code).slice(0, 120) : '',
              input: node.visual.input ? String(node.visual.input).slice(0, 60) : '',
              output: node.visual.output ? String(node.visual.output).slice(0, 60) : '',
              formula: node.visual.formula ? String(node.visual.formula).slice(0, 120) : '',
              before: node.visual.before ? String(node.visual.before).slice(0, 72) : '',
              after: node.visual.after ? String(node.visual.after).slice(0, 72) : '',
            }
          : undefined,
        position: node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number'
          ? { x: node.position.x, y: node.position.y }
          : undefined,
      }))
    const nodeIds = new Set(nodes.map(node => node.id))
    const edges = Array.isArray(raw.edges) ? raw.edges
      .filter(edge => edge && nodeIds.has(String(edge.from)) && nodeIds.has(String(edge.to)) && edge.from !== edge.to)
      .slice(0, 14)
      .map(edge => ({ from: String(edge.from), to: String(edge.to), label: edge.label ? String(edge.label).slice(0, 24) : '' })) : []
    const learningPath = Array.isArray(raw.learning_path)
      ? raw.learning_path.map(String).filter(id => nodeIds.has(id)).slice(0, 6)
      : []
    return {
      schema_version: Number(raw.schema_version) || 1,
      layout: raw.layout === 'flow' ? 'flow' : 'mindmap',
      map_type: raw.map_type === 'process_flow' ? 'process_flow' : 'concept_tree',
      groups: Array.isArray(raw.groups) ? raw.groups.map(String).slice(0, 6) : undefined,
      nodes,
      edges: edges.length ? edges : nodes.slice(1).map(node => ({ from: nodes[0].id, to: node.id, label: '' })),
      learning_path: learningPath.length ? learningPath : nodes.map(node => node.id),
    }
  } catch {
    return null
  }
}

function mapNodeStatus(progress: Record<string, Exclude<KnowledgeMapNodeStatus, 'new'>>, nodeId: string): KnowledgeMapNodeStatus {
  return progress[nodeId] || 'new'
}

function summarizeMapProgress(
  data: KnowledgeMapData,
  progress: Record<string, Exclude<KnowledgeMapNodeStatus, 'new'>>,
): KnowledgeMapProgressState['summary'] {
  const mastered = data.nodes.filter(node => progress[node.id] === 'mastered').length
  const review = data.nodes.filter(node => progress[node.id] === 'review').length
  return { total: data.nodes.length, mastered, review, untouched: Math.max(0, data.nodes.length - mastered - review) }
}

function mapProgressLabel(data: KnowledgeMapData, progress?: KnowledgeMapProgressState, language: InterfaceLanguage = 'zh-CN'): string {
  const summary = progress?.summary || summarizeMapProgress(data, {})
  if (!summary.total) return ''
  return language === 'en'
    ? `Understood ${summary.mastered}/${summary.total}${summary.review ? ` · Review ${summary.review}` : ''}`
    : `已理解 ${summary.mastered}/${summary.total}${summary.review ? ` · 待复习 ${summary.review}` : ''}`
}

function splitMapLabel(label: string) {
  if (label.length <= 8) return [label]
  return [label.slice(0, 8), label.slice(8, 16)]
}

function KnowledgeMap({
  data,
  reader = false,
  language = 'zh-CN',
  progress,
  progressLoading = false,
  progressSavingNodeId,
  onStatusChange,
  onReviewPractice,
  reviewPracticeGenerating = false,
}: {
  data: KnowledgeMapData
  reader?: boolean
  language?: InterfaceLanguage
  progress?: KnowledgeMapProgressState
  progressLoading?: boolean
  progressSavingNodeId?: string | null
  onStatusChange?: (nodeId: string, status: KnowledgeMapNodeStatus) => void
  onReviewPractice?: () => void
  reviewPracticeGenerating?: boolean
}) {
  const core = data.nodes.find(node => node.role === 'core') || data.nodes[0]
  const [selectedId, setSelectedId] = useState(data.learning_path[0] || core.id)
  const [reviewMode, setReviewMode] = useState(false)
  const arrowId = `knowledge-map-arrow-${useId().replace(/:/g, '')}`
  const copy = language === 'en'
    ? {
        map: 'Interactive knowledge map', view: 'View', path: 'Recommended path',
        core: 'Core concept', branch: 'Related concept', detail: 'Supporting detail',
        fallback: 'Choose another node to see how it connects to this topic.', example: 'Example:', mistake: 'Common pitfall:',
        understood: 'Understood', toReview: 'To review', startReview: 'Review in order', reviewMode: 'Review mode',
        next: 'Next node', finish: 'Finish review', practice: 'Practice review nodes', progress: 'Progress', loading: 'Loading progress…', generating: 'Generating…',
      }
    : {
        map: '交互式知识图解', view: '查看', path: '推荐顺序',
        core: '核心概念', branch: '关联概念', detail: '补充细节',
        fallback: '点击其他节点，查看这一部分与当前主题的关系。', example: '例子：', mistake: '易错：',
        understood: '我已理解', toReview: '标为待复习', startReview: '按顺序复习', reviewMode: '图内复习',
        next: '下一个节点', finish: '完成本轮复习', practice: '围绕待复习节点练习', progress: '学习进度', loading: '正在载入进度…', generating: '生成中…',
      }
  const selectedNode = data.nodes.find(node => node.id === selectedId) || core
  const nodeProgress = progress?.progress || {}
  const summary = progress?.summary || summarizeMapProgress(data, nodeProgress)
  const reviewPath = data.learning_path.filter(id => mapNodeStatus(nodeProgress, id) === 'review')
  const guidedPath = reviewPath.length > 0 ? reviewPath : data.learning_path
  const guidedIndex = Math.max(0, guidedPath.indexOf(selectedNode.id))
  const width = data.layout === 'flow' ? Math.max(620, data.nodes.length * 126 + 50) : 640
  const branchCount = Math.ceil((data.nodes.length - 1) / 2)
  const height = data.layout === 'flow' ? 220 : Math.max(286, branchCount * 82 + 82)
  const positions = new Map<string, { x: number; y: number }>()
  if (data.layout === 'flow') {
    const gap = (width - 96) / Math.max(1, data.nodes.length - 1)
    data.nodes.forEach((node, index) => positions.set(node.id, { x: 48 + gap * index, y: 110 }))
  } else {
    positions.set(core.id, { x: 320, y: height / 2 })
    let left = 0
    let right = 0
    data.nodes.filter(node => node.id !== core.id).forEach((node, index) => {
      const onLeft = index % 2 === 0
      const slot = onLeft ? left++ : right++
      positions.set(node.id, {
        x: onLeft ? 124 : 516,
        y: 48 + slot * 82 + (onLeft ? 10 : 0),
      })
    })
  }
  const selectNode = (id: string) => setSelectedId(id)
  const beginReview = () => {
    setReviewMode(true)
    setSelectedId(guidedPath[0] || core.id)
  }
  const advanceReview = () => {
    const currentIndex = guidedPath.indexOf(selectedNode.id)
    if (currentIndex >= 0 && currentIndex < guidedPath.length - 1) {
      setSelectedId(guidedPath[currentIndex + 1])
      return
    }
    setReviewMode(false)
  }

  return (
    <section className={`knowledge-map ${reader ? 'knowledge-map-reader' : ''}`} aria-label={copy.map}>
      <div className="knowledge-map-overview">
        <span>{copy.progress}</span>
        {progressLoading
          ? <small>{copy.loading}</small>
          : <div><b>{summary.mastered}/{summary.total}</b><small>{copy.understood}</small>{summary.review > 0 && <em>{summary.review} {copy.toReview}</em>}</div>}
        <div className="knowledge-map-overview-actions">
          {onStatusChange && <button type="button" onClick={beginReview}>{reviewMode ? copy.reviewMode : copy.startReview}</button>}
          {onReviewPractice && summary.review > 0 && <button type="button" disabled={reviewPracticeGenerating} onClick={onReviewPractice}>{reviewPracticeGenerating ? copy.generating : copy.practice}</button>}
        </div>
      </div>
      <div className="knowledge-map-canvas" style={{ '--map-width': `${width}px` } as CSSProperties}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.map}>
          <defs>
            <marker id={arrowId} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 8 4 L 0 8 z" className="knowledge-map-arrow" />
            </marker>
          </defs>
          {data.edges.map((edge, index) => {
            const from = positions.get(edge.from)
            const to = positions.get(edge.to)
            if (!from || !to) return null
            const control = data.layout === 'mindmap' ? (from.x + to.x) / 2 : undefined
            return (
              <g className="knowledge-map-edge" key={`${edge.from}-${edge.to}-${index}`}>
                {data.layout === 'mindmap'
                  ? <path d={`M ${from.x} ${from.y} C ${control} ${from.y}, ${control} ${to.y}, ${to.x} ${to.y}`} markerEnd={`url(#${arrowId})`} />
                  : <line x1={from.x + 42} y1={from.y} x2={to.x - 42} y2={to.y} markerEnd={`url(#${arrowId})`} />}
                {edge.label && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 6}>{edge.label}</text>}
              </g>
            )
          })}
          {data.nodes.map(node => {
            const point = positions.get(node.id)
            if (!point) return null
            const active = selectedNode.id === node.id
            const status = mapNodeStatus(nodeProgress, node.id)
            const lines = splitMapLabel(node.label)
            return (
              <g
                className={`knowledge-map-node role-${node.role} status-${status} ${active ? 'is-active' : ''}`}
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`${copy.view} ${node.label}`}
                onClick={() => selectNode(node.id)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    selectNode(node.id)
                  }
                }}
              >
                <rect x={point.x - 47} y={point.y - 27} width="94" height="54" rx="9" />
                {status !== 'new' && <circle className="knowledge-map-node-status" cx={point.x + 36} cy={point.y - 18} r="3.5" />}
                <text x={point.x} y={point.y - (lines.length - 1) * 7} textAnchor="middle">
                  {lines.map((line, index) => <tspan x={point.x} dy={index === 0 ? 0 : 14} key={`${node.id}-${line}`}>{line}</tspan>)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="knowledge-map-path" aria-label={copy.path}>
        <span>{copy.path}</span>
        {data.learning_path.map((id, index) => {
          const node = data.nodes.find(item => item.id === id)
          return node && <button type="button" className={selectedNode.id === id ? 'active' : ''} key={id} onClick={() => selectNode(id)}>{index + 1}. {node.label}</button>
        })}
      </div>
      <aside className="knowledge-map-detail" aria-live="polite">
        <div><b>{selectedNode.label}</b><span>{selectedNode.role === 'core' ? copy.core : selectedNode.role === 'detail' ? copy.detail : copy.branch}</span></div>
        <p>{selectedNode.detail || copy.fallback}</p>
        {selectedNode.example && <small><b>{copy.example}</b>{selectedNode.example}</small>}
        {selectedNode.mistake && <small className="map-mistake"><b>{copy.mistake}</b>{selectedNode.mistake}</small>}
        {onStatusChange && (
          <div className="knowledge-map-status-actions" role="group" aria-label={`${selectedNode.label} ${copy.progress}`}>
            <button
              type="button"
              className={mapNodeStatus(nodeProgress, selectedNode.id) === 'review' ? 'active review' : ''}
              disabled={progressSavingNodeId === selectedNode.id}
              onClick={() => onStatusChange(selectedNode.id, 'review')}
            >{copy.toReview}</button>
            <button
              type="button"
              className={mapNodeStatus(nodeProgress, selectedNode.id) === 'mastered' ? 'active mastered' : ''}
              disabled={progressSavingNodeId === selectedNode.id}
              onClick={() => onStatusChange(selectedNode.id, 'mastered')}
            ><Check size={13} />{copy.understood}</button>
          </div>
        )}
        {reviewMode && (
          <div className="knowledge-map-review-step">
            <span>{copy.reviewMode} · {Math.min(guidedIndex + 1, guidedPath.length)}/{guidedPath.length}</span>
            <button type="button" onClick={advanceReview}>{guidedIndex < guidedPath.length - 1 ? copy.next : copy.finish}<ChevronRight size={14} /></button>
          </div>
        )}
      </aside>
    </section>
  )
}

void KnowledgeMap

const maxImageUploadSize = 8 * 1024 * 1024

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('图片读取失败'))
    reader.onerror = () => reject(new Error('图片读取失败，请重新选择图片'))
    reader.readAsDataURL(file)
  })
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
    kind: record.kind as ArtifactKind,
    title: record.title,
    summary: record.summary,
    details: record.highlights,
    content: record.content,
    source: source.length > 72 ? `${source.slice(0, 72)}…` : source,
    course: record.course_name || '未分类课程',
    topic: record.topic_name || '未分类主题',
    topicMastery: record.topic_mastery || 0,
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
    sourceMapArtifactId: record.source_map_artifact_id || undefined,
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
        attachment: message.images?.length ? '已上传图片' : undefined,
        images: message.images,
        imageAnalysis: message.image_analysis,
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
  const [sessionMenuId, setSessionMenuId] = useState<number | null>(null)
  const [sessionMenuMode, setSessionMenuMode] = useState<SessionMenuMode>('menu')
  const [sessionRenameDraft, setSessionRenameDraft] = useState('')
  const [sessionActionBusy, setSessionActionBusy] = useState(false)
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
  const [settingsView, setSettingsView] = useState<SettingsView>('menu')
  const [documentSetup, setDocumentSetup] = useState<DocumentSetup | null>(null)
  const [documentGenerating, setDocumentGenerating] = useState(false)
  const [knowledgeMapGeneratingTurnId, setKnowledgeMapGeneratingTurnId] = useState<string | null>(null)
  const [pendingMapGenerationTurnId, setPendingMapGenerationTurnId] = useState<string | null>(null)
  const knowledgeMapGenerationLocked = useRef(false)
  const knowledgeMapRunnerRef = useRef<(turnId: string) => void>(() => {})
  const [mapProgressByArtifactId, setMapProgressByArtifactId] = useState<Record<string, KnowledgeMapProgressState>>({})
  const mapProgressFetches = useRef(new Set<string>())
  const [mapProgressSavingKey, setMapProgressSavingKey] = useState<string | null>(null)
  const [mapEditingArtifactId, setMapEditingArtifactId] = useState<string | null>(null)
  const [mapCollaborations, setMapCollaborations] = useState<Record<string, KnowledgeMapCollaboration>>({})
  const [mapCollaborationLoadingArtifactId, setMapCollaborationLoadingArtifactId] = useState<string | null>(null)
  const [mapReviewPracticeGeneratingArtifactId, setMapReviewPracticeGeneratingArtifactId] = useState<string | null>(null)
  const [mapWorkspaceArtifactId, setMapWorkspaceArtifactId] = useState<string | null>(null)
  const [mapWorkspaceReturnView, setMapWorkspaceReturnView] = useState<MapWorkspaceReturnView>('chat')
  const [practiceSetupTurnId, setPracticeSetupTurnId] = useState<string | null>(null)
  const [practiceGenerating, setPracticeGenerating] = useState(false)
  const practiceGenerationLocked = useRef(false)
  const [practiceLoadingArtifactId, setPracticeLoadingArtifactId] = useState<string | null>(null)
  const [practiceSubmitting, setPracticeSubmitting] = useState(false)
  const [practiceRun, setPracticeRun] = useState<PracticeRun | null>(null)
  const [imageAnalysisSavingTurnId, setImageAnalysisSavingTurnId] = useState<string | null>(null)
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
  const [collapsedLibraryCourses, setCollapsedLibraryCourses] = useState<Set<string>>(() => new Set())
  const [expandedLibraryTopics, setExpandedLibraryTopics] = useState<Set<string>>(() => new Set())
  const [topicReviews, setTopicReviews] = useState<Record<string, LibraryTopicReview>>({})
  const [topicPracticeGeneratingKey, setTopicPracticeGeneratingKey] = useState<string | null>(null)
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
  const [interfaceStyle, setInterfaceStyle] = useState<InterfaceStyleId>(() => {
    const saved = localStorage.getItem('rhyme-interface-style')
    return interfaceStyles.some(item => item.id === saved) ? saved as InterfaceStyleId : 'minimal'
  })
  const [interfaceLanguage, setInterfaceLanguage] = useState<InterfaceLanguage>(() => (
    localStorage.getItem('rhyme-interface-language') === 'en' ? 'en' : 'zh-CN'
  ))
  const [interfaceScale, setInterfaceScale] = useState<InterfaceScale>(() => {
    const saved = Number(localStorage.getItem('rhyme-interface-scale'))
    return interfaceScales.some(item => item.value === saved) ? saved as InterfaceScale : 100
  })

  useEffect(() => {
    localStorage.setItem('rhyme-interface-style', interfaceStyle)
  }, [interfaceStyle])

  useEffect(() => {
    localStorage.setItem('rhyme-interface-language', interfaceLanguage)
    document.documentElement.lang = interfaceLanguage
  }, [interfaceLanguage])

  useEffect(() => {
    localStorage.setItem('rhyme-interface-scale', String(interfaceScale))
  }, [interfaceScale])

  useEffect(() => {
    if (sessionMenuId === null) return
    const closeWhenOutside = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-session-menu-root]')) return
      setSessionMenuId(null)
      setSessionMenuMode('menu')
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setSessionMenuId(null)
      setSessionMenuMode('menu')
    }
    document.addEventListener('pointerdown', closeWhenOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeWhenOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [sessionMenuId])

  useEffect(() => {
    knowledgeMapRunnerRef.current = runKnowledgeMapGeneration
  })

  useEffect(() => {
    if (!practiceSetupTurnId) return
    const frameId = window.requestAnimationFrame(() => {
      document.getElementById(`practice-setup-${practiceSetupTurnId}`)?.scrollIntoView({
        block: 'nearest',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [practiceSetupTurnId])

  useEffect(() => {
    if (!pendingMapGenerationTurnId || !sessionId || !turns.some(turn => turn.id === pendingMapGenerationTurnId)) return
    setPendingMapGenerationTurnId(null)
    knowledgeMapRunnerRef.current(pendingMapGenerationTurnId)
  }, [pendingMapGenerationTurnId, sessionId, turns])

  useEffect(() => {
    setVersionHistoryOpen(false)
    setVersionItems([])
    setVersionPreview(null)
  }, [libraryPreviewId])

  useEffect(() => {
    let cancelled = false
    async function loadTopicReviews() {
      if (libraryItems.length === 0) {
        setTopicReviews({})
        return
      }
      await refreshTopicReviews()
      if (cancelled) return
    }
    void loadTopicReviews()
    return () => { cancelled = true }
  }, [libraryItems])

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
  const canSend = Boolean(input.trim() || attachment?.status === 'ready')
    && attachment?.status !== 'reading' && !sending
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
  const readerMapData = readerArtifact?.kind === 'map'
    ? parseKnowledgeMap(readerArtifact.content)
    : null
  const mapArtifacts = useMemo(() => {
    const candidates = [
      ...turns.flatMap(turn => turn.artifacts),
      ...libraryItems,
      ...trashedItems,
      ...(readerArtifact ? [readerArtifact] : []),
    ].filter((artifact): artifact is Artifact => (
      artifact.kind === 'map'
      && (Boolean(artifact.backendId) || artifact.status === 'generating' || artifact.id === mapWorkspaceArtifactId)
    ))
    return [...new Map(candidates.map(artifact => [artifact.id, artifact])).values()]
  }, [libraryItems, mapWorkspaceArtifactId, readerArtifact, trashedItems, turns])
  const mapWorkspaceArtifact = mapWorkspaceArtifactId
    ? mapArtifacts.find(artifact => artifact.id === mapWorkspaceArtifactId) || null
    : null
  const mapWorkspaceData = mapWorkspaceArtifact ? parseKnowledgeMap(mapWorkspaceArtifact.content) : null
  const mapWorkspaceProgress = mapWorkspaceArtifact ? mapProgressByArtifactId[mapWorkspaceArtifact.id] : undefined
  const mapWorkspaceSavingNodeId = mapWorkspaceArtifact && mapProgressSavingKey?.startsWith(`${mapWorkspaceArtifact.id}:`)
    ? mapProgressSavingKey.slice(mapWorkspaceArtifact.id.length + 1)
    : null
  const readerMapProgress = readerArtifact ? mapProgressByArtifactId[readerArtifact.id] : undefined
  const readerMapSavingNodeId = readerArtifact && mapProgressSavingKey?.startsWith(`${readerArtifact.id}:`)
    ? mapProgressSavingKey.slice(readerArtifact.id.length + 1)
    : null

  useEffect(() => {
    let cancelled = false
    mapArtifacts.forEach(artifact => {
      if (!artifact.backendId || mapProgressByArtifactId[artifact.id] || mapProgressFetches.current.has(artifact.id)) return
      mapProgressFetches.current.add(artifact.id)
      void getKnowledgeMapProgress(artifact.backendId, LOCAL_USER_ID)
        .then(progress => {
          if (!cancelled) setMapProgressByArtifactId(current => ({ ...current, [artifact.id]: progress }))
        })
        .catch(() => undefined)
        .finally(() => mapProgressFetches.current.delete(artifact.id))
    })
    return () => { cancelled = true }
  }, [mapArtifacts, mapProgressByArtifactId])
  const libraryTopicItems = libraryTopic
    ? filteredLibraryItems.filter(item => item.course === libraryTopic.course && item.topic === libraryTopic.topic)
    : []
  const libraryTopicMastery = libraryTopicItems[0]?.topicMastery || 0
  const libraryTopicReview = libraryTopic ? topicReviews[folderTopicKey(libraryTopic.course, libraryTopic.topic)] : undefined
  const libraryTopicDisplayMastery = libraryTopicReview?.mastery || libraryTopicMastery
  const activePracticeQuestion = practiceRun?.practice.questions[practiceRun.activeIndex] || null
  const practiceAnsweredCount = practiceRun
    ? practiceRun.practice.questions.filter(question => practiceRun.answers[question.id]?.trim()).length
    : 0
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
  const t = (chinese: string, english: string) => interfaceLanguage === 'en' ? english : chinese
  const appFrameStyle = { '--ui-scale': interfaceScale / 100 } as CSSProperties
  const activeInterfaceStyle = interfaceStyles.find(item => item.id === interfaceStyle) || interfaceStyles[0]
  const activeInterfaceScale = interfaceScales.find(item => item.value === interfaceScale) || interfaceScales[1]
  const artifactLabel = (kind: ArtifactKind, chinese: string) => t(chinese, ({
    notes: 'Learning document',
    practice: 'Practice quiz',
    map: 'Knowledge map',
    interactive: 'Interactive explanation',
    video: 'Video lesson',
  } as Partial<Record<ArtifactKind, string>>)[kind] || chinese)

  function openMapWorkspace(artifact: Artifact, returnView: MapWorkspaceReturnView) {
    setMapWorkspaceArtifactId(artifact.id)
    setMapWorkspaceReturnView(returnView)
    setExpandedArtifactId(null)
    setView('map-workspace')
  }

  function closeMapWorkspace() {
    setView(mapWorkspaceReturnView)
  }

  function openSettings() {
    setSettingsView('menu')
    setSettingsOpen(true)
  }

  function closeSettings() {
    setSettingsOpen(false)
    setSettingsView('menu')
  }

  function folderTopicKey(course: string, topic: string) {
    return JSON.stringify([course, topic])
  }

  function toggleLibraryCourse(course: string) {
    setCollapsedLibraryCourses(current => {
      const next = new Set(current)
      if (next.has(course)) next.delete(course)
      else next.add(course)
      return next
    })
  }

  function toggleLibraryTopic(course: string, topic: string) {
    const key = folderTopicKey(course, topic)
    setExpandedLibraryTopics(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function refreshTopicReviews() {
    try {
      const data = await getLibraryTopicReviews(LOCAL_USER_ID)
      setTopicReviews(Object.fromEntries(data.reviews.map(review => [
        folderTopicKey(review.course_name, review.topic_name),
        review,
      ])))
    } catch {
      setTopicReviews({})
    }
  }

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
    setPendingMapGenerationTurnId(null)
    setPracticeSetupTurnId(null)
    setPracticeRun(null)
    setExpandedArtifactId(null)
    setSessionMenuId(null)
    setSessionMenuMode('menu')
    setSidebarOpen(false)
  }

  async function openSession(targetSessionId: number) {
    if (sending && targetSessionId !== sessionId) {
      setNotice('请等待当前回答完成后再切换对话。')
      return
    }
    setHistoryLoading(true)
    setSessionMenuId(null)
    setSessionMenuMode('menu')
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
      setPendingMapGenerationTurnId(null)
      setPracticeSetupTurnId(null)
      setPracticeRun(null)
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

  function closeSessionMenu() {
    setSessionMenuId(null)
    setSessionMenuMode('menu')
    setSessionRenameDraft('')
  }

  function openSessionMenu(item: TutorSessionSummary) {
    if (sending && sessionId === item.id) {
      setNotice('请等待当前回答完成后再操作这条对话。')
      return
    }
    setSessionMenuId(current => current === item.id ? null : item.id)
    setSessionMenuMode('menu')
    setSessionRenameDraft(item.title || item.preview)
  }

  async function toggleSessionPin(item: TutorSessionSummary) {
    setSessionActionBusy(true)
    try {
      await updateTutorSession(LOCAL_USER_ID, item.id, { is_pinned: !item.is_pinned })
      await refreshSessions()
      setNotice(item.is_pinned ? '已取消置顶对话。' : '已置顶对话。')
      closeSessionMenu()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '更新对话失败。')
    } finally {
      setSessionActionBusy(false)
    }
  }

  async function renameSession(item: TutorSessionSummary) {
    const title = sessionRenameDraft.trim()
    if (!title) {
      setNotice('请输入对话名称。')
      return
    }
    setSessionActionBusy(true)
    try {
      await updateTutorSession(LOCAL_USER_ID, item.id, { title })
      await refreshSessions()
      setNotice('对话已重命名。')
      closeSessionMenu()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '重命名失败。')
    } finally {
      setSessionActionBusy(false)
    }
  }

  async function shareSession(item: TutorSessionSummary) {
    setSessionActionBusy(true)
    try {
      const history = await getTutorHistory(LOCAL_USER_ID, item.id)
      const transcript = history.messages
        .map((message: TutorMessage) => `${message.role === 'user' ? t('我', 'Me') : 'RHYME'}：${message.content}`)
        .join('\n\n')
      if (!navigator.clipboard?.writeText) throw new Error('当前浏览器无法访问剪贴板，请手动复制对话内容。')
      await navigator.clipboard.writeText(`${t('RHYME 学习对话', 'RHYME learning chat')}｜${history.title}\n\n${transcript}`)
      setNotice('完整对话已复制，可以直接粘贴分享。')
      closeSessionMenu()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '分享准备失败。')
    } finally {
      setSessionActionBusy(false)
    }
  }

  async function deleteSession(item: TutorSessionSummary) {
    if (sending && sessionId === item.id) {
      setNotice('请等待当前回答完成后再删除对话。')
      return
    }
    setSessionActionBusy(true)
    try {
      await deleteTutorSession(LOCAL_USER_ID, item.id)
      setSessions(current => current.filter(session => session.id !== item.id))
      if (sessionId === item.id) newChat()
      setNotice('对话记录已删除，已保存到资料库的资料不会受影响。')
      closeSessionMenu()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '删除对话失败。')
    } finally {
      setSessionActionBusy(false)
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

  async function handleFile(event: ChangeEvent<HTMLInputElement>, type: Attachment['type']) {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''

    const attachmentId = `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const isImage = file.type.startsWith('image/')
    const attachmentType: Attachment['type'] = isImage ? 'image' : type

    if (!isImage) {
      setAttachment({
        id: attachmentId,
        name: file.name,
        size: formatFileSize(file.size),
        type: attachmentType,
        status: 'error',
        error: '当前仅支持图片识别，请上传 JPG、PNG、WebP 等图片。',
      })
      setNotice('当前版本仅支持图片识别，请重新选择一张图片。')
      return
    }

    if (file.size > maxImageUploadSize) {
      setAttachment({
        id: attachmentId,
        name: file.name,
        size: formatFileSize(file.size),
        type: 'image',
        status: 'error',
        error: '图片超过 8 MB，请压缩后再上传。',
      })
      setNotice('图片超过 8 MB，请压缩后再上传。')
      return
    }

    setAttachment({ name: file.name, size: formatFileSize(file.size), id: attachmentId, type: 'image', status: 'reading' })
    setNotice('正在准备图片…')
    try {
      const dataUrl = await readImageAsDataUrl(file)
      setAttachment(current => current?.id === attachmentId
        ? { ...current, status: 'ready', dataUrl }
        : current)
      setNotice('图片已准备好，发送后会由 AI 结合图片回答。')
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片读取失败，请重新选择。'
      setAttachment(current => current?.id === attachmentId
        ? { ...current, status: 'error', error: message }
        : current)
      setNotice(message)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSend) return

    const activeAttachment = attachment?.status === 'ready' ? attachment : null
    const images = activeAttachment?.type === 'image' && activeAttachment.dataUrl ? [activeAttachment.dataUrl] : []
    const prompt = input.trim() || `请讲解这张图片中的内容：${activeAttachment?.name || '图片'}`
    const requestedKind = selectedKind
    const turnId = `pending-${Date.now()}`
    const previousSessionId = sessionId
    setTurns(current => [...current, {
      id: turnId,
      prompt,
      attachment: activeAttachment?.name,
      images,
      imageAnalysis: images.length > 0 ? {
        title: '正在识别图片',
        summary: '正在提取题干、文字和关联知识点…',
        recognized_text: '',
        knowledge_points: [],
        course_name: '',
        topic_name: '',
      } : undefined,
      imageAnalysisLoading: images.length > 0,
      loadingPhase: images.length > 0 ? 'image_analysis' : 'retrieving',
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
      const response = await streamTutorChat(
        LOCAL_USER_ID,
        previousSessionId,
        prompt,
        images.length > 0 ? 'vision' : 'text',
        images,
      )
      await readTutorStream(response, streamEvent => {
        if (streamEvent.type === 'start') {
          setTurns(current => current.map(turn => turn.id === turnId
            ? {
                ...turn,
                loadingPhase: streamEvent.phase || turn.loadingPhase,
                ...(streamEvent.image_analysis ? { imageAnalysis: streamEvent.image_analysis, imageAnalysisLoading: false } : {}),
              }
            : turn))
        }
        if (streamEvent.type === 'status') {
          setTurns(current => current.map(turn => turn.id === turnId
            ? {
                ...turn,
                loadingPhase: streamEvent.phase,
                ...(streamEvent.image_analysis ? { imageAnalysis: streamEvent.image_analysis, imageAnalysisLoading: false } : {}),
                ...(streamEvent.image_error ? {
                  imageAnalysis: {
                    title: t('图片识别没有完成', 'Image recognition did not finish'),
                    summary: t('已继续尝试根据你的文字提问回答；你也可以重新上传一张更清晰的图片。', 'The answer will continue from your text prompt; you can also upload a clearer image.'),
                    recognized_text: '', knowledge_points: [], course_name: '', topic_name: '',
                  },
                  imageAnalysisLoading: false,
                } : {}),
              }
            : turn))
        }
        if (streamEvent.type === 'chunk') {
          setTurns(current => current.map(turn => turn.id === turnId
            ? { ...turn, response: turn.response + streamEvent.content }
            : turn))
        }
        if (streamEvent.type === 'done') {
          setSessionId(streamEvent.session_id)
          setLearningState(streamEvent.learning_state || emptyLearningState)
          setTurns(current => current.map(turn => turn.id === turnId
            ? { ...turn, id: streamEvent.qa_id, loading: false, loadingPhase: undefined, imageAnalysisLoading: false }
            : turn))
          if (requestedKind === 'notes') setDocumentSetup(defaultDocumentSetup(streamEvent.qa_id))
          else if (requestedKind === 'practice') setPracticeSetupTurnId(streamEvent.qa_id)
          else if (requestedKind === 'map') setPendingMapGenerationTurnId(streamEvent.qa_id)
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
    if (kind === 'map') {
      void runKnowledgeMapGeneration(turnId)
      return
    }
    // 「专项训练」是练习测验的学习场景入口；当前先复用已完成的
    // 5 题自动批改闭环，后续再扩展为按薄弱点和难度分层的专项题库。
    if (kind === 'practice' || kind === 'special') {
      void runPracticeGeneration(turnId)
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
      topicMastery: 0,
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
      const queued = await generateLearningDocument(
        LOCAL_USER_ID,
        sessionId,
        turn.id,
        {
          purpose: loadingArtifact.purpose || 'review',
          depth: loadingArtifact.depth || 'standard',
          style: loadingArtifact.style || 'plain',
        },
      )
      const data = await waitForGenerationJob(LOCAL_USER_ID, queued.job)
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

  async function runPracticeGeneration(turnId: string) {
    if (!sessionId || practiceGenerating || practiceGenerationLocked.current) return
    const turn = turns.find(item => item.id === turnId)
    if (!turn || turn.id.startsWith('pending-')) {
      setNotice('这条回答还没有保存完成，请稍后重试。')
      return
    }
    const loadingId = `practice-generating-${Date.now()}`
    const loadingArtifact: Artifact = {
      id: loadingId,
      kind: 'practice',
      title: '正在生成练习测验…',
      summary: '正在围绕当前回答编写 5 道可自动批改的题目。',
      details: ['覆盖核心概念和易错点', '作答后提供逐题解析与薄弱点定位'],
      source: turn.prompt,
      course: learningState.subject || '未分类课程',
      topic: learningState.current_topic || '本次学习',
      topicMastery: 0,
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
      purpose: 'review',
      depth: 'standard',
      style: 'exam',
    }
    practiceGenerationLocked.current = true
    setPracticeGenerating(true)
    setPracticeSetupTurnId(null)
    setNotice('正在根据这条回答生成 5 题练习…')
    setTurns(current => current.map(item => item.id === turn.id
      ? { ...item, artifacts: [...item.artifacts, loadingArtifact] }
      : item))
    try {
      const queued = await generatePracticeSet(LOCAL_USER_ID, sessionId, turn.id)
      const data = await waitForGenerationJob(LOCAL_USER_ID, queued.job)
      const artifact = artifactFromRecord(data.artifact)
      setTurns(current => current.map(item => item.id === turn.id
        ? { ...item, artifacts: item.artifacts.map(item => item.id === loadingId ? artifact : item) }
        : item))
      setPracticeRun({
        artifact,
        practice: data.practice,
        attempts: [],
        answers: {},
        activeIndex: 0,
        result: null,
        topicMastery: null,
      })
      setNotice('已生成 5 题练习。答案会在提交后显示。')
    } catch (error) {
      const message = error instanceof Error ? error.message : '练习测验生成失败'
      setTurns(current => current.map(item => item.id === turn.id
        ? {
            ...item,
            artifacts: item.artifacts.map(item => item.id === loadingId
              ? { ...item, title: '练习测验生成失败', summary: message, details: ['可以点击“重新生成”再次尝试'], status: 'error' }
              : item),
          }
        : item))
      setNotice(message)
    } finally {
      practiceGenerationLocked.current = false
      setPracticeGenerating(false)
    }
  }

  async function runKnowledgeMapGeneration(turnId: string) {
    if (!sessionId || knowledgeMapGeneratingTurnId || knowledgeMapGenerationLocked.current) return
    const turn = turns.find(item => item.id === turnId)
    if (!turn || turn.id.startsWith('pending-')) {
      setNotice('这条回答还没有保存完成，请稍后重试。')
      return
    }
    const loadingId = `map-generating-${Date.now()}`
    const loadingArtifact: Artifact = {
      id: loadingId,
      kind: 'map',
      title: '正在梳理知识图解…',
      summary: '正在提取概念关系、学习顺序和容易混淆的环节。',
      details: ['根据当前问答识别核心概念与关联分支', '自动选择概念关系图或解题流程图'],
      source: turn.prompt,
      course: learningState.subject || '未分类课程',
      topic: learningState.current_topic || '本次学习',
      topicMastery: 0,
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
      purpose: 'review',
      depth: 'standard',
      style: 'plain',
    }
    knowledgeMapGenerationLocked.current = true
    setKnowledgeMapGeneratingTurnId(turn.id)
    setNotice('正在把这条内容整理成可点击的知识图解…')
    setTurns(current => current.map(item => item.id === turn.id
      ? { ...item, artifacts: [...item.artifacts, loadingArtifact] }
      : item))
    openMapWorkspace(loadingArtifact, 'chat')
    try {
      const queued = await generateKnowledgeMap(LOCAL_USER_ID, sessionId, turn.id)
      const data = await waitForGenerationJob(LOCAL_USER_ID, queued.job)
      const artifact = artifactFromRecord(data.artifact)
      setTurns(current => current.map(item => item.id === turn.id
        ? { ...item, artifacts: item.artifacts.map(item => item.id === loadingId ? artifact : item) }
        : item))
      openMapWorkspace(artifact, 'chat')
      setNotice('知识图解已生成。点击节点可查看定义、例子和易错点。')
    } catch (error) {
      const message = error instanceof Error ? error.message : '知识图解生成失败'
      setTurns(current => current.map(item => item.id === turn.id
        ? {
            ...item,
            artifacts: item.artifacts.map(item => item.id === loadingId
              ? { ...item, title: '知识图解生成失败', summary: message, details: ['可以点击“重新生成”再次尝试'], status: 'error' }
              : item),
          }
        : item))
      setNotice(message)
    } finally {
      knowledgeMapGenerationLocked.current = false
      setKnowledgeMapGeneratingTurnId(null)
    }
  }

  async function updateMapNodeStatus(artifact: Artifact, nodeId: string, status: KnowledgeMapNodeStatus) {
    if (!artifact.backendId) {
      setNotice('这份图解还没有准备完成，请稍后再标记学习状态。')
      return
    }
    const mapData = parseKnowledgeMap(artifact.content)
    if (!mapData) {
      setNotice('这份图解内容无法读取，暂时不能记录进度。')
      return
    }
    const previous = mapProgressByArtifactId[artifact.id]
    const nextProgress = { ...(previous?.progress || {}) }
    if (status === 'new') delete nextProgress[nodeId]
    else nextProgress[nodeId] = status
    const optimistic: KnowledgeMapProgressState = {
      progress: nextProgress,
      summary: summarizeMapProgress(mapData, nextProgress),
    }
    const savingKey = `${artifact.id}:${nodeId}`
    setMapProgressByArtifactId(current => ({ ...current, [artifact.id]: optimistic }))
    setMapProgressSavingKey(savingKey)
    try {
      const updated = await updateKnowledgeMapNodeProgress(artifact.backendId, LOCAL_USER_ID, nodeId, status)
      setMapProgressByArtifactId(current => ({ ...current, [artifact.id]: updated }))
    } catch (error) {
      setMapProgressByArtifactId(current => {
        const next = { ...current }
        if (previous) next[artifact.id] = previous
        else delete next[artifact.id]
        return next
      })
      setNotice(error instanceof Error ? error.message : '记录图解学习状态失败')
    } finally {
      setMapProgressSavingKey(current => current === savingKey ? null : current)
    }
  }

  function replaceArtifactFromRecord(record: LearningArtifactRecord) {
    const replacement = artifactFromRecord(record)
    const replace = (artifact: Artifact) => artifact.backendId === record.id ? replacement : artifact
    setTurns(current => current.map(turn => ({ ...turn, artifacts: turn.artifacts.map(replace) })))
    setLibraryItems(current => current.map(replace))
    setTrashedItems(current => current.map(replace))
    setVersionItems(current => current.map(replace))
    setVersionPreview(current => current?.backendId === record.id ? replacement : current)
  }

  async function persistEditedKnowledgeMap(artifact: Artifact, map: KnowledgeMapData) {
    if (!artifact.backendId) {
      throw new Error('这份图解还没有可保存的资料记录，请稍后再试。')
    }
    setMapEditingArtifactId(artifact.id)
    try {
      const result = await updateKnowledgeMap(artifact.backendId, LOCAL_USER_ID, map)
      replaceArtifactFromRecord(result.artifact)
      const updatedProgress = result.map_progress
      if (updatedProgress) {
        setMapProgressByArtifactId(current => ({ ...current, [artifact.id]: updatedProgress }))
      }
      setMapCollaborations(current => {
        const next = { ...current }
        delete next[artifact.id]
        return next
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存知识图解编辑失败'
      setNotice(message)
      throw error
    } finally {
      setMapEditingArtifactId(current => current === artifact.id ? null : current)
    }
  }

  async function runMapCollaboration(artifact: Artifact) {
    if (!artifact.backendId || mapCollaborationLoadingArtifactId) return
    setMapCollaborationLoadingArtifactId(artifact.id)
    try {
      const result = await collaborateKnowledgeMap(artifact.backendId, LOCAL_USER_ID)
      setMapCollaborations(current => ({ ...current, [artifact.id]: result }))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '智能协作检查失败')
    } finally {
      setMapCollaborationLoadingArtifactId(current => current === artifact.id ? null : current)
    }
  }

  function dismissMapSuggestion(artifactId: string, suggestion: KnowledgeMapCollaborationSuggestion) {
    setMapCollaborations(current => {
      const collaboration = current[artifactId]
      if (!collaboration) return current
      return {
        ...current,
        [artifactId]: { ...collaboration, suggestions: collaboration.suggestions.filter(item => item !== suggestion) },
      }
    })
  }

  async function runMapReviewPractice(artifact: Artifact, mapData: KnowledgeMapData) {
    const progress = mapProgressByArtifactId[artifact.id]
    const focusPoints = mapData.nodes
      .filter(node => mapNodeStatus(progress?.progress || {}, node.id) === 'review')
      .map(node => node.label)
    if (!artifact.backendId || !artifact.sessionId || !artifact.qaId || focusPoints.length === 0) {
      setNotice('请先把需要补强的节点标为“待复习”，再生成针对性练习。')
      return
    }
    if (practiceGenerationLocked.current || mapReviewPracticeGeneratingArtifactId) return
    const loadingId = `map-review-practice-${Date.now()}`
    const sourceTurnExists = turns.some(turn => turn.id === artifact.qaId)
    const loadingArtifact: Artifact = {
      id: loadingId,
      kind: 'practice',
      title: '正在生成节点专项练习…',
      summary: `正在围绕“${focusPoints.join('、')}”编写 5 道练习。`,
      details: ['只覆盖图解中标为待复习的节点', '提交后会把结果回写到对应图解'],
      source: artifact.source,
      sessionId: artifact.sessionId,
      qaId: artifact.qaId,
      course: artifact.course,
      topic: artifact.topic,
      topicMastery: artifact.topicMastery,
      recommendedCourse: artifact.recommendedCourse,
      recommendedTopic: artifact.recommendedTopic,
      classificationSource: artifact.classificationSource,
      classificationConfidence: artifact.classificationConfidence,
      classificationOverridden: artifact.classificationOverridden,
      saved: false,
      favorite: false,
      versionGroupId: 0,
      version: 1,
      status: 'generating',
      purpose: 'review',
      depth: 'standard',
      style: 'exam',
      sourceMapArtifactId: artifact.backendId,
    }
    practiceGenerationLocked.current = true
    setPracticeGenerating(true)
    setMapReviewPracticeGeneratingArtifactId(artifact.id)
    if (sourceTurnExists) {
      setTurns(current => current.map(turn => turn.id === artifact.qaId
        ? { ...turn, artifacts: [...turn.artifacts, loadingArtifact] }
        : turn))
    }
    try {
      const queued = await generatePracticeSet(
        LOCAL_USER_ID,
        artifact.sessionId,
        artifact.qaId,
        focusPoints,
        artifact.backendId,
      )
      const data = await waitForGenerationJob(LOCAL_USER_ID, queued.job)
      const practiceArtifact = artifactFromRecord(data.artifact)
      if (sourceTurnExists) {
        setTurns(current => current.map(turn => turn.id === artifact.qaId
          ? { ...turn, artifacts: turn.artifacts.map(item => item.id === loadingId ? practiceArtifact : item) }
          : turn))
      }
      setPracticeRun({
        artifact: practiceArtifact,
        practice: data.practice,
        attempts: [],
        answers: {},
        activeIndex: 0,
        result: null,
        topicMastery: null,
      })
      setNotice(`已围绕 ${focusPoints.length} 个待复习节点生成专项练习。`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '节点专项练习生成失败'
      if (sourceTurnExists) {
        setTurns(current => current.map(turn => turn.id === artifact.qaId
          ? {
              ...turn,
              artifacts: turn.artifacts.map(item => item.id === loadingId
                ? { ...item, title: '节点专项练习生成失败', summary: message, details: ['可以回到图解后再次尝试'], status: 'error' }
                : item),
            }
          : turn))
      }
      setNotice(message)
    } finally {
      practiceGenerationLocked.current = false
      setPracticeGenerating(false)
      setMapReviewPracticeGeneratingArtifactId(null)
    }
  }

  function continueImageExplanation(turn: ChatTurn) {
    const topic = turn.imageAnalysis?.title || '这道题'
    setInput(`请分步骤讲解${topic}，先说明题目考查什么，再给出解题思路和易错点。`)
    setNotice('追问已放入输入框，发送后会继续结合这张图片讲解。')
    window.requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.composer-wrap textarea')?.focus())
  }

  async function saveImageAnalysis(turn: ChatTurn) {
    if (!sessionId || turn.id.startsWith('pending-') || imageAnalysisSavingTurnId) return
    setImageAnalysisSavingTurnId(turn.id)
    try {
      const data = await createImageAnalysisArtifact(LOCAL_USER_ID, sessionId, turn.id)
      const artifact = artifactFromRecord(data.artifact)
      setTurns(current => current.map(item => item.id === turn.id
        ? { ...item, artifacts: [...item.artifacts, artifact] }
        : item))
      openSave(artifact)
      setNotice('已整理好图片解析，请确认归档位置。')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保存图片解析失败')
    } finally {
      setImageAnalysisSavingTurnId(null)
    }
  }

  async function startTopicWeakPractice(course: string, topic: string, artifacts: Artifact[]) {
    const key = folderTopicKey(course, topic)
    const review = topicReviews[key]
    const source = artifacts.find(item => item.kind === 'practice') || artifacts[0]
    const focusPoints = review?.weak_points || []
    if (!source?.sessionId || !source.qaId || focusPoints.length === 0) {
      setNotice('这组资料暂时没有可用于专项练习的错题记录。')
      return
    }
    if (practiceGenerationLocked.current || topicPracticeGeneratingKey) return
    practiceGenerationLocked.current = true
    setPracticeGenerating(true)
    setTopicPracticeGeneratingKey(key)
    try {
      const queued = await generatePracticeSet(LOCAL_USER_ID, source.sessionId, source.qaId, focusPoints)
      const data = await waitForGenerationJob(LOCAL_USER_ID, queued.job)
      const artifact = artifactFromRecord(data.artifact)
      setTurns(current => current.map(turn => turn.id === source.qaId
        ? { ...turn, artifacts: [...turn.artifacts, artifact] }
        : turn))
      setPracticeRun({
        artifact,
        practice: data.practice,
        attempts: [],
        answers: {},
        activeIndex: 0,
        result: null,
        topicMastery: null,
      })
      setNotice(`已围绕“${focusPoints.join('、')}”生成 5 题专项练习。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '专项练习生成失败')
    } finally {
      practiceGenerationLocked.current = false
      setPracticeGenerating(false)
      setTopicPracticeGeneratingKey(null)
    }
  }

  async function openPractice(artifact: Artifact) {
    if (!artifact.backendId || practiceLoadingArtifactId) return
    setPracticeLoadingArtifactId(artifact.id)
    try {
      const data = await getPracticeForArtifact(artifact.backendId, LOCAL_USER_ID)
      setPracticeRun({
        artifact,
        practice: data.practice,
        attempts: data.attempts,
        answers: {},
        activeIndex: 0,
        result: null,
        topicMastery: artifact.topicMastery || null,
      })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '获取练习集失败')
    } finally {
      setPracticeLoadingArtifactId(null)
    }
  }

  function answerPracticeQuestion(questionId: string, answer: string) {
    setPracticeRun(current => current ? {
      ...current,
      answers: { ...current.answers, [questionId]: answer },
    } : current)
  }

  function restartPractice() {
    setPracticeRun(current => current ? {
      ...current,
      answers: {},
      activeIndex: 0,
      result: null,
      topicMastery: current.artifact.topicMastery || null,
    } : current)
  }

  async function submitPractice() {
    if (!practiceRun || practiceSubmitting) return
    const unansweredIndex = practiceRun.practice.questions.findIndex(question => !practiceRun.answers[question.id]?.trim())
    if (unansweredIndex !== -1) {
      setPracticeRun(current => current ? { ...current, activeIndex: unansweredIndex } : current)
      setNotice('还有题目没有作答，请完成后再提交。')
      return
    }
    setPracticeSubmitting(true)
    try {
      const data = await submitPracticeAttempt(practiceRun.practice.id, LOCAL_USER_ID, practiceRun.answers)
      setPracticeRun(current => current ? {
        ...current,
        attempts: [data.attempt, ...current.attempts],
        result: data.attempt,
        topicMastery: data.topic_mastery,
      } : current)
      if (data.map_progress && practiceRun.artifact.sourceMapArtifactId) {
        const sourceMap = mapArtifacts.find(item => item.backendId === practiceRun.artifact.sourceMapArtifactId)
        if (sourceMap) {
          setMapProgressByArtifactId(current => ({ ...current, [sourceMap.id]: data.map_progress as KnowledgeMapProgressState }))
        }
      }
      void refreshTopicReviews()
      setNotice(data.topic_mastery === null
        ? '练习已批改。保存到资料库后会回写主题掌握情况。'
        : '练习已批改，并已更新当前主题的掌握情况。')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '提交练习失败')
    } finally {
      setPracticeSubmitting(false)
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
      let returnedTopicMastery: number | null | undefined
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
        returnedTopicMastery = (response as { topic_mastery?: number | null }).topic_mastery
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
      if (target.kind === 'practice') {
        setPracticeRun(current => current && (current.artifact.id === target.id || current.artifact.id === savedArtifact.id)
          ? {
              ...current,
              artifact: savedArtifact,
              topicMastery: (returnedTopicMastery ?? savedArtifact.topicMastery) || null,
            }
          : current)
      }
      closeSave()
      if (target.kind === 'practice' && saveMode === 'save') {
        setLibraryPreviewId(savedArtifact.id)
        setLibraryTopic(null)
        setView('library')
      }
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
    <div className={`app-frame ${view === 'map-workspace' ? 'map-studio-frame' : ''}`} data-style={interfaceStyle} data-language={interfaceLanguage} style={appFrameStyle}>
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label={t('主导航', 'Main navigation')}>
        <div className="brand-row">
          <span className="brand-mark"><BrandSymbol /></span>
          <span className="brand-copy"><strong>RHYME</strong><small>Learning Agent</small></span>
          <button className="mobile-close icon-button" aria-label={t('关闭导航', 'Close navigation')} onClick={() => setSidebarOpen(false)}><Icon name="x" /></button>
        </div>

        <button className="new-chat" onClick={newChat}>
          <Icon name="pen" size={17} />
          <span>{t('新学习对话', 'New learning chat')}</span>
        </button>

        <nav className="primary-nav" aria-label={t('学习空间', 'Learning space')}>
          <button className={view === 'library' ? 'nav-item active' : 'nav-item'} onClick={() => { setView('library'); setLibraryPreviewId(null); setLibraryTopic(null); setSidebarOpen(false) }}>
            <Icon name="library" size={18} />
            <span>{t('资料库', 'Library')}</span>
            {libraryItems.length > 0 && <span className="nav-count">{libraryItems.length}</span>}
          </button>
        </nav>

        <div className="sidebar-section">
          <div className="section-label">{t('最近', 'Recent')}</div>
          {historyLoading && sessions.length === 0 ? (
            <p className="history-empty">{t('正在恢复本地对话…', 'Restoring local chats…')}</p>
          ) : sessions.length === 0 ? (
            <p className="history-empty">{t('开始一次对话后，会保存在这里。', 'Your conversations will appear here.')}</p>
          ) : (
            sessions.map(item => {
              const menuOpen = sessionMenuId === item.id
              const current = view === 'chat' && sessionId === item.id
              return (
                <div
                  className={`history-row${current ? ' current' : ''}${item.is_pinned ? ' pinned' : ''}${menuOpen ? ' menu-open' : ''}`}
                  data-session-menu-root
                  key={item.id}
                >
                  <button
                    className={current ? 'history-item current' : 'history-item'}
                    onClick={() => void openSession(item.id)}
                    disabled={sending && sessionId !== item.id}
                  >
                    <span className="history-icon"><Icon name="book" size={15} /></span>
                    <span>{item.title || item.preview}</span>
                    {item.is_pinned && <Pin className="history-pinned-mark" size={12} strokeWidth={1.9} aria-label={t('已置顶', 'Pinned')} />}
                  </button>
                  <button
                    className="history-actions-trigger"
                    type="button"
                    aria-label={t('管理此对话', 'Manage this conversation')}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    disabled={sending && sessionId === item.id}
                    onClick={() => openSessionMenu(item)}
                  >
                    <Ellipsis size={17} strokeWidth={2} />
                  </button>
                  {menuOpen && (
                    <div className="history-menu" role="menu" aria-label={t('对话操作', 'Conversation actions')}>
                      {sessionMenuMode === 'menu' ? (
                        <>
                          <button type="button" role="menuitem" disabled={sessionActionBusy} onClick={() => void toggleSessionPin(item)}>
                            <Pin size={16} strokeWidth={1.9} />{item.is_pinned ? t('取消置顶', 'Unpin') : t('置顶', 'Pin')}
                          </button>
                          <button type="button" role="menuitem" disabled={sessionActionBusy} onClick={() => void shareSession(item)}>
                            <Share2 size={16} strokeWidth={1.9} />{t('分享', 'Share')}
                          </button>
                          <button type="button" role="menuitem" disabled={sessionActionBusy} onClick={() => setSessionMenuMode('rename')}>
                            <PenLine size={16} strokeWidth={1.9} />{t('重命名', 'Rename')}
                          </button>
                          <button className="history-menu-danger" type="button" role="menuitem" disabled={sessionActionBusy} onClick={() => setSessionMenuMode('delete')}>
                            <Trash2 size={16} strokeWidth={1.9} />{t('删除', 'Delete')}
                          </button>
                        </>
                      ) : sessionMenuMode === 'rename' ? (
                        <form
                          className="history-menu-form"
                          onSubmit={event => { event.preventDefault(); void renameSession(item) }}
                        >
                          <label htmlFor={`rename-session-${item.id}`}>{t('重命名对话', 'Rename conversation')}</label>
                          <input
                            id={`rename-session-${item.id}`}
                            value={sessionRenameDraft}
                            maxLength={160}
                            autoFocus
                            onChange={event => setSessionRenameDraft(event.target.value)}
                          />
                          <div>
                            <button type="button" disabled={sessionActionBusy} onClick={() => setSessionMenuMode('menu')}>{t('取消', 'Cancel')}</button>
                            <button className="primary" type="submit" disabled={sessionActionBusy}>{sessionActionBusy ? t('保存中…', 'Saving…') : t('保存', 'Save')}</button>
                          </div>
                        </form>
                      ) : (
                        <div className="history-menu-confirm">
                          <b>{t('删除这条对话？', 'Delete this conversation?')}</b>
                          <p>{t('对话内容将无法恢复；资料库中已经保存的资料会保留。', 'The conversation cannot be recovered. Saved library materials will remain.')}</p>
                          <div>
                            <button type="button" disabled={sessionActionBusy} onClick={() => setSessionMenuMode('menu')}>{t('取消', 'Cancel')}</button>
                            <button className="danger" type="button" disabled={sessionActionBusy} onClick={() => void deleteSession(item)}>{sessionActionBusy ? t('删除中…', 'Deleting…') : t('确认删除', 'Delete')}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="sidebar-footer">
          <button className="profile-button" type="button">
            <span className="profile-avatar">姚</span>
            <span><b>姚瑞辉</b><small>{t('本地学习空间', 'Local learning space')}</small></span>
            <Icon name="chevron" size={15} />
          </button>
          <button
            className="settings-trigger"
            type="button"
            aria-label={t('界面设置', 'Interface settings')}
            aria-expanded={settingsOpen}
            aria-haspopup="dialog"
            onClick={openSettings}
          >
            <SlidersHorizontal size={18} strokeWidth={1.9} />
          </button>
        </div>
      </aside>

      <main className={`workbench ${view === 'welcome' ? 'workbench-welcome' : ''}`}>
        <header className="topbar">
          <button className="desktop-menu icon-button" aria-label={t('展开导航', 'Open navigation')} onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>
          <strong className="conversation-heading">
            {view === 'library' ? t('资料库', 'Library') : view === 'map-workspace' ? t('知识图解', 'Knowledge map') : view === 'chat' ? conversationTitle : ''}
          </strong>
        </header>

        <section className={`conversation ${view === 'chat' ? 'conversation-thread' : ''} ${view === 'map-workspace' ? 'conversation-map-workspace' : ''}`}>
          {view === 'welcome' && (
            <div className="welcome-state">
              <h1>{t('从一个问题开始', 'Start with one question')}</h1>
              <p>{t('上传题目、课件或笔记。RHYME 会理解内容，再帮你整理成可继续编辑的学习资料。', 'Upload a question, lecture material, or note. RHYME understands it, then turns it into learning material you can keep improving.')}</p>
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
                    {turn.images?.length ? (
                      <div className="message-image-grid">
                        {turn.images.map((image, index) => (
                          <img key={`${turn.id}-image-${index}`} src={image} alt="你上传的图片" />
                        ))}
                      </div>
                    ) : turn.attachment && <span className="message-attachment"><Icon name="paperclip" size={15} />{turn.attachment}</span>}
                    <p>{turn.prompt}</p>
                  </div>

                  <div className="assistant-message">
                    <div className="agent-avatar"><BrandSymbol /></div>
                    <div className="assistant-content">
                      <div className={turn.error ? 'assistant-response error' : 'assistant-response'} aria-live={turn.loading ? 'polite' : undefined}>
                        {turn.response
                          ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.response}</ReactMarkdown>
                          : turn.loading && <span className="thinking-label">{turn.loadingPhase === 'image_analysis'
                            ? t('正在识别图片…', 'Reading the image…')
                            : turn.loadingPhase === 'retrieving'
                              ? t('正在提取相关学习内容…', 'Retrieving relevant learning context…')
                              : t('正在生成回答…', 'Generating the answer…')}</span>}
                        {turn.loading && turn.response && <span className="stream-caret" aria-hidden="true" />}
                      </div>

                      {turn.imageAnalysis && (
                        <section className={`image-study-card ${turn.imageAnalysisLoading ? 'is-analyzing' : ''}`} aria-label="图片理解结果">
                          <header>
                            <span className="image-study-icon"><Icon name="image" size={17} /></span>
                            <div>
                              <b>{turn.imageAnalysisLoading ? '正在识别图片' : turn.imageAnalysis.title}</b>
                              <small>{turn.imageAnalysisLoading ? '提取题干、文字和关联知识点…' : turn.imageAnalysis.summary}</small>
                            </div>
                            <span className="image-study-status">{turn.imageAnalysisLoading ? '识别中' : '图片理解'}</span>
                          </header>
                          {!turn.imageAnalysisLoading && turn.imageAnalysis.recognized_text && (
                            <p className="image-study-text">{turn.imageAnalysis.recognized_text}</p>
                          )}
                          {!turn.imageAnalysisLoading && turn.imageAnalysis.knowledge_points.length > 0 && (
                            <div className="image-study-points" aria-label="关联知识点">
                              {turn.imageAnalysis.knowledge_points.map(point => <span key={point}>{point}</span>)}
                            </div>
                          )}
                          <footer>
                            <button type="button" onClick={() => continueImageExplanation(turn)} disabled={turn.imageAnalysisLoading}>继续讲解</button>
                            <button type="button" onClick={() => void runPracticeGeneration(turn.id)} disabled={turn.imageAnalysisLoading || practiceGenerating}>生成同类练习</button>
                            <button type="button" onClick={() => void runKnowledgeMapGeneration(turn.id)} disabled={turn.imageAnalysisLoading || knowledgeMapGeneratingTurnId !== null}>生成知识图解</button>
                            <button className="image-study-save" type="button" onClick={() => void saveImageAnalysis(turn)} disabled={turn.imageAnalysisLoading || imageAnalysisSavingTurnId === turn.id}>
                              <Icon name="save" size={14} />{imageAnalysisSavingTurnId === turn.id ? '整理中…' : '保存题目解析'}
                            </button>
                          </footer>
                        </section>
                      )}

                      {turn.artifacts.map(artifact => {
                        const option = artifactOptions.find(item => item.kind === artifact.kind)
                        const mapData = artifact.kind === 'map' ? parseKnowledgeMap(artifact.content) : null
                        const mapProgress = mapProgressByArtifactId[artifact.id]
                        return (
                          <article className={`artifact-card artifact-${artifact.status || 'draft'} ${artifact.kind !== 'map' && expandedArtifactId === artifact.id ? 'artifact-expanded' : ''}`} key={artifact.id}>
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
                            {mapData && <p className="artifact-map-progress">{mapProgressLabel(mapData, mapProgress, interfaceLanguage)}</p>}
                            <ul className="artifact-details">
                              {artifact.details.map(item => <li key={item}>{item}</li>)}
                            </ul>
                            {artifact.kind !== 'map' && artifact.kind !== 'practice' && artifact.content && expandedArtifactId === artifact.id && (
                              <div className="artifact-document">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{artifact.content}</ReactMarkdown>
                              </div>
                            )}
                            <div className="artifact-source"><Icon name="paperclip" size={14} />基于 {artifact.source}</div>
                            {artifact.status !== 'generating' && (
                              <div className="artifact-actions">
                                {artifact.kind === 'map' && mapData && (
                                  <button type="button" onClick={() => openMapWorkspace(artifact, 'chat')}>
                                    <Trees size={15} />打开图解
                                  </button>
                                )}
                                {artifact.kind !== 'map' && artifact.kind !== 'practice' && artifact.content && (
                                  <button type="button" onClick={() => setExpandedArtifactId(current => current === artifact.id ? null : artifact.id)}>
                                    {expandedArtifactId === artifact.id ? '收起全文' : '展开全文'}
                                  </button>
                                )}
                                {artifact.kind === 'practice' && artifact.status !== 'error' && (
                                  <button type="button" onClick={() => void openPractice(artifact)} disabled={practiceLoadingArtifactId === artifact.id}>
                                    <Icon name="clipboard" size={15} />{practiceLoadingArtifactId === artifact.id ? '打开中…' : '开始练习'}
                                  </button>
                                )}
                                <button type="button" onClick={() => {
                                  if (artifact.kind === 'practice') void runPracticeGeneration(turn.id)
                                  else if (artifact.kind === 'map') void runKnowledgeMapGeneration(turn.id)
                                  else setDocumentSetup({
                                    turnId: turn.id,
                                    purpose: artifact.purpose || 'review',
                                    depth: artifact.depth || 'standard',
                                    style: artifact.style || 'plain',
                                  })
                                }}>{artifact.status === 'error' ? '重新设置' : '重新生成'}</button>
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
                        <div className="next-actions" aria-label={t('常用生成内容', 'Common generated materials')}>
                          <span>{t('基于当前内容生成', 'Generate from current content')}</span>
                          {primaryArtifactOptions.map(item => (
                            <button key={item.kind} type="button" onClick={() => generateForTurn(turn.id, item.kind)}>
                              <Icon name={item.icon} size={15} />{artifactLabel(item.kind, item.label)}
                            </button>
                          ))}
                        </div>
                        <button className="more-generation" type="button" onClick={() => openGeneratorCatalog(turn.id)}>
                          <Sparkles aria-hidden="true" size={15} strokeWidth={1.8} />
                          <span>{t('生成更多内容', 'Generate more')}</span>
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
                        {practiceSetupTurnId === turn.id && (
                          <section id={`practice-setup-${turn.id}`} className="practice-setup" aria-label="设置练习测验">
                            <div className="practice-setup-head">
                              <div><b>生成练习测验</b><span>围绕这条回答生成 5 题，提交前不会显示答案。</span></div>
                              <button type="button" aria-label="关闭练习测验设置" onClick={() => setPracticeSetupTurnId(null)}><Icon name="x" size={15} /></button>
                            </div>
                            <div className="practice-setup-preview">
                              <span><b>5 题</b><small>单选、判断、短填空</small></span>
                              <span><b>逐题解析</b><small>提交后定位薄弱点</small></span>
                            </div>
                            <div className="practice-setup-foot">
                              <span><Icon name="library" size={14} />完成后可保存到推荐主题</span>
                              <button type="button" onClick={() => void runPracticeGeneration(turn.id)} disabled={practiceGenerating}><Icon name="spark" size={15} />{practiceGenerating ? '生成中…' : '生成 5 题'}</button>
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

          {view === 'map-workspace' && (
            <section className="map-workspace" aria-label={t('知识图解工作台', 'Knowledge map workspace')}>
              {mapWorkspaceArtifact?.status === 'generating' ? (
                <div className="map-workspace-generating" role="status" aria-live="polite">
                  <button className="map-workspace-generating-exit" type="button" onClick={closeMapWorkspace}>
                    <Icon name="arrow-left" size={16} />{mapWorkspaceReturnView === 'library' ? t('返回资料库', 'Back to library') : t('返回对话', 'Back to chat')}
                  </button>
                  <span className="map-workspace-generating-mark"><Sparkles size={21} /></span>
                  <div>
                    <h1>{t('正在搭建这张知识图解', 'Building this knowledge map')}</h1>
                    <p>{t('先整理核心概念与关系，再补上例子和易错点。完成后会直接出现在这个画布中。', 'Organising core concepts and relationships, then adding examples and misconceptions. The finished map will appear here.')}</p>
                  </div>
                </div>
              ) : mapWorkspaceArtifact && mapWorkspaceData ? (
                <>
                  <header className="map-workspace-head">
                    <div className="map-workspace-title">
                      <button className="map-workspace-back" type="button" onClick={closeMapWorkspace}>
                        <Icon name="arrow-left" size={16} />{mapWorkspaceReturnView === 'library' ? t('返回资料库', 'Back to library') : t('返回对话', 'Back to chat')}
                      </button>
                      <span>{mapWorkspaceArtifact.course} / {mapWorkspaceArtifact.topic}</span>
                      <h1>{mapWorkspaceArtifact.title}</h1>
                      <p>{mapWorkspaceArtifact.summary}</p>
                    </div>
                    <div className="map-workspace-actions">
                      {mapWorkspaceArtifact.saved ? (
                        <button type="button" onClick={() => { setLibraryPreviewId(null); setView('library') }}><Icon name="library" size={15} />{t('查看资料库', 'View library')}</button>
                      ) : mapWorkspaceArtifact.status !== 'error' ? (
                        <button className="primary" type="button" onClick={() => openSave(mapWorkspaceArtifact)}><Icon name="save" size={15} />{t('保存到资料库', 'Save to library')}</button>
                      ) : null}
                    </div>
                  </header>
                  <div className="map-workspace-stage">
                    <EditableKnowledgeMap
                      data={mapWorkspaceData}
                      reader
                      workspace
                      language={interfaceLanguage}
                      progress={mapWorkspaceProgress}
                      progressLoading={Boolean(mapWorkspaceArtifact.backendId && !mapWorkspaceProgress && mapProgressFetches.current.has(mapWorkspaceArtifact.id))}
                      progressSavingNodeId={mapWorkspaceSavingNodeId}
                      reviewPracticeGenerating={mapReviewPracticeGeneratingArtifactId === mapWorkspaceArtifact.id}
                      onStatusChange={(nodeId, status) => void updateMapNodeStatus(mapWorkspaceArtifact, nodeId, status)}
                      onReviewPractice={() => void runMapReviewPractice(mapWorkspaceArtifact, mapWorkspaceData)}
                      onMapChange={map => persistEditedKnowledgeMap(mapWorkspaceArtifact, map)}
                      mapSaving={mapEditingArtifactId === mapWorkspaceArtifact.id}
                      collaboration={mapCollaborations[mapWorkspaceArtifact.id]}
                      collaborationLoading={mapCollaborationLoadingArtifactId === mapWorkspaceArtifact.id}
                      onCollaboration={() => void runMapCollaboration(mapWorkspaceArtifact)}
                      onDismissSuggestion={suggestion => dismissMapSuggestion(mapWorkspaceArtifact.id, suggestion)}
                    />
                  </div>
                </>
              ) : (
                <div className="map-workspace-unavailable">
                  <button className="map-workspace-back" type="button" onClick={closeMapWorkspace}>
                    <Icon name="arrow-left" size={16} />{mapWorkspaceReturnView === 'library' ? t('返回资料库', 'Back to library') : t('返回对话', 'Back to chat')}
                  </button>
                  <h1>{t('这份图解暂时无法打开', 'This map is not available')}</h1>
                  <p>{t('请返回对话后重新生成，或从资料库中重新打开。', 'Return to the conversation to generate it again, or reopen it from the library.')}</p>
                </div>
              )}
            </section>
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
                  <div className={`library-reader-content ${readerMapData ? 'has-knowledge-map' : ''}`}>
                    {readerArtifact?.kind === 'map'
                      ? readerMapData
                        ? <EditableKnowledgeMap
                            data={readerMapData}
                            reader
                            language={interfaceLanguage}
                            progress={readerMapProgress}
                            progressLoading={Boolean(readerArtifact.backendId && !readerMapProgress && mapProgressFetches.current.has(readerArtifact.id))}
                            progressSavingNodeId={readerMapSavingNodeId}
                            reviewPracticeGenerating={mapReviewPracticeGeneratingArtifactId === readerArtifact.id}
                            onStatusChange={(nodeId, status) => void updateMapNodeStatus(readerArtifact, nodeId, status)}
                            onReviewPractice={() => void runMapReviewPractice(readerArtifact, readerMapData)}
                            onMapChange={versionPreview ? undefined : map => persistEditedKnowledgeMap(readerArtifact, map)}
                            mapSaving={mapEditingArtifactId === readerArtifact.id}
                            collaboration={mapCollaborations[readerArtifact.id]}
                            collaborationLoading={mapCollaborationLoadingArtifactId === readerArtifact.id}
                            onCollaboration={versionPreview ? undefined : () => void runMapCollaboration(readerArtifact)}
                            onDismissSuggestion={suggestion => dismissMapSuggestion(readerArtifact.id, suggestion)}
                          />
                        : <p>这份图解内容无法读取，请回到来源对话重新生成。</p>
                      : <ReactMarkdown remarkPlugins={[remarkGfm]}>{readerArtifact?.content || ''}</ReactMarkdown>}
                  </div>
                  <div className="library-reader-actions">
                    {libraryPreview.status === 'deleted' ? (
                      <div className="library-reader-action-group">
                        <button type="button" onClick={() => void restoreArtifact(libraryPreview)}><Icon name="restore" size={14} />恢复资料</button>
                        <button className="danger-action" type="button" onClick={() => openDeleteConfirmation(libraryPreview, 'permanent')}><Icon name="trash" size={14} />永久删除</button>
                      </div>
                    ) : (
                      <div className="library-reader-action-group">
                        {libraryPreview.kind === 'practice' && (
                          <button type="button" onClick={() => void openPractice(libraryPreview)} disabled={practiceLoadingArtifactId === libraryPreview.id}>
                            <Icon name="clipboard" size={14} />{practiceLoadingArtifactId === libraryPreview.id ? '打开中…' : '开始练习'}
                          </button>
                        )}
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
                    <span>{libraryTopicDisplayMastery > 0 ? `掌握 ${libraryTopicDisplayMastery}% · ` : ''}{libraryTopicItems.length} 份资料</span>
                  </div>
                  {libraryTopicReview?.recent_score !== null && libraryTopicReview?.recent_score !== undefined && (
                    <section className="library-topic-review library-topic-review-detail" aria-label="主题复盘">
                      <div className="library-topic-review-summary">
                        <b>{t(`最近练习 ${libraryTopicReview.recent_score} 分 · 已完成 ${libraryTopicReview.attempt_count} 次`, `Latest practice: ${libraryTopicReview.recent_score}/100 · ${libraryTopicReview.attempt_count} attempts`)}</b>
                        <span>{libraryTopicReview.weak_points.length
                          ? t(`待复习：${libraryTopicReview.weak_points.join('、')}`, `Review: ${libraryTopicReview.weak_points.join(', ')}`)
                          : t('最近一次练习没有发现集中的薄弱点。', 'No concentrated weak points were found in the latest practice.')}</span>
                      </div>
                      {libraryTopicReview.weak_points.length > 0 && (
                        <button
                          type="button"
                          onClick={() => void startTopicWeakPractice(libraryTopic.course, libraryTopic.topic, libraryTopicItems)}
                          disabled={topicPracticeGeneratingKey === folderTopicKey(libraryTopic.course, libraryTopic.topic)}
                        >
                          <Icon name="clipboard" size={14} />{topicPracticeGeneratingKey === folderTopicKey(libraryTopic.course, libraryTopic.topic)
                            ? t('生成中…', 'Generating…')
                            : t('针对薄弱点再练一次', 'Practice weak points')}
                        </button>
                      )}
                      {(libraryTopicReview.wrong_questions?.length || 0) > 0 && (
                        <div className="library-topic-mistakes">
                          {libraryTopicReview.wrong_questions?.map((question, index) => (
                            <article key={`${question.prompt}-${index}`}>
                              <b>{t(`错题 ${index + 1} · ${question.knowledge_point}`, `Missed ${index + 1} · ${question.knowledge_point}`)}</b>
                              <p>{question.prompt}</p>
                              <small>{t(`你的答案：${question.answer || '未作答'} · 正确答案：${question.correct_answer}`, `Your answer: ${question.answer || 'No answer'} · Correct: ${question.correct_answer}`)}</small>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                  <div className="library-list">
                    {libraryTopicItems.map(item => {
                      const option = artifactOptions.find(entry => entry.kind === item.kind)
                      const mapData = item.kind === 'map' ? parseKnowledgeMap(item.content) : null
                      const mapProgress = mapProgressByArtifactId[item.id]
                      return (
                        <button className="library-row" key={item.id} onClick={() => item.kind === 'map' ? openMapWorkspace(item, 'library') : setLibraryPreviewId(item.id)}>
                          <span className="library-row-icon"><Icon name={option?.icon || 'file'} size={17} /></span>
                          <span className="library-row-copy"><b>{item.title}</b><small>{option ? artifactLabel(option.kind, option.label) : t('学习资料', 'Learning material')}{item.version > 1 ? ` · v${item.version}` : ''}{mapData ? ` · ${mapProgressLabel(mapData, mapProgress, interfaceLanguage)}` : ''} · {item.summary}</small></span>
                          {item.favorite && <span className="library-row-star" aria-label={t('已收藏', 'Favorited')}><Icon name="star" size={14} /></span>}
                          <Icon name="chevron" size={16} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div className="library-heading">
                    <div><h1>{libraryMode === 'trash' ? t('回收站', 'Trash') : t('资料库', 'Library')}</h1><p>{libraryMode === 'trash' ? t('删除的资料可以恢复，也可以永久清除。', 'Deleted material can be restored or removed permanently.') : t('按课程和主题自动整理。', 'Organized automatically by course and topic.')}</p></div>
                    <span>{activeLibraryItems.length} {t('份资料', 'items')}</span>
                  </div>

                  <div className="library-toolbar">
                    <label className="library-search">
                      <Icon name="search" size={16} />
                      <input value={librarySearch} onChange={event => setLibrarySearch(event.target.value)} placeholder={libraryMode === 'trash' ? t('搜索回收站', 'Search trash') : t('搜索标题、课程或知识点', 'Search title, course, or topic')} aria-label={libraryMode === 'trash' ? t('搜索回收站', 'Search trash') : t('搜索资料', 'Search library')} />
                      {librarySearch && <button type="button" aria-label={t('清空资料搜索', 'Clear library search')} onClick={() => setLibrarySearch('')}><Icon name="x" size={14} /></button>}
                    </label>
                    <div className="library-modes" aria-label={t('资料视图', 'Library view')}>
                      <button type="button" aria-pressed={libraryMode === 'recent'} onClick={() => switchLibraryMode('recent')}>{t('最近', 'Recent')}</button>
                      <button type="button" aria-pressed={libraryMode === 'course'} onClick={() => switchLibraryMode('course')}>{t('按课程', 'By course')}</button>
                      <button type="button" aria-pressed={libraryMode === 'favorite'} onClick={() => switchLibraryMode('favorite')}><Icon name="star" size={14} />{t('收藏', 'Favorites')}</button>
                      <button className="trash-mode" type="button" aria-pressed={libraryMode === 'trash'} onClick={() => switchLibraryMode('trash')}><Icon name="trash" size={14} />{t('回收站', 'Trash')}{trashedItems.length > 0 ? ` ${trashedItems.length}` : ''}</button>
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
                      const courseCollapsed = !librarySearch.trim() && collapsedLibraryCourses.has(course)
                      return (
                        <section className="library-course-folder" key={course}>
                          <button
                            className="library-folder-row library-course-folder-row"
                            type="button"
                            aria-expanded={!courseCollapsed}
                            onClick={() => toggleLibraryCourse(course)}
                          >
                            <span className="library-folder-icon"><Icon name="folder" size={18} /></span>
                            <span className="library-folder-copy"><b>{course}</b><small>{courseCount} 份资料 · {Object.keys(topics).length} 个主题</small></span>
                            <span className="library-folder-count">{courseCount}</span>
                            <Icon name="chevron" size={16} />
                          </button>
                          {!courseCollapsed && (
                            <div className="library-folder-children">
                              {Object.entries(topics).map(([topic, items]) => {
                                const topicKey = folderTopicKey(course, topic)
                                const topicExpanded = Boolean(librarySearch.trim()) || expandedLibraryTopics.has(topicKey)
                                const typeNames = [...new Set(items.map(item => artifactOptions.find(option => option.kind === item.kind)?.label || '学习资料'))].slice(0, 3)
                                const topicReview = topicReviews[topicKey]
                                const isGeneratingTopicPractice = topicPracticeGeneratingKey === topicKey
                                return (
                                  <section className="library-topic-folder" key={topic}>
                                    <button
                                      className="library-folder-row library-topic-folder-row"
                                      type="button"
                                      aria-expanded={topicExpanded}
                                      onClick={() => toggleLibraryTopic(course, topic)}
                                    >
                                      <span className="library-folder-icon"><Icon name="folder" size={17} /></span>
                                      <span className="library-folder-copy">
                                        <b>{topic}</b>
                                        <small>{items.length} 份资料 · {typeNames.join('、')}{topicReview?.recent_score !== null && topicReview?.recent_score !== undefined ? ` · 最近 ${topicReview.recent_score} 分` : ''}{topicReview?.weak_points.length ? ` · 待复习 ${topicReview.weak_points.length}` : ''}</small>
                                      </span>
                                      <span className="library-folder-count">{items.length}</span>
                                      <Icon name="chevron" size={15} />
                                    </button>
                                    {topicExpanded && (
                                      <>
                                        <button
                                          className="library-topic-open"
                                          type="button"
                                          onClick={() => { setLibraryTopic({ course, topic }); setLibraryPreviewId(null) }}
                                        >
                                          <Icon name="folder" size={14} />{t('查看主题详情', 'Open topic')}
                                          <Icon name="chevron" size={14} />
                                        </button>
                                        {topicReview?.weak_points.length ? (
                                          <div className="library-topic-review">
                                            <div><b>待复习</b><span>{topicReview.weak_points.join('、')}</span></div>
                                            <button
                                              type="button"
                                              onClick={() => void startTopicWeakPractice(course, topic, items)}
                                              disabled={isGeneratingTopicPractice}
                                            >
                                              <Icon name="clipboard" size={14} />{isGeneratingTopicPractice ? '生成中…' : '针对薄弱点再练一次'}
                                            </button>
                                          </div>
                                        ) : topicReview?.recent_score !== null && topicReview?.recent_score !== undefined ? (
                                          <div className="library-topic-review complete"><span>最近一次练习表现稳定，暂时没有待复习的知识点。</span></div>
                                        ) : null}
                                        <div className="library-folder-files">
                                          {items.map(item => {
                                            const option = artifactOptions.find(entry => entry.kind === item.kind)
                                            const mapData = item.kind === 'map' ? parseKnowledgeMap(item.content) : null
                                            const mapProgress = mapProgressByArtifactId[item.id]
                                            return (
                                              <button className="library-row library-tree-file" type="button" key={item.id} onClick={() => item.kind === 'map' ? openMapWorkspace(item, 'library') : setLibraryPreviewId(item.id)}>
                                                <span className="library-row-icon"><Icon name={option?.icon || 'file'} size={16} /></span>
                                                <span className="library-row-copy"><b>{item.title}</b><small>{option?.label || '学习资料'}{item.version > 1 ? ` · v${item.version}` : ''}{mapData ? ` · ${mapProgressLabel(mapData, mapProgress, interfaceLanguage)}` : ''} · {item.summary}</small></span>
                                                {item.favorite && <span className="library-row-star" aria-label="已收藏"><Icon name="star" size={14} /></span>}
                                                <Icon name="chevron" size={15} />
                                              </button>
                                            )
                                          })}
                                        </div>
                                      </>
                                    )}
                                  </section>
                                )
                              })}
                            </div>
                          )}
                        </section>
                      )
                    })
                  ) : (
                  <div className="library-list">
                    {filteredLibraryItems.map(item => {
                      const option = artifactOptions.find(entry => entry.kind === item.kind)
                      const mapData = item.kind === 'map' ? parseKnowledgeMap(item.content) : null
                      const mapProgress = mapProgressByArtifactId[item.id]
                      return (
                          <button className="library-row" key={item.id} onClick={() => item.kind === 'map' ? openMapWorkspace(item, 'library') : setLibraryPreviewId(item.id)}>
                            <span className="library-row-icon"><Icon name={libraryMode === 'trash' ? 'trash' : option?.icon || 'file'} size={17} /></span>
                          <span className="library-row-copy"><b>{item.title}</b><small>{libraryMode === 'trash' ? `${item.course} / ${item.topic}${item.deletedAt ? ` · ${formatLibraryDate(item.deletedAt)} 删除` : ''}` : `${item.course} / ${item.topic} · ${option?.label || '学习资料'}${item.version > 1 ? ` · v${item.version}` : ''}${mapData ? ` · ${mapProgressLabel(mapData, mapProgress, interfaceLanguage)}` : ''}`}</small></span>
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

        {view !== 'library' && view !== 'map-workspace' && (
          <form className={`composer-wrap ${view === 'welcome' ? 'composer-welcome' : ''}`} onSubmit={submit}>
            {(attachment || selectedOption) && (
              <div className="context-tray">
                {attachment && (
                  <span className={`context-chip ${attachment.type === 'image' ? 'image-attachment' : ''} ${attachment.status === 'error' ? 'attachment-error' : ''}`}>
                    {attachment.type === 'image' && attachment.dataUrl
                      ? <img className="attachment-preview" src={attachment.dataUrl} alt={attachment.name} />
                      : <Icon name={attachment.type === 'image' ? 'image' : 'file'} size={15} />}
                    <span>
                      <b>{attachment.name}</b>
                      <small>{attachment.status === 'reading'
                        ? t('正在准备图片…', 'Preparing image…')
                        : attachment.status === 'error'
                          ? attachment.error
                          : t(`准备识别 · ${attachment.size}`, `Ready to analyze · ${attachment.size}`)}</small>
                    </span>
                    <button type="button" aria-label="移除附件" onClick={() => setAttachment(null)}><Icon name="x" size={13} /></button>
                  </span>
                )}
                {selectedOption && (
                  <span className="context-chip recipe-chip">
                    <Icon name={selectedOption.icon} size={15} />
                    <span><b>{t('生成 ', 'Generate ')}{artifactLabel(selectedOption.kind, selectedOption.label)}</b><small>{selectedOption.description}</small></span>
                    <button type="button" aria-label={t('移除生成类型', 'Remove generation type')} onClick={() => setSelectedKind(null)}><Icon name="x" size={13} /></button>
                  </span>
                )}
              </div>
            )}

            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              disabled={sending}
              rows={1}
              placeholder={selectedOption ? t(`描述你想生成的${selectedOption.label}…`, `Describe the ${artifactLabel(selectedOption.kind, selectedOption.label)} you want…`) : attachment ? t('告诉我如何处理这份资料…', 'Tell me how to work with this material…') : t('输入你的学习目标或问题…', 'Describe your learning goal or question…')}
              aria-label={t('输入学习目标或问题', 'Learning goal or question')}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />

            {generateOpen && (
              <div className="generate-menu" role="menu" aria-label={t('选择生成资料类型', 'Choose generated material')}>
                <div className="generate-menu-head"><b>{t('常用生成', 'Common materials')}</b><span>{t('适用于任何问题或资料', 'For any question or learning material')}</span></div>
                <div className="generate-options">
                  {primaryArtifactOptions.map(item => (
                    <button key={item.kind} type="button" role="menuitem" onClick={() => chooseArtifact(item.kind)}>
                      <span><Icon name={item.icon} size={17} /></span>
                      <span><b>{artifactLabel(item.kind, item.label)}</b><small>{item.format}</small></span>
                    </button>
                  ))}
                </div>
                <button className="generate-menu-more" type="button" onClick={() => openGeneratorCatalog()}>
                  <span><b>{t('生成更多内容', 'Generate more')}</b><small>{t('按学习目的选择专业产物', 'Choose materials by learning goal')}</small></span>
                  <Icon name="chevron" size={16} />
                </button>
              </div>
            )}

            <div className="composer-tools">
              <input id="photo-input" className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={event => handleFile(event, 'image')} />
              <label className="composer-tool" htmlFor="photo-input"><Icon name="image" size={17} /><span>{t('拍题', 'Photo')}</span></label>

              <input id="file-input" className="visually-hidden" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,image/*" onChange={event => handleFile(event, 'file')} />
              <label className="composer-tool" htmlFor="file-input"><Icon name="paperclip" size={17} /><span>{t('上传', 'Upload')}</span></label>

              <button className={recording ? 'composer-tool active' : 'composer-tool'} type="button" onClick={toggleRecording} aria-pressed={recording}>
                <Icon name="mic" size={17} /><span>{recording ? t('结束', 'Stop') : t('语音', 'Voice')}</span>
              </button>

              <button className={generateOpen || selectedKind ? 'composer-tool active' : 'composer-tool'} type="button" onClick={() => setGenerateOpen(current => !current)} aria-expanded={generateOpen}>
                <Icon name="spark" size={17} /><span>{t('生成', 'Generate')}</span>
              </button>

              <button className="send-button" type="submit" aria-label={sending ? t('正在回答', 'Responding') : t('发送', 'Send')} disabled={!canSend}><Icon name="arrow-up" size={19} /></button>
            </div>
          </form>
        )}
      </main>

      {practiceRun && activePracticeQuestion && (
        <div className="practice-layer" role="presentation">
          <button className="practice-backdrop" aria-label="关闭练习测验" onClick={() => setPracticeRun(null)} />
          <section className="practice-sheet" role="dialog" aria-modal="true" aria-labelledby="practice-title">
            <header className="practice-head">
              <div>
                <span>{practiceRun.artifact.course} / {practiceRun.artifact.topic}</span>
                <h2 id="practice-title">{practiceRun.result ? '练习结果' : practiceRun.artifact.title}</h2>
                <small>{practiceRun.attempts.length > 0 ? `已完成 ${practiceRun.attempts.length} 次练习` : '共 5 题 · 提交后显示答案与解析'}</small>
              </div>
              <button className="icon-button" type="button" aria-label="关闭练习测验" onClick={() => setPracticeRun(null)}><Icon name="x" size={18} /></button>
            </header>

            {practiceRun.result ? (
              <div className="practice-result">
                <div className="practice-score">
                  <strong>{practiceRun.result.score}</strong><span>分</span>
                  <p>答对 {practiceRun.result.correct_count} / {practiceRun.result.total_count} 题</p>
                </div>
                <div className="practice-result-copy">
                  <h3>{practiceRun.result.score >= 80 ? '这一轮掌握得不错' : practiceRun.result.score >= 60 ? '核心内容正在形成' : '建议先补齐薄弱点再练一次'}</h3>
                  {practiceRun.result.weak_points.length > 0 ? (
                    <p>本次需要回看的知识点：{practiceRun.result.weak_points.join('、')}</p>
                  ) : <p>这次没有发现集中的薄弱点，可以尝试更高难度的练习。</p>}
                  {practiceRun.topicMastery !== null
                    ? <small>已回写主题掌握情况：{practiceRun.topicMastery}%</small>
                    : <small>保存到资料库后，会将本次成绩回写到这个主题。</small>}
                </div>

                <div className="practice-review-list" aria-label="逐题解析">
                  {practiceRun.practice.questions.map((question, index) => {
                    const result = practiceRun.result?.results.find(item => item.question_id === question.id)
                    return result && (
                      <article className={result.correct ? 'practice-review correct' : 'practice-review incorrect'} key={question.id}>
                        <span>{index + 1}</span>
                        <div>
                          <b>{result.correct ? '回答正确' : '需要复习'}</b>
                          <p>{question.prompt}</p>
                          {!result.correct && <small>正确答案：{result.correct_answer}</small>}
                          <em>{result.explanation}</em>
                        </div>
                      </article>
                    )
                  })}
                </div>

                <footer className="practice-result-actions">
                  <button type="button" onClick={restartPractice}><Icon name="restore" size={16} />再做一次</button>
                  {!practiceRun.artifact.saved ? (
                    <button className="primary" type="button" onClick={() => {
                      const artifact = practiceRun.artifact
                      setPracticeRun(null)
                      openSave(artifact)
                    }}><Icon name="save" size={16} />保存到资料库</button>
                  ) : (
                    <button className="primary" type="button" onClick={() => { setLibraryPreviewId(practiceRun.artifact.id); setView('library'); setPracticeRun(null) }}><Icon name="library" size={16} />查看资料库</button>
                  )}
                </footer>
              </div>
            ) : (
              <div className="practice-body">
                <div className="practice-navigation" aria-label="题目导航">
                  <span>已作答 {practiceAnsweredCount} / {practiceRun.practice.questions.length}</span>
                  <div>{practiceRun.practice.questions.map((question, index) => (
                    <button
                      key={question.id}
                      type="button"
                      aria-label={`第 ${index + 1} 题`}
                      aria-current={index === practiceRun.activeIndex ? 'step' : undefined}
                      className={`${index === practiceRun.activeIndex ? 'active' : ''} ${practiceRun.answers[question.id]?.trim() ? 'answered' : ''}`}
                      onClick={() => setPracticeRun(current => current ? { ...current, activeIndex: index } : current)}
                    >{index + 1}</button>
                  ))}</div>
                </div>

                <article className="practice-question">
                  <div className="practice-question-meta"><span>{activePracticeQuestion.type === 'fill_blank' ? '短填空' : activePracticeQuestion.type === 'true_false' ? '判断题' : '单选题'}</span><b>{activePracticeQuestion.knowledge_point}</b></div>
                  <h3>{activePracticeQuestion.prompt}</h3>
                  {activePracticeQuestion.type === 'fill_blank' ? (
                    <label className="practice-fill">
                      <span>你的答案</span>
                      <input
                        value={practiceRun.answers[activePracticeQuestion.id] || ''}
                        onChange={event => answerPracticeQuestion(activePracticeQuestion.id, event.target.value)}
                        placeholder="输入简短答案"
                        autoFocus
                      />
                    </label>
                  ) : (
                    <div className="practice-options" role="radiogroup" aria-label="选择答案">
                      {activePracticeQuestion.options.map((option, index) => {
                        const selected = practiceRun.answers[activePracticeQuestion.id] === option
                        return (
                          <label className={selected ? 'selected' : ''} key={option}>
                            <input
                              type="radio"
                              name={activePracticeQuestion.id}
                              value={option}
                              checked={selected}
                              onChange={() => answerPracticeQuestion(activePracticeQuestion.id, option)}
                            />
                            <span>{String.fromCharCode(65 + index)}</span><b>{option}</b>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </article>

                <footer className="practice-actions">
                  <button type="button" disabled={practiceRun.activeIndex === 0} onClick={() => setPracticeRun(current => current ? { ...current, activeIndex: current.activeIndex - 1 } : current)}>上一题</button>
                  {practiceRun.activeIndex < practiceRun.practice.questions.length - 1 ? (
                    <button className="primary" type="button" onClick={() => setPracticeRun(current => current ? { ...current, activeIndex: current.activeIndex + 1 } : current)}>下一题<Icon name="chevron" size={15} /></button>
                  ) : (
                    <button className="primary" type="button" disabled={practiceSubmitting} onClick={() => void submitPractice()}><Icon name="check" size={15} />{practiceSubmitting ? '批改中…' : '提交练习'}</button>
                  )}
                </footer>
              </div>
            )}
          </section>
        </div>
      )}

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
        <div className="settings-popover-layer">
          <button className="settings-popover-backdrop" aria-label={t('关闭界面设置', 'Close interface settings')} onClick={closeSettings} />
          <aside className="settings-popover" role="dialog" aria-modal="true" aria-label={t('界面设置', 'Interface settings')}>
            {settingsView === 'menu' ? (
              <div className="settings-menu">
                <button type="button" onClick={() => setSettingsView('language')}>
                  <Languages size={19} strokeWidth={1.8} />
                  <span><b>{t('界面语言', 'Language')}</b><small>{interfaceLanguage === 'en' ? 'English' : '简体中文'}</small></span>
                  <ChevronRight size={17} strokeWidth={1.8} />
                </button>
                <button type="button" onClick={() => setSettingsView('theme')}>
                  <Palette size={19} strokeWidth={1.8} />
                  <span><b>{t('界面主题', 'Theme')}</b><small>{t(activeInterfaceStyle.label, activeInterfaceStyle.labelEn)}</small></span>
                  <ChevronRight size={17} strokeWidth={1.8} />
                </button>
                <button type="button" onClick={() => setSettingsView('scale')}>
                  <ZoomIn size={19} strokeWidth={1.8} />
                  <span><b>{t('界面缩放', 'Interface scale')}</b><small>{activeInterfaceScale.label}</small></span>
                  <ChevronRight size={17} strokeWidth={1.8} />
                </button>
              </div>
            ) : (
              <div className="settings-submenu">
                <div className="settings-submenu-head">
                  <button type="button" className="settings-back" onClick={() => setSettingsView('menu')} aria-label={t('返回界面设置', 'Back to settings')}><ArrowLeft size={17} strokeWidth={1.8} /></button>
                  <div>
                    <h2>{settingsView === 'language' ? t('界面语言', 'Language') : settingsView === 'theme' ? t('界面主题', 'Theme') : t('界面缩放', 'Interface scale')}</h2>
                    <p>{settingsView === 'language'
                      ? t('只切换产品操作界面，学习内容保持原语言。', 'Only app controls change. Learning content stays in its original language.')
                      : settingsView === 'theme'
                        ? t('14 套完整界面风格，默认是白底黑字。', '14 complete interface styles. Minimal is white with black type.')
                        : t('同时调整字体和操作控件的阅读尺寸。', 'Scales text and controls together for easier reading.')}</p>
                  </div>
                  <button type="button" className="settings-close" aria-label={t('关闭界面设置', 'Close interface settings')} onClick={closeSettings}><Icon name="x" size={17} /></button>
                </div>

                {settingsView === 'language' && (
                  <div className="settings-choice-list" role="radiogroup" aria-label={t('选择界面语言', 'Choose interface language')}>
                    <button type="button" role="radio" aria-checked={interfaceLanguage === 'zh-CN'} onClick={() => setInterfaceLanguage('zh-CN')}>
                      <span><b>简体中文</b><small>中文界面</small></span>
                      {interfaceLanguage === 'zh-CN' && <Check size={17} strokeWidth={2} />}
                    </button>
                    <button type="button" role="radio" aria-checked={interfaceLanguage === 'en'} onClick={() => setInterfaceLanguage('en')}>
                      <span><b>English</b><small>English interface</small></span>
                      {interfaceLanguage === 'en' && <Check size={17} strokeWidth={2} />}
                    </button>
                  </div>
                )}

                {settingsView === 'theme' && (
                  <div className="settings-theme-grid" role="radiogroup" aria-label={t('选择界面主题', 'Choose interface theme')}>
                    {interfaceStyles.map(item => (
                      <button key={item.id} type="button" role="radio" aria-checked={interfaceStyle === item.id} className={interfaceStyle === item.id ? 'settings-theme-option selected' : 'settings-theme-option'} onClick={() => setInterfaceStyle(item.id)}>
                        <span className="style-preview" data-preview={item.id} />
                        <span><b>{t(item.label, item.labelEn)}</b><small>{t(item.description, item.descriptionEn)}</small></span>
                        {interfaceStyle === item.id && <Check size={15} strokeWidth={2} />}
                      </button>
                    ))}
                  </div>
                )}

                {settingsView === 'scale' && (
                  <div className="settings-choice-list" role="radiogroup" aria-label={t('选择界面缩放', 'Choose interface scale')}>
                    {interfaceScales.map(item => (
                      <button key={item.value} type="button" role="radio" aria-checked={interfaceScale === item.value} onClick={() => setInterfaceScale(item.value)}>
                        <span><b>{item.label}</b><small>{t(item.description, ({ 90: 'Compact', 100: 'Default', 110: 'Comfortable', 120: 'Large', 130: 'Largest' } as Record<InterfaceScale, string>)[item.value])}</small></span>
                        {interfaceScale === item.value && <Check size={17} strokeWidth={2} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
