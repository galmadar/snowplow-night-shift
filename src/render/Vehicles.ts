import * as THREE from 'three'

function part(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  return m
}

const tyre = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 })
const glass = new THREE.MeshStandardMaterial({ color: 0x9fc3e6, emissive: 0x28405c, roughness: 0.2 })

function wheels(group: THREE.Group, xs: number[], halfWidth: number, r: number): void {
  const geo = new THREE.CylinderGeometry(r, r, 0.6, 16)
  geo.rotateX(Math.PI / 2)
  for (const x of xs) for (const z of [-halfWidth, halfWidth]) group.add(part(geo, tyre, x, r, z))
}

/**
 * The plow truck, nose along +x. `tilt` pitches on the hill; the rest hang off it
 * so the Renderer only has to move the outer group.
 */
export class TruckModel {
  readonly root = new THREE.Group()
  private tilt = new THREE.Group()
  private blade = new THREE.Group()
  private beacon: THREE.Mesh
  private beaconLight: THREE.PointLight
  private spinner: THREE.Mesh
  private spray: THREE.Points
  private sprayAge = new Float32Array(60)
  private time = 0

  constructor() {
    this.root.add(this.tilt)
    const orange = new THREE.MeshStandardMaterial({ color: 0xff7b1c, roughness: 0.55 })
    const darkOrange = new THREE.MeshStandardMaterial({ color: 0xc4540e, roughness: 0.7 })
    const steel = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.5, roughness: 0.5 })
    const yellow = new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.5 })

    this.tilt.add(part(new THREE.BoxGeometry(6.6, 0.6, 2.4), steel, 0, 1.0, 0))
    this.tilt.add(part(new THREE.BoxGeometry(2.2, 2.1, 2.5), orange, 1.7, 2.35, 0))
    this.tilt.add(part(new THREE.BoxGeometry(0.05, 1.0, 2.1), glass, 2.82, 2.7, 0))
    this.tilt.add(part(new THREE.BoxGeometry(3.4, 1.7, 2.5), darkOrange, -1.5, 2.15, 0))
    this.tilt.add(part(new THREE.BoxGeometry(3.3, 0.2, 2.2), new THREE.MeshStandardMaterial({ color: 0xb5a58f }), -1.5, 3.05, 0))
    wheels(this.tilt, [2.0, -1.0, -2.3], 1.2, 0.7)

    // Headlights.
    const lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 3 })
    for (const z of [-0.8, 0.8]) this.tilt.add(part(new THREE.BoxGeometry(0.1, 0.35, 0.5), lamp, 2.86, 1.7, z))
    const spot = new THREE.SpotLight(0xfff1d6, 260, 70, 0.55, 0.45, 1.3)
    spot.position.set(3, 2.2, 0)
    spot.target.position.set(18, 0, 0)
    this.tilt.add(spot, spot.target)

    // Blade.
    const plate = part(new THREE.BoxGeometry(0.35, 1.3, 4.4), yellow, 0, 0, 0)
    plate.rotation.y = 0.28
    const arm = part(new THREE.BoxGeometry(1.2, 0.25, 0.25), steel, -0.6, 0.1, 0)
    this.blade.add(plate, arm)
    this.blade.position.set(3.6, 0.65, 0)
    this.tilt.add(this.blade)

    // Amber beacon.
    this.beacon = part(
      new THREE.SphereGeometry(0.3, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff9000, emissiveIntensity: 2 }),
      1.7,
      3.6,
      0,
    )
    this.beaconLight = new THREE.PointLight(0xffa020, 30, 18, 1.5)
    this.beaconLight.position.set(1.7, 4, 0)
    this.tilt.add(this.beacon, this.beaconLight)

    // Salt spinner at the back and the grit it throws.
    this.spinner = part(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 6), steel, -3.4, 0.9, 0)
    this.tilt.add(this.spinner)
    const sprayGeo = new THREE.BufferGeometry()
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.sprayAge.length * 3), 3))
    this.spray = new THREE.Points(
      sprayGeo,
      new THREE.PointsMaterial({ color: 0xd9c9b0, size: 0.25, transparent: true, opacity: 0.9 }),
    )
    this.spray.frustumCulled = false
    this.tilt.add(this.spray)
  }

  update(dt: number, bladeDown: boolean, spreading: boolean, pitch: number): void {
    this.time += dt
    this.tilt.rotation.z = pitch
    const want = bladeDown ? 0.65 : 1.6
    this.blade.position.y += (want - this.blade.position.y) * Math.min(1, dt * 8)
    const flash = Math.sin(this.time * 9) > 0
    this.beaconLight.intensity = flash ? 45 : 5
    ;(this.beacon.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 3 : 0.4
    if (spreading) this.spinner.rotation.y += dt * 25

    this.spray.visible = spreading
    if (!spreading) return
    const pos = this.spray.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let k = 0; k < this.sprayAge.length; k++) {
      let age = this.sprayAge[k]! + dt
      if (age > 0.6) age = Math.random() * 0.1
      this.sprayAge[k] = age
      const angle = ((k * 137.5) % 360) * (Math.PI / 180)
      const r = 1 + age * 9
      pos.setXYZ(k, -3.4 + Math.cos(angle) * r * 0.6 - age * 2, 0.9 - age * 1.4, Math.sin(angle) * r)
    }
    pos.needsUpdate = true
  }
}

export function buildBus(): THREE.Group {
  const g = new THREE.Group()
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf5b81c, roughness: 0.5 })
  const black = new THREE.MeshStandardMaterial({ color: 0x1b1b1b })
  g.add(part(new THREE.BoxGeometry(9, 3, 2.8), yellow, 0, 2.3, 0))
  g.add(part(new THREE.BoxGeometry(8.2, 0.9, 2.85), glass, -0.3, 2.9, 0))
  g.add(part(new THREE.BoxGeometry(9.05, 0.2, 2.85), black, 0, 1.5, 0))
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 3 })
  for (const z of [-1, 1]) g.add(part(new THREE.BoxGeometry(0.1, 0.4, 0.4), lamp, 4.52, 1.4, z))
  const stop = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 2 })
  for (const z of [-1, 1]) g.add(part(new THREE.BoxGeometry(0.1, 0.3, 0.3), stop, -4.52, 1.4, z))
  wheels(g, [2.8, -2.8], 1.3, 0.75)
  const spot = new THREE.SpotLight(0xfff1d6, 200, 60, 0.5, 0.5, 1.3)
  spot.position.set(4.5, 2, 0)
  spot.target.position.set(20, 0, 0)
  g.add(spot, spot.target)
  return g
}
