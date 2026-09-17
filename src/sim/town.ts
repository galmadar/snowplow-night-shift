import { TUNING } from './tuning'

export type TileKind = 'lot' | 'road'

export interface Tile {
  col: number
  row: number
  kind: TileKind
  route: boolean
  hill: boolean
  depot: boolean
  garage: boolean
  school: boolean
}

/** A hill is a straight east-west stretch of road that humps up and down. */
export interface HillRun {
  row: number
  from: number
  to: number
}

export interface TownPlan {
  name: string
  /**
   * One string per row. `.` houses, `#` road, `=` bus route, `^` hill road,
   * `%` hill on the bus route, `D` salt depot, `G` bus garage (route start),
   * `S` school (route end).
   */
  map: string[]
  start: { col: number; row: number; heading: number }
  /** Snowfall in cm for each hour from midnight to 6am. */
  storm: number[]
  startSalt: number
}

export interface Town {
  name: string
  width: number
  height: number
  tiles: Tile[]
  /** Tile indices in the order the bus drives them. */
  route: number[]
  depot: number
  hills: HillRun[]
}

const ROUTE = new Set(['=', '%', 'G', 'S'])
const HILL = new Set(['^', '%'])
const ROAD = new Set(['#', '=', '^', '%', 'D', 'G', 'S'])

export function parseTown(plan: TownPlan): Town {
  const height = plan.map.length
  const width = plan.map[0]?.length ?? 0
  const tiles: Tile[] = []
  for (let row = 0; row < height; row++) {
    const line = plan.map[row]!
    if (line.length !== width) throw new Error(`row ${row} is ${line.length} wide, not ${width}`)
    for (let col = 0; col < width; col++) {
      const ch = line[col]!
      if (ch !== '.' && !ROAD.has(ch)) throw new Error(`unknown map mark '${ch}' at ${col},${row}`)
      tiles.push({
        col,
        row,
        kind: ROAD.has(ch) ? 'road' : 'lot',
        route: ROUTE.has(ch),
        hill: HILL.has(ch),
        depot: ch === 'D',
        garage: ch === 'G',
        school: ch === 'S',
      })
    }
  }

  const only = (what: string, pick: (t: Tile) => boolean): number => {
    const found = tiles.filter(pick)
    if (found.length !== 1) throw new Error(`map needs exactly one ${what}, has ${found.length}`)
    return found[0]!.row * width + found[0]!.col
  }
  const garage = only('bus garage', (t) => t.garage)
  only('school', (t) => t.school)
  const depot = only('depot', (t) => t.depot)

  const town: Town = { name: plan.name, width, height, tiles, route: [], depot, hills: [] }
  town.route = walkRoute(town, garage)
  town.hills = findHills(town)
  return town
}

export function neighbours(town: Town, index: number): number[] {
  const { col, row } = town.tiles[index]!
  const out: number[] = []
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const c = col + dc
    const r = row + dr
    if (c >= 0 && r >= 0 && c < town.width && r < town.height) out.push(r * town.width + c)
  }
  return out
}

function walkRoute(town: Town, garage: number): number[] {
  const path = [garage]
  let prev = -1
  let cur = garage
  while (!town.tiles[cur]!.school) {
    const next = neighbours(town, cur).filter((n) => n !== prev && town.tiles[n]!.route)
    if (next.length !== 1) {
      const t = town.tiles[cur]!
      throw new Error(`bus route splits or stops at ${t.col},${t.row}`)
    }
    prev = cur
    cur = next[0]!
    path.push(cur)
  }
  const marked = town.tiles.filter((t) => t.route).length
  if (marked !== path.length) throw new Error(`bus route has ${marked - path.length} stray squares`)
  return path
}

function findHills(town: Town): HillRun[] {
  const runs: HillRun[] = []
  for (let row = 0; row < town.height; row++) {
    let from = -1
    for (let col = 0; col <= town.width; col++) {
      const hill = col < town.width && town.tiles[row * town.width + col]!.hill
      if (hill && from < 0) from = col
      if (!hill && from >= 0) {
        runs.push({ row, from, to: col - 1 })
        from = -1
      }
    }
  }
  for (const t of town.tiles) {
    if (!t.hill) continue
    const below = town.tiles[(t.row + 1) * town.width + t.col]
    if (below?.hill) throw new Error('hills must run east-west')
  }
  return runs
}

export function tileAt(town: Town, x: number, z: number): number {
  const col = Math.floor(x / TUNING.cell)
  const row = Math.floor(z / TUNING.cell)
  if (col < 0 || row < 0 || col >= town.width || row >= town.height) return -1
  return row * town.width + col
}

export function isRoadAt(town: Town, x: number, z: number): boolean {
  const i = tileAt(town, x, z)
  return i >= 0 && town.tiles[i]!.kind === 'road'
}

export function tileCentre(town: Town, index: number): { x: number; z: number } {
  const t = town.tiles[index]!
  return { x: (t.col + 0.5) * TUNING.cell, z: (t.row + 0.5) * TUNING.cell }
}

/** Height of the ground. The hump spills gently onto the gardens either side. */
export function groundHeight(town: Town, x: number, z: number): number {
  const C = TUNING.cell
  let best = 0
  for (const h of town.hills) {
    const x0 = h.from * C
    const x1 = (h.to + 1) * C
    if (x <= x0 || x >= x1) continue
    const d = Math.abs(z - (h.row + 0.5) * C)
    const fall = d <= C / 2 ? 1 : d >= C * 1.5 ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * (d - C / 2)) / C)
    best = Math.max(best, TUNING.hillHeight * Math.sin((Math.PI * (x - x0)) / (x1 - x0)) * fall)
  }
  return best
}

/** Rise per unit travelled east. Hills only run east-west, so that is all there is. */
export function slopeEast(town: Town, x: number, z: number): number {
  const e = 0.05
  return (groundHeight(town, x + e, z) - groundHeight(town, x - e, z)) / (2 * e)
}
