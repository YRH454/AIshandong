import { StrictMode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AuthScreen from './components/AuthScreen.tsx'
import { getCurrentUserApi, logoutApi } from './services/api'
import type { AuthUser } from './services/api'

const root = createRoot(document.getElementById('root')!)
const localBranchDemo = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
  && new URLSearchParams(window.location.search).has('adaptive-branch-demo')
const g6MapDemo = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
  && new URLSearchParams(window.location.search).has('g6-map-demo')
const authPreview = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
  && new URLSearchParams(window.location.search).has('auth-preview')

function SessionLoading({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f5f3ee', color: '#24211d', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section style={{ width: 'min(420px, 100%)', padding: 28, border: '1px solid rgba(36,33,29,.12)', borderRadius: 20, background: '#fffdf9', boxShadow: '0 18px 60px rgba(50,40,20,.08)' }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8f6b3d' }}>RHYME · 学境</p>
        <h1 style={{ margin: '12px 0 8px', fontSize: 24 }}>正在准备你的学习空间</h1>
        <p style={{ margin: 0, lineHeight: 1.7, color: '#6c665f' }}>{error || '正在检查登录会话…'}</p>
        {onRetry && <button type="button" onClick={onRetry} style={{ marginTop: 20, border: 0, borderRadius: 999, padding: '10px 18px', background: '#e49a3d', color: '#fff', cursor: 'pointer' }}>重新连接</button>}
      </section>
    </main>
  )
}

function clearGuestLocalState(user: AuthUser | null) {
  if (user?.role !== 'guest' || typeof user.id !== 'number') return
  const suffix = `:${user.id}`
  const deferredPrefix = `rhyme-deferred-session-changes-${user.id}`
  for (const storage of [localStorage, sessionStorage]) {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index)
      if (key && (key.endsWith(suffix) || key === deferredPrefix)) storage.removeItem(key)
    }
  }
}

function AppEntry() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [connectionError, setConnectionError] = useState('')

  const loadSession = useCallback(async () => {
    setChecking(true)
    setConnectionError('')
    try {
      const result = await getCurrentUserApi()
      const user = result.user
      if ((user.role === 'user' || user.role === 'admin' || user.role === 'guest') && typeof user.id === 'number') {
        setCurrentUser(user)
      } else {
        setCurrentUser(null)
      }
    } catch {
      setConnectionError('暂时无法连接学习服务，请确认后端已启动。')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => { void loadSession() }, [loadSession])

  useEffect(() => {
    const handleExpired = () => setCurrentUser(previous => {
      clearGuestLocalState(previous)
      return null
    })
    window.addEventListener('rhyme-auth-expired', handleExpired)
    return () => window.removeEventListener('rhyme-auth-expired', handleExpired)
  }, [])

  const signOut = useCallback(async () => {
    const previous = currentUser
    try { await logoutApi() } finally {
      clearGuestLocalState(previous)
      setCurrentUser(null)
    }
  }, [currentUser])

  if (checking) return <SessionLoading />
  if (connectionError) return <SessionLoading error={connectionError} onRetry={() => void loadSession()} />
  if (!currentUser) {
    return <AuthScreen onAuthenticated={session => {
      const user = session.user
      if ((user?.role === 'user' || user?.role === 'admin' || user?.role === 'guest') && typeof user.id === 'number') setCurrentUser(user)
    }} />
  }
  return <App currentUser={currentUser} onLogout={() => void signOut()} />
}

if (authPreview) {
  root.render(<StrictMode><AuthScreen /></StrictMode>)
} else if (localBranchDemo) {
  void import('./components/AdaptiveBranchDemo.tsx').then(({ default: AdaptiveBranchDemo }) => {
    root.render(<StrictMode><AdaptiveBranchDemo /></StrictMode>)
  })
} else if (g6MapDemo) {
  void import('./components/G6KnowledgeMapDemo.tsx').then(({ default: G6KnowledgeMapDemo }) => {
    root.render(<StrictMode><G6KnowledgeMapDemo /></StrictMode>)
  })
} else {
  root.render(<StrictMode><AppEntry /></StrictMode>)
}
