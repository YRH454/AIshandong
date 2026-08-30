import type { DynamicExplanationCheckpoint, DynamicExplanationData, DynamicExplanationScene } from '../components/dynamicExplanation'
import type { KnowledgeMapDeepDive } from '../components/EditableKnowledgeMap'

// RHYME — API 封装（后端精简版）
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api/v1'

/** All application calls use the HttpOnly session cookie by default. */
async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const response = await fetch(input, { ...init, credentials: init.credentials ?? 'include' })
  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rhyme-auth-expired'))
  }
  return response
}

// ---- 认证 ----
export type AuthRole = 'user' | 'admin' | 'guest' | 'anonymous'

export interface AuthUser {
  id?: number
  username?: string
  email?: string
  role?: AuthRole | string
  avatar_url?: string
  session_id?: number
  remaining?: number
  expires_at?: string
}

export interface AuthResponse {
  token: string
  user?: AuthUser
  notice?: string
  expires_at?: string
}

export async function registerApi(username: string, email: string, password: string): Promise<AuthResponse> {
  const res = await apiFetch(`${API_BASE}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, email, password }),
  })
  if (!res.ok) throw (await res.json().catch(() => ({})))
  return res.json() as Promise<AuthResponse>
}

export async function loginApi(email: string, password: string): Promise<AuthResponse> {
  const res = await apiFetch(`${API_BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw (await res.json().catch(() => ({})))
  return res.json() as Promise<AuthResponse>
}

export async function guestLoginApi(): Promise<AuthResponse> {
  const res = await apiFetch(`${API_BASE}/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })
  if (!res.ok) throw (await res.json().catch(() => ({})))
  return res.json() as Promise<AuthResponse>
}

export async function getCurrentUserApi(): Promise<{ user: AuthUser; permissions?: Record<string, boolean>; notice?: string }> {
  const res = await apiFetch(`${API_BASE}/auth/me`, { credentials: 'include' })
  if (!res.ok) throw (await res.json().catch(() => ({})))
  return res.json() as Promise<{ user: AuthUser; permissions?: Record<string, boolean>; notice?: string }>
}

export async function logoutApi() {
  const res = await apiFetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' })
  if (!res.ok) throw (await res.json().catch(() => ({})))
  return res.json() as Promise<{ status: 'logged_out' }>
}

export async function changePasswordApi(currentPassword: string, newPassword: string) {
  const res = await apiFetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  })
  if (!res.ok) throw (await res.json().catch(() => ({})))
  return res.json() as Promise<{ status: 'password_changed'; token: string }>
}

export async function requestPasswordResetApi(email: string) {
  const res = await apiFetch(`${API_BASE}/auth/password-reset/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) throw (await res.json().catch(() => ({})))
  return res.json() as Promise<{ status: string; message: string; debug_token?: string }>
}

export async function confirmPasswordResetApi(token: string, newPassword: string) {
  const res = await apiFetch(`${API_BASE}/auth/password-reset/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  })
  if (!res.ok) throw (await res.json().catch(() => ({})))
  return res.json() as Promise<{ status: 'password_reset' }>
}

export interface AdminOverview {
  users: { total: number; active: number; inactive: number }
  active_sessions: number
  generation_jobs: Array<{ status: string; count: number }>
  audit_events: number
}

export interface AdminUserRecord {
  id: number
  username: string
  email: string
  role: string
  avatar_url?: string
  is_active: boolean | number
  email_verified?: boolean | number
  created_at: string
}

export interface AdminGenerationJobRecord {
  job_id: string
  user_id: number
  username?: string | null
  kind: string
  status: string
  error_code?: string | null
  retryable?: boolean | number
  progress?: Record<string, unknown> | string | null
  created_at: string
  started_at?: string | null
  finished_at?: string | null
}

export async function getAdminOverview() {
  const res = await apiFetch(`${API_BASE}/auth/admin/overview`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || '读取管理员概览失败')
  return res.json() as Promise<AdminOverview>
}

export async function getAdminUsers(limit = 100, offset = 0) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  const res = await apiFetch(`${API_BASE}/auth/admin/users?${params}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || '读取用户列表失败')
  return res.json() as Promise<{ users: AdminUserRecord[]; total: number; summary: Record<string, number> }>
}

export async function getAdminGenerationJobs(limit = 80) {
  const res = await apiFetch(`${API_BASE}/auth/admin/jobs?limit=${limit}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || '读取后台任务失败')
  return res.json() as Promise<{ jobs: AdminGenerationJobRecord[] }>
}

export async function updateAdminUser(userId: number, updates: { is_active?: boolean; role?: 'user' | 'admin' }) {
  const res = await apiFetch(`${API_BASE}/auth/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || '更新用户状态失败')
  return res.json() as Promise<{ user: AdminUserRecord }>
}

// ---- 聊天（流式）----
export interface ImageStudyAnalysis {
  title: string
  summary: string
  recognized_text: string
  knowledge_points: string[]
  course_name: string
  topic_name: string
}

export type GenerationJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface GenerationJob<T = Record<string, never>> {
  job_id: string
  kind: 'notes' | 'map' | 'map_deep_dive' | 'map_deep_dive_pack' | 'practice' | 'interactive' | 'document_pack_plan'
  status: GenerationJobStatus
  created_at: string
  started_at?: string
  finished_at?: string
  result?: T
  error?: string
  error_code?: string
  retryable?: boolean
  progress?: Record<string, unknown>
}

export interface DynamicExplanationJobProgress {
  phase: 'queued' | 'drafting' | 'retrying' | 'auditing' | 'repairing' | 'recovering' | 'finalizing' | 'persisting' | 'blocked' | 'failed'
  label: string
  message: string
  percent: number
  total_scenes?: number
  current_scene?: number
  current_scene_title?: string
  quality_score?: number
  repaired_scenes?: number
  retry_attempt?: number
  retry_limit?: number
  recovery_mode?: boolean
  error_code?: string
}

export interface TutorMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  mode?: string
  timestamp?: number
  images?: string[]
  image_analysis?: ImageStudyAnalysis
}

export interface LearningState {
  subject: string
  goal: string
  knowledge_points: string[]
  weak_points: string[]
  deadline: string
  level: string
  current_topic: string
}

export interface TutorSessionSummary {
  id: number
  title: string
  preview: string
  message_count: number
  is_pinned: boolean
  learning_state: LearningState
  created_at: string
  updated_at: string
}

export interface TutorHistory {
  title: string
  messages: TutorMessage[]
  learning_state: LearningState
}

export type TutorStreamEvent =
  | { type: 'start'; qa_id: string; mode: string; phase?: 'image_analysis' | 'retrieving' | 'answering'; image_analysis?: ImageStudyAnalysis }
  | { type: 'status'; phase: 'image_analysis' | 'retrieving' | 'answering'; image_analysis?: ImageStudyAnalysis; image_error?: boolean }
  | { type: 'chunk'; content: string }
  | { type: 'done'; qa_id: string; session_id: number; learning_state: LearningState }

export async function getTutorSessions(userId: number) {
  const res = await apiFetch(`${API_BASE}/tutor/sessions?user_id=${userId}`)
  if (!res.ok) throw new Error('获取会话失败')
  return res.json()
}

export async function newTutorSession(userId: number) {
  const res = await apiFetch(`${API_BASE}/tutor/sessions/new?user_id=${userId}`, { method: 'POST' })
  if (!res.ok) throw new Error('创建会话失败')
  return res.json()
}

export async function updateTutorSession(
  userId: number,
  sessionId: number,
  updates: { title?: string; is_pinned?: boolean },
) {
  const res = await apiFetch(`${API_BASE}/tutor/sessions/${sessionId}?user_id=${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '更新对话失败')
  }
  return res.json() as Promise<{ session_id: number; status: 'updated' }>
}

export async function deleteTutorSession(userId: number, sessionId: number) {
  const res = await apiFetch(`${API_BASE}/tutor/sessions/${sessionId}?user_id=${userId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '删除对话失败')
  }
  return res.json() as Promise<{ session_id: number; status: 'deleted' }>
}

export async function getTutorHistory(userId: number, sessionId: number) {
  const res = await apiFetch(`${API_BASE}/tutor/history?user_id=${userId}&session_id=${sessionId}`)
  if (!res.ok) throw new Error('获取历史失败')
  return res.json()
}

export async function createImageAnalysisArtifact(userId: number, sessionId: number, qaId: string) {
  const res = await apiFetch(`${API_BASE}/artifacts/create-image-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, session_id: sessionId, qa_id: qaId }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '保存图片解析失败')
  }
  return res.json() as Promise<{ artifact: LearningArtifactRecord }>
}

export async function generateKnowledgeMap(userId: number, sessionId: number, qaId: string) {
  const res = await apiFetch(`${API_BASE}/artifacts/generate-knowledge-map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, session_id: sessionId, qa_id: qaId, async_mode: true }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '知识图解生成失败')
  }
  return res.json() as Promise<{ job: GenerationJob<{ artifact: LearningArtifactRecord }> }>
}

export async function generateKnowledgeMapDeepDive(
  artifactId: number,
  userId: number,
  nodeId: string,
  force = false,
) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/knowledge-map/deep-dives/${encodeURIComponent(nodeId)}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, force }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '专题深读图生成失败')
  }
  const response = await res.json() as
    | { status: 'ready'; deep_dive: KnowledgeMapDeepDive; cached: true }
    | { status: 'generating'; job: GenerationJob<{ deep_dive: KnowledgeMapDeepDive; artifact: LearningArtifactRecord; cached: false }> }
  if (response.status === 'ready') return { deep_dive: response.deep_dive, cached: true }
  return waitForGenerationJob(userId, response.job)
}

export interface KnowledgeMapPackProgress {
  total: number
  ready: number
  completed: number
  failed: number
  pending: number
  current_labels?: string[]
}

export interface KnowledgeMapPackResult {
  artifact: LearningArtifactRecord
  total: number
  ready: number
  completed_node_ids: string[]
  failed_nodes: Array<{ node_id: string; label: string }>
}

export async function generateKnowledgeMapPack(artifactId: number, userId: number) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/knowledge-map/deep-dives/generate-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '整套知识图解生成任务无法启动')
  }
  return res.json() as Promise<{
    status: 'generating'
    job: GenerationJob<KnowledgeMapPackResult> & { progress?: KnowledgeMapPackProgress }
  }>
}

export async function generateDynamicExplanation(userId: number, sessionId: number, qaId: string) {
  const res = await apiFetch(`${API_BASE}/artifacts/generate-dynamic-explanation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, session_id: sessionId, qa_id: qaId, async_mode: true }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '动态讲解生成失败')
  }
  return res.json() as Promise<{ job: GenerationJob<{ artifact: LearningArtifactRecord }> & { progress?: DynamicExplanationJobProgress } }>
}

export async function getGenerationJob<T>(userId: number, jobId: string) {
  const res = await apiFetch(`${API_BASE}/artifacts/generation-jobs/${jobId}?user_id=${userId}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '生成任务暂时无法读取')
  }
  return res.json() as Promise<GenerationJob<T>>
}

export async function waitForGenerationJob<T>(
  userId: number,
  job: GenerationJob<T>,
  onProgress?: (job: GenerationJob<T>) => void,
) {
  let current = job
  const deadline = Date.now() + 10 * 60 * 1000
  onProgress?.(current)
  while (current.status === 'queued' || current.status === 'running') {
    if (Date.now() > deadline) throw new Error('生成时间过长，请稍后在资料库中查看结果')
    await new Promise<void>(resolve => window.setTimeout(resolve, 850))
    current = await getGenerationJob<T>(userId, current.job_id)
    onProgress?.(current)
  }
  if (current.status === 'failed' || !current.result) throw new Error(current.error || '生成没有完成，请稍后重试')
  return current.result
}

// 流式聊天：返回 fetch Response 供 ReadableStream 消费
export async function streamTutorChat(
  userId: number, sessionId: number | null,
  message: string, mode: string, images?: string[],
): Promise<Response> {
  const response = await apiFetch(`${API_BASE}/tutor/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, session_id: sessionId, message, mode, images: images || [] }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || body.error || '发送消息失败')
  }
  return response
}

export async function readTutorStream(
  response: Response,
  onEvent: (event: TutorStreamEvent) => void,
) {
  if (!response.body) throw new Error('浏览器不支持流式回答')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() || ''
    for (const block of blocks) {
      const payload = block.split(/\r?\n/)
        .find(line => line.startsWith('data:'))
        ?.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      onEvent(JSON.parse(payload) as TutorStreamEvent)
    }
    if (done) break
  }
}

// ---- 资料生成 ----
export async function startResourceGeneration(userId: number, message: string) {
  const res = await apiFetch(`${API_BASE}/resources/start`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, message }),
  })
  if (!res.ok) throw (await res.json().catch(() => ({})))
  return res.json()
}

export function streamGenerate(
  userId: number, sessionId: number | undefined,
  onEvent: (data: any) => void, onDone: () => void, onError: (err: Error) => void,
) {
  let url = `${API_BASE}/resources/generate/stream?user_id=${userId}`
  if (sessionId) url += `&session_id=${sessionId}`
  const es = new EventSource(url, { withCredentials: true })
  es.onmessage = (e) => {
    if (e.data === '[DONE]') { es.close(); onDone(); return }
    try { onEvent(JSON.parse(e.data)) } catch { /* ignore */ }
  }
  es.onerror = () => { es.close(); onError(new Error('连接中断')) }
  return () => es.close()
}

export async function getResourcePackage(packageId: number) {
  const res = await apiFetch(`${API_BASE}/resources/packages/${packageId}`)
  if (!res.ok) throw new Error('获取资源包失败')
  return res.json()
}

// ---- 多模态 ----
export async function visionAnalyze(userId: number, message: string, images: string[], mode = 'qa') {
  const res = await apiFetch(`${API_BASE}/vision/analyze`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, message, images, mode }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.detail || '图片理解失败')
  }
  return res.json()
}

export async function textToSpeech(userId: number, text: string, signal?: AbortSignal) {
  const res = await apiFetch(`${API_BASE}/audio/tts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, text }),
    signal,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(body.detail || '语音合成失败')
  }
  return res.json()
}

/** Resolve media paths returned by the local API (for example /static/audio/...). */
export function resolveApiAssetUrl(url: string) {
  const value = String(url || '').trim()
  if (!value || /^(?:data|blob|https?):/i.test(value)) return value
  const origin = API_BASE.replace(/\/api\/v1\/?$/, '')
  return `${origin}/${value.replace(/^\/+/, '')}`
}

export async function speechToText(userId: number, audio: string, signal?: AbortSignal) {
  const res = await apiFetch(`${API_BASE}/audio/asr`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, audio }),
    signal,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(body.detail || '语音识别失败')
  }
  return res.json()
}

// ---- 对话内学习资料 ----
export interface LearningArtifactRecord {
  id: number
  user_id: number
  session_id: number
  qa_id: string
  kind: string
  title: string
  summary: string
  highlights: string[]
  content: string
  source_prompt: string
  purpose: 'review' | 'preview' | 'exam'
  depth: 'concise' | 'standard' | 'deep'
  style: 'plain' | 'notes' | 'exam'
  document_template: 'quick_overview' | 'system_guide' | 'problem_walkthrough' | 'concept_comparison' | 'formula_handbook' | 'glossary' | 'exam_cram'
  course_name: string
  topic_name: string
  recommended_course_name: string
  recommended_topic_name: string
  classification_source: 'memory' | 'learning_state' | 'library' | 'llm' | 'image_analysis' | 'fallback'
  classification_confidence: number
  classification_overridden: boolean
  classification_keywords: string[]
  status: 'draft' | 'saved' | 'deleted'
  course_id?: number
  topic_id?: number
  topic_mastery?: number
  version_group_id: number
  version: number
  is_favorite: boolean
  source_map_artifact_id?: number | null
  learning_loop_id?: string
  learning_loop_step?: 'notes' | 'map' | 'interactive' | 'practice' | ''
  document_pack_id?: string
  document_pack_template?: LearningArtifactRecord['document_template'] | ''
  practice_pack_id?: string
  practice_pack_mode?: Exclude<PracticeMode, 'standard'> | ''
  deleted_at: string
  created_at: string
  updated_at: string
}

export interface ExternalVideoResource {
  platform: 'bilibili'
  platform_label: string
  title: string
  url: string
  cover_url: string
  creator: string
  duration: string
  view_count: string
  description: string
  recommendation: string
}

export type KnowledgeMapNodeStatus = 'new' | 'review' | 'mastered'

export interface KnowledgeMapProgress {
  progress: Record<string, Exclude<KnowledgeMapNodeStatus, 'new'>>
  summary: {
    total: number
    mastered: number
    review: number
    untouched: number
  }
  exploration?: {
    active_node_id: string
    explored_node_ids: string[]
    generated_deep_dive_ids: string[]
    total_deep_dives: number
    updated_at: string
  }
}

export interface InteractivePresentationProgress {
  artifact_id: number
  active_scene_id: string
  completed_scene_ids: string[]
  visited_scene_ids: string[]
  is_completed: boolean
  checkpoints?: Record<string, DynamicExplanationCheckpoint>
  updated_at: string
}

export type KnowledgeMapCollaborationSuggestion =
  | { kind: 'edge'; from: string; to: string; label: string; reason: string }
  | { kind: 'node_note'; node_id: string; field: 'detail' | 'example' | 'mistake'; value: string; reason: string }
  | { kind: 'new_node'; label: string; detail: string; from: string; role: 'branch' | 'detail'; label_edge: string; reason: string }
  | { kind: 'review'; node_id: string; reason: string }

export interface KnowledgeMapCollaboration {
  summary: string
  suggestions: KnowledgeMapCollaborationSuggestion[]
}

export type PracticeMode = 'standard' | 'similar' | 'variants' | 'special' | 'mock' | 'coding' | 'oral'

export type PracticeQuestionType =
  | 'single_choice'
  | 'true_false'
  | 'fill_blank'
  | 'code_task'
  | 'oral_response'

export interface PracticeQuestion {
  id: string
  type: PracticeQuestionType
  prompt: string
  options: string[]
  knowledge_point: string
  language?: string
  starter_code?: string
  tests?: Array<{ label: string; input: string; expected_output: string }>
  hints?: string[]
  target_keywords?: string[]
  follow_up?: string
}

export interface PracticeSetRecord {
  id: number
  artifact_id: number
  question_count: number
  practice_mode: PracticeMode
  estimated_minutes: number
  knowledge_points: string[]
  questions: PracticeQuestion[]
  created_at: string
  updated_at: string
}

export interface PracticeAttemptSummary {
  id: number
  correct_count: number
  total_count: number
  score: number
  weak_points: string[]
  completed_at: string
}

export interface PracticeAttemptResult extends PracticeAttemptSummary {
  practice_set_id: number
  results: Array<{
    question_id: string
    answer: string
    correct: boolean
    correct_answer: string
    explanation: string
    knowledge_point: string
  }>
}

export interface LibraryTopicReview {
  course_name: string
  topic_name: string
  mastery: number
  recent_score: number | null
  recent_completed_at: string
  attempt_count: number
  weak_points: string[]
  wrong_questions?: Array<{
    prompt: string
    knowledge_point: string
    answer: string
    correct_answer: string
    explanation: string
    completed_at: string
  }>
}

export type TopicNextAction =
  | 'open_material'
  | 'continue_map'
  | 'continue_explanation'
  | 'review_map'
  | 'start_practice'
  | 'practice_weak_points'
  | 'review_material'
  | 'complete'

export interface LibraryTopicLearningState {
  course_name: string
  topic_name: string
  mastery: number
  materials: {
    total: number
    opened: number
    completed: number
  }
  map_progress: {
    total: number
    mastered: number
    review: number
    untouched: number
  }
  interactive: {
    presentations: number
    scenes: number
    completed_scenes: number
    completed_presentations: number
    in_progress: number
    checks: number
    confirmed_checks: number
  }
  practice: {
    attempt_count: number
    recent_score: number | null
    recent_completed_at: string
    weak_points: string[]
  }
  active_artifact_id: number | null
  last_activity: { type: string; at: string }
  next_step: { action: TopicNextAction; artifact_id: number | null; detail: string }
}

export type TopicStudyPlanTaskStatus = 'pending' | 'completed'

export interface TopicStudyPlanTask {
  id: string
  action: Exclude<TopicNextAction, 'complete'>
  artifact_id: number | null
  title: string
  detail: string
  status: TopicStudyPlanTaskStatus
}

export interface TopicStudyPlan {
  id: number | null
  status: 'active' | 'completed'
  tasks: TopicStudyPlanTask[]
  active_task_id: string
  completed_count: number
  total_count: number
  started_at: string
  updated_at: string
  completed_at: string
}

export async function getLearningArtifacts(
  userId: number,
  options: { sessionId?: number; status?: 'all' | 'draft' | 'saved' | 'deleted' } = {},
) {
  const params = new URLSearchParams({ user_id: String(userId), status: options.status || 'all' })
  if (options.sessionId !== undefined) params.set('session_id', String(options.sessionId))
  const res = await apiFetch(`${API_BASE}/artifacts?${params}`)
  if (!res.ok) throw new Error('获取学习资料失败')
  return res.json() as Promise<{ artifacts: LearningArtifactRecord[] }>
}

export async function getLibraryTopicReviews(userId: number) {
  const params = new URLSearchParams({ user_id: String(userId) })
  const res = await apiFetch(`${API_BASE}/artifacts/topics/reviews?${params}`)
  if (!res.ok) throw new Error('获取主题复习状态失败')
  return res.json() as Promise<{ reviews: LibraryTopicReview[] }>
}

export async function getLibraryTopicLearningState(userId: number, courseName: string, topicName: string) {
  const params = new URLSearchParams({
    user_id: String(userId),
    course_name: courseName,
    topic_name: topicName,
  })
  const res = await apiFetch(`${API_BASE}/artifacts/topics/state?${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '获取主题学习状态失败')
  }
  return res.json() as Promise<LibraryTopicLearningState>
}

export async function getTopicStudyPlan(userId: number, courseName: string, topicName: string) {
  const params = new URLSearchParams({
    user_id: String(userId),
    course_name: courseName,
    topic_name: topicName,
  })
  const res = await apiFetch(`${API_BASE}/artifacts/topics/study-plan?${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '获取本次复习清单失败')
  }
  return res.json() as Promise<{ plan: TopicStudyPlan }>
}

export async function startTopicStudyPlan(userId: number, courseName: string, topicName: string) {
  const res = await apiFetch(`${API_BASE}/artifacts/topics/study-plan/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, course_name: courseName, topic_name: topicName }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '开始本次复习失败')
  }
  return res.json() as Promise<{ plan: TopicStudyPlan }>
}

export async function updateTopicStudyPlanTask(
  planId: number,
  userId: number,
  courseName: string,
  topicName: string,
  taskId: string,
  status: TopicStudyPlanTaskStatus,
) {
  const res = await apiFetch(`${API_BASE}/artifacts/topics/study-plan/${planId}/tasks`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      course_name: courseName,
      topic_name: topicName,
      task_id: taskId,
      status,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '更新复习任务失败')
  }
  return res.json() as Promise<{ plan: TopicStudyPlan }>
}

export async function recordLearningActivity(
  artifactId: number,
  userId: number,
  activityType: string,
  activityData: Record<string, unknown> = {},
) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/activity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, activity_type: activityType, activity_data: activityData }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '记录学习状态失败')
  }
  return res.json() as Promise<{ activity: { artifact_id: number; activity_type: string } }>
}

export async function generateLearningDocument(
  userId: number,
  sessionId: number,
  qaId: string,
  settings: {
    document_template: LearningArtifactRecord['document_template']
    study_pack_blueprint?: StudyPackBlueprint
    study_pack_templates?: LearningArtifactRecord['document_template'][]
    document_pack_id?: string
    document_pack_template?: LearningArtifactRecord['document_template']
  },
) {
  const res = await apiFetch(`${API_BASE}/artifacts/generate-document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, session_id: sessionId, qa_id: qaId, ...settings, async_mode: true }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '学习文档生成失败')
  }
  return res.json() as Promise<{ job: GenerationJob<{ artifact: LearningArtifactRecord }> }>
}

export interface StudyPackBlueprint {
  learning_goal: string
  core_thread: string
  knowledge_points: string[]
  canonical_example: { title: string; brief: string }
  pitfalls: string[]
  formulas_or_rules: string[]
  terms: string[]
  learning_route: LearningArtifactRecord['document_template'][]
}

export async function generateStudyPackBlueprint(
  userId: number,
  sessionId: number,
  qaId: string,
  templates: LearningArtifactRecord['document_template'][],
) {
  const res = await apiFetch(`${API_BASE}/artifacts/generate-document-pack-blueprint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, session_id: sessionId, qa_id: qaId, templates, async_mode: true }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '学习路线制定失败')
  }
  return res.json() as Promise<{ job: GenerationJob<{ blueprint: StudyPackBlueprint }> }>
}

export async function generatePracticeSet(
  userId: number,
  sessionId: number,
  qaId: string,
  focusPoints: string[] = [],
  sourceMapArtifactId?: number,
  practiceMode: PracticeMode = 'standard',
  practicePackId?: string,
) {
  const questionCount: Record<PracticeMode, number> = {
    standard: 5,
    similar: 6,
    variants: 6,
    special: 8,
    mock: 12,
    coding: 3,
    oral: 4,
  }
  const res = await apiFetch(`${API_BASE}/artifacts/generate-practice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      session_id: sessionId,
      qa_id: qaId,
      question_count: questionCount[practiceMode],
      practice_mode: practiceMode,
      practice_pack_id: practicePackId,
      practice_pack_mode: practicePackId ? practiceMode : undefined,
      focus_points: focusPoints,
      source_map_artifact_id: sourceMapArtifactId,
      async_mode: true,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '练习测验生成失败')
  }
  return res.json() as Promise<{ job: GenerationJob<{ artifact: LearningArtifactRecord; practice: PracticeSetRecord }> }>
}

export async function getPracticeForArtifact(artifactId: number, userId: number) {
  const params = new URLSearchParams({ user_id: String(userId) })
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/practice?${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '获取练习集失败')
  }
  return res.json() as Promise<{ practice: PracticeSetRecord; attempts: PracticeAttemptSummary[] }>
}

export async function submitPracticeAttempt(practiceSetId: number, userId: number, answers: Record<string, string>) {
  const res = await apiFetch(`${API_BASE}/artifacts/practice-sets/${practiceSetId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, answers }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '提交练习失败')
  }
  return res.json() as Promise<{ attempt: PracticeAttemptResult; topic_mastery: number | null; map_progress?: KnowledgeMapProgress | null }>
}

export async function getKnowledgeMapProgress(artifactId: number, userId: number) {
  const params = new URLSearchParams({ user_id: String(userId) })
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/map-progress?${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '获取知识图解进度失败')
  }
  return res.json() as Promise<KnowledgeMapProgress>
}

export async function getInteractivePresentationProgress(artifactId: number, userId: number) {
  const params = new URLSearchParams({ user_id: String(userId) })
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/interactive-presentation/progress?${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '获取互动演示进度失败')
  }
  return res.json() as Promise<InteractivePresentationProgress>
}

export async function updateInteractivePresentationProgress(
  artifactId: number,
  userId: number,
  progress: Pick<InteractivePresentationProgress, 'active_scene_id' | 'completed_scene_ids' | 'visited_scene_ids' | 'is_completed'>,
) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/interactive-presentation/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, ...progress }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '更新互动演示进度失败')
  }
  return res.json() as Promise<InteractivePresentationProgress>
}

export async function recordInteractivePresentationCheckpoint(
  artifactId: number,
  userId: number,
  checkpoint: { scene_id: string; answer: string },
) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/interactive-presentation/checkpoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, ...checkpoint }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '保存理解检查结果失败')
  }
  return res.json() as Promise<InteractivePresentationProgress>
}

export async function updateKnowledgeMapNodeProgress(
  artifactId: number,
  userId: number,
  nodeId: string,
  status: KnowledgeMapNodeStatus,
) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/map-progress/${encodeURIComponent(nodeId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, status }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '更新知识图解进度失败')
  }
  return res.json() as Promise<KnowledgeMapProgress>
}

export async function updateKnowledgeMapWorkspaceProgress(
  artifactId: number,
  userId: number,
  state: { active_node_id: string; explored_node_ids: string[] },
) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/map-workspace`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, ...state }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail && body.detail !== 'Not Found'
      ? body.detail
      : '浏览位置同步功能需要重启后端后启用')
  }
  return res.json() as Promise<KnowledgeMapProgress>
}

export async function updateKnowledgeMap(
  artifactId: number,
  userId: number,
  map: object,
) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/knowledge-map`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, map }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '保存知识图解编辑失败')
  }
  return res.json() as Promise<{ artifact: LearningArtifactRecord; map_progress: KnowledgeMapProgress | null }>
}

export async function updateInteractivePresentation(
  artifactId: number,
  userId: number,
  presentation: DynamicExplanationData,
) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/interactive-presentation`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, presentation }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '保存互动演示编辑失败')
  }
  return res.json() as Promise<{ artifact: LearningArtifactRecord; saved_as_version: boolean }>
}

export async function regenerateInteractivePresentationScene(
  artifactId: number,
  userId: number,
  presentation: DynamicExplanationData,
  sceneId: string,
) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/interactive-presentation/regenerate-scene`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, presentation, scene_id: sceneId }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'AI 重做这一页失败')
  }
  return res.json() as Promise<{ scene: DynamicExplanationScene }>
}

export async function collaborateKnowledgeMap(artifactId: number, userId: number) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/knowledge-map/collaborate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '智能协作检查失败')
  }
  return res.json() as Promise<KnowledgeMapCollaboration>
}

export async function saveLearningArtifact(
  artifactId: number,
  userId: number,
  title: string,
  courseName: string,
  topicName: string,
  saveStrategy: 'separate' | 'version' | 'update' = 'separate',
  duplicateArtifactId?: number,
) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/save`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      title,
      course_name: courseName,
      topic_name: topicName,
      save_strategy: saveStrategy,
      duplicate_artifact_id: duplicateArtifactId,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '保存学习资料失败')
  }
  return res.json() as Promise<{ artifact: LearningArtifactRecord; topic_mastery?: number | null }>
}

export async function saveLearningLoop(
  userId: number,
  learningLoopId: string,
  courseName: string,
  topicName: string,
  artifacts: Array<{ artifact_id: number; step: 'notes' | 'map' | 'interactive' | 'practice' }>,
) {
  const res = await apiFetch(`${API_BASE}/artifacts/learning-loop/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      learning_loop_id: learningLoopId,
      course_name: courseName,
      topic_name: topicName,
      artifacts,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '保存整套学习资料失败')
  }
  return res.json() as Promise<{ artifacts: LearningArtifactRecord[] }>
}

export async function saveDocumentPack(
  userId: number,
  documentPackId: string,
  courseName: string,
  topicName: string,
  artifacts: Array<{ artifact_id: number; document_template: LearningArtifactRecord['document_template'] }>,
) {
  const res = await apiFetch(`${API_BASE}/artifacts/document-packs/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      document_pack_id: documentPackId,
      course_name: courseName,
      topic_name: topicName,
      artifacts,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '保存学习资料包失败')
  }
  return res.json() as Promise<{ artifacts: LearningArtifactRecord[] }>
}

export async function savePracticePack(
  userId: number,
  practicePackId: string,
  courseName: string,
  topicName: string,
  artifacts: Array<{ artifact_id: number; practice_mode: Exclude<PracticeMode, 'standard'> }>,
) {
  const res = await apiFetch(`${API_BASE}/artifacts/practice-packs/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      practice_pack_id: practicePackId,
      course_name: courseName,
      topic_name: topicName,
      artifacts,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '保存练习资源包失败')
  }
  return res.json() as Promise<{ artifacts: LearningArtifactRecord[] }>
}

export async function searchExternalVideos(
  query: string,
  courseName = '',
  topicName = '',
  limit = 4,
) {
  const res = await apiFetch(`${API_BASE}/artifacts/video-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      course_name: courseName,
      topic_name: topicName,
      limit,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '课程视频检索失败，请稍后重试')
  }
  return res.json() as Promise<{
    query: string
    platform: 'bilibili'
    search_url: string
    results: ExternalVideoResource[]
  }>
}

export async function saveExternalVideoResource(payload: {
  user_id: number
  session_id: number
  qa_id: string
  course_name: string
  topic_name: string
  title: string
  url: string
  cover_url: string
  creator: string
  duration: string
  view_count: string
  description: string
  search_query: string
}) {
  const res = await apiFetch(`${API_BASE}/artifacts/video-resources/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '收藏课程视频失败，请稍后重试')
  }
  return res.json() as Promise<{ artifact: LearningArtifactRecord; duplicate: boolean }>
}

export async function findLearningArtifactDuplicates(
  artifactId: number,
  userId: number,
  title: string,
  courseName: string,
  topicName: string,
) {
  const res = await apiFetch(`${API_BASE}/artifacts/duplicates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      artifact_id: artifactId,
      title,
      course_name: courseName,
      topic_name: topicName,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '检查重复资料失败')
  }
  return res.json() as Promise<{ duplicates: Array<LearningArtifactRecord & { similarity: number }> }>
}

export async function getLearningArtifactVersions(artifactId: number, userId: number) {
  const params = new URLSearchParams({ user_id: String(userId) })
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/versions?${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '获取版本记录失败')
  }
  return res.json() as Promise<{ versions: LearningArtifactRecord[] }>
}

export async function restoreLearningArtifactVersion(artifactId: number, userId: number) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/restore-version`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '恢复这个版本失败')
  }
  return res.json() as Promise<{ artifact: LearningArtifactRecord }>
}

export async function updateLearningArtifact(
  artifactId: number,
  userId: number,
  title: string,
  courseName: string,
  topicName: string,
) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, title, course_name: courseName, topic_name: topicName }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '调整资料归属失败')
  }
  return res.json() as Promise<{ artifact: LearningArtifactRecord }>
}

export async function favoriteLearningArtifact(artifactId: number, userId: number, favorite: boolean) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/favorite`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, favorite }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '更新收藏状态失败')
  }
  return res.json() as Promise<{ artifact: LearningArtifactRecord }>
}

export async function trashLearningArtifact(artifactId: number, userId: number) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/trash`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '移到回收站失败')
  }
  return res.json() as Promise<{ artifact: LearningArtifactRecord }>
}

export async function restoreLearningArtifact(artifactId: number, userId: number) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}/restore`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '恢复资料失败')
  }
  return res.json() as Promise<{ artifact: LearningArtifactRecord }>
}

export async function permanentlyDeleteLearningArtifact(artifactId: number, userId: number) {
  const res = await apiFetch(`${API_BASE}/artifacts/${artifactId}?user_id=${userId}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '永久删除资料失败')
  }
  return res.json() as Promise<{ deleted: boolean; artifact_id: number }>
}
