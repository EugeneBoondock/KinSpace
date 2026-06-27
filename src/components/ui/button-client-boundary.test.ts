import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

test('shared Button is a client component so it can own click handlers', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/ui/Button.tsx'), 'utf8')
  const firstStatement = source.trimStart().split(/\r?\n/, 1)[0]
  assert.equal(firstStatement, "'use client'")
})
