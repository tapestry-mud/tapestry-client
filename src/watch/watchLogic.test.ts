import { describe, it, expect } from 'vitest'
import { nextEntityId } from './watchLogic'

const roster = [
  { entityId: 'a', name: 'A', roomId: '' },
  { entityId: 'b', name: 'B', roomId: '' },
  { entityId: 'c', name: 'C', roomId: '' },
]

describe('nextEntityId', () => {
  it('returns null for an empty roster', () => {
    expect(nextEntityId([], 'a')).toBeNull()
  })

  it('starts at the head when current is null', () => {
    expect(nextEntityId(roster, null)).toBe('a')
  })

  it('advances to the next entry', () => {
    expect(nextEntityId(roster, 'a')).toBe('b')
  })

  it('wraps around at the end', () => {
    expect(nextEntityId(roster, 'c')).toBe('a')
  })

  it('starts at the head when current is not in the roster', () => {
    expect(nextEntityId(roster, 'zzz')).toBe('a')
  })
})
