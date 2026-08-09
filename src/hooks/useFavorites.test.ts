// Tests target the pure toggleFavoriteId function directly — no component
// or hook rendering needed.

import { describe, expect, it } from 'vitest'
import { toggleFavoriteId } from './useFavorites'

describe('toggleFavoriteId', () => {
  it('adds a playerId that is not yet favorited', () => {
    expect(toggleFavoriteId([], 'p1')).toEqual(['p1'])
    expect(toggleFavoriteId(['p1'], 'p2')).toEqual(['p1', 'p2'])
  })

  it('removes a playerId that is already favorited', () => {
    expect(toggleFavoriteId(['p1', 'p2'], 'p1')).toEqual(['p2'])
  })

  it('is a no-op on unrelated entries when toggling one id twice', () => {
    const afterAdd = toggleFavoriteId(['p2'], 'p1')
    const afterRemove = toggleFavoriteId(afterAdd, 'p1')
    expect(afterRemove).toEqual(['p2'])
  })

  it('does not mutate the input array', () => {
    const original = ['p1']
    toggleFavoriteId(original, 'p2')
    expect(original).toEqual(['p1'])
  })
})
