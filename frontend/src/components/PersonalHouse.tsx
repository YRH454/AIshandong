import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Edges, useTexture } from '@react-three/drei'
import {
  ArrowLeft, ChevronRight, Compass, Copy, ExternalLink, Mail, Pause, Play, X,
} from 'lucide-react'
import * as THREE from 'three'
import './PersonalHouse.css'
import { SceneRenderPulse } from './SceneRenderPulse'

type Props = {
  onExit: () => void
  returnTo?: 'rhyme' | 'learning-house'
}

type MilestoneId = 'origin' | 'inner-map' | 'motion'

type Milestone = {
  id: MilestoneId
  order: string
  shortLabel: string
  title: string
  subtitle: string
  story: string
  details: string[]
  asset?: string
  imageFrame?: [number, number]
  position?: [number, number, number]
  travel: number
  accent: string
}

type ScenicMilestone = Milestone & Required<Pick<Milestone, 'asset' | 'imageFrame' | 'position'>>

const EMAIL = '3539921167@qq.com'
const GITHUB_URL = 'https://github.com/YRH454/egosityrh'
const MAX_TRAVEL = 112

const milestones: Milestone[] = [
  {
    id: 'origin',
    order: '01 / ORIGIN',
    shortLabel: 'ORIGIN',
    title: '姚瑞辉 · EGOIST',
    subtitle: 'Big Data Student at Shandong Agricultural University',
    story: 'A personal archive built from code, late-night playlists, animation worlds and quiet obsessions.',
    details: ['Big Data · Shandong Agricultural University', 'EGOIST · the person behind the work'],
    asset: '/egoist-about/avatar.jpg',
    imageFrame: [5.2, 3.5],
    position: [0, .1, -28],
    travel: 18,
    accent: '#d6614d',
  },
  {
    id: 'inner-map',
    order: '02 / INNER MAP',
    shortLabel: 'INNER MAP',
    title: 'A QUIET WORLD',
    subtitle: 'Music · Anime · Niche Culture · Sacred Architecture',
    story: 'Drawn to places with atmosphere: a song after midnight, animation worlds and the stillness of old churches.',
    details: ['Music and anime are part of the everyday rhythm', 'A soft spot for gothic and sacred architecture'],
    asset: '/egoist-about/gothic-stage-design.jpg',
    imageFrame: [5.4, 3.5],
    position: [1.1, .1, -70],
    travel: 62,
    accent: '#725eb4',
  },
  {
    id: 'motion',
    order: '03 / IN MOTION',
    shortLabel: 'IN MOTION',
    title: 'KEEP IN TOUCH',
    subtitle: 'Data curiosity · Practical code · A public corner',
    story: 'A place for projects, small discoveries and the fragments that make a person feel less like a profile card.',
    details: ['GitHub: YRH454 · repository currently private'],
    travel: 102,
    accent: '#4c8b88',
  },
]

useTexture.preload('/egoist-about/avatar.jpg')
useTexture.preload('/egoist-about/gothic-stage-design.jpg')

function hasScenicContent(milestone: Milestone): milestone is ScenicMilestone {
  return Boolean(milestone.asset && milestone.imageFrame && milestone.position)
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function reducedScene() {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return window.matchMedia('(max-width: 760px)').matches
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || (navigator.hardwareConcurrency || 8) <= 4
    || (nav.deviceMemory || 8) <= 4
}

function getMilestoneForTravel(travel: number): MilestoneId {
  if (travel < 41) return 'origin'
  if (travel < 84) return 'inner-map'
  return 'motion'
}

function createPaperPlaneGeometry() {
  const geometry = new THREE.BufferGeometry()
  const vertices = new Float32Array([
    0, 0, -1.45,
    -1.18, .04, .25,
    1.18, .04, .25,
    0, .16, -.45,
    0, .12, .54,
    -.3, .07, .8,
    .3, .07, .8,
    0, .1, .63,
    0, -.03, -1.45,
    -1.18, -.03, .25,
    1.18, -.03, .25,
    0, 0, .54,
  ])
  const indices = [
    0, 1, 3, 1, 4, 3, 1, 5, 4, 5, 7, 4,
    0, 3, 2, 3, 4, 2, 4, 6, 2, 4, 7, 6,
    8, 11, 9, 8, 10, 11,
    0, 8, 1, 8, 9, 1, 1, 9, 5,
    0, 2, 8, 8, 2, 10, 2, 6, 10,
    5, 9, 11, 5, 11, 7, 6, 7, 11, 6, 11, 10,
  ]
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function PaperPlane() {
  const geometry = useMemo(createPaperPlaneGeometry, [])
  const trailPositions = useMemo(() => new Float32Array([
    0, 0, -1.45,
    0, .16, -.45,
    0, .12, .54,
    0, .1, .63,
  ]), [])
  return <group scale={.34} rotation={[.08, 0, 0]}>
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#fff9ef" roughness={.82} metalness={0} side={THREE.DoubleSide} />
      <Edges threshold={13} color="#8f9aa3" linewidth={1.2} />
    </mesh>
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[trailPositions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#8f9aa3" />
    </line>
  </group>
}

const cloudPuffs: Array<[number, number, number, number]> = [
  [-1.1, -.05, .1, .72], [-.55, .36, -.08, .95], [0, .12, 0, 1.15],
  [.72, .3, .1, .9], [1.2, -.05, .12, .62], [.25, -.35, .02, .76],
]

function CloudCluster({ position, scale = 1, opacity = .88, lowPower = false }: {
  position: [number, number, number]
  scale?: number
  opacity?: number
  lowPower?: boolean
}) {
  const puffs = lowPower ? cloudPuffs.slice(0, 3) : cloudPuffs
  return <group position={position} scale={scale}>
    {puffs.map(([x, y, z, size], index) => <mesh key={`${x}-${y}-${index}`} position={[x, y, z]}>
      <sphereGeometry args={[size, lowPower ? 10 : 22, lowPower ? 8 : 16]} />
      <meshStandardMaterial color="#fff9f1" transparent opacity={opacity} roughness={1} depthWrite={false} />
    </mesh>)}
  </group>
}

function SkyField({ lowPower = false }: { lowPower?: boolean }) {
  const clouds = useMemo(() => [
    [-6.6, 3.6, -12, 1.4, .46], [7.2, 2.2, -17, 1.2, .55], [-5.3, -3.4, -23, 1.8, .58],
    [6.1, -2.8, -32, 1.28, .55], [-7.7, .5, -39, 1.5, .52], [5.2, 3.7, -48, 1.8, .62],
    [-7.2, 3.6, -57, 1.4, .52], [6.7, -.4, -68, 1.55, .56], [-5.8, -3.4, -79, 1.32, .5],
    [7.2, 2.8, -89, 1.7, .58], [-7.8, -.8, -102, 1.5, .56], [5.6, -3.3, -113, 1.42, .52],
    [-7.1, 3.4, -122, 1.8, .57], [7.6, .1, -141, 1.45, .53], [-5.8, -3.6, -151, 1.75, .6],
  ] as Array<[number, number, number, number, number]>, [])
  return <>
    {clouds.map(([x, y, z, scale, opacity], index) => <CloudCluster key={`${x}-${z}-${index}`} position={[x, y, z]} scale={scale} opacity={opacity} lowPower={lowPower} />)}
    <mesh position={[-10, 6, -88]} rotation={[0, .1, -.35]}>
      <circleGeometry args={[2.9, lowPower ? 24 : 40]} />
      <meshBasicMaterial color="#fff2cd" transparent opacity={.64} />
    </mesh>
  </>
}

function PhotoFrame({ milestone, onSelect }: { milestone: ScenicMilestone; onSelect: (id: MilestoneId) => void }) {
  const texture = useTexture(milestone.asset)
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const [width, height] = milestone.imageFrame

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    texture.needsUpdate = true
  }, [texture])

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : ''
    return () => { document.body.style.cursor = '' }
  }, [hovered])

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const float = Math.sin(state.clock.elapsedTime * .66 + milestone.travel) * .055
    const targetScale = hovered ? 1.04 : 1
    const next = THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, 7, delta)
    groupRef.current.scale.setScalar(next)
    groupRef.current.position.y = float
  })

  return <group ref={groupRef} onClick={() => onSelect(milestone.id)} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
    <mesh position={[0, 0, -.08]}>
      <planeGeometry args={[width + .34, height + .34]} />
      <meshBasicMaterial color="#f8f4eb" side={THREE.DoubleSide} />
    </mesh>
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, -height / 2 - .15, .03]}>
      <planeGeometry args={[width * .66, .045]} />
      <meshBasicMaterial color={milestone.accent} side={THREE.DoubleSide} />
    </mesh>
  </group>
}

function PhotoFramePlaceholder({ milestone }: { milestone: ScenicMilestone }) {
  const [width, height] = milestone.imageFrame
  return <group>
    <mesh position={[0, 0, -.08]}>
      <planeGeometry args={[width + .34, height + .34]} />
      <meshBasicMaterial color="#f8f4eb" side={THREE.DoubleSide} />
    </mesh>
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color={milestone.accent} transparent opacity={.32} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, -height / 2 - .15, .03]}>
      <planeGeometry args={[width * .66, .045]} />
      <meshBasicMaterial color={milestone.accent} side={THREE.DoubleSide} />
    </mesh>
  </group>
}

function StoryMilestone({ milestone, onSelect }: { milestone: ScenicMilestone; onSelect: (id: MilestoneId) => void }) {
  const groupRef = useRef<THREE.Group>(null)
  const contentRef = useRef<THREE.Group>(null)
  const opacityRef = useRef(0)

  useFrame((_, delta) => {
    if (!groupRef.current || !contentRef.current) return
    // The milestone only sits under the translating route group. Reading the
    // two local z offsets avoids a full matrix/world-position traversal on
    // every frame while preserving the exact fade thresholds.
    const worldZ = groupRef.current.position.z + (groupRef.current.parent?.position.z || 0)
    let targetOpacity = 0
    if (worldZ >= -54 && worldZ < -29) targetOpacity = (worldZ + 54) / 25
    else if (worldZ >= -29 && worldZ < -7) targetOpacity = 1
    else if (worldZ >= -7 && worldZ < 3) targetOpacity = 1 - (worldZ + 7) / 10
    opacityRef.current = THREE.MathUtils.damp(opacityRef.current, targetOpacity, 6.8, delta)
    contentRef.current.visible = opacityRef.current > .015
    contentRef.current.position.y = (1 - opacityRef.current) * -.65
    contentRef.current.scale.setScalar(.86 + opacityRef.current * .14)
  })

  const [frameWidth, frameHeight] = milestone.imageFrame
  return <group ref={groupRef} position={milestone.position}>
    <group ref={contentRef}>
      <mesh position={[0, 2.86, .33]}>
        <planeGeometry args={[4.45, .075]} />
        <meshBasicMaterial color={milestone.accent} transparent opacity={.86} />
      </mesh>
      <mesh position={[0, 2.34, .33]}>
        <planeGeometry args={[6.1, .024]} />
        <meshBasicMaterial color="#334b59" transparent opacity={.38} />
      </mesh>
      <mesh position={[0, 1.95, .33]}>
        <planeGeometry args={[3.55, .018]} />
        <meshBasicMaterial color="#526d78" transparent opacity={.28} />
      </mesh>
      <group position={[0, -.72, .15]}>
        <Suspense fallback={<PhotoFramePlaceholder milestone={milestone} />}>
          <PhotoFrame milestone={milestone} onSelect={onSelect} />
        </Suspense>
      </group>
      <mesh position={[-frameWidth / 2 - .28, -1.9, .29]}>
        <circleGeometry args={[.08, 18]} />
        <meshBasicMaterial color={milestone.accent} />
      </mesh>
      <mesh position={[0, -frameHeight / 2 - .15, -.16]}>
        <planeGeometry args={[frameWidth + 1.25, .018]} />
        <meshBasicMaterial color="#9fb4c2" transparent opacity={.42} />
      </mesh>
    </group>
  </group>
}

function FlightController({
  worldRef,
  planeRef,
  routeTarget,
  autoFly,
  onProgress,
  onActiveChange,
}: {
  worldRef: React.RefObject<THREE.Group | null>
  planeRef: React.RefObject<THREE.Group | null>
  routeTarget: number
  autoFly: boolean
  onProgress: (travel: number) => void
  onActiveChange: (id: MilestoneId) => void
}) {
  const { camera, pointer } = useThree()
  const targetRef = useRef(routeTarget)
  const currentRef = useRef(0)
  const lastPublished = useRef(-1)
  const lastPublishedAt = useRef(-Infinity)
  const activeRef = useRef<MilestoneId>('origin')

  useEffect(() => { targetRef.current = routeTarget }, [routeTarget])

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      targetRef.current = THREE.MathUtils.clamp(targetRef.current + event.deltaY * .025, 0, MAX_TRAVEL)
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  useFrame((state, delta) => {
    if (autoFly) targetRef.current = Math.min(MAX_TRAVEL, targetRef.current + delta * 6.5)
    const current = THREE.MathUtils.damp(currentRef.current, targetRef.current, 4.7, delta)
    currentRef.current = current
    if (worldRef.current) worldRef.current.position.z = current

    const bank = Math.sin(current * .095) * .038 + pointer.x * .017
    const pitch = Math.sin(current * .047) * .018 - pointer.y * .011
    camera.position.x = THREE.MathUtils.damp(camera.position.x, pointer.x * .09, 4, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, pointer.y * .06, 4, delta)
    camera.rotation.set(pitch, Math.sin(current * .035) * .024, bank)

    if (planeRef.current) {
      planeRef.current.rotation.x = THREE.MathUtils.damp(planeRef.current.rotation.x, .08 + pitch * 3.4, 5, delta)
      planeRef.current.rotation.z = THREE.MathUtils.damp(planeRef.current.rotation.z, -bank * 2.1, 5, delta)
      planeRef.current.position.y = -.92 + Math.sin(state.clock.elapsedTime * 1.4) * .035
    }

    // The route bar already interpolates its visual progress in CSS. Publishing
    // this value at roughly 8 fps keeps it smooth while avoiding a full portal
    // UI reconciliation on nearly every 3D frame during auto-flight.
    if (Math.abs(current - lastPublished.current) > .65 && state.clock.elapsedTime - lastPublishedAt.current >= .12) {
      lastPublished.current = current
      lastPublishedAt.current = state.clock.elapsedTime
      onProgress(current)
    }
    const nextActive = getMilestoneForTravel(current)
    if (nextActive !== activeRef.current) {
      activeRef.current = nextActive
      onActiveChange(nextActive)
    }
  })
  return null
}

const FlightScene = memo(function FlightScene({
  routeTarget,
  autoFly,
  lowPower,
  onProgress,
  onSelect,
  onActiveChange,
}: {
  routeTarget: number
  autoFly: boolean
  lowPower: boolean
  onProgress: (travel: number) => void
  onSelect: (id: MilestoneId) => void
  onActiveChange: (id: MilestoneId) => void
}) {
  const worldRef = useRef<THREE.Group>(null)
  const planeRef = useRef<THREE.Group>(null)
  return <>
    <color attach="background" args={['#9fcbe2']} />
    <fog attach="fog" args={['#9fcbe2', 24, 150]} />
    <ambientLight intensity={1.5} color="#eef7ff" />
    <directionalLight position={[4, 7, 3]} intensity={1.75} color="#fff8e8" />
    <FlightController worldRef={worldRef} planeRef={planeRef} routeTarget={routeTarget} autoFly={autoFly} onProgress={onProgress} onActiveChange={onActiveChange} />
    <group ref={worldRef}>
      <SkyField lowPower={lowPower} />
      {milestones.filter(hasScenicContent).map(milestone => <StoryMilestone key={milestone.id} milestone={milestone} onSelect={onSelect} />)}
    </group>
    <group ref={planeRef} position={[0, -.92, -2.7]}><PaperPlane /></group>
  </>
})

function Fallback({ onSelect }: { onSelect: (id: MilestoneId) => void }) {
  return <div className="personal-flight-fallback">
    <Compass size={28} />
    <h1>EGOIST / PERSONAL FLIGHT</h1>
    <p>3D acceleration is unavailable here. The personal route is still ready to explore.</p>
    <div>{milestones.map(milestone => <button key={milestone.id} type="button" onClick={() => onSelect(milestone.id)}>{milestone.order}</button>)}</div>
  </div>
}

export default function PersonalHouse({ onExit, returnTo = 'rhyme' }: Props) {
  const [canUseWebGL] = useState(supportsWebGL)
  const [lowPower] = useState(reducedScene)
  const [pageVisible, setPageVisible] = useState(() => !document.hidden)
  const [activeId, setActiveId] = useState<MilestoneId>('origin')
  const [routeTarget, setRouteTarget] = useState(0)
  const [travel, setTravel] = useState(0)
  const [autoFly, setAutoFly] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])
  const active = milestones.find(milestone => milestone.id === activeId) ?? milestones[0]

  const selectMilestone = useCallback((id: MilestoneId) => {
    const milestone = milestones.find(item => item.id === id)
    if (!milestone) return
    setActiveId(id)
    setRouteTarget(milestone.travel)
    setAutoFly(false)
  }, [])

  useEffect(() => {
    document.body.classList.add('personal-house-open')
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('personal-house-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onExit])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  const copyContact = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL)
    } catch {
      const input = document.createElement('textarea')
      input.value = EMAIL
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    setNotice('Contact card copied')
  }

  const finish = travel >= MAX_TRAVEL - 1
  return createPortal(<div className="personal-flight-layer" role="dialog" aria-modal="true" aria-label="EGOIST personal flight room">
    <section className="personal-flight">
      <header className="personal-flight-topbar">
        <button className="personal-flight-back" type="button" onClick={onExit}><ArrowLeft size={16} /><span>{returnTo === 'learning-house' ? 'BACK TO LEARNING HOUSE' : 'BACK TO RHYME'}</span></button>
        <div className="personal-flight-brand"><strong>EGOIST</strong><span>PERSONAL FLIGHT / ABOUT ROOM</span></div>
        <div className="personal-flight-actions">
          <button type="button" className={autoFly ? 'active' : ''} onClick={() => setAutoFly(value => !value)} disabled={finish}>
            {autoFly ? <Pause size={14} /> : <Play size={14} />}<span>{autoFly ? 'PAUSE' : 'AUTO FLY'}</span>
          </button>
          <button type="button" aria-label="Close personal flight room" onClick={onExit}><X size={18} /></button>
        </div>
      </header>

      <main className="personal-flight-stage">
        {canUseWebGL ? <Canvas
          className="personal-flight-canvas"
          frameloop={pageVisible ? 'demand' : 'never'}
          camera={{ position: [0, 0, 0], fov: 51, near: .1, far: 220 }}
          dpr={lowPower ? 1 : [1, 1.3]}
          gl={{ antialias: !lowPower, alpha: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => gl.setClearColor(new THREE.Color('#9fcbe2'), 0)}
        >
          <Suspense fallback={null}>
            <FlightScene routeTarget={routeTarget} autoFly={autoFly} lowPower={lowPower} onProgress={setTravel} onSelect={selectMilestone} onActiveChange={setActiveId} />
          </Suspense>
          <SceneRenderPulse active={pageVisible} fps={lowPower ? 24 : 40} />
        </Canvas> : <Fallback onSelect={selectMilestone} />}

        <div className="personal-flight-hero" aria-hidden={travel > 8}>
          <span>SCROLL TO FLY</span>
          <h1>One room.<br />One personal route.</h1>
          <p>Move through the sky to meet the person behind EGOIST.</p>
        </div>

        <nav className="personal-flight-route" aria-label="Personal story route">
          <div className="personal-flight-route-line"><i style={{ transform: `scaleX(${Math.min(1, travel / MAX_TRAVEL)})` }} /></div>
          {milestones.map(milestone => <button key={milestone.id} type="button" className={active.id === milestone.id ? 'active' : ''} onClick={() => selectMilestone(milestone.id)}>
            <b>{milestone.order.slice(0, 2)}</b><span>{milestone.shortLabel}</span>
          </button>)}
        </nav>

        <aside className={`personal-flight-card${active.id === 'motion' ? ' personal-flight-card-center' : ''}`} aria-live="polite">
          <span className="personal-flight-card-order" style={{ color: active.accent }}>{active.order}</span>
          <h2>{active.title}</h2>
          <strong>{active.subtitle}</strong>
          <p>{active.story}</p>
          <ul>{active.details.map(item => <li key={item}>{item}</li>)}</ul>
          <div className="personal-flight-card-actions">
            <button type="button" onClick={() => window.open(GITHUB_URL, '_blank', 'noopener,noreferrer')}><ExternalLink size={14} />GITHUB</button>
            <button type="button" onClick={() => void copyContact()}><Mail size={14} />COPY CONTACT</button>
          </div>
          <button className="personal-flight-next" type="button" onClick={() => {
            const currentIndex = milestones.findIndex(item => item.id === active.id)
            selectMilestone(milestones[Math.min(currentIndex + 1, milestones.length - 1)].id)
          }} disabled={active.id === 'motion'}>
            {active.id === 'motion' ? 'END OF THIS ROOM' : 'CONTINUE THE FLIGHT'}<ChevronRight size={15} />
          </button>
        </aside>

        <button className="personal-flight-contact" type="button" onClick={() => void copyContact()}><Copy size={13} />COPY CONTACT CARD</button>
        {notice && <div className="personal-flight-notice" role="status"><Copy size={13} />{notice}</div>}
      </main>
    </section>
  </div>, document.body)
}
