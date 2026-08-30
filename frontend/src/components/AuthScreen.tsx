import { ArrowRight, BookOpen, Check, Eye, EyeOff, KeyRound, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useState } from 'react'
import mascot from '../assets/xuejing-slime-logo.png'
import { AuthAnimatedCharacters } from './AuthAnimatedCharacters'
import { confirmPasswordResetApi, guestLoginApi, loginApi, registerApi, requestPasswordResetApi } from '../services/api'
import './AuthScreen.css'

type AuthMode = 'login' | 'register' | 'reset'

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
  const [resetToken, setResetToken] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<AuthResponse | null>(null)

  const validate = () => {
    const normalizedEmail = email.trim()
    if (!normalizedEmail) return '请输入邮箱'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return '请输入有效邮箱'
    if (mode === 'register') {
      const normalizedUsername = username.trim()
      if (normalizedUsername.length < 2 || normalizedUsername.length > 30) return '用户名长度需为2-30个字符'
    }
    if (mode !== 'reset' || Boolean(resetToken)) {
      const minimumLength = mode === 'login' ? 6 : 8
      if (!password) return '请输入密码'
      if (password.length < minimumLength) return `密码至少${minimumLength}位`
    }
    if ((mode === 'register' || (mode === 'reset' && Boolean(resetToken))) && password !== confirmPassword) {
      return '两次输入的密码不一致'
    }
    return ''
  }

  const switchMode = (nextMode: AuthMode) => {
    if (busy) return
    setMode(nextMode)
    setError('')
    setResetMessage('')
    if (nextMode !== 'reset') setResetToken('')
    setSuccess(null)
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setError('')
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setBusy(true)
    try {
      if (mode === 'reset') {
        if (!resetToken) {
          const response = await requestPasswordResetApi(email.trim())
          setResetToken(response.debug_token || '')
          setResetMessage(response.debug_token
            ? `${response.message} 本地调试链接已生成，请填写新密码。`
            : response.message)
        } else {
          await confirmPasswordResetApi(resetToken, password)
          setResetMessage('密码已重置，请返回登录并使用新密码。')
          setResetToken('')
          setPassword('')
          setConfirmPassword('')
        }
        return
      }
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

  const submitOnEnter = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    const target = event.target as HTMLElement
    if (target.closest('button')) return
    event.preventDefault()
    event.currentTarget.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
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
                <h1>{mode === 'login' ? '登录你的账户' : mode === 'register' ? '创建你的账户' : '找回密码'}</h1>
                <p>{mode === 'login' ? '输入邮箱，继续你的学习空间。' : mode === 'register' ? '注册后保存你的对话、资料与学习进度。' : resetToken ? '设置一个新的登录密码。' : '输入注册邮箱，获取安全的重置链接。'}</p>
              </header>

              {mode !== 'reset' ? <div className="auth-mode-switch" role="tablist" aria-label="登录或注册">
                <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')} role="tab" aria-selected={mode === 'login'}>登录</button>
                <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} role="tab" aria-selected={mode === 'register'}>注册</button>
              </div> : <button type="button" className="auth-reset-back" onClick={() => switchMode('login')}>← 返回登录</button>}

              <form className="auth-form" onSubmit={submit} onKeyDown={submitOnEnter} noValidate>
                {mode === 'register' && (
                  <label className="auth-field">
                    <span>用户名</span>
                    <span className="auth-input-wrap"><UserRound size={17} /><input name="username" value={username} onChange={event => setUsername(event.target.value)} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)} placeholder="用户名" autoComplete="username" required minLength={2} maxLength={30} /></span>
                  </label>
                )}
                <label className="auth-field">
                  <span>邮箱</span>
                  <span className="auth-input-wrap"><Mail size={17} /><input name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)} placeholder="电子邮箱" autoComplete="email" autoFocus={mode === 'login'} required /></span>
                </label>
                {mode === 'reset' && resetToken && <label className="auth-field">
                  <span>重置令牌</span>
                  <span className="auth-input-wrap"><KeyRound size={17} /><input name="resetToken" value={resetToken} onChange={event => setResetToken(event.target.value)} autoComplete="one-time-code" required /></span>
                </label>}
                {(mode !== 'reset' || Boolean(resetToken)) && <label className="auth-field">
                  <span>密码</span>
                  <span className="auth-input-wrap"><LockKeyhole size={17} /><input name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)} placeholder={mode === 'login' ? '密码' : '新密码（至少8位）'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 6 : 8} /><button type="button" className="auth-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
                </label>}
                {(mode === 'register' || (mode === 'reset' && Boolean(resetToken))) && (
                  <label className="auth-field">
                    <span>确认密码</span>
                    <span className="auth-input-wrap"><KeyRound size={17} /><input name="confirmPassword" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)} placeholder="确认密码" autoComplete="new-password" required minLength={mode === 'reset' ? 8 : 8} /></span>
                  </label>
                )}

                {mode === 'login' && <button type="button" className="auth-forgot-link" onClick={() => switchMode('reset')}>忘记密码？</button>}

                {resetMessage && <p className="auth-reset-message" role="status">{resetMessage}</p>}

                {error && <p className="auth-error" role="alert">{error}</p>}

                <button type="submit" className="auth-primary-button" disabled={busy} aria-busy={busy}>
                  {busy ? '请稍候…' : mode === 'login' ? '用邮箱登录' : mode === 'register' ? '创建账号' : resetToken ? '确认新密码' : '发送重置链接'}
                  {!busy && <ArrowRight size={16} />}
                </button>
              </form>

              {mode !== 'reset' && <><div className="auth-divider"><span>或者</span></div>
                <button type="button" className="auth-guest-button" onClick={() => void enterAsGuest()} disabled={busy}>
                  <BookOpen size={16} />
                  <span>先以游客身份体验</span>
                </button>
                <p className="auth-footnote">登录即表示你同意 RHYME 的学习服务条款。</p></>}
            </section>
          )}

          <p className="auth-shell-note"><span aria-hidden="true" />把一个问题，走成自己的理解。</p>
        </div>
      </section>
    </main>
  )
}
