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

function GuestExperience({ onExit }: { onExit: () => void }) {
  const [active, setActive] = useState<'map' | 'story' | 'loop'>('map')
  const cards = [
    { id: 'map' as const, eyebrow: '01 · 知识图解', title: '把一个主题看成一张可探索的星图', text: '拖动、缩放并点开节点，先从全局关系开始认识一个新主题。', color: '#d88937' },
    { id: 'story' as const, eyebrow: '02 · 动态讲解', title: '让概念沿着一条清晰的故事线展开', text: '从问题、机制到例子和自测，按顺序观察每一步为什么发生。', color: '#597c6a' },
    { id: 'loop' as const, eyebrow: '03 · 学习闭环', title: '看见理解、练习与复盘如何连起来', text: '正式账户可以保存对话、资料、练习结果和学习进度。', color: '#8a6374' },
  ]
  const current = cards.find(card => card.id === active) || cards[0]

  return (
    <main style={{ minHeight: '100dvh', padding: 'clamp(24px, 5vw, 72px)', background: 'linear-gradient(140deg, #f7f2e9 0%, #eef2ed 58%, #f4e8dc 100%)', color: '#24231f', fontFamily: '"MiSans", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif' }}>
      <div style={{ width: 'min(1080px, 100%)', margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 44 }}>
          <div>
            <p style={{ margin: 0, color: '#a0642e', fontSize: 11, fontWeight: 760, letterSpacing: '.16em', textTransform: 'uppercase' }}>RHYME · GUEST PREVIEW</p>
            <h1 style={{ margin: '12px 0 7px', fontSize: 'clamp(28px, 5vw, 54px)', lineHeight: 1.04, letterSpacing: '-.055em' }}>先看看学习空间。</h1>
            <p style={{ margin: 0, color: '#6d6b63', lineHeight: 1.7 }}>这是安全的只读体验，不会保存你的个人资料。</p>
          </div>
          <button type="button" onClick={onExit} style={{ minHeight: 38, padding: '0 16px', border: '1px solid rgba(36,35,31,.18)', borderRadius: 999, background: 'rgba(255,255,255,.6)', color: '#45433d', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700 }}>结束体验</button>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 18, alignItems: 'stretch' }}>
          <div style={{ minHeight: 390, position: 'relative', overflow: 'hidden', padding: 'clamp(24px, 4vw, 46px)', border: '1px solid rgba(36,35,31,.1)', borderRadius: 28, background: 'rgba(255,253,248,.72)', boxShadow: '0 22px 70px rgba(67,54,37,.1)' }}>
            <div style={{ position: 'absolute', width: 230, height: 230, top: 62, right: 62, borderRadius: '50%', background: `radial-gradient(circle, ${current.color}35 0%, transparent 68%)`, filter: 'blur(5px)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ margin: 0, color: current.color, fontSize: 11, fontWeight: 760, letterSpacing: '.13em', textTransform: 'uppercase' }}>{current.eyebrow}</p>
              <h2 style={{ maxWidth: 520, margin: '18px 0 13px', fontSize: 'clamp(25px, 4vw, 42px)', lineHeight: 1.08, letterSpacing: '-.045em' }}>{current.title}</h2>
              <p style={{ maxWidth: 480, margin: 0, color: '#6d6b63', fontSize: 14, lineHeight: 1.75 }}>{current.text}</p>
            </div>
            <div style={{ position: 'absolute', right: 24, bottom: 22, left: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, alignItems: 'end' }} aria-hidden="true">
              {[.52, .74, .41, .9].map((height, index) => <span key={index} style={{ height: `${height * 74}px`, borderRadius: 9, background: `linear-gradient(180deg, ${current.color}cc, ${current.color}36)`, transform: `translateY(${index % 2 ? 6 : 0}px)` }} />)}
            </div>
          </div>
          <aside style={{ display: 'grid', gap: 10 }} aria-label="游客可预览的学习模块">
            {cards.map(card => (
              <button key={card.id} type="button" onClick={() => setActive(card.id)} style={{ display: 'grid', gap: 8, alignContent: 'start', padding: '20px 21px', border: `1px solid ${active === card.id ? `${card.color}70` : 'rgba(36,35,31,.1)'}`, borderRadius: 18, background: active === card.id ? `${card.color}12` : 'rgba(255,255,255,.52)', color: '#2e2c28', textAlign: 'left', cursor: 'pointer', font: 'inherit', boxShadow: active === card.id ? `0 10px 28px ${card.color}18` : 'none', transition: 'border-color .2s ease, background .2s ease, box-shadow .2s ease' }}>
                <span style={{ color: card.color, fontSize: 10, fontWeight: 760, letterSpacing: '.1em', textTransform: 'uppercase' }}>{card.eyebrow}</span>
                <strong style={{ fontSize: 16, lineHeight: 1.35 }}>{card.title}</strong>
              </button>
            ))}
          </aside>
        </section>

        <footer style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 18, color: '#79766e', fontSize: 11, lineHeight: 1.6 }}>
          <span style={{ padding: '7px 10px', borderRadius: 999, background: 'rgba(255,255,255,.5)' }}>游客会话 · 24 小时后失效</span>
          <span style={{ padding: '7px 10px', borderRadius: 999, background: 'rgba(255,255,255,.5)' }}>注册后才能保存学习记录</span>
        </footer>
      </div>
    </main>
  )
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
    const handleExpired = () => setCurrentUser(null)
    window.addEventListener('rhyme-auth-expired', handleExpired)
    return () => window.removeEventListener('rhyme-auth-expired', handleExpired)
  }, [])

  const signOut = useCallback(async () => {
    try { await logoutApi() } finally { setCurrentUser(null) }
  }, [])

  if (checking) return <SessionLoading />
  if (connectionError) return <SessionLoading error={connectionError} onRetry={() => void loadSession()} />
  if (!currentUser) {
    return <AuthScreen onAuthenticated={session => {
      const user = session.user
      if ((user?.role === 'user' || user?.role === 'admin' || user?.role === 'guest') && typeof user.id === 'number') setCurrentUser(user)
    }} />
  }
  if (currentUser.role === 'guest') return <GuestExperience onExit={() => void signOut()} />
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
