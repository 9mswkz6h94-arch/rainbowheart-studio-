import test from 'node:test'
import assert from 'node:assert/strict'
import { bookSpread, pageLabel } from '../src/lib/songbook.mjs'

test('single pages remain individually addressable', () => {
  assert.deepEqual(bookSpread(1, 4, 1), { start: 1, end: 2, length: 1 })
})
test('spreads align and clamp including backward entry and odd endings', () => {
  assert.deepEqual(bookSpread(1, 5, 2), { start: 0, end: 2, length: 2 })
  assert.deepEqual(bookSpread(2, 5, 2), { start: 2, end: 4, length: 2 })
  assert.deepEqual(bookSpread(Number.MAX_SAFE_INTEGER, 5, 2), { start: 4, end: 5, length: 1 })
  assert.deepEqual(bookSpread(Number.MAX_SAFE_INTEGER, 4, 2), { start: 2, end: 4, length: 2 })
  assert.deepEqual(bookSpread(0, 1, 2), { start: 0, end: 1, length: 1 })
  assert.deepEqual(bookSpread(0, 0, 2), { start: 0, end: 0, length: 0 })
})
test('spread navigation covers each page exactly once in both directions', () => {
  for (let count = 1; count <= 9; count++) {
    const visited = []
    for (let page = 0; page < count; page += 2) {
      const spread = bookSpread(page, count, 2)
      for (let i = spread.start; i < spread.end; i++) visited.push(i)
    }
    assert.deepEqual(visited, Array.from({ length: count }, (_, i) => i))
    let start = bookSpread(Number.MAX_SAFE_INTEGER, count, 2).start
    const reverse = []
    for (; start >= 0; start -= 2) reverse.push(bookSpread(start, count, 2).start)
    assert.deepEqual(reverse.reverse(), Array.from({ length: Math.ceil(count / 2) }, (_, i) => i * 2))
  }
})
test('page labels distinguish spreads and unpaired pages', () => {
  assert.equal(pageLabel(0, 2), 'Pages 1–2')
  assert.equal(pageLabel(4, 5), 'Page 5')
})
