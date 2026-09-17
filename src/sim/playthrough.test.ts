import { describe, expect, it } from 'vitest'
import { PINE_HOLLOW } from '../content/towns/pineHollow'
import { tileCentre } from './town'
import { TUNING } from './tuning'
import { beginNight, createWorld, skipToDawn, tick, type World } from './World'

/**
 * Drive the whole bus route with the real controls, the way a player would:
 * blade down all the way, spreader on for the hill.
 */
function autopilot(w: World, salt: boolean, maxSeconds = 120): number {
  const route = w.town.route
  const dt = 1 / 60
  let target = 1
  let t = 0
  for (; t < maxSeconds && target < route.length; t += dt) {
    const truck = w.truck
    const goal = tileCentre(w.town, route[target]!)
    const dx = goal.x - truck.x
    const dz = goal.z - truck.z
    if (Math.hypot(dx, dz) < 4) {
      target++
      continue
    }
    let err = Math.atan2(dz, dx) - truck.heading
    err = Math.atan2(Math.sin(err), Math.cos(err))
    const upcoming = route.slice(Math.max(0, target - 1), target + 2)
    truck.spreader = salt && upcoming.some((i) => w.town.tiles[i]!.hill)
    tick(w, dt, {
      steer: Math.max(-1, Math.min(1, err * 3)),
      throttle: Math.abs(err) > 0.6 ? 0.35 : 1,
    })
  }
  return target < route.length ? -1 : t
}

function lateNight(): World {
  const w = createWorld(PINE_HOLLOW)
  beginNight(w)
  // Snowed all night so far, and now it is 5am.
  for (const [i, tile] of w.town.tiles.entries()) if (tile.kind === 'road' && !tile.garage) w.snow[i]!.depth = 25
  w.minute = 300
  const start = tileCentre(w.town, w.town.route[0]!)
  Object.assign(w.truck, { x: start.x, z: start.z, heading: 0, salt: TUNING.saltMax })
  return w
}

describe('a whole night on the route', () => {
  it('a plow run with salt on the hill gets the bus to school', () => {
    const w = lateNight()
    const took = autopilot(w, true)
    expect(took).toBeGreaterThan(0)
    expect(took).toBeLessThan(60)
    skipToDawn(w)
    for (let s = 0; s < 30 && w.phase === 'bus'; s += 1 / 30) tick(w, 1 / 30, { throttle: 0, steer: 0 })
    expect(w.result?.arrived).toBe(true)
    expect(w.result?.stars).toBe(3)
  })

  it('without salt the truck cannot get over the hill', () => {
    const w = lateNight()
    expect(autopilot(w, false, 40)).toBe(-1)
    expect(w.truck.x).toBeLessThan(9 * TUNING.cell)
  })
})
