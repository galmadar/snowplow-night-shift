import { PINE_HOLLOW } from './content/towns/pineHollow'
import { createWorld } from './sim/World'
import { start, type Game } from './shell/GameLoop'

const hudRoot = document.getElementById('hud') as HTMLElement
let game: Game | null = null

/** A fresh canvas per night, so the old scene's GPU memory goes with the old one. */
function freshCanvas(): HTMLCanvasElement {
  const old = document.getElementById('view')
  const next = document.createElement('canvas')
  next.id = 'view'
  if (old) old.replaceWith(next)
  else document.body.prepend(next)
  return next
}

function play(): void {
  game?.stop()
  const world = createWorld(PINE_HOLLOW)
  // Dev only: lets a test driver read the night without a screenshot.
  if (import.meta.env.DEV) (globalThis as Record<string, unknown>).world = world
  game = start(world, freshCanvas(), hudRoot, play)
}

play()
