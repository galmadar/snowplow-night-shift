// The sim must never import three. If it does, the game logic is welded to the
// renderer and nothing here is testable in isolation.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const roots = ['src/sim', 'src/content']
const offenders = []

// Catches `from 'three'`, bare `import 'three'`, require() and import(), plus subpaths like 'three/addons/...'.
const THREE_IMPORT =
  /(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"]three(?:\/[^'"]*)?['"]/

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.[cm]?[jt]sx?$/.test(p)) {
      const src = readFileSync(p, 'utf8')
      if (THREE_IMPORT.test(src)) offenders.push(p)
    }
  }
}

for (const r of roots) walk(r)

if (offenders.length) {
  console.error('sim purity violated - these files import three:')
  for (const o of offenders) console.error('  ' + o)
  process.exit(1)
}
console.log('sim purity ok')
