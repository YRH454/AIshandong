import { Suspense, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text, useTexture } from '@react-three/drei'
import {
  ArrowLeft, BookOpen, Box, BrainCircuit, Cpu, FileText, Orbit,
  Volume2, VolumeX, X,
} from 'lucide-react'
import * as THREE from 'three'
import { SceneRenderPulse } from './SceneRenderPulse'

type Language = 'zh-CN' | 'en'
type RoomId = 'document' | 'practice' | 'map' | 'dynamic' | 'profile'
type Phase = 'entrance' | 'corridor'
type Props = {
  language?: Language
  onExit: () => void
  onOpenPersonalRoom?: () => void
  onOpenMapHall?: () => void
  onOpenApexLab?: () => void
  onOpenSolarExplorer?: () => void
  onOpenStudyArchive?: () => void
  suspended?: boolean
}

type Room = {
  id: RoomId
  title: string
  titleEn: string
  short: string
  shortEn: string
  empty: string
  emptyEn: string
  color: string
  side: 'left' | 'right'
  z: number
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
}

const assetBase = '/learning-house-reference'

const rooms: Room[] = [
  { id: 'document', title: '学习文档室', titleEn: 'Study documents', short: '学习文档', shortEn: 'Documents', empty: '资料生成后会自动放入这一间。', emptyEn: 'Generated documents will move into this room.', color: '#6c9a73', side: 'left', z: -9, icon: FileText },
  { id: 'practice', title: '系统交互实验馆', titleEn: 'Apex systems lab', short: '系统实验', shortEn: 'Systems lab', empty: '把网络、算法与硬件原理变成可亲手操作的实验。', emptyEn: 'Explore computer systems through hands-on experiments.', color: '#43b7c8', side: 'right', z: -22, icon: Cpu },
  { id: 'map', title: '万象星海', titleEn: 'Life constellations', short: '万象星海', shortEn: 'Starfield', empty: '这里收纳了可自由漫游的万象知识星海。', emptyEn: 'A free-roaming field of life constellations lives here.', color: '#628db6', side: 'left', z: -35, icon: BrainCircuit },
  { id: 'dynamic', title: '太阳系探索舱', titleEn: 'Solar explorer', short: '太阳系探索', shortEn: 'Solar explorer', empty: '从地球起航，观察轨道、任务和深空尺度。', emptyEn: 'Launch from Earth into orbits, missions, and deep-space scale.', color: '#45c8af', side: 'right', z: -48, icon: Orbit },
  { id: 'profile', title: '个人档案室', titleEn: 'Personal archive', short: '个人档案', shortEn: 'Archive', empty: 'EGOIST 的个人档案与成长路线收藏在这间小屋。', emptyEn: 'EGOIST’s personal archive and flight route live in this room.', color: '#d6614d', side: 'left', z: -60, icon: Box },
]

function ReferenceMaterial({ path, opacity = 1, transparent = true, color = '#e0e0e0', side = THREE.DoubleSide }: { path: string; opacity?: number; transparent?: boolean; color?: string; side?: THREE.Side }) {
  const texture = useTexture(`${assetBase}${path}`)
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
  }, [texture])
  return <meshBasicMaterial map={texture} color={color} side={side} transparent={transparent || opacity < 1} opacity={opacity} alphaTest={transparent ? .08 : 0} depthWrite={opacity > .95} />
}

function ReferencePlane({ path, position, args, rotation = [0, 0, 0], scale = [1, 1, 1], opacity = 1, transparent = true, color }: { path: string; position: [number, number, number]; args: [number, number]; rotation?: [number, number, number]; scale?: [number, number, number]; opacity?: number; transparent?: boolean; color?: string }) {
  return <mesh position={position} rotation={rotation} scale={scale}>
    <planeGeometry args={args} />
    <ReferenceMaterial path={path} opacity={opacity} transparent={transparent} color={color} />
  </mesh>
}

function playSound(file: string, enabled: boolean, volume = .25) {
  if (!enabled) return
  const audio = new Audio(`${assetBase}${file}`)
  audio.volume = volume
  void audio.play().catch(() => undefined)
}

function useBackgroundMusic(enabled: boolean, isInside: boolean) {
  const audio = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    const instance = new Audio(`${assetBase}/sounds/cfl_turningpages-belem-breeze-487596.ogg`)
    instance.loop = true
    instance.volume = .3
    instance.preload = 'auto'
    instance.load()
    audio.current = instance
    return () => { instance.pause(); instance.src = '' }
  }, [])
  useEffect(() => {
    const instance = audio.current
    if (!instance) return
    instance.muted = !enabled
    if (isInside && enabled) void instance.play().catch(() => undefined)
    else instance.pause()
  }, [enabled, isInside])
  return {
    start: () => {
      const instance = audio.current
      if (instance && enabled) void instance.play().catch(() => undefined)
    },
  }
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch { return false }
}

function reducedScene() {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return window.matchMedia('(max-width: 760px)').matches
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || (navigator.hardwareConcurrency || 8) <= 4
    || (nav.deviceMemory || 8) <= 4
}

function lerpVector(current: THREE.Vector3, target: THREE.Vector3, speed: number, delta: number) {
  current.lerp(target, 1 - Math.exp(-speed * delta))
}

function HouseCamera({ phase, activeRoomId, onNearRoom }: { phase: Phase; activeRoomId: RoomId | null; onNearRoom: (id: RoomId) => void }) {
  const { camera, gl, pointer } = useThree()
  const targetPosition = useRef(new THREE.Vector3(0, .05, 5.6))
  const targetLook = useRef(new THREE.Vector3(0, .02, -1.5))
  const currentLook = useRef(new THREE.Vector3(0, .02, -1.5))
  const lastNearRoomRef = useRef<RoomId | null>(activeRoomId)

  useEffect(() => {
    lastNearRoomRef.current = activeRoomId
  }, [activeRoomId])

  useEffect(() => {
    if (phase === 'entrance') {
      targetPosition.current.set(0, .05, 5.6)
      targetLook.current.set(0, .02, -1.5)
    } else {
      targetPosition.current.set(0, .05, 5.35)
      targetLook.current.set(0, .02, -4.8)
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'corridor') return
    const move = (distance: number) => {
      const next = targetPosition.current.z + distance
      targetPosition.current.z = THREE.MathUtils.clamp(next, -62.5, 5.35)
    }
    const wheel = (event: WheelEvent) => { event.preventDefault(); move(event.deltaY * .019) }
    const key = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') { event.preventDefault(); move(-2.75) }
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') { event.preventDefault(); move(2.75) }
    }
    gl.domElement.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('keydown', key)
    return () => { gl.domElement.removeEventListener('wheel', wheel); window.removeEventListener('keydown', key) }
  }, [gl, phase])

  useFrame((_, delta) => {
    if (phase === 'entrance') {
      targetPosition.current.set(pointer.x * .15, .05 - pointer.y * .07, 5.6)
      targetLook.current.set(pointer.x * .05, .02, -1.5)
    } else {
      const nearest = rooms.reduce((best, room) => Math.abs(room.z - camera.position.z) < Math.abs(best.z - camera.position.z) ? room : best, rooms[0])
      const isNear = Math.abs(nearest.z - camera.position.z) < 7
      const glance = isNear ? (nearest.side === 'left' ? -.68 : .68) : 0
      targetLook.current.set(pointer.x * .17 + glance, .03 - pointer.y * .045, targetPosition.current.z - 8)
      if (nearest.id !== lastNearRoomRef.current) {
        lastNearRoomRef.current = nearest.id
        if (nearest.id !== activeRoomId) onNearRoom(nearest.id)
      }
    }
    lerpVector(camera.position, targetPosition.current, 3.9, delta)
    lerpVector(currentLook.current, targetLook.current, 4.8, delta)
    camera.lookAt(currentLook.current)
  })
  return null
}

function EntranceScene({ onEnter, soundOn, onMusicStart }: { onEnter: () => void; soundOn: boolean; onMusicStart: () => void }) {
  const leftDoor = useRef<THREE.Group>(null)
  const rightDoor = useRef<THREE.Group>(null)
  const sign = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const [opening, setOpening] = useState(false)
  const amount = useRef(0)

  useFrame((state, delta) => {
    const target = opening ? 1 : hovered ? .12 : 0
    amount.current += (target - amount.current) * (1 - Math.exp(-delta * 4.8))
    if (leftDoor.current) leftDoor.current.rotation.y = -amount.current * Math.PI * .55
    if (rightDoor.current) rightDoor.current.rotation.y = amount.current * Math.PI * .55
    if (sign.current) sign.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * .018
  })

  const enter = () => {
    if (opening) return
    setOpening(true)
    playSound('/sounds/otwarciedrzwi.mp3', soundOn, .24)
    onMusicStart()
    window.setTimeout(onEnter, 1180)
  }

  return <group position={[0, .02, -.85]}>
    <ReferencePlane path="/textures/entrance/wall_bricks_2.webp" position={[0, .02, -.13]} args={[11.4, 5.9]} />
    <ReferencePlane path="/textures/entrance/floor_paper.webp" position={[0, -1.84, 1.2]} args={[12.4, 8.3]} rotation={[-Math.PI / 2, 0, 0]} />
    <ReferencePlane path="/textures/entrance/tree_sketch.webp" position={[-4.43, .62, .03]} args={[4.3, 5.7]} />
    <ReferencePlane path="/textures/entrance/mouse_hanging.webp" position={[-3.18, -.1, .08]} args={[2.35, 3.15]} />
    <ReferencePlane path="/textures/entrance/cat_front_body.webp" position={[-1.72, -1.05, .11]} args={[1.13, 1.13]} />
    <ReferencePlane path="/textures/entrance/window_sketch.webp" position={[2.5, .02, .12]} args={[1.5, 1.5]} />
    <ReferencePlane path="/textures/entrance/pot_with_duck.webp" position={[2.5, -1.3, .14]} args={[3, 1.8]} />
    <ReferencePlane path="/textures/entrance/bug_sketch.webp" position={[2.58, 1.23, .18]} args={[.29, .29]} />

    <group ref={sign} position={[0, 1.7, .2]}>
      <ReferencePlane path="/textures/entrance/belka.webp" position={[0, .45, 0]} args={[2.75, .43]} />
      <ReferencePlane path="/textures/entrance/sign.webp" position={[0, -.18, .022]} args={[2, 1]} />
      <mesh position={[0, -.18, .055]}><planeGeometry args={[1.86, .7]} /><meshBasicMaterial color="#eeeae0" /></mesh>
      <Text position={[0, -.17, .07]} font={`${assetBase}/fonts/CabinSketch-Bold.ttf`} fontSize={.31} color="#25221f" outlineWidth={.006} outlineColor="#f8f6ef" anchorX="center" anchorY="middle">RHYME</Text>
    </group>

    <ReferencePlane path="/textures/entrance/stone-path.webp" position={[0, -1.79, 1.12]} args={[2.45, 4.85]} rotation={[-Math.PI / 2, 0, 0]} />
    <ReferencePlane path="/textures/doors/frame_sketch.webp" position={[0, -.42, .24]} args={[2.06, 2.53]} />
    <group ref={leftDoor} position={[-.95, -.59, .21]} onPointerOver={event => { event.stopPropagation(); setHovered(true) }} onPointerOut={() => setHovered(false)}>
      <ReferencePlane path="/textures/doors/door_left_painted.webp" position={[.47, 0, .04]} args={[.94, 2.4]} opacity={hovered || opening ? 1 : .14} />
      <ReferencePlane path="/textures/doors/door_left_sketch.webp" position={[.47, 0, .065]} args={[.94, 2.4]} opacity={hovered || opening ? .18 : 1} />
    </group>
    <group ref={rightDoor} position={[.95, -.59, .21]} onPointerOver={event => { event.stopPropagation(); setHovered(true) }} onPointerOut={() => setHovered(false)}>
      <ReferencePlane path="/textures/doors/door_right_painted.webp" position={[-.47, 0, .04]} args={[.94, 2.4]} opacity={hovered || opening ? 1 : .14} />
      <ReferencePlane path="/textures/doors/door_right_sketch.webp" position={[-.47, 0, .065]} args={[.94, 2.4]} opacity={hovered || opening ? .18 : 1} />
    </group>
    <mesh position={[0, -.5, .48]} onClick={enter} onPointerOver={event => { event.stopPropagation(); setHovered(true) }} onPointerOut={() => setHovered(false)}><planeGeometry args={[2.3, 2.65]} /><meshBasicMaterial transparent opacity={0} /></mesh>
  </group>
}

function CorridorFixture({ z }: { z: number }) {
  return <group position={[0, 1.72, z]}>
    <mesh position={[0, -.03, 0]}><boxGeometry args={[2, .06, .5]} /><ReferenceMaterial path="/textures/corridor/bokilampy.webp" /></mesh>
    <ReferencePlane path="/textures/corridor/kratanalampy.webp" position={[0, -.068, 0]} args={[1.9, .4]} rotation={[-Math.PI / 2, 0, 0]} />
    <mesh position={[0, -.075, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.58, .28]} /><meshBasicMaterial color="#fffdf4" /></mesh>
    <pointLight position={[0, -.16, 0]} color="#fff6dd" intensity={.42} distance={5.4} />
  </group>
}

function CorridorFrame({ position, side, artPath }: { position: [number, number, number]; side: 'left' | 'right'; artPath: string }) {
  const direction = side === 'left' ? 1 : -1
  return <group position={position} rotation={[0, direction * Math.PI / 2, side === 'left' ? .025 : -.025]}>
    <ReferencePlane path="/textures/corridor/ramkanazdjecieduza_painted.webp" position={[0, 0, -.01]} args={[2.5, 1.4]} />
    <ReferencePlane path={artPath} position={[0, 0, .025]} args={[1.7, .95]} />
  </group>
}

function CorridorMascot({ soundOn }: { soundOn: boolean }) {
  const mascot = useRef<THREE.Group>(null)
  const orbit = useRef<THREE.Group>(null)
  const greeting = useRef<THREE.Group>(null)
  const mascotAnchor = useRef(new THREE.Vector3(0, .26, -2.65))
  const { camera } = useThree()
  const [welcoming, setWelcoming] = useState(false)
  const closeTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
  }, [])

  useFrame((state, delta) => {
    if (!mascot.current) return
    const distance = camera.position.distanceTo(mascotAnchor.current)
    const near = distance < 8
    const targetX = near ? -.16 : 0
    mascot.current.position.x = THREE.MathUtils.damp(mascot.current.position.x, targetX, 2.8, delta)
    mascot.current.position.y = .26 + Math.sin(state.clock.elapsedTime * (near ? 1.65 : .82)) * (near ? .095 : .045)
    mascot.current.rotation.z = Math.sin(state.clock.elapsedTime * (near ? 1.45 : .66)) * (near ? .11 : .03)
    if (orbit.current) orbit.current.rotation.z = state.clock.elapsedTime * (near ? 1.5 : .58)
    if (greeting.current) greeting.current.position.y = .77 + Math.sin(state.clock.elapsedTime * 2.4) * .025
  })
  const greet = (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    setWelcoming(true)
    playSound('/sounds/papersound.mp3', soundOn, .18)
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setWelcoming(false), 3200)
  }
  return <group ref={mascot} position={[0, .26, -2.65]} onClick={greet}>
    <ReferencePlane path="/xuejing-slime-logo.png" position={[0, 0, 0]} args={[.7, .7]} />
    <group ref={orbit}>
      <ReferencePlane path="/textures/corridor/decorations/paper_airplane.webp" position={[.48, .34, -.08]} args={[.36, .22]} rotation={[0, 0, -.22]} />
    </group>
    <ReferencePlane path="/textures/corridor/decorations/paper_ball.webp" position={[-.45, -.27, -.08]} args={[.23, .23]} />
    <mesh position={[0, .02, .05]} onClick={greet}><planeGeometry args={[.78, .78]} /><meshBasicMaterial transparent opacity={0} /></mesh>
    {welcoming && <group ref={greeting} position={[.1, .77, -.06]}>
      <ReferencePlane path="/textures/corridor/pustatabliczka.webp" position={[0, 0, 0]} args={[2.05, .9]} />
      <Text position={[0, .04, .06]} font={`${assetBase}/fonts/CabinSketch-Bold.ttf`} fontSize={.14} maxWidth={1.55} color="#302c27" anchorX="center" anchorY="middle">嗨，想先看看哪一扇门？</Text>
    </group>}
  </group>
}

function EndWall() {
  return <group position={[0, 0, -67.15]}>
    <mesh position={[0, 0, -.04]}><planeGeometry args={[7.08, 3.58]} /><ReferenceMaterial path="/textures/corridor/wall_texture.webp" transparent={false} /></mesh>
    <ReferencePlane path="/textures/corridor/pustatabliczka.webp" position={[0, .32, .03]} args={[3.85, 1.78]} />
    <Text position={[0, .75, .06]} font={`${assetBase}/fonts/CabinSketch-Bold.ttf`} fontSize={.31} color="#27231f" anchorX="center" anchorY="middle">RHYME</Text>
    <Text position={[0, .3, .06]} font={`${assetBase}/fonts/CabinSketch-Regular.ttf`} fontSize={.145} color="#3d3831" anchorX="center" anchorY="middle">邮箱 · 3539921167@qq.com</Text>
    <Text position={[0, -.08, .06]} font={`${assetBase}/fonts/CabinSketch-Regular.ttf`} fontSize={.145} color="#3d3831" anchorX="center" anchorY="middle">微信 · 15853743199</Text>
    <ReferencePlane path="/textures/corridor/decorations/pencil.webp" position={[-2.22, -1.05, .04]} args={[.8, .8]} rotation={[0, 0, .32]} />
    <ReferencePlane path="/textures/corridor/decorations/coffee_cup.webp" position={[2.25, -1.08, .04]} args={[.7, .7]} rotation={[0, 0, -.12]} />
    <ReferencePlane path="/textures/corridor/decorations/paper_airplane.webp" position={[-2.22, 1.17, .04]} args={[.82, .5]} rotation={[0, 0, .08]} />
  </group>
}

function CorridorDoor({ room, active, onSelect, soundOn }: { room: Room; active: boolean; onSelect: () => void; soundOn: boolean }) {
  const direction = room.side === 'left' ? -1 : 1
  const wallAngle = Math.atan2(1.8, 4)
  const door = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const openness = useRef(0)
  const textureByRoom: Record<RoomId, string> = {
    document: '/textures/corridor/doors/drzwiprojekty.webp',
    practice: '/textures/corridor/doors/drzwikontakt.webp',
    map: '/textures/corridor/doors/drzwiabout.webp',
    dynamic: '/textures/corridor/doors/drzwisocial.webp',
    profile: '/textures/corridor/doors/drzwiabout_painted.webp',
  }
  useFrame((_, delta) => {
    const target = hovered || active ? .23 : 0
    openness.current += (target - openness.current) * (1 - Math.exp(-delta * 8))
    if (door.current) door.current.rotation.y = direction * openness.current * 1.68
  })
  return <group position={[direction * 2.6, 0, room.z]} rotation={[0, direction === -1 ? Math.PI / 2 - wallAngle : -Math.PI / 2 + wallAngle, 0]} onPointerOver={event => { event.stopPropagation(); setHovered(true) }} onPointerOut={() => setHovered(false)}>
    <ReferencePlane path="/textures/corridor/doors/ramkasingledoors.webp" position={[0, 0, .02]} args={[2.52, 3.2]} />
    <group ref={door} position={[-.89, -.22, .08]}>
      <ReferencePlane path={textureByRoom[room.id]} position={[.89, 0, .08]} args={[1.84, 2.52]} />
    </group>
    {room.id === 'profile' && <group position={[0, 1.02, .18]}>
      <mesh position={[0, 0, -.012]}><planeGeometry args={[1.34, .37]} /><meshBasicMaterial color="#f5eee2" /></mesh>
      <Text position={[0, 0, .015]} font={`${assetBase}/fonts/CabinSketch-Bold.ttf`} fontSize={.16} color="#b64737" anchorX="center" anchorY="middle">EGOIST</Text>
    </group>}
    <mesh position={[0, -.15, .35]} onClick={event => { event.stopPropagation(); playSound('/sounds/otwarciedrzwi.mp3', soundOn, .18); onSelect() }}><planeGeometry args={[2.2, 3.05]} /><meshBasicMaterial transparent opacity={0} /></mesh>
    {(hovered || active) && <pointLight position={[0, .1, .7]} color={room.color} intensity={.5} distance={3.5} />}
  </group>
}

function Corridor({ soundOn }: { soundOn: boolean }) {
  const lights = Array.from({ length: 11 }, (_, index) => -4 - index * 7.2)
  const floorTiles = Array.from({ length: 9 }, (_, index) => 5 - index * 10)
  const plankGaps = Array.from({ length: 44 }, (_, index) => 6 - index * 1.93)
  const doorAngle = Math.atan2(1.8, 4)
  return <group>
    {floorTiles.map((z, index) => {
      const mirrored = index % 2 === 1
      return <group key={z}>
        <mesh position={[0, -1.77, z]} rotation={[-Math.PI / 2, 0, Math.PI / 2 + (mirrored ? Math.PI : 0)]} scale={[mirrored ? -1 : 1, 1, 1]}><planeGeometry args={[10, 6.2]} /><ReferenceMaterial path="/textures/corridor/kawalekpodlogi.webp" /></mesh>
        <mesh position={[0, 1.77, z]} rotation={[Math.PI / 2, 0, mirrored ? Math.PI : 0]} scale={[mirrored ? -1 : 1, 1, 1]}><planeGeometry args={[6.2, 10]} /><ReferenceMaterial path="/textures/corridor/ceiling_texture.webp" /></mesh>
      </group>
    })}
    <mesh position={[-3.48, 0, -34]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[84, 3.56]} /><ReferenceMaterial path="/textures/corridor/wall_texture.webp" /></mesh>
    <mesh position={[3.48, 0, -34]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[84, 3.56]} /><ReferenceMaterial path="/textures/corridor/wall_texture.webp" /></mesh>
    {rooms.map(room => {
      const direction = room.side === 'left' ? -1 : 1
      const rotation = direction === -1 ? Math.PI / 2 - doorAngle : -Math.PI / 2 + doorAngle
      return <group key={`wall-${room.id}`} position={[direction * 2.6, 0, room.z]} rotation={[0, rotation, 0]}><ReferencePlane path="/textures/corridor/wall_texture.webp" position={[0, 0, -.035]} args={[4.38, 3.56]} transparent={false} /></group>
    })}
    {plankGaps.map(z => <mesh key={z} position={[0, -1.765, z]}><boxGeometry args={[6.08, .018, .026]} /><meshBasicMaterial color="#563a26" transparent opacity={.5} /></mesh>)}
    {[-3.44, 3.44].map(x => <mesh key={x} position={[x, -1.66, -34]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[84, .1, .035]} /><meshBasicMaterial color="#6e4931" transparent opacity={.88} /></mesh>)}
    {lights.map(z => <CorridorFixture key={z} z={z} />)}
    <CorridorFrame position={[-3.46, .33, -2.3]} side="left" artPath="/textures/corridor/rysuneknaobraz1.webp" />
    <CorridorFrame position={[3.46, .26, -11.6]} side="right" artPath="/textures/corridor/rysuneknaobrazek3.webp" />
    <CorridorFrame position={[-3.46, .18, -20.8]} side="left" artPath="/textures/corridor/decorations/idea_process.webp" />
    <CorridorFrame position={[3.46, .3, -30.2]} side="right" artPath="/textures/corridor/decorations/while_true_loop.webp" />
    <CorridorFrame position={[-3.46, .1, -39.8]} side="left" artPath="/textures/corridor/decorations/coffee_debug.webp" />
    <ReferencePlane path="/textures/corridor/drzewkowdoniczce.webp" position={[-3.31, -.3, -14.2]} args={[1.6, 2.65]} rotation={[0, Math.PI / 2, 0]} />
    <ReferencePlane path="/textures/corridor/decorations/pencil.webp" position={[3.28, -.15, -25.1]} args={[.95, .95]} rotation={[0, -Math.PI / 2, .18]} />
    <ReferencePlane path="/textures/corridor/decorations/coffee_cup.webp" position={[-3.31, -.86, -34.5]} args={[.82, .82]} rotation={[0, Math.PI / 2, -.12]} />
    <ReferencePlane path="/textures/corridor/decorations/paper_airplane.webp" position={[3.31, .87, -43.2]} args={[.82, .5]} rotation={[0, -Math.PI / 2, -.12]} />
    <EndWall />
    <CorridorMascot soundOn={soundOn} />
  </group>
}

function FlatFallback({ language, onEnter }: { language: Language; onEnter: () => void }) {
  const zh = language !== 'en'
  return <div className="learning-house-flat entrance"><BookOpen size={30} /><h1>RHYME</h1><p>{zh ? '3D 学习屋需要浏览器开启图形加速。' : 'The 3D learning house needs WebGL graphics support.'}</p><button type="button" onClick={onEnter}>{zh ? '进入学习空间' : 'Enter learning space'}</button></div>
}

export default function LearningHouse({ language = 'zh-CN', onExit, onOpenPersonalRoom, onOpenMapHall, onOpenApexLab, onOpenSolarExplorer, onOpenStudyArchive, suspended = false }: Props) {
  const [canUseWebGL] = useState(() => supportsWebGL())
  const [lowPower] = useState(() => reducedScene())
  const [pageVisible, setPageVisible] = useState(() => !document.hidden)
  const [phase, setPhase] = useState<Phase>('entrance')
  const [activeRoomId, setActiveRoomId] = useState<RoomId | null>('document')
  const [soundOn, setSoundOn] = useState(true)
  // A room opened above the corridor already has its own soundscape. Pause
  // the corridor loop while it is covered so it does not keep decoding audio.
  const music = useBackgroundMusic(soundOn, phase === 'corridor' && !suspended)
  const zh = language !== 'en'
  const activeRoom = rooms.find(room => room.id === activeRoomId)
  const canvasActive = !suspended && pageVisible

  useEffect(() => {
    document.body.classList.add('learning-house-open')
    const key = (event: KeyboardEvent) => {
      if (suspended) return
      if (event.key !== 'Escape') return
      if (phase === 'corridor') setPhase('entrance')
      else onExit()
    }
    window.addEventListener('keydown', key)
    return () => { document.body.classList.remove('learning-house-open'); window.removeEventListener('keydown', key) }
  }, [onExit, phase, suspended])

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  const enterCorridor = () => setPhase('corridor')
  const status = phase === 'entrance'
    ? (zh ? '点击任意一扇门进入。声音已开启。' : 'Click either door to enter. Audio is on.')
    : (activeRoom
      ? (activeRoom.id === 'profile'
        ? (zh ? '个人档案室已开启，点击门进入 EGOIST 的个人空间。' : 'The personal archive is ready. Click its door to enter EGOIST’s space.')
        : activeRoom.id === 'map'
          ? (zh ? '万象星海已点亮，点击门进入自由漫游。' : 'The life constellations are lit. Click the door to roam freely.')
          : activeRoom.id === 'practice'
            ? (zh ? '系统交互实验馆已开启，点击门进入完整中文实验。' : 'The systems lab is ready. Click the door to enter the experiments.')
            : activeRoom.id === 'dynamic'
              ? (zh ? '太阳系探索舱已开启，点击门进入沉浸式科学探索。' : 'The solar explorer is ready. Click the door to launch.')
              : activeRoom.id === 'document'
                ? (zh ? '学习档案馆已经布置完成，点击门进入可互动的书房。' : 'The study archive is ready. Click the door to enter the interactive library.')
                : (zh ? `${activeRoom.title}已预留，生成资料后会自动入住。` : `${activeRoom.titleEn} is ready for generated work.`))
      : (zh ? '滚动或按 W / S 前进，靠近房门后点击。' : 'Scroll or use W / S to walk. Click a nearby door.'))

  return createPortal(<div className="learning-house-layer" role="dialog" aria-modal="true" aria-label="RHYME 3D learning house">
    <section className="learning-house">
      <header className="learning-house-topbar" aria-label={zh ? '学习屋控制栏' : 'Learning house controls'}>
        <button className="learning-house-exit" type="button" onClick={onExit}><ArrowLeft size={17} /><span>{zh ? '返回学习空间' : 'Back to study'}</span></button>
        <div className="learning-house-heading"><Box size={15} /><strong>RHYME</strong></div>
        <div className="learning-house-top-actions">
          <button className="learning-house-sound" type="button" aria-label={soundOn ? (zh ? '关闭声音' : 'Mute sound') : (zh ? '打开声音' : 'Enable sound')} onClick={() => { if (!soundOn) music.start(); setSoundOn(current => !current) }}>{soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>
          <button className="learning-house-close" type="button" aria-label={zh ? '关闭学习屋' : 'Close learning house'} onClick={onExit}><X size={19} /></button>
        </div>
      </header>
      <main className="learning-house-main">
        <section className="learning-house-stage">
          {canUseWebGL ? <Canvas className="learning-house-canvas" frameloop={canvasActive ? 'demand' : 'never'} camera={{ position: [0, .05, 5.6], fov: 60, near: .1, far: 110 }} dpr={lowPower ? 1 : [1, 1.5]} shadows={!lowPower} gl={{ antialias: !lowPower, alpha: false, powerPreference: 'high-performance' }}>
            <color attach="background" args={['#fafafa']} /><fog attach="fog" args={['#fafafa', 20, 62]} /><ambientLight intensity={1.04} /><hemisphereLight args={['#ffffff', '#d7d7d2', .72]} /><directionalLight position={[4, 8, 8]} intensity={.86} color="#fff9e9" />
            <Suspense fallback={null}>
              {phase === 'entrance' ? <EntranceScene soundOn={soundOn} onEnter={enterCorridor} onMusicStart={music.start} /> : <><Corridor soundOn={soundOn} />{rooms.map(room => <CorridorDoor key={room.id} room={room} active={activeRoomId === room.id} soundOn={soundOn} onSelect={() => { setActiveRoomId(room.id); if (room.id === 'document') onOpenStudyArchive?.(); if (room.id === 'profile') onOpenPersonalRoom?.(); if (room.id === 'map') onOpenMapHall?.(); if (room.id === 'practice') onOpenApexLab?.(); if (room.id === 'dynamic') onOpenSolarExplorer?.() }} />)}</>}
            </Suspense>
            <HouseCamera phase={phase} activeRoomId={activeRoomId} onNearRoom={setActiveRoomId} />
            <SceneRenderPulse active={canvasActive} fps={lowPower ? 24 : 42} />
          </Canvas> : <FlatFallback language={language} onEnter={enterCorridor} />}
          <div className="learning-house-explorer" aria-live="polite">
            <b>{phase === 'entrance' ? 'EXPLORER' : 'WANDERER'}</b>
            <span>{status}</span>
            {phase === 'corridor' && activeRoom?.id === 'map' && onOpenMapHall && (
              <button type="button" onClick={onOpenMapHall}>{zh ? '进入万象星海' : 'Enter starfield'}</button>
            )}
            {phase === 'corridor' && activeRoom?.id === 'practice' && onOpenApexLab && (
              <button type="button" onClick={onOpenApexLab}>{zh ? '进入系统交互实验馆' : 'Enter systems lab'}</button>
            )}
            {phase === 'corridor' && activeRoom?.id === 'dynamic' && onOpenSolarExplorer && (
              <button type="button" onClick={onOpenSolarExplorer}>{zh ? '进入太阳系探索舱' : 'Launch solar explorer'}</button>
            )}
            {phase === 'corridor' && activeRoom?.id === 'document' && onOpenStudyArchive && (
              <button type="button" onClick={onOpenStudyArchive}>{zh ? '进入学习档案馆' : 'Enter study archive'}</button>
            )}
          </div>
        </section>
      </main>
    </section>
  </div>, document.body)
}
