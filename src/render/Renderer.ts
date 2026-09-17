import * as THREE from 'three'
import { groundHeight, slopeEast, tileCentre } from '../sim/town'
import { TUNING } from '../sim/tuning'
import { snowRate } from '../sim/weather'
import type { World } from '../sim/World'
import { SnowField } from './SnowField'
import { buildTown } from './TownView'
import { TruckModel, buildBus } from './Vehicles'

const FLAKES = 3000
const FLAKE_BOX = { x: 140, y: 50, z: 140 }
const NIGHT = 0x0a1024

/** A soft round dot, so near flakes are not big squares. */
function flakeTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.8)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 32, 32)
  return new THREE.CanvasTexture(c)
}

export type CameraMode = 'chase' | 'high'

export class Renderer {
  mode: CameraMode = 'chase'
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(55, 1, 0.5, 900)
  private snow: SnowField
  private truck = new TruckModel()
  private bus = buildBus()
  private flakes: THREE.Points
  private flakeVel = new Float32Array(FLAKES)
  private look = new THREE.Vector3()
  private snowTimer = 0
  private onResize = (): void => this.resize()

  constructor(
    private canvas: HTMLCanvasElement,
    world: World,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15

    const C = TUNING.cell
    const w = world.town.width * C
    const h = world.town.height * C
    this.scene.background = new THREE.Color(NIGHT)
    this.scene.fog = new THREE.FogExp2(NIGHT, 0.0075)

    this.scene.add(new THREE.HemisphereLight(0x7f93c9, 0x202838, 0.9))
    const moon = new THREE.DirectionalLight(0xaec3ff, 0.9)
    moon.position.set(w * 0.3 - 60, 120, h * 0.3 - 40)
    moon.target.position.set(w / 2, 0, h / 2)
    moon.castShadow = true
    moon.shadow.mapSize.set(2048, 2048)
    const cam = moon.shadow.camera
    const span = Math.max(w, h) * 0.75
    cam.left = -span
    cam.right = span
    cam.top = span
    cam.bottom = -span
    cam.far = 400
    this.scene.add(moon, moon.target)

    // Snowy fields around the town, with a hole where the town's own snow sheet lies.
    const field = new THREE.Shape()
    field.moveTo(-800, -800).lineTo(800, -800).lineTo(800, 800).lineTo(-800, 800).lineTo(-800, -800)
    const hole = new THREE.Path()
    hole.moveTo(0, 0).lineTo(0, -h).lineTo(w, -h).lineTo(w, 0).lineTo(0, 0)
    field.holes.push(hole)
    const outside = new THREE.Mesh(
      new THREE.ShapeGeometry(field),
      new THREE.MeshStandardMaterial({ color: 0xeef3fb, roughness: 0.85 }),
    )
    outside.rotation.x = -Math.PI / 2
    outside.position.y = 1.35
    outside.receiveShadow = true
    this.scene.add(outside)

    this.snow = new SnowField(world)
    this.scene.add(this.snow.mesh)
    this.scene.add(buildTown(world.town).group)
    this.scene.add(this.truck.root)
    this.bus.visible = false
    this.scene.add(this.bus)

    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(FLAKES * 3)
    for (let k = 0; k < FLAKES; k++) {
      pos[k * 3] = (Math.random() - 0.5) * FLAKE_BOX.x
      pos[k * 3 + 1] = Math.random() * FLAKE_BOX.y
      pos[k * 3 + 2] = (Math.random() - 0.5) * FLAKE_BOX.z
      this.flakeVel[k] = 4 + Math.random() * 4
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.flakes = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.3,
        map: flakeTexture(),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    )
    this.flakes.frustumCulled = false
    this.scene.add(this.flakes)

    const t = world.truck
    this.camera.position.set(t.x - 30, 40, t.z + 30)
    this.look.set(t.x, 0, t.z)
    addEventListener('resize', this.onResize)
    this.resize()
  }

  private resize(): void {
    const w = this.canvas.clientWidth || innerWidth
    const h = this.canvas.clientHeight || innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  toggleCamera(): CameraMode {
    this.mode = this.mode === 'chase' ? 'high' : 'chase'
    return this.mode
  }

  sync(world: World, dt: number): void {
    const { town, truck } = world
    // Rebuilding the snow sheet every frame is wasted work; ten times a second reads smooth.
    this.snowTimer -= dt
    if (this.snowTimer <= 0) {
      this.snow.update(world)
      this.snowTimer = 0.1
    }

    const y = groundHeight(town, truck.x, truck.z)
    this.truck.root.position.set(truck.x, y, truck.z)
    this.truck.root.rotation.y = -truck.heading
    const pitch = Math.atan(slopeEast(town, truck.x, truck.z) * Math.cos(truck.heading))
    this.truck.update(dt, truck.blade, truck.spreader && Math.abs(truck.speed) > 0.5, pitch)

    let focusX = truck.x
    let focusZ = truck.z
    let heading = truck.heading
    const showBus = world.phase === 'bus' || world.phase === 'done'
    this.bus.visible = showBus
    if (showBus) {
      const route = town.route
      const p = world.bus.progress
      const k = Math.min(route.length - 2, Math.floor(p))
      const f = p - k
      const a = tileCentre(town, route[k]!)
      const b = tileCentre(town, route[k + 1]!)
      const bx = a.x + (b.x - a.x) * f
      const bz = a.z + (b.z - a.z) * f
      heading = Math.atan2(b.z - a.z, b.x - a.x)
      this.bus.position.set(bx, groundHeight(town, bx, bz), bz)
      this.bus.rotation.y = -heading
      this.bus.rotation.z = 0
      focusX = bx
      focusZ = bz
    }

    const high = this.mode === 'high' || world.phase === 'ready'
    const fy = groundHeight(town, focusX, focusZ)
    const dx = Math.cos(heading)
    const dz = Math.sin(heading)
    const want = high
      ? new THREE.Vector3(focusX - 10, fy + 75, focusZ + 55)
      : new THREE.Vector3(focusX - dx * 17, fy + 10, focusZ - dz * 17)
    const lookAt = high
      ? new THREE.Vector3(focusX, fy, focusZ)
      : new THREE.Vector3(focusX + dx * 8, fy + 1.5, focusZ + dz * 8)
    const k = 1 - Math.exp(-dt * (high ? 2.5 : 4))
    this.camera.position.lerp(want, k)
    this.look.lerp(lookAt, k)
    this.camera.lookAt(this.look)

    // Flakes live in a box that travels with the camera.
    const rate = world.phase === 'plowing' || world.phase === 'ready' ? snowRate(world.storm, world.minute) : 0.02
    const visible = Math.floor(FLAKES * Math.min(1, 0.25 + rate * 5))
    this.flakes.geometry.setDrawRange(0, visible)
    this.flakes.position.set(this.look.x, 0, this.look.z)
    const pos = this.flakes.geometry.getAttribute('position') as THREE.BufferAttribute
    const sway = Math.sin(world.clock * 0.7) * 1.5
    for (let i = 0; i < visible; i++) {
      let fyk = pos.getY(i) - this.flakeVel[i]! * dt
      if (fyk < 0) fyk += FLAKE_BOX.y
      pos.setY(i, fyk)
      pos.setX(i, pos.getX(i) + sway * dt)
      const fx = pos.getX(i)
      if (fx > FLAKE_BOX.x / 2) pos.setX(i, fx - FLAKE_BOX.x)
      else if (fx < -FLAKE_BOX.x / 2) pos.setX(i, fx + FLAKE_BOX.x)
    }
    pos.needsUpdate = true

    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    removeEventListener('resize', this.onResize)
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}
