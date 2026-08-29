import { useEffect, useRef, useState, type RefObject } from 'react'

type Point = { x: number; y: number }

type EyeProps = {
  blinking?: boolean
  look?: Point
  pointer?: Point
  size?: number
}

function usePointerPosition() {
  const [pointer, setPointer] = useState<Point>({ x: 0, y: 0 })

  useEffect(() => {
    let frame = 0
    let nextPoint = pointer
    const onMove = (event: MouseEvent) => {
      nextPoint = { x: event.clientX, y: event.clientY }
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        setPointer(nextPoint)
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return pointer
}

function Eye({ blinking = false, look, pointer, size = 18 }: EyeProps) {
  const eyeRef = useRef<HTMLSpanElement>(null)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })

  useEffect(() => {
    if (look) {
      setOffset(look)
      return
    }
    const eye = eyeRef.current?.getBoundingClientRect()
    if (!eye) return
    const dx = pointer?.x ?? 0
    const dy = pointer?.y ?? 0
    const deltaX = dx - (eye.left + eye.width / 2)
    const deltaY = dy - (eye.top + eye.height / 2)
    const distance = Math.min(Math.hypot(deltaX, deltaY), size * .28)
    const angle = Math.atan2(deltaY, deltaX)
    setOffset({ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance })
  }, [look, pointer, size])

  return (
    <span ref={eyeRef} className="auth-character-eye" style={{ width: size, height: blinking ? 3 : size }}>
      {!blinking && <i style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} />}
    </span>
  )
}

function Eyes({ blinking = false, look, pointer, size = 18, gap = 8 }: EyeProps & { gap?: number }) {
  return (
    <span className="auth-character-eyes" style={{ gap }}>
      <Eye blinking={blinking} look={look} pointer={pointer} size={size} />
      <Eye blinking={blinking} look={look} pointer={pointer} size={size} />
    </span>
  )
}

function useBlink(delay: number) {
  const [blinking, setBlinking] = useState(false)

  useEffect(() => {
    let active = true
    let timeout: number | undefined
    const schedule = () => {
      timeout = window.setTimeout(() => {
        if (!active) return
        setBlinking(true)
        window.setTimeout(() => {
          if (!active) return
          setBlinking(false)
          schedule()
        }, 140)
      }, delay + Math.random() * 3600)
    }
    schedule()
    return () => {
      active = false
      if (timeout) window.clearTimeout(timeout)
    }
  }, [delay])

  return blinking
}

function characterTilt(ref: RefObject<HTMLDivElement | null>, pointer: Point) {
  const rect = ref.current?.getBoundingClientRect()
  if (!rect) return 0
  const center = rect.left + rect.width / 2
  return Math.max(-6, Math.min(6, (pointer.x - center) / -120))
}

type AuthAnimatedCharactersProps = {
  isTyping?: boolean
  showPassword?: boolean
  passwordLength?: number
}

/**
 * Adapted from CareerCompass' MIT-licensed animated-characters component.
 * The interaction is kept (pointer-following eyes, blinking and password
 * reaction), while the upstream brand, copy and layout are intentionally not
 * included.
 */
export function AuthAnimatedCharacters({ isTyping = false, showPassword = false, passwordLength = 0 }: AuthAnimatedCharactersProps) {
  const pointer = usePointerPosition()
  const purpleRef = useRef<HTMLDivElement>(null)
  const blackRef = useRef<HTMLDivElement>(null)
  const orangeRef = useRef<HTMLDivElement>(null)
  const yellowRef = useRef<HTMLDivElement>(null)
  const purpleBlink = useBlink(2500)
  const blackBlink = useBlink(4200)
  const [lookAtEachOther, setLookAtEachOther] = useState(false)

  useEffect(() => {
    if (!isTyping) {
      setLookAtEachOther(false)
      return
    }
    setLookAtEachOther(true)
    const timeout = window.setTimeout(() => setLookAtEachOther(false), 800)
    return () => window.clearTimeout(timeout)
  }, [isTyping])

  const hidingPassword = passwordLength > 0 && !showPassword
  const revealingPassword = passwordLength > 0 && showPassword
  const purpleTilt = characterTilt(purpleRef, pointer)
  const blackTilt = characterTilt(blackRef, pointer)
  const orangeTilt = characterTilt(orangeRef, pointer)
  const yellowTilt = characterTilt(yellowRef, pointer)

  return (
    <div className="auth-characters" aria-hidden="true">
      <div
        ref={purpleRef}
        className={`auth-character auth-character-purple${isTyping || hidingPassword ? ' is-alert' : ''}`}
        style={{ transform: `skewX(${revealingPassword ? 0 : purpleTilt - (isTyping || hidingPassword ? 3 : 0)}deg) translateX(${isTyping || hidingPassword ? 8 : 0}px)` }}
      >
        <Eyes blinking={purpleBlink} pointer={pointer} look={revealingPassword ? { x: -4, y: -3 } : lookAtEachOther ? { x: 3, y: 4 } : undefined} />
      </div>

      <div
        ref={blackRef}
        className="auth-character auth-character-black"
        style={{ transform: `skewX(${revealingPassword ? 0 : blackTilt + (lookAtEachOther ? 4 : 0)}deg)` }}
      >
        <Eyes blinking={blackBlink} pointer={pointer} size={16} gap={6} look={revealingPassword ? { x: -4, y: -3 } : lookAtEachOther ? { x: 0, y: -4 } : undefined} />
      </div>

      <div
        ref={orangeRef}
        className="auth-character auth-character-orange"
        style={{ transform: `skewX(${revealingPassword ? 0 : orangeTilt}deg)` }}
      >
        <span className="auth-character-pupils">
          <i style={{ transform: `translate(${revealingPassword ? -4 : 0}px, ${revealingPassword ? -3 : 0}px)` }} />
          <i style={{ transform: `translate(${revealingPassword ? -4 : 0}px, ${revealingPassword ? -3 : 0}px)` }} />
        </span>
      </div>

      <div
        ref={yellowRef}
        className="auth-character auth-character-yellow"
        style={{ transform: `skewX(${revealingPassword ? 0 : yellowTilt}deg)` }}
      >
        <span className="auth-character-pupils">
          <i style={{ transform: `translate(${revealingPassword ? -4 : 0}px, ${revealingPassword ? -3 : 0}px)` }} />
          <i style={{ transform: `translate(${revealingPassword ? -4 : 0}px, ${revealingPassword ? -3 : 0}px)` }} />
        </span>
        <span className="auth-character-mouth" />
      </div>
    </div>
  )
}
