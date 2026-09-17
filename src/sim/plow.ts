import { groundHeight, isRoadAt, slopeEast, tileAt, type Town } from './town'
import { TUNING } from './tuning'
import { isIcy } from './weather'
import { say, type Controls, type World } from './World'

export interface Truck {
  x: number
  z: number
  /** Radians. 0 faces east (+x); turning right makes it bigger. */
  heading: number
  /** Along the heading; negative is reversing or sliding back. */
  speed: number
  blade: boolean
  spreader: boolean
  salt: number
  slipping: boolean
  topUpSaid: boolean
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

function free(town: Town, x: number, z: number): boolean {
  const m = TUNING.bodyMargin
  return (
    isRoadAt(town, x - m, z - m) &&
    isRoadAt(town, x + m, z - m) &&
    isRoadAt(town, x - m, z + m) &&
    isRoadAt(town, x + m, z + m)
  )
}

export function truckHeight(world: World): number {
  return groundHeight(world.town, world.truck.x, world.truck.z)
}

export function drive(world: World, controls: Controls, dt: number): void {
  const t = world.truck
  const town = world.town
  const T = TUNING
  const here = tileAt(town, t.x, t.z)
  if (here < 0) return
  const snow = world.snow[here]!
  const slippery = isIcy(world, here)
  t.slipping = slippery
  const grip = slippery ? T.slipGrip : 1

  const dirX = Math.cos(t.heading)
  const dirZ = Math.sin(t.heading)
  const rise = slopeEast(town, t.x, t.z) * dirX

  // Deep snow holds the truck back; with the blade down it is the snow in front that pushes back.
  const bladeTile = tileAt(town, t.x + dirX * T.bladeReach, t.z + dirZ * T.bladeReach)
  const ahead = bladeTile >= 0 ? world.snow[bladeTile]!.depth : 0
  const top =
    T.maxSpeed *
    (t.blade ? clamp(0.8 - ahead / 40, 0.35, 0.8) : clamp(1 - snow.depth / 80, 0.6, 1))

  const th = clamp(controls.throttle, -1, 1)
  const reversing = th !== 0 && Math.abs(t.speed) > 0.2 && Math.sign(th) !== Math.sign(t.speed)
  let a = th * (reversing ? T.brake : T.accel) * grip
  a -= T.gravity * rise
  if (slippery && rise * t.speed > 0) a -= Math.sign(t.speed) * T.spinDrag
  t.speed += a * dt

  // Tyres hold a parked truck on dry road; on ice there is almost nothing to hold it.
  const friction = th === 0 ? (slippery ? 0.5 : 8) : 0.6
  t.speed -= Math.sign(t.speed) * Math.min(Math.abs(t.speed), friction * dt)
  if (t.speed > top) t.speed = Math.max(top, t.speed - 20 * dt)
  t.speed = clamp(t.speed, slippery ? -T.maxSpeed : -T.reverseSpeed, T.maxSpeed)

  const turning = clamp(Math.abs(t.speed) / 4, 0, 1) * Math.sign(t.speed)
  t.heading += clamp(controls.steer, -1, 1) * T.turnRate * turning * (slippery ? 0.5 : 1) * dt

  const nx = t.x + Math.cos(t.heading) * t.speed * dt
  const nz = t.z + Math.sin(t.heading) * t.speed * dt
  const ox = t.x
  const oz = t.z
  if (free(town, nx, nz)) {
    t.x = nx
    t.z = nz
  } else if (free(town, nx, t.z)) {
    t.x = nx
    t.speed *= 0.9
  } else if (free(town, t.x, nz)) {
    t.z = nz
    t.speed *= 0.9
  } else {
    t.speed = 0
  }
  const moved = Math.hypot(t.x - ox, t.z - oz)

  if (t.blade && t.speed > 0.3 && moved > 0) {
    const bi = bladeTile
    if (bi >= 0 && town.tiles[bi]!.kind === 'road') {
      const s = world.snow[bi]!
      const off = Math.min(s.depth, T.plowPerUnit * moved)
      s.depth -= off
      s.bank += off
    }
  }

  if (t.spreader && Math.abs(t.speed) > 0.5) {
    if (t.salt > 0) {
      t.salt = Math.max(0, t.salt - T.saltPerSecond * dt)
      snow.salt = 1
    }
    if (t.salt <= 0) {
      t.spreader = false
      say(world, 'Out of salt! Drive to the green depot to fill up', 'warn')
    }
  }

  if (here === town.depot && Math.abs(t.speed) < 2) {
    if (t.salt < T.saltMax) {
      t.salt = Math.min(T.saltMax, t.salt + T.saltRefillPerSecond * dt)
      t.topUpSaid = false
    } else if (!t.topUpSaid) {
      t.topUpSaid = true
      say(world, 'Salt is full!', 'good')
    }
  }
}
