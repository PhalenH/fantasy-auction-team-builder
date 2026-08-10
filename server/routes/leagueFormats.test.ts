// Integration tests against the REAL seeded local Postgres.
// Requires: docker compose up -d && npm run db:reset

import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'

import type { LeagueFormatWithSlots, RosterPositionSlot } from '../../src/types/League'
import { createApp } from '../app'
import { pool } from '../db/pool'

const app = createApp(pool)

afterAll(async () => {
  await pool.end()
})

async function fetchFormats(): Promise<LeagueFormatWithSlots[]> {
  const response = await request(app).get('/api/league-formats')
  expect(response.status).toBe(200)
  return response.body as LeagueFormatWithSlots[]
}

function slotsByLabel(format: LeagueFormatWithSlots): Record<string, RosterPositionSlot> {
  return Object.fromEntries(format.slots.map((slot) => [slot.slotLabel, slot]))
}

describe('GET /api/league-formats', () => {
  it('returns the three finalized formats', async () => {
    const formats = await fetchFormats()
    expect(formats.map((format) => format.key)).toEqual(['regular', 'regular_3wr', 'double_flex'])
    expect(formats.map((format) => format.displayName)).toEqual(['Regular', 'Regular - 3WR', 'Double Flex'])
  })

  it('embeds all eight roster slots per format, in sort order', async () => {
    const formats = await fetchFormats()
    for (const format of formats) {
      expect(format.slots).toHaveLength(8)
      expect(format.slots.map((slot) => slot.slotLabel)).toEqual([
        'QB',
        'RB',
        'WR',
        'TE',
        'FLEX',
        'K',
        'DST',
        'BENCH',
      ])
      expect(format.slots.map((slot) => slot.sortOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    }
  })

  it('matches the Regular-3WR composition from docs/datamodel.md', async () => {
    const formats = await fetchFormats()
    const slots = slotsByLabel(formats.find((format) => format.key === 'regular_3wr')!)

    expect(slots.WR.count).toBe(3)
    // The finalized decision: 3WR keeps FLEX in addition to the third WR,
    // rather than replacing it.
    expect(slots.FLEX.count).toBe(1)
    expect(slots.QB.count).toBe(1)
    expect(slots.RB.count).toBe(2)
    expect(slots.BENCH.count).toBe(7)
  })

  it('matches the Regular and Double Flex compositions', async () => {
    const formats = await fetchFormats()
    const regular = slotsByLabel(formats.find((format) => format.key === 'regular')!)
    const doubleFlex = slotsByLabel(formats.find((format) => format.key === 'double_flex')!)

    expect(regular.WR.count).toBe(2)
    expect(regular.FLEX.count).toBe(1)
    expect(doubleFlex.WR.count).toBe(2)
    expect(doubleFlex.FLEX.count).toBe(2)
  })

  it('collapses the join table back into a real eligiblePositions array', async () => {
    const formats = await fetchFormats()

    for (const format of formats) {
      for (const slot of format.slots) {
        expect(Array.isArray(slot.eligiblePositions)).toBe(true)
        expect(slot.eligiblePositions.length).toBeGreaterThan(0)
      }
    }

    const slots = slotsByLabel(formats[0])
    // Compared as sets: array_agg ordering is deterministic but differs from
    // the mock data's order, and only membership is meaningful (the array is
    // consumed via .includes() in utils/rosterAssignment.ts, never rendered).
    expect(new Set(slots.FLEX.eligiblePositions)).toEqual(new Set(['RB', 'WR', 'TE']))
    expect(new Set(slots.BENCH.eligiblePositions)).toEqual(new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DST']))
    expect(slots.QB.eligiblePositions).toEqual(['QB'])
  })

  it('tags exactly the K and DST slots with a toggle key, and nulls the rest', async () => {
    const formats = await fetchFormats()

    for (const format of formats) {
      const slots = slotsByLabel(format)
      expect(slots.K.toggleKey).toBe('kicker')
      expect(slots.DST.toggleKey).toBe('defense')

      // Null, not undefined/absent: the frontend type is ToggleKey | null,
      // and null is meaningful (always-active slot).
      for (const label of ['QB', 'RB', 'WR', 'TE', 'FLEX', 'BENCH']) {
        expect(slots[label].toggleKey).toBeNull()
      }
    }
  })

  it('returns scalar fields with the types the frontend declares', async () => {
    const [format] = await fetchFormats()
    const [slot] = format.slots

    expect(typeof format.id).toBe('string')
    expect(typeof slot.id).toBe('string')
    expect(typeof slot.leagueFormatId).toBe('string')
    expect(slot.leagueFormatId).toBe(format.id)
    expect(typeof slot.count).toBe('number')
    expect(typeof slot.sortOrder).toBe('number')
  })

  it('does not leak database column names into the payload', async () => {
    const [format] = await fetchFormats()
    expect(format).not.toHaveProperty('display_name')
    expect(format.slots[0]).not.toHaveProperty('slot_label')
    expect(format.slots[0]).not.toHaveProperty('eligible_positions')
  })
})
