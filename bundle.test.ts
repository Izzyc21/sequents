/**
 * The browser bundle must not contain any starter's hidden half: the "why"
 * behind each option, each option's outcome, or the ending texts. Starters
 * are imported by the worker only; this catches a client import of them.
 *
 * Reads the built client in dist/client (run `npm run build` first). With
 * no build it is skipped, unless REQUIRE_BUNDLE=1 (set by `npm run verify`),
 * which makes a missing build a failure. Source maps are scanned too, since
 * they ship the original source.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { STARTERS } from './src/seeds/starters'

const CLIENT = fileURLToPath(new URL('./dist/client', import.meta.url))

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

/** Every hidden string of every starter. */
const hidden = STARTERS.flatMap((s) => [
  ...s.scenes.flatMap((scene) => scene.options.flatMap((o) => [o.why, o.outcome])),
  s.endings.good,
  s.endings.ok,
  s.endings.bad,
])

const required = process.env.REQUIRE_BUNDLE === '1'

describe.skipIf(!existsSync(CLIENT) && !required)('client bundle', () => {
  it('contains no hidden starter text, source maps included', () => {
    expect(existsSync(CLIENT), 'no build in dist/client; run npm run build').toBe(true)
    const scanned = files(CLIENT).filter((file) => /\.(js|mjs|css|html|map|json|txt)$/.test(file))
    // Not vacuous: the build holds the app's scripts.
    expect(scanned.filter((file) => file.endsWith('.js')).length).toBeGreaterThan(0)
    const found: string[] = []
    for (const file of scanned) {
      const text = readFileSync(file, 'utf8')
      for (const h of hidden) if (text.includes(h)) found.push(`${file}: ${h.slice(0, 40)}`)
    }
    expect(found).toEqual([])
  })
})
