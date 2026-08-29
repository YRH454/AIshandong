import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, Clock3, Database, LockKeyhole, RefreshCw, ShieldCheck,
  UserCheck, UserRoundX, Users, X, AlertTriangle,
} from 'lucide-react'
import {
  getAdminGenerationJobs,
  getAdminOverview,
  getAdminUsers,
  updateAdminUser,
  type AdminGenerationJobRecord,
  type AdminOverview,
  type AdminUserRecord,
} from '../services/api'
import './AdminConsole.css'

type AdminConsoleProps = {
  onClose: () => void
}

const jobLabels: Record<string, string> = {
  notes: '学习文档',
  map: '知识图解',
  map_deep_dive: '节点深读',
  map_deep_dive_pack: '图解补全',
  practice: '练习测验',
  interactive: '动态讲解',
  document_pack_plan: '资料包规划',
  video: '课程视频',
}

const jobStatusLabels: Record<string, string> = {
  queued: '排队中',
  running: '生成中',
  completed: '已完成',
  failed: '失败待处理',
  PENDING: '等待提交',
  RUNNING: '生成中',
  SUCCEEDED: '已完成',
  FAILED: '失败',
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z')
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

function statusLabel(value: string) {
  return jobStatusLabels[value] || value
}

export default function AdminConsole({ onClose }: AdminConsoleProps) {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [jobs, setJobs] = useState<AdminGenerationJobRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [busyUserId, setBusyUserId] = useState<number | null>(null)

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [nextOverview, nextUsers, nextJobs] = await Promise.all([
        getAdminOverview(),
        getAdminUsers(),
        getAdminGenerationJobs(),
      ])
      setOverview(nextOverview)
      setUsers(nextUsers.users)
      setJobs(nextJobs.jobs)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '管理员数据暂时无法读取')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const jobCounts = useMemo(() => {
    const counts = { queued: 0, running: 0, completed: 0, failed: 0 }
    for (const item of overview?.generation_jobs || []) {
      const key = item.status.toLowerCase() as keyof typeof counts
      if (key in counts) counts[key] += Number(item.count || 0)
    }
    return counts
  }, [overview])

  const toggleUser = async (record: AdminUserRecord) => {
    const active = Boolean(record.is_active)
    if (record.email.toLowerCase() === '3539921167@qq.com') return
    setBusyUserId(record.id)
    setError('')
    try {
      const result = await updateAdminUser(record.id, { is_active: !active })
      setUsers(current => current.map(item => item.id === record.id ? result.user : item))
      setOverview(current => current ? {
        ...current,
        users: {
          ...current.users,
          active: current.users.active + (active ? -1 : 1),
          inactive: current.users.inactive + (active ? 1 : -1),
        },
      } : current)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '更新用户状态失败')
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <div className="admin-console-layer" role="presentation">
      <button className="admin-console-backdrop" type="button" aria-label="关闭管理员中心" onClick={onClose} />
      <section className="admin-console" role="dialog" aria-modal="true" aria-labelledby="admin-console-title">
        <header className="admin-console-header">
          <div className="admin-console-title-wrap">
            <span className="admin-console-mark"><ShieldCheck size={20} /></span>
            <div>
              <p>RHYME · CONTROL ROOM</p>
              <h1 id="admin-console-title">管理员中心</h1>
              <span>仅主管理员可见 · {overview ? `当前管理 ${overview.users.total} 个账户` : '正在读取系统状态'}</span>
            </div>
          </div>
          <div className="admin-console-actions">
            <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} title="刷新数据">
              <RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} />刷新
            </button>
            <button className="admin-console-close" type="button" onClick={onClose} aria-label="关闭管理员中心"><X size={19} /></button>
          </div>
        </header>

        {error && <div className="admin-console-error" role="alert"><AlertTriangle size={16} /><span>{error}</span><button type="button" onClick={() => setError('')}>知道了</button></div>}

        <div className="admin-console-scroll">
          <div className="admin-console-kpis">
            <article><span className="kpi-icon warm"><Users size={18} /></span><div><small>账户总数</small><strong>{overview?.users.total ?? '—'}</strong><em>{overview?.users.active ?? 0} 个正常使用</em></div></article>
            <article><span className="kpi-icon green"><UserCheck size={18} /></span><div><small>活跃会话</small><strong>{overview?.active_sessions ?? '—'}</strong><em>已登录设备</em></div></article>
            <article><span className="kpi-icon blue"><Activity size={18} /></span><div><small>后台任务</small><strong>{jobCounts.queued + jobCounts.running}</strong><em>{jobCounts.running} 个正在生成</em></div></article>
            <article><span className="kpi-icon rose"><Database size={18} /></span><div><small>待处理任务</small><strong>{jobCounts.failed}</strong><em>{overview?.audit_events ?? 0} 条审计记录</em></div></article>
          </div>

          <div className="admin-console-grid">
            <section className="admin-card admin-users-card">
              <header className="admin-card-header"><div><p>ACCOUNT DIRECTORY</p><h2>账户管理</h2></div><span>{users.length} / {overview?.users.total ?? users.length}</span></header>
              {loading && users.length === 0 ? <div className="admin-console-empty"><RefreshCw className="is-spinning" size={18} />正在读取账户…</div> : users.length === 0 ? <div className="admin-console-empty">暂无账户记录</div> : (
                <div className="admin-users-table-wrap">
                  <table className="admin-users-table">
                    <thead><tr><th>账户</th><th>权限</th><th>状态</th><th>注册时间</th><th /></tr></thead>
                    <tbody>{users.map(record => {
                      const active = Boolean(record.is_active)
                      const isOwner = record.email.toLowerCase() === '3539921167@qq.com'
                      return <tr key={record.id}>
                        <td><div className="admin-user-cell"><span>{record.username.slice(0, 1) || '学'}</span><div><b>{record.username}</b><small>{record.email}</small></div></div></td>
                        <td><span className={`admin-role ${record.role === 'admin' ? 'owner' : ''}`}>{record.role === 'admin' ? '主管理员' : '普通用户'}</span></td>
                        <td><span className={`admin-status ${active ? 'active' : 'inactive'}`}><i />{active ? '正常' : '已停用'}</span></td>
                        <td className="admin-date">{formatDate(record.created_at)}</td>
                        <td>{isOwner ? <span className="admin-protected"><LockKeyhole size={13} />受保护</span> : <button className={`admin-toggle ${active ? '' : 'restore'}`} type="button" disabled={busyUserId === record.id} onClick={() => void toggleUser(record)}>{busyUserId === record.id ? '处理中…' : active ? <><UserRoundX size={13} />停用</> : <><UserCheck size={13} />启用</>}</button>}</td>
                      </tr>
                    })}</tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="admin-card admin-jobs-card">
              <header className="admin-card-header"><div><p>GENERATION QUEUE</p><h2>生成任务</h2></div><span><Clock3 size={14} />最近 {jobs.length} 条</span></header>
              <div className="admin-job-summary"><span><i className="queued" />排队 {jobCounts.queued}</span><span><i className="running" />运行 {jobCounts.running}</span><span><i className="failed" />失败 {jobCounts.failed}</span><span><i className="completed" />完成 {jobCounts.completed}</span></div>
              {jobs.length === 0 ? <div className="admin-console-empty">暂无后台生成记录</div> : <div className="admin-jobs-list">{jobs.slice(0, 12).map(job => <article key={job.job_id}>
                <div className={`admin-job-dot ${job.status.toLowerCase()}`}><Activity size={13} /></div>
                <div className="admin-job-copy"><b>{jobLabels[job.kind] || job.kind}</b><small>{job.job_id.slice(0, 12)} · 用户 #{job.user_id}</small></div>
                <div className={`admin-job-status ${job.status.toLowerCase()}`}><strong>{statusLabel(job.status)}</strong><small>{formatDate(job.finished_at || job.created_at)}</small></div>
              </article>)}</div>}
            </section>
          </div>

          <footer className="admin-console-footer"><span><ShieldCheck size={14} />管理员权限由邮箱绑定：<b>3539921167@qq.com</b></span><span>停用账户会立即撤销其登录会话</span></footer>
        </div>
      </section>
    </div>
  )
}
