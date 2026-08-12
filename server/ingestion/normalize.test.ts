import { describe, expect, it } from 'vitest'

import { normalizePlayerName, playerMatchKey } from './normalize'

describe('normalizePlayerName', () => {
  it('lowercases and trims', () => {
    expect(normalizePlayerName('  Patrick Mahomes  ')).toBe('patrick mahomes')
  })

  it('strips periods and collapses the resulting double space', () => {
    // The real case that motivated this function: mockPlayers.ts has
    // "Amon-Ra St. Brown", the real auction-value CSV has "Amon-Ra St Brown".
    expect(normalizePlayerName('Amon-Ra St. Brown')).toBe(normalizePlayerName('Amon-Ra St Brown'))
    expect(normalizePlayerName('Amon-Ra St. Brown')).toBe('amon-ra st brown')
  })

  it('strips apostrophes and straight/curly quote variants', () => {
    expect(normalizePlayerName("Ja'Marr Chase")).toBe('jamarr chase')
    expect(normalizePlayerName('Ja’Marr Chase')).toBe('jamarr chase')
  })

  it('leaves hyphens intact — they are meaningful word separators, not stray punctuation', () => {
    expect(normalizePlayerName('De’Von Achane')).toBe(normalizePlayerName("De'Von Achane"))
    expect(normalizePlayerName("Jaxon Smith-Njigba")).toBe('jaxon smith-njigba')
  })

  it('is idempotent — normalizing an already-normalized name is a no-op', () => {
    const once = normalizePlayerName("Ja'Marr Chase")
    expect(normalizePlayerName(once)).toBe(once)
  })
})

describe('playerMatchKey', () => {
  it('combines the normalized name with the raw position', () => {
    expect(playerMatchKey('Amon-Ra St. Brown', 'WR')).toBe('amon-ra st brown|WR')
  })

  it('treats a formatting difference in name as the same key', () => {
    expect(playerMatchKey('Amon-Ra St. Brown', 'WR')).toBe(playerMatchKey('Amon-Ra St Brown', 'WR'))
  })

  it('treats the same name at a different position as a different key', () => {
    // A player who changes position between runs should not silently match
    // the old row — DST entries in particular reuse team-style names
    // ("SF DST") that could otherwise collide across sources.
    expect(playerMatchKey('Travis Kelce', 'TE')).not.toBe(playerMatchKey('Travis Kelce', 'WR'))
  })
})
