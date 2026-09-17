import { describe, expect, it } from 'vitest'
import { PINE_HOLLOW } from '../content/towns/pineHollow'
import { tileCentre } from './town'
import { TUNING } from './tuning'
import { clockText, snowRate } from './weather'
import {
  NO_CONTROLS,
  beginNight,
  createWorld,
  skipToDawn,
  tick,
  toggleBlade,
  toggleSpreader,
  type World,
} from './World'

const FORWARD = { throttle: 1, steer: 0 }

function night(): World {
  const w = createWorld(PINE_HOLLOW)
  beginNight(w)
  return w
}

/** Put the truck on a square, facing a way, with the snow as given. */
function park(w: World, col: number, row: number, heading: number): number {
  const i = row * w.town.width + col
  const c = tileCentre(w.town, i)
  Object.assign(w.truck, { x: c.x, z: c.z, heading, speed: 0 })
  return i
}

function run(w: World, seconds: number, controls = NO_CONTROLS, dt = 1 / 60): void {
  for (let s = 0; s < seconds; s += dt) tick(w, dt, controls)
}

describe('the clock', () => {
  it('does not start until the night begins', () => {
    const w = createWorld(PINE_HOLLOW)
    run(w, 5)
    expect(w.minute).toBe(0)
    expect(w.phase).toBe('ready')
  })

  it('runs midnight to 6am over the night and then sends the bus', () => {
    const w = night()
    run(w, TUNING.nightSeconds / 2)
    expect(w.minute).toBeCloseTo(180, 0)
    expect(clockText(w.minute)).toMatch(/^(2:59|3:00) AM$/)
    run(w, TUNING.nightSeconds / 2 + 0.1)
    expect(w.minute).toBe(360)
    expect(w.phase).not.toBe('plowing')
  })

  it('reads midnight as 12', () => {
    expect(clockText(0)).toBe('12:00 AM')
    expect(clockText(5 * 60 + 7)).toBe('5:07 AM')
  })
})

describe('snow', () => {
  it('builds up on roads, and faster in the heavy hours', () => {
    expect(snowRate(PINE_HOLLOW.storm, 150)).toBeGreaterThan(snowRate(PINE_HOLLOW.storm, 10))
    const w = night()
    const road = w.town.route[3]!
    const total = PINE_HOLLOW.storm.reduce((a, b) => a + b, 0)
    skipToDawn(w)
    expect(w.snow[road]!.depth).toBeCloseTo(total * w.snow[road]!.drift, 1)
  })

  it('never settles on the gardens', () => {
    const w = night()
    skipToDawn(w)
    expect(w.snow[0]!.depth).toBe(0)
  })

  it('settles much less on salted road', () => {
    const w = night()
    const a = w.town.route[3]!
    const b = w.town.route[4]!
    w.snow[a]!.salt = 1
    w.snow[a]!.drift = w.snow[b]!.drift = 1
    run(w, 30)
    expect(w.snow[a]!.depth).toBeLessThan(w.snow[b]!.depth * 0.4)
  })
})

describe('plowing', () => {
  it('clears the road ahead into a bank with the blade down', () => {
    const w = night()
    park(w, 6, 1, 0)
    for (let c = 7; c <= 12; c++) w.snow[1 * w.town.width + c]!.depth = 20
    run(w, 5, FORWARD)
    for (let c = 7; c <= 10; c++) {
      const s = w.snow[1 * w.town.width + c]!
      expect(s.depth).toBeLessThan(1)
      expect(s.bank).toBeGreaterThan(19)
    }
  })

  it('leaves the snow alone with the blade up, but goes faster', () => {
    const slow = night()
    const fast = night()
    for (const w of [slow, fast]) {
      park(w, 6, 1, 0)
      for (let c = 6; c <= 13; c++) w.snow[1 * w.town.width + c]!.depth = 20
    }
    toggleBlade(fast)
    expect(fast.truck.blade).toBe(false)
    run(slow, 2, FORWARD)
    run(fast, 2, FORWARD)
    expect(fast.truck.x).toBeGreaterThan(slow.truck.x)
    expect(fast.snow[1 * fast.town.width + 8]!.depth).toBeGreaterThan(19)
  })

  it('cannot drive into the houses', () => {
    const w = night()
    park(w, 1, 3, 0) // on Elm Street, facing a garden
    run(w, 3, FORWARD)
    expect(Math.floor(w.truck.x / TUNING.cell)).toBe(1)
  })
})

describe('salt', () => {
  it('spreads while driving and runs out', () => {
    const w = night()
    const start = park(w, 1, 2, Math.PI / 2)
    w.truck.salt = 3
    toggleSpreader(w)
    run(w, 0.3, FORWARD)
    expect(w.snow[start]!.salt).toBe(1)
    run(w, 3, FORWARD)
    expect(w.truck.salt).toBe(0)
    expect(w.truck.spreader).toBe(false)
    expect(w.notice?.tone).toBe('warn')
  })

  it('will not switch on with an empty hopper', () => {
    const w = night()
    w.truck.salt = 0
    toggleSpreader(w)
    expect(w.truck.spreader).toBe(false)
  })

  it('fills up when stopped at the depot', () => {
    const w = night()
    w.truck.salt = 0
    run(w, 3)
    expect(w.truck.salt).toBe(TUNING.saltMax)
  })

  it('wears off over a few hours', () => {
    const w = night()
    const i = w.town.route[2]!
    w.snow[i]!.salt = 1
    skipToDawn(w)
    expect(w.snow[i]!.salt).toBe(0)
  })
})

describe('the hill', () => {
  const C = TUNING.cell

  it('is too icy to climb until it is salted', () => {
    const w = night()
    park(w, 6, 5, 0)
    run(w, 6, FORWARD)
    expect(w.truck.slipping).toBe(true)
    // Never makes it over the top.
    expect(w.truck.x).toBeLessThan(9 * C)
  })

  it('slides a parked truck back down', () => {
    const w = night()
    park(w, 8, 5, 0)
    const x = w.truck.x
    run(w, 1.5)
    expect(w.truck.x).toBeLessThan(x - 1)
  })

  it('is easy once salted', () => {
    const w = night()
    park(w, 6, 5, 0)
    for (let c = 7; c <= 10; c++) w.snow[5 * w.town.width + c]!.salt = 1
    run(w, 6, FORWARD)
    expect(w.truck.slipping).toBe(false)
    expect(w.truck.x).toBeGreaterThan(11 * C)
  })

  it('holds a parked truck when salted', () => {
    const w = night()
    park(w, 8, 5, 0)
    w.snow[5 * w.town.width + 8]!.salt = 1
    const x = w.truck.x
    run(w, 1.5)
    expect(Math.abs(w.truck.x - x)).toBeLessThan(0.1)
  })
})
