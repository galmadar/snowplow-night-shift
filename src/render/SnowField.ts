import * as THREE from 'three'
import { groundHeight, neighbours } from '../sim/town'
import { TUNING } from '../sim/tuning'
import type { World } from '../sim/World'

/** Centimetres to world units, so snow reads about wheel-deep. */
const SCALE = 0.06
/** Snow lying in the gardens before any bank is added. */
const GARDEN_CM = 25
const GARDEN_MAX_CM = 80
/** Keeps bare road just under the asphalt, so a plowed square shows black. */
const SINK = 0.15
const PER_CELL = 4

const SNOW = new THREE.Color(0xeef3fb)
const SALTED = new THREE.Color(0x9c948a)

/**
 * One sheet of snow over the whole town. Depth is known per square, so each
 * vertex blends the squares around it; banks show up as the gardens rising.
 */
export class SnowField {
  readonly mesh: THREE.Mesh
  private geo = new THREE.BufferGeometry()
  private ground: Float32Array
  private cols: number
  private rows: number
  private depth: Float32Array
  private salt: Float32Array
  private lotSides: Uint8Array

  constructor(world: World) {
    const { town } = world
    const C = TUNING.cell
    this.cols = town.width * PER_CELL + 1
    this.rows = town.height * PER_CELL + 1
    const n = this.cols * this.rows
    const pos = new Float32Array(n * 3)
    this.ground = new Float32Array(n)
    for (let j = 0; j < this.rows; j++) {
      for (let i = 0; i < this.cols; i++) {
        const k = j * this.cols + i
        const x = (i * C) / PER_CELL
        const z = (j * C) / PER_CELL
        this.ground[k] = groundHeight(town, x, z)
        pos[k * 3] = x
        pos[k * 3 + 1] = this.ground[k]!
        pos[k * 3 + 2] = z
      }
    }
    const index: number[] = []
    for (let j = 0; j < this.rows - 1; j++) {
      for (let i = 0; i < this.cols - 1; i++) {
        const a = j * this.cols + i
        const b = a + 1
        const c = a + this.cols
        const d = c + 1
        index.push(a, c, b, b, c, d)
      }
    }
    this.geo.setIndex(index)
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3))

    this.depth = new Float32Array(town.tiles.length)
    this.salt = new Float32Array(town.tiles.length)
    this.lotSides = new Uint8Array(town.tiles.length)
    town.tiles.forEach((t, i) => {
      if (t.kind !== 'road') return
      this.lotSides[i] = neighbours(town, i).filter((n) => town.tiles[n]!.kind === 'lot').length
    })

    this.mesh = new THREE.Mesh(
      this.geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }),
    )
    this.mesh.receiveShadow = true
    this.update(world)
  }

  update(world: World): void {
    const { town, snow } = world
    this.depth.fill(0)
    this.salt.fill(0)
    town.tiles.forEach((t, i) => {
      if (t.kind === 'road') {
        this.depth[i] = snow[i]!.depth
        this.salt[i] = Math.min(1, snow[i]!.salt * 1.5)
      } else {
        this.depth[i] = GARDEN_CM
      }
    })
    // Pushed snow piles up in the gardens next to the road it came off.
    town.tiles.forEach((t, i) => {
      if (t.kind !== 'road' || !this.lotSides[i]) return
      const share = (snow[i]!.bank * 0.5) / this.lotSides[i]!
      for (const n of neighbours(town, i)) {
        if (town.tiles[n]!.kind === 'lot') this.depth[n] = Math.min(GARDEN_MAX_CM, this.depth[n]! + share)
      }
    })

    const W = town.width
    const H = town.height
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute
    const col = this.geo.getAttribute('color') as THREE.BufferAttribute
    const tint = new THREE.Color()
    for (let j = 0; j < this.rows; j++) {
      const v = Math.min(H - 1, Math.max(0, j / PER_CELL - 0.5))
      const r0 = Math.floor(v)
      const r1 = Math.min(H - 1, r0 + 1)
      const fv = v - r0
      for (let i = 0; i < this.cols; i++) {
        const u = Math.min(W - 1, Math.max(0, i / PER_CELL - 0.5))
        const c0 = Math.floor(u)
        const c1 = Math.min(W - 1, c0 + 1)
        const fu = u - c0
        const w00 = (1 - fu) * (1 - fv)
        const w10 = fu * (1 - fv)
        const w01 = (1 - fu) * fv
        const w11 = fu * fv
        const a = r0 * W + c0
        const b = r0 * W + c1
        const c = r1 * W + c0
        const d = r1 * W + c1
        const cm =
          this.depth[a]! * w00 + this.depth[b]! * w10 + this.depth[c]! * w01 + this.depth[d]! * w11
        const s = this.salt[a]! * w00 + this.salt[b]! * w10 + this.salt[c]! * w01 + this.salt[d]! * w11
        const k = j * this.cols + i
        pos.setY(k, this.ground[k]! + cm * SCALE - SINK)
        tint.copy(SNOW).lerp(SALTED, s * 0.7)
        col.setXYZ(k, tint.r, tint.g, tint.b)
      }
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    this.geo.computeVertexNormals()
  }
}
