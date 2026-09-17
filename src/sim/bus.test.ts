import { describe, expect, it } from 'vitest'
import { PINE_HOLLOW } from '../content/towns/pineHollow'
import { NO_CONTROLS, beginNight, createWorld, skipToDawn, tick, type World } from './World'
import { TUNING } from './tuning'

function dawnWith(setup: (w: World) => void): World {
  const w = createWorld(PINE_HOLLOW)
  beginNight(w)
  skipToDawn(w)
  for (const s of w.snow) s.depth = 0
  for (const i of w.town.route) if (w.town.tiles[i]!.hill) w.snow[i]!.salt = 1
  setup(w)
  for (let s = 0; s < 30 && w.phase === 'bus'; s += 1 / 30) tick(w, 1 / 30, NO_CONTROLS)
  return w
}

describe('the morning bus', () => {
  it('reaches school on a clear, salted route with three stars', () => {
    const w = dawnWith(() => {})
    expect(w.phase).toBe('done')
    expect(w.result).toMatchObject({ arrived: true, stuckAt: null, clean: 1, stars: 3 })
    expect(w.bus.progress).toBe(w.town.route.length - 1)
  })

  it('stops at the first square that is too deep', () => {
    const w = dawnWith((w) => {
      w.snow[w.town.route[6]!]!.depth = TUNING.busStuckDepth + 1
      w.snow[w.town.route[12]!]!.depth = 40
    })
    expect(w.result).toMatchObject({ arrived: false, stuckAt: 6, reason: 'deep', stars: 0 })
    expect(w.bus.progress).toBeLessThan(6)
  })

  it('gets through snow that is only a little deep, for fewer stars', () => {
    const w = dawnWith((w) => {
      for (const i of w.town.route.slice(0, 5)) w.snow[i]!.depth = TUNING.busStuckDepth - 1
    })
    expect(w.result?.arrived).toBe(true)
    expect(w.result?.stars).toBe(2)
  })

  it('slides on an unsalted hill even with no snow on it', () => {
    const w = dawnWith((w) => {
      for (const i of w.town.route) w.snow[i]!.salt = 0
    })
    const at = w.result!.stuckAt!
    expect(w.result).toMatchObject({ arrived: false, reason: 'icy' })
    expect(w.town.tiles[w.town.route[at]!]!.hill).toBe(true)
  })

  it('never makes it through a night nobody plowed', () => {
    const w = createWorld(PINE_HOLLOW)
    beginNight(w)
    skipToDawn(w)
    for (let s = 0; s < 30 && w.phase === 'bus'; s += 1 / 30) tick(w, 1 / 30, NO_CONTROLS)
    expect(w.result).toMatchObject({ arrived: false, stuckAt: 1, stars: 0 })
    expect(w.result!.clean).toBeLessThan(0.1)
  })
})
