import { TUNING } from './tuning'
import type { World } from './World'

/** Centimetres per game minute at this time of night. */
export function snowRate(storm: number[], minute: number): number {
  const hour = Math.min(storm.length - 1, Math.max(0, Math.floor(minute / 60)))
  return (storm[hour] ?? 0) / 60
}

/** Snow falls on every road, salt melts a bit of it and slowly wears off. */
export function advanceWeather(world: World, minutes: number): void {
  if (minutes <= 0) return
  const rate = snowRate(world.storm, world.minute)
  const fade = minutes / TUNING.saltLifeMinutes
  world.town.tiles.forEach((tile, i) => {
    // The bus garage doorway and the depot yard are under a roof.
    if (tile.kind !== 'road' || tile.garage || tile.depot) return
    const s = world.snow[i]!
    const salted = s.salt > 0
    s.depth += rate * s.drift * minutes * (salted ? TUNING.saltSnowFactor : 1)
    if (salted) {
      s.depth = Math.max(0, s.depth - TUNING.saltMeltPerMinute * minutes)
      s.salt = Math.max(0, s.salt - fade)
    }
  })
}

export function isIcy(world: World, index: number): boolean {
  return world.town.tiles[index]!.hill && world.snow[index]!.salt < TUNING.slipSaltLevel
}

/** "3:05 AM" */
export function clockText(minute: number): string {
  const m = Math.floor(minute)
  const h = Math.floor(m / 60) % 12
  return `${h === 0 ? 12 : h}:${String(m % 60).padStart(2, '0')} AM`
}
