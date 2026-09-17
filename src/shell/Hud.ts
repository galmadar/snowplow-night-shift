import { isIcy, clockText } from '../sim/weather'
import { TUNING } from '../sim/tuning'
import type { World } from '../sim/World'

const PX = 12

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = cls
  parent.appendChild(e)
  return e
}

/** Clock, truck gauges, a little map of the town, and the start and end cards. */
export class Hud {
  private root: HTMLElement
  private clock: HTMLElement
  private night: HTMLElement
  private blade: HTMLElement
  private spreader: HTMLElement
  private saltFill: HTMLElement
  private ice: HTMLElement
  private map: HTMLCanvasElement
  private notice: HTMLElement
  private startCard: HTMLElement
  private endCard: HTMLElement
  private lastNotice = -1
  private shownResult = false

  constructor(parent: HTMLElement, onStart: () => void, onAgain: () => void) {
    this.root = el('div', 'hud-layer', parent)

    const time = el('div', 'panel clock-panel', this.root)
    this.clock = el('div', 'clock', time)
    el('div', 'sub', time).textContent = 'The bus leaves at 6:00 AM'
    const bar = el('div', 'bar', time)
    this.night = el('div', 'bar-fill night-fill', bar)

    const gauges = el('div', 'panel gauge-panel', this.root)
    this.blade = el('div', 'chip', gauges)
    this.spreader = el('div', 'chip', gauges)
    const salt = el('div', 'salt', gauges)
    el('span', 'label', salt).textContent = 'Salt'
    const sbar = el('div', 'bar', salt)
    this.saltFill = el('div', 'bar-fill salt-fill', sbar)
    this.ice = el('div', 'chip ice', gauges)
    this.ice.textContent = 'Icy hill - slipping!'

    const mapPanel = el('div', 'panel map-panel', this.root)
    this.map = el('canvas', 'minimap', mapPanel)
    const key = el('div', 'map-key', mapPanel)
    key.innerHTML =
      '<span><i style="background:#f2c230"></i>bus route</span>' +
      '<span><i style="background:#e0463a"></i>too deep</span>' +
      '<span><i style="background:#6fd3ff"></i>icy</span>' +
      '<span><i style="background:#3fbf5f"></i>salt depot</span>'

    this.notice = el('div', 'notice', this.root)

    this.startCard = el('div', 'card', this.root)
    this.startCard.innerHTML = `
      <h1>Snowplow Night Shift</h1>
      <p>It's snowing on Pine Hollow. At <b>6 AM</b> the school bus drives the
      <b class="gold">yellow route</b>. If the snow is too deep, it gets stuck!</p>
      <ul>
        <li><b>Arrows</b> or <b>W A S D</b> — drive</li>
        <li><b>Space</b> — blade down / up (down pushes snow)</li>
        <li><b>E</b> — salt spreader on / off</li>
        <li>The <b>hill</b> is icy. Salt it, or nobody gets up it.</li>
        <li>Out of salt? Stop on the <b class="green">green depot</b>.</li>
      </ul>
      <button class="go">Start the night (Enter)</button>`
    this.startCard.querySelector('button')!.addEventListener('click', onStart)

    this.endCard = el('div', 'card', this.root)
    this.endCard.hidden = true
    this.endCard.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') onAgain()
    })
  }

  update(world: World): void {
    const t = world.truck
    this.startCard.hidden = world.phase !== 'ready'
    this.clock.textContent = clockText(world.minute)
    this.night.style.width = `${(world.minute / TUNING.nightMinutes) * 100}%`

    this.blade.textContent = t.blade ? 'Blade DOWN' : 'Blade up'
    this.blade.classList.toggle('on', t.blade)
    this.spreader.textContent = t.spreader ? 'Salt spreader ON' : 'Salt spreader off'
    this.spreader.classList.toggle('on', t.spreader)
    this.saltFill.style.width = `${(t.salt / TUNING.saltMax) * 100}%`
    this.saltFill.classList.toggle('low', t.salt < 20)
    this.ice.hidden = !(t.slipping && world.phase === 'plowing')

    const n = world.notice
    if (n && n.at !== this.lastNotice) {
      this.lastNotice = n.at
      this.notice.textContent = n.text
      this.notice.className = `notice show ${n.tone}`
    }
    if (n && world.clock - n.at > 3.5) this.notice.classList.remove('show')

    this.drawMap(world)

    if (world.result && !this.shownResult) {
      this.shownResult = true
      // Let the bus finish its drive into view before the card covers it.
      setTimeout(() => this.showResult(world), 1500)
    }
  }

  private showResult(world: World): void {
    const r = world.result!
    const stars = '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars)
    const pct = Math.round(r.clean * 100)
    const headline = r.arrived
      ? 'The bus made it to school!'
      : r.reason === 'icy'
        ? 'Oh no! The bus slid on the icy hill.'
        : 'Oh no! The bus got stuck in deep snow.'
    const tip = r.arrived
      ? r.stars === 3
        ? 'Perfect night. The kids are on time!'
        : 'Plow the route again close to 6 AM to get it cleaner.'
      : r.reason === 'icy'
        ? 'Salt the hill late in the night - salt wears off after a few hours.'
        : 'Plow the whole yellow route, and do it again near the end of the night.'
    this.endCard.innerHTML = `
      <h1>${headline}</h1>
      <div class="stars">${stars}</div>
      <p>The route was <b>${pct}%</b> clean at dawn.</p>
      <p class="sub">${tip}</p>
      <button class="go">Play again (Enter)</button>`
    this.endCard.hidden = false
  }

  private drawMap(world: World): void {
    const { town, snow, truck } = world
    const w = town.width * PX
    const h = town.height * PX
    if (this.map.width !== w) {
      this.map.width = w
      this.map.height = h
    }
    const g = this.map.getContext('2d')
    if (!g) return
    g.fillStyle = '#1a2233'
    g.fillRect(0, 0, w, h)
    town.tiles.forEach((tile, i) => {
      if (tile.kind !== 'road') return
      const x = tile.col * PX
      const y = tile.row * PX
      const d = snow[i]!.depth
      const shade = Math.round(70 + Math.min(1, d / TUNING.busStuckDepth) * 170)
      g.fillStyle = tile.route && d > TUNING.busStuckDepth ? '#e0463a' : `rgb(${shade},${shade},${shade + 10})`
      if (tile.depot) g.fillStyle = '#3fbf5f'
      g.fillRect(x, y, PX, PX)
      if (tile.route) {
        g.strokeStyle = '#f2c230'
        g.lineWidth = 2
        g.strokeRect(x + 1, y + 1, PX - 2, PX - 2)
      }
      if (isIcy(world, i)) {
        g.fillStyle = '#6fd3ff'
        g.fillRect(x + 4, y + 4, PX - 8, PX - 8)
      }
    })
    // The truck, as an arrow.
    const px = (truck.x / TUNING.cell) * PX
    const py = (truck.z / TUNING.cell) * PX
    g.save()
    g.translate(px, py)
    g.rotate(truck.heading)
    g.fillStyle = '#ff7b1c'
    g.strokeStyle = '#000'
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(7, 0)
    g.lineTo(-5, -5)
    g.lineTo(-5, 5)
    g.closePath()
    g.fill()
    g.stroke()
    g.restore()

    if (world.phase === 'bus' || world.phase === 'done') {
      const route = town.route
      const k = Math.min(route.length - 1, Math.round(world.bus.progress))
      const tile = town.tiles[route[k]!]!
      g.fillStyle = '#ffd23a'
      g.beginPath()
      g.arc((tile.col + 0.5) * PX, (tile.row + 0.5) * PX, 5, 0, Math.PI * 2)
      g.fill()
      g.stroke()
    }
  }

  destroy(): void {
    this.root.remove()
  }
}
