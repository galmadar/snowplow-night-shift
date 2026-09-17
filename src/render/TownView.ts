import * as THREE from 'three'
import { groundHeight, neighbours, tileAt, tileCentre, type Town } from '../sim/town'
import { TUNING } from '../sim/tuning'

const C = TUNING.cell

function hash(i: number): number {
  const s = Math.sin(i * 91.7 + 47.3) * 24634.6345
  return s - Math.floor(s)
}

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/** A lit sign with the text on both faces, so it never reads backwards. */
function sign(text: string, colour: string, width = 8): THREE.Group {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const g = canvas.getContext('2d')!
  g.fillStyle = colour
  g.fillRect(0, 0, 256, 64)
  g.fillStyle = '#ffffff'
  g.font = 'bold 38px Verdana, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 128, 34)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const geo = new THREE.PlaneGeometry(width, width / 4)
  const mat = new THREE.MeshBasicMaterial({ map: tex })
  const front = new THREE.Mesh(geo, mat)
  const back = new THREE.Mesh(geo, mat)
  back.rotation.y = Math.PI
  const board = new THREE.Group()
  board.add(front, back)
  return board
}

const asphalt = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.9 })
const paint = new THREE.MeshStandardMaterial({ color: 0xf2c230, emissive: 0x5a4308, roughness: 0.6 })
const wallMats = [0x8a5a44, 0x6f7f96, 0xa38b6c, 0x7d6a8c, 0x5f7a66].map(
  (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }),
)
const roofMat = new THREE.MeshStandardMaterial({ color: 0xe9eef6, roughness: 0.8 })
const windowMat = new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xffb347, emissiveIntensity: 1.4 })
const darkWindow = new THREE.MeshStandardMaterial({ color: 0x1b2233, roughness: 0.4 })
const pineMat = new THREE.MeshStandardMaterial({ color: 0x24442f, roughness: 1 })
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3322 })
const poleMat = new THREE.MeshStandardMaterial({ color: 0x3b3f47, metalness: 0.4, roughness: 0.6 })
const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffd28a, emissiveIntensity: 2 })
const postMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 0.9 })

function house(seed: number): THREE.Group {
  const g = new THREE.Group()
  const w = 5 + hash(seed) * 2.5
  const d = 4.5 + hash(seed + 1) * 2
  const h = 3.5 + hash(seed + 2) * 2.5
  const body = box(w, h, d, wallMats[Math.floor(hash(seed + 3) * wallMats.length)]!)
  body.position.y = h / 2
  g.add(body)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2.6, 4), roofMat)
  roof.rotation.y = Math.PI / 4
  roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d))
  roof.position.y = h + 1.3
  roof.castShadow = true
  g.add(roof)
  for (const side of [-1, 1]) {
    const lit = hash(seed + side * 7) > 0.35
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), lit ? windowMat : darkWindow)
    win.position.set(side * w * 0.22, h * 0.55, d / 2 + 0.02)
    g.add(win)
    const back = win.clone()
    back.position.z = -d / 2 - 0.02
    back.rotation.y = Math.PI
    g.add(back)
  }
  g.rotation.y = Math.floor(hash(seed + 4) * 4) * (Math.PI / 2)
  return g
}

function pines(seed: number): THREE.Group {
  const g = new THREE.Group()
  const count = 2 + Math.floor(hash(seed) * 3)
  for (let k = 0; k < count; k++) {
    const h = 4 + hash(seed + k * 3) * 4
    const tree = new THREE.Group()
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.2), trunkMat)
    trunk.position.y = 0.6
    const top = new THREE.Mesh(new THREE.ConeGeometry(h * 0.3, h, 7), pineMat)
    top.position.y = 1 + h / 2
    top.castShadow = true
    const cap = new THREE.Mesh(new THREE.ConeGeometry(h * 0.16, h * 0.35, 7), roofMat)
    cap.position.y = 1 + h * 0.86
    tree.add(trunk, top, cap)
    tree.position.set((hash(seed + k) - 0.5) * 7, 0, (hash(seed + k + 9) - 0.5) * 7)
    g.add(tree)
  }
  return g
}

function roadTile(town: Town, index: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(C, C, 4, 4)
  geo.rotateX(-Math.PI / 2)
  const { x, z } = tileCentre(town, index)
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  for (let k = 0; k < pos.count; k++) {
    pos.setY(k, groundHeight(town, x + pos.getX(k), z + pos.getZ(k)) + 0.05)
  }
  geo.computeVertexNormals()
  const m = new THREE.Mesh(geo, asphalt)
  m.position.set(x, 0, z)
  m.receiveShadow = true
  return m
}

export interface Landmark {
  group: THREE.Group
  lampLights: THREE.PointLight[]
}

/** Everything that never moves: streets, houses, lamps, depot, garage, school. */
export function buildTown(town: Town): Landmark {
  const group = new THREE.Group()
  const lampLights: THREE.PointLight[] = []
  const reserved = new Set<number>()

  const garageTile = town.route[0]!
  const schoolTile = town.route[town.route.length - 1]!
  const beside = (tile: number): number =>
    neighbours(town, tile).find((n) => town.tiles[n]!.kind === 'lot') ?? tile

  // Bus garage.
  {
    const lot = beside(garageTile)
    reserved.add(lot)
    const at = tileCentre(town, lot)
    const shed = box(10, 6, 10, new THREE.MeshStandardMaterial({ color: 0x6b4a2b }))
    shed.position.set(at.x, 3, at.z)
    const s = sign('BUS', '#c98a00')
    s.position.set(at.x + 5.05, 5, at.z)
    s.rotation.y = Math.PI / 2
    group.add(shed, s)
  }
  // School.
  {
    const lot = beside(schoolTile)
    reserved.add(lot)
    const at = tileCentre(town, lot)
    const school = box(10, 7, 11, new THREE.MeshStandardMaterial({ color: 0x9b3b35 }))
    school.position.set(at.x, 3.5, at.z)
    const s = sign('SCHOOL', '#2d5fa8')
    s.position.set(at.x - 5.05, 5.5, at.z)
    s.rotation.y = -Math.PI / 2
    const bell = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.4, 4), roofMat)
    bell.position.set(at.x, 8.2, at.z)
    group.add(school, s, bell)
  }
  // Salt depot.
  {
    const lot = beside(town.depot)
    reserved.add(lot)
    const at = tileCentre(town, lot)
    const shed = box(10, 5, 9, new THREE.MeshStandardMaterial({ color: 0x3d6b45 }))
    shed.position.set(at.x, 2.5, at.z)
    const pile = new THREE.Mesh(
      new THREE.ConeGeometry(3, 3, 12),
      new THREE.MeshStandardMaterial({ color: 0xb5a58f, roughness: 1 }),
    )
    pile.position.set(at.x + 3, 1.5, at.z + 3)
    const s = sign('SALT', '#2f8f46')
    const d = tileCentre(town, town.depot)
    s.position.set(d.x, 6.5, d.z)
    s.lookAt(d.x, 6.5, d.z + (d.z > at.z ? 10 : -10))
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(C * 0.8, C * 0.8),
      new THREE.MeshStandardMaterial({ color: 0x2f8f46, emissive: 0x0f4a1c, transparent: true, opacity: 0.55 }),
    )
    pad.rotation.x = -Math.PI / 2
    pad.position.set(d.x, 0.12, d.z)
    const light = new THREE.PointLight(0x7dffa0, 40, 26, 1.6)
    light.position.set(d.x, 7, d.z)
    group.add(shed, pile, s, pad, light)
  }

  town.tiles.forEach((t, i) => {
    const { x, z } = tileCentre(town, i)
    if (t.kind === 'road') {
      group.add(roadTile(town, i))
      return
    }
    if (reserved.has(i) || groundHeight(town, x, z) > 0.2) {
      if (groundHeight(town, x, z) > 0.2 && hash(i) > 0.4) {
        const p = pines(i)
        p.position.set(x, groundHeight(town, x, z) + 0.6, z)
        group.add(p)
      }
      return
    }
    const thing = hash(i + 100) > 0.3 ? house(i) : pines(i)
    thing.position.set(x, 1, z)
    group.add(thing)
  })

  // Route marks: a yellow centre line you only see once the snow is off, and orange posts you always see.
  town.route.forEach((idx, k) => {
    const a = tileCentre(town, idx)
    const nextIdx = town.route[Math.min(k + 1, town.route.length - 1)]!
    const prevIdx = town.route[Math.max(k - 1, 0)]!
    const b = tileCentre(town, nextIdx)
    const p = tileCentre(town, prevIdx)
    const dx = b.x - p.x
    const dz = b.z - p.z
    const along = Math.abs(dx) >= Math.abs(dz)
    const y = groundHeight(town, a.x, a.z) + 0.1
    const line = new THREE.Mesh(new THREE.BoxGeometry(along ? 5 : 0.5, 0.05, along ? 0.5 : 5), paint)
    line.position.set(a.x, y, a.z)
    group.add(line)
    const sign = k % 2 ? 1 : -1
    const px = along ? a.x : a.x + sign * (C / 2 - 0.6)
    const pz = along ? a.z + sign * (C / 2 - 0.6) : a.z
    const beyond = tileAt(town, along ? px : px + sign, along ? pz + sign : pz)
    if (beyond < 0 || town.tiles[beyond]!.kind !== 'lot') return
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4), postMat)
    post.position.set(px, groundHeight(town, px, pz) + 1.7, pz)
    group.add(post)
  })

  // Street lamps at every crossing.
  town.tiles.forEach((t, i) => {
    if (t.kind !== 'road') return
    const roads = neighbours(town, i).filter((n) => town.tiles[n]!.kind === 'road').length
    if (roads < 3) return
    const { x, z } = tileCentre(town, i)
    const lx = x + C / 2 - 0.4
    const lz = z + C / 2 - 0.4
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 8), poleMat)
    pole.position.set(lx, 4, lz)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), bulbMat)
    bulb.position.set(lx, 8.1, lz)
    group.add(pole, bulb)
    const light = new THREE.PointLight(0xffc98a, 90, 34, 1.4)
    light.position.set(lx - 1, 7.6, lz - 1)
    lampLights.push(light)
    group.add(light)
  })

  return { group, lampLights }
}
