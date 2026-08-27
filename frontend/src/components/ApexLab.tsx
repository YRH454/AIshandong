import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Maximize2, X } from 'lucide-react'
import './ApexLab.css'

type Props = {
  onExit: () => void
}

export default function ApexLab({ onExit }: Props) {
  useEffect(() => {
    document.body.classList.add('apex-lab-open')
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.classList.remove('apex-lab-open')
      window.removeEventListener('keydown', handleKey)
    }
  }, [onExit])

  return createPortal(
    <section className="apex-lab-layer" role="dialog" aria-modal="true" aria-label="Apex 中文系统交互实验馆">
      <iframe className="apex-lab-frame" title="Apex 中文系统交互实验馆" src="/apex-lab/index.html" />
      <button type="button" className="apex-lab-return" onClick={onExit}>
        <ArrowLeft size={17} />
        返回学习屋
      </button>
      <a className="apex-lab-new-window" href="/apex-lab/index.html" target="_blank" rel="noreferrer" aria-label="在新标签页打开实验馆" title="在新标签页打开">
        <Maximize2 size={17} />
      </a>
      <button type="button" className="apex-lab-close" onClick={onExit} aria-label="返回学习屋">
        <X size={18} />
      </button>
    </section>,
    document.body,
  )
}
