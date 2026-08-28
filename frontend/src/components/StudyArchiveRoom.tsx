import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Text, useTexture } from '@react-three/drei'
import { ArrowLeft, BookOpen, ChevronRight, LibraryBig, Sparkles, X } from 'lucide-react'
import * as THREE from 'three'
import './StudyArchiveRoom.css'
import StudyArchiveBookReader from './StudyArchiveBookReader'

type Props = {
  onExit: () => void
}

type BookId =
  | 'probability'
  | 'data'
  | 'reading'
  | 'physics'
  | 'history'
  | 'algorithm'
  | 'calculus'
  | 'coding'
  | 'biology'
  | 'economics'
  | 'writing'
  | 'psychology'

type StudyBook = {
  id: BookId
  short: string
  title: string
  subtitle: string
  tag: string
  color: string
  accent: string
  shelf: number
  slot: number
  side: 'left' | 'right'
}

const studyBooks: StudyBook[] = [
  { id: 'probability', short: '概率', title: '条件概率的观察课', subtitle: '从样本、条件与因果关系开始推理。', tag: '概率与统计', color: '#c75d48', accent: '#ffd28a', shelf: 3, slot: 1, side: 'left' },
  { id: 'data', short: '数据', title: '数据结构的空间感', subtitle: '把抽象的关系拆成可追踪的节点和路径。', tag: '数据与算法', color: '#426d9d', accent: '#93d7ee', shelf: 2, slot: 5, side: 'left' },
  { id: 'algorithm', short: '算法', title: '算法的节奏感', subtitle: '从规模、步骤与选择里看见效率真正来自哪里。', tag: '算法思维', color: '#2f7b72', accent: '#9ae5d2', shelf: 1, slot: 0, side: 'left' },
  { id: 'calculus', short: '微积', title: '微积分的变化视角', subtitle: '用变化率与累积量读懂连续世界的两种语言。', tag: '高等数学', color: '#825f9c', accent: '#d9b8ff', shelf: 0, slot: 2, side: 'left' },
  { id: 'coding', short: '代码', title: '把程序拆成小问题', subtitle: '让输入、状态和输出在清晰边界里协作。', tag: '编程基础', color: '#3b7590', accent: '#98d8ed', shelf: 1, slot: 4, side: 'left' },
  { id: 'biology', short: '生命', title: '生命系统的协作', subtitle: '从细胞到生态，观察结构如何让系统保持运转。', tag: '生命科学', color: '#6b9454', accent: '#cae9a5', shelf: 0, slot: 5, side: 'left' },
  { id: 'reading', short: '阅读', title: '学术阅读的线索', subtitle: '用问题、证据和结构读懂一篇复杂材料。', tag: '阅读方法', color: '#5f8059', accent: '#c7e7ad', shelf: 3, slot: 4, side: 'right' },
  { id: 'physics', short: '深空', title: '从轨道理解深空', subtitle: '把尺度、周期和任务放进同一张宇宙地图。', tag: '科学探索', color: '#5e5a95', accent: '#bdb5ff', shelf: 1, slot: 2, side: 'right' },
  { id: 'history', short: '脉络', title: '思想如何穿过时间', subtitle: '让人物、事件与观念在一条长线里彼此照见。', tag: '通识视野', color: '#9a6b3d', accent: '#f1c785', shelf: 0, slot: 5, side: 'right' },
  { id: 'economics', short: '选择', title: '选择与交换的逻辑', subtitle: '从有限资源、激励与代价理解日常的判断。', tag: '经济学入门', color: '#b06b3e', accent: '#f6ce8f', shelf: 2, slot: 1, side: 'right' },
  { id: 'writing', short: '写作', title: '把想法写成结构', subtitle: '让观点、证据和段落共同服务于一个清楚的表达。', tag: '表达与写作', color: '#9c5566', accent: '#f6b5c5', shelf: 3, slot: 1, side: 'right' },
  { id: 'psychology', short: '心智', title: '注意力的使用说明', subtitle: '理解注意、记忆与习惯，给学习留出更好的空间。', tag: '认知心理', color: '#56757a', accent: '#bde0df', shelf: 2, slot: 5, side: 'right' },
]

const neutralColors = ['#b87058', '#d2a352', '#486f91', '#62815d', '#8b5f65', '#597176', '#ad7c54', '#74639a']
const assetBase = '/learning-house-reference'

function ReferenceMaterial({ path, opacity = 1, transparent = true, color = '#ffffff', side = THREE.DoubleSide }: { path: string; opacity?: number; transparent?: boolean; color?: string; side?: THREE.Side }) {
  const texture = useTexture(`${assetBase}${path}`)
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    texture.needsUpdate = true
  }, [texture])
  return <meshBasicMaterial map={texture} color={color} side={side} transparent={transparent || opacity < 1} opacity={opacity} alphaTest={transparent ? .08 : 0} depthWrite={opacity > .95} />
}

function ReferencePlane({ path, position, args, rotation = [0, 0, 0], scale = [1, 1, 1], opacity = 1, transparent = true, color }: { path: string; position: [number, number, number]; args: [number, number]; rotation?: [number, number, number]; scale?: [number, number, number]; opacity?: number; transparent?: boolean; color?: string }) {
  return <mesh position={position} rotation={rotation} scale={scale}>
    <planeGeometry args={args} />
    <ReferenceMaterial path={path} opacity={opacity} transparent={transparent} color={color} />
  </mesh>
}

function ReferencePlant({ position, scale = 1, color = '#9eb68e' }: { position: [number, number, number]; scale?: number; color?: string }) {
  const group = useRef<THREE.Group>(null)
  useFrame((state, delta) => {
    if (!group.current) return
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, position[1] + Math.sin(state.clock.elapsedTime * .62 + position[0]) * .018, 3.2, delta)
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, Math.sin(state.clock.elapsedTime * .38) * .008, 3.2, delta)
  })
  return <group ref={group} position={position} scale={scale}>
    <ReferencePlane path="/textures/corridor/drzewkowdoniczce.webp" position={[0, 1.15, 0]} args={[1.55, 3.1]} opacity={.86} color={color} />
    <pointLight position={[0, 1.35, .28]} color="#a9d38d" intensity={.45} distance={2.4} />
  </group>
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function DustField() {
  const positions = useMemo(() => {
    const values: number[] = []
    for (let index = 0; index < 96; index += 1) {
      const x = ((((index * 43) % 101) / 100) - .5) * 14
      const y = (((index * 29) % 97) / 97) * 7 - 1.2
      const z = -3 + (((index * 17) % 61) / 61) * 8
      values.push(x, y, z)
    }
    return new Float32Array(values)
  }, [])

  const group = useRef<THREE.Points>(null)
  useFrame((state) => {
    if (group.current) group.current.rotation.y = Math.sin(state.clock.elapsedTime * .08) * .025
  })

  return <points ref={group}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[positions, 3]} />
    </bufferGeometry>
    <pointsMaterial color="#ffe7b2" size={.035} transparent opacity={.62} sizeAttenuation depthWrite={false} />
  </points>
}

function CameraRig() {
  const { camera, pointer } = useThree()
  const target = useRef(new THREE.Vector3(0, .4, -1.3))

  useFrame((_, delta) => {
    camera.position.x = THREE.MathUtils.damp(camera.position.x, pointer.x * .42, 2.6, delta)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.35 - pointer.y * .16, 2.6, delta)
    target.current.x = THREE.MathUtils.damp(target.current.x, pointer.x * .19, 2.6, delta)
    target.current.y = THREE.MathUtils.damp(target.current.y, .38 - pointer.y * .07, 2.6, delta)
    camera.lookAt(target.current)
  })
  return null
}

function RoomShell() {
  const floorLines = Array.from({ length: 12 }, (_, index) => -5.2 + index * .94)
  const wallLines = Array.from({ length: 10 }, (_, index) => -7.2 + index * 1.6)
  return <group>
    <mesh position={[0, 1.5, -4.1]} receiveShadow>
      <boxGeometry args={[16, 8, .25]} />
      <meshStandardMaterial color="#40312c" roughness={.84} />
    </mesh>
    <mesh position={[0, -2.3, -.2]} receiveShadow>
      <boxGeometry args={[16, .18, 12]} />
      <meshStandardMaterial color="#593d2d" roughness={.82} />
    </mesh>
    <ReferencePlane path="/textures/corridor/wall_texture.webp" position={[0, 1.5, -3.93]} args={[15.7, 7.7]} opacity={.38} color="#b18b73" />
    <ReferencePlane path="/textures/corridor/ceiling_texture.webp" position={[0, 5.28, -.25]} args={[15.8, 11.8]} rotation={[Math.PI / 2, 0, 0]} opacity={.13} color="#efd9be" />
    <ReferencePlane path="/textures/corridor/floor_wood.webp" position={[0, -2.195, -.15]} args={[15.8, 11.8]} rotation={[-Math.PI / 2, 0, 0]} opacity={.3} color="#a87554" />
    <ReferencePlane path="/textures/corridor/zakonczeniepodlogi.webp" position={[0, -1.86, -3.79]} args={[15.7, .62]} opacity={.34} color="#b1815d" />
    <mesh position={[0, -2.17, -3.9]}>
      <boxGeometry args={[16.1, .34, .26]} />
      <meshStandardMaterial color="#2f2421" roughness={.76} />
    </mesh>
    {floorLines.map(z => <mesh key={z} position={[0, -2.198, z]}>
      <boxGeometry args={[15.75, .012, .025]} />
      <meshBasicMaterial color="#9a7659" transparent opacity={.42} />
    </mesh>)}
    {wallLines.map(x => <mesh key={x} position={[x, .15, -3.958]}>
      <boxGeometry args={[.026, 3.7, .02]} />
      <meshBasicMaterial color="#77564a" transparent opacity={.34} />
    </mesh>)}
    <mesh position={[0, -2.14, -.15]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[3.05, 64]} />
      <meshStandardMaterial color="#2c5c5a" roughness={.94} />
    </mesh>
    <ReferencePlane path="/textures/gallery/floor.webp" position={[0, -2.105, -.15]} args={[5.8, 2.9]} rotation={[-Math.PI / 2, 0, 0]} opacity={.2} color="#9fc1a0" />
    <mesh position={[0, -2.125, -.15]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[2.77, 2.86, 64]} />
      <meshBasicMaterial color="#d9b376" transparent opacity={.78} />
    </mesh>
  </group>
}

function WindowNook() {
  const stars = useMemo(() => Array.from({ length: 17 }, (_, index) => [
    -1.02 + ((index * 29) % 83) / 42,
    -1.15 + ((index * 19) % 89) / 36,
  ] as [number, number]), [])

  return <group position={[-2.52, 1.45, -3.92]}>
    <mesh position={[0, 0, -.035]}>
      <planeGeometry args={[2.55, 3.35]} />
      <meshBasicMaterial color="#172333" />
    </mesh>
    <ReferencePlane path="/textures/gallery/miastotlo.webp" position={[0, .05, .018]} args={[2.24, 1.45]} opacity={.64} color="#8da7b0" />
    <mesh position={[0, 0, .028]}>
      <planeGeometry args={[2.28, 3.08]} />
      <meshBasicMaterial color="#274356" transparent opacity={.58} />
    </mesh>
    <ReferencePlane path="/textures/entrance/window_sketch.webp" position={[0, 0, .085]} args={[2.55, 3.35]} opacity={.62} color="#e5c99f" />
    {stars.map((star, index) => <mesh key={index} position={[star[0], star[1], .04]}>
      <circleGeometry args={[index % 4 === 0 ? .035 : .018, 10]} />
      <meshBasicMaterial color="#fff1bb" />
    </mesh>)}
    <mesh position={[-1.27, 0, .06]}>
      <boxGeometry args={[.09, 3.35, .08]} />
      <meshStandardMaterial color="#765743" roughness={.7} />
    </mesh>
    <mesh position={[1.27, 0, .065]}>
      <boxGeometry args={[.09, 3.35, .08]} />
      <meshStandardMaterial color="#765743" roughness={.7} />
    </mesh>
    <mesh position={[0, 1.67, .07]}>
      <boxGeometry args={[2.55, .09, .08]} />
      <meshStandardMaterial color="#765743" roughness={.7} />
    </mesh>
    <mesh position={[0, -1.67, .07]}>
      <boxGeometry args={[2.55, .09, .08]} />
      <meshStandardMaterial color="#765743" roughness={.7} />
    </mesh>
    <mesh position={[0, 0, .075]}>
      <boxGeometry args={[.075, 3.38, .07]} />
      <meshStandardMaterial color="#765743" roughness={.7} />
    </mesh>
    <mesh position={[0, -.03, .07]}>
      <boxGeometry args={[2.55, .075, .07]} />
      <meshStandardMaterial color="#765743" roughness={.7} />
    </mesh>
  </group>
}

function FeaturedBookCover({ book, position, selected, onSelect, scale = 1 }: {
  book: StudyBook
  position: [number, number, number]
  selected: boolean
  onSelect: (id: BookId) => void
  scale?: number
}) {
  const group = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (!hovered) return
    document.body.style.cursor = 'pointer'
    return () => { document.body.style.cursor = '' }
  }, [hovered])

  useFrame((_, delta) => {
    if (!group.current) return
    const lift = selected ? .18 : hovered ? .08 : 0
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, position[1] + lift, 8, delta)
    group.current.position.z = THREE.MathUtils.damp(group.current.position.z, position[2] + (selected ? .1 : hovered ? .05 : 0), 8, delta)
    group.current.rotation.z = THREE.MathUtils.damp(group.current.rotation.z, selected ? -.025 : 0, 7, delta)
  })

  return <group
    ref={group}
    position={position}
    scale={scale}
    onClick={event => { event.stopPropagation(); onSelect(book.id) }}
    onPointerOver={event => { event.stopPropagation(); setHovered(true) }}
    onPointerOut={() => setHovered(false)}
  >
    {selected && <mesh position={[0, 0, -.1]} scale={[1.14, 1.12, 1]}>
      <boxGeometry args={[.9, 1.42, .04]} />
      <meshBasicMaterial color={book.accent} transparent opacity={.18} />
    </mesh>}
    <mesh castShadow>
      <boxGeometry args={[.9, 1.42, .12]} />
      <meshStandardMaterial color={book.color} emissive={book.accent} emissiveIntensity={selected ? .24 : hovered ? .1 : 0} roughness={.58} />
    </mesh>
    <mesh position={[0, 0, .071]}>
      <boxGeometry args={[.72, 1.18, .018]} />
      <meshStandardMaterial color="#f5ead5" roughness={.94} />
    </mesh>
    <mesh position={[-.34, 0, .085]}>
      <boxGeometry args={[.025, 1.22, .02]} />
      <meshBasicMaterial color={book.accent} transparent opacity={.9} />
    </mesh>
    <Text position={[0, .2, .1]} font={`${assetBase}/fonts/CabinSketch-Bold.ttf`} fontSize={.16} maxWidth={.62} color="#594135" anchorX="center" anchorY="middle">
      {book.short}
    </Text>
    <Text position={[0, -.31, .1]} fontSize={.062} maxWidth={.62} color="#806b59" anchorX="center" anchorY="middle">
      {book.tag}
    </Text>
  </group>
}

function FeaturedReadingWall({ selected, onSelect }: { selected: StudyBook; onSelect: (id: BookId) => void }) {
  const wall = useRef<THREE.Group>(null)
  const featured = useMemo(() => {
    const related = studyBooks.filter(book => book.id !== selected.id && book.tag !== selected.tag)
    return [selected, ...related].slice(0, 5)
  }, [selected])

  useFrame((state, delta) => {
    if (!wall.current) return
    wall.current.position.y = THREE.MathUtils.damp(wall.current.position.y, 1.72 + Math.sin(state.clock.elapsedTime * .38) * .012, 3.5, delta)
    wall.current.rotation.z = THREE.MathUtils.damp(wall.current.rotation.z, Math.sin(state.clock.elapsedTime * .25) * .0025, 3.5, delta)
  })

  return <group ref={wall} position={[.72, 1.72, -3.42]}>
    <mesh position={[0, 0, -.08]} receiveShadow>
      <boxGeometry args={[5.08, 3.34, .16]} />
      <meshStandardMaterial color="#2f211d" roughness={.82} />
    </mesh>
    <mesh position={[0, 0, .015]}>
      <boxGeometry args={[4.88, 3.14, .035]} />
      <meshStandardMaterial color="#d3b68f" roughness={.92} />
    </mesh>
    <ReferencePlane path="/textures/paper-texture.webp" position={[0, 0, .04]} args={[4.76, 3.02]} opacity={.17} color="#8d684e" />
    <mesh position={[0, -.7, .08]} castShadow>
      <boxGeometry args={[4.54, .12, .32]} />
      <meshStandardMaterial color="#825637" roughness={.68} />
    </mesh>
    <Text position={[-2.28, 1.3, .11]} font={`${assetBase}/fonts/CabinSketch-Bold.ttf`} fontSize={.15} color="#604535" anchorX="left" anchorY="middle">
      精选阅读
    </Text>
    <Text position={[2.28, 1.3, .07]} fontSize={.075} color="#866c52" anchorX="right" anchorY="middle">
      {String(studyBooks.length).padStart(2, '0')} 本可读
    </Text>
    <Text position={[0, 1.05, .11]} fontSize={.065} color="#967858" anchorX="center" anchorY="middle">
      点击书脊，抽出一本开始阅读
    </Text>
    {featured.map((book, index) => <FeaturedBookCover
      key={book.id}
      book={book}
      selected={book.id === selected.id}
      onSelect={onSelect}
      scale={.8}
      position={[-1.55 + index * .775, .02, .16]}
    />)}
    <Text position={[0, -.99, .11]} fontSize={.14} maxWidth={3.42} color="#4f392e" anchorX="center" anchorY="middle">
      {selected.title}
    </Text>
    <Text position={[0, -1.22, .11]} fontSize={.065} maxWidth={3.25} color="#806a55" anchorX="center" anchorY="middle">
      {selected.subtitle}
    </Text>
    <pointLight position={[0, .25, .52]} color={selected.accent} intensity={.65} distance={3.8} />
  </group>
}

function StaticBook({ position, color, height, tilt = 0 }: { position: [number, number, number]; color: string; height: number; tilt?: number }) {
  return <mesh position={position} rotation={[0, 0, tilt]} castShadow>
    <boxGeometry args={[.4, height, .3]} />
    <meshStandardMaterial color={color} roughness={.72} />
  </mesh>
}

function InteractiveBook({ book, position, selected, onSelect }: {
  book: StudyBook
  position: [number, number, number]
  selected: boolean
  onSelect: (id: BookId) => void
}) {
  const group = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (!hovered) return
    document.body.style.cursor = 'pointer'
    return () => { document.body.style.cursor = '' }
  }, [hovered])

  useFrame((state, delta) => {
    if (!group.current) return
    const pull = selected ? .48 : hovered ? .22 : 0
    group.current.position.z = THREE.MathUtils.damp(group.current.position.z, position[2] + pull, 8, delta)
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, position[1] + (selected ? Math.sin(state.clock.elapsedTime * 2.1) * .028 : 0), 8, delta)
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, selected ? -.07 : hovered ? -.035 : 0, 7, delta)
  })

  return <group
    ref={group}
    position={position}
    onClick={event => { event.stopPropagation(); onSelect(book.id) }}
    onPointerOver={event => { event.stopPropagation(); setHovered(true) }}
    onPointerOut={() => setHovered(false)}
  >
    <mesh castShadow>
      <boxGeometry args={[.48, 1.3, .38]} />
      <meshStandardMaterial color={book.color} emissive={book.accent} emissiveIntensity={selected ? .22 : hovered ? .08 : 0} roughness={.52} />
    </mesh>
    <mesh position={[-.205, 0, .205]}><boxGeometry args={[.035, 1.18, .02]} /><meshBasicMaterial color="#f4dfb0" transparent opacity={.78} /></mesh>
    <Text position={[0, -.02, .205]} fontSize={.14} maxWidth={.34} color="#fff8e9" anchorX="center" anchorY="middle">
      {book.short}
    </Text>
    {selected && <>
      <pointLight position={[0, .15, .7]} color={book.accent} intensity={1.9} distance={2.9} />
      <mesh position={[0, 0, .22]} scale={[1.13, 1.16, 1]}>
        <boxGeometry args={[.48, 1.3, .04]} />
        <meshBasicMaterial color={book.accent} transparent opacity={.1 + Math.sin(performance.now() * .002) * .025} />
      </mesh>
    </>}
  </group>
}

function Bookshelf({ side, selectedId, onSelect }: { side: 'left' | 'right'; selectedId: BookId; onSelect: (id: BookId) => void }) {
  const staticBooks = useMemo(() => {
    const featuredSlots = new Set(studyBooks.filter(book => book.side === side).map(book => book.shelf + '-' + book.slot))
    const values: Array<{ position: [number, number, number]; color: string; height: number; tilt: number }> = []
    for (let shelf = 0; shelf < 4; shelf += 1) {
      for (let slot = 0; slot < 7; slot += 1) {
        if (featuredSlots.has(shelf + '-' + slot)) continue
        const height = .74 + ((slot * 5 + shelf * 7) % 6) * .1
        values.push({
          position: [-1.52 + slot * .51, -2.07 + shelf * 1.47 + height / 2, .26],
          color: neutralColors[(slot * 3 + shelf * 5 + (side === 'left' ? 0 : 2)) % neutralColors.length],
          height,
          tilt: ((slot + shelf) % 5 === 0 ? .08 : (slot + shelf) % 7 === 0 ? -.06 : 0),
        })
      }
    }
    return values
  }, [side])

  const featured = studyBooks.filter(book => book.side === side)
  return <group position={[side === 'left' ? -5.22 : 5.22, 1.2, -3.45]}>
    <mesh position={[0, 0, -.13]} receiveShadow>
      <boxGeometry args={[4.22, 7.08, .28]} />
      <meshStandardMaterial color="#2e221f" roughness={.8} />
    </mesh>
    <mesh position={[-2.06, 0, .08]}><boxGeometry args={[.19, 7.34, .52]} /><meshStandardMaterial color="#72503a" roughness={.7} /></mesh>
    <mesh position={[2.06, 0, .08]}><boxGeometry args={[.19, 7.34, .52]} /><meshStandardMaterial color="#72503a" roughness={.7} /></mesh>
    <mesh position={[0, 3.55, .08]}><boxGeometry args={[4.3, .22, .52]} /><meshStandardMaterial color="#825b40" roughness={.7} /></mesh>
    <mesh position={[0, -3.55, .08]}><boxGeometry args={[4.3, .22, .52]} /><meshStandardMaterial color="#825b40" roughness={.7} /></mesh>
    {Array.from({ length: 4 }, (_, shelf) => <mesh key={shelf} position={[0, -1.58 + shelf * 1.47, .1]} receiveShadow>
      <boxGeometry args={[4.07, .13, .64]} />
      <meshStandardMaterial color="#8e6548" roughness={.7} />
    </mesh>)}
    {staticBooks.map((book, index) => <StaticBook key={index} {...book} />)}
    {featured.map(book => <InteractiveBook
      key={book.id}
      book={book}
      selected={book.id === selectedId}
      onSelect={onSelect}
      position={[-1.52 + book.slot * .51, -2.07 + book.shelf * 1.47 + .65, .28]}
    />)}
  </group>
}

function Desk({ selected }: { selected: StudyBook }) {
  const openBook = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (openBook.current) {
      openBook.current.position.y = -.125 + Math.sin(state.clock.elapsedTime * 1.35) * .012
      openBook.current.rotation.y = Math.sin(state.clock.elapsedTime * .46) * .015
    }
  })
  return <group>
    <mesh position={[0, -.67, -.4]} castShadow receiveShadow>
      <boxGeometry args={[5.3, .22, 2.5]} />
      <meshStandardMaterial color="#704b34" roughness={.6} />
    </mesh>
    <mesh position={[-2.18, -1.45, -.98]} castShadow><boxGeometry args={[.24, 1.55, .24]} /><meshStandardMaterial color="#543725" roughness={.68} /></mesh>
    <mesh position={[2.18, -1.45, -.98]} castShadow><boxGeometry args={[.24, 1.55, .24]} /><meshStandardMaterial color="#543725" roughness={.68} /></mesh>
    <mesh position={[-2.18, -1.45, .2]} castShadow><boxGeometry args={[.24, 1.55, .24]} /><meshStandardMaterial color="#543725" roughness={.68} /></mesh>
    <mesh position={[2.18, -1.45, .2]} castShadow><boxGeometry args={[.24, 1.55, .24]} /><meshStandardMaterial color="#543725" roughness={.68} /></mesh>
    <mesh position={[-1.55, -.48, -.06]} rotation={[0, .08, 0]} castShadow><boxGeometry args={[.92, .09, 1.24]} /><meshStandardMaterial color="#ece1c9" roughness={.9} /></mesh>
    <mesh position={[-1.22, -.42, -.06]} rotation={[0, .08, 0]}><planeGeometry args={[.58, .79]} /><meshBasicMaterial color="#bdd3ce" transparent opacity={.54} /></mesh>
    <group ref={openBook} position={[.15, -.125, -.45]}>
      <mesh position={[-.62, 0, 0]} rotation={[0, .12, 0]} castShadow><boxGeometry args={[1.25, .09, 1.1]} /><meshStandardMaterial color="#f5edd9" roughness={.95} /></mesh>
      <mesh position={[.62, 0, 0]} rotation={[0, -.12, 0]} castShadow><boxGeometry args={[1.25, .09, 1.1]} /><meshStandardMaterial color="#f5edd9" roughness={.95} /></mesh>
      <mesh position={[0, -.035, .01]}><boxGeometry args={[.08, .05, 1.09]} /><meshStandardMaterial color={selected.color} roughness={.62} /></mesh>
      <Text position={[0, .065, -.26]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.18} color={selected.color} anchorX="center" anchorY="middle">
        {selected.short}
      </Text>
      <Text position={[0, .067, .1]} rotation={[-Math.PI / 2, 0, 0]} fontSize={.1} maxWidth={1.8} color="#6a5446" anchorX="center" anchorY="middle">
        {selected.tag}
      </Text>
    </group>
    <group position={[-.78, -.43, -.99]} rotation={[0, -.14, -.08]}>
      <mesh castShadow><boxGeometry args={[.12, .12, 1.22]} /><meshStandardMaterial color="#b94f3c" roughness={.48} /></mesh>
      <mesh position={[0, .01, .6]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[.08, .22, 12]} /><meshStandardMaterial color="#e6c297" roughness={.5} /></mesh>
    </group>
    <ReferencePlane path="/textures/corridor/decorations/pencil.webp" position={[-.8, -.505, -.98]} args={[.92, .92]} rotation={[-Math.PI / 2, 0, -.18]} opacity={.96} />
    <ReferencePlane path="/textures/corridor/decorations/coffee_cup.webp" position={[2.04, -.49, -.86]} args={[.82, .82]} rotation={[-Math.PI / 2, 0, 0]} opacity={.96} />
    <ReferencePlane path="/textures/corridor/decorations/paper_ball.webp" position={[-2.08, -.49, -.7]} args={[.56, .56]} rotation={[-Math.PI / 2, 0, .12]} opacity={.9} />
  </group>
}

function ReadingStool() {
  return <group position={[0, -1.64, 1.35]}>
    <mesh castShadow><cylinderGeometry args={[.82, .76, .42, 32]} /><meshStandardMaterial color="#56716c" roughness={.9} /></mesh>
    <mesh position={[0, .23, 0]}><cylinderGeometry args={[.72, .79, .12, 32]} /><meshStandardMaterial color="#d9bd89" roughness={.82} /></mesh>
    {[-.5, .5].map(x => [-.48, .48].map(z => <mesh key={x + '-' + z} position={[x, -.42, z]} castShadow><boxGeometry args={[.11, .48, .11]} /><meshStandardMaterial color="#5d402e" roughness={.7} /></mesh>))}
  </group>
}

function StudyArchiveScene({ selectedId, onSelect }: { selectedId: BookId; onSelect: (id: BookId) => void }) {
  const selected = studyBooks.find(book => book.id === selectedId) ?? studyBooks[0]
  return <>
    <color attach="background" args={['#1e1718']} />
    <fog attach="fog" args={['#1e1718', 13, 24]} />
    <ambientLight intensity={.68} color="#f3dcc0" />
    <hemisphereLight args={['#ffdcb7', '#22232b', .75]} />
    <directionalLight position={[-4, 7, 4]} intensity={1.28} color="#ffd8a9" castShadow />
    <pointLight position={[-2.5, 2.8, -1.7]} color="#b8d8ff" intensity={.85} distance={5.8} />
    <RoomShell />
    <WindowNook />
    <FeaturedReadingWall selected={selected} onSelect={onSelect} />
    <Bookshelf side="left" selectedId={selectedId} onSelect={onSelect} />
    <Bookshelf side="right" selectedId={selectedId} onSelect={onSelect} />
    <Desk selected={selected} />
    <ReadingStool />
    <ReferencePlant position={[-2.75, -1.75, -3.15]} scale={.42} />
    <mesh position={[0, 4.16, -1.4]} castShadow>
      <cylinderGeometry args={[.035, .035, 1.15, 16]} />
      <meshStandardMaterial color="#805b41" metalness={.35} roughness={.4} />
    </mesh>
    <mesh position={[0, 3.53, -1.4]} castShadow>
      <coneGeometry args={[.7, .62, 32, 1, true]} />
      <meshStandardMaterial color="#d4965e" side={THREE.DoubleSide} roughness={.5} />
    </mesh>
    <pointLight position={[0, 3.18, -1.15]} color="#ffd39a" intensity={4.4} distance={7.2} decay={2} />
    <DustField />
    <ContactShadows position={[0, -2.19, -.15]} opacity={.45} scale={17} blur={2.5} far={4.6} color="#181112" />
    <CameraRig />
  </>
}

function Fallback({ selected, onSelect }: { selected: StudyBook; onSelect: (id: BookId) => void }) {
  return <div className="study-archive-fallback">
    <div className="study-archive-fallback-shelf">
      {studyBooks.map(book => <button key={book.id} className={book.id === selected.id ? 'active' : ''} type="button" style={{ background: book.color }} onClick={() => onSelect(book.id)}>
        <b>{book.short}</b><span>{book.tag}</span>
      </button>)}
    </div>
    <div className="study-archive-fallback-desk">
      <BookOpen size={27} />
      <strong>{selected.title}</strong>
      <span>{selected.subtitle}</span>
    </div>
  </div>
}

export default function StudyArchiveRoom({ onExit }: Props) {
  const [canUseWebGL] = useState(supportsWebGL)
  const [selectedId, setSelectedId] = useState<BookId>('probability')
  const [readerOpen, setReaderOpen] = useState(false)
  const selected = studyBooks.find(book => book.id === selectedId) ?? studyBooks[0]

  useEffect(() => {
    document.body.classList.add('study-archive-open')
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('study-archive-open')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onExit])

  return createPortal(<div className="study-archive-layer" role="dialog" aria-modal="true" aria-label="学习档案馆">
    <section className="study-archive-shell">
      <header className="study-archive-topbar">
        <button type="button" className="study-archive-back" onClick={onExit}><ArrowLeft size={17} /><span>返回学习屋</span></button>
        <div className="study-archive-brand"><LibraryBig size={17} /><span>学习档案馆</span><small>STUDY ARCHIVE</small></div>
        <button type="button" className="study-archive-close" onClick={onExit} aria-label="关闭学习档案馆"><X size={19} /></button>
      </header>
      <main className="study-archive-stage">
        {canUseWebGL ? <Canvas
          className="study-archive-canvas"
          camera={{ position: [0, 1.35, 9.4], fov: 52, near: .1, far: 32 }}
          dpr={[1, 1.55]}
          shadows
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <Suspense fallback={null}>
            <StudyArchiveScene selectedId={selectedId} onSelect={setSelectedId} />
          </Suspense>
        </Canvas> : <Fallback selected={selected} onSelect={setSelectedId} />}

        <div className="study-archive-intro" aria-hidden="true">
          <span>ROOM 05 / LEARNING DOCUMENTS</span>
          <h1>把学习资料<br />放进一间会呼吸的书房。</h1>
          <p>点击书架上泛着暖光的课程书，它会抽出，并同步出现在桌面的学习册里。</p>
        </div>

        <aside className="study-archive-selected" aria-live="polite">
          <span><Sparkles size={13} /> 当前学习册</span>
          <b>{selected.title}</b>
          <p>{selected.subtitle}</p>
          <small>{selected.tag} · 点击下方按钮打开翻页学习册</small>
          <button type="button" className="study-archive-open-reader" onClick={() => setReaderOpen(true)}><BookOpen size={14} />打开翻页学习册</button>
        </aside>

        <nav className="study-archive-shelf-nav" aria-label="选择课程学习册">
          <span><BookOpen size={14} /> 重点课程书</span>
          <div>
            {studyBooks.map(book => <button key={book.id} type="button" className={book.id === selected.id ? 'active' : ''} onClick={() => setSelectedId(book.id)}>
              <i style={{ background: book.color }} /><b>{book.short}</b><ChevronRight size={13} />
            </button>)}
          </div>
        </nav>
      </main>
    </section>
    {readerOpen && <StudyArchiveBookReader key={selected.id} book={selected} onClose={() => setReaderOpen(false)} />}
  </div>, document.body)
}
