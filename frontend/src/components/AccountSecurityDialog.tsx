import { useState } from 'react'
import { Check, Eye, EyeOff, KeyRound, LockKeyhole, X } from 'lucide-react'
import { changePasswordApi } from '../services/api'
import './AccountSecurityDialog.css'

type Props = { onClose: () => void }

function errorMessage(value: unknown) {
  if (value && typeof value === 'object' && 'detail' in value) {
    const detail = (value as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
  }
  if (value instanceof Error) return value.message
  return '修改密码失败，请稍后重试'
}

export default function AccountSecurityDialog({ onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setError('')
    if (newPassword.length < 8) { setError('新密码至少8位'); return }
    if (newPassword !== confirmPassword) { setError('两次输入的新密码不一致'); return }
    setBusy(true)
    try {
      await changePasswordApi(currentPassword, newPassword)
      setDone(true)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="account-security-layer">
      <button className="account-security-backdrop" type="button" aria-label="关闭账户安全" onClick={onClose} />
      <section className="account-security-dialog" role="dialog" aria-modal="true" aria-labelledby="account-security-title">
        <header><span className="account-security-icon"><LockKeyhole size={19} /></span><div><p>ACCOUNT SECURITY</p><h2 id="account-security-title">账户安全</h2></div><button type="button" className="account-security-close" aria-label="关闭" onClick={onClose}><X size={17} /></button></header>
        {done ? <div className="account-security-done"><span><Check size={20} /></span><h3>密码已更新</h3><p>当前登录已安全刷新，之后请使用新密码登录。</p><button type="button" onClick={onClose}>完成</button></div> : <form onSubmit={submit}>
          <p className="account-security-note">定期更新密码可以保护你的对话、资料库和学习进度。</p>
          <label><span>当前密码</span><span className="account-security-input"><KeyRound size={15} /><input type={showPasswords ? 'text' : 'password'} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></span></label>
          <label><span>新密码</span><span className="account-security-input"><LockKeyhole size={15} /><input type={showPasswords ? 'text' : 'password'} value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required /><button type="button" aria-label={showPasswords ? '隐藏密码' : '显示密码'} onClick={() => setShowPasswords(value => !value)}>{showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}</button></span></label>
          <label><span>确认新密码</span><span className="account-security-input"><LockKeyhole size={15} /><input type={showPasswords ? 'text' : 'password'} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required /></span></label>
          {error && <p className="account-security-error" role="alert">{error}</p>}
          <button className="account-security-submit" type="submit" disabled={busy}>{busy ? '保存中…' : '更新密码'}</button>
        </form>}
      </section>
    </div>
  )
}

