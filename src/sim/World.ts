import { parseTown, tileCentre, type Town, type TownPlan } from './town'
import { TUNING } from './tuning'
import { advanceWeather } from './weather'
import { drive, type Truck } from './plow'
import { busStep, type Bus, type NightResult } from './bus'

export type Phase = 'ready' | 'plowing' | 'bus' | 'done'
export type Tone = 'info' | 'warn' | 'good'

export interface TileSnow {
  /** Centimetres lying on the square. Only roads collect it; gardens are scenery. */
  depth: number
  /** Centimetres pushed off this square into the roadside bank. */
  bank: number
  /** 1 fresh salt, 0 none. */
  salt: number
  /** Some squares catch more drift than others. */
  drift: number
}

export interface Controls {
  /** -1 back, 1 forward. */
  throttle: number
  /** -1 left, 1 right. */
  steer: number
}

export interface Notice {
  text: string
  tone: Tone
  at: number
}

export interface World {
  town: Town
  storm: number[]
  snow: TileSnow[]
  truck: Truck
  bus: Bus
  phase: Phase
  /** Game minutes since midnight. */
  minute: number
  /** Real seconds since the page started this night; drives notices. */
  clock: number
  notice: Notice | null
  result: NightResult | null
}

export const NO_CONTROLS: Controls = { throttle: 0, steer: 0 }

/** A tiny, fixed hash so the same town drifts the same way every night. */
function driftFor(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return 0.8 + 0.4 * (s - Math.floor(s))
}

export function createWorld(plan: TownPlan): World {
  const town = parseTown(plan)
  const startTile = plan.start.row * town.width + plan.start.col
  if (town.tiles[startTile]?.kind !== 'road') throw new Error('the truck must start on a road')
  const at = tileCentre(town, startTile)
  return {
    town,
    storm: plan.storm,
    snow: town.tiles.map((_, i) => ({ depth: 0, bank: 0, salt: 0, drift: driftFor(i) })),
    truck: {
      x: at.x,
      z: at.z,
      heading: plan.start.heading,
      speed: 0,
      blade: true,
      spreader: false,
      salt: plan.startSalt,
      slipping: false,
      topUpSaid: false,
    },
    bus: { progress: 0, checked: -1 },
    phase: 'ready',
    minute: 0,
    clock: 0,
    notice: null,
    result: null,
  }
}

export function say(world: World, text: string, tone: Tone = 'info'): void {
  world.notice = { text, tone, at: world.clock }
}

export function beginNight(world: World): void {
  if (world.phase !== 'ready') return
  world.phase = 'plowing'
  say(world, 'Midnight. Keep the yellow bus route clear!')
}

export function toggleBlade(world: World): void {
  if (world.phase !== 'plowing') return
  world.truck.blade = !world.truck.blade
  say(world, world.truck.blade ? 'Blade down - pushing snow' : 'Blade up - driving fast')
}

export function toggleSpreader(world: World): void {
  if (world.phase !== 'plowing') return
  const t = world.truck
  if (!t.spreader && t.salt <= 0) {
    say(world, 'No salt left - drive to the green depot', 'warn')
    return
  }
  t.spreader = !t.spreader
  say(world, t.spreader ? 'Salt spreader on' : 'Salt spreader off')
}

const HOUR_CALLS: Record<number, [string, Tone]> = {
  1: ['1 AM - the snow is getting heavier', 'info'],
  2: ['2 AM', 'info'],
  3: ['3 AM - salt wears off, so salt the hill late', 'info'],
  4: ['4 AM', 'info'],
  5: ['5 AM - one hour until the bus leaves!', 'warn'],
}

function setMinute(world: World, next: number): void {
  const before = Math.floor(world.minute / 60)
  world.minute = Math.min(TUNING.nightMinutes, next)
  const after = Math.floor(world.minute / 60)
  if (after !== before && HOUR_CALLS[after]) say(world, ...HOUR_CALLS[after])
}

function dawn(world: World): void {
  world.phase = 'bus'
  world.truck.speed = 0
  world.truck.spreader = false
  say(world, '6 AM - here comes the bus!', 'good')
}

export function tick(world: World, dt: number, controls: Controls): void {
  world.clock += dt
  if (world.phase === 'plowing') {
    const dm = (dt * TUNING.nightMinutes) / TUNING.nightSeconds
    const target = world.minute + dm
    advanceWeather(world, Math.min(dm, TUNING.nightMinutes - world.minute))
    setMinute(world, target)
    drive(world, controls, dt)
    if (world.minute >= TUNING.nightMinutes) dawn(world)
  } else if (world.phase === 'bus') {
    busStep(world, dt)
  }
}

/** Park the truck and let the rest of the night snow down, then send the bus. */
export function skipToDawn(world: World): void {
  if (world.phase !== 'plowing') return
  world.truck.speed = 0
  while (world.minute < TUNING.nightMinutes) {
    const dm = Math.min(1, TUNING.nightMinutes - world.minute)
    advanceWeather(world, dm)
    world.minute += dm
  }
  dawn(world)
}
