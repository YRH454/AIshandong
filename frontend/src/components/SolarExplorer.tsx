import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, LoaderCircle, Orbit, RotateCcw, X } from 'lucide-react'
import './SolarExplorer.css'

type Props = {
  onExit: () => void
}

export default function SolarExplorer({ onExit }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    document.body.classList.add('solar-explorer-open')
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', key)
    return () => {
      document.body.classList.remove('solar-explorer-open')
      window.removeEventListener('keydown', key)
    }
  }, [onExit])

  const reload = () => {
    setLoaded(false)
    setRefreshKey(current => current + 1)
  }

  return createPortal(<div className="solar-explorer-layer" role="dialog" aria-modal="true" aria-label="太阳系探索舱">
    <section className="solar-explorer-shell">
      <header className="solar-explorer-topbar">
        <button type="button" className="solar-explorer-back" onClick={onExit}><ArrowLeft size={17} /><span>返回学习屋</span></button>
        <div className="solar-explorer-brand"><Orbit size={17} /><span>太阳系探索舱</span><small>本地沉浸式科学探索</small></div>
        <div className="solar-explorer-actions">
          <button type="button" onClick={reload} aria-label="重新加载太阳系探索"><RotateCcw size={16} /></button>
          <button type="button" onClick={onExit} aria-label="关闭太阳系探索"><X size={19} /></button>
        </div>
      </header>
      <div className="solar-explorer-stage">
        {!loaded && <div className="solar-explorer-loading"><LoaderCircle size={27} /><strong>正在点亮太阳系…</strong><span>轨道、任务和互动实验均在本地加载</span></div>}
        <iframe key={refreshKey} className={loaded ? 'loaded' : ''} src="/solar-explorer/index.html" title="太阳系 3D 科学探索" onLoad={() => setLoaded(true)} />
      </div>
    </section>
  </div>, document.body)
}
