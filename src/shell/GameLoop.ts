import { Renderer } from '../render/Renderer'
import {
  beginNight,
  say,
  skipToDawn,
  tick,
  toggleBlade,
  toggleSpreader,
  type Controls,
  type World,
} from '../sim/World'
import { Keyboard } from '../input/Keyboard'
import { Hud } from './Hud'

const MAX_STEP = 1 / 30

export interface Game {
  /** Stop the frames, drop the panels and let the old scene go. */
  stop: () => void
}

// One keyboard for the whole page - a second one would make every key fire twice.
let keyboard: Keyboard | null = null

export function start(world: World, canvas: HTMLCanvasElement, hudRoot: HTMLElement, onAgain: () => void): Game {
  const renderer = new Renderer(canvas, world)
  const hud = new Hud(hudRoot, () => beginNight(world), onAgain)
  if (!keyboard) keyboard = new Keyboard()
  const keys = keyboard

  let skipAskedAt = -10
  keys.on(' ', () => toggleBlade(world))
  keys.on('b', () => toggleBlade(world))
  keys.on('e', () => toggleSpreader(world))
  keys.on('x', () => toggleSpreader(world))
  keys.on('c', () => {
    const mode = renderer.toggleCamera()
    say(world, mode === 'high' ? 'Camera up high' : 'Camera behind the truck')
  })
  keys.on('enter', () => {
    if (world.phase === 'ready') beginNight(world)
    else if (world.phase === 'done') onAgain()
  })
  keys.on('r', onAgain)
  // Twice, so a stray tap does not end the night.
  keys.on('n', () => {
    if (world.phase !== 'plowing') return
    if (world.clock - skipAskedAt < 3) skipToDawn(world)
    else {
      skipAskedAt = world.clock
      say(world, 'Press N again to skip to 6 AM and send the bus', 'warn')
    }
  })

  let previous = performance.now()
  let handle = 0
  let running = true

  function frame(now: number): void {
    if (!running) return
    const dt = Math.min(MAX_STEP, (now - previous) / 1000)
    previous = now
    const controls: Controls = {
      throttle: (keys.down('w', 'arrowup') ? 1 : 0) - (keys.down('s', 'arrowdown') ? 1 : 0),
      steer: (keys.down('d', 'arrowright') ? 1 : 0) - (keys.down('a', 'arrowleft') ? 1 : 0),
    }
    tick(world, dt, controls)
    hud.update(world)
    renderer.sync(world, dt)
    handle = requestAnimationFrame(frame)
  }
  handle = requestAnimationFrame(frame)

  return {
    stop(): void {
      running = false
      cancelAnimationFrame(handle)
      renderer.dispose()
      hud.destroy()
    },
  }
}
