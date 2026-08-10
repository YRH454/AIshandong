// RHYME — API 封装（后端精简版）
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api/v1'

// ---- 认证 ----
export async function registerApi(username: string, email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  if (!res.ok) throw (await res.json().catch(() => ({})))
  return res.json()
}

export async function loginApi(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw (await res.json().catch(() => ({})))
  return res.json()
}

// ---- 聊天（流式）----
export interface TutorMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  mode?: string
  timestamp?: number
  images?: string[]
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
  | { type: 'start'; qa_id: string; mode: string }
  | { type: 'chunk'; content: string }
  | { type: 'done'; qa_id: string; session_id: number; learning_state: LearningState }

export async function getTutorSessions(userId: number) {
  const res = await fetch(`${API_BASE}/tutor/sessions?user_id=${userId}`)
  if (!res.ok) throw new Error('获取会话失败')
  return res.json()
}

export async function newTutorSession(userId: number) {
  const res = await fetch(`${API_BASE}/tutor/sessions/new?user_id=${userId}`, { method: 'POST' })
  if (!res.ok) throw new Error('创建会话失败')
  return res.json()
}

export async function getTutorHistory(userId: number, sessionId: number) {
  const res = await fetch(`${API_BASE}/tutor/history?user_id=${userId}&session_id=${sessionId}`)
  if (!res.ok) throw new Error('获取历史失败')
  return res.json()
}

// 流式聊天：返回 fetch Response 供 ReadableStream 消费
export async function streamTutorChat(
  userId: number, sessionId: number | null,
  message: string, mode: string, images?: string[],
): Promise<Response> {
  const response = await fetch(`${API_BASE}/tutor/chat`, {
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
  const res = await fetch(`${API_BASE}/resources/start`, {
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
  const es = new EventSource(url)
  es.onmessage = (e) => {
    if (e.data === '[DONE]') { es.close(); onDone(); return }
    try { onEvent(JSON.parse(e.data)) } catch { /* ignore */ }
  }
  es.onerror = () => { es.close(); onError(new Error('连接中断')) }
  return () => es.close()
}

export async function getResourcePackage(packageId: number) {
  const res = await fetch(`${API_BASE}/resources/packages/${packageId}`)
  if (!res.ok) throw new Error('获取资源包失败')
  return res.json()
}

// ---- 多模态 ----
export async function visionAnalyze(userId: number, message: string, images: string[], mode = 'qa') {
  const res = await fetch(`${API_BASE}/vision/analyze`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, message, images, mode }),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.detail || '图片理解失败')
  }
  return res.json()
}

export async function textToSpeech(userId: number, text: string) {
  const res = await fetch(`${API_BASE}/audio/tts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, text }),
  })
  if (!res.ok) throw new Error('语音合成失败')
  return res.json()
}

export async function speechToText(userId: number, audio: string) {
  const res = await fetch(`${API_BASE}/audio/asr`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, audio }),
  })
  if (!res.ok) throw new Error('语音识别失败')
  return res.json()
}

// ---- 对话内学习资料 ----
export interface LearningArtifactRecord {
  id: number
  user_id: number
  session_id: number
  qa_id: string
  kind: 'notes'
  title: string
  summary: string
  highlights: string[]
  content: string
  source_prompt: string
  purpose: 'review' | 'preview' | 'exam'
  depth: 'concise' | 'standard' | 'deep'
  style: 'plain' | 'notes' | 'exam'
  course_name: string
  topic_name: string
  recommended_course_name: string
  recommended_topic_name: string
  classification_source: 'memory' | 'learning_state' | 'library' | 'llm' | 'fallback'
  classification_confidence: number
  classification_overridden: boolean
  classification_keywords: string[]
  status: 'draft' | 'saved' | 'deleted'
  course_id?: number
  topic_id?: number
  version_group_id: number
  version: number
  is_favorite: boolean
  deleted_at: string
  created_at: string
  updated_at: string
}

export async function getLearningArtifacts(
  userId: number,
  options: { sessionId?: number; status?: 'all' | 'draft' | 'saved' | 'deleted' } = {},
) {
  const params = new URLSearchParams({ user_id: String(userId), status: options.status || 'all' })
  if (options.sessionId !== undefined) params.set('session_id', String(options.sessionId))
  const res = await fetch(`${API_BASE}/artifacts?${params}`)
  if (!res.ok) throw new Error('获取学习资料失败')
  return res.json() as Promise<{ artifacts: LearningArtifactRecord[] }>
}

export async function generateLearningDocument(
  userId: number,
  sessionId: number,
  qaId: string,
  settings: {
    purpose: LearningArtifactRecord['purpose']
    depth: LearningArtifactRecord['depth']
    style: LearningArtifactRecord['style']
  },
) {
  const res = await fetch(`${API_BASE}/artifacts/generate-document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, session_id: sessionId, qa_id: qaId, ...settings }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '学习文档生成失败')
  }
  return res.json() as Promise<{ artifact: LearningArtifactRecord }>
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
  const res = await fetch(`${API_BASE}/artifacts/${artifactId}/save`, {
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
  return res.json() as Promise<{ artifact: LearningArtifactRecord }>
}

export async function findLearningArtifactDuplicates(
  artifactId: number,
  userId: number,
  title: string,
  courseName: string,
  topicName: string,
) {
  const res = await fetch(`${API_BASE}/artifacts/duplicates`, {
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
  const res = await fetch(`${API_BASE}/artifacts/${artifactId}/versions?${params}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '获取版本记录失败')
  }
  return res.json() as Promise<{ versions: LearningArtifactRecord[] }>
}

export async function restoreLearningArtifactVersion(artifactId: number, userId: number) {
  const res = await fetch(`${API_BASE}/artifacts/${artifactId}/restore-version`, {
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
  const res = await fetch(`${API_BASE}/artifacts/${artifactId}`, {
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
  const res = await fetch(`${API_BASE}/artifacts/${artifactId}/favorite`, {
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
  const res = await fetch(`${API_BASE}/artifacts/${artifactId}/trash`, {
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
  const res = await fetch(`${API_BASE}/artifacts/${artifactId}/restore`, {
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
  const res = await fetch(`${API_BASE}/artifacts/${artifactId}?user_id=${userId}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || '永久删除资料失败')
  }
  return res.json() as Promise<{ deleted: boolean; artifact_id: number }>
}
