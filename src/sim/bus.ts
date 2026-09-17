import { TUNING } from './tuning'
import { isIcy } from './weather'
import { say, type World } from './World'

export interface Bus {
  /** Position along the route, in squares from the garage. */
  progress: number
  /** Last route square the bus has already got through. */
  checked: number
}

export type Blockage = 'deep' | 'icy'

export interface NightResult {
  arrived: boolean
  /** Route square index where the bus stopped. */
  stuckAt: number | null
  reason: Blockage | null
  /** Share of route squares that were clean at dawn, 0..1. */
  clean: number
  stars: 0 | 1 | 2 | 3
}

export function blockage(world: World, index: number): Blockage | null {
  if (world.snow[index]!.depth > TUNING.busStuckDepth) return 'deep'
  if (isIcy(world, index)) return 'icy'
  return null
}

export function routeClean(world: World): number {
  const route = world.town.route
  const good = route.filter(
    (i) => world.snow[i]!.depth <= TUNING.cleanDepth && !isIcy(world, i),
  ).length
  return good / route.length
}

function finish(world: World, arrived: boolean, stuckAt: number | null, reason: Blockage | null): void {
  const clean = routeClean(world)
  const stars = !arrived ? 0 : clean >= 0.9 ? 3 : clean >= 0.7 ? 2 : 1
  world.result = { arrived, stuckAt, reason, clean, stars }
  world.phase = 'done'
  if (arrived) say(world, 'The bus made it to school!', 'good')
  else if (reason === 'icy') say(world, 'The bus slid on the icy hill!', 'warn')
  else say(world, 'The bus got stuck in deep snow!', 'warn')
}

export function busStep(world: World, dt: number): void {
  const b = world.bus
  const route = world.town.route
  const last = route.length - 1
  const next = Math.min(last, b.progress + TUNING.busTilesPerSecond * dt)
  // A square counts as reached once the bus's nose is halfway into it.
  const reach = Math.min(last, Math.floor(next + 0.5))
  for (let k = b.checked + 1; k <= reach; k++) {
    const why = blockage(world, route[k]!)
    if (why) {
      b.progress = Math.max(0, k - 0.5)
      finish(world, false, k, why)
      return
    }
    b.checked = k
  }
  b.progress = next
  if (b.progress >= last) finish(world, true, null, null)
}
