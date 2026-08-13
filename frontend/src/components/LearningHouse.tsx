import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { ArrowLeft, ChevronRight, Keyboard, MapPinned, MousePointer2, Sparkles, X } from 'lucide-react'
import * as THREE from 'three'

type Language = 'zh-CN' | 'en'
type RoomId = 'document' | 'practice' | 'map' | 'dynamic'

type Room = {
  id: RoomId
  title: string
  titleEn: string
  shortTitle: string
  shortTitleEn: string
  description: string
  descriptionEn: string
  empty: string
  emptyEn: string
  color: string
  deepColor: string
  z: number
  side: 'left' | 'right'
}

type LearningHouseProps = {
  language?: Language
  onExit: () => void
}

const rooms: Room[] = [
  {
    id: 'document', title: '学习文档室', titleEn: 'Study documents', shortTitle: '学习文档', shortTitleEn: 'Documents',
    description: '讲义、公式手册、术语表和考前速记会在这里安静归档。',
    descriptionEn: 'Notes, formula sheets, glossaries, and exam briefs will be kept here.',
    empty: '等待第一份学习文档', emptyEn: 'Waiting for the first document', color: '#78b59c', deepColor: '#235b47', z: -7, side: 'left',
  },
  {
    id: 'practice', title: '练习检验室', titleEn: 'Practice studio', shortTitle: '练习检验', shortTitleEn: 'Practice',
    description: '分层练习、作答结果和错题复盘将在这个房间形成反馈。',
    descriptionEn: 'Practice sets, results, and mistake reviews will build feedback here.',
    empty: '等待第一次练习检验', emptyEn: 'Waiting for the first practice', color: '#e2a85b', deepColor: '#80501e', z: -20, side: 'right',
  },
  {
    id: 'map', title: '知识图解室', titleEn: 'Knowledge map room', shortTitle: '知识图解', shortTitleEn: 'Maps',
    description: '生成的知识结构、关系图和可编辑画布会在这里展开。',
    descriptionEn: 'Generated structures, relationship maps, and editable canvases will live here.',
    empty: '等待第一张知识图解', emptyEn: 'Waiting for the first map', color: '#78a9ce', deepColor: '#285879', z: -33, side: 'left',
  },
  {
    id: 'dynamic', title: '动态讲解室', titleEn: 'Dynamic lesson room', shortTitle: '动态讲解', shortTitleEn: 'Dynamic lessons',
    description: '可播放、可交互的学习演示将在这块屏幕上继续讲解。',
    descriptionEn: 'Playable, interactive learning presentations will continue on this screen.',
    empty: '等待第一段动态讲解', emptyEn: 'Waiting for the first dynamic lesson', color: '#ad94d4', deepColor: '#573f83', z: -46, side: 'right',
  },
]

const cameraStartZ = 5.5
const cameraEndZ = -48.5

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function shouldUseLowPowerMode() {
  const device = navigator as Navigator & { deviceMemory?: number }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || window.matchMedia('(max-width: 760px)').matches
    || (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4)
    || (typeof device.deviceMemory === 'number' && device.deviceMemory <= 4)
}

function nearestRoomId(z: number) {
  return rooms.reduce((nearest, room) => Math.abs(room.z - z) < Math.abs(nearest.z - z) ? room : nearest, rooms[0]).id
}

function clampZ(value: number) {
  return Math.max(cameraEndZ, Math.min(cameraStartZ, value))
}

function CorridorNavigation({ focusRoomId, onRoomChange }: { focusRoomId: RoomId; onRoomChange: (id: RoomId) => void }) {
  const { camera, gl } = useThree()
  const targetZ = useRef(cameraStartZ)
  const focusedRoom = useRef<RoomId>(focusRoomId)
  const lastRoom = useRef<RoomId>(nearestRoomId(cameraStartZ))
  const lookTarget = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const room = rooms.find(item => item.id === focusRoomId)
    if (!room || focusedRoom.current === focusRoomId) return
    focusedRoom.current = focusRoomId
    targetZ.current = clampZ(room.z + 4.2)
  }, [focusRoomId])

  useEffect(() => {
    const move = (amount: number) => {
      focusedRoom.current = '' as RoomId
      targetZ.current = clampZ(targetZ.current + amount)
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      move(event.deltaY * 0.025)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
        event.preventDefault()
        move(-3.2)
      }
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
        event.preventDefault()
        move(3.2)
      }
    }
    const canvas = gl.domElement
    canvas.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [gl])

  useFrame((_, delta) => {
    const speed = 1 - Math.exp(-delta * 5.4)
    camera.position.z += (targetZ.current - camera.position.z) * speed
    camera.position.x += (0 - camera.position.x) * speed
    lookTarget.set(0, 1.62, camera.position.z - 7.5)
    camera.lookAt(lookTarget)
    const current = nearestRoomId(camera.position.z)
    if (current !== lastRoom.current) {
      lastRoom.current = current
      onRoomChange(current)
    }
  })
  return null
}

function RailLight({ z, color }: { z: number; color: string }) {
  return <>
    {[-1, 1].map(side => <mesh key={`${z}-${side}`} position={[side * 2.78, 3.35, z]}>
      <boxGeometry args={[0.12, 0.12, 3.4]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
    </mesh>)}
  </>
}

function RoomSignature({ room }: { room: Room }) {
  const signX = room.side === 'left' ? -3.02 : 3.02
  const direction = room.side === 'left' ? 1 : -1
  if (room.id === 'document') return <group position={[signX + direction * .38, 1.2, room.z + .58]}>
    {[0, 1, 2, 3].map(index => <mesh key={index} position={[0, index * .3, (index - 1.5) * .18]} rotation={[0, 0, .03 * index]}>
      <boxGeometry args={[.22, .22, .74]} /><meshStandardMaterial color={index % 2 ? '#e8f3ec' : room.color} roughness={.72} />
    </mesh>)}
  </group>
  if (room.id === 'practice') return <group position={[signX + direction * .35, 1.03, room.z]}>
    {[[-.28, .2], [.24, .16], [-.1, -.23], [.39, -.22]].map(([y, z], index) => <mesh key={index} position={[0, y, z]} rotation={[0, .22, .08]}>
      <boxGeometry args={[.18, .34, .34]} /><meshStandardMaterial color={index % 2 ? '#fff1d9' : room.color} roughness={.66} />
    </mesh>)}
  </group>
  if (room.id === 'map') return <group position={[signX + direction * .35, 1.12, room.z]}>
    <mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[.42, .055, 12, 32]} /><meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={.25} /></mesh>
    {[-.28, .3].map((z, index) => <mesh key={z} position={[0, index ? .18 : -.17, z]}><sphereGeometry args={[.11, 18, 18]} /><meshStandardMaterial color={index ? '#deedf8' : room.color} /></mesh>)}
  </group>
  return <group position={[signX + direction * .35, 1.1, room.z]}>
    <mesh rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[.1, .74, 1.04]} /><meshStandardMaterial color="#231d31" roughness={.55} /></mesh>
    <mesh position={[direction * -.065, 0, 0]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[.68, .92]} /><meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={.38} /></mesh>
    <mesh position={[direction * -.08, 0, 0]} rotation={[0, Math.PI / 2, 0]}><circleGeometry args={[.13, 24]} /><meshStandardMaterial color="#fbf8ff" emissive="#fbf8ff" emissiveIntensity={.35} /></mesh>
  </group>
}

function LearningRoom({ room, active, language, onFocus }: { room: Room; active: boolean; language: Language; onFocus: () => void }) {
  const side = room.side === 'left' ? -1 : 1
  const signX = side * 2.94
  const zh = language !== 'en'
  return <group onClick={event => { event.stopPropagation(); onFocus() }}>
    <mesh position={[side * 3.45, 1.9, room.z]} castShadow receiveShadow>
      <boxGeometry args={[.46, 3.8, 5.8]} />
      <meshStandardMaterial color={active ? room.deepColor : '#dce5df'} roughness={.78} />
    </mesh>
    <mesh position={[signX, 1.78, room.z]} castShadow>
      <boxGeometry args={[.18, 3.16, 2.82]} />
      <meshStandardMaterial color={room.color} emissive={room.color} emissiveIntensity={active ? .46 : .18} roughness={.5} />
    </mesh>
    <mesh position={[side * 2.83, 1.78, room.z]}>
      <boxGeometry args={[.14, 2.7, 2.3]} />
      <meshStandardMaterial color="#f8fbf8" roughness={.65} metalness={.03} />
    </mesh>
    <mesh position={[side * 2.72, 1.78, room.z]}>
      <boxGeometry args={[.08, 2.46, 2.04]} />
      <meshStandardMaterial color={room.deepColor} emissive={room.color} emissiveIntensity={active ? .18 : .06} roughness={.5} />
    </mesh>
    <mesh position={[side * 2.66, 2.75, room.z]}>
      <boxGeometry args={[.04, .09, 1.7]} />
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={.24} />
    </mesh>
    <mesh position={[side * 2.62, 1.08, room.z + .9]}>
      <sphereGeometry args={[.08, 18, 18]} />
      <meshStandardMaterial color="#e5f1e9" metalness={.58} roughness={.28} />
    </mesh>
    <RoomSignature room={room} />
    <Html position={[side * 2.58, 2.12, room.z]} center className="learning-house-room-label" distanceFactor={11} style={{ pointerEvents: 'none' }}>
      <div className={active ? 'is-active' : ''}>
        <span>{zh ? room.shortTitle : room.shortTitleEn}</span>
        <b>{zh ? '尚无资料' : 'Empty'}</b>
      </div>
    </Html>
  </group>
}

function CorridorScene({ activeRoomId, language, lowPower, onRoomChange }: { activeRoomId: RoomId; language: Language; lowPower: boolean; onRoomChange: (id: RoomId) => void }) {
  return <>
    <color attach="background" args={['#e4ebe6']} />
    <fog attach="fog" args={['#e4ebe6', 31, 88]} />
    <ambientLight intensity={.88} />
    <directionalLight position={[1.8, 6.3, 4]} intensity={1.72} color="#fffdf7" castShadow={!lowPower} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
    <directionalLight position={[-4, 3.2, -18]} intensity={.72} color="#d8eaf2" />
    <pointLight position={[0, 2.5, -28]} intensity={4.4} distance={19} color="#cfdfd4" />
    <mesh position={[0, -.13, -22]} receiveShadow>
      <boxGeometry args={[5.7, .24, 65]} />
      <meshStandardMaterial color="#d4dfd8" roughness={.84} metalness={.04} />
    </mesh>
    <mesh position={[0, 3.88, -22]}>
      <boxGeometry args={[5.7, .18, 65]} />
      <meshStandardMaterial color="#f5f7f4" roughness={.9} />
    </mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * 2.95, 1.85, -22]}>
      <boxGeometry args={[.22, 3.9, 65]} />
      <meshStandardMaterial color="#e7eee9" roughness={.86} />
    </mesh>)}
    {Array.from({ length: 12 }, (_, index) => <RailLight key={index} z={4 - index * 5.2} color={index % 3 === 0 ? '#b8d8c2' : '#779688'} />)}
    {Array.from({ length: 10 }, (_, index) => <mesh key={`floor-${index}`} position={[0, .01, 3.2 - index * 5.8]}>
      <boxGeometry args={[5.15, .025, .055]} /><meshStandardMaterial color="#b2c4b8" emissive="#b2c4b8" emissiveIntensity={.08} />
    </mesh>)}
    <mesh position={[0, 1.78, -52]}>
      <boxGeometry args={[5.66, 3.75, .18]} /><meshStandardMaterial color="#eff5f1" roughness={.8} />
    </mesh>
    <mesh position={[0, 1.8, -51.85]}>
      <circleGeometry args={[.76, 32]} /><meshStandardMaterial color="#a7c3af" emissive="#a7c3af" emissiveIntensity={.18} />
    </mesh>
    {rooms.map(room => <LearningRoom key={room.id} room={room} active={activeRoomId === room.id} language={language} onFocus={() => onRoomChange(room.id)} />)}
    <CorridorNavigation focusRoomId={activeRoomId} onRoomChange={onRoomChange} />
  </>
}

function FlatFallback({ activeRoomId, language, onRoomChange }: { activeRoomId: RoomId; language: Language; onRoomChange: (id: RoomId) => void }) {
  const zh = language !== 'en'
  return <div className="learning-house-flat" aria-label={zh ? '学习屋平面导览' : 'Learning house planar guide'}>
    <div className="learning-house-flat-corridor"><span>{zh ? '学习走廊' : 'Study corridor'}</span></div>
    <div className="learning-house-flat-rooms">
      {rooms.map(room => <button className={`${room.side} ${activeRoomId === room.id ? 'active' : ''}`} type="button" key={room.id} onClick={() => onRoomChange(room.id)} style={{ '--room-color': room.color, '--room-deep': room.deepColor } as CSSProperties}>
        <i aria-hidden="true" /><span>{zh ? room.shortTitle : room.shortTitleEn}</span><b>{zh ? '尚无资料' : 'Empty'}</b>
      </button>)}
    </div>
  </div>
}

export default function LearningHouse({ language = 'zh-CN', onExit }: LearningHouseProps) {
  const [canUseWebGL] = useState(() => supportsWebGL())
  const [lowPower] = useState(() => shouldUseLowPowerMode())
  const [activeRoomId, setActiveRoomId] = useState<RoomId>('document')
  const [showFlat, setShowFlat] = useState(() => !canUseWebGL)
  const activeRoom = rooms.find(room => room.id === activeRoomId) || rooms[0]
  const zh = language !== 'en'

  useEffect(() => {
    document.body.classList.add('learning-house-open')
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('learning-house-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onExit])

  const content = <div className="learning-house-layer" role="dialog" aria-modal="true" aria-label={zh ? '3D 学习屋' : '3D learning house'}>
    <section className="learning-house">
      <header className="learning-house-topbar">
        <button className="learning-house-exit" type="button" onClick={onExit}><ArrowLeft size={17} />{zh ? '返回学习空间' : 'Back to study'}</button>
        <div className="learning-house-heading">
          <span><Sparkles size={14} />{zh ? '3D 学习屋' : '3D learning house'}</span>
          <strong>{zh ? '四间房已准备好，等你的资料入住' : 'Four rooms are ready for your material'}</strong>
        </div>
        <div className="learning-house-top-actions">
          {canUseWebGL && <button type="button" className="learning-house-view-toggle" onClick={() => setShowFlat(current => !current)}>{showFlat ? <MapPinned size={16} /> : <MousePointer2 size={16} />}{showFlat ? (zh ? '3D 视图' : '3D view') : (zh ? '平面导览' : 'Planar guide')}</button>}
          <button className="learning-house-close" type="button" aria-label={zh ? '关闭学习屋' : 'Close learning house'} onClick={onExit}><X size={19} /></button>
        </div>
      </header>

      <main className="learning-house-main">
        <section className="learning-house-stage" aria-label={zh ? '学习屋空间' : 'Learning house space'}>
          {!showFlat && canUseWebGL ? <Canvas
            className="learning-house-canvas"
            camera={{ position: [0, 1.64, cameraStartZ], fov: 52, near: .1, far: 120 }}
            dpr={lowPower ? 1 : [1, 1.5]}
            shadows={!lowPower}
            gl={{ antialias: !lowPower, alpha: false, powerPreference: 'high-performance' }}
            fallback={<FlatFallback activeRoomId={activeRoomId} language={language} onRoomChange={setActiveRoomId} />}
          ><CorridorScene activeRoomId={activeRoomId} language={language} lowPower={lowPower} onRoomChange={setActiveRoomId} /></Canvas> : <FlatFallback activeRoomId={activeRoomId} language={language} onRoomChange={setActiveRoomId} />}
          <div className="learning-house-stage-hint"><Keyboard size={15} /><span>{zh ? '滚轮或 W / S 键沿走廊前后移动，点击房门可直接前往。' : 'Use the wheel or W / S to move. Select a room door to go there.'}</span></div>
        </section>

        <aside className="learning-house-inspector">
          <div className="learning-house-room-status"><span>{zh ? '当前房间' : 'Current room'}</span><b>{zh ? activeRoom.title : activeRoom.titleEn}</b><small>{zh ? activeRoom.empty : activeRoom.emptyEn}</small></div>
          <h1>{zh ? activeRoom.shortTitle : activeRoom.shortTitleEn}</h1>
          <p>{zh ? activeRoom.description : activeRoom.descriptionEn}</p>
          <div className="learning-house-empty-note"><Sparkles size={15} /><span>{zh ? '现在仅搭建空间。之后生成并保存资料后，这里会自动出现对应内容。' : 'This is the space-only foundation. Saved materials will appear here later.'}</span></div>
          <nav className="learning-house-route" aria-label={zh ? '房间导航' : 'Room navigation'}>
            <span>{zh ? '四间学习房' : 'Four study rooms'}</span>
            {rooms.map((room, index) => <button className={room.id === activeRoomId ? 'active' : ''} type="button" key={room.id} onClick={() => setActiveRoomId(room.id)}><i style={{ background: room.color }}>{index + 1}</i><b>{zh ? room.shortTitle : room.shortTitleEn}</b><small>{zh ? '尚无资料' : 'Empty'}</small><ChevronRight size={15} /></button>)}
          </nav>
        </aside>
      </main>
    </section>
  </div>

  return createPortal(content, document.body)
}
