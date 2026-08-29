import { ArrowRight, BookOpen, Check, Eye, EyeOff, KeyRound, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useState } from 'react'
import mascot from '../assets/xuejing-slime-logo.png'
import { AuthAnimatedCharacters } from './AuthAnimatedCharacters'
import { guestLoginApi, loginApi, registerApi } from '../services/api'
import './AuthScreen.css'

type AuthMode = 'login' | 'register'

type AuthResponse = {
  token: string
  user?: {
    id?: number
    username?: string
    email?: string
    role?: string
    session_id?: number
  }
  notice?: string
}

type AuthScreenProps = {
  initialMode?: AuthMode
  onAuthenticated?: (session: AuthResponse) => void
}

function messageFromError(error: unknown, fallback: string) {
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object' && 'detail' in error) {
    const detail = (error as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail.trim()) return detail
  }
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

function Brand() {
  return (
    <header className="auth-brand" aria-label="RHYME 学境">
      <span className="auth-brand-mark"><img src={mascot} alt="" /></span>
      <span className="auth-brand-copy">
        <strong>RHYME</strong>
        <small>学境 · AI 学习空间</small>
      </span>
    </header>
  )
}

function AuthVisual({ isTyping, showPassword, passwordLength }: { isTyping: boolean; showPassword: boolean; passwordLength: number }) {
  return (
    <aside className="auth-visual" aria-hidden="true">
      <AuthAnimatedCharacters isTyping={isTyping} showPassword={showPassword} passwordLength={passwordLength} />
      <p className="auth-visual-caption">把一个问题，走成自己的理解。</p>
    </aside>
  )
}

export default function AuthScreen({ initialMode = 'login', onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<AuthResponse | null>(null)

  const switchMode = (nextMode: AuthMode) => {
    if (busy) return
    setMode(nextMode)
    setError('')
    setSuccess(null)
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setError('')
    if (mode === 'register' && password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setBusy(true)
    try {
      const response = mode === 'login'
        ? await loginApi(email.trim(), password) as AuthResponse
        : await registerApi(username.trim(), email.trim(), password) as AuthResponse
      setSuccess(response)
      onAuthenticated?.(response)
    } catch (requestError) {
      setError(messageFromError(requestError, mode === 'login' ? '登录失败，请检查邮箱和密码' : '注册失败，请稍后重试'))
    } finally {
      setBusy(false)
    }
  }

  const enterAsGuest = async () => {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const response = await guestLoginApi() as AuthResponse
      setSuccess(response)
      onAuthenticated?.(response)
    } catch (requestError) {
      setError(messageFromError(requestError, '暂时无法开启游客体验，请确认服务已启动'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={`auth-screen${success ? ' auth-screen-success' : ''}`}>
      <AuthVisual isTyping={isTyping} showPassword={showPassword} passwordLength={password.length} />
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-panel-header">
            <Brand />
            <span className="auth-language">简体中文</span>
          </div>

          {success ? (
            <section className="auth-form-card auth-success-card" aria-live="polite">
              <div className="auth-success-mark"><Check size={21} strokeWidth={2.4} /></div>
              <h1>学习空间已准备好</h1>
              <p>{success.user?.username ? `欢迎回来，${success.user.username}。` : '欢迎进入 RHYME，今天想先弄懂什么？'}</p>
              <button type="button" className="auth-primary-button" onClick={() => setSuccess(null)}>
                返回登录页 <ArrowRight size={16} />
              </button>
            </section>
          ) : (
            <section className="auth-form-card" aria-label="RHYME 登录">
              <header className="auth-heading">
                <h1>{mode === 'login' ? '登录你的账户' : '创建你的账户'}</h1>
                <p>{mode === 'login' ? '输入邮箱，继续你的学习空间。' : '注册后保存你的对话、资料与学习进度。'}</p>
              </header>

              <div className="auth-mode-switch" role="tablist" aria-label="登录或注册">
                <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')} role="tab" aria-selected={mode === 'login'}>登录</button>
                <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} role="tab" aria-selected={mode === 'register'}>注册</button>
              </div>

              <form className="auth-form" onSubmit={submit}>
                {mode === 'register' && (
                  <label className="auth-field">
                    <span>用户名</span>
                    <span className="auth-input-wrap"><UserRound size={17} /><input value={username} onChange={event => setUsername(event.target.value)} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)} placeholder="用户名" autoComplete="username" required minLength={2} maxLength={30} /></span>
                  </label>
                )}
                <label className="auth-field">
                  <span>邮箱</span>
                  <span className="auth-input-wrap"><Mail size={17} /><input type="email" value={email} onChange={event => setEmail(event.target.value)} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)} placeholder="电子邮箱" autoComplete="email" autoFocus={mode === 'login'} required /></span>
                </label>
                <label className="auth-field">
                  <span>密码</span>
                  <span className="auth-input-wrap"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)} placeholder="密码" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} /><button type="button" className="auth-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
                </label>
                {mode === 'register' && (
                  <label className="auth-field">
                    <span>确认密码</span>
                    <span className="auth-input-wrap"><KeyRound size={17} /><input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)} placeholder="确认密码" autoComplete="new-password" required minLength={6} /></span>
                  </label>
                )}

                {error && <p className="auth-error" role="alert">{error}</p>}

                <button type="submit" className="auth-primary-button" disabled={busy} aria-busy={busy}>
                  {busy ? '请稍候…' : mode === 'login' ? '用邮箱登录' : '创建账号'}
                  {!busy && <ArrowRight size={16} />}
                </button>
              </form>

              <div className="auth-divider"><span>或者</span></div>
              <button type="button" className="auth-guest-button" onClick={() => void enterAsGuest()} disabled={busy}>
                <BookOpen size={16} />
                <span>先以游客身份体验</span>
              </button>
              <p className="auth-footnote">登录即表示你同意 RHYME 的学习服务条款。</p>
            </section>
          )}

          <p className="auth-shell-note"><span aria-hidden="true" />把一个问题，走成自己的理解。</p>
        </div>
      </section>
    </main>
  )
}
