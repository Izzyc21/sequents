import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Frame code ships to every browser. Nothing in it may carry words that
 * would give a choice away: identifiers, classes, test ids and comments are
 * all scanned, as raw substrings. The committed contract files are exempt
 * because their names were fixed before this rule was written down.
 */
const DIR = fileURLToPath(new URL('./src/features/frames', import.meta.url))
const CONTRACT = new Set(['types.ts', 'registry.ts', 'index.tsx'])
const BANNED = /clue|decoy|correct|best|key|answer|trap|hint|tell|decisive|secret|hidden|suspicious|fake|phish|wrong/i

describe('frame code hygiene', () => {
  const files = readdirSync(DIR).filter((f) => /\.(ts|tsx)$/.test(f) && !CONTRACT.has(f))

  it('has frame files to scan', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it.each(files.map((f) => [f]))('%s holds no giveaway words', (file) => {
    // aria-hidden="true" on drawings is required, so only that attribute is allowed through.
    const text = readFileSync(join(DIR, file), 'utf8').replaceAll('aria-hidden', 'aria-h')
    const hits = text.split('\n').flatMap((line, i) => (BANNED.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : []))
    expect(hits).toEqual([])
  })
})
