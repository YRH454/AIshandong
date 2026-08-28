import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

type Props = {
  active: boolean
  fps: number
}

// Ambient scenes do not need to redraw at the monitor's full refresh rate.
// A demand-driven pulse keeps the motion alive while leaving the GPU idle
// between frames. R3F pointer events can still invalidate immediately.
export function SceneRenderPulse({ active, fps }: Props) {
  const invalidate = useThree(state => state.invalidate)

  useEffect(() => {
    if (!active) return undefined
    const delay = Math.max(16, Math.round(1000 / Math.max(1, fps)))
    let timer: number | undefined
    const renderNextFrame = () => {
      invalidate()
      timer = window.setTimeout(renderNextFrame, delay)
    }
    renderNextFrame()
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [active, fps, invalidate])

  return null
}
