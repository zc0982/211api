/**
 * three.js armillary. Loaded only through a dynamic import() from
 * ArmillaryHero after mount; everything three-related lives in this module
 * (and the vendor-three chunk). Spec: Figma 10:890, docs/spec/brand-home.md.
 */
import {
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Texture
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { ARMILLARY_RING_WIDTH, ARMILLARY_RINGS, ARMILLARY_WEBGL, type BrandVendor } from '../config'
import { isSlowFrames, type StaticReason } from './capability'
import { drawDial, EARTHLY_BRANCHES, HEAVENLY_STEMS, LUNAR_MANSIONS, type DialSpec } from './dials'
import { damp, isMerged, lightPhase, mergeCount, mergePulse, nextTracked, ringAngle, sinceMerge } from './timeline'

/** Screen placement of one bead, in px relative to the instrument box. */
export interface BeadPlacement {
  vendor: BrandVendor
  x: number
  y: number
  /** 0 (far side) … 1 (near side). */
  front: number
}

export interface ArmillaryCallbacks {
  /** First frame drawn: the host fades the static render out. */
  onFirstFrame: () => void
  /** Runtime fallback: the host shows the static render again and disposes. */
  onFallback: (reason: StaticReason) => void
  /** Auto-rotation picked a new tracked vendor at a merge. */
  onAutoTrack: (vendor: BrandVendor) => void
  /** Every frame: bead anchors projected to the box. */
  onBeads: (beads: readonly BeadPlacement[]) => void
}

export interface ArmillaryOptions {
  canvas: HTMLCanvasElement
  /** The instrument box the HTML overlays are positioned in (pointer parallax origin). */
  box: HTMLElement
  tracked: BrandVendor
  parallax: boolean
  callbacks: ArmillaryCallbacks
}

export interface ArmillaryController {
  setTracked: (vendor: BrandVendor) => void
  /** Pause auto-rotation for `ms` from now (manual bead switch). */
  holdAutoTrack: (ms: number) => void
  /** Pause / resume the render loop (offscreen, hidden tab). */
  setRunning: (running: boolean) => void
  dispose: () => void
  /** renderer.info.memory plus live program count, for leak checks. */
  info: () => { geometries: number; textures: number; programs: number; frames: number }
  /** Dev only: freeze the timeline at `t` ms (null resumes). */
  freeze: (t: number | null) => void
  /** Dev only: project a point on ring `ring` at ring-local `angle` to box px. */
  debugProject?: (ring: number, angle: number) => { x: number; y: number }
}

const ORDER = ARMILLARY_RINGS.map((r) => r.vendor)

const NAVY = '#21418f'
const SKY = '#a9c8f5'
const SILVER = '#f1f4fa'
const GROOVE_BLUE = '#2f5fd0'
const GOLD = '#d4a84b'

/** Polar axis elevation: Luoyang latitude. */
const LATITUDE = (34.6 * Math.PI) / 180
/** Each inner ring's flip axis, as an azimuth in the equatorial plane. */
const FLIP_AXES = [0.35, 1.25, 2.15, 2.85]
/** Bead anchor angle on each ring (ring-local), tuned to match Figma 10:960 when merged. */
const BEAD_ANGLES = [3.735, 1.415, 5.072, 2.995]

const CAMERA_DISTANCE = 6.85
const CAMERA_ELEVATION = (10 * Math.PI) / 180
const INSTRUMENT_YAW = 2.23

/** The canvas overhangs the box by this fraction on every side (parallax room). */
export const CANVAS_OVERHANG = 0.1

/** Washer profile for LatheGeometry: rectangle (radius ± w/2, ± t/2). */
function washer(radius: number, width: number, thickness: number, segments = 160): LatheGeometry {
  const r0 = radius - width / 2
  const r1 = radius + width / 2
  const h = thickness / 2
  const pts = [new Vector2(r0, -h), new Vector2(r1, -h), new Vector2(r1, h), new Vector2(r0, h), new Vector2(r0, -h)]
  return new LatheGeometry(pts, segments)
}

/** Flat annulus lying in the local XZ plane, facing +Y (planar UVs). */
function annulus(inner: number, outer: number, y: number, segments = 160): RingGeometry {
  const g = new RingGeometry(inner, outer, segments, 1)
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

function radialSprite(color: string, size = 128): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  const c = new Color(color)
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`
  g.addColorStop(0, `rgba(${rgb},1)`)
  g.addColorStop(0.45, `rgba(${rgb},0.35)`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return canvas
}

export function createArmillary(opts: ArmillaryOptions): ArmillaryController {
  const { canvas, box, callbacks } = opts

  // ── renderer ────────────────────────────────────────────────────────────
  // Throws when the context cannot be created; the caller falls back.
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = NeutralToneMapping
  renderer.toneMappingExposure = 1
  renderer.outputColorSpace = SRGBColorSpace

  const scene = new Scene()
  // ~10° above the horizon (the horizon ring reads as a 0.17 ellipse in 10:959).
  const camera = new PerspectiveCamera(26, 1, 0.1, 50)
  camera.position.set(0, CAMERA_DISTANCE * Math.sin(CAMERA_ELEVATION) - 0.14, CAMERA_DISTANCE * Math.cos(CAMERA_ELEVATION))
  camera.lookAt(0.04, -0.14, 0)

  const textures: Texture[] = []
  const pmrem = new PMREMGenerator(renderer)
  const room = new RoomEnvironment(renderer)
  const envMap = pmrem.fromScene(room, 0.04).texture
  textures.push(envMap)
  scene.environment = envMap
  room.traverse((o) => {
    const m = o as Mesh
    m.geometry?.dispose()
    ;(m.material as Material | undefined)?.dispose?.()
  })
  pmrem.dispose()

  scene.add(new HemisphereLight(0xf4f8ff, 0xb8c6e0, 0.9))
  const key = new DirectionalLight(0xffffff, 1.6)
  key.position.set(-2.5, 3.5, 4)
  scene.add(key)

  // ── materials ───────────────────────────────────────────────────────────
  const glaze = new MeshPhysicalMaterial({ color: NAVY, metalness: 0.3, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.14 })
  const silver = new MeshStandardMaterial({ color: SILVER, metalness: 0.92, roughness: 0.2 })
  const grooveBlue = new MeshBasicMaterial({ color: GROOVE_BLUE, side: DoubleSide })
  const grooveGold = new MeshBasicMaterial({ color: GOLD, side: DoubleSide })
  const goldBright = new MeshBasicMaterial({ color: GOLD, transparent: true })
  const lightMat = new MeshBasicMaterial({ color: GOLD })

  function dialMaterial(spec: DialSpec): MeshBasicMaterial | null {
    const c = drawDial(spec)
    if (!c) return null
    const tex = new CanvasTexture(c)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
    textures.push(tex)
    return new MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2
    })
  }

  /** Outer ring: navy glaze washer with an engraved dial on both faces. */
  function outerRing(radius: number, width: number, labels: readonly string[], ticks: number): Group {
    const g = new Group()
    const thickness = 0.034
    g.add(new Mesh(washer(radius, width, thickness), glaze))
    const mat = dialMaterial({ labels, ticks, innerFrac: (radius - width / 2) / (radius + width / 2), color: SKY })
    if (mat) {
      const top = new Mesh(annulus(radius - width / 2, radius + width / 2, thickness / 2 + 0.0008), mat)
      const bottom = new Mesh(annulus(radius - width / 2, radius + width / 2, -thickness / 2 - 0.0008), mat)
      g.add(top, bottom)
    }
    return g
  }

  // ── instrument ──────────────────────────────────────────────────────────
  const rig = new Group() // pointer parallax
  const instrument = new Group()
  // Meridian plane seen at ~53° (0.6 ellipse), north pole up-left and away.
  instrument.rotation.y = INSTRUMENT_YAW
  rig.add(instrument)
  scene.add(rig)

  // Horizon ring (flat, 12 branches).
  const horizon = outerRing(1.2, 0.07, EARTHLY_BRANCHES, 120)
  instrument.add(horizon)

  // Meridian ring (vertical, 10 stems): the lathe lies in XZ, stand it up into XY.
  const meridian = outerRing(1.13, 0.06, HEAVENLY_STEMS, 100)
  meridian.rotation.x = Math.PI / 2
  instrument.add(meridian)

  // Equatorial frame: normal along the polar axis (in the meridian plane, elevated by latitude).
  const equator = new Group()
  equator.rotation.z = -(Math.PI / 2 - LATITUDE)
  instrument.add(equator)
  equator.add(outerRing(1.0, 0.06, LUNAR_MANSIONS, 112))

  // Stand.
  const column = new Mesh(new CylinderGeometry(0.035, 0.055, 0.32, 24), glaze)
  column.position.y = -1.13 - 0.16
  const foot = new Mesh(new CylinderGeometry(0.2, 0.24, 0.05, 48), glaze)
  foot.position.y = -1.13 - 0.32 - 0.025
  instrument.add(column, foot)

  // Centre: navy sphere, gold ring, soft gold halo.
  const core = new Mesh(new SphereGeometry(0.075, 32, 16), glaze)
  equator.add(core)
  const coreRing = new Mesh(new TorusGeometry(0.11, 0.007, 8, 64), goldBright)
  coreRing.rotation.x = Math.PI / 2
  equator.add(coreRing)
  const haloCanvas = radialSprite(GOLD)
  const haloTex = haloCanvas ? new CanvasTexture(haloCanvas) : null
  if (haloTex) {
    haloTex.colorSpace = SRGBColorSpace
    textures.push(haloTex)
  }
  const halo = new Sprite(new SpriteMaterial({ map: haloTex, color: GOLD, transparent: true, depthWrite: false, opacity: 0 }))
  halo.scale.setScalar(0.55)
  equator.add(halo)

  // Merge pulse: thin blue line spreading along the equator.
  const pulseMat = new MeshBasicMaterial({ color: GROOVE_BLUE, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide })
  const pulse = new Mesh(annulus(0.995, 1.0, 0, 192), pulseMat)
  pulse.visible = false
  equator.add(pulse)

  // Inner rings: polished silver + groove, each flipping about its own axis.
  const ringThickness = 0.018
  const pivots: Object3D[] = []
  const grooves: Mesh[][] = []
  const anchors: Object3D[] = []
  ARMILLARY_RINGS.forEach((ring, i) => {
    const holder = new Group()
    holder.rotation.y = -FLIP_AXES[i] // local X is the flip axis
    const pivot = new Group()
    holder.add(pivot)
    pivot.add(new Mesh(washer(ring.radius, ARMILLARY_RING_WIDTH, ringThickness), silver))
    const gw = 0.006
    const top = new Mesh(annulus(ring.radius - gw, ring.radius + gw, ringThickness / 2 + 0.0008), grooveBlue)
    const bottom = new Mesh(annulus(ring.radius - gw, ring.radius + gw, -ringThickness / 2 - 0.0008), grooveBlue)
    pivot.add(top, bottom)
    const anchor = new Object3D()
    const a = BEAD_ANGLES[i]
    anchor.position.set(ring.radius * Math.cos(a), 0, ring.radius * Math.sin(a))
    pivot.add(anchor)
    equator.add(holder)
    pivots.push(pivot)
    grooves.push([top, bottom])
    anchors.push(anchor)
  })

  // Gold light point on the tracked ring.
  const light = new Group()
  light.add(new Mesh(new SphereGeometry(0.026, 16, 8), lightMat))
  const glowCanvas = radialSprite(GOLD, 64)
  const glowTex = glowCanvas ? new CanvasTexture(glowCanvas) : null
  if (glowTex) {
    glowTex.colorSpace = SRGBColorSpace
    textures.push(glowTex)
  }
  const glow = new Sprite(new SpriteMaterial({ map: glowTex, color: GOLD, transparent: true, depthWrite: false, opacity: 0.85 }))
  glow.scale.setScalar(0.16)
  light.add(glow)

  // ── tracking ────────────────────────────────────────────────────────────
  let trackedIndex = Math.max(0, ORDER.indexOf(opts.tracked))
  let holdUntil = 0
  function applyTracked() {
    grooves.forEach((pair, i) => pair.forEach((m) => (m.material = i === trackedIndex ? grooveGold : grooveBlue)))
    pivots[trackedIndex].add(light)
  }
  applyTracked()

  // ── sizing ──────────────────────────────────────────────────────────────
  let cw = 0
  let ch = 0
  function resize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h || (w === cw && h === ch)) return
    cw = w
    ch = h
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
  ro?.observe(canvas)
  resize()

  // ── parallax ────────────────────────────────────────────────────────────
  let targetYaw = 0
  let targetPitch = 0
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
    const r = box.getBoundingClientRect()
    const nx = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)
    const ny = (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)
    targetYaw = Math.max(-1, Math.min(1, nx)) * 0.2
    targetPitch = Math.max(-1, Math.min(1, ny)) * 0.07
  }
  if (opts.parallax) window.addEventListener('pointermove', onPointer, { passive: true })

  // ── context loss ────────────────────────────────────────────────────────
  let disposed = false
  const onLost = (e: Event) => {
    e.preventDefault()
    fallback('context-lost')
  }
  canvas.addEventListener('webglcontextlost', onLost)

  function fallback(reason: StaticReason) {
    if (disposed) return
    dispose()
    callbacks.onFallback(reason)
  }

  // ── loop ────────────────────────────────────────────────────────────────
  let t = 0
  let frozen: number | null = null
  let last: number | null = null
  let raf = 0
  let running = false
  let drawn = false
  let merges = 0
  const frameTimes: number[] = []
  let probing = true
  const v = new Vector3()
  const centre = new Vector3()
  const beads: BeadPlacement[] = ORDER.map((vendor) => ({ vendor, x: 0, y: 0, front: 1 }))

  function update(time: number, dtSeconds: number) {
    pivots.forEach((p, i) => (p.rotation.x = ringAngle(i, time)))

    const m = mergeCount(time)
    if (m > merges) {
      // The intro merge (#1) keeps the initial vendor; later merges rotate.
      if (merges >= 1 && performance.now() >= holdUntil) {
        trackedIndex = ORDER.indexOf(nextTracked(ORDER[trackedIndex], ORDER))
        applyTracked()
        callbacks.onAutoTrack(ORDER[trackedIndex])
      }
      merges = m
    }

    const ring = ARMILLARY_RINGS[trackedIndex]
    const a = lightPhase(time) * Math.PI * 2
    light.position.set(ring.radius * Math.cos(a), 0, ring.radius * Math.sin(a))

    const p = mergePulse(time)
    pulse.visible = p > 0
    if (p > 0) {
      pulse.scale.setScalar(0.55 + 0.75 * (1 - p))
      pulseMat.opacity = 0.6 * p
    }
    const since = sinceMerge(time)
    const lit = isMerged(time) ? 1 : since === null ? 0 : Math.max(0, 1 - (since - 2000) / 600)
    goldBright.opacity = 0.55 + 0.45 * lit
    ;(halo.material as SpriteMaterial).opacity = 0.16 * lit + 0.3 * p

    rig.rotation.y = damp(rig.rotation.y, targetYaw, 2.6, dtSeconds)
    rig.rotation.x = damp(rig.rotation.x, targetPitch, 2.6, dtSeconds)
  }

  function project() {
    // The canvas is the instrument area grown by CANVAS_OVERHANG on every side.
    const ox = (cw * CANVAS_OVERHANG) / (1 + 2 * CANVAS_OVERHANG)
    const oy = (ch * CANVAS_OVERHANG) / (1 + 2 * CANVAS_OVERHANG)
    scene.updateMatrixWorld()
    core.getWorldPosition(centre).applyMatrix4(camera.matrixWorldInverse)
    anchors.forEach((anchor, i) => {
      anchor.getWorldPosition(v)
      const viewZ = v.clone().applyMatrix4(camera.matrixWorldInverse).z
      v.project(camera)
      const b = beads[i]
      b.x = ((v.x + 1) / 2) * cw - ox
      b.y = ((1 - v.y) / 2) * ch - oy
      b.front = Math.max(0, Math.min(1, (viewZ - centre.z) / (2 * ARMILLARY_RINGS[i].radius) + 0.5))
    })
    callbacks.onBeads(beads)
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    const raw = last === null ? 0 : now - last
    last = now
    const dt = Math.min(raw, 100)
    if (frozen === null) t += dt
    else t = frozen
    resize()
    update(t, dt / 1000)
    renderer.render(scene, camera)
    project()
    if (!drawn) {
      drawn = true
      callbacks.onFirstFrame()
      return
    }
    if (probing && raw > 0 && raw < 1000) {
      frameTimes.push(raw)
      if (frameTimes.length >= ARMILLARY_WEBGL.probeFrames) {
        probing = false
        if (isSlowFrames(frameTimes)) fallback('slow-frames')
      }
    }
  }

  function setRunning(next: boolean) {
    if (disposed || next === running) return
    running = next
    if (running) {
      last = null
      raf = requestAnimationFrame(frame)
    } else {
      cancelAnimationFrame(raf)
      raf = 0
      // A pause would skew the frame-time probe; restart it on resume.
      frameTimes.length = 0
    }
  }

  function dispose() {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(raf)
    running = false
    ro?.disconnect()
    window.removeEventListener('pointermove', onPointer)
    canvas.removeEventListener('webglcontextlost', onLost)
    const geos = new Set<BufferGeometry>()
    const mats = new Set<Material>()
    scene.traverse((o) => {
      const mesh = o as Mesh
      if (mesh.geometry) geos.add(mesh.geometry)
      if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((mat) => mats.add(mat))
    })
    ;[glaze, silver, grooveBlue, grooveGold, goldBright, lightMat, pulseMat].forEach((mat) => mats.add(mat))
    geos.forEach((g) => g.dispose())
    mats.forEach((mat) => mat.dispose())
    textures.forEach((tex) => tex.dispose())
    scene.environment = null
    renderer.renderLists.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }

  return {
    setTracked(vendor) {
      const i = ORDER.indexOf(vendor)
      if (i < 0 || i === trackedIndex || disposed) return
      trackedIndex = i
      applyTracked()
    },
    holdAutoTrack(ms) {
      holdUntil = Math.max(holdUntil, performance.now() + ms)
    },
    setRunning,
    dispose,
    info() {
      return {
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0,
        frames: renderer.info.render.frame
      }
    },
    freeze(time) {
      frozen = time
    },
    debugProject: import.meta.env.DEV
      ? (ring: number, angle: number) => {
          const r = ARMILLARY_RINGS[ring].radius
          const o = new Object3D()
          o.position.set(r * Math.cos(angle), 0, r * Math.sin(angle))
          pivots[ring].add(o)
          scene.updateMatrixWorld()
          o.getWorldPosition(v)
          pivots[ring].remove(o)
          v.project(camera)
          const k = CANVAS_OVERHANG / (1 + 2 * CANVAS_OVERHANG)
          return { x: ((v.x + 1) / 2 - k) * cw, y: ((1 - v.y) / 2 - k) * ch }
        }
      : undefined
  }
}
