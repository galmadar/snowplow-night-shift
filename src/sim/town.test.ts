import { describe, expect, it } from 'vitest'
import { PINE_HOLLOW } from '../content/towns/pineHollow'
import { groundHeight, parseTown, slopeEast, tileCentre } from './town'
import { TUNING } from './tuning'

describe('reading a town map', () => {
  const town = parseTown(PINE_HOLLOW)

  it('walks the bus route from garage to school in order', () => {
    const first = town.tiles[town.route[0]!]!
    const last = town.tiles[town.route[town.route.length - 1]!]!
    expect(first.garage).toBe(true)
    expect(last.school).toBe(true)
    expect(town.route.length).toBe(21)
    for (let k = 1; k < town.route.length; k++) {
      const a = town.tiles[town.route[k - 1]!]!
      const b = town.tiles[town.route[k]!]!
      expect(Math.abs(a.col - b.col) + Math.abs(a.row - b.row)).toBe(1)
      expect(b.kind).toBe('road')
    }
  })

  it('finds the depot and the one hill', () => {
    expect(town.tiles[town.depot]!.depot).toBe(true)
    expect(town.hills).toEqual([{ row: 5, from: 7, to: 10 }])
  })

  it('refuses a route that splits', () => {
    expect(() =>
      parseTown({ ...PINE_HOLLOW, map: ['G==.', '.==S', 'D...'] }),
    ).toThrow(/splits/)
  })

  it('humps the hill up and back down, flat at both ends', () => {
    const C = TUNING.cell
    const z = 5.5 * C
    expect(groundHeight(town, 7 * C, z)).toBeCloseTo(0)
    expect(groundHeight(town, 9 * C, z)).toBeCloseTo(TUNING.hillHeight)
    expect(groundHeight(town, 11 * C, z)).toBeCloseTo(0)
    expect(slopeEast(town, 8 * C, z)).toBeGreaterThan(0)
    expect(slopeEast(town, 10 * C, z)).toBeLessThan(0)
    // Flat streets elsewhere.
    const garage = tileCentre(town, town.route[0]!)
    expect(groundHeight(town, garage.x, garage.z)).toBe(0)
  })
})
