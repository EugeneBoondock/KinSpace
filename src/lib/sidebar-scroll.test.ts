import assert from 'node:assert/strict'
import test from 'node:test'

import { readSidebarScrollTop, writeSidebarScrollTop } from './sidebar-scroll'

function makeStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  } satisfies Pick<Storage, 'getItem' | 'setItem'>
}

test('sidebar scroll helper restores a saved offset', () => {
  const storage = makeStorage()

  writeSidebarScrollTop(storage, 420)

  assert.equal(readSidebarScrollTop(storage), 420)
})

test('sidebar scroll helper ignores bad saved values', () => {
  const storage = makeStorage()
  storage.setItem('kinspace:sidebar-scroll-top', 'nope')

  assert.equal(readSidebarScrollTop(storage), 0)
})
