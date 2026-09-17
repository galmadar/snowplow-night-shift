import type { TownPlan } from '../../sim/town'

/**
 * A small grid town. The bus leaves the garage top-left, goes down Mill Lane,
 * over the hill on Main Street and down to the school bottom-right.
 */
export const PINE_HOLLOW: TownPlan = {
  name: 'Pine Hollow',
  map: [
    '...............',
    '.G====########.',
    '.#...=...D...#.',
    '.#...=.......#.',
    '.#...=.......#.',
    '.####==%%%%===.',
    '.#...#.......=.',
    '.#...#.......=.',
    '.#...#.......=.',
    '.############S.',
    '...............',
  ],
  start: { col: 9, row: 2, heading: -Math.PI / 2 },
  storm: [4, 9, 11, 8, 5, 3],
  startSalt: 60,
}
