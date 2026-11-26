import { describe, expect, test } from 'bun:test'
import { Option, Schema } from 'effect'

import {
  GameJson,
  adjustCommanderCasts,
  adjustCommanderDamage,
  adjustCounter,
  adjustLife,
  changePlayerCount,
  commanderDamageFrom,
  commanderTax,
  freshGame,
  highRoller,
  lossReason,
  restartGame,
  togglePartner,
  updatePlayer,
} from './game'
import { inkFor, normalizeHex } from './color'
import { LAYOUTS, resolveLayout } from './layout'

const p = (game: ReturnType<typeof freshGame>, index: 0 | 1 | 2 | 3) =>
  game.players[index]

describe('life and counters', () => {
  test('life adjusts and is clamped', () => {
    const game = adjustLife(freshGame(), 'p1', -5)
    expect(p(game, 0).life).toBe(35)
    expect(p(adjustLife(game, 'p1', 5000), 0).life).toBe(999)
  })

  test('counters never go below zero', () => {
    const game = adjustCounter(freshGame(), 'p2', 'poison', -3)
    expect(p(game, 1).counters.poison).toBe(0)
    expect(p(adjustCounter(game, 'p2', 'poison', 4), 1).counters.poison).toBe(4)
  })
})

describe('commander damage', () => {
  test('costs the target life and is tracked per source', () => {
    const game = adjustCommanderDamage(freshGame(), 'p1', 'p3', 0, 7)
    expect(commanderDamageFrom(p(game, 0), 'p3', 0)).toBe(7)
    expect(p(game, 0).life).toBe(33)
    expect(p(game, 2).life).toBe(40)
  })

  test('removing damage restores life, never below zero damage', () => {
    const dealt = adjustCommanderDamage(freshGame(), 'p1', 'p3', 0, 2)
    const undone = adjustCommanderDamage(dealt, 'p1', 'p3', 0, -5)
    expect(commanderDamageFrom(p(undone, 0), 'p3', 0)).toBe(0)
    expect(p(undone, 0).life).toBe(40)
  })

  test('21 from one commander is lethal even with life left', () => {
    const game = updatePlayer(
      adjustCommanderDamage(freshGame(), 'p1', 'p2', 0, 21),
      'p1',
      player => ({ ...player, life: 30 }),
    )
    expect(lossReason(p(game, 0))).toStrictEqual(Option.some('Commander'))
  })

  test('damage split across partners is not lethal', () => {
    const partnered = togglePartner(freshGame(), 'p2')
    const game = adjustCommanderDamage(
      adjustCommanderDamage(partnered, 'p1', 'p2', 0, 12),
      'p1',
      'p2',
      1,
      12,
    )
    expect(p(game, 0).life).toBe(16)
    expect(lossReason(p(game, 0))).toStrictEqual(Option.none())
  })

  test('turning partner off removes the partner damage and tax', () => {
    const partnered = togglePartner(freshGame(), 'p2')
    const dealt = adjustCommanderCasts(
      adjustCommanderDamage(partnered, 'p1', 'p2', 1, 5),
      'p2',
      1,
      2,
    )
    const solo = togglePartner(dealt, 'p2')
    expect(commanderDamageFrom(p(solo, 0), 'p2', 1)).toBe(0)
    expect(p(solo, 1).commanderCasts).toStrictEqual([0, 0])
  })
})

describe('loss conditions', () => {
  test('ten poison loses', () => {
    const game = adjustCounter(freshGame(), 'p1', 'poison', 10)
    expect(lossReason(p(game, 0))).toStrictEqual(Option.some('Poison'))
  })

  test('zero life loses', () => {
    expect(lossReason(p(adjustLife(freshGame(), 'p1', -40), 0))).toStrictEqual(
      Option.some('Life'),
    )
  })
})

describe('commander tax', () => {
  test('is two per previous cast', () => {
    const game = adjustCommanderCasts(freshGame(), 'p1', 0, 3)
    expect(commanderTax(p(game, 0), 0)).toBe(6)
  })
})

describe('game lifecycle', () => {
  test('restart keeps names, colors and partners but resets totals', () => {
    const played = adjustCounter(
      adjustLife(
        togglePartner(
          updatePlayer(freshGame(), 'p1', player => ({ ...player, name: 'Ari', color: '#123456' })),
          'p1',
        ),
        'p1',
        -12,
      ),
      'p1',
      'energy',
      3,
    )
    const restarted = restartGame({ ...played, maybeMonarchId: Option.some('p1') })
    expect(p(restarted, 0)).toMatchObject({
      name: 'Ari',
      color: '#123456',
      hasPartner: true,
      life: 40,
    })
    expect(p(restarted, 0).counters.energy).toBe(0)
    expect(restarted.maybeMonarchId).toStrictEqual(Option.none())
  })

  test('dropping the player count unseats a departed monarch', () => {
    const game = changePlayerCount(
      { ...freshGame(), maybeMonarchId: Option.some('p4') },
      3,
    )
    expect(game.settings.playerCount).toBe(3)
    expect(game.settings.layoutId).toBe('trio-wedge')
    expect(game.maybeMonarchId).toStrictEqual(Option.none())
  })

  test('the game round-trips through its JSON codec', () => {
    const game = adjustCommanderDamage(
      { ...freshGame(), maybeInitiativeId: Option.some('p2') },
      'p1',
      'p2',
      0,
      4,
    )
    const json = Schema.encodeSync(GameJson)(game)
    expect(Schema.decodeSync(GameJson)(json)).toStrictEqual(game)
  })
})

describe('layouts', () => {
  test.each(LAYOUTS.map(layout => [layout.id, layout] as const))(
    '%s has one seat per player, each in its grid areas',
    (_id, layout) => {
      expect(layout.seats).toHaveLength(layout.playerCount)
      const areas = new Set(layout.areas.join(' ').split(/\s+/))
      expect(areas.size).toBe(layout.playerCount)
      for (const seat of layout.seats) expect(areas.has(seat.area)).toBe(true)
    },
  )

  test('a layout id from a different player count falls back to the default', () => {
    expect(resolveLayout('quad-cross', 2).id).toBe('duel-faceoff')
  })
})

describe('colors', () => {
  test('normalizes hex input', () => {
    expect(normalizeHex('#ABC', '#000000')).toBe('#aabbcc')
    expect(normalizeHex('not a color', '#000000')).toBe('#000000')
  })

  test('picks dark ink only for light panels', () => {
    expect(inkFor('#e9dcc0')).toBe('dark')
    expect(inkFor('#1c7ed6')).toBe('light')
  })
})

describe('highRoller', () => {
  test('is the single highest roll', () => {
    expect(
      highRoller([
        { playerId: 'p1', roll: 4 },
        { playerId: 'p2', roll: 20 },
        { playerId: 'p3', roll: 11 },
      ]),
    ).toStrictEqual(Option.some('p2'))
  })

  test('is none when the top roll is tied', () => {
    expect(
      highRoller([
        { playerId: 'p1', roll: 17 },
        { playerId: 'p2', roll: 17 },
        { playerId: 'p3', roll: 2 },
      ]),
    ).toStrictEqual(Option.none())
  })
})
