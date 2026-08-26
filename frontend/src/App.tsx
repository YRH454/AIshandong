import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, FormEvent } from 'react'
import {
  Archive, ArrowLeft, ArrowUp, AudioLines, BookOpen, Check, ChevronRight, CirclePlay, ClipboardCheck,
  Code2, FileDown, FileQuestion, FileText, FolderOpen, History, House, Image, LayoutTemplate, Library, Map as MapIcon,
  Languages, ListChecks, Menu, Mic, NotebookTabs, Palette, Paperclip, PenLine, Presentation, RotateCcw, Save, Search,
  Ellipsis, Pin, Share2, SlidersHorizontal, Sparkles, Star, Tags, Trash2, Trees, Video, Waves, X, ZoomIn,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import mascot from './assets/xuejing-slime-logo.png'
import type { KnowledgeMapVisualScene, KnowledgeMapVisualSceneKind } from './components/EditableKnowledgeMap'
import { G6KnowledgeMap } from './components/G6KnowledgeMap'
import type { KnowledgeMapSemanticRole } from './components/knowledgeMapSemantic'

type KnowledgeMapSceneDirection = NonNullable<KnowledgeMapVisualScene['design']>
type KnowledgeMapSceneComposition = NonNullable<KnowledgeMapSceneDirection['composition']>
type KnowledgeMapSceneVisualLanguage = NonNullable<KnowledgeMapSceneDirection['visual_language']>
import { DynamicExplanationPlayer, type DynamicExplanationProgress } from './components/DynamicExplanationPlayer'
import { LearningDocumentBooklet, type StudyBookletDocument } from './components/LearningDocumentBooklet'
import { PracticePackBooklet, type PracticePackEntry } from './components/PracticePackBooklet'
import { parseDynamicExplanation, type DynamicExplanationData, type DynamicExplanationScene } from './components/dynamicExplanation'
import {
  createImageAnalysisArtifact,
  collaborateKnowledgeMap,
  deleteTutorSession,
  favoriteLearningArtifact,
  findLearningArtifactDuplicates,
  generateLearningDocument,
  generateStudyPackBlueprint,
  generateKnowledgeMap,
  generateKnowledgeMapDeepDive,
  generateKnowledgeMapPack,
  generatePracticeSet,
  getKnowledgeMapProgress,
  getGenerationJob,
  getInteractivePresentationProgress,
  getLearningArtifacts,
  getLearningArtifactVersions,
  getLibraryTopicLearningState,
  getLibraryTopicReviews,
  getTopicStudyPlan,
  getPracticeForArtifact,
  getTutorHistory,
  getTutorSessions,
  generateDynamicExplanation,
  permanentlyDeleteLearningArtifact,
  readTutorStream,
  recordInteractivePresentationCheckpoint,
  recordLearningActivity,
  restoreLearningArtifact,
  restoreLearningArtifactVersion,
  saveExternalVideoResource,
  saveLearningArtifact,
  saveDocumentPack,
  savePracticePack,
  saveLearningLoop,
  searchExternalVideos,
  speechToText,
  startTopicStudyPlan,
  submitPracticeAttempt,
  streamTutorChat,
  trashLearningArtifact,
  updateKnowledgeMap,
  updateKnowledgeMapNodeProgress,
  updateKnowledgeMapWorkspaceProgress,
  updateInteractivePresentation,
  updateInteractivePresentationProgress,
  updateLearningArtifact,
  updateTopicStudyPlanTask,
  updateTutorSession,
  waitForGenerationJob,
  regenerateInteractivePresentationScene,
} from './services/api'
import type {
  DynamicExplanationJobProgress, ExternalVideoResource, GenerationJob, ImageStudyAnalysis, InteractivePresentationProgress, KnowledgeMapCollaboration, KnowledgeMapCollaborationSuggestion, KnowledgeMapNodeStatus, KnowledgeMapPackProgress, KnowledgeMapPackResult, KnowledgeMapProgress, LearningArtifactRecord, LearningState, LibraryTopicLearningState, LibraryTopicReview, PracticeAttemptResult, PracticeAttemptSummary,
  PracticeMode, PracticeSetRecord, StudyPackBlueprint, TopicStudyPlan, TopicStudyPlanTask, TutorMessage, TutorSessionSummary,
} from './services/api'
import './App.css'
import './theme-worlds.css'
import './knowledge-map-worlds.css'

const LearningHouse = lazy(() => import('./components/LearningHouse'))

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
  | 'house'
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
  | 'rotate'
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
  | 'notes' | 'practice' | 'map' | 'interactive' | 'video' | 'external_video'
  | 'summary' | 'question' | 'compare' | 'audio'
  | 'chapter' | 'page-guide' | 'formula' | 'glossary' | 'study-pack' | 'plan'
  | 'similar' | 'variants' | 'special' | 'mock' | 'coding' | 'oral'
  | 'cards' | 'review' | 'mistakes' | 'cram' | 'checklist'
  | 'report' | 'slides' | 'infographic' | 'webpage'
type InterfaceStyleId =
  | 'minimal' | 'study' | 'night' | 'editorial' | 'brutalist' | 'glass' | 'terminal'
  | 'swiss' | 'notebook' | 'pixel' | 'gallery' | 'ink' | 'candy' | 'blueprint'
  | 'newsroom' | 'os95' | 'stationery' | 'architecture' | 'naturalist' | 'manga'
type InterfaceLanguage = 'zh-CN' | 'en'
type InterfaceScale = 90 | 100 | 110 | 120 | 130
type SettingsView = 'menu' | 'language' | 'theme' | 'scale'
type SessionMenuMode = 'menu' | 'rename' | 'delete'
type DeferredSessionChange = {
  title?: string
  is_pinned?: boolean
  deleted?: boolean
}

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
  documentTemplate?: LearningArtifactRecord['document_template']
  sourceMapArtifactId?: number
  learningLoopId?: string
  learningLoopStep?: LearningLoopStep
  documentPackId?: string
  documentPackTemplate?: DocumentTemplateId
  practicePackId?: string
  practicePackMode?: Exclude<PracticeMode, 'standard'>
  generationProgress?: DynamicExplanationJobProgress
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
  parent_id?: string
  semantic_role?: KnowledgeMapSemanticRole
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
  map_type?: 'concept_tree' | 'process_flow' | 'comparison_map' | 'system_map' | 'timeline_map' | 'causal_map' | 'relationship_map' | 'decision_map' | 'lab_map'
  groups?: string[]
  nodes: KnowledgeMapNode[]
  edges: Array<{ from: string; to: string; label?: string }>
  learning_path: string[]
  visual_scenes?: KnowledgeMapVisualScene[]
  deep_maps?: Record<string, KnowledgeMapDeepDive>
}

type KnowledgeMapDeepDive = Omit<KnowledgeMapData, 'deep_maps'> & {
  source_node_id: string
  title: string
  summary: string
  generated_at?: string
  generation_source?: 'agent' | 'fallback' | 'local'
  source_fingerprint?: string
}

type KnowledgeMapProgressState = Pick<KnowledgeMapProgress, 'progress' | 'summary' | 'exploration'>

type KnowledgeMapPackJobState = KnowledgeMapPackProgress & {
  jobId: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  error?: string
}

const MAP_PACK_JOBS_STORAGE_KEY = 'rhyme-map-pack-jobs'

function readStoredMapPackJobs(): Record<string, string> {
  try {
    const value = JSON.parse(localStorage.getItem(MAP_PACK_JOBS_STORAGE_KEY) || '{}')
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

function writeStoredMapPackJob(artifactId: number, jobId?: string) {
  const stored = readStoredMapPackJobs()
  if (jobId) stored[String(artifactId)] = jobId
  else delete stored[String(artifactId)]
  localStorage.setItem(MAP_PACK_JOBS_STORAGE_KEY, JSON.stringify(stored))
}

type StoredDynamicExplanationJob = {
  jobId: string
  turnId: string
  sessionId: number
  loadingId: string
  createdAt: number
  status?: 'failed'
  error?: string
  errorCode?: string
  retryable?: boolean
}

const DYNAMIC_EXPLANATION_JOBS_STORAGE_KEY = 'rhyme-dynamic-explanation-jobs'

function readStoredDynamicExplanationJobs(): Record<string, StoredDynamicExplanationJob> {
  try {
    const value = JSON.parse(localStorage.getItem(DYNAMIC_EXPLANATION_JOBS_STORAGE_KEY) || '{}')
    if (!value || typeof value !== 'object') return {}
    return Object.fromEntries(Object.entries(value).filter(([, item]) => {
      if (!item || typeof item !== 'object') return false
      const task = item as Partial<StoredDynamicExplanationJob>
      return typeof task.jobId === 'string'
        && typeof task.turnId === 'string'
        && typeof task.sessionId === 'number'
        && typeof task.loadingId === 'string'
        && typeof task.createdAt === 'number'
    })) as Record<string, StoredDynamicExplanationJob>
  } catch {
    return {}
  }
}

function writeStoredDynamicExplanationJob(task: StoredDynamicExplanationJob) {
  const stored = readStoredDynamicExplanationJobs()
  stored[task.loadingId] = task
  localStorage.setItem(DYNAMIC_EXPLANATION_JOBS_STORAGE_KEY, JSON.stringify(stored))
}

function removeStoredDynamicExplanationJob(loadingId: string) {
  const stored = readStoredDynamicExplanationJobs()
  if (!(loadingId in stored)) return
  delete stored[loadingId]
  localStorage.setItem(DYNAMIC_EXPLANATION_JOBS_STORAGE_KEY, JSON.stringify(stored))
}

type BackgroundGenerationKind = 'notes' | 'practice' | 'map' | 'video'

type BackgroundTaskProgress = {
  label?: string
  message?: string
  percent?: number
}

type StoredBackgroundGenerationTask = {
  loadingId: string
  kind: BackgroundGenerationKind
  turnId: string
  sessionId: number
  createdAt: number
  jobId?: string
  status?: 'failed' | 'completed'
  error?: string
  errorCode?: string
  retryable?: boolean
  course: string
  topic: string
  title: string
  resultArtifactId?: string
  progress?: BackgroundTaskProgress
  documentTemplate?: LearningArtifactRecord['document_template']
  practiceMode?: PracticeMode
  sourceMapArtifactId?: number
  focusPoints?: string[]
  videoContext?: VideoSearchContext
  videoResultCount?: number
  videoSearchUrl?: string
  videoResults?: ExternalVideoResource[]
}

const BACKGROUND_GENERATION_TASKS_STORAGE_KEY = 'rhyme-background-generation-tasks'

function readStoredBackgroundGenerationTasks(): Record<string, StoredBackgroundGenerationTask> {
  try {
    const value = JSON.parse(localStorage.getItem(BACKGROUND_GENERATION_TASKS_STORAGE_KEY) || '{}')
    if (!value || typeof value !== 'object') return {}
    return Object.fromEntries(Object.entries(value).filter(([, item]) => {
      if (!item || typeof item !== 'object') return false
      const task = item as Partial<StoredBackgroundGenerationTask>
      return typeof task.loadingId === 'string'
        && ['notes', 'practice', 'map', 'video'].includes(String(task.kind))
        && typeof task.turnId === 'string'
        && typeof task.sessionId === 'number'
        && typeof task.createdAt === 'number'
        && typeof task.course === 'string'
        && typeof task.topic === 'string'
        && typeof task.title === 'string'
    })) as Record<string, StoredBackgroundGenerationTask>
  } catch {
    return {}
  }
}

function writeStoredBackgroundGenerationTask(task: StoredBackgroundGenerationTask) {
  const stored = readStoredBackgroundGenerationTasks()
  stored[task.loadingId] = task
  const retained = Object.values(stored)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 36)
    .reduce<Record<string, StoredBackgroundGenerationTask>>((items, item) => {
      items[item.loadingId] = item
      return items
    }, {})
  localStorage.setItem(BACKGROUND_GENERATION_TASKS_STORAGE_KEY, JSON.stringify(retained))
}

function removeStoredBackgroundGenerationTask(loadingId: string) {
  const stored = readStoredBackgroundGenerationTasks()
  if (!(loadingId in stored)) return
  delete stored[loadingId]
  localStorage.setItem(BACKGROUND_GENERATION_TASKS_STORAGE_KEY, JSON.stringify(stored))
}

type DocumentPurpose = 'review' | 'preview' | 'exam'
type DocumentDepth = 'concise' | 'standard' | 'deep'
type DocumentStyle = 'plain' | 'notes' | 'exam'
type DocumentTemplateId = LearningArtifactRecord['document_template']
type DocumentSetup = {
  turnId: string
  template: DocumentTemplateId
}

type DocumentPackSetup = {
  turnId: string
  templates: DocumentTemplateId[]
}

type DocumentPackPlanningState = {
  packId: string
  templates: DocumentTemplateId[]
}

type LearningLoopStep = 'notes' | 'map' | 'interactive' | 'practice'
type LearningLoopSaveTarget = {
  turnId: string
  loopId: string
  artifacts: Artifact[]
}

type DocumentPackSaveTarget = {
  turnId: string
  packId: string
  artifacts: Artifact[]
}

type DocumentPackBookletTarget = {
  packId: string
  turnId?: string
  artifactIds: string[]
  artifacts: Artifact[]
  course: string
  topic: string
  persisted: boolean
}

type VideoSearchContext = {
  turnId?: string
  sessionId: number
  query: string
  course: string
  topic: string
}

type ExternalVideoSaveTarget = {
  video: ExternalVideoResource
  context: VideoSearchContext
}

type InlineVideoSearch = {
  context: VideoSearchContext
  results: ExternalVideoResource[]
  searchUrl: string
  loading: boolean
  error: string
  taskId?: string
}

type ExternalVideoContent = {
  platform: 'bilibili'
  platform_label: string
  url: string
  cover_url?: string
  creator?: string
  duration?: string
  view_count?: string
  description?: string
  search_query?: string
}

const learningLoopSteps: Array<{
  kind: LearningLoopStep
  label: string
  labelEn: string
  detail: string
  detailEn: string
  generating: string
  generatingEn: string
}> = [
  { kind: 'notes', label: '学习文档', labelEn: 'Learning document', detail: '先建立概念与重点', detailEn: 'Build the core understanding', generating: '正在整理讲义', generatingEn: 'Preparing the guide' },
  { kind: 'map', label: '知识图解', labelEn: 'Knowledge map', detail: '再梳理关系与脉络', detailEn: 'Connect relationships and structure', generating: '正在搭建图解', generatingEn: 'Building the map' },
  { kind: 'interactive', label: '动态讲解', labelEn: 'Interactive explanation', detail: '用场景推演形成直觉', detailEn: 'Build intuition through scenes', generating: '正在编排讲解', generatingEn: 'Staging the explanation' },
  { kind: 'practice', label: '练习检验', labelEn: 'Practice check', detail: '最后检验并定位薄弱点', detailEn: 'Check mastery and locate weak points', generating: '等待图解后生成练习', generatingEn: 'Waiting for the map, then building practice' },
]

type PracticeRun = {
  artifact: Artifact
  practice: PracticeSetRecord
  attempts: PracticeAttemptSummary[]
  answers: Record<string, string>
  activeIndex: number
  result: PracticeAttemptResult | null
  topicMastery: number | null
  codeDrafts: Record<string, string>
  codeTestChecks: Record<string, string[]>
  oralRecordingQuestionId: string | null
  remainingSeconds?: number
}

type PracticePackSaveTarget = {
  turnId: string
  packId: string
  artifacts: Artifact[]
}

type PracticePackBookletTarget = {
  packId: string
  turnId?: string
  artifactIds: string[]
  artifacts: Artifact[]
  course: string
  topic: string
  persisted: boolean
}

type PracticeProfile = {
  mode: PracticeMode
  label: string
  description: string
  count: number
  minutes: number
  icon: IconName
}

const practiceProfiles: Record<PracticeMode, PracticeProfile> = {
  standard: { mode: 'standard', label: '基础练习', description: '用核心题目检查当前理解', count: 5, minutes: 8, icon: 'file-question' },
  similar: { mode: 'similar', label: '同类题', description: '保留结构，更换数据与表述', count: 6, minutes: 10, icon: 'file-question' },
  variants: { mode: 'variants', label: '变式题', description: '改变条件与边界，检验迁移', count: 6, minutes: 12, icon: 'spark' },
  special: { mode: 'special', label: '专项训练', description: '围绕薄弱点递进补强', count: 8, minutes: 15, icon: 'clipboard' },
  mock: { mode: 'mock', label: '模拟试卷', description: '限时完成一轮综合测验', count: 12, minutes: 20, icon: 'file' },
  coding: { mode: 'coding', label: '编程实验', description: '代码任务、提示与测试用例', count: 3, minutes: 25, icon: 'code' },
  oral: { mode: 'oral', label: '口述测验', description: '用自己的话解释，再接受追问', count: 4, minutes: 10, icon: 'mic' },
}

const practiceSetupModes: Array<Exclude<PracticeMode, 'standard'>> = ['similar', 'variants', 'special', 'mock', 'coding', 'oral']

function createPracticeRun(
  artifact: Artifact,
  practice: PracticeSetRecord,
  attempts: PracticeAttemptSummary[] = [],
  topicMastery: number | null = null,
): PracticeRun {
  return {
    artifact,
    practice,
    attempts,
    answers: {},
    activeIndex: 0,
    result: null,
    topicMastery,
    codeDrafts: Object.fromEntries(practice.questions
      .filter(question => question.type === 'code_task')
      .map(question => [question.id, question.starter_code || ''])),
    codeTestChecks: {},
    oralRecordingQuestionId: null,
    remainingSeconds: practice.practice_mode === 'mock' ? practice.estimated_minutes * 60 : undefined,
  }
}

const LOCAL_USER_ID = 1
const DEFERRED_SESSION_CHANGES_KEY = `rhyme-deferred-session-changes-${LOCAL_USER_ID}`
const emptyLearningState: LearningState = {
  subject: '',
  goal: '',
  knowledge_points: [],
  weak_points: [],
  deadline: '',
  level: '',
  current_topic: '',
}

function readDeferredSessionChanges(): Record<number, DeferredSessionChange> {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEFERRED_SESSION_CHANGES_KEY) || '{}') as Record<string, DeferredSessionChange>
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([id, change]) => Number.isInteger(Number(id)) && change && typeof change === 'object')
        .map(([id, change]) => [Number(id), change]),
    )
  } catch {
    return {}
  }
}

function writeDeferredSessionChanges(changes: Record<number, DeferredSessionChange>) {
  localStorage.setItem(DEFERRED_SESSION_CHANGES_KEY, JSON.stringify(changes))
}

function isTemporarySessionMutationFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /(^|\D)(404|405|502|503|504)(\D|$)|method not allowed|not found|failed to fetch|network|networkerror|网络/i.test(message)
}

async function copyPlainText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Some browsers disallow the async Clipboard API on an insecure local page.
    }
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copied) throw new Error('浏览器阻止了复制，请允许剪贴板权限后重试。')
}

function sortTutorSessions(sessions: TutorSessionSummary[]) {
  return [...sessions].sort((left, right) => {
    if (left.is_pinned !== right.is_pinned) return Number(right.is_pinned) - Number(left.is_pinned)
    return (Date.parse(right.updated_at) || 0) - (Date.parse(left.updated_at) || 0)
  })
}

type DocumentTemplateDefinition = {
  id: DocumentTemplateId
  label: string
  labelEn: string
  description: string
  descriptionEn: string
  group: 'understand' | 'organize' | 'review'
  icon: IconName
}

const documentTemplates: DocumentTemplateDefinition[] = [
  { id: 'quick_overview', label: '一页速览', labelEn: 'Quick overview', description: '两分钟抓住主线、重点和下一步', descriptionEn: 'The main thread, essentials, and next step in two minutes', group: 'understand', icon: 'file' },
  { id: 'problem_walkthrough', label: '题目精讲', labelEn: 'Problem walkthrough', description: '从条件、思路到易错路径逐步拆开', descriptionEn: 'Unpack conditions, reasoning, and common wrong paths', group: 'understand', icon: 'file-question' },
  { id: 'concept_comparison', label: '概念对比', labelEn: 'Concept comparison', description: '用对照表分清相近概念与边界', descriptionEn: 'Separate similar concepts with a useful comparison', group: 'understand', icon: 'layout' },
  { id: 'system_guide', label: '系统讲义', labelEn: 'System guide', description: '完整整理知识结构、例子和自测', descriptionEn: 'A durable guide with structure, examples, and checks', group: 'organize', icon: 'notebook' },
  { id: 'formula_handbook', label: '公式手册', labelEn: 'Formula handbook', description: '公式、符号、条件与典型应用', descriptionEn: 'Formulas, notation, conditions, and applications', group: 'organize', icon: 'clipboard' },
  { id: 'glossary', label: '术语表', labelEn: 'Glossary', description: '术语定义、英文、关联与易混点', descriptionEn: 'Terms, English names, connections, and confusions', group: 'organize', icon: 'tags' },
  { id: 'exam_cram', label: '考前速记', labelEn: 'Exam cram', description: '压缩高频结论、陷阱和答题句式', descriptionEn: 'High-yield conclusions, traps, and answer phrasing', group: 'review', icon: 'spark' },
]

const documentTemplateGroups = [
  { id: 'understand', label: '快速理解', labelEn: 'Understand quickly' },
  { id: 'organize', label: '系统整理', labelEn: 'Organize systematically' },
  { id: 'review', label: '考前复习', labelEn: 'Review before an exam' },
] as const

const documentTemplateById = Object.fromEntries(
  documentTemplates.map(template => [template.id, template]),
) as Record<DocumentTemplateId, DocumentTemplateDefinition>

function recommendDocumentTemplate(prompt = '', response = ''): DocumentTemplateId {
  const source = `${prompt}\n${response}`.toLowerCase()
  if (/(考前速记|考前冲刺|最后.{0,6}分钟|背诵清单|临考)/.test(source)) return 'exam_cram'
  if (/(公式|定理|方程|函数|导数|积分|矩阵|概率|计算)/.test(source)) return 'formula_handbook'
  if (/(区别|对比|比较|不同|异同|vs\.?)/.test(source)) return 'concept_comparison'
  if (/(题目|例题|求解|怎么算|解题|为什么选|证明)/.test(source)) return 'problem_walkthrough'
  if (/(术语|名词|概念.*英文|英文.*概念|缩写)/.test(source)) return 'glossary'
  if (/(总结|速览|一页|简要|简单说|快速了解|通俗|是什么|基础)/.test(source)) return 'quick_overview'
  return 'system_guide'
}

const defaultDocumentSetup = (turnId: string, prompt = '', response = ''): DocumentSetup => ({
  turnId,
  template: recommendDocumentTemplate(prompt, response),
})

function recommendedDocumentPackTemplates(prompt = '', response = ''): DocumentTemplateId[] {
  const source = `${prompt}\n${response}`.toLowerCase()
  const templates: DocumentTemplateId[] = ['system_guide', 'formula_handbook', 'glossary', 'exam_cram']
  if (/(题目|例题|求解|怎么计算|解题|证明)/.test(source)) templates.splice(1, 0, 'problem_walkthrough')
  if (/(区别|对比|比较|不同|异同|vs\.?)/.test(source)) templates.splice(1, 0, 'concept_comparison')
  return templates
}

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
  house: House,
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
  rotate: RotateCcw,
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
  { id: 'newsroom', label: '报刊编辑部', labelEn: 'Newsroom', description: '紧凑栏线、报头与新闻纸', descriptionEn: 'Dense rules, mastheads, and newsprint', icon: 'file' },
  { id: 'os95', label: '复古操作系统', labelEn: 'Retro OS', description: '桌面窗口、浮雕按钮与标题栏', descriptionEn: 'Desktop windows, bevels, and title bars', icon: 'code' },
  { id: 'stationery', label: '日系文具', labelEn: 'Japanese stationery', description: '便签、点阵纸与轻盈标签', descriptionEn: 'Sticky notes, dot paper, and light tabs', icon: 'notebook' },
  { id: 'architecture', label: '现代建筑', labelEn: 'Modern architecture', description: '混凝土、模数网格与大尺度留白', descriptionEn: 'Concrete, modular grids, and spatial calm', icon: 'layout' },
  { id: 'naturalist', label: '自然博物志', labelEn: 'Naturalist', description: '标本册、植物墨色与档案标签', descriptionEn: 'Specimen pages, botanical ink, and archive labels', icon: 'trees' },
  { id: 'manga', label: '黑白漫画', labelEn: 'Monochrome manga', description: '网点、对白框与强烈分镜', descriptionEn: 'Halftone, speech panels, and bold framing', icon: 'image' },
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
    kind: 'external_video', label: '课程视频', description: '查找可直接观看的 B站课程', icon: 'video', category: 'universal', format: 'B站 · 原视频',
    title: '课程视频', summary: 'B站检索 · 原视频链接 · 可收藏', details: ['按当前课程和主题查找真实视频', '直接打开原视频页面，不下载或搬运', '收藏后可从资料库继续学习'],
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

function expandLegacyKnowledgeMap(nodes: KnowledgeMapNode[], edges: KnowledgeMapData['edges']) {
  const core = nodes.find(node => node.role === 'core') || nodes[0]
  const alreadyCompactOverview = Boolean(core) && nodes.length <= 10 && nodes
    .filter(node => node.id !== core.id)
    .every(node => node.parent_id === core.id)
  if (!core || alreadyCompactOverview) return { nodes, edges, expanded: false }

  // Older maps may be six broad cards or a dense multi-level tree.  Preserve
  // their strongest first-level facts in a nine-atom overview so learners do
  // not need to regenerate saved material to get the new reading layout.
  const branches = nodes.filter(node => node.id !== core.id).slice(0, 5)
  const normalizedBranches = branches.map((node, index) => ({
    ...node,
    role: 'branch' as const,
    parent_id: core.id,
    order: index + 2,
    position: undefined,
  }))
  const atomTemplates = (node: KnowledgeMapNode) => {
    const visual = node.visual || {}
    const detail = node.detail || node.example || `${node.label}与当前主题的关系。`
    const example = node.example || detail
    const common = { detail, example, mistake: node.mistake || '回到前提和当前步骤，再确认一次。' }
    switch (node.kind) {
      case 'principle': return [
        { label: '必要条件', ...common, visual: { kind: 'formula' as const, headline: visual.headline || '条件成立，规则才可使用', formula: visual.formula || '条件 → 规则 → 结果' } },
        { label: '关系变化', ...common, visual: { kind: 'comparison' as const, headline: '看清因果关系', before: visual.before || '输入与前提', after: visual.after || '规则与结论' } },
      ]
      case 'process': return [
        { label: '起始判断', ...common, visual: { kind: 'sequence' as const, headline: '先确定从哪里开始', items: visual.items?.length ? visual.items : ['读取输入', '核对条件', '确定起点'] } },
        { label: '状态变化', ...common, visual: { kind: 'stack' as const, headline: '每一步只改变一个状态', items: visual.items?.length ? visual.items : ['当前状态', '执行规则', '下一状态'] } },
        { label: '结果校验', ...common, visual: { kind: 'input_output' as const, headline: '输出要回到题目要求', input: visual.input || '执行后的状态', output: visual.output || '满足条件的结果' } },
      ]
      case 'example': return [
        { label: '最小案例', ...common, visual: { kind: 'input_output' as const, headline: visual.headline || '用最小输入验证', input: visual.input || '一个具体输入', output: visual.output || example.slice(0, 56) } },
        { label: '变式验证', ...common, visual: { kind: 'comparison' as const, headline: '改变条件，再验证规则', before: visual.before || '原情境', after: visual.after || '变式情境' } },
      ]
      case 'pitfall': return [
        { label: '错误路径', ...common, visual: { kind: 'warning' as const, headline: visual.headline || node.mistake || '先检查遗漏的前提' } },
        { label: '纠正动作', ...common, visual: { kind: 'sequence' as const, headline: '定位 → 回退 → 验证', items: ['定位遗漏', '回到前一步', '重新验证'] } },
      ]
      default: return [
        { label: '关键词', ...common, visual: { kind: 'definition' as const, headline: visual.headline || detail.slice(0, 66), items: visual.items?.length ? visual.items : ['名称', '含义', '边界'] } },
        { label: '概念辨析', ...common, visual: { kind: 'comparison' as const, headline: '先分清它和相近概念', before: visual.before || '相似说法', after: visual.after || '适用边界' } },
      ]
    }
  }
  // The first generation is deliberately an overview, not a second hidden
  // map squeezed inside the first.  Keep it at nine visible atoms; deeper
  // expansion belongs to the next interaction the learner explicitly asks for.
  const atomNodes: KnowledgeMapNode[] = normalizedBranches
    .filter(branch => ['foundation', 'principle', 'process'].includes(branch.kind || 'foundation'))
    .slice(0, 3)
    .map((branch, index) => {
      const template = atomTemplates(branch)[0]
      return {
        id: `legacy-${branch.id}-overview`,
        parent_id: core.id,
        role: 'branch' as const,
        kind: branch.kind || 'foundation',
        group: branch.group,
        order: 7 + index,
        label: `${branch.label}·${template.label}`.slice(0, 24),
        detail: template.detail,
        example: template.example,
        mistake: template.mistake,
        visual: template.visual,
      }
    })
  const edgeKeys = new Set<string>()
  const expandedEdges: KnowledgeMapData['edges'] = []
  const addEdge = (from: string, to: string, label = '') => {
    const key = `${from}|${to}`
    if (!edgeKeys.has(key) && from !== to) { edgeKeys.add(key); expandedEdges.push({ from, to, label }) }
  }
  edges.forEach(edge => addEdge(edge.from, edge.to, edge.label || ''))
  normalizedBranches.forEach(branch => addEdge(core.id, branch.id, ''))
  atomNodes.forEach(atom => addEdge(core.id, atom.id, ''))
  const overviewIds = new Set([core.id, ...normalizedBranches.map(node => node.id), ...atomNodes.map(node => node.id)])
  return {
    nodes: [{ ...core, role: 'core' as const, position: undefined }, ...normalizedBranches, ...atomNodes],
    edges: expandedEdges.filter(edge => overviewIds.has(edge.from) && overviewIds.has(edge.to)),
    expanded: true,
  }
}

function parseKnowledgeMap(content?: string): KnowledgeMapData | null {
  if (!content) return null
  try {
    const raw = JSON.parse(content) as Partial<KnowledgeMapData>
    if (!Array.isArray(raw.nodes) || raw.nodes.length < 3) return null
    const parsedNodes = raw.nodes
      .filter((node): node is KnowledgeMapNode => Boolean(node?.id && node?.label))
      .slice(0, 24)
      .map((node, index) => ({
        id: String(node.id),
        label: String(node.label).slice(0, 24),
        role: (node.role === 'core' || node.role === 'detail' ? node.role : index === 0 ? 'core' : 'branch') as KnowledgeMapNode['role'],
        kind: ['core', 'foundation', 'principle', 'process', 'example', 'pitfall'].includes(String(node.kind))
          ? String(node.kind) as NonNullable<KnowledgeMapNode['kind']>
          : undefined,
        group: node.group ? String(node.group).slice(0, 20) : undefined,
        order: Number.isFinite(Number(node.order)) ? Math.max(1, Math.min(24, Number(node.order))) : undefined,
        parent_id: node.parent_id ? String(node.parent_id).slice(0, 48) : undefined,
        semantic_role: node.semantic_role ? String(node.semantic_role).slice(0, 32) as KnowledgeMapSemanticRole : undefined,
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
    const parsedNodeIds = new Set(parsedNodes.map(node => node.id))
    const baseNodes = parsedNodes.map(node => ({
      ...node,
      parent_id: node.parent_id && node.parent_id !== node.id && parsedNodeIds.has(node.parent_id)
        ? node.parent_id
        : undefined,
    }))
    const baseEdges = Array.isArray(raw.edges) ? raw.edges
      .filter(edge => edge && parsedNodeIds.has(String(edge.from)) && parsedNodeIds.has(String(edge.to)) && edge.from !== edge.to)
      .slice(0, 48)
      .map(edge => ({ from: String(edge.from), to: String(edge.to), label: edge.label ? String(edge.label).slice(0, 24) : '' })) : []
    const declaredMapType = String(raw.map_type || '')
    const keepsOwnVisualGrammar = ['process_flow', 'comparison_map', 'system_map', 'timeline_map', 'causal_map', 'relationship_map', 'decision_map', 'lab_map'].includes(declaredMapType)
    const expandedMap = keepsOwnVisualGrammar
      ? { nodes: baseNodes, edges: baseEdges, expanded: false }
      : expandLegacyKnowledgeMap(baseNodes, baseEdges)
    const nodes = expandedMap.nodes
    const nodeIds = new Set(nodes.map(node => node.id))
    const edges = expandedMap.edges
    const learningPath = Array.isArray(raw.learning_path)
      ? raw.learning_path.map(String).filter(id => nodeIds.has(id)).slice(0, 10)
      : []
    const validMapTypes: NonNullable<KnowledgeMapData['map_type']>[] = ['concept_tree', 'process_flow', 'comparison_map', 'system_map', 'timeline_map', 'causal_map', 'relationship_map', 'decision_map', 'lab_map']
    const validSceneKinds: KnowledgeMapVisualSceneKind[] = ['flow_route', 'stack_tower', 'input_output_lab', 'compare_split', 'formula_board', 'code_trace', 'cause_chain', 'pitfall_fork']
    const validSceneThemes: NonNullable<KnowledgeMapVisualScene['theme']>[] = ['coral', 'violet', 'cobalt', 'amber', 'teal', 'rose', 'ink', 'lime']
    const validCompositions: KnowledgeMapSceneComposition[] = ['editorial_path', 'layered_atlas', 'experiment_stage', 'split_argument', 'formula_poster', 'code_observatory', 'causal_landscape', 'decision_desk']
    const validVisualLanguages: KnowledgeMapSceneVisualLanguage[] = ['quiet_editorial', 'technical_blueprint', 'paper_collage', 'museum_label', 'studio_notebook', 'cinematic_console']
    const visualScenes = Array.isArray(raw.visual_scenes) ? raw.visual_scenes
      .filter(scene => scene && validSceneKinds.includes(scene.kind as KnowledgeMapVisualSceneKind))
      .slice(0, 5)
      .map((scene, index) => {
        const rawDesign = scene.design && typeof scene.design === 'object' ? scene.design : {}
        const annotations = Array.isArray(rawDesign.annotations) ? rawDesign.annotations
          .filter((annotation: unknown) => annotation && typeof annotation === 'object')
          .slice(0, 5)
          .map((annotation: { label?: unknown; title?: unknown; body?: unknown }) => ({
            label: String(annotation.label || '').slice(0, 24),
            title: String(annotation.title || '').slice(0, 48),
            body: String(annotation.body || '').slice(0, 180),
          })).filter((annotation: { title: string; body: string }) => annotation.title && annotation.body) : []
        const compositionCandidate = typeof rawDesign.composition === 'string' ? rawDesign.composition : ''
        const visualLanguageCandidate = typeof rawDesign.visual_language === 'string' ? rawDesign.visual_language : ''
        const composition = validCompositions.includes(compositionCandidate as KnowledgeMapSceneComposition)
          ? compositionCandidate as KnowledgeMapSceneComposition : undefined
        const visualLanguage = validVisualLanguages.includes(visualLanguageCandidate as KnowledgeMapSceneVisualLanguage)
          ? visualLanguageCandidate as KnowledgeMapSceneVisualLanguage : undefined
        return {
          id: String(scene.id || `scene-${index + 1}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48) || `scene-${index + 1}`,
          kind: scene.kind as KnowledgeMapVisualSceneKind,
          theme: validSceneThemes.includes(scene.theme as NonNullable<KnowledgeMapVisualScene['theme']>) ? scene.theme as NonNullable<KnowledgeMapVisualScene['theme']> : undefined,
          title: String(scene.title || '').slice(0, 80),
          statement: String(scene.statement || '').slice(0, 240),
          takeaway: scene.takeaway ? String(scene.takeaway).slice(0, 180) : '',
          node_ids: Array.isArray(scene.node_ids) ? scene.node_ids.map(String).filter(id => nodeIds.has(id)).slice(0, 5) : [],
          steps: Array.isArray(scene.steps) ? scene.steps.map(String).filter(Boolean).slice(0, 5) : [],
          left: scene.left ? String(scene.left).slice(0, 180) : '', right: scene.right ? String(scene.right).slice(0, 180) : '',
          input: scene.input ? String(scene.input).slice(0, 120) : '', output: scene.output ? String(scene.output).slice(0, 120) : '',
          formula: scene.formula ? String(scene.formula).slice(0, 160) : '', code: scene.code ? String(scene.code).slice(0, 260) : '',
          design: composition || visualLanguage || annotations.length || rawDesign.review_prompt
            ? { composition, visual_language: visualLanguage, annotations, review_prompt: String(rawDesign.review_prompt || '').slice(0, 160) } : undefined,
        }
      }).filter(scene => scene.title && scene.statement && scene.node_ids.length > 0) : []
    const deepMaps = Object.fromEntries(Object.entries(raw.deep_maps || {})
      .filter(([sourceNodeId, candidate]) => nodeIds.has(sourceNodeId) && candidate && typeof candidate === 'object')
      .slice(0, 10)
      .flatMap(([sourceNodeId, candidate]) => {
        const parsedDeepMap = parseKnowledgeMap(JSON.stringify(candidate))
        if (!parsedDeepMap) return []
        const value = candidate as Partial<KnowledgeMapDeepDive>
        return [[sourceNodeId, {
          ...parsedDeepMap,
          source_node_id: sourceNodeId,
          title: String(value.title || `${nodes.find(node => node.id === sourceNodeId)?.label || '知识节点'} · 深读图`).slice(0, 96),
          summary: String(value.summary || '').slice(0, 240),
          generated_at: value.generated_at ? String(value.generated_at).slice(0, 48) : undefined,
          generation_source: ['agent', 'fallback', 'local'].includes(String(value.generation_source || ''))
            ? value.generation_source as KnowledgeMapDeepDive['generation_source'] : undefined,
          source_fingerprint: value.source_fingerprint ? String(value.source_fingerprint).slice(0, 40) : undefined,
        }] as [string, KnowledgeMapDeepDive]]
      })) as Record<string, KnowledgeMapDeepDive>
    return {
      schema_version: expandedMap.expanded ? 5 : Number(raw.schema_version) || 1,
      layout: expandedMap.expanded ? 'mindmap' : raw.layout === 'flow' ? 'flow' : 'mindmap',
      map_type: expandedMap.expanded ? 'concept_tree' : validMapTypes.includes(String(raw.map_type) as NonNullable<KnowledgeMapData['map_type']>)
        ? raw.map_type as KnowledgeMapData['map_type'] : 'concept_tree',
      groups: Array.isArray(raw.groups) ? raw.groups.map(String).slice(0, 6) : undefined,
      nodes,
      edges: edges.length ? edges : nodes.slice(1).map(node => ({ from: nodes[0].id, to: node.id, label: '' })),
      learning_path: learningPath.length >= Math.min(8, nodes.length) ? learningPath : nodes.slice(0, 10).map(node => node.id),
      visual_scenes: visualScenes,
      deep_maps: Object.keys(deepMaps).length ? deepMaps : undefined,
    }
  } catch {
    return null
  }
}

function provisionalMapType(text: string): NonNullable<KnowledgeMapData['map_type']> {
  if (/比较|区别|异同|不同于|对比/.test(text)) return 'comparison_map'
  if (/时间|历史|演变|发展历程|阶段/.test(text)) return 'timeline_map'
  if (/因果|机制|导致|影响|作用于/.test(text)) return 'causal_map'
  if (/选择|判断|分支|如果.*则|条件/.test(text)) return 'decision_map'
  if (/关系|关联|网络|相互/.test(text)) return 'relationship_map'
  if (/步骤|流程|顺序|算法|代码|操作|如何/.test(text)) return 'process_flow'
  return 'concept_tree'
}

function provisionalMapLabel(sentence: string, fallback: string) {
  const clean = sentence
    .replace(/^\s*(首先|然后|接着|最后|因此|所以|需要|可以|我们)[:：，,、\s]*/u, '')
    .replace(/[，,。；;：:（(].*$/u, '')
    .replace(/[*#`>]/g, '')
    .trim()
  return (clean || fallback).slice(0, 12)
}

function createProvisionalKnowledgeMap(question: string, answer: string, topic: string): KnowledgeMapData {
  const cleanTopic = (topic || question || '当前主题').replace(/\s+/g, ' ').trim().slice(0, 24) || '当前主题'
  const sentences = answer
    .replace(/```[\s\S]*?```/g, '')
    .split(/[。！？!?；;\n]+/u)
    .map(item => item.replace(/^[-*\d.、\s]+/u, '').trim())
    .filter(item => item.length >= 6 && item.length <= 120)
    .slice(0, 8)
  const fallbackLabels = ['概念边界', '关键术语', '成立机制', '关键关系', '推理路径', '应用验证', '常见误判', '延展线索']
  const kinds: NonNullable<KnowledgeMapNode['kind']>[] = ['foundation', 'foundation', 'principle', 'principle', 'process', 'example', 'pitfall', 'process']
  const mapType = provisionalMapType(`${question}\n${answer}`)
  const rootId = 'preview-core'
  const nodes: KnowledgeMapNode[] = [
    {
      id: rootId,
      label: cleanTopic,
      role: 'core',
      kind: 'core',
      detail: '根据当前讲解提取的关系骨架；后台会继续校准为完整知识图解。',
      visual: { kind: 'definition', headline: cleanTopic, items: ['主题', '关系', '学习路径'] },
    },
    ...fallbackLabels.map((fallback, index) => {
      const sentence = sentences[index] || `${fallback}正在依据本次讲解整理。`
      const kind = kinds[index]
      const visual = kind === 'process'
        ? { kind: 'sequence' as const, headline: sentence.slice(0, 48), items: ['识别条件', '连接关系', '完成验证'] }
        : kind === 'example'
          ? { kind: 'input_output' as const, headline: sentence.slice(0, 48), input: '当前题目或案例', output: '用这一点进行验证' }
          : kind === 'pitfall'
            ? { kind: 'warning' as const, headline: sentence.slice(0, 48), items: ['确认前提', '辨别方向', '回到原题'] }
            : kind === 'principle'
              ? { kind: 'comparison' as const, headline: sentence.slice(0, 48), before: '只看表面说法', after: '回到关系与条件' }
              : { kind: 'definition' as const, headline: sentence.slice(0, 48), items: ['含义', '作用', '边界'] }
      return {
        id: `preview-${index + 1}`,
        parent_id: rootId,
        label: provisionalMapLabel(sentence, fallback),
        role: 'branch' as const,
        kind,
        group: fallback,
        order: index + 1,
        detail: sentence.slice(0, 72),
        example: kind === 'example' ? sentence.slice(0, 96) : '',
        mistake: kind === 'pitfall' ? '先确认条件与方向，再判断是否成立。' : '',
        visual,
      }
    }),
  ]
  const edges = nodes.slice(1).map(node => ({ from: rootId, to: node.id, label: '' }))
  return {
    schema_version: 6,
    layout: mapType === 'process_flow' ? 'flow' : 'mindmap',
    map_type: mapType,
    groups: fallbackLabels,
    nodes,
    edges,
    learning_path: nodes.slice(1).map(node => node.id),
  }
}

function parseExternalVideoContent(content?: string): ExternalVideoContent | null {
  if (!content) return null
  try {
    const value = JSON.parse(content) as Partial<ExternalVideoContent>
    if (value.platform !== 'bilibili' || typeof value.url !== 'string' || !value.url.startsWith('https://www.bilibili.com/video/')) {
      return null
    }
    return {
      platform: 'bilibili',
      platform_label: typeof value.platform_label === 'string' ? value.platform_label : 'B站',
      url: value.url,
      cover_url: typeof value.cover_url === 'string' ? value.cover_url : '',
      creator: typeof value.creator === 'string' ? value.creator : '',
      duration: typeof value.duration === 'string' ? value.duration : '',
      view_count: typeof value.view_count === 'string' ? value.view_count : '',
      description: typeof value.description === 'string' ? value.description : '',
      search_query: typeof value.search_query === 'string' ? value.search_query : '',
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
  const summary = progress?.summary?.total === data.nodes.length ? progress.summary : summarizeMapProgress(data, progress?.progress || {})
  if (!summary.total) return ''
  const totalDeepDives = progress?.exploration?.total_deep_dives || data.nodes.filter(node => node.role !== 'core').length
  const explored = new Set(progress?.exploration?.explored_node_ids || []).size
  return language === 'en'
    ? `Understood ${summary.mastered}/${summary.total}${summary.review ? ` · Review ${summary.review}` : ''}${totalDeepDives ? ` · Explored ${explored}/${totalDeepDives}` : ''}`
    : `已理解 ${summary.mastered}/${summary.total}${summary.review ? ` · 待复习 ${summary.review}` : ''}${totalDeepDives ? ` · 已探索 ${explored}/${totalDeepDives}` : ''}`
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
    documentTemplate: record.document_template,
    sourceMapArtifactId: record.source_map_artifact_id || undefined,
    learningLoopId: record.learning_loop_id || undefined,
    learningLoopStep: record.learning_loop_step || undefined,
    documentPackId: record.document_pack_id || undefined,
    documentPackTemplate: record.document_pack_template || undefined,
    practicePackId: record.practice_pack_id || undefined,
    practicePackMode: record.practice_pack_mode || undefined,
  }
}

function legacyPracticeMode(artifact: Artifact): Exclude<PracticeMode, 'standard'> | undefined {
  if (artifact.practicePackMode) return artifact.practicePackMode
  const text = `${artifact.title} ${artifact.summary}`
  if (/口述测验|口述检验|口头测验|oral/i.test(text)) return 'oral'
  if (/编程实验|代码任务|coding|code lab/i.test(text)) return 'coding'
  if (/模拟试卷|模拟考试|mock/i.test(text)) return 'mock'
  if (/同类题|相似题|保留结构|不同情境和表述|similar/i.test(text)) return 'similar'
  if (/变式|迁移测验|条件变化|边界情况|variant/i.test(text)) return 'variants'
  if (/专项训练|薄弱点|核心概念|实际应用场景|targeted/i.test(text)) return 'special'
  return undefined
}

function resolvedPackArtifacts(turn: ChatTurn): Artifact[] {
  let artifacts = turn.artifacts
  const newestFirst = (left: Artifact, right: Artifact) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime() || 0
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime() || 0
    return rightTime - leftTime
  }

  const looseDocuments = artifacts
    .filter(artifact => artifact.kind === 'notes' && !artifact.documentPackId && !artifact.learningLoopId && artifact.documentTemplate)
    .sort(newestFirst)
  const documentByTemplate = new Map<NonNullable<Artifact['documentTemplate']>, Artifact>()
  looseDocuments.forEach(artifact => {
    if (artifact.documentTemplate && !documentByTemplate.has(artifact.documentTemplate)) {
      documentByTemplate.set(artifact.documentTemplate, artifact)
    }
  })
  if (documentByTemplate.size >= 3) {
    const legacyPackId = `legacy-document-pack-${turn.id}`
    const groupedIds = new Set([...documentByTemplate.values()].map(artifact => artifact.id))
    artifacts = artifacts.map(artifact => groupedIds.has(artifact.id) ? {
      ...artifact,
      documentPackId: legacyPackId,
      documentPackTemplate: artifact.documentTemplate,
    } : artifact)
  }

  const loosePractice = artifacts
    .filter(artifact => artifact.kind === 'practice' && !artifact.practicePackId && !artifact.learningLoopId)
    .sort(newestFirst)
  const practiceByMode = new Map<Exclude<PracticeMode, 'standard'>, Artifact>()
  loosePractice.forEach(artifact => {
    const mode = legacyPracticeMode(artifact)
    if (mode && !practiceByMode.has(mode)) practiceByMode.set(mode, artifact)
  })
  if (practiceByMode.size >= 4) {
    const legacyPackId = `legacy-practice-pack-${turn.id}`
    const grouped = new Map([...practiceByMode.entries()].map(([mode, artifact]) => [artifact.id, mode]))
    artifacts = artifacts.map(artifact => {
      const mode = grouped.get(artifact.id)
      return mode ? { ...artifact, practicePackId: legacyPackId, practicePackMode: mode } : artifact
    })
  }

  return artifacts
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
  const deferredSessionChanges = useRef<Record<number, DeferredSessionChange>>(readDeferredSessionChanges())
  const deferredSessionSyncing = useRef(false)
  const [sending, setSending] = useState(false)
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [selectedKind, setSelectedKind] = useState<ArtifactKind | null>(null)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generatorCatalogOpen, setGeneratorCatalogOpen] = useState(false)
  const [generatorTurnId, setGeneratorTurnId] = useState<string | null>(null)
  const [generatorCategory, setGeneratorCategory] = useState<Exclude<GenerationCategory, 'universal'>>('quick')
  const [generatorSearch, setGeneratorSearch] = useState('')
  const [inlineVideoSearches, setInlineVideoSearches] = useState<Record<string, InlineVideoSearch>>({})
  const [recording, setRecording] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('rhyme-sidebar-collapsed') === 'true')
  const [learningHouseOpen, setLearningHouseOpen] = useState(false)
  const [learningGuideOpen, setLearningGuideOpen] = useState(() => localStorage.getItem('rhyme-learning-guide-open') !== 'false')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsView, setSettingsView] = useState<SettingsView>('menu')
  const [backgroundTasksOpen, setBackgroundTasksOpen] = useState(false)
  const [backgroundGenerationTasks, setBackgroundGenerationTasks] = useState<Record<string, StoredBackgroundGenerationTask>>(() => readStoredBackgroundGenerationTasks())
  const backgroundGenerationJobMonitors = useRef(new Set<string>())
  const backgroundVideoSearchMonitors = useRef(new Set<string>())
  const restoredBackgroundGenerationTasks = useRef(new Set<string>())
  const [documentSetup, setDocumentSetup] = useState<DocumentSetup | null>(null)
  const [documentGenerating, setDocumentGenerating] = useState(false)
  const [documentPackSetup, setDocumentPackSetup] = useState<DocumentPackSetup | null>(null)
  const [documentPackGeneratingTurnId, setDocumentPackGeneratingTurnId] = useState<string | null>(null)
  const [documentPackPlanningByTurn, setDocumentPackPlanningByTurn] = useState<Record<string, DocumentPackPlanningState>>({})
  const documentPackGenerationLocked = useRef(false)
  const [knowledgeMapGeneratingTurnId, setKnowledgeMapGeneratingTurnId] = useState<string | null>(null)
  const [pendingMapGenerationTurnId, setPendingMapGenerationTurnId] = useState<string | null>(null)
  const knowledgeMapGenerationLock = useRef<{ turnId: string; loadingId: string; startedAt: number } | null>(null)
  const knowledgeMapRunnerRef = useRef<(turnId: string) => void>(() => {})
  const [dynamicExplanationGeneratingTurnId, setDynamicExplanationGeneratingTurnId] = useState<string | null>(null)
  const [pendingDynamicExplanationTurnId, setPendingDynamicExplanationTurnId] = useState<string | null>(null)
  const dynamicExplanationGenerationLocked = useRef(false)
  const dynamicExplanationRunnerRef = useRef<(turnId: string) => void>(() => {})
  const dynamicExplanationJobMonitors = useRef(new Set<string>())
  const restoredDynamicExplanationJobs = useRef(new Set<string>())
  const [recentDynamicExplanationArtifactId, setRecentDynamicExplanationArtifactId] = useState<string | null>(null)
  const [dismissedDynamicTaskIds, setDismissedDynamicTaskIds] = useState<Set<string>>(() => new Set())
  const [learningLoopGeneratingTurnId, setLearningLoopGeneratingTurnId] = useState<string | null>(null)
  const learningLoopGenerationLocked = useRef(false)
  const [learningLoopActiveStepByTurn, setLearningLoopActiveStepByTurn] = useState<Record<string, LearningLoopStep>>({})
  const [immersiveOpenRequest, setImmersiveOpenRequest] = useState<{ artifactId: string; revision: number } | null>(null)
  const [mapProgressByArtifactId, setMapProgressByArtifactId] = useState<Record<string, KnowledgeMapProgressState>>({})
  const mapProgressFetches = useRef(new Set<string>())
  const mapExplorationSaveTokens = useRef<Record<string, number>>({})
  const [mapPackJobs, setMapPackJobs] = useState<Record<string, KnowledgeMapPackJobState>>({})
  const mapPackMonitors = useRef(new Set<number>())
  const mapPackMonitorRef = useRef<(artifact: Artifact, job: GenerationJob<KnowledgeMapPackResult>) => void>(() => {})
  const [presentationProgressByArtifactId, setPresentationProgressByArtifactId] = useState<Record<string, InteractivePresentationProgress>>({})
  const presentationProgressFetches = useRef(new Set<string>())
  const presentationProgressSaveTokens = useRef<Record<string, number>>({})
  const [mapProgressSavingKey, setMapProgressSavingKey] = useState<string | null>(null)
  const [mapEditingArtifactId, setMapEditingArtifactId] = useState<string | null>(null)
  const [presentationEditingArtifactId, setPresentationEditingArtifactId] = useState<string | null>(null)
  const [mapCollaborations, setMapCollaborations] = useState<Record<string, KnowledgeMapCollaboration>>({})
  const [mapCollaborationLoadingArtifactId, setMapCollaborationLoadingArtifactId] = useState<string | null>(null)
  const [mapReviewPracticeGeneratingArtifactId, setMapReviewPracticeGeneratingArtifactId] = useState<string | null>(null)
  const [mapWorkspaceArtifactId, setMapWorkspaceArtifactId] = useState<string | null>(null)
  const [mapWorkspaceReturnView, setMapWorkspaceReturnView] = useState<MapWorkspaceReturnView>('chat')
  const [practiceSetupTurnId, setPracticeSetupTurnId] = useState<string | null>(null)
  const [practiceSetupMode, setPracticeSetupMode] = useState<PracticeMode>('standard')
  const [practiceGenerating, setPracticeGenerating] = useState(false)
  const practiceGenerationLocked = useRef(false)
  const [practiceLoadingArtifactId, setPracticeLoadingArtifactId] = useState<string | null>(null)
  const [practiceSubmitting, setPracticeSubmitting] = useState(false)
  const [practiceRun, setPracticeRun] = useState<PracticeRun | null>(null)
  const [practiceReturnBooklet, setPracticeReturnBooklet] = useState<PracticePackBookletTarget | null>(null)
  const [practiceIndexCollapsed, setPracticeIndexCollapsed] = useState(false)
  const [practiceAttemptCounts, setPracticeAttemptCounts] = useState<Record<string, number>>({})
  const oralMediaRecorderRef = useRef<MediaRecorder | null>(null)
  const oralMediaStreamRef = useRef<MediaStream | null>(null)
  const oralAudioChunksRef = useRef<Blob[]>([])
  const [imageAnalysisSavingTurnId, setImageAnalysisSavingTurnId] = useState<string | null>(null)
  const [expandedArtifactId, setExpandedArtifactId] = useState<string | null>(null)
  const [saveTarget, setSaveTarget] = useState<Artifact | null>(null)
  const [learningLoopSaveTarget, setLearningLoopSaveTarget] = useState<LearningLoopSaveTarget | null>(null)
  const [documentPackSaveTarget, setDocumentPackSaveTarget] = useState<DocumentPackSaveTarget | null>(null)
  const [documentPackBooklet, setDocumentPackBooklet] = useState<DocumentPackBookletTarget | null>(null)
  const [documentPackBookletActiveId, setDocumentPackBookletActiveId] = useState<string | null>(null)
  const [practicePackSaveTarget, setPracticePackSaveTarget] = useState<PracticePackSaveTarget | null>(null)
  const [practicePackBooklet, setPracticePackBooklet] = useState<PracticePackBookletTarget | null>(null)
  const [practicePackBookletActiveId, setPracticePackBookletActiveId] = useState<string | null>(null)
  const [externalVideoSaveTarget, setExternalVideoSaveTarget] = useState<ExternalVideoSaveTarget | null>(null)
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
  const [libraryTopicState, setLibraryTopicState] = useState<LibraryTopicLearningState | null>(null)
  const [libraryTopicStateLoading, setLibraryTopicStateLoading] = useState(false)
  const [topicStudyPlan, setTopicStudyPlan] = useState<TopicStudyPlan | null>(null)
  const [topicStudyPlanLoading, setTopicStudyPlanLoading] = useState(false)
  const [topicStudyPlanBusyTaskId, setTopicStudyPlanBusyTaskId] = useState<string | null>(null)
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

  const exitPracticeWorkspace = useCallback(() => {
    const returnTarget = practiceReturnBooklet
    const activeArtifactId = practiceRun?.artifact.id || null
    setPracticeRun(null)
    setPracticeReturnBooklet(null)
    if (!returnTarget) return
    setPracticePackBooklet(returnTarget)
    setPracticePackBookletActiveId(activeArtifactId && returnTarget.artifactIds.includes(activeArtifactId)
      ? activeArtifactId
      : returnTarget.artifactIds[0] || null)
  }, [practiceReturnBooklet, practiceRun?.artifact.id])

  const createDynamicExplanationPlaceholder = useCallback((turn: ChatTurn, loadingId: string, replacedArtifact?: Artifact): Artifact => {
    return {
      ...replacedArtifact,
      id: loadingId,
      kind: 'interactive',
      title: '正在后台精修动态讲解…',
      summary: '云端模型正在把核心过程编排成可播放的场景，单次生成最长约 2 分钟；你可以继续学习。',
      details: ['提炼从“为什么”到“怎么做”的讲解顺序', '完成前会检查文字密度、交互点和状态变化'],
      source: replacedArtifact?.source || turn.prompt,
      course: replacedArtifact?.course || learningState.subject || '未分类课程',
      topic: replacedArtifact?.topic || learningState.current_topic || '本次学习',
      topicMastery: 0,
      recommendedCourse: replacedArtifact?.recommendedCourse || learningState.subject || '未分类课程',
      recommendedTopic: replacedArtifact?.recommendedTopic || learningState.current_topic || '本次学习',
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
  }, [learningState.current_topic, learningState.subject])

  function persistBackgroundGenerationTask(task: StoredBackgroundGenerationTask) {
    writeStoredBackgroundGenerationTask(task)
    setBackgroundGenerationTasks(readStoredBackgroundGenerationTasks())
  }

  function patchBackgroundGenerationTask(loadingId: string, updates: Partial<StoredBackgroundGenerationTask>) {
    const current = readStoredBackgroundGenerationTasks()[loadingId]
    if (!current) return
    persistBackgroundGenerationTask({ ...current, ...updates, loadingId: current.loadingId })
  }

  function dismissBackgroundGenerationTask(loadingId: string) {
    removeStoredBackgroundGenerationTask(loadingId)
    setBackgroundGenerationTasks(readStoredBackgroundGenerationTasks())
  }

  const createBackgroundGenerationPlaceholder = useCallback((
    turn: ChatTurn,
    task: StoredBackgroundGenerationTask,
    replacedArtifact?: Artifact,
  ): Artifact | null => {
    if (task.kind === 'video') return null
    const failed = task.status === 'failed'
    const common = {
      ...replacedArtifact,
      id: task.loadingId,
      kind: task.kind,
      source: replacedArtifact?.source || turn.prompt,
      sessionId: task.sessionId,
      qaId: turn.id,
      course: task.course,
      topic: task.topic,
      topicMastery: 0,
      recommendedCourse: task.course,
      recommendedTopic: task.topic,
      classificationSource: 'learning_state' as const,
      classificationConfidence: 0.9,
      classificationOverridden: false,
      saved: false,
      favorite: false,
      versionGroupId: 0,
      version: 1,
      status: failed ? 'error' as const : 'generating' as const,
    }
    if (task.kind === 'notes') {
      const template = task.documentTemplate ? documentTemplateById[task.documentTemplate] : undefined
      const label = template?.label || '学习文档'
      return {
        ...common,
        kind: 'notes',
        title: failed ? `${label}暂未完成` : `正在生成${label}…`,
        summary: failed
          ? task.error || '学习文档没有完成，原始问答仍然保留。'
          : `正在按「${label}」的专属结构整理当前内容。`,
        details: failed
          ? ['原始问答已保留，可从后台任务直接重试。']
          : ['读取当前问题与回答', `应用${label}模板`, '完成后可从后台任务直接打开'],
        documentTemplate: task.documentTemplate,
        purpose: 'review',
        depth: 'standard',
        style: 'plain',
      }
    }
    if (task.kind === 'practice') {
      const profile = practiceProfiles[task.practiceMode || 'standard']
      return {
        ...common,
        kind: 'practice',
        title: failed ? `${profile.label}暂未完成` : `正在生成${profile.label}…`,
        summary: failed
          ? task.error || '练习测验没有完成，原始问答仍然保留。'
          : `正在围绕当前回答编写 ${profile.count} 道${profile.label}内容。`,
        details: failed
          ? ['原始问答已保留，可从后台任务直接重试。']
          : [profile.description, '完成后可从后台任务直接进入作答'],
        sourceMapArtifactId: task.sourceMapArtifactId,
        purpose: 'review',
        depth: 'standard',
        style: 'exam',
      }
    }
    return {
      ...common,
      kind: 'map',
      title: failed ? '知识图解暂未完成' : '正在梳理知识图解…',
      summary: failed
        ? task.error || '知识图解没有完成，原始问答仍然保留。'
        : '图解正在后台准备。你可以继续提问或去资料库，完成后可从后台任务打开。',
      details: failed
        ? ['原始问答已保留，可从后台任务直接重试。']
        : ['根据当前问答识别核心概念与关联分支', '无需停留等待，任务会在后台继续完成'],
      purpose: 'review',
      depth: 'standard',
      style: 'plain',
    }
  }, [])

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
    localStorage.setItem('rhyme-sidebar-collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  useEffect(() => {
    localStorage.setItem('rhyme-learning-guide-open', String(learningGuideOpen))
  }, [learningGuideOpen])

  useEffect(() => {
    if (!practiceRun) return
    const exitOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      exitPracticeWorkspace()
    }
    document.addEventListener('keydown', exitOnEscape)
    return () => document.removeEventListener('keydown', exitOnEscape)
  }, [exitPracticeWorkspace, practiceRun])

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
    dynamicExplanationRunnerRef.current = runDynamicExplanationGeneration
  })

  useEffect(() => {
    if (!sessionId || turns.length === 0) return
    const storedTasks = Object.values(readStoredDynamicExplanationJobs())
      .filter(task => task.sessionId === sessionId)
      .sort((left, right) => left.createdAt - right.createdAt)

    for (const task of storedTasks) {
      const restoreKey = `${task.loadingId}:${task.jobId}`
      if (restoredDynamicExplanationJobs.current.has(restoreKey)) continue
      const turn = turns.find(item => item.id === task.turnId)
      if (!turn) continue
      restoredDynamicExplanationJobs.current.add(restoreKey)

      const existing = turn.artifacts.find(artifact => artifact.id === task.loadingId)
      const restoredArtifact = task.status === 'failed'
        ? {
            ...(existing || createDynamicExplanationPlaceholder(turn, task.loadingId)),
            title: '动态讲解暂未完成',
            summary: task.error || '上一次生成没有完成，原始问答仍在这里。',
            details: [
              task.retryable === false
                ? '请先检查来源回答是否仍存在，再重新发起生成。'
                : '原始问答已保留，点击下方“立即重试”会在这里原位继续。',
            ],
            status: 'error' as const,
            generationProgress: {
              phase: 'failed' as const,
              label: '上一次生成未完成',
              message: task.error || '上一次生成没有完成，原始问答仍在这里。',
              percent: 0,
              error_code: task.errorCode,
            },
          }
        : existing || createDynamicExplanationPlaceholder(turn, task.loadingId)
      setTurns(current => current.map(item => item.id === task.turnId
        ? {
            ...item,
            artifacts: item.artifacts.some(artifact => artifact.id === task.loadingId)
              ? item.artifacts.map(artifact => artifact.id === task.loadingId ? restoredArtifact : artifact)
              : [...item.artifacts, restoredArtifact],
          }
        : item))
      setRecentDynamicExplanationArtifactId(task.loadingId)

      if (task.status === 'failed') continue
      void getGenerationJob<{ artifact: LearningArtifactRecord }>(LOCAL_USER_ID, task.jobId)
        .then(job => monitorDynamicExplanationJob(task, job, true))
        .catch(() => monitorDynamicExplanationJob(task, {
          job_id: task.jobId,
          kind: 'interactive',
          status: 'failed',
          created_at: new Date(task.createdAt).toISOString(),
          error: '生成任务暂时无法读取',
          error_code: 'job_expired',
          retryable: true,
        }, true))
    }
  }, [createDynamicExplanationPlaceholder, sessionId, turns])

  useEffect(() => {
    if (!sessionId || turns.length === 0) return
    const tasks = Object.values(backgroundGenerationTasks)
      .filter(task => task.sessionId === sessionId)
      .sort((left, right) => left.createdAt - right.createdAt)

    for (const task of tasks) {
      const restoreKey = `${task.loadingId}:${task.jobId || 'video'}:${task.status || 'running'}`
      if (restoredBackgroundGenerationTasks.current.has(restoreKey)) continue
      const turn = turns.find(item => item.id === task.turnId)
      if (!turn) continue
      restoredBackgroundGenerationTasks.current.add(restoreKey)

      if (task.kind === 'video') {
        setInlineVideoSearches(current => ({
          ...current,
          [task.turnId]: {
            context: task.videoContext || {
              turnId: task.turnId,
              sessionId: task.sessionId,
              query: task.title,
              course: task.course,
              topic: task.topic,
            },
            results: task.videoResults || [],
            searchUrl: task.videoSearchUrl || '',
            loading: !task.status,
            error: task.status === 'failed' ? task.error || '课程视频检索没有完成。' : '',
            taskId: task.loadingId,
          },
        }))
        if (!task.status && task.videoContext) void runVideoSearch(task.turnId, task.videoContext, task)
        continue
      }

      const artifactId = task.resultArtifactId || task.loadingId
      const existing = turn.artifacts.find(artifact => artifact.id === artifactId || artifact.id === task.loadingId)
      if (!existing && task.status !== 'completed') {
        const placeholder = createBackgroundGenerationPlaceholder(turn, task)
        if (placeholder) {
          setTurns(current => current.map(item => item.id === task.turnId
            ? { ...item, artifacts: [...item.artifacts, placeholder] }
            : item))
        }
      }
      if (task.status === 'failed') continue
      if (task.status === 'completed' && existing) continue
      if (!task.jobId) {
        patchBackgroundGenerationTask(task.loadingId, {
          status: 'failed',
          error: '后台服务已重新启动，原生成任务未能继续；原始问答仍在，可立即重试。',
          errorCode: 'job_expired',
          retryable: true,
        })
        continue
      }
      void getGenerationJob<{ artifact: LearningArtifactRecord }>(LOCAL_USER_ID, task.jobId)
        .then(job => monitorBackgroundGenerationJob(task, job, true))
        .catch(() => monitorBackgroundGenerationJob(task, {
          job_id: task.jobId!,
          kind: task.kind === 'notes' ? 'notes' : task.kind === 'practice' ? 'practice' : 'map',
          status: 'failed',
          created_at: new Date(task.createdAt).toISOString(),
          error: '后台服务已重新启动，原生成任务未能继续；原始问答仍在，可立即重试。',
          error_code: 'job_expired',
          retryable: true,
        }, true))
    }
  }, [backgroundGenerationTasks, createBackgroundGenerationPlaceholder, sessionId, turns])

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
    if (!practiceRun || practiceRun.result || practiceRun.practice.practice_mode !== 'mock' || !practiceRun.remainingSeconds) return
    const timer = window.setInterval(() => {
      setPracticeRun(current => current && current.practice.practice_mode === 'mock' && !current.result
        ? { ...current, remainingSeconds: Math.max(0, (current.remainingSeconds || 0) - 1) }
        : current)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [practiceRun?.practice.id, practiceRun?.practice.practice_mode, practiceRun?.remainingSeconds, practiceRun?.result])

  useEffect(() => () => {
    oralMediaRecorderRef.current?.stop()
    oralMediaStreamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  useEffect(() => {
    if (!pendingMapGenerationTurnId || !sessionId || !turns.some(turn => turn.id === pendingMapGenerationTurnId)) return
    setPendingMapGenerationTurnId(null)
    knowledgeMapRunnerRef.current(pendingMapGenerationTurnId)
  }, [pendingMapGenerationTurnId, sessionId, turns])

  useEffect(() => {
    if (!pendingDynamicExplanationTurnId || !sessionId || !turns.some(turn => turn.id === pendingDynamicExplanationTurnId)) return
    setPendingDynamicExplanationTurnId(null)
    dynamicExplanationRunnerRef.current(pendingDynamicExplanationTurnId)
  }, [pendingDynamicExplanationTurnId, sessionId, turns])

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
        let data = await getTutorSessions(LOCAL_USER_ID) as { sessions: TutorSessionSummary[] }
        if (cancelled) return
        if (await syncDeferredSessionChanges(data.sessions || [])) {
          data = await getTutorSessions(LOCAL_USER_ID) as { sessions: TutorSessionSummary[] }
        }
        const restoredSessions = applyDeferredSessionChanges(data.sessions || [])
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
  const readerDynamicExplanation = readerArtifact?.kind === 'interactive'
    ? parseDynamicExplanation(readerArtifact.content)
    : null
  const readerExternalVideo = readerArtifact?.kind === 'external_video'
    ? parseExternalVideoContent(readerArtifact.content)
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
  const interactivePresentationArtifacts = useMemo(() => {
    const candidates = [
      ...turns.flatMap(turn => turn.artifacts),
      ...libraryItems,
      ...(readerArtifact ? [readerArtifact] : []),
    ].filter((artifact): artifact is Artifact => (
      artifact.kind === 'interactive' && artifact.saved && Boolean(artifact.backendId)
    ))
    return [...new Map(candidates.map(artifact => [artifact.id, artifact])).values()]
  }, [libraryItems, readerArtifact, turns])
  const mapWorkspaceArtifact = mapWorkspaceArtifactId
    ? mapArtifacts.find(artifact => artifact.id === mapWorkspaceArtifactId) || null
    : null
  const mapWorkspaceData = mapWorkspaceArtifact ? parseKnowledgeMap(mapWorkspaceArtifact.content) : null
  const mapWorkspaceProgress = mapWorkspaceArtifact ? mapProgressByArtifactId[mapWorkspaceArtifact.id] : undefined
  const backgroundMapTasks = mapArtifacts
    .map(artifact => {
      const job = mapPackJobs[artifact.id]
      if (!job) return null
      const mapData = parseKnowledgeMap(artifact.content)
      const atomIds = mapData?.nodes.filter(node => node.role !== 'core').map(node => node.id) || []
      const generatedCount = mapData
        ? atomIds.filter(nodeId => Boolean(mapData.deep_maps?.[nodeId])).length
        : 0
      const total = Math.max(atomIds.length, job.total || 0)
      const ready = Math.max(generatedCount, job.ready || 0)
      const running = job.status === 'queued' || job.status === 'running'
      const complete = total > 0 && ready >= total
      const remaining = Math.max(job.failed || 0, total - ready)
      return { artifact, job, total, ready, running, complete, remaining }
    })
    .filter((task): task is NonNullable<typeof task> => Boolean(task))
    .sort((a, b) => {
      const rank = (task: typeof a) => task.running ? 0 : !task.complete ? 1 : 2
      return rank(a) - rank(b)
    })
  const backgroundGenerationTaskViews = Object.values(backgroundGenerationTasks)
    .filter(task => task.sessionId === sessionId)
    .map(task => {
      const turn = turns.find(item => item.id === task.turnId)
      const artifactId = task.resultArtifactId || task.loadingId
      const artifact = task.kind === 'video'
        ? undefined
        : turn?.artifacts.find(item => item.id === artifactId || item.id === task.loadingId)
      const failed = task.status === 'failed' || artifact?.status === 'error'
      const complete = !failed && (task.status === 'completed' || (task.kind === 'video' && Boolean(task.videoResults)))
      const running = !failed && !complete
      return { task, artifact, running, failed, complete }
    })
    .sort((left, right) => {
      const rank = (task: typeof left) => task.running ? 0 : task.failed ? 1 : 2
      return rank(left) - rank(right) || right.task.createdAt - left.task.createdAt
    })
  const backgroundDynamicTasks = turns
    .flatMap(turn => turn.artifacts
      .filter(artifact => (
        artifact.kind === 'interactive'
        && !dismissedDynamicTaskIds.has(artifact.id)
        && (
          artifact.status === 'generating'
          || artifact.status === 'error'
          || artifact.id === recentDynamicExplanationArtifactId
        )
      ))
      .map(artifact => ({
        artifact,
        turnId: turn.id,
        running: artifact.status === 'generating',
        failed: artifact.status === 'error',
        complete: artifact.status !== 'generating' && artifact.status !== 'error',
      })))
    .sort((a, b) => {
      const rank = (task: typeof a) => task.running ? 0 : task.failed ? 1 : 2
      return rank(a) - rank(b)
    })
  const backgroundRunningTaskCount = backgroundGenerationTaskViews.filter(task => task.running).length
    + backgroundMapTasks.filter(task => task.running).length
    + backgroundDynamicTasks.filter(task => task.running).length
  const backgroundAttentionTaskCount = backgroundGenerationTaskViews.filter(task => task.failed).length
    + backgroundMapTasks.filter(task => !task.running && !task.complete).length
    + backgroundDynamicTasks.filter(task => task.failed).length
  const backgroundCompletedTaskCount = backgroundGenerationTaskViews.filter(task => task.complete).length
    + backgroundDynamicTasks.filter(task => task.complete).length
  const foregroundDynamicTask = backgroundDynamicTasks[0]
  const foregroundBackgroundGenerationTask = backgroundGenerationTaskViews[0]
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
  useEffect(() => {
    const stored = readStoredMapPackJobs()
    mapArtifacts.forEach(artifact => {
      if (!artifact.backendId || mapPackMonitors.current.has(artifact.backendId)) return
      const backendId = artifact.backendId
      const jobId = stored[String(backendId)]
      if (!jobId) return
      void getGenerationJob<KnowledgeMapPackResult>(LOCAL_USER_ID, jobId)
        .then(job => mapPackMonitorRef.current(artifact, job))
        .catch(() => {
          writeStoredMapPackJob(backendId)
          setMapPackJobs(current => ({
            ...current,
            [artifact.id]: {
              jobId,
              status: 'failed',
              total: parseKnowledgeMap(artifact.content)?.nodes.filter(node => node.role !== 'core').length || 0,
              ready: 0,
              completed: 0,
              failed: 0,
              pending: 0,
              error: interfaceLanguage === 'en'
                ? 'The previous background task expired. Retry the remaining maps.'
                : '上一次后台任务已经失效，可以重新补全剩余图解。',
            },
          }))
        })
    })
  }, [interfaceLanguage, mapArtifacts])
  useEffect(() => {
    let cancelled = false
    interactivePresentationArtifacts.forEach(artifact => {
      if (!artifact.backendId || presentationProgressByArtifactId[artifact.id] || presentationProgressFetches.current.has(artifact.id)) return
      presentationProgressFetches.current.add(artifact.id)
      void getInteractivePresentationProgress(artifact.backendId, LOCAL_USER_ID)
        .then(progress => {
          if (!cancelled) {
            setPresentationProgressByArtifactId(current => (
              current[artifact.id] ? current : { ...current, [artifact.id]: progress }
            ))
          }
        })
        .catch(() => undefined)
        .finally(() => presentationProgressFetches.current.delete(artifact.id))
    })
    return () => { cancelled = true }
  }, [interactivePresentationArtifacts, presentationProgressByArtifactId])
  const libraryTopicItems = libraryTopic
    ? filteredLibraryItems.filter(item => item.course === libraryTopic.course && item.topic === libraryTopic.topic)
    : []
  const libraryTopicLearningLoops = (() => {
    const groups = libraryTopicItems.reduce<Record<string, Artifact[]>>((result, artifact) => {
      if (!artifact.learningLoopId) return result
      result[artifact.learningLoopId] = [...(result[artifact.learningLoopId] || []), artifact]
      return result
    }, {})
    return Object.entries(groups)
      .map(([id, artifacts]) => ({
        id,
        artifacts,
        newestAt: Math.max(...artifacts.map(item => new Date(item.updatedAt || item.createdAt || 0).getTime() || 0)),
      }))
      .sort((first, second) => second.newestAt - first.newestAt)
  })()
  const libraryTopicDocumentPacks = (() => {
    const groups = libraryTopicItems.reduce<Record<string, Artifact[]>>((result, artifact) => {
      if (!artifact.documentPackId) return result
      result[artifact.documentPackId] = [...(result[artifact.documentPackId] || []), artifact]
      return result
    }, {})
    return Object.entries(groups)
      .map(([id, artifacts]) => ({
        id,
        artifacts,
        newestAt: Math.max(...artifacts.map(item => new Date(item.updatedAt || item.createdAt || 0).getTime() || 0)),
      }))
      .sort((first, second) => second.newestAt - first.newestAt)
  })()
  const libraryTopicPracticePacks = (() => {
    const groups = libraryTopicItems.reduce<Record<string, Artifact[]>>((result, artifact) => {
      if (!artifact.practicePackId) return result
      result[artifact.practicePackId] = [...(result[artifact.practicePackId] || []), artifact]
      return result
    }, {})
    return Object.entries(groups)
      .map(([id, artifacts]) => ({
        id,
        artifacts,
        newestAt: Math.max(...artifacts.map(item => new Date(item.updatedAt || item.createdAt || 0).getTime() || 0)),
      }))
      .sort((first, second) => second.newestAt - first.newestAt)
  })()
  const documentPackBookletDocuments = documentPackBooklet
    ? (() => {
        const candidates = [
          ...turns.flatMap(turn => turn.artifacts),
          ...libraryItems,
          ...trashedItems,
          ...documentPackBooklet.artifacts,
        ].filter(artifact => artifact.documentPackId === documentPackBooklet.packId || documentPackBooklet.artifactIds.includes(artifact.id))
        return [...new Map(candidates.map(artifact => [artifact.id, artifact])).values()]
          .map((artifact): StudyBookletDocument => ({
            id: artifact.id,
            title: artifact.title,
            summary: artifact.summary,
            content: artifact.content,
            details: artifact.details,
            status: artifact.status,
            documentTemplate: artifact.documentPackTemplate || artifact.documentTemplate,
          }))
      })()
    : []
  const practicePackBookletEntries = practicePackBooklet
    ? (() => {
        const candidates = [
          ...turns.flatMap(turn => turn.artifacts),
          ...libraryItems,
          ...trashedItems,
          ...practicePackBooklet.artifacts,
        ].filter(artifact => artifact.practicePackId === practicePackBooklet.packId || practicePackBooklet.artifactIds.includes(artifact.id))
        return [...new Map(candidates.map(artifact => [artifact.id, artifact])).values()]
          .filter((artifact): artifact is Artifact & { practicePackMode: Exclude<PracticeMode, 'standard'> } => Boolean(artifact.practicePackMode))
          .map((artifact): PracticePackEntry => {
            const profile = practiceProfiles[artifact.practicePackMode]
            return {
              id: artifact.id,
              mode: artifact.practicePackMode,
              title: artifact.title,
              summary: artifact.summary,
              status: artifact.status,
              questionCount: profile.count,
              minutes: profile.minutes,
            }
          })
      })()
    : []
  const libraryTopicMastery = libraryTopicItems[0]?.topicMastery || 0
  const libraryTopicReview = libraryTopic ? topicReviews[folderTopicKey(libraryTopic.course, libraryTopic.topic)] : undefined
  const libraryTopicDisplayMastery = libraryTopicReview?.mastery || libraryTopicMastery
  const libraryTopicLearningMastery = libraryTopicState?.mastery || libraryTopicDisplayMastery
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
  const learningGuideTurn = turns.at(-1)
  const learningGuideArtifacts = learningGuideTurn?.artifacts || []
  const hasGuideArtifact = (kind: ArtifactKind) => learningGuideArtifacts.some(artifact => (
    artifact.kind === kind && artifact.status !== 'generating' && artifact.status !== 'error'
  ))
  const hasGuideVideo = Boolean(learningGuideTurn && inlineVideoSearches[learningGuideTurn.id]?.results.length)
  const learningGuideSteps = learningGuideTurn ? [
    {
      id: 'notes',
      label: t('学习文档', 'Learning document'),
      detail: t('先梳理核心概念与重点', 'Clarify the essential concepts first'),
      icon: FileText,
      complete: hasGuideArtifact('notes'),
      action: () => { setView('chat'); setDocumentSetup(defaultDocumentSetup(learningGuideTurn.id, learningGuideTurn.prompt, learningGuideTurn.response)); setGenerateOpen(false) },
    },
    {
      id: 'map',
      label: t('知识图解', 'Knowledge map'),
      detail: t('把关系和学习脉络看清楚', 'See the relationships and structure'),
      icon: MapIcon,
      complete: hasGuideArtifact('map'),
      action: () => runKnowledgeMapGeneration(learningGuideTurn.id),
    },
    {
      id: 'video',
      label: t('课程视频', 'Course video'),
      detail: t('补充一段可直接观看的讲解', 'Add a focused video explanation'),
      icon: Video,
      complete: hasGuideVideo,
      action: () => { setView('chat'); openVideoSearch(learningGuideTurn.id) },
    },
    {
      id: 'practice',
      label: t('练习检验', 'Practice check'),
      detail: t('用题目确认是否真正掌握', 'Use questions to verify mastery'),
      icon: ClipboardCheck,
      complete: hasGuideArtifact('practice'),
      action: () => runPracticeGeneration(learningGuideTurn.id),
    },
  ] : []
  const nextLearningGuideStep = learningGuideSteps.find(step => !step.complete)
  const learningGuideCourse = learningState.subject || learningGuideTurn?.artifacts[0]?.course || t('本次学习', 'This study session')
  const learningGuideTopic = learningState.current_topic || learningState.knowledge_points[0] || learningGuideTurn?.artifacts[0]?.topic || t('从当前对话开始', 'Start from the current chat')
  const artifactLabel = (kind: ArtifactKind, chinese: string) => t(chinese, ({
    notes: 'Learning document',
    practice: 'Practice quiz',
    map: 'Knowledge map',
    interactive: 'Interactive explanation',
    video: 'Video lesson',
    external_video: 'Course video',
  } as Partial<Record<ArtifactKind, string>>)[kind] || chinese)
  const documentTemplateLabel = (artifact?: Artifact | null) => {
    if (!artifact || artifact.kind !== 'notes') return ''
    const template = documentTemplateById[artifact.documentTemplate || 'system_guide']
    return interfaceLanguage === 'en' ? template.labelEn : template.label
  }
  const documentArtifactLabel = (artifact?: Artifact | null) => {
    const templateLabel = documentTemplateLabel(artifact)
    const base = artifact ? artifactLabel(artifact.kind, '学习文档') : t('学习文档', 'Learning document')
    return templateLabel ? `${base} · ${templateLabel}` : base
  }

  function recordSavedArtifactActivity(artifact: Artifact, activityType = 'opened', activityData: Record<string, unknown> = {}) {
    if (!artifact.saved || !artifact.backendId) return
    void recordLearningActivity(artifact.backendId, LOCAL_USER_ID, activityType, activityData)
      .then(() => {
        if (libraryTopic?.course === artifact.course && libraryTopic?.topic === artifact.topic) {
          void refreshLibraryTopicState()
        }
      })
      .catch(() => {
        // A reading action should remain instant even if progress sync is temporarily unavailable.
      })
  }

  function presentationProgressForArtifact(artifact: Artifact): DynamicExplanationProgress | undefined {
    const stored = presentationProgressByArtifactId[artifact.id]
    if (!stored) return undefined
    return {
      activeSceneId: stored.active_scene_id,
      completedSceneIds: stored.completed_scene_ids,
      visitedSceneIds: stored.visited_scene_ids,
      isCompleted: stored.is_completed,
      checkpoints: stored.checkpoints || {},
    }
  }

  function persistInteractivePresentationProgress(artifact: Artifact, progress: DynamicExplanationProgress) {
    if (!artifact.saved || !artifact.backendId) return

    const previous = presentationProgressByArtifactId[artifact.id]
    const token = (presentationProgressSaveTokens.current[artifact.id] || 0) + 1
    presentationProgressSaveTokens.current[artifact.id] = token
    const optimistic: InteractivePresentationProgress = {
      artifact_id: artifact.backendId,
      active_scene_id: progress.activeSceneId,
      completed_scene_ids: progress.completedSceneIds,
      visited_scene_ids: progress.visitedSceneIds || [progress.activeSceneId],
      is_completed: progress.isCompleted,
      updated_at: previous?.updated_at || '',
      checkpoints: previous?.checkpoints || {},
    }
    setPresentationProgressByArtifactId(current => ({ ...current, [artifact.id]: optimistic }))

    void updateInteractivePresentationProgress(artifact.backendId, LOCAL_USER_ID, {
      active_scene_id: progress.activeSceneId,
      completed_scene_ids: progress.completedSceneIds,
      visited_scene_ids: progress.visitedSceneIds || [progress.activeSceneId],
      is_completed: progress.isCompleted,
    })
      .then(saved => {
        if (presentationProgressSaveTokens.current[artifact.id] !== token) return
        setPresentationProgressByArtifactId(current => ({ ...current, [artifact.id]: saved }))
        if (libraryTopic?.course === artifact.course && libraryTopic?.topic === artifact.topic) {
          void refreshLibraryTopicState()
        }
      })
      .catch(() => {
        if (presentationProgressSaveTokens.current[artifact.id] !== token) return
        setPresentationProgressByArtifactId(current => {
          const next = { ...current }
          if (previous) next[artifact.id] = previous
          else delete next[artifact.id]
          return next
        })
      })
  }

  function persistInteractivePresentationCheckpoint(artifact: Artifact, scene: DynamicExplanationScene, answer: string) {
    if (!artifact.saved || !artifact.backendId) return
    void recordInteractivePresentationCheckpoint(artifact.backendId, LOCAL_USER_ID, {
      scene_id: scene.id,
      answer,
    })
      .then(saved => {
        setPresentationProgressByArtifactId(current => ({ ...current, [artifact.id]: saved }))
        if (libraryTopic?.course === artifact.course && libraryTopic?.topic === artifact.topic) {
          void refreshLibraryTopicState()
        }
      })
      .catch(() => {
        // The in-scene correction remains available even if its study record cannot sync right now.
      })
  }

  function openLibraryArtifact(artifact: Artifact) {
    if (artifact.kind === 'map') {
      openMapWorkspace(artifact, 'library')
      return
    }
    setLibraryPreviewId(artifact.id)
    setView('library')
    recordSavedArtifactActivity(artifact)
  }

  function openDocumentPackBooklet({
    packId,
    turnId,
    artifacts,
    persisted,
  }: {
    packId: string
    turnId?: string
    artifacts: Artifact[]
    persisted: boolean
  }) {
    const first = artifacts[0]
    if (!first) return
    const course = first.course && first.course !== '未分类课程'
      ? first.course
      : first.recommendedCourse || '未分类课程'
    const topic = first.topic && first.topic !== '未分类主题' && first.topic !== '本次学习'
      ? first.topic
      : first.recommendedTopic || '未分类主题'
    setDocumentPackBooklet({ packId, turnId, artifactIds: artifacts.map(artifact => artifact.id), artifacts, course, topic, persisted })
    setDocumentPackBookletActiveId(current => artifacts.some(artifact => artifact.id === current) ? current : artifacts[0].id)
    setExpandedArtifactId(null)
  }

  function closeDocumentPackBooklet() {
    setDocumentPackBooklet(null)
    setDocumentPackBookletActiveId(null)
  }

  function openPracticePackBooklet({
    packId,
    turnId,
    artifacts,
    persisted,
  }: {
    packId: string
    turnId?: string
    artifacts: Artifact[]
    persisted: boolean
  }) {
    const first = artifacts[0]
    if (!first) return
    const course = first.course && first.course !== '未分类课程'
      ? first.course
      : first.recommendedCourse || '未分类课程'
    const topic = first.topic && first.topic !== '未分类主题' && first.topic !== '本次学习'
      ? first.topic
      : first.recommendedTopic || '未分类主题'
    setPracticePackBooklet({ packId, turnId, artifactIds: artifacts.map(artifact => artifact.id), artifacts, course, topic, persisted })
    setPracticePackBookletActiveId(current => artifacts.some(artifact => artifact.id === current) ? current : artifacts[0].id)
    setExpandedArtifactId(null)
  }

  function closePracticePackBooklet() {
    setPracticePackBooklet(null)
    setPracticePackBookletActiveId(null)
  }

  function openMapWorkspace(artifact: Artifact, returnView: MapWorkspaceReturnView) {
    setBackgroundTasksOpen(false)
    setMapWorkspaceArtifactId(artifact.id)
    setMapWorkspaceReturnView(returnView)
    setExpandedArtifactId(null)
    setView('map-workspace')
    recordSavedArtifactActivity(artifact)
  }

  function closeMapWorkspace() {
    setView(mapWorkspaceReturnView)
  }

  function openSettings() {
    setBackgroundTasksOpen(false)
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

  const refreshLibraryTopicState = useCallback(async (target = libraryTopic) => {
    if (!target) {
      setLibraryTopicState(null)
      return
    }
    setLibraryTopicStateLoading(true)
    try {
      const state = await getLibraryTopicLearningState(LOCAL_USER_ID, target.course, target.topic)
      if (libraryTopic?.course === target.course && libraryTopic?.topic === target.topic) {
        setLibraryTopicState(state)
      }
    } catch {
      if (libraryTopic?.course === target.course && libraryTopic?.topic === target.topic) {
        setLibraryTopicState(null)
      }
    } finally {
      if (libraryTopic?.course === target.course && libraryTopic?.topic === target.topic) {
        setLibraryTopicStateLoading(false)
      }
    }
  }, [libraryTopic])

  const refreshTopicStudyPlan = useCallback(async (target = libraryTopic) => {
    if (!target) {
      setTopicStudyPlan(null)
      return
    }
    setTopicStudyPlanLoading(true)
    try {
      const data = await getTopicStudyPlan(LOCAL_USER_ID, target.course, target.topic)
      if (libraryTopic?.course === target.course && libraryTopic?.topic === target.topic) {
        setTopicStudyPlan(data.plan)
      }
    } catch {
      if (libraryTopic?.course === target.course && libraryTopic?.topic === target.topic) {
        setTopicStudyPlan(null)
      }
    } finally {
      if (libraryTopic?.course === target.course && libraryTopic?.topic === target.topic) {
        setTopicStudyPlanLoading(false)
      }
    }
  }, [libraryTopic])

  useEffect(() => {
    if (!libraryTopic) {
      setLibraryTopicState(null)
      setLibraryTopicStateLoading(false)
      setTopicStudyPlan(null)
      setTopicStudyPlanLoading(false)
      return
    }
    void refreshLibraryTopicState(libraryTopic)
    void refreshTopicStudyPlan(libraryTopic)
  }, [libraryTopic, refreshLibraryTopicState, refreshTopicStudyPlan])

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
    setPendingDynamicExplanationTurnId(null)
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
      setPendingDynamicExplanationTurnId(null)
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
      let data = await getTutorSessions(LOCAL_USER_ID) as { sessions: TutorSessionSummary[] }
      const remoteSessions = data.sessions || []
      if (await syncDeferredSessionChanges(remoteSessions)) {
        data = await getTutorSessions(LOCAL_USER_ID) as { sessions: TutorSessionSummary[] }
      }
      setSessions(applyDeferredSessionChanges(data.sessions || []))
    } catch {
      setNotice('回答已保留，但历史列表暂时刷新失败。')
    }
  }

  function applyDeferredSessionChanges(remoteSessions: TutorSessionSummary[]) {
    const changes = deferredSessionChanges.current
    return sortTutorSessions(remoteSessions
      .filter(session => !changes[session.id]?.deleted)
      .map(session => {
        const change = changes[session.id]
        return change
          ? { ...session, title: change.title ?? session.title, is_pinned: change.is_pinned ?? session.is_pinned }
          : session
      }))
  }

  function deferSessionChange(sessionIdToChange: number, change: DeferredSessionChange) {
    const next = {
      ...deferredSessionChanges.current,
      [sessionIdToChange]: { ...deferredSessionChanges.current[sessionIdToChange], ...change },
    }
    deferredSessionChanges.current = next
    writeDeferredSessionChanges(next)
  }

  function clearDeferredSessionChange(sessionIdToChange: number, fields?: Array<keyof DeferredSessionChange>) {
    const current = deferredSessionChanges.current[sessionIdToChange]
    if (!current) return
    const next = { ...deferredSessionChanges.current }
    if (!fields) {
      delete next[sessionIdToChange]
    } else {
      const remaining = { ...current }
      fields.forEach(field => delete remaining[field])
      if (Object.keys(remaining).length) next[sessionIdToChange] = remaining
      else delete next[sessionIdToChange]
    }
    deferredSessionChanges.current = next
    writeDeferredSessionChanges(next)
  }

  async function syncDeferredSessionChanges(remoteSessions: TutorSessionSummary[]) {
    if (deferredSessionSyncing.current) return false
    deferredSessionSyncing.current = true
    let synchronized = false
    try {
      const remoteIds = new Set(remoteSessions.map(session => session.id))
      for (const [rawId, change] of Object.entries(deferredSessionChanges.current)) {
        const deferredId = Number(rawId)
        if (!Number.isFinite(deferredId)) continue
        if (!remoteIds.has(deferredId)) {
          clearDeferredSessionChange(deferredId)
          continue
        }
        try {
          if (change.deleted) {
            await deleteTutorSession(LOCAL_USER_ID, deferredId)
            clearDeferredSessionChange(deferredId)
            synchronized = true
            continue
          }
          const updates: { title?: string; is_pinned?: boolean } = {}
          if (change.title !== undefined) updates.title = change.title
          if (change.is_pinned !== undefined) updates.is_pinned = change.is_pinned
          if (Object.keys(updates).length) {
            await updateTutorSession(LOCAL_USER_ID, deferredId, updates)
            clearDeferredSessionChange(deferredId)
            synchronized = true
          }
        } catch {
          // The UI stays usable offline; this change is retried after the local server returns.
        }
      }
    } finally {
      deferredSessionSyncing.current = false
    }
    return synchronized
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
    const nextPinned = !item.is_pinned
    setSessionActionBusy(true)
    setSessions(current => sortTutorSessions(current.map(session => session.id === item.id
      ? { ...session, is_pinned: nextPinned, updated_at: new Date().toISOString() }
      : session)))
    try {
      await updateTutorSession(LOCAL_USER_ID, item.id, { is_pinned: nextPinned })
      clearDeferredSessionChange(item.id, ['is_pinned'])
      await refreshSessions()
      setNotice(item.is_pinned ? '已取消置顶对话。' : '已置顶对话。')
      closeSessionMenu()
    } catch (error) {
      if (isTemporarySessionMutationFailure(error)) {
        deferSessionChange(item.id, { is_pinned: nextPinned })
        setNotice('已在此设备更新置顶状态；本地服务恢复后会自动同步。')
        closeSessionMenu()
      } else {
        setSessions(current => sortTutorSessions(current.map(session => session.id === item.id
          ? { ...session, is_pinned: item.is_pinned, updated_at: item.updated_at }
          : session)))
        setNotice(error instanceof Error ? error.message : '更新对话失败。')
      }
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
    setSessions(current => sortTutorSessions(current.map(session => session.id === item.id
      ? { ...session, title, updated_at: new Date().toISOString() }
      : session)))
    try {
      await updateTutorSession(LOCAL_USER_ID, item.id, { title })
      clearDeferredSessionChange(item.id, ['title'])
      await refreshSessions()
      setNotice('对话已重命名。')
      closeSessionMenu()
    } catch (error) {
      if (isTemporarySessionMutationFailure(error)) {
        deferSessionChange(item.id, { title })
        setNotice('已在此设备重命名；本地服务恢复后会自动同步。')
        closeSessionMenu()
      } else {
        setSessions(current => sortTutorSessions(current.map(session => session.id === item.id
          ? { ...session, title: item.title, updated_at: item.updated_at }
          : session)))
        setNotice(error instanceof Error ? error.message : '重命名失败。')
      }
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
      const shareText = `${t('RHYME 学习对话', 'RHYME learning chat')}｜${history.title}\n\n${transcript}`
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: history.title, text: shareText })
          setNotice('已打开系统分享。')
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            setNotice('已取消分享。')
            closeSessionMenu()
            return
          }
          await copyPlainText(shareText)
          setNotice('系统分享不可用，完整对话已复制。')
        }
      } else {
        await copyPlainText(shareText)
        setNotice('完整对话已复制，可以直接粘贴分享。')
      }
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
      clearDeferredSessionChange(item.id)
      setSessions(current => current.filter(session => session.id !== item.id))
      if (sessionId === item.id) newChat()
      setNotice('对话记录已删除，已保存到资料库的资料不会受影响。')
      closeSessionMenu()
    } catch (error) {
      if (isTemporarySessionMutationFailure(error)) {
        deferSessionChange(item.id, { deleted: true })
        setSessions(current => current.filter(session => session.id !== item.id))
        if (sessionId === item.id) newChat()
        setNotice('已从此设备移除对话；本地服务恢复后会自动永久删除。')
        closeSessionMenu()
      } else {
        setNotice(error instanceof Error ? error.message : '删除对话失败。')
      }
    } finally {
      setSessionActionBusy(false)
    }
  }

  function chooseArtifact(kind: ArtifactKind) {
    if (kind === 'external_video') {
      openVideoSearch()
      return
    }
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

  function openVideoSearch(
    turnId?: string,
    contextOverride?: Partial<Pick<VideoSearchContext, 'course' | 'topic' | 'query' | 'sessionId'>>,
  ) {
    const targetTurnId = turnId || turns.at(-1)?.id
    const turn = targetTurnId ? turns.find(item => item.id === targetTurnId) : undefined
    if (!targetTurnId || !turn) {
      setNotice('先发出一个学习问题，我会根据这段对话直接找课程视频。')
      return
    }
    const course = contextOverride?.course || learningState.subject || '未分类课程'
    const topic = contextOverride?.topic || learningState.current_topic || learningState.knowledge_points[0] || '本次学习'
    const query = contextOverride?.query
      || [course !== '未分类课程' ? course : '', topic !== '本次学习' ? topic : ''].filter(Boolean).join(' ')
      || input.trim()
      || turn?.prompt
      || ''
    const context: VideoSearchContext = {
      turnId: targetTurnId,
      sessionId: contextOverride?.sessionId ?? sessionId ?? 0,
      query,
      course,
      topic,
    }
    const task: StoredBackgroundGenerationTask = {
      loadingId: `video-search-${Date.now()}`,
      kind: 'video',
      turnId: targetTurnId,
      sessionId: context.sessionId,
      createdAt: Date.now(),
      course,
      topic,
      title: '正在检索课程视频…',
      progress: {
        label: '正在检索课程视频',
        message: '已转入后台检索，你可以继续学习或稍后从后台任务查看结果。',
      },
      videoContext: context,
    }
    persistBackgroundGenerationTask(task)
    setInlineVideoSearches(current => ({
      ...current,
      [targetTurnId]: { context, results: [], searchUrl: '', loading: true, error: '', taskId: task.loadingId },
    }))
    setGenerateOpen(false)
    setNotice('课程视频正在后台检索。你可以继续使用其他功能，完成后在左下角“后台任务”打开。')
    void runVideoSearch(targetTurnId, context, task)
  }

  async function runVideoSearch(
    turnId: string,
    context: VideoSearchContext,
    backgroundTask?: StoredBackgroundGenerationTask,
  ) {
    const monitorKey = backgroundTask?.loadingId
    if (monitorKey && backgroundVideoSearchMonitors.current.has(monitorKey)) return
    if (monitorKey) backgroundVideoSearchMonitors.current.add(monitorKey)
    const cleanedQuery = context.query.trim()
    if (!cleanedQuery) {
      setInlineVideoSearches(current => ({
        ...current,
        [turnId]: {
          context,
          results: [],
          searchUrl: '',
          loading: false,
          error: '暂时无法判断学习主题，请先在对话里说清课程或知识点。',
          taskId: backgroundTask?.loadingId,
        },
      }))
      if (backgroundTask) {
        patchBackgroundGenerationTask(backgroundTask.loadingId, {
          status: 'failed',
          error: '暂时无法判断学习主题，请先在对话里说清课程或知识点。',
          errorCode: 'missing_query',
          retryable: true,
          progress: { label: '缺少检索主题', message: '补充课程或知识点后可重新检索。', percent: 0 },
        })
      }
      if (monitorKey) backgroundVideoSearchMonitors.current.delete(monitorKey)
      return
    }
    try {
      const response = await searchExternalVideos(cleanedQuery, context.course, context.topic)
      const resolvedContext = { ...context, query: response.query }
      setInlineVideoSearches(current => ({
        ...current,
        [turnId]: {
          context: resolvedContext,
          results: response.results,
          searchUrl: response.search_url,
          loading: false,
          error: '',
          taskId: backgroundTask?.loadingId,
        },
      }))
      if (backgroundTask) {
        patchBackgroundGenerationTask(backgroundTask.loadingId, {
          status: 'completed',
          title: `课程视频：${context.topic}`,
          videoContext: resolvedContext,
          videoResults: response.results,
          videoResultCount: response.results.length,
          videoSearchUrl: response.search_url,
          progress: {
            label: response.results.length ? `已找到 ${response.results.length} 个课程视频` : '已完成检索',
            message: response.results.length
              ? '课程视频已经整理好，可从后台任务直接查看。'
              : '没有找到匹配的视频，可以调整课程或知识点后重试。',
            percent: 100,
          },
        })
        setNotice(response.results.length
          ? `课程视频已检索完成，找到 ${response.results.length} 个结果。`
          : '课程视频检索完成，但暂未找到匹配结果。')
      } else {
        window.requestAnimationFrame(() => document.getElementById(`course-videos-${turnId}`)?.scrollIntoView({
          block: 'nearest',
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        }))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '课程视频检索失败，请稍后重试。'
      setInlineVideoSearches(current => ({
        ...current,
        [turnId]: {
          context,
          results: [],
          searchUrl: '',
          loading: false,
          error: message,
          taskId: backgroundTask?.loadingId,
        },
      }))
      if (backgroundTask) {
        patchBackgroundGenerationTask(backgroundTask.loadingId, {
          status: 'failed',
          error: message,
          errorCode: 'video_search_failed',
          retryable: true,
          progress: { label: '课程视频检索没有完成', message, percent: 0 },
        })
        setNotice(message)
      }
    } finally {
      if (monitorKey) backgroundVideoSearchMonitors.current.delete(monitorKey)
    }
  }

  function openExternalVideo(url: string, artifact?: Artifact) {
    if (artifact) recordSavedArtifactActivity(artifact, 'external_opened', { platform: 'bilibili', url })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function openExternalVideoSave(video: ExternalVideoResource, contextOverride?: VideoSearchContext) {
    const context = contextOverride || {
      sessionId: sessionId || 0,
      query: video.title,
      course: learningState.subject || '未分类课程',
      topic: learningState.current_topic || '本次学习',
    }
    setExternalVideoSaveTarget({ video, context })
    setSaveTarget(null)
    setLearningLoopSaveTarget(null)
    setSaveMode('save')
    setSaveRecommendedCourse(context.course)
    setSaveRecommendedTopic(context.topic)
    setSaveRecommendationSource('learning_state')
    setSaveTitle(video.title)
    setSaveCourse(context.course)
    setSaveTopic(context.topic)
    setSaveLocationOpen(
      context.course === '未分类课程'
      || context.topic === '未分类主题'
      || context.topic === '本次学习',
    )
    resetDuplicateDecision()
  }

  function prepareVideoFollowUp(artifact: Artifact, kind: 'interactive' | 'practice') {
    setLibraryPreviewId(null)
    setView('chat')
    setSelectedKind(kind)
    setInput(kind === 'interactive'
      ? `我看完了“${artifact.title}”，但“${artifact.topic}”还有些地方没理解。请用动态讲解带我重新推演一遍。`
      : `我看完了“${artifact.title}”。请围绕“${artifact.topic}”给我出一组练习检验理解。`)
    setNotice(kind === 'interactive' ? '已准备好动态讲解需求，发送后开始生成。' : '已准备好练习需求，发送后开始生成。')
    window.requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.composer-wrap textarea')?.focus())
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
          if (requestedKind === 'notes') {
            const completedTurn = turns.find(item => item.id === turnId)
            setDocumentSetup(defaultDocumentSetup(streamEvent.qa_id, prompt, completedTurn?.response || ''))
          }
          else if (requestedKind === 'practice') setPracticeSetupTurnId(streamEvent.qa_id)
          else if (requestedKind === 'map') setPendingMapGenerationTurnId(streamEvent.qa_id)
          else if (requestedKind === 'interactive') setPendingDynamicExplanationTurnId(streamEvent.qa_id)
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
    if (kind === 'external_video') {
      openVideoSearch(turnId)
      return
    }
    if (kind === 'notes') {
      const turn = turns.find(item => item.id === turnId)
      setDocumentSetup(current => current?.turnId === turnId ? null : defaultDocumentSetup(turnId, turn?.prompt, turn?.response))
      return
    }
    if (kind === 'map') {
      void runKnowledgeMapGeneration(turnId)
      return
    }
    if (kind === 'interactive') {
      void runDynamicExplanationGeneration(turnId)
      return
    }
    const practiceModeByKind: Partial<Record<ArtifactKind, PracticeMode>> = {
      practice: 'standard',
      similar: 'similar',
      variants: 'variants',
      special: 'special',
      mock: 'mock',
      coding: 'coding',
      oral: 'oral',
    }
    const practiceMode = practiceModeByKind[kind]
    if (practiceMode) {
      setPracticeSetupTurnId(current => current === turnId ? null : turnId)
      setPracticeSetupMode(practiceMode)
      return
    }
    setNotice(`${artifactOptions.find(item => item.kind === kind)?.label}将在后续阶段接通，当前先完成学习文档。`)
  }

  async function runDocumentGeneration(setupOverride?: DocumentSetup, replaceArtifactId?: string) {
    const setup = setupOverride || documentSetup
    if (!setup || !sessionId || documentGenerating) return
    const turn = turns.find(item => item.id === setup.turnId)
    if (!turn || turn.id.startsWith('pending-')) {
      setNotice('这条回答还没有保存完成，请稍后重试。')
      return
    }
    const template = setup.template
    const templateLabel = documentTemplateById[template].label
    const loadingId = replaceArtifactId || `document-generating-${Date.now()}`
    const loadingArtifact: Artifact = {
      id: loadingId,
      kind: 'notes',
      title: `正在生成${templateLabel}…`,
      summary: `正在按「${templateLabel}」的专属结构整理当前内容。`,
      details: ['读取当前问题与回答', `应用${templateLabel}模板`, '无需停留等待，完成后可从后台任务直接打开'],
      source: turn.prompt,
      sessionId,
      qaId: turn.id,
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
      documentTemplate: template,
      purpose: 'review',
      depth: 'standard',
      style: 'plain',
    }
    removeStoredBackgroundGenerationTask(loadingId)
    setBackgroundGenerationTasks(readStoredBackgroundGenerationTasks())
    setDocumentGenerating(true)
    setDocumentSetup(null)
    setTurns(current => current.map(item => item.id === turn.id
      ? {
          ...item,
          artifacts: replaceArtifactId
            ? item.artifacts.map(artifact => artifact.id === replaceArtifactId ? loadingArtifact : artifact)
            : [...item.artifacts, loadingArtifact],
        }
      : item))
    setNotice(`${templateLabel}已经转入后台生成。你可以继续学习，完成后在左下角“后台任务”打开。`)
    try {
      const queued = await generateLearningDocument(
        LOCAL_USER_ID,
        sessionId,
        turn.id,
        { document_template: template },
      )
      const task: StoredBackgroundGenerationTask = {
        loadingId,
        kind: 'notes',
        turnId: turn.id,
        sessionId,
        jobId: queued.job.job_id,
        createdAt: Date.now(),
        course: loadingArtifact.course,
        topic: loadingArtifact.topic,
        title: `正在生成${templateLabel}…`,
        documentTemplate: template,
        progress: {
          label: queued.job.status === 'queued' ? '正在等待生成' : '正在整理学习文档',
          message: '任务已经在后台运行，你可以随时从后台任务查看进度。',
        },
      }
      persistBackgroundGenerationTask(task)
      void monitorBackgroundGenerationJob(task, queued.job)
    } catch (error) {
      const message = error instanceof Error ? error.message : '学习文档生成失败'
      persistBackgroundGenerationTask({
        loadingId,
        kind: 'notes',
        turnId: turn.id,
        sessionId,
        createdAt: Date.now(),
        status: 'failed',
        error: message,
        errorCode: 'queue_unavailable',
        retryable: true,
        course: loadingArtifact.course,
        topic: loadingArtifact.topic,
        title: `${templateLabel}暂未完成`,
        documentTemplate: template,
        progress: { label: '任务没有进入后台队列', message, percent: 0 },
      })
      setTurns(current => current.map(item => item.id === turn.id
        ? {
            ...item,
            artifacts: item.artifacts.map(artifact => artifact.id === loadingId
              ? { ...artifact, title: `${templateLabel}暂未完成`, summary: message, details: ['原始问答已保留，可从后台任务直接重试。'], status: 'error' }
              : artifact),
          }
        : item))
      setNotice(message)
    } finally {
      setDocumentGenerating(false)
    }
  }

  function openDocumentPackSetup(turnId: string) {
    const turn = turns.find(item => item.id === turnId)
    if (!turn) return
    setDocumentSetup(null)
    setDocumentPackSetup(current => current?.turnId === turnId
      ? null
      : { turnId, templates: recommendedDocumentPackTemplates(turn.prompt, turn.response) })
  }

  function returnToDocumentSetup(turnId: string) {
    const turn = turns.find(item => item.id === turnId)
    if (!turn) return
    setDocumentPackSetup(null)
    setDocumentSetup(defaultDocumentSetup(turnId, turn.prompt, turn.response))
  }

  function toggleDocumentPackTemplate(template: DocumentTemplateId) {
    setDocumentPackSetup(current => {
      if (!current) return current
      return current.templates.includes(template)
        ? { ...current, templates: current.templates.filter(item => item !== template) }
        : { ...current, templates: [...current.templates, template] }
    })
  }

  async function runDocumentPackGeneration() {
    if (!documentPackSetup || !sessionId || documentPackGenerationLocked.current) return
    const setup = documentPackSetup
    const turn = turns.find(item => item.id === setup.turnId)
    const templates = [...new Set(setup.templates)]
    if (!turn || turn.id.startsWith('pending-')) {
      setNotice('这条回答还没有保存完成，请稍后重试。')
      return
    }
    if (templates.length === 0) {
      setNotice('至少选择一份要生成的资料。')
      return
    }

    const packId = `document-pack-${Date.now()}`
    const course = learningState.subject || '未分类课程'
    const topic = learningState.current_topic || '本次学习'
    const placeholders = templates.map(template => ({
      id: `${packId}-${template}`,
      kind: 'notes' as const,
      title: `正在生成${documentTemplateById[template].label}…`,
      summary: `正在按「${documentTemplateById[template].label}」的专属结构整理当前内容。`,
      details: ['读取当前问题与回答', `应用${documentTemplateById[template].label}模板`, '生成完成后可整包保存'],
      source: turn.prompt,
      sessionId,
      qaId: turn.id,
      course,
      topic,
      topicMastery: 0,
      recommendedCourse: course,
      recommendedTopic: topic,
      classificationSource: 'learning_state' as const,
      classificationConfidence: 0.9,
      classificationOverridden: false,
      saved: false,
      favorite: false,
      versionGroupId: 0,
      version: 1,
      status: 'generating' as const,
      documentTemplate: template,
      documentPackId: packId,
      documentPackTemplate: template,
    }))
    const replacePlaceholder = (placeholderId: string, next: Artifact) => {
      setTurns(current => current.map(item => item.id === turn.id
        ? { ...item, artifacts: item.artifacts.map(artifact => artifact.id === placeholderId ? next : artifact) }
        : item))
    }

    documentPackGenerationLocked.current = true
    setDocumentPackGeneratingTurnId(turn.id)
    setDocumentPackPlanningByTurn(current => ({
      ...current,
      [turn.id]: { packId, templates },
    }))
    setDocumentPackSetup(null)
    setDocumentSetup(null)
    setNotice('正在制定学习路线，确定各章节分工、共同例题与重点…')
    setTurns(current => current.map(item => item.id === turn.id
      ? { ...item, artifacts: [...item.artifacts, ...placeholders] }
      : item))
    try {
      let blueprint: StudyPackBlueprint | undefined
      try {
        const queuedPlan = await generateStudyPackBlueprint(LOCAL_USER_ID, sessionId, turn.id, templates)
        blueprint = (await waitForGenerationJob(LOCAL_USER_ID, queuedPlan.job)).blueprint
      } catch {
        // The backend also has a safe fallback. If the planning job itself is
        // unavailable, keep the pack useful and do not discard the user's work.
        setNotice('学习路线暂时不可用，正在按所选章节并行生成资料…')
      } finally {
        setDocumentPackPlanningByTurn(current => {
          const next = { ...current }
          delete next[turn.id]
          return next
        })
      }
      setNotice(`正在按统一学习路线并行生成 ${templates.length} 份资料…`)
      const results = await Promise.all(templates.map(async (template, index) => {
        const placeholder = placeholders[index]
        try {
          const queued = await generateLearningDocument(LOCAL_USER_ID, sessionId, turn.id, {
            document_template: template,
            study_pack_blueprint: blueprint,
            study_pack_templates: templates,
            document_pack_id: packId,
            document_pack_template: template,
          })
          const record = (await waitForGenerationJob(LOCAL_USER_ID, queued.job)).artifact
          const generated: Artifact = {
            ...artifactFromRecord(record),
            documentPackId: packId,
            documentPackTemplate: template,
          }
          replacePlaceholder(placeholder.id, generated)
          return generated
        } catch (error) {
          const message = error instanceof Error ? error.message : '学习资料生成失败'
          replacePlaceholder(placeholder.id, {
            ...placeholder,
            title: `${documentTemplateById[template].label}未完成`,
            summary: message,
            details: ['其他已完成的资料会保留，可单独重新生成。'],
            status: 'error',
          })
          return null
        }
      }))
      const completed = results.filter((artifact): artifact is Artifact => Boolean(artifact)).length
      setNotice(completed === templates.length
        ? `${completed} 份资料已就绪，可一键整理为同一学习资料包。`
        : `${completed}/${templates.length} 份资料已完成，未完成的资料可稍后单独重试。`)
    } finally {
      documentPackGenerationLocked.current = false
      setDocumentPackGeneratingTurnId(current => current === turn.id ? null : current)
    }
  }

  async function runPracticeGeneration(
    turnId: string,
    sourceMapArtifactId?: number,
    practiceMode: PracticeMode = 'standard',
    focusPoints: string[] = [],
    replaceArtifactId?: string,
  ) {
    if (!sessionId || practiceGenerating || practiceGenerationLocked.current) return
    const turn = turns.find(item => item.id === turnId)
    if (!turn || turn.id.startsWith('pending-')) {
      setNotice('这条回答还没有保存完成，请稍后重试。')
      return
    }
    const profile = practiceProfiles[practiceMode]
    const loadingId = replaceArtifactId || `practice-generating-${Date.now()}`
    const loadingArtifact: Artifact = {
      id: loadingId,
      kind: 'practice',
      title: `正在生成${profile.label}…`,
      summary: `正在围绕当前回答编写 ${profile.count} 道${profile.label}内容。`,
      details: [profile.description, '无需停留等待，完成后可从后台任务直接进入作答'],
      source: turn.prompt,
      sessionId,
      qaId: turn.id,
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
      sourceMapArtifactId,
    }
    removeStoredBackgroundGenerationTask(loadingId)
    setBackgroundGenerationTasks(readStoredBackgroundGenerationTasks())
    practiceGenerationLocked.current = true
    setPracticeGenerating(true)
    setPracticeSetupTurnId(null)
    setNotice(`${profile.label}已经转入后台生成。你可以继续学习，完成后在左下角“后台任务”进入作答。`)
    setTurns(current => current.map(item => item.id === turn.id
      ? {
          ...item,
          artifacts: replaceArtifactId
            ? item.artifacts.map(artifact => artifact.id === replaceArtifactId ? loadingArtifact : artifact)
            : [...item.artifacts, loadingArtifact],
        }
      : item))
    try {
      const queued = await generatePracticeSet(LOCAL_USER_ID, sessionId, turn.id, focusPoints, sourceMapArtifactId, practiceMode)
      const task: StoredBackgroundGenerationTask = {
        loadingId,
        kind: 'practice',
        turnId: turn.id,
        sessionId,
        jobId: queued.job.job_id,
        createdAt: Date.now(),
        course: loadingArtifact.course,
        topic: loadingArtifact.topic,
        title: `正在生成${profile.label}…`,
        practiceMode,
        sourceMapArtifactId,
        focusPoints,
        progress: {
          label: queued.job.status === 'queued' ? '正在等待出题' : '正在编写练习题',
          message: '任务已经在后台运行，完成后可直接开始做题。',
        },
      }
      persistBackgroundGenerationTask(task)
      void monitorBackgroundGenerationJob(task, queued.job)
    } catch (error) {
      const message = error instanceof Error ? error.message : '练习测验生成失败'
      persistBackgroundGenerationTask({
        loadingId,
        kind: 'practice',
        turnId: turn.id,
        sessionId,
        createdAt: Date.now(),
        status: 'failed',
        error: message,
        errorCode: 'queue_unavailable',
        retryable: true,
        course: loadingArtifact.course,
        topic: loadingArtifact.topic,
        title: `${profile.label}暂未完成`,
        practiceMode,
        sourceMapArtifactId,
        focusPoints,
        progress: { label: '任务没有进入后台队列', message, percent: 0 },
      })
      setTurns(current => current.map(item => item.id === turn.id
        ? {
            ...item,
            artifacts: item.artifacts.map(item => item.id === loadingId
              ? { ...item, title: `${profile.label}暂未完成`, summary: message, details: ['原始问答已保留，可从后台任务直接重试。'], status: 'error' }
              : item),
          }
        : item))
      setNotice(message)
    } finally {
      practiceGenerationLocked.current = false
      setPracticeGenerating(false)
    }
  }

  async function runKnowledgeMapGeneration(turnId: string, replaceArtifactId?: string) {
    if (!sessionId) {
      setNotice('学习对话还在恢复，请稍等一秒后再试。')
      return
    }
    const turn = turns.find(item => item.id === turnId)
    if (!turn || turn.id.startsWith('pending-')) {
      setNotice('这条回答还没有保存完成，请稍后重试。')
      return
    }
    const existingGeneratingMap = turn.artifacts.find(artifact => artifact.kind === 'map' && artifact.status === 'generating')
    if (knowledgeMapGeneratingTurnId) {
      if (existingGeneratingMap) setBackgroundTasksOpen(true)
      setNotice('已有一张知识图解正在后台生成，可从左下角“后台任务”查看。')
      return
    }
    const activeLock = knowledgeMapGenerationLock.current
    if (activeLock && Date.now() - activeLock.startedAt < 1500) {
      if (existingGeneratingMap) setBackgroundTasksOpen(true)
      setNotice('知识图解任务已经开始，可从左下角“后台任务”查看。')
      return
    }
    // A hot reload, interrupted request, or restored conversation can leave the
    // synchronous click guard behind after React state has already recovered.
    // Treat an old guard without an active generating state as stale.
    if (activeLock) knowledgeMapGenerationLock.current = null
    const loadingId = replaceArtifactId || `map-generating-${Date.now()}`
    // The learner should be able to open a real map immediately. This local
    // relationship skeleton is deliberately lightweight and is replaced by
    // the fact-checked cloud map as soon as that job completes.
    const provisionalMap = createProvisionalKnowledgeMap(
      turn.prompt,
      turn.response,
      learningState.current_topic || learningState.subject || turn.prompt,
    )
    const loadingArtifact: Artifact = {
      id: loadingId,
      kind: 'map',
      title: provisionalMap.nodes[0]?.label || '当前主题知识图解',
      summary: '先显示本次讲解的关系骨架；后台会自动补全为经过校准的完整图解。',
      details: ['关系骨架已经可以打开查看', '后台只校准这张主图，不再批量堆叠多张旧图'],
      content: JSON.stringify(provisionalMap),
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
    removeStoredBackgroundGenerationTask(loadingId)
    setBackgroundGenerationTasks(readStoredBackgroundGenerationTasks())
    knowledgeMapGenerationLock.current = { turnId: turn.id, loadingId, startedAt: Date.now() }
    setKnowledgeMapGeneratingTurnId(turn.id)
    setNotice('知识图解已经转入后台生成。你可以继续学习，完成后在左下角“后台任务”打开。')
    setTurns(current => current.map(item => item.id === turn.id
      ? {
          ...item,
          artifacts: replaceArtifactId
            ? item.artifacts.map(artifact => artifact.id === replaceArtifactId ? loadingArtifact : artifact)
            : [...item.artifacts.filter(artifact => !(artifact.kind === 'map' && artifact.status === 'generating')), loadingArtifact],
        }
      : item))
    try {
      const queued = await generateKnowledgeMap(LOCAL_USER_ID, sessionId, turn.id)
      const task: StoredBackgroundGenerationTask = {
        loadingId,
        kind: 'map',
        turnId: turn.id,
        sessionId,
        jobId: queued.job.job_id,
        createdAt: Date.now(),
        course: loadingArtifact.course,
        topic: loadingArtifact.topic,
        title: '正在梳理知识图解…',
        progress: {
          label: queued.job.status === 'queued' ? '正在等待图解生成' : '正在梳理知识关系',
          message: '任务已经在后台运行，完成后可直接打开图解。',
        },
      }
      persistBackgroundGenerationTask(task)
      void monitorBackgroundGenerationJob(task, queued.job)
    } catch (error) {
      const message = error instanceof Error ? error.message : '知识图解生成失败'
      persistBackgroundGenerationTask({
        loadingId,
        kind: 'map',
        turnId: turn.id,
        sessionId,
        createdAt: Date.now(),
        status: 'failed',
        error: message,
        errorCode: 'queue_unavailable',
        retryable: true,
        course: loadingArtifact.course,
        topic: loadingArtifact.topic,
        title: '知识图解暂未完成',
        progress: { label: '任务没有进入后台队列', message, percent: 0 },
      })
      setTurns(current => current.map(item => item.id === turn.id
        ? {
            ...item,
            artifacts: item.artifacts.map(item => item.id === loadingId
              ? { ...item, title: '知识图解暂未完成', summary: message, details: ['原始问答已保留，可从后台任务直接重试。'], status: 'error' }
              : item),
          }
        : item))
      setNotice(message)
    } finally {
      if (knowledgeMapGenerationLock.current?.loadingId === loadingId) knowledgeMapGenerationLock.current = null
      setKnowledgeMapGeneratingTurnId(null)
    }
  }

  async function monitorBackgroundGenerationJob(
    task: StoredBackgroundGenerationTask,
    initialJob: GenerationJob<{ artifact: LearningArtifactRecord }>,
    resumed = false,
  ) {
    if (backgroundGenerationJobMonitors.current.has(task.jobId || task.loadingId)) return
    const monitorKey = task.jobId || task.loadingId
    backgroundGenerationJobMonitors.current.add(monitorKey)
    const label = task.kind === 'notes'
      ? task.documentTemplate ? documentTemplateById[task.documentTemplate].label : '学习文档'
      : task.kind === 'practice'
        ? practiceProfiles[task.practiceMode || 'standard'].label
        : '知识图解'
    let latestJob = initialJob
    let latestProgressSignature = ''
    try {
      const data = await waitForGenerationJob(LOCAL_USER_ID, initialJob, job => {
        latestJob = job
        const rawProgress = job.progress as BackgroundTaskProgress | undefined
        const progress: BackgroundTaskProgress = {
          label: rawProgress?.label || (job.status === 'queued' ? '正在等待生成' : '正在后台生成'),
          message: rawProgress?.message || '任务会继续运行，你可以正常使用其他功能。',
          ...(typeof rawProgress?.percent === 'number' ? { percent: rawProgress.percent } : {}),
        }
        const signature = JSON.stringify(progress)
        if (signature === latestProgressSignature) return
        latestProgressSignature = signature
        patchBackgroundGenerationTask(task.loadingId, { progress })
      })
      const artifact = artifactFromRecord(data.artifact)
      patchBackgroundGenerationTask(task.loadingId, {
        status: 'completed',
        title: artifact.title,
        resultArtifactId: artifact.id,
        error: undefined,
        errorCode: undefined,
        retryable: undefined,
        progress: {
          label: `${label}已完成`,
          message: '内容已经准备好，可从后台任务直接打开。',
          percent: 100,
        },
      })
      setTurns(current => current.map(item => item.id === task.turnId
        ? {
            ...item,
            artifacts: item.artifacts.some(item => item.id === task.loadingId)
              ? item.artifacts.map(item => item.id === task.loadingId ? artifact : item)
              : [...item.artifacts, artifact],
          }
        : item))
      if (!resumed) setNotice(`${label}已生成。结果已保留在“后台任务”中，点击即可打开。`)
    } catch (error) {
      const rawMessage = latestJob.error || (error instanceof Error ? error.message : `${label}生成失败`)
      const jobMissing = /任务暂时无法读取|任务不存在|已过期|后台服务已重新启动/.test(rawMessage)
      const message = jobMissing
        ? '后台服务已重新启动，原生成任务未能继续；原始问答仍在，可立即重试。'
        : rawMessage
      const failureTask: StoredBackgroundGenerationTask = {
        ...task,
        status: 'failed',
        error: message,
        errorCode: jobMissing ? 'job_expired' : latestJob.error_code,
        retryable: jobMissing ? true : latestJob.retryable !== false,
        progress: {
          label: '本次生成未完成',
          message,
          percent: 0,
        },
      }
      persistBackgroundGenerationTask(failureTask)
      setTurns(current => current.map(item => item.id === task.turnId
        ? {
            ...item,
            artifacts: item.artifacts.map(artifact => artifact.id === task.loadingId
              ? {
                  ...artifact,
                  title: `${label}暂未完成`,
                  summary: message,
                  details: [
                    failureTask.retryable === false
                      ? '请先检查来源回答是否仍存在，再重新发起生成。'
                      : '原始问答已保留，可从后台任务直接重试。',
                  ],
                  status: 'error',
                }
              : artifact),
          }
        : item))
      setNotice(message)
    } finally {
      backgroundGenerationJobMonitors.current.delete(monitorKey)
    }
  }

  function updateDynamicExplanationProgress(turnId: string, loadingId: string, progress: DynamicExplanationJobProgress) {
    const details = [
      progress.label,
      progress.current_scene_title ? `正在单独优化“${progress.current_scene_title}”` : '',
      progress.retry_attempt ? `已自动重试 ${progress.retry_attempt}/${progress.retry_limit || 2} 次` : '',
      progress.recovery_mode ? '已用当前问答补齐为稳定、可播放的互动讲解' : '',
      typeof progress.quality_score === 'number' ? `当前内容质量 ${progress.quality_score} 分` : '',
    ].filter(Boolean)
    setTurns(current => current.map(item => item.id === turnId
      ? {
          ...item,
          artifacts: item.artifacts.map(artifact => artifact.id === loadingId
            ? {
                ...artifact,
                summary: progress.message || artifact.summary,
                details: details.length ? details : artifact.details,
                generationProgress: progress,
              }
            : artifact),
        }
      : item))
  }

  async function monitorDynamicExplanationJob(
    task: StoredDynamicExplanationJob,
    initialJob: GenerationJob<{ artifact: LearningArtifactRecord }>,
    resumed = false,
  ) {
    if (dynamicExplanationJobMonitors.current.has(task.jobId)) return
    dynamicExplanationJobMonitors.current.add(task.jobId)
    dynamicExplanationGenerationLocked.current = true
    setDynamicExplanationGeneratingTurnId(task.turnId)
    let latestJob = initialJob
    try {
      const data = await waitForGenerationJob(LOCAL_USER_ID, initialJob, job => {
        latestJob = job
        const progress = job.progress as DynamicExplanationJobProgress | undefined
        if (progress?.label) updateDynamicExplanationProgress(task.turnId, task.loadingId, progress)
      })
      const artifact = artifactFromRecord(data.artifact)
      removeStoredDynamicExplanationJob(task.loadingId)
      setTurns(current => current.map(item => item.id === task.turnId
        ? { ...item, artifacts: item.artifacts.map(item => item.id === task.loadingId ? artifact : item) }
        : item))
      setExpandedArtifactId(artifact.id)
      setRecentDynamicExplanationArtifactId(artifact.id)
      setNotice('动态讲解已生成。结果已保留在“后台任务”中，点击即可返回并打开。')
      if (!resumed) {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          document.getElementById(`artifact-${artifact.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }))
      }
    } catch (error) {
      const rawMessage = latestJob.error || (error instanceof Error ? error.message : '动态讲解生成失败')
      const jobMissing = /任务暂时无法读取|任务不存在|已过期/.test(rawMessage)
      const message = jobMissing
        ? '后台服务已重新启动，原生成任务未能继续；原始问答仍在，可立即重试。'
        : rawMessage
      const failureTask: StoredDynamicExplanationJob = {
        ...task,
        status: 'failed',
        error: message,
        errorCode: jobMissing ? 'job_expired' : latestJob.error_code,
        retryable: jobMissing ? true : latestJob.retryable !== false,
      }
      writeStoredDynamicExplanationJob(failureTask)
      const stoppedAt = (latestJob.progress as DynamicExplanationJobProgress | undefined)?.label || '本次生成未完成'
      updateDynamicExplanationProgress(task.turnId, task.loadingId, {
        phase: 'failed',
        label: stoppedAt,
        message,
        percent: 0,
        error_code: failureTask.errorCode,
      })
      setTurns(current => current.map(item => item.id === task.turnId
        ? {
            ...item,
            artifacts: item.artifacts.map(artifact => artifact.id === task.loadingId
              ? {
                  ...artifact,
                  title: '动态讲解暂未完成',
                  summary: message,
                  details: [
                    `停止于：${stoppedAt}`,
                    failureTask.retryable === false
                      ? '请先检查来源回答是否仍存在，再重新发起生成。'
                      : '原始问答已保留，点击下方“立即重试”会在这里原位继续。',
                  ],
                  status: 'error',
                  generationProgress: {
                    phase: 'failed', label: stoppedAt, message, percent: 0, error_code: failureTask.errorCode,
                  },
                }
              : artifact),
          }
        : item))
      setRecentDynamicExplanationArtifactId(task.loadingId)
      setNotice(message)
    } finally {
      dynamicExplanationJobMonitors.current.delete(task.jobId)
      if (dynamicExplanationJobMonitors.current.size === 0) {
        dynamicExplanationGenerationLocked.current = false
        setDynamicExplanationGeneratingTurnId(null)
      }
    }
  }

  async function runDynamicExplanationGeneration(turnId: string, replaceArtifactId?: string) {
    if (!sessionId) {
      setNotice('当前对话还没有准备完成，请稍后再试。')
      return
    }
    if (dynamicExplanationGeneratingTurnId || dynamicExplanationGenerationLocked.current) {
      setNotice('已有一份动态讲解正在后台生成，完成后会自动更新。')
      return
    }
    const turn = turns.find(item => item.id === turnId)
    if (!turn || turn.id.startsWith('pending-')) {
      setNotice('这条回答还没有保存完成，请稍后重试。')
      return
    }
    const replacedArtifact = replaceArtifactId
      ? turn.artifacts.find(artifact => artifact.id === replaceArtifactId)
      : undefined
    const loadingId = replaceArtifactId || `dynamic-explanation-generating-${Date.now()}`
    const loadingArtifact = createDynamicExplanationPlaceholder(turn, loadingId, replacedArtifact)
    removeStoredDynamicExplanationJob(loadingId)
    dynamicExplanationGenerationLocked.current = true
    setDynamicExplanationGeneratingTurnId(turn.id)
    setRecentDynamicExplanationArtifactId(loadingId)
    setDismissedDynamicTaskIds(current => {
      const next = new Set(current)
      next.delete(loadingId)
      return next
    })
    setNotice('动态讲解已转入后台精修。单次云端分镜生成最长约 2 分钟；你可以继续学习，完成前会进行动画质量检查。')
    setTurns(current => current.map(item => item.id === turn.id
      ? {
          ...item,
          artifacts: replaceArtifactId
            ? item.artifacts.map(artifact => artifact.id === replaceArtifactId ? loadingArtifact : artifact)
            : [...item.artifacts.filter(artifact => !(artifact.kind === 'interactive' && artifact.status === 'generating')), loadingArtifact],
        }
      : item))
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById(`artifact-${loadingId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }))
    try {
      const queued = await generateDynamicExplanation(LOCAL_USER_ID, sessionId, turn.id)
      const task: StoredDynamicExplanationJob = {
        jobId: queued.job.job_id,
        turnId: turn.id,
        sessionId,
        loadingId,
        createdAt: Date.now(),
      }
      writeStoredDynamicExplanationJob(task)
      await monitorDynamicExplanationJob(task, queued.job)
    } catch (error) {
      // monitorDynamicExplanationJob normally owns the failure state. This only
      // covers a request that could not enter the backend queue at all.
      const message = error instanceof Error ? error.message : '动态讲解暂时无法启动'
      const failedTask: StoredDynamicExplanationJob = {
        jobId: `request-${Date.now()}`,
        turnId: turn.id,
        sessionId,
        loadingId,
        createdAt: Date.now(),
        status: 'failed',
        error: message,
        errorCode: 'queue_unavailable',
        retryable: true,
      }
      writeStoredDynamicExplanationJob(failedTask)
      setTurns(current => current.map(item => item.id === turn.id
        ? {
            ...item,
            artifacts: item.artifacts.map(artifact => artifact.id === loadingId
              ? { ...artifact, title: '动态讲解暂未完成', summary: message, details: ['生成任务尚未进入后台队列，点击下方“立即重试”即可重新开始。'], status: 'error' }
              : artifact),
          }
        : item))
      setNotice(message)
    } finally {
      if (dynamicExplanationJobMonitors.current.size === 0) {
        dynamicExplanationGenerationLocked.current = false
        setDynamicExplanationGeneratingTurnId(null)
      }
    }
  }

  async function runLearningLoopGeneration(turnId: string) {
    if (!sessionId || learningLoopGeneratingTurnId || learningLoopGenerationLocked.current) return
    const turn = turns.find(item => item.id === turnId)
    if (!turn || turn.id.startsWith('pending-')) {
      setNotice('这条回答还没有保存完成，请稍后重试。')
      return
    }

    const loopId = `learning-loop-${Date.now()}`
    const course = learningState.subject || '未分类课程'
    const topic = learningState.current_topic || '本次学习'
    const createPlaceholder = (step: LearningLoopStep): Artifact => {
      const meta = learningLoopSteps.find(item => item.kind === step)!
      return {
        id: `${loopId}-${step}`,
        kind: step,
        title: meta.generating,
        summary: step === 'practice'
          ? '知识图解完成后，会基于图解节点生成练习并建立回写关联。'
          : '正在依据当前问答整理这套学习资料。',
        details: [meta.detail, step === 'practice' ? '提交练习后，错题会回写到关联的图解节点' : '将自动归入当前课程与主题'],
        source: turn.prompt,
        sessionId,
        qaId: turn.id,
        course,
        topic,
        topicMastery: 0,
        recommendedCourse: course,
        recommendedTopic: topic,
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
        style: step === 'notes' ? 'plain' : 'exam',
        learningLoopId: loopId,
        learningLoopStep: step,
      }
    }

    const placeholders = learningLoopSteps.map(item => createPlaceholder(item.kind))
    const replaceLoopArtifact = (placeholderId: string, replacement: Artifact) => {
      setTurns(current => current.map(item => item.id === turnId
        ? { ...item, artifacts: item.artifacts.map(artifact => artifact.id === placeholderId ? replacement : artifact) }
        : item))
    }
    const completeStage = async (
      step: LearningLoopStep,
      work: () => Promise<LearningArtifactRecord>,
      retryOnce = false,
    ): Promise<Artifact | null> => {
      const placeholder = placeholders.find(item => item.learningLoopStep === step)!
      try {
        let record: LearningArtifactRecord | null = null
        let lastError: unknown
        for (let attempt = 0; attempt < (retryOnce ? 2 : 1); attempt += 1) {
          try {
            record = await work()
            break
          } catch (error) {
            lastError = error
          }
        }
        if (!record) throw lastError || new Error('生成没有完成，请稍后重试')
        const generated = {
          ...artifactFromRecord(record),
          learningLoopId: loopId,
          learningLoopStep: step,
        }
        replaceLoopArtifact(placeholder.id, generated)
        return generated
      } catch (error) {
        const message = error instanceof Error ? error.message : `${learningLoopSteps.find(item => item.kind === step)?.label || '资料'}生成失败`
        replaceLoopArtifact(placeholder.id, {
          ...placeholder,
          title: `${learningLoopSteps.find(item => item.kind === step)?.label || '资料'}未完成`,
          summary: message,
          details: ['可以单独重新生成这一份资料，其他已完成的内容会保留。'],
          status: 'error',
        })
        return null
      }
    }

    learningLoopGenerationLocked.current = true
    setLearningLoopGeneratingTurnId(turnId)
    setDocumentSetup(null)
    setPracticeSetupTurnId(null)
    setLearningLoopActiveStepByTurn(current => ({ ...current, [turnId]: 'notes' }))
    setNotice('正在生成学习闭环：讲义、图解和动态讲解会同时开始，练习将在图解完成后接入。')
    setTurns(current => current.map(item => item.id === turnId
      ? { ...item, artifacts: [...item.artifacts, ...placeholders] }
      : item))

    try {
      const documentTask = completeStage('notes', async () => {
        const queued = await generateLearningDocument(LOCAL_USER_ID, sessionId, turn.id, {
          document_template: 'system_guide',
        })
        return (await waitForGenerationJob(LOCAL_USER_ID, queued.job)).artifact
      })
      const mapTask = completeStage('map', async () => {
        const queued = await generateKnowledgeMap(LOCAL_USER_ID, sessionId, turn.id)
        return (await waitForGenerationJob(LOCAL_USER_ID, queued.job)).artifact
      })
      const explanationTask = completeStage('interactive', async () => {
        const queued = await generateDynamicExplanation(LOCAL_USER_ID, sessionId, turn.id)
        return (await waitForGenerationJob(LOCAL_USER_ID, queued.job)).artifact
      })
      const [documentArtifact, mapArtifact, explanationArtifact] = await Promise.all([documentTask, mapTask, explanationTask])
      const practiceArtifact = mapArtifact?.backendId
        ? await completeStage('practice', async () => {
          const queued = await generatePracticeSet(LOCAL_USER_ID, sessionId, turn.id, [], mapArtifact.backendId)
          return (await waitForGenerationJob(LOCAL_USER_ID, queued.job)).artifact
        }, true)
        : (() => {
          const placeholder = placeholders.find(item => item.learningLoopStep === 'practice')!
          replaceLoopArtifact(placeholder.id, {
            ...placeholder,
            title: '练习等待图解恢复',
            summary: '知识图解尚未完成。请先重新生成图解，系统会继续生成这份关联练习。',
            details: ['练习必须关联知识图解，才能在提交后准确回写薄弱节点。'],
            status: 'error',
          })
          return null
        })()
      const generatedCount = [documentArtifact, mapArtifact, explanationArtifact, practiceArtifact].filter(Boolean).length
      setNotice(generatedCount === 4
        ? '四份资料已就绪。按“学习文档 → 知识图解 → 动态讲解 → 练习检验”开始即可。'
        : '学习闭环已尽量生成完成；未完成的资料可以单独重新生成。')
    } finally {
      learningLoopGenerationLocked.current = false
      setLearningLoopGeneratingTurnId(current => current === turnId ? null : current)
    }
  }

  function openLearningLoopStep(turnId: string, step: LearningLoopStep, artifact?: Artifact) {
    if (!artifact || artifact.status === 'generating') {
      setNotice('这一环还在准备中，完成后会自动可用。')
      return
    }
    if (artifact.status === 'error') {
      setNotice('这一环暂未生成成功，可以在资料卡片中单独重新生成。')
      return
    }
    setLearningLoopActiveStepByTurn(current => ({ ...current, [turnId]: step }))
    if (step === 'notes') {
      setExpandedArtifactId(artifact.id)
      window.requestAnimationFrame(() => document.getElementById(`artifact-${artifact.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      return
    }
    if (step === 'map') {
      openMapWorkspace(artifact, 'chat')
      return
    }
    if (step === 'interactive') {
      setImmersiveOpenRequest({ artifactId: artifact.id, revision: Date.now() })
      return
    }
    void openPractice(artifact)
  }

  async function retryLearningLoopMap(turnId: string, failedArtifact: Artifact) {
    if (!sessionId || !failedArtifact.learningLoopId) return
    const turn = turns.find(item => item.id === turnId)
    if (!turn) return
    const waitingPractice = turn.artifacts.find(item => (
      item.learningLoopId === failedArtifact.learningLoopId && item.learningLoopStep === 'practice'
    ))
    setTurns(current => current.map(item => item.id === turnId
      ? { ...item, artifacts: item.artifacts.map(artifact => artifact.id === failedArtifact.id
        ? { ...artifact, title: '正在重新生成知识图解', summary: '图解完成后会自动继续生成关联练习。', status: 'generating' }
        : artifact) }
      : item))
    try {
      const queued = await generateKnowledgeMap(LOCAL_USER_ID, sessionId, turn.id)
      const result = await waitForGenerationJob(LOCAL_USER_ID, queued.job)
      const generatedMap = {
        ...artifactFromRecord(result.artifact),
        learningLoopId: failedArtifact.learningLoopId,
        learningLoopStep: 'map' as const,
      }
      setTurns(current => current.map(item => item.id === turnId
        ? { ...item, artifacts: item.artifacts.map(artifact => artifact.id === failedArtifact.id ? generatedMap : artifact) }
        : item))

      if (!waitingPractice || waitingPractice.status !== 'error' || !generatedMap.backendId) return
      setTurns(current => current.map(item => item.id === turnId
        ? { ...item, artifacts: item.artifacts.map(artifact => artifact.id === waitingPractice.id
          ? { ...artifact, title: '正在生成关联练习', summary: '题目会依据知识图解生成，提交后可回写薄弱节点。', status: 'generating' }
          : artifact) }
        : item))
      try {
        const practiceQueued = await generatePracticeSet(LOCAL_USER_ID, sessionId, turn.id, [], generatedMap.backendId)
        const practiceResult = await waitForGenerationJob(LOCAL_USER_ID, practiceQueued.job)
        const generatedPractice = {
          ...artifactFromRecord(practiceResult.artifact),
          learningLoopId: failedArtifact.learningLoopId,
          learningLoopStep: 'practice' as const,
        }
        setTurns(current => current.map(item => item.id === turnId
          ? { ...item, artifacts: item.artifacts.map(artifact => artifact.id === waitingPractice.id ? generatedPractice : artifact) }
          : item))
        setNotice('知识图解和关联练习已恢复，练习完成后会回写到图解节点。')
      } catch (error) {
        const message = error instanceof Error ? error.message : '关联练习生成失败'
        setTurns(current => current.map(item => item.id === turnId
          ? { ...item, artifacts: item.artifacts.map(artifact => artifact.id === waitingPractice.id
            ? { ...artifact, title: '练习检验未完成', summary: message, status: 'error' }
            : artifact) }
          : item))
        setNotice('知识图解已恢复，关联练习可以再试一次。')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '知识图解生成失败'
      setTurns(current => current.map(item => item.id === turnId
        ? { ...item, artifacts: item.artifacts.map(artifact => artifact.id === failedArtifact.id
          ? { ...artifact, title: '知识图解未完成', summary: message, status: 'error' }
          : artifact) }
        : item))
      setNotice(message)
    }
  }

  async function retryLearningLoopPractice(turnId: string, failedArtifact: Artifact) {
    if (!sessionId || !failedArtifact.learningLoopId) return
    const turn = turns.find(item => item.id === turnId)
    const mapArtifact = turn?.artifacts.find(item => (
      item.learningLoopId === failedArtifact.learningLoopId && item.learningLoopStep === 'map'
    ))
    if (!turn || !mapArtifact?.backendId || mapArtifact.status === 'generating' || mapArtifact.status === 'error') {
      setNotice('需要先完成关联的知识图解，才能重新接上这份练习。')
      return
    }
    setTurns(current => current.map(item => item.id === turnId
      ? { ...item, artifacts: item.artifacts.map(artifact => artifact.id === failedArtifact.id
        ? { ...artifact, title: '正在重新生成练习', summary: '将继续关联当前知识图解，提交后可把错题回写到节点。', status: 'generating' }
        : artifact) }
      : item))
    try {
      const queued = await generatePracticeSet(LOCAL_USER_ID, sessionId, turn.id, [], mapArtifact.backendId)
      const result = await waitForGenerationJob(LOCAL_USER_ID, queued.job)
      const generated = {
        ...artifactFromRecord(result.artifact),
        learningLoopId: failedArtifact.learningLoopId,
        learningLoopStep: 'practice' as const,
      }
      setTurns(current => current.map(item => item.id === turnId
        ? { ...item, artifacts: item.artifacts.map(artifact => artifact.id === failedArtifact.id ? generated : artifact) }
        : item))
      setNotice('练习已重新接入知识图解，完成后会回写错题关联。')
    } catch (error) {
      const message = error instanceof Error ? error.message : '练习生成失败'
      setTurns(current => current.map(item => item.id === turnId
        ? { ...item, artifacts: item.artifacts.map(artifact => artifact.id === failedArtifact.id
          ? { ...artifact, title: '练习检验未完成', summary: message, status: 'error' }
          : artifact) }
        : item))
      setNotice(message)
    }
  }

  function renderLearningLoop(turn: ChatTurn) {
    const latestLoopId = [...turn.artifacts].reverse().find(artifact => artifact.learningLoopId)?.learningLoopId
    if (!latestLoopId) return null
    const artifacts = learningLoopSteps.map(step => turn.artifacts.find(artifact => (
      artifact.learningLoopId === latestLoopId && artifact.learningLoopStep === step.kind
    )))
    const readyCount = artifacts.filter(artifact => artifact && artifact.status !== 'generating' && artifact.status !== 'error').length
    const activeStep = learningLoopActiveStepByTurn[turn.id]
    const nextArtifact = artifacts.find(artifact => artifact && artifact.status !== 'generating' && artifact.status !== 'error')
    const nextStep = learningLoopSteps.find(step => step.kind === nextArtifact?.learningLoopStep)
    const canSaveLoop = readyCount === learningLoopSteps.length
    const unsavedCount = artifacts.filter(artifact => artifact && !artifact.saved).length
    const loopPersisted = artifacts.every(artifact => artifact?.saved && artifact.learningLoopId)

    return (
      <section className="learning-loop" aria-label={t('四步学习闭环', 'Four-step learning loop')}>
        <header className="learning-loop-head">
          <div><b>{t('一套可继续学习的资料', 'One connected learning set')}</b><p>{t('按顺序完成四步，练习结果会回写到关联图解。', 'Move through the four steps. Practice results return to the linked map.')}</p></div>
          <span>{t(`${readyCount}/4 已就绪`, `${readyCount}/4 ready`)}</span>
        </header>
        <div className="learning-loop-steps">
          {learningLoopSteps.map((step, index) => {
            const artifact = artifacts[index]
            const isReady = Boolean(artifact && artifact.status !== 'generating' && artifact.status !== 'error')
            const status = artifact?.status === 'error'
              ? t('未完成', 'Unavailable')
              : artifact?.status === 'generating'
                ? t('生成中', 'Building')
                : isReady ? t('可开始', 'Ready') : t('等待中', 'Waiting')
            return (
              <button
                className={`${activeStep === step.kind ? 'active ' : ''}${artifact?.status === 'error' ? 'failed' : ''}`}
                type="button"
                key={step.kind}
                disabled={!isReady}
                onClick={() => openLearningLoopStep(turn.id, step.kind, artifact)}
              >
                <i>{index + 1}</i>
                <span><b>{t(step.label, step.labelEn)}</b><small>{t(step.detail, step.detailEn)}</small></span>
                <em>{status}</em>
              </button>
            )
          })}
        </div>
        <footer className="learning-loop-foot">
          <p>{t('完成练习后，系统会标记图解中的薄弱节点；把四份资料保存到同一主题后，资料库会继续推荐下一步。', 'After practice, weak map nodes are marked. Save the four materials to one topic and the library will recommend the next step.')}</p>
          <div className="learning-loop-foot-actions">
            <button className="learning-loop-save" type="button" disabled={!canSaveLoop} onClick={() => {
              if (!loopPersisted) {
                openLearningLoopSave(turn)
                return
              }
              const first = artifacts.find((artifact): artifact is Artifact => Boolean(artifact))
              if (first) {
                setLibraryTopic({ course: first.course, topic: first.topic })
                setView('library')
              }
            }}>
              <Save size={14} />{loopPersisted ? t('在资料库中查看', 'View in library') : unsavedCount > 0 ? t(`保存整套资料 (${unsavedCount})`, `Save full set (${unsavedCount})`) : t('整理为学习闭环', 'Organize as a learning loop')}
            </button>
            <button className="learning-loop-start" type="button" disabled={!nextArtifact || !nextStep} onClick={() => openLearningLoopStep(turn.id, nextStep!.kind, nextArtifact)}>
              <Sparkles size={15} />{nextStep ? t(`从${nextStep.label}开始`, `Start with ${nextStep.labelEn}`) : t('正在准备', 'Preparing')}
            </button>
          </div>
        </footer>
      </section>
    )
  }

  function renderDocumentPack(turn: ChatTurn) {
    const packIds = [...new Set(turn.artifacts.map(artifact => artifact.documentPackId).filter((packId): packId is string => Boolean(packId)))].reverse()
    if (packIds.length === 0) return null
    const planning = documentPackPlanningByTurn[turn.id]
    return (
      <>
        {packIds.map(packId => {
          const artifacts = turn.artifacts.filter(artifact => artifact.documentPackId === packId)
          const readyArtifacts = artifacts.filter(artifact => artifact.status !== 'generating' && artifact.status !== 'error')
          const complete = readyArtifacts.length === artifacts.length && artifacts.length > 0
          const persisted = complete && artifacts.every(artifact => artifact.saved)
          const isPlanning = planning?.packId === packId
          return (
            <section className={`document-pack-status${isPlanning ? ' planning' : ''}`} key={packId} aria-label={t('学习资料包', 'Study pack')}>
              <div>
                <span><Icon name="archive" size={15} />{t('学习资料包', 'Study pack')}</span>
                <b>{isPlanning
                  ? t('正在制定学习路线', 'Preparing the study route')
                  : t(`${readyArtifacts.length}/${artifacts.length} 份文档已就绪`, `${readyArtifacts.length}/${artifacts.length} documents ready`)}</b>
                <small>{isPlanning
                  ? t('正在确定各章节分工、共同例题与重点，随后会开始并行生成。', 'Assigning each chapter, a shared example, and key points before parallel generation.')
                  : t('打开资料册连续阅读整套内容；统一保存后会归到同一课程和主题。', 'Open the booklet to read the full set continuously, then save it under one course and topic.')}</small>
              </div>
              <div className="document-pack-status-actions">
                <button type="button" onClick={() => openDocumentPackBooklet({
                  packId,
                  turnId: turn.id,
                  artifacts,
                  persisted,
                })} disabled={isPlanning}>
                  <Icon name="book" size={14} />{t('打开资料册', 'Open booklet')}
                </button>
                <button type="button" disabled={!complete || isPlanning} onClick={() => {
                  if (!persisted) {
                    openDocumentPackSave(turn, packId)
                    return
                  }
                  const first = artifacts[0]
                  if (first) {
                    setLibraryTopic({ course: first.course, topic: first.topic })
                    setView('library')
                  }
                }}>
                  <Icon name={persisted ? 'library' : 'save'} size={14} />{persisted ? t('资料库', 'Library') : t('保存整包', 'Save pack')}
                </button>
              </div>
            </section>
          )
        })}
      </>
    )
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
      exploration: previous?.exploration,
    }
    const savingKey = `${artifact.id}:${nodeId}`
    setMapProgressByArtifactId(current => ({ ...current, [artifact.id]: optimistic }))
    setMapProgressSavingKey(savingKey)
    try {
      const updated = await updateKnowledgeMapNodeProgress(artifact.backendId, LOCAL_USER_ID, nodeId, status)
      setMapProgressByArtifactId(current => ({ ...current, [artifact.id]: updated }))
      if (libraryTopic?.course === artifact.course && libraryTopic?.topic === artifact.topic) {
        void refreshLibraryTopicState()
      }
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

  function replaceArtifactFromRecord(record: LearningArtifactRecord, previousBackendId = record.id) {
    const replacement = artifactFromRecord(record)
    const replace = (artifact: Artifact) => artifact.backendId === previousBackendId ? replacement : artifact
    setTurns(current => current.map(turn => ({ ...turn, artifacts: turn.artifacts.map(replace) })))
    setLibraryItems(current => current.map(replace))
    setTrashedItems(current => current.map(replace))
    setVersionItems(current => {
      if (previousBackendId === record.id) return current.map(replace)
      if (current.some(item => item.backendId === record.id)) return current
      return [replacement, ...current]
    })
    setVersionPreview(current => current?.backendId === previousBackendId ? replacement : current)
    setLibraryPreviewId(current => current === `artifact-${previousBackendId}` ? replacement.id : current)
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

  async function persistEditedInteractivePresentation(artifact: Artifact, presentation: DynamicExplanationData) {
    if (!artifact.backendId) {
      throw new Error('这份互动演示还没有可保存的资料记录，请稍后再试。')
    }
    setPresentationEditingArtifactId(artifact.id)
    try {
      const result = await updateInteractivePresentation(artifact.backendId, LOCAL_USER_ID, presentation)
      replaceArtifactFromRecord(result.artifact, artifact.backendId)
      setNotice(result.saved_as_version
        ? `互动演示已保存为新版 v${result.artifact.version}`
        : '互动演示编辑已保存')
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存互动演示编辑失败'
      setNotice(message)
      throw error
    } finally {
      setPresentationEditingArtifactId(current => current === artifact.id ? null : current)
    }
  }

  async function remakeInteractivePresentationScene(
    artifact: Artifact,
    presentation: DynamicExplanationData,
    scene: DynamicExplanationScene,
  ) {
    if (!artifact.backendId) {
      throw new Error('这份互动演示还没有可编辑的资料记录，请稍后再试。')
    }
    const result = await regenerateInteractivePresentationScene(
      artifact.backendId,
      LOCAL_USER_ID,
      presentation,
      scene.id,
    )
    return result.scene
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
        'special',
      )
      const data = await waitForGenerationJob(LOCAL_USER_ID, queued.job)
      const practiceArtifact = artifactFromRecord(data.artifact)
      if (sourceTurnExists) {
        setTurns(current => current.map(turn => turn.id === artifact.qaId
          ? { ...turn, artifacts: turn.artifacts.map(item => item.id === loadingId ? practiceArtifact : item) }
          : turn))
      }
      setPracticeRun(createPracticeRun(practiceArtifact, data.practice))
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
      const queued = await generatePracticeSet(LOCAL_USER_ID, source.sessionId, source.qaId, focusPoints, undefined, 'special')
      const data = await waitForGenerationJob(LOCAL_USER_ID, queued.job)
      const artifact = artifactFromRecord(data.artifact)
      setTurns(current => current.map(turn => turn.id === source.qaId
        ? { ...turn, artifacts: [...turn.artifacts, artifact] }
        : turn))
      setPracticeRun(createPracticeRun(artifact, data.practice))
      setNotice(`已围绕“${focusPoints.join('、')}”生成 ${data.practice.question_count} 项专项训练。`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '专项练习生成失败')
    } finally {
      practiceGenerationLocked.current = false
      setPracticeGenerating(false)
      setTopicPracticeGeneratingKey(null)
    }
  }

  function topicNextStepLabel(action: LibraryTopicLearningState['next_step']['action']) {
    const labels: Record<LibraryTopicLearningState['next_step']['action'], [string, string]> = {
      open_material: ['继续阅读', 'Continue reading'],
      continue_map: ['继续图解', 'Continue map'],
      continue_explanation: ['继续动态讲解', 'Continue explanation'],
      review_map: ['复习薄弱节点', 'Review weak nodes'],
      start_practice: ['开始练习', 'Start practice'],
      practice_weak_points: ['针对薄弱点再练', 'Practice weak points'],
      review_material: ['回看重点', 'Review key points'],
      complete: ['开始学习', 'Start learning'],
    }
    const [chinese, english] = labels[action]
    return t(chinese, english)
  }

  async function continueTopicLearning() {
    const nextStep = libraryTopicState?.next_step
    if (!nextStep || nextStep.action === 'complete' || !libraryTopic) {
      setNotice(t('这个主题还没有可继续的资料。', 'There is no material to continue in this topic yet.'))
      return
    }
    const artifact = libraryTopicItems.find(item => item.backendId === nextStep.artifact_id)
    if (!artifact) {
      setNotice(t('推荐资料暂时不可用，请刷新资料库后再试。', 'The recommended material is unavailable. Please refresh the library.'))
      return
    }
    if (nextStep.action === 'practice_weak_points') {
      await startTopicWeakPractice(libraryTopic.course, libraryTopic.topic, libraryTopicItems)
      return
    }
    if (nextStep.action === 'start_practice') {
      await openPractice(artifact)
      return
    }
    openLibraryArtifact(artifact)
  }

  function toggleBackgroundTasks() {
    setSettingsOpen(false)
    setSettingsView('menu')
    setBackgroundTasksOpen(current => !current)
  }

  function openBackgroundTask(artifact: Artifact) {
    const returnView = view === 'map-workspace' ? mapWorkspaceReturnView : view
    setSidebarOpen(false)
    openMapWorkspace(artifact, returnView)
  }

  function openBackgroundDynamicTask(artifact: Artifact) {
    setBackgroundTasksOpen(false)
    setSidebarOpen(false)
    setView('chat')
    if (artifact.status !== 'generating' && artifact.status !== 'error') {
      setExpandedArtifactId(artifact.id)
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        setImmersiveOpenRequest({ artifactId: artifact.id, revision: Date.now() })
      }))
      return
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById(`artifact-${artifact.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }))
  }

  function backgroundGenerationTaskLabel(kind: BackgroundGenerationKind) {
    const labels: Record<BackgroundGenerationKind, [string, string]> = {
      notes: ['学习文档', 'Learning document'],
      practice: ['练习测验', 'Practice set'],
      map: ['知识图解', 'Knowledge map'],
      video: ['课程视频', 'Course videos'],
    }
    return t(...labels[kind])
  }

  function backgroundGenerationTaskAction(kind: BackgroundGenerationKind) {
    const labels: Record<BackgroundGenerationKind, [string, string]> = {
      notes: ['打开文档', 'Open document'],
      practice: ['开始做题', 'Start practice'],
      map: ['打开图解', 'Open map'],
      video: ['查看视频', 'View videos'],
    }
    return t(...labels[kind])
  }

  function openBackgroundGenerationTask(task: StoredBackgroundGenerationTask) {
    setBackgroundTasksOpen(false)
    setSidebarOpen(false)
    setView('chat')
    if (task.kind === 'video') {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        document.getElementById(`course-videos-${task.turnId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }))
      return
    }
    const turn = turns.find(item => item.id === task.turnId)
    const artifactId = task.resultArtifactId || task.loadingId
    const artifact = turn?.artifacts.find(item => item.id === artifactId || item.id === task.loadingId)
    if (!artifact) {
      setNotice(task.status === 'completed'
        ? '结果正在恢复到当前对话，请稍等一秒后再打开。'
        : '任务仍在后台准备中，可稍后从后台任务继续查看。')
      return
    }
    if (task.kind === 'map' && artifact.status !== 'error') {
      openMapWorkspace(artifact, 'chat')
      return
    }
    if (artifact.status === 'generating' || artifact.status === 'error') {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        document.getElementById(`artifact-${artifact.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }))
      return
    }
    if (task.kind === 'practice') {
      void openPractice(artifact)
      return
    }
    setExpandedArtifactId(artifact.id)
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById(`artifact-${artifact.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }))
  }

  function retryBackgroundGenerationTask(task: StoredBackgroundGenerationTask) {
    if (task.retryable === false) {
      setNotice('这条任务的来源内容已不可用，请返回原对话重新发起生成。')
      return
    }
    if (task.kind === 'notes') {
      if (!task.documentTemplate) {
        setNotice('缺少学习文档模板，请回到原对话重新选择生成方式。')
        return
      }
      void runDocumentGeneration({ turnId: task.turnId, template: task.documentTemplate }, task.loadingId)
      return
    }
    if (task.kind === 'practice') {
      void runPracticeGeneration(
        task.turnId,
        task.sourceMapArtifactId,
        task.practiceMode || 'standard',
        task.focusPoints || [],
        task.loadingId,
      )
      return
    }
    if (task.kind === 'map') {
      void runKnowledgeMapGeneration(task.turnId, task.loadingId)
      return
    }
    if (!task.videoContext) {
      setNotice('缺少视频检索条件，请回到原对话重新发起检索。')
      return
    }
    const retryTask: StoredBackgroundGenerationTask = {
      ...task,
      status: undefined,
      error: undefined,
      errorCode: undefined,
      retryable: undefined,
      createdAt: Date.now(),
      progress: {
        label: '正在重新检索课程视频',
        message: '已转入后台检索，你可以继续使用其他功能。',
      },
      videoResults: undefined,
      videoResultCount: undefined,
      videoSearchUrl: undefined,
    }
    persistBackgroundGenerationTask(retryTask)
    setInlineVideoSearches(current => ({
      ...current,
      [task.turnId]: {
        context: task.videoContext!,
        results: [],
        searchUrl: '',
        loading: true,
        error: '',
        taskId: task.loadingId,
      },
    }))
    void runVideoSearch(task.turnId, task.videoContext, retryTask)
  }

  function dismissBackgroundDynamicTask(artifact: Artifact) {
    if (artifact.status === 'generating') return
    removeStoredDynamicExplanationJob(artifact.id)
    setDismissedDynamicTaskIds(current => new Set([...current, artifact.id]))
    if (recentDynamicExplanationArtifactId === artifact.id) setRecentDynamicExplanationArtifactId(null)
  }

  function dismissBackgroundTask(artifact: Artifact) {
    const task = mapPackJobs[artifact.id]
    if (!task || task.status === 'queued' || task.status === 'running') return
    if (artifact.backendId) writeStoredMapPackJob(artifact.backendId)
    setMapPackJobs(current => {
      const next = { ...current }
      delete next[artifact.id]
      return next
    })
  }

  function updateMapExploration(
    artifact: Artifact,
    state: { active_node_id: string; explored_node_ids: string[] },
  ) {
    if (!artifact.backendId) return
    const mapData = parseKnowledgeMap(artifact.content)
    if (!mapData) return
    const previous = mapProgressByArtifactId[artifact.id]
    const validIds = new Set(mapData.nodes.filter(node => node.role !== 'core').map(node => node.id))
    const exploredIds = [...new Set(state.explored_node_ids.filter(nodeId => validIds.has(nodeId)))].slice(0, 24)
    const activeNodeId = validIds.has(state.active_node_id) ? state.active_node_id : ''
    const generatedIds = [...validIds].filter(nodeId => Boolean(mapData.deep_maps?.[nodeId]))
    const optimistic: KnowledgeMapProgressState = {
      progress: previous?.progress || {},
      summary: previous?.summary || summarizeMapProgress(mapData, previous?.progress || {}),
      exploration: {
        active_node_id: activeNodeId,
        explored_node_ids: exploredIds,
        generated_deep_dive_ids: generatedIds,
        total_deep_dives: validIds.size,
        updated_at: new Date().toISOString(),
      },
    }
    const token = (mapExplorationSaveTokens.current[artifact.id] || 0) + 1
    mapExplorationSaveTokens.current[artifact.id] = token
    setMapProgressByArtifactId(current => ({ ...current, [artifact.id]: optimistic }))
    void updateKnowledgeMapWorkspaceProgress(artifact.backendId, LOCAL_USER_ID, {
      active_node_id: activeNodeId,
      explored_node_ids: exploredIds,
    })
      .then(saved => {
        if (mapExplorationSaveTokens.current[artifact.id] !== token) return
        setMapProgressByArtifactId(current => ({ ...current, [artifact.id]: saved }))
      })
      .catch(error => {
        if (mapExplorationSaveTokens.current[artifact.id] !== token) return
        setMapProgressByArtifactId(current => {
          const next = { ...current }
          if (previous) next[artifact.id] = previous
          else delete next[artifact.id]
          return next
        })
        setNotice(error instanceof Error ? error.message : t('浏览位置暂时没有同步，图解内容仍然保留。', 'Your position was not synced, but the map content is still safe.'))
      })
  }

  function mapPackProgressFromJob(
    artifact: Artifact,
    job: GenerationJob<KnowledgeMapPackResult>,
  ): KnowledgeMapPackJobState {
    const mapData = parseKnowledgeMap(artifact.content)
    const fallbackTotal = mapData?.nodes.filter(node => node.role !== 'core').length || 0
    const fallbackReady = mapData
      ? mapData.nodes.filter(node => node.role !== 'core' && Boolean(mapData.deep_maps?.[node.id])).length
      : 0
    const raw = (job.progress || {}) as Partial<KnowledgeMapPackProgress>
    const number = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback
    return {
      jobId: job.job_id,
      status: job.status,
      total: number(raw.total, fallbackTotal),
      ready: number(raw.ready, fallbackReady),
      completed: number(raw.completed, 0),
      failed: number(raw.failed, 0),
      pending: number(raw.pending, Math.max(0, fallbackTotal - fallbackReady)),
      current_labels: Array.isArray(raw.current_labels)
        ? raw.current_labels.filter((label): label is string => typeof label === 'string').slice(0, 2)
        : [],
      error: job.error,
    }
  }

  async function monitorMapPackJob(artifact: Artifact, initialJob: GenerationJob<KnowledgeMapPackResult>) {
    if (!artifact.backendId || mapPackMonitors.current.has(artifact.backendId)) return
    mapPackMonitors.current.add(artifact.backendId)
    let current = initialJob
    const deadline = Date.now() + 20 * 60 * 1000
    try {
      while (current.status === 'queued' || current.status === 'running') {
        setMapPackJobs(state => ({ ...state, [artifact.id]: mapPackProgressFromJob(artifact, current) }))
        writeStoredMapPackJob(artifact.backendId, current.job_id)
        if (Date.now() > deadline) throw new Error(t('后台任务仍在运行，可以稍后从资料库继续查看。', 'The background task is still running. Check it later from the library.'))
        await new Promise<void>(resolve => window.setTimeout(resolve, 900))
        current = await getGenerationJob<KnowledgeMapPackResult>(LOCAL_USER_ID, current.job_id)
      }

      if (current.status === 'failed' || !current.result) {
        writeStoredMapPackJob(artifact.backendId)
        setMapPackJobs(state => ({
          ...state,
          [artifact.id]: {
            ...mapPackProgressFromJob(artifact, current),
            status: 'failed',
            error: current.error || t('整套图解没有生成完成，请重试剩余部分。', 'The map package did not finish. Retry the remaining maps.'),
          },
        }))
        return
      }

      const result = current.result
      replaceArtifactFromRecord(result.artifact, artifact.backendId)
      writeStoredMapPackJob(artifact.backendId)
      const failedCount = result.failed_nodes.length
      setMapPackJobs(state => ({
        ...state,
        [artifact.id]: {
          ...mapPackProgressFromJob(artifact, current),
          status: 'completed',
          total: result.total,
          ready: result.ready,
          failed: failedCount,
          pending: 0,
          error: failedCount
            ? t(`${failedCount} 张专题图暂时没有完成，可以重试剩余部分。`, `${failedCount} deep maps did not finish. Retry the remaining maps.`)
            : undefined,
        },
      }))
      setNotice(failedCount
        ? t(`整套图解已补全 ${result.ready}/${result.total}，剩余 ${failedCount} 张可以重试。`, `Completed ${result.ready}/${result.total}; ${failedCount} can be retried.`)
        : t('整套知识图解已在后台补全并自动保存。', 'The complete knowledge map package is ready and saved.'))
    } catch (error) {
      setMapPackJobs(state => ({
        ...state,
        [artifact.id]: {
          ...mapPackProgressFromJob(artifact, current),
          status: 'failed',
          error: error instanceof Error ? error.message : t('暂时无法读取后台任务，可以稍后重试。', 'The background task is temporarily unavailable. Retry later.'),
        },
      }))
    } finally {
      mapPackMonitors.current.delete(artifact.backendId)
    }
  }
  mapPackMonitorRef.current = monitorMapPackJob

  async function startMapPackGeneration(artifact: Artifact) {
    if (!artifact.backendId || mapPackMonitors.current.has(artifact.backendId)) return
    try {
      const queued = await generateKnowledgeMapPack(artifact.backendId, LOCAL_USER_ID)
      writeStoredMapPackJob(artifact.backendId, queued.job.job_id)
      setMapPackJobs(state => ({ ...state, [artifact.id]: mapPackProgressFromJob(artifact, queued.job) }))
      void monitorMapPackJob(artifact, queued.job)
      setNotice(t('整套图解已转入后台补全，你可以离开当前页面。', 'The map package is being completed in the background. You can leave this page.'))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t('整套知识图解任务启动失败。', 'Could not start the map package task.'))
    }
  }

  async function requestKnowledgeMapDeepDive(artifact: Artifact, nodeId: string, force = false) {
    if (!artifact.backendId) throw new Error(t('这份图解尚未完成保存，暂时无法生成专题深读。', 'This map is not ready for a deep dive yet.'))
    const result = await generateKnowledgeMapDeepDive(artifact.backendId, LOCAL_USER_ID, nodeId, force)
    if ('artifact' in result && result.artifact) replaceArtifactFromRecord(result.artifact, artifact.backendId)
    return result.deep_dive
  }

  async function startTopicReviewPlan() {
    if (!libraryTopic || topicStudyPlanLoading || topicStudyPlanBusyTaskId) return
    setTopicStudyPlanLoading(true)
    try {
      const data = await startTopicStudyPlan(LOCAL_USER_ID, libraryTopic.course, libraryTopic.topic)
      setTopicStudyPlan(data.plan)
      setNotice(t('已为这次复习整理好清单。从第一项开始即可，进度会保留到下次。', 'Your review list is ready. Start with the first item; progress will be kept for next time.'))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t('暂时无法开始本次复习。', 'Unable to start this review right now.'))
    } finally {
      setTopicStudyPlanLoading(false)
    }
  }

  async function updateTopicPlanTask(task: TopicStudyPlanTask, status: 'pending' | 'completed') {
    if (!libraryTopic || !topicStudyPlan?.id || topicStudyPlanBusyTaskId) return
    setTopicStudyPlanBusyTaskId(task.id)
    try {
      const data = await updateTopicStudyPlanTask(
        topicStudyPlan.id,
        LOCAL_USER_ID,
        libraryTopic.course,
        libraryTopic.topic,
        task.id,
        status,
      )
      setTopicStudyPlan(data.plan)
      if (data.plan.status === 'completed') {
        setNotice(t('本次复习已完成。下次回来时，可以重新生成一份新的复习清单。', 'This review is complete. When you return, you can generate a fresh list.'))
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t('更新任务状态失败，请稍后重试。', 'Could not update this task. Please try again.'))
    } finally {
      setTopicStudyPlanBusyTaskId(null)
    }
  }

  async function openTopicPlanTask(task: TopicStudyPlanTask) {
    if (!libraryTopic) return
    if (task.action === 'practice_weak_points') {
      await startTopicWeakPractice(libraryTopic.course, libraryTopic.topic, libraryTopicItems)
      return
    }
    const artifact = libraryTopicItems.find(item => item.backendId === task.artifact_id)
    if (!artifact) {
      setNotice(t('这份资料暂时不可用，请刷新资料库后重试。', 'This material is unavailable. Refresh the library and try again.'))
      return
    }
    if (task.action === 'start_practice') {
      await openPractice(artifact)
      return
    }
    openLibraryArtifact(artifact)
  }

  async function openPractice(artifact: Artifact, returnBooklet: PracticePackBookletTarget | null = null) {
    if (!artifact.backendId || practiceLoadingArtifactId) return
    setPracticeReturnBooklet(returnBooklet)
    setPracticeLoadingArtifactId(artifact.id)
    setPracticeIndexCollapsed(false)
    recordSavedArtifactActivity(artifact, 'opened', { surface: 'practice' })
    try {
      const data = await getPracticeForArtifact(artifact.backendId, LOCAL_USER_ID)
      setPracticeRun(createPracticeRun(artifact, data.practice, data.attempts, artifact.topicMastery || null))
      setPracticeAttemptCounts(current => ({ ...current, [artifact.id]: data.attempts.length }))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '获取练习集失败')
      if (returnBooklet) setPracticePackBooklet(returnBooklet)
      setPracticeReturnBooklet(null)
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
    setPracticeIndexCollapsed(false)
    setPracticeRun(current => current ? {
      ...current,
      answers: {},
      codeDrafts: Object.fromEntries(current.practice.questions
        .filter(question => question.type === 'code_task')
        .map(question => [question.id, question.starter_code || ''])),
      codeTestChecks: {},
      oralRecordingQuestionId: null,
      activeIndex: 0,
      result: null,
      topicMastery: current.artifact.topicMastery || null,
      remainingSeconds: current.practice.practice_mode === 'mock' ? current.practice.estimated_minutes * 60 : undefined,
    } : current)
  }

  function renderPracticePack(turn: ChatTurn) {
    const packIds = [...new Set(turn.artifacts.map(artifact => artifact.practicePackId).filter((packId): packId is string => Boolean(packId)))].reverse()
    if (packIds.length === 0) return null
    return (
      <>
        {packIds.map(packId => {
          const artifacts = turn.artifacts.filter(artifact => artifact.practicePackId === packId)
          const readyArtifacts = artifacts.filter(artifact => artifact.status !== 'generating' && artifact.status !== 'error')
          const complete = artifacts.length === practiceSetupModes.length && readyArtifacts.length === practiceSetupModes.length
          const persisted = complete && artifacts.every(artifact => artifact.saved)
          return (
            <section className={`practice-pack-status${complete ? ' complete' : ''}`} key={packId} aria-label={t('练习资源包', 'Practice pack')}>
              <div>
                <span><Icon name="archive" size={15} />{t('练习资源包', 'Practice pack')}</span>
                <b>{t(`${readyArtifacts.length}/${practiceSetupModes.length} 种训练已就绪`, `${readyArtifacts.length}/${practiceSetupModes.length} training sets ready`)}</b>
                <small>{complete
                  ? t('六种训练已整理为一份连续的练习资源册：完成一组后，带着解析和薄弱点进入下一组。', 'Six training modes are arranged as one continuous booklet: use the review and weak points to move into the next set.')
                  : t('正在分批准备同类题、变式题、专项训练、模拟试卷、编程实验和口述测验。', 'Preparing similar questions, variants, targeted practice, mock exam, coding lab, and oral check in batches.')}</small>
              </div>
              <div className="practice-pack-status-actions">
                <button type="button" disabled={readyArtifacts.length === 0} onClick={() => openPracticePackBooklet({ packId, turnId: turn.id, artifacts, persisted })}><Icon name="book" size={14} />{t('打开练习资源册', 'Open practice pack')}</button>
                <button type="button" disabled={!complete} onClick={() => {
                  if (!persisted) {
                    openPracticePackSave(turn, packId)
                    return
                  }
                  const first = artifacts[0]
                  if (first) {
                    setLibraryTopic({ course: first.course, topic: first.topic })
                    setView('library')
                  }
                }}><Icon name={persisted ? 'library' : 'save'} size={14} />{persisted ? t('资料库', 'Library') : t('保存整包', 'Save pack')}</button>
              </div>
            </section>
          )
        })}
      </>
    )
  }

  async function runPracticePackGeneration(turnId: string) {
    if (!sessionId || practiceGenerating || practiceGenerationLocked.current) return
    const turn = turns.find(item => item.id === turnId)
    if (!turn || turn.id.startsWith('pending-')) {
      setNotice('这条回答还没有保存完成，请稍后重试。')
      return
    }
    const packId = `practice-pack-${Date.now()}`
    const course = learningState.subject || '未分类课程'
    const topic = learningState.current_topic || '本次学习'
    const placeholders = practiceSetupModes.map(mode => {
      const profile = practiceProfiles[mode]
      return {
        id: `${packId}-${mode}`,
        kind: 'practice' as const,
        title: `正在生成${profile.label}…`,
        summary: `正在围绕当前回答编写 ${profile.count} 道${profile.label}内容。`,
        details: [profile.description, '生成完成后会进入同一份练习资源册', '整包只需确认一次归档位置'],
        source: turn.prompt,
        sessionId,
        qaId: turn.id,
        course,
        topic,
        topicMastery: 0,
        recommendedCourse: course,
        recommendedTopic: topic,
        classificationSource: 'learning_state' as const,
        classificationConfidence: 0.9,
        classificationOverridden: false,
        saved: false,
        favorite: false,
        versionGroupId: 0,
        version: 1,
        status: 'generating' as const,
        purpose: 'review' as const,
        depth: 'standard' as const,
        style: 'exam' as const,
        practicePackId: packId,
        practicePackMode: mode,
      }
    })
    const replacePlaceholder = (placeholderId: string, next: Artifact) => {
      setTurns(current => current.map(item => item.id === turn.id
        ? { ...item, artifacts: item.artifacts.map(artifact => artifact.id === placeholderId ? next : artifact) }
        : item))
    }

    practiceGenerationLocked.current = true
    setPracticeGenerating(true)
    setPracticeSetupTurnId(null)
    setNotice('正在并行准备六种训练，并把它们整理成一份练习资源册…')
    setTurns(current => current.map(item => item.id === turn.id
      ? { ...item, artifacts: [...item.artifacts, ...placeholders] }
      : item))
    try {
      const results = await Promise.all(practiceSetupModes.map(async (mode, index) => {
        const placeholder = placeholders[index]
        try {
          const queued = await generatePracticeSet(LOCAL_USER_ID, sessionId, turn.id, [], undefined, mode, packId)
          const data = await waitForGenerationJob(LOCAL_USER_ID, queued.job)
          const generated: Artifact = {
            ...artifactFromRecord(data.artifact),
            practicePackId: packId,
            practicePackMode: mode,
          }
          replacePlaceholder(placeholder.id, generated)
          return generated
        } catch (error) {
          const message = error instanceof Error ? error.message : '训练生成失败'
          replacePlaceholder(placeholder.id, {
            ...placeholder,
            title: `${practiceProfiles[mode].label}未完成`,
            summary: message,
            details: ['其他已经完成的训练仍可直接开始', '稍后可以针对这一种训练单独重新生成'],
            status: 'error',
          })
          return null
        }
      }))
      const completed = results.filter((artifact): artifact is Artifact => Boolean(artifact)).length
      setNotice(completed === practiceSetupModes.length
        ? '六种训练已就绪。打开练习资源册后，可按建议顺序完成并统一保存。'
        : `${completed}/${practiceSetupModes.length} 种训练已就绪；其余训练可稍后单独重试。`)
    } finally {
      practiceGenerationLocked.current = false
      setPracticeGenerating(false)
    }
  }

  async function retryPracticePackEntry(packId: string, artifactId: string) {
    if (!sessionId || practiceGenerating || practiceGenerationLocked.current) return
    const turn = turns.find(item => item.artifacts.some(artifact => artifact.id === artifactId && artifact.practicePackId === packId))
    const failedArtifact = turn?.artifacts.find(artifact => artifact.id === artifactId && artifact.practicePackId === packId)
    if (!turn || !failedArtifact || failedArtifact.status !== 'error' || !failedArtifact.practicePackMode) return

    const mode = failedArtifact.practicePackMode
    const profile = practiceProfiles[mode]
    const loadingArtifact: Artifact = {
      ...failedArtifact,
      title: `正在生成${profile.label}…`,
      summary: `正在围绕当前回答编写 ${profile.count} 项${profile.label}内容。`,
      details: [profile.description, '完成后会自动补回练习资源册', '不会影响已经完成的其他训练'],
      status: 'generating',
    }
    const replaceEntry = (next: Artifact) => {
      setTurns(current => current.map(item => item.id === turn.id
        ? { ...item, artifacts: item.artifacts.map(artifact => artifact.id === artifactId ? next : artifact) }
        : item))
    }

    practiceGenerationLocked.current = true
    setPracticeGenerating(true)
    replaceEntry(loadingArtifact)
    setNotice(`正在重试${profile.label}，已经完成的训练会保留。`)
    try {
      const queued = await generatePracticeSet(LOCAL_USER_ID, sessionId, turn.id, [], undefined, mode, packId)
      const data = await waitForGenerationJob(LOCAL_USER_ID, queued.job)
      replaceEntry({
        ...artifactFromRecord(data.artifact),
        practicePackId: packId,
        practicePackMode: mode,
      })
      setNotice(`${profile.label}已补齐，可以继续完成整套练习资源包。`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '训练生成失败'
      replaceEntry({
        ...failedArtifact,
        summary: message,
        details: ['这次重试没有完成', '请稍后只重试这一组，其他训练会保留'],
        status: 'error',
      })
      setNotice(`${profile.label}暂未完成，可稍后再次重试。`)
    } finally {
      practiceGenerationLocked.current = false
      setPracticeGenerating(false)
    }
  }

  function updatePracticeCode(questionId: string, code: string) {
    setPracticeRun(current => current ? {
      ...current,
      codeDrafts: { ...current.codeDrafts, [questionId]: code },
    } : current)
  }

  function togglePracticeTest(questionId: string, label: string) {
    setPracticeRun(current => {
      if (!current) return current
      const completed = current.codeTestChecks[questionId] || []
      const next = completed.includes(label)
        ? completed.filter(item => item !== label)
        : [...completed, label]
      return { ...current, codeTestChecks: { ...current.codeTestChecks, [questionId]: next } }
    })
  }

  function confirmCodingTask(questionId: string, testCount: number) {
    const code = practiceRun?.codeDrafts[questionId]?.trim()
    const checked = practiceRun?.codeTestChecks[questionId] || []
    if (!code) {
      setNotice('请先写下你的代码草稿。')
      return
    }
    if (checked.length < testCount) {
      setNotice('请先在本地或课程环境中运行，并确认全部测试用例。')
      return
    }
    answerPracticeQuestion(questionId, '完成')
    setNotice('已记录本地测试通过确认。网页不会代替你执行代码。')
  }

  async function toggleOralRecording(questionId: string) {
    const isRecording = practiceRun?.oralRecordingQuestionId === questionId
    if (isRecording) {
      oralMediaRecorderRef.current?.stop()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setNotice('当前浏览器不支持录音，请直接在文字框中输入你的口述回答。')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      oralMediaStreamRef.current = stream
      oralAudioChunksRef.current = []
      const recorder = new MediaRecorder(stream)
      oralMediaRecorderRef.current = recorder
      recorder.ondataavailable = event => {
        if (event.data.size > 0) oralAudioChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const audio = new Blob(oralAudioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        oralMediaStreamRef.current?.getTracks().forEach(track => track.stop())
        oralMediaStreamRef.current = null
        oralMediaRecorderRef.current = null
        setPracticeRun(current => current ? { ...current, oralRecordingQuestionId: null } : current)
        const reader = new FileReader()
        reader.onload = async () => {
          if (typeof reader.result !== 'string') return
          try {
            const result = await speechToText(LOCAL_USER_ID, reader.result) as { text?: string }
            const text = result.text?.trim()
            if (!text) throw new Error('没有识别到清晰的语音')
            answerPracticeQuestion(questionId, text)
            setNotice('已转写为文字，你可以修改后再提交。')
          } catch (error) {
            setNotice(error instanceof Error ? `${error.message}，你仍可以手动输入。` : '语音转写失败，你仍可以手动输入。')
          }
        }
        reader.readAsDataURL(audio)
      }
      recorder.start()
      setPracticeRun(current => current ? { ...current, oralRecordingQuestionId: questionId } : current)
      setNotice('正在录音，结束后会自动转写为文字。')
    } catch {
      setNotice('无法启用麦克风。请允许麦克风权限，或直接输入文字回答。')
    }
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
      setPracticeAttemptCounts(current => ({ ...current, [practiceRun.artifact.id]: (current[practiceRun.artifact.id] || 0) + 1 }))
      if (data.map_progress && practiceRun.artifact.sourceMapArtifactId) {
        const sourceMap = mapArtifacts.find(item => item.backendId === practiceRun.artifact.sourceMapArtifactId)
        if (sourceMap) {
          setMapProgressByArtifactId(current => ({ ...current, [sourceMap.id]: data.map_progress as KnowledgeMapProgressState }))
        }
      }
      void refreshTopicReviews()
      void refreshLibraryTopicState()
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
    setLearningLoopSaveTarget(null)
    setDocumentPackSaveTarget(null)
    setPracticePackSaveTarget(null)
    setExternalVideoSaveTarget(null)
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
    setLearningLoopSaveTarget(null)
    setDocumentPackSaveTarget(null)
    setPracticePackSaveTarget(null)
    setExternalVideoSaveTarget(null)
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

  function openDocumentPackSave(turn: ChatTurn, requestedPackId?: string) {
    const packId = requestedPackId || [...turn.artifacts].reverse().find(artifact => artifact.documentPackId)?.documentPackId
    if (!packId) return
    const artifacts = turn.artifacts.filter(artifact => artifact.documentPackId === packId)
    const readyArtifacts = artifacts.filter(artifact => artifact.status !== 'generating' && artifact.status !== 'error')
    if (readyArtifacts.length !== artifacts.length || readyArtifacts.length === 0) {
      setNotice('请等待资料包内的内容全部生成完成后，再统一保存。')
      return
    }
    if (readyArtifacts.some(artifact => !artifact.backendId || !artifact.documentPackTemplate)) {
      setNotice('这套资料还在准备保存信息，请稍后重试。')
      return
    }
    const first = readyArtifacts[0]
    const stateCourse = learningState.subject || ''
    const stateTopic = learningState.current_topic || learningState.knowledge_points[0] || ''
    const recommendedCourse = first.recommendedCourse && first.recommendedCourse !== '未分类课程'
      ? first.recommendedCourse : stateCourse || '未分类课程'
    const recommendedTopic = first.recommendedTopic && first.recommendedTopic !== '未分类主题' && first.recommendedTopic !== '本次学习'
      ? first.recommendedTopic : stateTopic || '未分类主题'
    setDocumentPackSaveTarget({ turnId: turn.id, packId, artifacts: readyArtifacts })
    setSaveTarget(null)
    setLearningLoopSaveTarget(null)
    setExternalVideoSaveTarget(null)
    setSaveMode('save')
    setSaveRecommendedCourse(recommendedCourse)
    setSaveRecommendedTopic(recommendedTopic)
    setSaveRecommendationSource(first.classificationSource === 'fallback' && stateCourse && stateTopic ? 'learning_state' : first.classificationSource)
    setSaveCourse(recommendedCourse)
    setSaveTopic(recommendedTopic)
    setSaveLocationOpen(recommendedCourse === '未分类课程' || recommendedTopic === '未分类主题')
    resetDuplicateDecision()
  }

  async function confirmDocumentPackSave() {
    if (!documentPackSaveTarget || !saveCourse.trim() || !saveTopic.trim()) return
    const target = documentPackSaveTarget
    const payload = target.artifacts.map(artifact => ({
      artifact_id: artifact.backendId!,
      document_template: artifact.documentPackTemplate!,
    }))
    if (payload.some(item => !item.artifact_id || !item.document_template)) {
      setNotice('这套资料的关联信息不完整，请刷新后再试。')
      return
    }
    setSaveBusy(true)
    try {
      const response = await saveDocumentPack(
        LOCAL_USER_ID, target.packId, saveCourse.trim(), saveTopic.trim(), payload,
      )
      const savedArtifacts = response.artifacts.map(artifactFromRecord)
      const savedById = new Map(savedArtifacts.map(artifact => [artifact.id, artifact]))
      setTurns(current => current.map(turn => ({
        ...turn,
        artifacts: turn.artifacts.map(artifact => savedById.get(artifact.id) || artifact),
      })))
      setLibraryItems(current => [...savedArtifacts, ...current.filter(artifact => !savedById.has(artifact.id))])
      closeSave()
      setLibraryPreviewId(null)
      setLibraryTopic({ course: saveCourse.trim(), topic: saveTopic.trim() })
      setView('library')
      setNotice(`已将 ${savedArtifacts.length} 份文档整理为一个学习资料包`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保存学习资料包失败')
    } finally {
      setSaveBusy(false)
    }
  }

  function openPracticePackSave(turn: ChatTurn, requestedPackId?: string) {
    const packId = requestedPackId || [...turn.artifacts].reverse().find(artifact => artifact.practicePackId)?.practicePackId
    if (!packId) return
    const artifacts = turn.artifacts.filter(artifact => artifact.practicePackId === packId)
    const readyArtifacts = artifacts.filter(artifact => artifact.status !== 'generating' && artifact.status !== 'error')
    if (readyArtifacts.length !== practiceSetupModes.length || artifacts.length !== practiceSetupModes.length) {
      setNotice('请等待六种训练都生成完成后，再统一保存练习资源包。')
      return
    }
    if (readyArtifacts.some(artifact => !artifact.backendId || !artifact.practicePackMode)) {
      setNotice('这套训练还在准备保存信息，请稍后重试。')
      return
    }
    const first = readyArtifacts[0]
    const stateCourse = learningState.subject || ''
    const stateTopic = learningState.current_topic || learningState.knowledge_points[0] || ''
    const recommendedCourse = first.recommendedCourse && first.recommendedCourse !== '未分类课程'
      ? first.recommendedCourse : stateCourse || '未分类课程'
    const recommendedTopic = first.recommendedTopic && first.recommendedTopic !== '未分类主题' && first.recommendedTopic !== '本次学习'
      ? first.recommendedTopic : stateTopic || '未分类主题'
    setPracticePackSaveTarget({ turnId: turn.id, packId, artifacts: readyArtifacts })
    setSaveTarget(null)
    setLearningLoopSaveTarget(null)
    setDocumentPackSaveTarget(null)
    setExternalVideoSaveTarget(null)
    setSaveMode('save')
    setSaveRecommendedCourse(recommendedCourse)
    setSaveRecommendedTopic(recommendedTopic)
    setSaveRecommendationSource(first.classificationSource === 'fallback' && stateCourse && stateTopic ? 'learning_state' : first.classificationSource)
    setSaveCourse(recommendedCourse)
    setSaveTopic(recommendedTopic)
    setSaveLocationOpen(recommendedCourse === '未分类课程' || recommendedTopic === '未分类主题')
    resetDuplicateDecision()
  }

  async function confirmPracticePackSave() {
    if (!practicePackSaveTarget || !saveCourse.trim() || !saveTopic.trim()) return
    const target = practicePackSaveTarget
    const payload = target.artifacts.map(artifact => ({
      artifact_id: artifact.backendId!,
      practice_mode: artifact.practicePackMode!,
    }))
    if (payload.some(item => !item.artifact_id || !item.practice_mode)) {
      setNotice('这套训练的关联信息不完整，请刷新后再试。')
      return
    }
    setSaveBusy(true)
    try {
      const response = await savePracticePack(LOCAL_USER_ID, target.packId, saveCourse.trim(), saveTopic.trim(), payload)
      const savedArtifacts = response.artifacts.map(artifactFromRecord)
      const savedById = new Map(savedArtifacts.map(artifact => [artifact.id, artifact]))
      setTurns(current => current.map(turn => ({ ...turn, artifacts: turn.artifacts.map(artifact => savedById.get(artifact.id) || artifact) })))
      setLibraryItems(current => [...savedArtifacts, ...current.filter(artifact => !savedById.has(artifact.id))])
      closeSave()
      setLibraryPreviewId(null)
      setLibraryTopic({ course: saveCourse.trim(), topic: saveTopic.trim() })
      setView('library')
      setNotice('已将六种训练整理为一个练习资源包')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保存练习资源包失败')
    } finally {
      setSaveBusy(false)
    }
  }

  function openLearningLoopSave(turn: ChatTurn) {
    const loopId = [...turn.artifacts].reverse().find(artifact => artifact.learningLoopId)?.learningLoopId
    if (!loopId) return
    const artifacts = learningLoopSteps.map(step => turn.artifacts.find(artifact => (
      artifact.learningLoopId === loopId && artifact.learningLoopStep === step.kind
    ))).filter((artifact): artifact is Artifact => Boolean(artifact))
    const readyArtifacts = artifacts.filter(artifact => artifact.status !== 'generating' && artifact.status !== 'error')
    if (readyArtifacts.length !== learningLoopSteps.length) {
      setNotice('请等待四份资料都生成完成后，再保存整套学习闭环。')
      return
    }
    if (readyArtifacts.some(artifact => !artifact.backendId)) {
      setNotice('这套资料还在准备保存信息，请稍后重试。')
      return
    }
    const first = readyArtifacts[0]
    const stateCourse = learningState.subject || ''
    const stateTopic = learningState.current_topic || learningState.knowledge_points[0] || ''
    const recommendedCourse = first.recommendedCourse && first.recommendedCourse !== '未分类课程'
      ? first.recommendedCourse
      : stateCourse || '未分类课程'
    const recommendedTopic = first.recommendedTopic && first.recommendedTopic !== '未分类主题' && first.recommendedTopic !== '本次学习'
      ? first.recommendedTopic
      : stateTopic || '未分类主题'
    setLearningLoopSaveTarget({ turnId: turn.id, loopId, artifacts: readyArtifacts })
    setSaveTarget(null)
    setExternalVideoSaveTarget(null)
    setSaveMode('save')
    setSaveRecommendedCourse(recommendedCourse)
    setSaveRecommendedTopic(recommendedTopic)
    setSaveRecommendationSource(first.classificationSource === 'fallback' && stateCourse && stateTopic ? 'learning_state' : first.classificationSource)
    setSaveCourse(recommendedCourse)
    setSaveTopic(recommendedTopic)
    setSaveLocationOpen(recommendedCourse === '未分类课程' || recommendedTopic === '未分类主题')
    resetDuplicateDecision()
  }

  async function confirmLearningLoopSave() {
    if (!learningLoopSaveTarget || !saveCourse.trim() || !saveTopic.trim()) return
    const target = learningLoopSaveTarget
    const payload = target.artifacts.map(artifact => ({
      artifact_id: artifact.backendId!,
      step: artifact.learningLoopStep!,
    }))
    if (payload.some(item => !item.artifact_id || !item.step)) {
      setNotice('这套资料的关联信息不完整，请刷新后再试。')
      return
    }
    setSaveBusy(true)
    try {
      const response = await saveLearningLoop(
        LOCAL_USER_ID,
        target.loopId,
        saveCourse.trim(),
        saveTopic.trim(),
        payload,
      )
      const savedArtifacts = response.artifacts.map(artifactFromRecord)
      const savedById = new Map(savedArtifacts.map(artifact => [artifact.id, artifact]))
      setTurns(current => current.map(turn => ({
        ...turn,
        artifacts: turn.artifacts.map(artifact => savedById.get(artifact.id) || artifact),
      })))
      setLibraryItems(current => [
        ...savedArtifacts,
        ...current.filter(artifact => !savedById.has(artifact.id)),
      ])
      closeSave()
      setLibraryPreviewId(null)
      setLibraryTopic({ course: saveCourse.trim(), topic: saveTopic.trim() })
      setView('library')
      void refreshTopicReviews()
      setNotice(`已将 ${savedArtifacts.length} 份资料整理为一个学习闭环`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保存整套学习资料失败')
    } finally {
      setSaveBusy(false)
    }
  }

  async function confirmExternalVideoSave() {
    if (!externalVideoSaveTarget || !saveCourse.trim() || !saveTopic.trim()) return
    const target = externalVideoSaveTarget
    setSaveBusy(true)
    try {
      const response = await saveExternalVideoResource({
        user_id: LOCAL_USER_ID,
        session_id: target.context.sessionId,
        qa_id: target.context.turnId || `video-resource-${Date.now()}`,
        course_name: saveCourse.trim(),
        topic_name: saveTopic.trim(),
        title: target.video.title,
        url: target.video.url,
        cover_url: target.video.cover_url,
        creator: target.video.creator,
        duration: target.video.duration,
        view_count: target.video.view_count,
        description: target.video.description,
        search_query: target.context.query,
      })
      const artifact = artifactFromRecord(response.artifact)
      setLibraryItems(current => [artifact, ...current.filter(item => item.id !== artifact.id)])
      closeSave()
      setLibraryPreviewId(null)
      setLibraryTopic({ course: artifact.course, topic: artifact.topic })
      setView('library')
      setNotice(response.duplicate ? '这条课程视频已经收藏过，已为你打开所在主题。' : '课程视频已收藏到资料库。看完后可生成练习或动态讲解。')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '收藏课程视频失败，请稍后重试。')
    } finally {
      setSaveBusy(false)
    }
  }

  async function confirmSave() {
    if (documentPackSaveTarget) {
      await confirmDocumentPackSave()
      return
    }
    if (practicePackSaveTarget) {
      await confirmPracticePackSave()
      return
    }
    if (learningLoopSaveTarget) {
      await confirmLearningLoopSave()
      return
    }
    if (externalVideoSaveTarget) {
      await confirmExternalVideoSave()
      return
    }
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
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} aria-label={t('主导航', 'Main navigation')}>
        <div className="brand-row">
          <span className="brand-mark"><BrandSymbol /></span>
          <span className="brand-copy"><strong>RHYME</strong><small>Learning Agent</small></span>
          <button
            className="sidebar-collapse icon-button"
            type="button"
            title={sidebarCollapsed ? t('展开导航', 'Expand navigation') : t('收起导航', 'Collapse navigation')}
            aria-label={sidebarCollapsed ? t('展开导航', 'Expand navigation') : t('收起导航', 'Collapse navigation')}
            aria-pressed={sidebarCollapsed}
            onClick={() => setSidebarCollapsed(current => !current)}
          >
            {sidebarCollapsed ? <ChevronRight size={17} strokeWidth={1.8} /> : <ArrowLeft size={17} strokeWidth={1.8} />}
          </button>
          <button className="mobile-close icon-button" aria-label={t('关闭导航', 'Close navigation')} onClick={() => setSidebarOpen(false)}><Icon name="x" /></button>
        </div>

        <button className="new-chat" title={t('新学习对话', 'New learning chat')} onClick={newChat}>
          <Icon name="pen" size={17} />
          <span>{t('新学习对话', 'New learning chat')}</span>
        </button>

        <nav className="primary-nav" aria-label={t('学习空间', 'Learning space')}>
          <button className={view === 'library' ? 'nav-item active' : 'nav-item'} title={t('资料库', 'Library')} onClick={() => { setView('library'); setLibraryPreviewId(null); setLibraryTopic(null); setSidebarOpen(false) }}>
            <Icon name="library" size={18} />
            <span>{t('资料库', 'Library')}</span>
            {libraryItems.length > 0 && <span className="nav-count">{libraryItems.length}</span>}
          </button>
          <button className="nav-item learning-house-entry" title={t('进入 3D 学习屋', 'Enter 3D learning house')} onClick={() => { setLearningHouseOpen(true); setSidebarOpen(false) }}>
            <Icon name="house" size={18} />
            <span>{t('3D 学习屋', '3D learning house')}</span>
            <Sparkles className="learning-house-entry-spark" size={13} aria-hidden="true" />
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
          <button
            className={`background-task-trigger${backgroundRunningTaskCount ? ' is-running' : ''}${backgroundAttentionTaskCount ? ' needs-attention' : ''}${backgroundCompletedTaskCount ? ' has-complete' : ''}`}
            type="button"
            title={t('后台任务', 'Background tasks')}
            aria-label={backgroundRunningTaskCount
              ? t(`${backgroundRunningTaskCount} 个后台任务正在运行`, `${backgroundRunningTaskCount} background tasks running`)
              : backgroundAttentionTaskCount
                ? t(`${backgroundAttentionTaskCount} 个后台任务需要处理`, `${backgroundAttentionTaskCount} background tasks need attention`)
                : backgroundCompletedTaskCount
                  ? t(`${backgroundCompletedTaskCount} 个后台任务已完成`, `${backgroundCompletedTaskCount} background tasks complete`)
                  : t('后台任务', 'Background tasks')}
            aria-expanded={backgroundTasksOpen}
            aria-haspopup="dialog"
            onClick={toggleBackgroundTasks}
          >
            <ListChecks size={18} strokeWidth={1.9} />
            {(backgroundRunningTaskCount > 0 || backgroundAttentionTaskCount > 0 || backgroundCompletedTaskCount > 0) && (
              <span>{backgroundRunningTaskCount || backgroundAttentionTaskCount || backgroundCompletedTaskCount}</span>
            )}
          </button>
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
          <button
            className={`mobile-background-task-trigger icon-button${backgroundRunningTaskCount ? ' is-running' : ''}${backgroundAttentionTaskCount ? ' needs-attention' : ''}${backgroundCompletedTaskCount ? ' has-complete' : ''}`}
            type="button"
            aria-label={t('后台任务', 'Background tasks')}
            aria-expanded={backgroundTasksOpen}
            onClick={toggleBackgroundTasks}
          >
            <ListChecks size={17} strokeWidth={1.9} />
            {(backgroundRunningTaskCount > 0 || backgroundAttentionTaskCount > 0 || backgroundCompletedTaskCount > 0) && <span>{backgroundRunningTaskCount || backgroundAttentionTaskCount || backgroundCompletedTaskCount}</span>}
          </button>
          <button
            className="learning-guide-toggle icon-button"
            type="button"
            aria-label={learningGuideOpen ? t('收起学习导航', 'Hide learning guide') : t('打开学习导航', 'Open learning guide')}
            aria-expanded={learningGuideOpen}
            onClick={() => setLearningGuideOpen(current => !current)}
          >
            <NotebookTabs size={17} strokeWidth={1.8} />
            <span>{t('学习导航', 'Guide')}</span>
          </button>
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
                          ? <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{turn.response}</ReactMarkdown>
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

                      {(() => {
                        const videoSearch = inlineVideoSearches[turn.id]
                        if (!videoSearch) return null
                        const { context, results, loading, error, searchUrl } = videoSearch
                        return (
                          <section id={`course-videos-${turn.id}`} className="inline-video-recommendations" aria-label="课程视频推荐" aria-live="polite">
                            <header className="inline-video-head">
                              <div>
                                <span><Icon name="video" size={15} />课程视频</span>
                                <h2>{loading ? '正在寻找适合你的课程' : results.length ? `找到 ${results.length} 个可直接观看的课程` : '暂时没有找到合适的视频'}</h2>
                                <p>{context.course !== '未分类课程' || context.topic !== '本次学习'
                                  ? `围绕「${context.course} · ${context.topic}」推荐`
                                  : '根据本次对话内容推荐'}</p>
                              </div>
                              <small>来源 · B站 原视频</small>
                            </header>

                            {loading ? (
                              <div className="inline-video-loading"><Sparkles size={17} /><span>正在根据当前学习内容筛选真实课程视频…</span></div>
                            ) : results.length > 0 ? (
                              <div className="inline-video-grid">
                                {results.map(video => (
                                  <article className="inline-video-card" key={video.url}>
                                    <button className="inline-video-cover" type="button" onClick={() => openExternalVideo(video.url)} aria-label={`在 B站 打开：${video.title}`}>
                                      {video.cover_url
                                        ? <img src={video.cover_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
                                        : <span className="inline-video-cover-fallback"><Icon name="video" size={23} /></span>}
                                      <span className="inline-video-play"><Icon name="play" size={15} /></span>
                                      <span className="inline-video-duration">{video.duration || 'B站课程'}</span>
                                    </button>
                                    <div className="inline-video-copy">
                                      <h3>{video.title}</h3>
                                      <p className="inline-video-meta">{[video.creator && `UP 主：${video.creator}`, video.view_count].filter(Boolean).join(' · ') || 'B站课程视频'}</p>
                                      <p className="inline-video-reason">{video.recommendation}</p>
                                      <div className="inline-video-actions">
                                        <button type="button" onClick={() => openExternalVideo(video.url)}><Icon name="play" size={14} />去 B站</button>
                                        <button className="inline-video-save" type="button" onClick={() => openExternalVideoSave(video, context)}><Icon name="save" size={14} />收藏</button>
                                      </div>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <div className="inline-video-empty">
                                <Icon name="video" size={19} />
                                <span>{error || '暂时没有找到足够匹配的视频，可以到 B站 再看看。'}</span>
                                {searchUrl && <button type="button" onClick={() => openExternalVideo(searchUrl)}>去 B站 继续搜索<Icon name="chevron" size={14} /></button>}
                              </div>
                            )}

                            <footer>视频来自 B站 原页面，RHYME 不下载、不搬运，也不会替代原视频播放页。</footer>
                          </section>
                        )
                      })()}

                      {renderLearningLoop(turn)}
                      {renderDocumentPack({ ...turn, artifacts: resolvedPackArtifacts(turn) })}
                      {renderPracticePack({ ...turn, artifacts: resolvedPackArtifacts(turn) })}

                      {resolvedPackArtifacts(turn).filter(artifact => !artifact.documentPackId && !artifact.practicePackId).map(artifact => {
                        const option = artifactOptions.find(item => item.kind === artifact.kind)
                        const mapData = artifact.kind === 'map' ? parseKnowledgeMap(artifact.content) : null
                        const dynamicExplanation = artifact.kind === 'interactive' ? parseDynamicExplanation(artifact.content) : null
                        const mapProgress = mapProgressByArtifactId[artifact.id]
                        return (
                          <article id={`artifact-${artifact.id}`} className={`artifact-card artifact-${artifact.status || 'draft'} ${artifact.kind === 'interactive' ? 'artifact-dynamic' : ''} ${artifact.kind !== 'map' && artifact.kind !== 'interactive' && expandedArtifactId === artifact.id ? 'artifact-expanded' : ''}`} key={artifact.id}>
                            <div className="artifact-head">
                              <span className="artifact-icon"><Icon name={option?.icon || 'file'} size={18} /></span>
                              <div>
                                <span>{artifact.kind === 'notes' ? documentArtifactLabel(artifact) : option ? artifactLabel(option.kind, option.label) : t('学习资料', 'Learning material')}</span>
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
                            {dynamicExplanation && (
                              <DynamicExplanationPlayer
                                data={dynamicExplanation}
                                language={interfaceLanguage}
                                progress={presentationProgressForArtifact(artifact)}
                                onProgressChange={progress => persistInteractivePresentationProgress(artifact, progress)}
                                onCheckpoint={(scene, answer) => persistInteractivePresentationCheckpoint(artifact, scene, answer)}
                                onSceneStarted={(scene, index) => recordSavedArtifactActivity(artifact, 'scene_started', { scene_id: scene.id, scene_index: index + 1 })}
                                onSceneCompleted={(scene, index) => recordSavedArtifactActivity(artifact, 'scene_completed', { scene_id: scene.id, scene_index: index + 1 })}
                                onCompleted={() => recordSavedArtifactActivity(artifact, 'completed', { scene_count: dynamicExplanation.scenes.length })}
                                onSavePresentation={presentation => persistEditedInteractivePresentation(artifact, presentation)}
                                onRegenerateScene={(presentation, scene) => remakeInteractivePresentationScene(artifact, presentation, scene)}
                                saving={presentationEditingArtifactId === artifact.id}
                                saveAsVersion={artifact.saved}
                                openImmersiveRequest={immersiveOpenRequest?.artifactId === artifact.id ? immersiveOpenRequest.revision : undefined}
                                compact
                              />
                            )}
                            {artifact.kind !== 'map' && artifact.kind !== 'practice' && artifact.kind !== 'interactive' && artifact.content && expandedArtifactId === artifact.id && (
                              <div className="artifact-document">
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{artifact.content}</ReactMarkdown>
                              </div>
                            )}
                            <div className="artifact-source"><Icon name="paperclip" size={14} />基于 {artifact.source}</div>
                            {(artifact.status !== 'generating' || (artifact.kind === 'map' && mapData)) && (
                              <div className="artifact-actions">
                                {artifact.kind === 'map' && mapData && (
                                  <button type="button" onClick={() => openMapWorkspace(artifact, 'chat')}>
                                    <Trees size={15} />{artifact.status === 'generating' ? '查看关系骨架' : '打开图解'}
                                  </button>
                                )}
                                {artifact.status !== 'generating' && <>
                                {artifact.kind !== 'map' && artifact.kind !== 'practice' && artifact.kind !== 'interactive' && artifact.content && (
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
                                  if (artifact.kind === 'practice') {
                                    if (artifact.status === 'error' && artifact.learningLoopId) {
                                      void retryLearningLoopPractice(turn.id, artifact)
                                      return
                                    }
                                    const linkedMap = artifact.learningLoopId
                                      ? turn.artifacts.find(item => item.learningLoopId === artifact.learningLoopId && item.learningLoopStep === 'map')
                                      : undefined
                                    void runPracticeGeneration(turn.id, artifact.sourceMapArtifactId || linkedMap?.backendId)
                                  }
                                  else if (artifact.kind === 'map') {
                                    if (artifact.status === 'error' && artifact.learningLoopId) {
                                      void retryLearningLoopMap(turn.id, artifact)
                                      return
                                    }
                                    void runKnowledgeMapGeneration(turn.id)
                                  }
                                  else if (artifact.kind === 'interactive') void runDynamicExplanationGeneration(
                                    turn.id,
                                    artifact.status === 'error' ? artifact.id : undefined,
                                  )
                                  else setDocumentSetup({
                                    turnId: turn.id,
                                    template: artifact.documentTemplate || recommendDocumentTemplate(turn.prompt, turn.response),
                                  })
                                }}>{artifact.status === 'error'
                                  ? artifact.kind === 'notes' ? '重新设置' : '立即重试'
                                  : '重新生成'}</button>
                                {artifact.status !== 'error' && (
                                  <button className="artifact-save" type="button" onClick={() => {
                                    if (artifact.saved) {
                                      openLibraryArtifact(artifact)
                                    } else openSave(artifact)
                                  }}>
                                    <Icon name={artifact.saved ? 'check' : 'save'} size={15} />
                                    {artifact.saved ? '查看资料库' : '保存到资料库'}
                                  </button>
                                )}
                                </>}
                              </div>
                            )}
                          </article>
                        )
                      })}

                      {!turn.loading && !turn.error && <div className="generation-dock">
                        <button
                          className="learning-loop-trigger"
                          type="button"
                          disabled={learningLoopGeneratingTurnId !== null}
                          onClick={() => void runLearningLoopGeneration(turn.id)}
                        >
                          <Sparkles aria-hidden="true" size={16} strokeWidth={1.8} />
                          <span><b>{learningLoopGeneratingTurnId === turn.id ? t('正在生成学习闭环', 'Building learning loop') : t('一键生成学习闭环', 'Generate learning loop')}</b><small>{t('文档 → 图解 → 动态讲解 → 练习', 'Document → map → explanation → practice')}</small></span>
                          <ChevronRight aria-hidden="true" size={15} strokeWidth={1.8} />
                        </button>
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
                              <div><b>{t('生成学习文档', 'Generate learning document')}</b><span>{t('先由智能体推荐一种结构，你可以随时换成更适合当前任务的版本。', 'An appropriate structure is recommended first. You can change it at any time.')}</span></div>
                              <button type="button" aria-label={t('关闭学习文档设置', 'Close document setup')} onClick={() => setDocumentSetup(null)}><Icon name="x" size={15} /></button>
                            </div>
                            <div className="document-template-recommendation">
                              <span><Icon name="spark" size={14} />{t('智能推荐', 'Recommended')}</span>
                              <b>{interfaceLanguage === 'en' ? documentTemplateById[recommendDocumentTemplate(turn.prompt, turn.response)].labelEn : documentTemplateById[recommendDocumentTemplate(turn.prompt, turn.response)].label}</b>
                              <small>{t('依据当前问题的表达方式和学习目标判断', 'Based on the wording and learning goal in this chat')}</small>
                            </div>
                            <div className="document-template-groups">
                              {documentTemplateGroups.map(group => {
                                const templates = documentTemplates.filter(template => template.group === group.id)
                                return (
                                  <section className="document-template-group" key={group.id} aria-label={interfaceLanguage === 'en' ? group.labelEn : group.label}>
                                    <h3>{interfaceLanguage === 'en' ? group.labelEn : group.label}</h3>
                                    <div className="document-template-options">
                                      {templates.map(template => {
                                        const active = documentSetup.template === template.id
                                        return <button
                                          className={active ? 'active' : ''}
                                          key={template.id}
                                          type="button"
                                          aria-pressed={active}
                                          onClick={() => setDocumentSetup(current => current ? { ...current, template: template.id } : current)}
                                        >
                                          <span><Icon name={template.icon} size={15} /></span>
                                          <span><b>{interfaceLanguage === 'en' ? template.labelEn : template.label}</b><small>{interfaceLanguage === 'en' ? template.descriptionEn : template.description}</small></span>
                                          {active && <Icon name="check" size={15} />}
                                        </button>
                                      })}
                                    </div>
                                  </section>
                                )
                              })}
                            </div>
                            <div className="document-setup-foot">
                              <span><Icon name="library" size={14} />{t('生成后可按课程和主题保存到资料库', 'Save it by course and topic after generating')}</span>
                              <div className="document-setup-actions">
                                <button
                                  className="document-pack-entry"
                                  type="button"
                                  onClick={() => openDocumentPackSetup(turn.id)}
                                  disabled={documentPackGeneratingTurnId !== null}
                                ><Archive size={15} />{t('批量生成资料包', 'Build a study pack')}</button>
                                <button type="button" onClick={() => void runDocumentGeneration()} disabled={documentGenerating}><Icon name="spark" size={15} />{t('生成 ', 'Generate ')}{interfaceLanguage === 'en' ? documentTemplateById[documentSetup.template].labelEn : documentTemplateById[documentSetup.template].label}</button>
                              </div>
                            </div>
                          </section>
                        )}
                        {documentPackSetup?.turnId === turn.id && (
                          <section className="document-pack-setup" aria-label={t('设置学习资料包', 'Set up study pack')}>
                            <div className="document-setup-head">
                              <div><b>{t('学习文档 · 批量资料包', 'Learning documents · Study pack')}</b><span>{t('默认保留系统讲义、公式手册、术语表和考前速记；题目或对比场景会由智能体补进对应文档。', 'The core guide, formula handbook, glossary, and cram sheet are selected by default. Problem and comparison documents are recommended when relevant.')}</span></div>
                              <button type="button" aria-label={t('返回学习文档', 'Back to learning documents')} onClick={() => returnToDocumentSetup(turn.id)}><Icon name="arrow-left" size={15} /></button>
                            </div>
                            <div className="document-pack-selection">
                              {documentTemplates.map(template => {
                                const selected = documentPackSetup.templates.includes(template.id)
                                const recommended = recommendedDocumentPackTemplates(turn.prompt, turn.response).includes(template.id)
                                return <button
                                  type="button"
                                  key={template.id}
                                  className={selected ? 'selected' : ''}
                                  aria-pressed={selected}
                                  onClick={() => toggleDocumentPackTemplate(template.id)}
                                >
                                  <span><Icon name={selected ? 'check' : template.icon} size={14} /></span>
                                  <b>{interfaceLanguage === 'en' ? template.labelEn : template.label}</b>
                                  {recommended && <small>{t('推荐', 'Recommended')}</small>}
                                </button>
                              })}
                            </div>
                            <div className="document-setup-foot">
                              <span><Icon name="library" size={14} />{t(`已选择 ${documentPackSetup.templates.length} 份，生成后可一键归档`, `${documentPackSetup.templates.length} selected; save them together after generation`)}</span>
                              <button type="button" onClick={() => void runDocumentPackGeneration()} disabled={documentPackSetup.templates.length === 0 || documentPackGeneratingTurnId !== null}><Icon name="spark" size={15} />{t(`生成 ${documentPackSetup.templates.length} 份`, `Generate ${documentPackSetup.templates.length}`)}</button>
                            </div>
                          </section>
                        )}
                        {practiceSetupTurnId === turn.id && (
                          <section id={`practice-setup-${turn.id}`} className="practice-setup" aria-label="设置练习测验">
                            <div className="practice-setup-head">
                              <div><b>选择训练方式</b><span>围绕这条回答生成对应训练。完成后会给出解析，并可保存到资料库。</span></div>
                              <button type="button" aria-label="关闭练习测验设置" onClick={() => setPracticeSetupTurnId(null)}><Icon name="x" size={15} /></button>
                            </div>
                            <div className="practice-mode-list" role="radiogroup" aria-label="训练方式">
                              {practiceSetupModes.map(mode => {
                                const profile = practiceProfiles[mode]
                                const selected = practiceSetupMode === mode
                                return <button
                                  type="button"
                                  key={mode}
                                  className={selected ? 'selected' : ''}
                                  aria-checked={selected}
                                  role="radio"
                                  onClick={() => setPracticeSetupMode(mode)}
                                >
                                  <span><Icon name={selected ? 'check' : profile.icon} size={14} /></span>
                                  <b>{profile.label}</b>
                                  <small>{profile.description}</small>
                                  <em>{profile.count} 项 · 约 {profile.minutes} 分钟</em>
                                </button>
                              })}
                            </div>
                            <div className="practice-setup-foot">
                              <span><Icon name="library" size={14} />单独练一组，或把六种训练整理为一份可连续复习的资源册</span>
                              <div className="practice-setup-actions">
                                <button className="practice-pack-entry" type="button" onClick={() => void runPracticePackGeneration(turn.id)} disabled={practiceGenerating}><Archive size={15} />{practiceGenerating ? '生成中…' : '一键生成练习资源包（6种）'}</button>
                                <button type="button" onClick={() => void runPracticeGeneration(turn.id, undefined, practiceSetupMode)} disabled={practiceGenerating}><Icon name="spark" size={15} />{practiceGenerating ? '生成中…' : `生成${practiceProfiles[practiceSetupMode].label}`}</button>
                              </div>
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
              {mapWorkspaceArtifact?.status === 'generating' && !mapWorkspaceData ? (
                <div className="map-workspace-generating" role="status" aria-live="polite">
                  <button className="map-workspace-generating-exit" type="button" onClick={closeMapWorkspace}>
                    <Icon name="arrow-left" size={16} />{mapWorkspaceReturnView === 'library' ? t('返回资料库', 'Back to library') : t('返回对话', 'Back to chat')}
                  </button>
                  <span className="map-workspace-generating-mark"><Sparkles size={21} /></span>
                  <div className="map-workspace-generating-copy">
                    <h1>{t('正在搭建这张知识图解', 'Building this knowledge map')}</h1>
                    <p>{t('先整理核心概念与关系，再补上例子和易错点。完成后会直接出现在这个画布中。', 'Organising core concepts and relationships, then adding examples and misconceptions. The finished map will appear here.')}</p>
                  </div>
                  <div className="map-workspace-background-note">
                    <div>
                      <span aria-hidden="true"><Icon name="check" size={15} /></span>
                      <p><b>{t('已转入后台生成', 'Generating in the background')}</b><small>{t('不需要停在这里等待。可以先返回对话继续学习，完成后资料卡会自动变为可打开状态。', 'You do not need to wait here. Continue learning in chat and this card will become available automatically.')}</small></p>
                    </div>
                    <button type="button" onClick={closeMapWorkspace}><Icon name="arrow-left" size={15} />{mapWorkspaceReturnView === 'library' ? t('继续浏览资料库', 'Continue browsing library') : t('返回对话继续学习', 'Continue learning in chat')}</button>
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
                      ) : mapWorkspaceArtifact.status !== 'error' && mapWorkspaceArtifact.status !== 'generating' ? (
                        <button className="primary" type="button" onClick={() => openSave(mapWorkspaceArtifact)}><Icon name="save" size={15} />{t('保存到资料库', 'Save to library')}</button>
                      ) : null}
                    </div>
                  </header>
                  <div className="map-workspace-stage">
                    <G6KnowledgeMap
                      data={mapWorkspaceData}
                      reader
                      workspace
                      language={interfaceLanguage}
                      progress={mapWorkspaceProgress}
                      progressLoading={Boolean(mapWorkspaceArtifact.backendId && !mapWorkspaceProgress && mapProgressFetches.current.has(mapWorkspaceArtifact.id))}
                      progressSavingNodeId={mapWorkspaceSavingNodeId}
                      reviewPracticeGenerating={mapReviewPracticeGeneratingArtifactId === mapWorkspaceArtifact.id}
                      onStatusChange={mapWorkspaceArtifact.status === 'generating' ? undefined : (nodeId, status) => void updateMapNodeStatus(mapWorkspaceArtifact, nodeId, status)}
                      onReviewPractice={mapWorkspaceArtifact.status === 'generating' ? undefined : () => void runMapReviewPractice(mapWorkspaceArtifact, mapWorkspaceData)}
                      onMapChange={map => persistEditedKnowledgeMap(mapWorkspaceArtifact, map)}
                      mapSaving={mapEditingArtifactId === mapWorkspaceArtifact.id}
                      collaboration={mapCollaborations[mapWorkspaceArtifact.id]}
                      collaborationLoading={mapCollaborationLoadingArtifactId === mapWorkspaceArtifact.id}
                      onCollaboration={() => void runMapCollaboration(mapWorkspaceArtifact)}
                      onDismissSuggestion={suggestion => dismissMapSuggestion(mapWorkspaceArtifact.id, suggestion)}
                      onGenerateDeepDive={mapWorkspaceArtifact.status === 'generating' ? undefined : (nodeId, force) => requestKnowledgeMapDeepDive(mapWorkspaceArtifact, nodeId, force)}
                      exploration={mapWorkspaceProgress?.exploration}
                      explorationKey={mapWorkspaceArtifact.id}
                      onExplorationChange={state => updateMapExploration(mapWorkspaceArtifact, state)}
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
                  {mapWorkspaceArtifact?.status === 'error' && (() => {
                    const parentTurn = turns.find(turn => turn.artifacts.some(artifact => artifact.id === mapWorkspaceArtifact.id))
                    return parentTurn ? <button className="primary map-workspace-retry" type="button" onClick={() => {
                      closeMapWorkspace()
                      void runKnowledgeMapGeneration(parentTurn.id)
                    }}><Sparkles size={16} />{t('立即重新生成图解', 'Generate the map again')}</button> : null
                  })()}
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
                  <small>{versionPreview ? `${documentArtifactLabel(versionPreview)} · ${t('历史版本', 'Past version')} v${versionPreview.version}` : libraryPreview.status === 'deleted' ? t('已移入回收站', 'In trash') : documentArtifactLabel(readerArtifact)}{!versionPreview && libraryPreview.version > 1 ? ` · v${libraryPreview.version}` : ''}</small>
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
                  <div className={`library-reader-content ${readerMapData ? 'has-knowledge-map' : ''} ${readerDynamicExplanation ? 'has-dynamic-explanation' : ''} ${readerExternalVideo ? 'has-external-video' : ''} ${readerArtifact?.kind === 'notes' ? `document-template-${readerArtifact.documentTemplate || 'system_guide'}` : ''}`}>
                    {readerArtifact?.kind === 'map'
                      ? readerMapData
                        ? <G6KnowledgeMap
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
                            onGenerateDeepDive={versionPreview ? undefined : (nodeId, force) => requestKnowledgeMapDeepDive(readerArtifact, nodeId, force)}
                          />
                        : <p>这份图解内容无法读取，请回到来源对话重新生成。</p>
                      : readerArtifact?.kind === 'interactive'
                        ? readerDynamicExplanation
                          ? <DynamicExplanationPlayer
                              data={readerDynamicExplanation}
                              language={interfaceLanguage}
                              progress={versionPreview ? undefined : presentationProgressForArtifact(readerArtifact)}
                              onProgressChange={versionPreview ? undefined : progress => persistInteractivePresentationProgress(readerArtifact, progress)}
                              onCheckpoint={versionPreview ? undefined : (scene, answer) => persistInteractivePresentationCheckpoint(readerArtifact, scene, answer)}
                              onSceneStarted={versionPreview ? undefined : (scene, index) => recordSavedArtifactActivity(readerArtifact, 'scene_started', { scene_id: scene.id, scene_index: index + 1, surface: 'library' })}
                              onSceneCompleted={versionPreview ? undefined : (scene, index) => recordSavedArtifactActivity(readerArtifact, 'scene_completed', { scene_id: scene.id, scene_index: index + 1, surface: 'library' })}
                              onCompleted={versionPreview ? undefined : () => recordSavedArtifactActivity(readerArtifact, 'completed', { scene_count: readerDynamicExplanation.scenes.length, surface: 'library' })}
                              onSavePresentation={versionPreview ? undefined : presentation => persistEditedInteractivePresentation(readerArtifact, presentation)}
                              onRegenerateScene={versionPreview ? undefined : (presentation, scene) => remakeInteractivePresentationScene(readerArtifact, presentation, scene)}
                              saving={presentationEditingArtifactId === readerArtifact.id}
                              saveAsVersion={readerArtifact.saved}
                            />
                          : <p>这份动态讲解内容无法读取，请回到来源对话重新生成。</p>
                        : readerArtifact?.kind === 'external_video'
                          ? readerExternalVideo
                            ? <section className="external-video-reader" aria-label="课程视频资源">
                                <div className="external-video-reader-head"><span><Icon name="video" size={18} />{readerExternalVideo.platform_label}</span><b>原视频资源</b></div>
                                {readerExternalVideo.cover_url && <button className="external-video-reader-cover" type="button" onClick={() => openExternalVideo(readerExternalVideo.url, readerArtifact)} aria-label={`在 B站 打开：${readerArtifact.title}`}><img src={readerExternalVideo.cover_url} alt="" referrerPolicy="no-referrer" /><span><Icon name="play" size={16} />去 B站观看</span></button>}
                                <h2>{readerArtifact.title}</h2>
                                <p>{readerExternalVideo.description || readerArtifact.summary}</p>
                                <div className="external-video-reader-meta">
                                  {readerExternalVideo.creator && <span>UP 主：{readerExternalVideo.creator}</span>}
                                  {readerExternalVideo.duration && <span>{readerExternalVideo.duration}</span>}
                                  {readerExternalVideo.view_count && <span>{readerExternalVideo.view_count}</span>}
                                  {readerExternalVideo.search_query && <span>检索：{readerExternalVideo.search_query}</span>}
                                </div>
                                <div className="external-video-reader-actions">
                                  <button className="primary" type="button" onClick={() => openExternalVideo(readerExternalVideo.url, readerArtifact)}><Icon name="play" size={16} />去 B站观看</button>
                                  <button type="button" onClick={() => { recordSavedArtifactActivity(readerArtifact, 'completed', { surface: 'external_video', platform: 'bilibili' }); setNotice('已记录为看完视频。接下来可做练习，或用动态讲解补齐难点。') }}><Icon name="check" size={15} />我已看完</button>
                                </div>
                                <div className="external-video-next">
                                  <span>看完后</span>
                                  <button type="button" onClick={() => prepareVideoFollowUp(readerArtifact, 'practice')}>做练习检验</button>
                                  <button type="button" onClick={() => prepareVideoFollowUp(readerArtifact, 'interactive')}>用动态讲解补充</button>
                                </div>
                              </section>
                            : <p>这条课程视频的信息无法读取，请重新搜索后收藏。</p>
                          : <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{readerArtifact?.content || ''}</ReactMarkdown>}
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
                    <div className="library-topic-heading-actions">
                      <span>{libraryTopicLearningMastery > 0 ? `掌握 ${libraryTopicLearningMastery}% · ` : ''}{libraryTopicItems.length} 份资料</span>
                      <button type="button" onClick={() => {
                        setView('chat')
                        openVideoSearch(undefined, { course: libraryTopic.course, topic: libraryTopic.topic })
                      }}><Icon name="video" size={14} />找课程视频</button>
                    </div>
                  </div>
                  <section className={`topic-study-plan${topicStudyPlan?.status === 'completed' ? ' is-complete' : ''}`} aria-label={t('本次复习清单', 'Review plan')}>
                    <div className="topic-study-plan-head">
                      <div>
                        <b>{topicStudyPlan?.status === 'completed' ? t('本次复习已完成', 'Review complete') : t('本次复习', 'This review')}</b>
                        <p>{topicStudyPlan?.status === 'completed'
                          ? t('这次的完成记录已经保留。下次回来时，重新生成一份清单，系统会根据新进度安排。', 'This completion is saved. Next time, generate a new list based on your latest progress.')
                          : topicStudyPlan
                            ? t('只做眼前这几步。每完成一项，下一次回来都会从未完成处继续。', 'Only focus on these few steps. Each completion stays here when you return.')
                            : t('让 RHYME 根据已保存的资料和你的学习记录，安排一份简短的复习清单。', 'Let RHYME make a short review list from your saved materials and learning record.')}</p>
                      </div>
                      {topicStudyPlan && <span>{topicStudyPlan.completed_count}/{topicStudyPlan.total_count}</span>}
                    </div>
                    {topicStudyPlanLoading ? (
                      <div className="topic-study-plan-loading">{t('正在准备复习清单…', 'Preparing your review list…')}</div>
                    ) : topicStudyPlan?.tasks.length ? (
                      <div className="topic-study-plan-tasks">
                        {topicStudyPlan.tasks.map(task => {
                          const completed = task.status === 'completed'
                          const active = !completed && task.id === topicStudyPlan.active_task_id
                          const isBusy = topicStudyPlanBusyTaskId === task.id
                          return (
                            <article className={`${completed ? 'completed' : ''}${active ? ' active' : ''}`} key={task.id}>
                              <button
                                className="topic-study-plan-check"
                                type="button"
                                aria-label={completed ? t('标记为未完成', 'Mark as not complete') : t('标记为已完成', 'Mark as complete')}
                                disabled={Boolean(topicStudyPlanBusyTaskId)}
                                onClick={() => void updateTopicPlanTask(task, completed ? 'pending' : 'completed')}
                              >
                                {completed && <Check size={13} />}
                              </button>
                              <button className="topic-study-plan-open" type="button" onClick={() => void openTopicPlanTask(task)}>
                                <span>{active ? t('现在做', 'Do now') : completed ? t('已完成', 'Done') : t('待开始', 'Up next')}</span>
                                <b>{task.title}</b>
                                <small>{task.detail}</small>
                              </button>
                              <button
                                className="topic-study-plan-action"
                                type="button"
                                disabled={isBusy}
                                onClick={() => void openTopicPlanTask(task)}
                              >
                                {isBusy ? t('保存中', 'Saving') : completed ? t('再看', 'Review') : active ? t('开始', 'Start') : t('打开', 'Open')}<ChevronRight size={14} />
                              </button>
                            </article>
                          )
                        })}
                      </div>
                    ) : null}
                    <button className="topic-study-plan-start" type="button" disabled={topicStudyPlanLoading} onClick={() => void startTopicReviewPlan()}>
                      <Icon name={topicStudyPlan?.status === 'completed' ? 'rotate' : 'spark'} size={14} />
                      {topicStudyPlan?.status === 'completed' ? t('开始下一次复习', 'Plan another review') : topicStudyPlan?.tasks.length ? t('重新安排本次复习', 'Rebuild this review') : t('开始本次复习', 'Start this review')}
                    </button>
                  </section>
                  {libraryTopicLearningLoops.slice(0, 1).map(loop => {
                    const loopReadyCount = learningLoopSteps.filter(step => loop.artifacts.some(artifact => artifact.learningLoopStep === step.kind)).length
                    return (
                      <section className="library-learning-loop" key={loop.id} aria-label={t('已保存的学习闭环', 'Saved learning loop')}>
                        <div className="library-learning-loop-head">
                          <div><b>{t('学习闭环', 'Learning loop')}</b><p>{t('同一主题下的四份资料已连在一起，练习结果会继续回写到图解。', 'The four connected materials stay together. Practice results return to the map.')}</p></div>
                          <span>{t(`${loopReadyCount}/4 已归档`, `${loopReadyCount}/4 saved`)}</span>
                        </div>
                        <div className="library-learning-loop-steps">
                          {learningLoopSteps.map(step => {
                            const artifact = loop.artifacts.find(item => item.learningLoopStep === step.kind)
                            return artifact ? (
                              <button type="button" key={step.kind} onClick={() => openLibraryArtifact(artifact)}>
                                <span>{step.label}</span><small>{step.detail}</small><ChevronRight size={14} />
                              </button>
                            ) : (
                              <span className="missing" key={step.kind}>{step.label}</span>
                            )
                          })}
                        </div>
                        {libraryTopicState?.next_step.action !== 'complete' && (
                          <button className="library-learning-loop-continue" type="button" onClick={() => void continueTopicLearning()}>
                            {topicNextStepLabel(libraryTopicState?.next_step.action || 'open_material')}<ChevronRight size={15} />
                          </button>
                        )}
                      </section>
                    )
                  })}
                  {libraryTopicDocumentPacks.map(pack => (
                    <section className="library-document-pack" key={pack.id} aria-label={t('已保存的学习资料包', 'Saved study pack')}>
                      <div className="library-document-pack-head">
                        <div><b><Icon name="archive" size={15} />{t('学习资料包', 'Study pack')}</b><p>{t('把同一主题的讲义、公式、术语和速记收在一起；每一份仍可以独立阅读与更新。', 'Keep guides, formulas, terms, and cram notes together while each document remains independently readable and updateable.')}</p></div>
                        <span>{t(`${pack.artifacts.length} 份文档`, `${pack.artifacts.length} documents`)}</span>
                      </div>
                      <button
                        className="library-document-pack-open"
                        type="button"
                        onClick={() => openDocumentPackBooklet({ packId: pack.id, artifacts: pack.artifacts, persisted: true })}
                      >
                        <Icon name="book" size={14} />{t('打开学习资料册', 'Open study booklet')}<ChevronRight size={14} />
                      </button>
                      <div className="library-document-pack-files">
                        {pack.artifacts.map(artifact => (
                          <button type="button" key={artifact.id} onClick={() => openLibraryArtifact(artifact)}>
                            <span>{documentTemplateLabel(artifact)}</span><b>{artifact.title}</b><ChevronRight size={14} />
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                  {libraryTopicPracticePacks.map(pack => (
                    <section className="library-practice-pack" key={pack.id} aria-label={t('已保存的练习资源包', 'Saved practice pack')}>
                      <div className="library-practice-pack-head">
                        <div><b><Icon name="archive" size={15} />{t('练习资源包', 'Practice pack')}</b><p>{t('把六种训练收进同一条复习路线：先巩固，再迁移，最后用模拟、编程和口述完成综合检验。', 'Keep six complementary modes in one review route: reinforce, transfer, then check mastery with mock, coding, and oral practice.')}</p></div>
                        <span>{t(`${pack.artifacts.length} 种训练`, `${pack.artifacts.length} training sets`)}</span>
                      </div>
                      <button className="library-document-pack-open" type="button" onClick={() => openPracticePackBooklet({ packId: pack.id, artifacts: pack.artifacts, persisted: true })}><Icon name="book" size={14} />{t('打开练习资源册', 'Open practice pack')}<ChevronRight size={14} /></button>
                      <div className="library-document-pack-files">
                        {pack.artifacts.map(artifact => <button type="button" key={artifact.id} onClick={() => void openPractice(artifact)}><span>{artifact.practicePackMode ? practiceProfiles[artifact.practicePackMode].label : t('训练', 'Training')}</span><b>{artifact.title}</b><ChevronRight size={14} /></button>)}
                      </div>
                    </section>
                  ))}
                  {libraryTopicStateLoading ? (
                    <section className="library-topic-progress loading" aria-label={t('正在整理主题学习状态', 'Preparing topic learning state')}>
                      <span>{t('正在整理学习进度…', 'Preparing learning progress…')}</span>
                    </section>
                  ) : libraryTopicState ? (
                    <section className="library-topic-progress" aria-label={t('主题学习进度', 'Topic learning progress')}>
                      <div className="library-topic-progress-copy">
                        <b>{t('继续学习', 'Continue learning')}</b>
                        <p>{libraryTopicState.next_step.detail}</p>
                        <div className="library-topic-progress-metrics">
                          <span>{t(`资料 ${libraryTopicState.materials.opened}/${libraryTopicState.materials.total} 已打开`, `${libraryTopicState.materials.opened}/${libraryTopicState.materials.total} materials opened`)}</span>
                          {libraryTopicState.map_progress.total > 0 && <span>{t(`图解 ${libraryTopicState.map_progress.mastered}/${libraryTopicState.map_progress.total} 已理解`, `Map ${libraryTopicState.map_progress.mastered}/${libraryTopicState.map_progress.total} understood`)}</span>}
                          {libraryTopicState.interactive.scenes > 0 && <span>{t(`讲解 ${libraryTopicState.interactive.completed_scenes}/${libraryTopicState.interactive.scenes} 场景已完成`, `Explanation ${libraryTopicState.interactive.completed_scenes}/${libraryTopicState.interactive.scenes} scenes completed`)}</span>}
                          {libraryTopicState.interactive.checks > 0 && <span>{t(`检查 ${libraryTopicState.interactive.confirmed_checks}/${libraryTopicState.interactive.checks} 已答对`, `Checks ${libraryTopicState.interactive.confirmed_checks}/${libraryTopicState.interactive.checks} confirmed`)}</span>}
                          {libraryTopicState.practice.attempt_count > 0 && <span>{t(`最近练习 ${libraryTopicState.practice.recent_score} 分`, `Latest practice ${libraryTopicState.practice.recent_score}/100`)}</span>}
                        </div>
                      </div>
                      {libraryTopicState.next_step.action !== 'complete' && (
                        <button type="button" onClick={() => void continueTopicLearning()}>
                          {topicNextStepLabel(libraryTopicState.next_step.action)}<Icon name="chevron" size={15} />
                        </button>
                      )}
                    </section>
                  ) : null}
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
                    {libraryTopicItems.filter(item => !item.documentPackId && !item.practicePackId).map(item => {
                      const option = artifactOptions.find(entry => entry.kind === item.kind)
                      const mapData = item.kind === 'map' ? parseKnowledgeMap(item.content) : null
                      const mapProgress = mapProgressByArtifactId[item.id]
                      return (
                        <button className="library-row" key={item.id} onClick={() => openLibraryArtifact(item)}>
                          <span className="library-row-icon"><Icon name={option?.icon || 'file'} size={17} /></span>
                          <span className="library-row-copy"><b>{item.title}</b><small>{item.kind === 'notes' ? documentArtifactLabel(item) : option ? artifactLabel(option.kind, option.label) : t('学习资料', 'Learning material')}{item.version > 1 ? ` · v${item.version}` : ''}{mapData ? ` · ${mapProgressLabel(mapData, mapProgress, interfaceLanguage)}` : ''} · {item.summary}</small></span>
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
                                              <button className="library-row library-tree-file" type="button" key={item.id} onClick={() => openLibraryArtifact(item)}>
                                                <span className="library-row-icon"><Icon name={option?.icon || 'file'} size={16} /></span>
                                                <span className="library-row-copy"><b>{item.title}</b><small>{item.kind === 'notes' ? documentArtifactLabel(item) : option ? artifactLabel(option.kind, option.label) : t('学习资料', 'Learning material')}{item.version > 1 ? ` · v${item.version}` : ''}{mapData ? ` · ${mapProgressLabel(mapData, mapProgress, interfaceLanguage)}` : ''} · {item.summary}</small></span>
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
                          <button className="library-row" key={item.id} onClick={() => openLibraryArtifact(item)}>
                            <span className="library-row-icon"><Icon name={libraryMode === 'trash' ? 'trash' : option?.icon || 'file'} size={17} /></span>
                          <span className="library-row-copy"><b>{item.title}</b><small>{libraryMode === 'trash' ? `${item.course} / ${item.topic}${item.deletedAt ? ` · ${formatLibraryDate(item.deletedAt)} ${t('删除', 'deleted')}` : ''}` : `${item.course} / ${item.topic} · ${item.kind === 'notes' ? documentArtifactLabel(item) : option ? artifactLabel(option.kind, option.label) : t('学习资料', 'Learning material')}${item.version > 1 ? ` · v${item.version}` : ''}${mapData ? ` · ${mapProgressLabel(mapData, mapProgress, interfaceLanguage)}` : ''}`}</small></span>
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

      <aside
        className={`learning-guide ${learningGuideOpen ? 'learning-guide-open' : 'learning-guide-closed'}`}
        aria-label={t('学习导航', 'Learning guide')}
        aria-hidden={!learningGuideOpen}
      >
        <div className="learning-guide-inner">
          <header className="learning-guide-head">
            <div>
              <span>{t('学习导航', 'Learning guide')}</span>
              <h2>{learningGuideTopic}</h2>
              <p>{learningGuideCourse}</p>
            </div>
            <button
              className="learning-guide-close icon-button"
              type="button"
              title={t('收起学习导航', 'Hide learning guide')}
              aria-label={t('收起学习导航', 'Hide learning guide')}
              onClick={() => setLearningGuideOpen(false)}
            ><X size={17} strokeWidth={1.8} /></button>
          </header>

          {learningGuideTurn ? (
            <>
              <section className="learning-guide-path" aria-labelledby="learning-guide-path-title">
                <div className="learning-guide-section-head">
                  <span id="learning-guide-path-title">{t('本次学习路径', 'This learning path')}</span>
                  <small>{learningGuideSteps.filter(step => step.complete).length} / {learningGuideSteps.length}</small>
                </div>
                <ol>
                  {learningGuideSteps.map((step, index) => {
                    const StepIcon = step.icon
                    return (
                      <li className={step.complete ? 'guide-step complete' : 'guide-step'} key={step.id}>
                        <button type="button" onClick={step.action}>
                          <span className="guide-step-mark">{step.complete ? <Check size={14} strokeWidth={2.2} /> : <span>{index + 1}</span>}</span>
                          <span className="guide-step-icon"><StepIcon size={16} strokeWidth={1.75} /></span>
                          <span className="guide-step-copy"><b>{step.label}</b><small>{step.detail}</small></span>
                          <ChevronRight className="guide-step-arrow" size={15} strokeWidth={1.7} />
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </section>

              <section className="learning-guide-next" aria-labelledby="learning-guide-next-title">
                <span id="learning-guide-next-title">{t('下一步建议', 'Recommended next step')}</span>
                {nextLearningGuideStep ? (
                  <>
                    <b>{t('先完成', 'Start with ')}{nextLearningGuideStep.label}</b>
                    <p>{nextLearningGuideStep.detail}</p>
                    <button type="button" onClick={nextLearningGuideStep.action}>
                      <Sparkles size={15} strokeWidth={1.8} />{t('开始这一步', 'Start this step')}
                    </button>
                  </>
                ) : (
                  <>
                    <b>{t('本次学习闭环已经就绪', 'This learning loop is ready')}</b>
                    <p>{t('现在适合回看图解，或再做一轮练习检验。', 'Review the map or take another practice check when ready.')}</p>
                  </>
                )}
              </section>
            </>
          ) : (
            <section className="learning-guide-empty">
              <span><Sparkles size={18} strokeWidth={1.8} /></span>
              <b>{t('从一个问题开始', 'Start with one question')}</b>
              <p>{t('对话开始后，我会根据课程和主题推荐下一步。', 'Once you start, I will recommend the next learning step.')}</p>
              <button type="button" onClick={newChat}><PenLine size={15} strokeWidth={1.8} />{t('新学习对话', 'New learning chat')}</button>
            </section>
          )}
        </div>
      </aside>

      {practiceRun && activePracticeQuestion && (
        <section className="practice-workspace" role="dialog" aria-modal="true" aria-labelledby="practice-title">
            <header className="practice-head">
              <button className="practice-exit" type="button" title="返回上一级（Esc）" onClick={exitPracticeWorkspace}>
                <ArrowLeft size={16} />退出练习
              </button>
              <div className="practice-head-copy">
                <span>{practiceRun.artifact.course} / {practiceRun.artifact.topic}</span>
                <h2 id="practice-title">{practiceRun.result ? '练习结果' : practiceRun.artifact.title}</h2>
                <small>{practiceRun.attempts.length > 0
                  ? `已完成 ${practiceRun.attempts.length} 次训练`
                  : `${practiceProfiles[practiceRun.practice.practice_mode].label} · ${practiceRun.practice.question_count} 项 · 约 ${practiceRun.practice.estimated_minutes} 分钟${practiceRun.practice.practice_mode === 'mock' ? ' · 限时作答' : ''}`}</small>
              </div>
              {!practiceRun.result && (
                <div className="practice-head-progress" aria-label={`当前第 ${practiceRun.activeIndex + 1} 题，共 ${practiceRun.practice.questions.length} 题`}>
                  <span>第 {practiceRun.activeIndex + 1} / {practiceRun.practice.questions.length} 题</span>
                  <i><b style={{ transform: `scaleX(${(practiceRun.activeIndex + 1) / practiceRun.practice.questions.length})` }} /></i>
                </div>
              )}
              <button className="icon-button" type="button" aria-label="返回上一级" onClick={exitPracticeWorkspace}><Icon name="x" size={18} /></button>
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
                          {question.type === 'oral_response' && question.follow_up && <small className="practice-follow-up">追问：{question.follow_up}</small>}
                        </div>
                      </article>
                    )
                  })}
                </div>

                {practiceRun.result.weak_points.length > 0 && (
                  <section className="practice-recovery" aria-label="错题复盘下一步">
                    <div><b>本轮错题复盘</b><p>先围绕薄弱点补一轮，再回到当前训练验证是否真的掌握。</p></div>
                    <div className="practice-recovery-points">{practiceRun.result.weak_points.map(point => <span key={point}>{point}</span>)}</div>
                    <div className="practice-recovery-actions">
                      {practiceRun.artifact.sourceMapArtifactId && (
                        <button type="button" onClick={() => {
                          const sourceMap = mapArtifacts.find(item => item.backendId === practiceRun.artifact.sourceMapArtifactId)
                          if (sourceMap) {
                            setPracticeRun(null)
                            openMapWorkspace(sourceMap, 'chat')
                          } else setNotice('还没有找到对应的知识图解，可以先生成专项训练。')
                        }}><Icon name="map" size={15} />回看知识图解</button>
                      )}
                      <button type="button" onClick={() => {
                        const artifact = practiceRun.artifact
                        const points = practiceRun.result?.weak_points || []
                        setPracticeRun(null)
                        void runPracticeGeneration(artifact.qaId || '', artifact.sourceMapArtifactId, 'similar', points)
                      }}><Icon name="file-question" size={15} />生成同类题</button>
                      <button className="primary" type="button" onClick={() => {
                        const artifact = practiceRun.artifact
                        const points = practiceRun.result?.weak_points || []
                        setPracticeRun(null)
                        void runPracticeGeneration(artifact.qaId || '', artifact.sourceMapArtifactId, 'special', points)
                      }}><Icon name="clipboard" size={15} />针对薄弱点训练</button>
                    </div>
                  </section>
                )}

                <footer className="practice-result-actions">
                  <button type="button" onClick={restartPractice}><Icon name="restore" size={16} />再做一次</button>
                  {practiceRun.artifact.practicePackId && (
                    <button type="button" onClick={() => {
                      const packId = practiceRun.artifact.practicePackId!
                      const currentIndex = practiceSetupModes.indexOf(practiceRun.artifact.practicePackMode || 'similar')
                      const nextMode = practiceSetupModes[(currentIndex + 1) % practiceSetupModes.length]
                      const nextArtifact = [...turns.flatMap(turn => turn.artifacts), ...libraryItems].find(item => item.practicePackId === packId && item.practicePackMode === nextMode)
                      setPracticeRun(null)
                      if (nextArtifact) {
                        setPracticePackBookletActiveId(nextArtifact.id)
                        openPracticePackBooklet({ packId, artifacts: [...turns.flatMap(turn => turn.artifacts), ...libraryItems].filter(item => item.practicePackId === packId), persisted: Boolean(nextArtifact.saved) })
                      }
                    }}><Icon name="book" size={16} />回到资源册</button>
                  )}
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
              <>
                <div className={`practice-workspace-shell${practiceIndexCollapsed ? ' index-collapsed' : ''}`}>
                  <aside className="practice-workspace-index" aria-label="题目导航">
                    <button
                      className="practice-index-toggle"
                      type="button"
                      aria-label={practiceIndexCollapsed ? '展开题目导航' : '收起题目导航'}
                      aria-expanded={!practiceIndexCollapsed}
                      title={practiceIndexCollapsed ? '展开题目导航' : '收起题目导航'}
                      onClick={() => setPracticeIndexCollapsed(current => !current)}
                    >
                      <Icon name="menu" size={16} /><span>{practiceIndexCollapsed ? '展开题目' : '收起题目'}</span>
                    </button>
                    <div className="practice-index-summary">
                      <span>完成进度</span>
                      <b>{practiceAnsweredCount}<small> / {practiceRun.practice.questions.length}</small></b>
                    </div>
                    {practiceRun.practice.practice_mode === 'mock' && <b className={`practice-timer ${(practiceRun.remainingSeconds || 0) <= 60 ? 'urgent' : ''}`}>剩余 {Math.floor((practiceRun.remainingSeconds || 0) / 60)}:{String((practiceRun.remainingSeconds || 0) % 60).padStart(2, '0')}</b>}
                    <nav>{practiceRun.practice.questions.map((question, index) => (
                      <button
                        key={question.id}
                        type="button"
                        aria-label={`第 ${index + 1} 题${practiceRun.answers[question.id]?.trim() ? '，已作答' : ''}`}
                        aria-current={index === practiceRun.activeIndex ? 'step' : undefined}
                        className={`${index === practiceRun.activeIndex ? 'active' : ''} ${practiceRun.answers[question.id]?.trim() ? 'answered' : ''}`}
                        onClick={() => setPracticeRun(current => current ? { ...current, activeIndex: index } : current)}
                      ><span>{index + 1}</span><b>第 {index + 1} 题</b>{practiceRun.answers[question.id]?.trim() && <Icon name="check" size={13} />}</button>
                    ))}</nav>
                  </aside>

                  <main className="practice-workspace-main">
                    <article className="practice-question">
                  <div className="practice-question-meta"><span>{activePracticeQuestion.type === 'fill_blank' ? '短填空' : activePracticeQuestion.type === 'true_false' ? '判断题' : activePracticeQuestion.type === 'code_task' ? '编程实验' : activePracticeQuestion.type === 'oral_response' ? '口述回答' : '单选题'}</span><b>{activePracticeQuestion.knowledge_point}</b></div>
                  <h3>{activePracticeQuestion.prompt}</h3>
                  {activePracticeQuestion.type === 'code_task' ? (
                    <div className="practice-code-task">
                      <div className="practice-code-head"><span>{activePracticeQuestion.language || 'code'}</span><small>请在本地或课程环境中运行，网页不会代替你执行代码。</small></div>
                      <textarea
                        aria-label="你的代码草稿"
                        value={practiceRun.codeDrafts[activePracticeQuestion.id] || ''}
                        onChange={event => updatePracticeCode(activePracticeQuestion.id, event.target.value)}
                        spellCheck={false}
                      />
                      {(activePracticeQuestion.hints || []).length > 0 && <details className="practice-hints"><summary>逐步提示</summary><ol>{activePracticeQuestion.hints?.map(hint => <li key={hint}>{hint}</li>)}</ol></details>}
                      <section className="practice-tests" aria-label="测试用例">
                        <b>本地测试确认</b>
                        {(activePracticeQuestion.tests || []).map(test => {
                          const checked = (practiceRun.codeTestChecks[activePracticeQuestion.id] || []).includes(test.label)
                          return <label key={test.label}>
                            <input type="checkbox" checked={checked} onChange={() => togglePracticeTest(activePracticeQuestion.id, test.label)} />
                            <span><strong>{test.label}</strong>{test.input && <small>输入：{test.input}</small>}<small>期望：{test.expected_output}</small></span>
                          </label>
                        })}
                      </section>
                      <button className="practice-code-confirm" type="button" onClick={() => confirmCodingTask(activePracticeQuestion.id, activePracticeQuestion.tests?.length || 0)}>
                        <Icon name="check" size={15} />{practiceRun.answers[activePracticeQuestion.id] ? '已确认本地通过' : '我已在本地通过全部测试'}
                      </button>
                    </div>
                  ) : activePracticeQuestion.type === 'oral_response' ? (
                    <div className="practice-oral-task">
                      <div className="practice-oral-actions">
                        <button type="button" className={practiceRun.oralRecordingQuestionId === activePracticeQuestion.id ? 'recording' : ''} onClick={() => void toggleOralRecording(activePracticeQuestion.id)}>
                          <Icon name="mic" size={16} />{practiceRun.oralRecordingQuestionId === activePracticeQuestion.id ? '结束并转写' : '开始口述'}
                        </button>
                        <small>也可以直接输入。提交后按关键词反馈表达是否完整。</small>
                      </div>
                      <label className="practice-oral-input"><span>你的口述内容</span><textarea value={practiceRun.answers[activePracticeQuestion.id] || ''} onChange={event => answerPracticeQuestion(activePracticeQuestion.id, event.target.value)} placeholder="用自己的话解释原因、条件和过程…" /></label>
                      {(activePracticeQuestion.target_keywords || []).length > 0 && <p className="practice-keyword-note">本题会关注：{activePracticeQuestion.target_keywords?.join('、')}</p>}
                    </div>
                  ) : activePracticeQuestion.type === 'fill_blank' ? (
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
                  </main>

                  <aside className="practice-workspace-context" aria-label="本题信息">
                    <span>本题目标</span>
                    <h3>{activePracticeQuestion.knowledge_point}</h3>
                    <p>{activePracticeQuestion.type === 'code_task'
                      ? '完成代码并确认测试结果，重点检查边界条件。'
                      : activePracticeQuestion.type === 'oral_response'
                        ? '用自己的语言说清原因、条件与过程。'
                        : '先独立判断，再选择最符合题意的答案。'}</p>
                    <div><span>训练模式</span><b>{practiceProfiles[practiceRun.practice.practice_mode].label}</b></div>
                    <small>切换题目不会丢失已经填写的答案。</small>
                  </aside>
                </div>

                <footer className="practice-actions">
                  <span className="practice-actions-status">已作答 {practiceAnsweredCount} / {practiceRun.practice.questions.length}</span>
                  <button type="button" disabled={practiceRun.activeIndex === 0} onClick={() => setPracticeRun(current => current ? { ...current, activeIndex: current.activeIndex - 1 } : current)}>上一题</button>
                  {practiceRun.activeIndex < practiceRun.practice.questions.length - 1 ? (
                    <button className="primary" type="button" onClick={() => setPracticeRun(current => current ? { ...current, activeIndex: current.activeIndex + 1 } : current)}>下一题<Icon name="chevron" size={15} /></button>
                  ) : (
                    <button className="primary" type="button" disabled={practiceSubmitting} onClick={() => void submitPractice()}><Icon name="check" size={15} />{practiceSubmitting ? '批改中…' : practiceRun.practice.practice_mode === 'mock' ? '交卷并批改' : '提交练习'}</button>
                  )}
                </footer>
              </>
            )}
        </section>
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

      {(saveTarget || learningLoopSaveTarget || documentPackSaveTarget || practicePackSaveTarget || externalVideoSaveTarget) && (
        <div className="sheet-layer">
          <button className="sheet-backdrop" aria-label="取消保存" onClick={closeSave} />
          <aside className="save-sheet" role="dialog" aria-modal="true" aria-labelledby="save-title">
            <div className="sheet-head">
              <div>
                <h2 id="save-title">{learningLoopSaveTarget ? '保存整套学习资料' : documentPackSaveTarget ? '保存学习资料包' : practicePackSaveTarget ? '保存练习资源包' : externalVideoSaveTarget ? '收藏课程视频' : saveMode === 'edit' ? '整理资料' : '保存到资料库'}</h2>
                <p>{learningLoopSaveTarget
                  ? `会将 ${learningLoopSaveTarget.artifacts.length} 份资料归到同一课程和主题，并保留它们的学习关联。`
                  : documentPackSaveTarget
                    ? `会将 ${documentPackSaveTarget.artifacts.length} 份文档归到同一课程和主题，保持为一组可独立阅读的资料。`
                    : practicePackSaveTarget
                      ? `会将 6 种训练归到同一课程和主题，保留每组练习记录，并作为一份连续的练习资源册打开。`
                  : externalVideoSaveTarget
                    ? '保存的是原视频链接，不下载、不搬运视频内容。'
                    : saveMode === 'edit' ? '名称和归属可以随时调整。' : '智能体已经根据当前学习内容推荐位置。'}</p>
              </div>
              <button className="icon-button" aria-label="取消保存" onClick={closeSave}><Icon name="x" size={18} /></button>
            </div>
            {learningLoopSaveTarget ? (
              <section className="save-learning-loop-summary" aria-label="将保存的学习资料">
                {learningLoopSteps.map(step => {
                  const artifact = learningLoopSaveTarget.artifacts.find(item => item.learningLoopStep === step.kind)
                  return artifact ? <span key={step.kind}><Icon name="check" size={13} />{step.label}</span> : null
                })}
              </section>
            ) : documentPackSaveTarget ? (
              <section className="save-document-pack-summary" aria-label="将保存的学习资料包">
                <span><Icon name="archive" size={16} />{documentPackSaveTarget.artifacts.length} 份学习文档</span>
                <div>{documentPackSaveTarget.artifacts.map(artifact => <small key={artifact.id}>{documentTemplateById[artifact.documentPackTemplate || artifact.documentTemplate || 'system_guide'].label}</small>)}</div>
              </section>
            ) : practicePackSaveTarget ? (
              <section className="save-document-pack-summary" aria-label="将保存的练习资源包">
                <span><Icon name="archive" size={16} />6 种练习训练</span>
                <div>{practicePackSaveTarget.artifacts.map(artifact => <small key={artifact.id}>{artifact.practicePackMode ? practiceProfiles[artifact.practicePackMode].label : '训练'}</small>)}</div>
              </section>
            ) : externalVideoSaveTarget ? (
              <section className="save-external-video-summary" aria-label="将收藏的课程视频">
                <span><Icon name="video" size={17} />B站课程视频</span>
                <b>{externalVideoSaveTarget.video.title}</b>
                <small>{[externalVideoSaveTarget.video.creator && `UP 主：${externalVideoSaveTarget.video.creator}`, externalVideoSaveTarget.video.duration].filter(Boolean).join(' · ') || '打开后将在 B站 原页面观看'}</small>
              </section>
            ) : (
              <><label className="field-label" htmlFor="artifact-title">资料名称</label>
              <input id="artifact-title" className="text-field" value={saveTitle} onChange={event => { setSaveTitle(event.target.value); resetDuplicateDecision() }} /></>
            )}
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
            {!learningLoopSaveTarget && !documentPackSaveTarget && !practicePackSaveTarget && !externalVideoSaveTarget && saveMode === 'save' && duplicateMatches.length > 0 && (
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
            {learningLoopSaveTarget ? (
              <div className="save-source"><Icon name="paperclip" size={15} /><span>来源</span><b>当前学习对话</b></div>
            ) : documentPackSaveTarget ? (
              <div className="save-source"><Icon name="paperclip" size={15} /><span>来源</span><b>当前学习对话</b></div>
            ) : practicePackSaveTarget ? (
              <div className="save-source"><Icon name="paperclip" size={15} /><span>来源</span><b>当前学习对话</b></div>
            ) : externalVideoSaveTarget ? (
              <div className="save-source"><Icon name="video" size={15} /><span>来源</span><b>B站公开视频索引</b></div>
            ) : saveTarget && <div className="save-source"><Icon name="paperclip" size={15} /><span>来源</span><b>{saveTarget.source}</b></div>}
            <div className="sheet-actions">
              <button type="button" onClick={closeSave}>取消</button>
              <button type="button" className="primary" onClick={() => void confirmSave()} disabled={(!learningLoopSaveTarget && !documentPackSaveTarget && !practicePackSaveTarget && !externalVideoSaveTarget && !saveTitle.trim()) || !saveCourse.trim() || !saveTopic.trim() || saveBusy}><Icon name="save" size={16} />{saveBusy ? (externalVideoSaveTarget ? '收藏中…' : learningLoopSaveTarget || documentPackSaveTarget || practicePackSaveTarget ? '保存中…' : duplicateCheckComplete ? '保存中…' : '检查中…') : externalVideoSaveTarget ? '确认收藏到资料库' : learningLoopSaveTarget ? '确认保存整套资料' : documentPackSaveTarget ? '确认保存学习资料包' : practicePackSaveTarget ? '确认保存练习资源包' : saveMode === 'edit' ? '保存调整' : duplicateMatches.length > 0 ? '按选择保存' : '确认保存'}</button>
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

      {backgroundTasksOpen && (
        <div className="background-task-popover-layer">
          <button className="background-task-popover-backdrop" type="button" aria-label={t('关闭后台任务', 'Close background tasks')} onClick={() => setBackgroundTasksOpen(false)} />
          <aside className="background-task-popover" role="dialog" aria-label={t('后台任务', 'Background tasks')}>
            <header>
              <div>
                <h2>{t('后台任务', 'Background tasks')}</h2>
                <p>{backgroundRunningTaskCount
                  ? t('任务会继续运行，你可以正常使用其他功能。', 'Tasks keep running while you use the rest of RHYME.')
                  : backgroundAttentionTaskCount
                    ? t('部分任务需要重试，已经完成的内容不会丢失。', 'Some tasks need a retry. Finished work is preserved.')
                    : t('耗时较长的生成任务会集中显示在这里。', 'Long-running generation tasks appear here.')}</p>
              </div>
              <button type="button" aria-label={t('关闭后台任务', 'Close background tasks')} onClick={() => setBackgroundTasksOpen(false)}><Icon name="x" size={16} /></button>
            </header>

            {backgroundGenerationTaskViews.length === 0 && backgroundMapTasks.length === 0 && backgroundDynamicTasks.length === 0 ? (
              <div className="background-task-empty">
                <ListChecks size={20} strokeWidth={1.7} />
                <b>{t('暂无后台任务', 'No background tasks')}</b>
                <span>{t('学习文档、练习、图解、动态讲解和课程视频都会集中显示在这里。', 'Documents, practice, maps, dynamic lessons, and course videos appear here.')}</span>
              </div>
            ) : (
              <div className="background-task-list">
                {backgroundGenerationTaskViews.map(task => {
                  const title = task.artifact?.title || task.task.title
                  const progress = task.task.progress
                  const hasProgress = typeof progress?.percent === 'number'
                  const completeDescription = task.task.kind === 'video'
                    ? task.task.videoResultCount
                      ? t(`已整理 ${task.task.videoResultCount} 个课程视频，点击即可查看。`, `${task.task.videoResultCount} course videos are ready. Open to view them.`)
                      : t('检索已经完成，可查看结果或更换关键词再次检索。', 'Search is complete. View the result or try a different query.')
                    : t('内容已经回到原对话，点击即可直接打开。', 'The result is back in the original conversation. Open it directly.')
                  return (
                    <article className={`background-task-item ${task.task.kind} ${task.running ? 'running' : task.failed ? 'failed' : 'complete'}`} key={task.task.loadingId}>
                      <div className="background-task-item-status" aria-hidden="true">
                        {task.running ? <RotateCcw size={15} /> : task.failed ? <X size={15} /> : <Check size={15} />}
                      </div>
                      <button className="background-task-item-main" type="button" onClick={() => openBackgroundGenerationTask(task.task)}>
                        <span>
                          <b>{title}</b>
                          <small>{backgroundGenerationTaskLabel(task.task.kind)} · {task.task.course} / {task.task.topic}</small>
                        </span>
                        <em>{task.running
                          ? progress?.label || t('后台生成中', 'Generating')
                          : task.failed
                            ? t('需要重试', 'Retry needed')
                            : t('已完成', 'Complete')}</em>
                      </button>
                      <div className={`background-task-progress${task.running && !hasProgress ? ' indeterminate' : ''}`} aria-label={task.running ? progress?.label || t('任务正在后台生成', 'Task is generating in the background') : task.complete ? t('任务已完成', 'Task is complete') : t('任务生成失败', 'Task failed')}>
                        <span style={{ width: task.failed ? '0%' : task.complete ? '100%' : hasProgress ? `${progress?.percent}%` : '10%' }} />
                      </div>
                      <p>{task.running
                        ? progress?.message || t('任务会继续运行，你可以关闭面板继续使用其他功能。', 'The task keeps running. Close this panel and keep using other features.')
                        : task.failed
                          ? task.task.error || task.artifact?.summary || t('原始学习内容已保留，可立即重试。', 'Your original study content is preserved. Retry now.')
                          : completeDescription}</p>
                      <div className="background-task-item-actions">
                        <button type="button" onClick={() => openBackgroundGenerationTask(task.task)}>{task.running ? t('查看生成位置', 'View position') : task.failed ? t('查看详情', 'View details') : backgroundGenerationTaskAction(task.task.kind)}</button>
                        {task.failed && task.task.retryable !== false && (
                          <button className="primary" type="button" onClick={() => retryBackgroundGenerationTask(task.task)}>{t('立即重试', 'Retry now')}</button>
                        )}
                        {!task.running && (
                          <button className="dismiss" type="button" aria-label={t('从任务列表移除', 'Remove from task list')} onClick={() => dismissBackgroundGenerationTask(task.task.loadingId)}><Icon name="x" size={13} /></button>
                        )}
                      </div>
                    </article>
                  )
                })}
                {backgroundDynamicTasks.map(task => (
                  <article className={`background-task-item dynamic ${task.running ? 'running' : task.failed ? 'failed' : 'complete'}`} key={task.artifact.id}>
                    <div className="background-task-item-status" aria-hidden="true">
                      {task.running ? <RotateCcw size={15} /> : task.failed ? <X size={15} /> : <Check size={15} />}
                    </div>
                    <button className="background-task-item-main" type="button" onClick={() => openBackgroundDynamicTask(task.artifact)}>
                      <span>
                        <b>{task.artifact.title}</b>
                        <small>{t('动态讲解', 'Dynamic lesson')} · {task.artifact.course} / {task.artifact.topic}</small>
                      </span>
                      <em>{task.running
                        ? task.artifact.generationProgress?.label || t('后台生成中', 'Generating')
                        : task.failed
                          ? t('需要重试', 'Retry needed')
                          : t('已完成', 'Complete')}</em>
                    </button>
                    <div className={`background-task-progress${task.running && typeof task.artifact.generationProgress?.percent !== 'number' ? ' indeterminate' : ''}`} aria-label={task.running ? task.artifact.generationProgress?.label || t('动态讲解正在生成', 'Dynamic lesson is generating') : task.complete ? t('动态讲解已生成', 'Dynamic lesson is ready') : t('动态讲解生成失败', 'Dynamic lesson generation failed')}>
                      <span style={{ width: task.failed ? '0%' : task.running ? `${task.artifact.generationProgress?.percent || 6}%` : '100%' }} />
                    </div>
                    <p>{task.running
                      ? task.artifact.generationProgress?.message || t('正在编排场景、动画和理解检查。你可以关闭面板继续使用其他功能。', 'Building scenes, motion, and understanding checks. You may close this panel and keep working.')
                      : task.failed
                        ? task.artifact.summary
                        : t('动态讲解已经回到原对话，点击下方按钮即可定位并开始学习。', 'The dynamic lesson is ready in its original conversation. Open it to begin.')}</p>
                    <div className="background-task-item-actions">
                      <button type="button" onClick={() => openBackgroundDynamicTask(task.artifact)}>{task.running ? t('查看生成位置', 'View position') : task.failed ? t('查看并重试', 'View and retry') : t('打开动态讲解', 'Open lesson')}</button>
                      {!task.running && (
                        <button className="dismiss" type="button" aria-label={t('从任务列表移除', 'Remove from task list')} onClick={() => dismissBackgroundDynamicTask(task.artifact)}><Icon name="x" size={13} /></button>
                      )}
                    </div>
                  </article>
                ))}
                {backgroundMapTasks.map(task => {
                  const state = task.running ? 'running' : task.complete ? 'complete' : 'failed'
                  const currentLabels = task.job.current_labels?.filter(Boolean).slice(0, 2) || []
                  return (
                    <article className={`background-task-item ${state}`} key={task.artifact.id}>
                      <div className="background-task-item-status" aria-hidden="true">
                        {task.running ? <RotateCcw size={15} /> : task.complete ? <Check size={15} /> : <X size={15} />}
                      </div>
                      <button className="background-task-item-main" type="button" onClick={() => openBackgroundTask(task.artifact)}>
                        <span>
                          <b>{task.artifact.title}</b>
                          <small>{t('知识图解补全', 'Knowledge map package')} · {task.artifact.course} / {task.artifact.topic}</small>
                        </span>
                        <em>{task.running
                          ? t(`${task.ready}/${task.total} 生成中`, `${task.ready}/${task.total} generating`)
                          : task.complete
                            ? t(`${task.total}/${task.total} 已完成`, `${task.total}/${task.total} complete`)
                            : t(`剩余 ${task.remaining} 张`, `${task.remaining} remaining`)}</em>
                      </button>
                      <div className="background-task-progress" aria-label={t(`完成 ${task.ready}/${task.total}`, `${task.ready}/${task.total} complete`)}>
                        <span style={{ width: `${task.total ? Math.min(100, task.ready / task.total * 100) : 0}%` }} />
                      </div>
                      <p>{task.running
                        ? currentLabels.length
                          ? t(`正在生成：${currentLabels.join('、')}`, `Generating: ${currentLabels.join(', ')}`)
                          : t('正在安排下一张专题图…', 'Preparing the next deep map…')
                        : task.complete
                          ? t('整套专题图已经保存，可以继续从任意节点展开学习。', 'The complete package is saved and ready to explore.')
                          : task.job.error || t('部分专题图暂时没有完成，可以只重试剩余内容。', 'Some deep maps did not finish. Retry only the remaining work.')}</p>
                      <div className="background-task-item-actions">
                        <button type="button" onClick={() => openBackgroundTask(task.artifact)}>{t('打开图解', 'Open map')}</button>
                        {!task.running && !task.complete && (
                          <button className="primary" type="button" onClick={() => void startMapPackGeneration(task.artifact)}>{t('重试剩余', 'Retry remaining')}</button>
                        )}
                        {!task.running && (
                          <button className="dismiss" type="button" aria-label={t('从任务列表移除', 'Remove from task list')} onClick={() => dismissBackgroundTask(task.artifact)}><Icon name="x" size={13} /></button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </aside>
        </div>
      )}

      {settingsOpen && (
        <div className="settings-popover-layer">
          <button className="settings-popover-backdrop" aria-label={t('关闭界面设置', 'Close interface settings')} onClick={closeSettings} />
          <aside className={`settings-popover${settingsView === 'theme' ? ' settings-popover-theme' : ''}`} role="dialog" aria-modal="true" aria-label={t('界面设置', 'Interface settings')}>
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
                        ? t('20 套结构、字体与材质都不同的界面，默认是白底黑字。', '20 interface worlds with distinct structure, type, and material. Minimal stays the default.')
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

      {documentPackBooklet && documentPackBookletDocuments.length > 0 && (
        <LearningDocumentBooklet
          course={documentPackBooklet.course}
          topic={documentPackBooklet.topic}
          documents={documentPackBookletDocuments}
          activeDocumentId={documentPackBookletActiveId}
          language={interfaceLanguage}
          persisted={documentPackBooklet.persisted}
          onClose={closeDocumentPackBooklet}
          onSelect={setDocumentPackBookletActiveId}
          onSave={documentPackBooklet.persisted ? undefined : () => {
            const turn = documentPackBooklet.turnId
              ? turns.find(item => item.id === documentPackBooklet.turnId)
              : undefined
            if (!turn) return
            closeDocumentPackBooklet()
            openDocumentPackSave({ ...turn, artifacts: resolvedPackArtifacts(turn) }, documentPackBooklet.packId)
          }}
          onOpenLibrary={documentPackBooklet.persisted ? () => {
            closeDocumentPackBooklet()
            setLibraryPreviewId(null)
            setLibraryTopic({ course: documentPackBooklet.course, topic: documentPackBooklet.topic })
            setView('library')
          } : undefined}
        />
      )}

      {practicePackBooklet && practicePackBookletEntries.length > 0 && (
        <PracticePackBooklet
          course={practicePackBooklet.course}
          topic={practicePackBooklet.topic}
          entries={practicePackBookletEntries.map(entry => ({ ...entry, completedAttempts: practiceAttemptCounts[entry.id] || 0 }))}
          activeEntryId={practicePackBookletActiveId}
          language={interfaceLanguage}
          persisted={practicePackBooklet.persisted}
          onClose={closePracticePackBooklet}
          onSelect={setPracticePackBookletActiveId}
          onStart={(artifactId) => {
            const returnBooklet = practicePackBooklet
            const artifact = [
              ...returnBooklet.artifacts,
              ...turns.flatMap(turn => turn.artifacts),
              ...libraryItems,
            ].find(item => item.id === artifactId)
            if (artifact) {
              closePracticePackBooklet()
              void openPractice(artifact, returnBooklet)
            }
          }}
          onRetry={practicePackBooklet.persisted ? undefined : (artifactId) => {
            void retryPracticePackEntry(practicePackBooklet.packId, artifactId)
          }}
          onSave={practicePackBooklet.persisted ? undefined : () => {
            const turn = practicePackBooklet.turnId ? turns.find(item => item.id === practicePackBooklet.turnId) : undefined
            if (!turn) return
            closePracticePackBooklet()
            openPracticePackSave({ ...turn, artifacts: resolvedPackArtifacts(turn) }, practicePackBooklet.packId)
          }}
          onOpenLibrary={practicePackBooklet.persisted ? () => {
            closePracticePackBooklet()
            setLibraryPreviewId(null)
            setLibraryTopic({ course: practicePackBooklet.course, topic: practicePackBooklet.topic })
            setView('library')
          } : undefined}
        />
      )}

      {learningHouseOpen && (
        <Suspense fallback={<div className="learning-house-loading" role="status"><Sparkles size={20} />{t('正在打开 3D 学习屋…', 'Opening 3D learning house…')}</div>}>
          <LearningHouse language={interfaceLanguage} onExit={() => setLearningHouseOpen(false)} />
        </Suspense>
      )}

      {foregroundBackgroundGenerationTask && !backgroundTasksOpen && (
        <aside
          className={`dynamic-task-dock${foregroundBackgroundGenerationTask.running ? ' running' : foregroundBackgroundGenerationTask.failed ? ' failed' : ' complete'}${foregroundBackgroundGenerationTask.running && typeof foregroundBackgroundGenerationTask.task.progress?.percent === 'number' ? ' has-progress' : ''}`}
          aria-label={backgroundGenerationTaskLabel(foregroundBackgroundGenerationTask.task.kind)}
          style={{ '--task-progress': Math.max(0, Math.min(1, (foregroundBackgroundGenerationTask.task.progress?.percent || 0) / 100)) } as CSSProperties}
        >
          <span className="dynamic-task-dock-icon" aria-hidden="true">
            {foregroundBackgroundGenerationTask.running ? <RotateCcw size={16} /> : foregroundBackgroundGenerationTask.failed ? <X size={16} /> : <Check size={16} />}
          </span>
          <div>
            <b>{foregroundBackgroundGenerationTask.running
              ? foregroundBackgroundGenerationTask.task.progress?.label || t(`${backgroundGenerationTaskLabel(foregroundBackgroundGenerationTask.task.kind)}正在后台生成`, `${backgroundGenerationTaskLabel(foregroundBackgroundGenerationTask.task.kind)} is generating`)
              : foregroundBackgroundGenerationTask.failed
                ? t(`${backgroundGenerationTaskLabel(foregroundBackgroundGenerationTask.task.kind)}生成失败`, `${backgroundGenerationTaskLabel(foregroundBackgroundGenerationTask.task.kind)} failed`)
                : t(`${backgroundGenerationTaskLabel(foregroundBackgroundGenerationTask.task.kind)}已经完成`, `${backgroundGenerationTaskLabel(foregroundBackgroundGenerationTask.task.kind)} is ready`)}</b>
            <span>{foregroundBackgroundGenerationTask.running
              ? foregroundBackgroundGenerationTask.task.progress?.message || foregroundBackgroundGenerationTask.task.title
              : foregroundBackgroundGenerationTask.artifact?.title || foregroundBackgroundGenerationTask.task.title}</span>
          </div>
          <button className="dynamic-task-dock-action" type="button" onClick={() => foregroundBackgroundGenerationTask.failed ? retryBackgroundGenerationTask(foregroundBackgroundGenerationTask.task) : openBackgroundGenerationTask(foregroundBackgroundGenerationTask.task)}>
            {foregroundBackgroundGenerationTask.running
              ? t('查看进度', 'View progress')
              : foregroundBackgroundGenerationTask.failed
                ? t('立即重试', 'Retry now')
                : backgroundGenerationTaskAction(foregroundBackgroundGenerationTask.task.kind)}
          </button>
          {!foregroundBackgroundGenerationTask.running && (
            <button className="dynamic-task-dock-dismiss" type="button" aria-label={t('关闭任务提醒', 'Dismiss task reminder')} onClick={() => dismissBackgroundGenerationTask(foregroundBackgroundGenerationTask.task.loadingId)}><Icon name="x" size={13} /></button>
          )}
          {foregroundBackgroundGenerationTask.running && <i aria-hidden="true"><span /></i>}
        </aside>
      )}

      {foregroundDynamicTask && !foregroundBackgroundGenerationTask && !backgroundTasksOpen && (
        <aside
          className={`dynamic-task-dock${foregroundDynamicTask.running ? ' running' : foregroundDynamicTask.failed ? ' failed' : ' complete'}${foregroundDynamicTask.running && typeof foregroundDynamicTask.artifact.generationProgress?.percent === 'number' ? ' has-progress' : ''}`}
          aria-label={t('动态讲解任务', 'Dynamic lesson task')}
          style={{ '--task-progress': Math.max(0, Math.min(1, (foregroundDynamicTask.artifact.generationProgress?.percent || 0) / 100)) } as CSSProperties}
        >
          <span className="dynamic-task-dock-icon" aria-hidden="true">
            {foregroundDynamicTask.running ? <RotateCcw size={16} /> : foregroundDynamicTask.failed ? <X size={16} /> : <Check size={16} />}
          </span>
          <div>
            <b>{foregroundDynamicTask.running
              ? foregroundDynamicTask.artifact.generationProgress?.label || t('动态讲解正在后台生成', 'Dynamic lesson is generating')
              : foregroundDynamicTask.failed
                ? t('动态讲解生成失败', 'Dynamic lesson failed')
                : t('动态讲解已经完成', 'Dynamic lesson is ready')}</b>
            <span>{foregroundDynamicTask.running ? foregroundDynamicTask.artifact.generationProgress?.message || foregroundDynamicTask.artifact.title : foregroundDynamicTask.artifact.title}</span>
          </div>
          <button className="dynamic-task-dock-action" type="button" onClick={() => openBackgroundDynamicTask(foregroundDynamicTask.artifact)}>
            {foregroundDynamicTask.running ? t('查看进度', 'View progress') : foregroundDynamicTask.failed ? t('查看并重试', 'View and retry') : t('立即进入', 'Open now')}
          </button>
          {!foregroundDynamicTask.running && (
            <button className="dynamic-task-dock-dismiss" type="button" aria-label={t('关闭任务提醒', 'Dismiss task reminder')} onClick={() => dismissBackgroundDynamicTask(foregroundDynamicTask.artifact)}><Icon name="x" size={13} /></button>
          )}
          {foregroundDynamicTask.running && <i aria-hidden="true"><span /></i>}
        </aside>
      )}

      {notice && (
        <div className="feedback-toast" role="status" aria-live="polite">
          <Icon name="check" size={15} />
          <span>{notice}</span>
          {notice.startsWith('动态讲解已生成') && foregroundDynamicTask?.complete && (
            <button className="toast-action" type="button" onClick={() => openBackgroundDynamicTask(foregroundDynamicTask.artifact)}>立即打开</button>
          )}
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
