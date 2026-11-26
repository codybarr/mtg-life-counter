import { describe, expect, test } from 'bun:test'
import { Array, Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'

import { Dialog } from '@foldkit/ui'

import { adjustLife, freshGame } from '../domain/game'
import { initialModel } from './init'
import { ExpireRecentChange, Haptic, SaveGame } from './command'
import { Message } from './message'
import {
  HOLD_FIRST_REPEAT_TICKS,
  HOLD_REPEAT_EVERY_TICKS,
  type Model,
} from './model'
import { update } from './update'

const start = (): Model =>
  initialModel({ maybeGame: Option.none(), isPageVisible: true })

/** Folds Messages through update, discarding Commands, and returns the final
 *  Model with every Command name that was produced along the way. */
const run = (from: Model, ...messages: ReadonlyArray<Message>) =>
  Array.reduce(
    messages,
    { model: from, commands: [] as Array<string> },
    (state, next) => {
      const result = update(state.model, next)
      return {
        model: result.model,
        commands: [...state.commands, ...(result.commands ?? []).map(({ name }) => name)],
      }
    },
  )

const life = (m: Model, index: 0 | 1 | 2 | 3) => m.game.players[index].life

const zone = { playerId: 'p1', direction: 1 } as const
const ticks = (count: number) =>
  Array.makeBy(count, () => Message.TickedHold())

describe('tapping a life zone', () => {
  test('a tap (press, release, click) changes life by one and saves', () => {
    const { model, commands } = run(
      start(),
      Message.PressedLifeZone(zone),
      Message.ReleasedLifeZone(zone),
      Message.ClickedLifeZone(zone),
    )
    expect(life(model, 0)).toBe(41)
    expect(model.recentChanges.p1?.amount).toBe(1)
    expect(commands).toContain('SaveGame')
    expect(commands).toContain('ExpireRecentChange')
  })

  test('keyboard activation (click without a press) also counts', () => {
    const { model } = run(start(), Message.ClickedLifeZone({ playerId: 'p2', direction: -1 }))
    expect(life(model, 1)).toBe(39)
  })

  test('rapid taps accumulate in the recent-change bubble', () => {
    const { model } = run(
      start(),
      Message.ClickedLifeZone(zone),
      Message.ClickedLifeZone(zone),
      Message.ClickedLifeZone({ playerId: 'p1', direction: -1 }),
    )
    expect(model.recentChanges.p1?.amount).toBe(1)
    expect(life(model, 0)).toBe(41)
  })
})

describe('holding a life zone', () => {
  test('repeats by ten after the hold delay and swallows the trailing click', () => {
    const held = run(
      start(),
      Message.PressedLifeZone(zone),
      ...ticks(HOLD_FIRST_REPEAT_TICKS),
    )
    expect(life(held.model, 0)).toBe(50)

    const repeated = run(held.model, ...ticks(HOLD_REPEAT_EVERY_TICKS))
    expect(life(repeated.model, 0)).toBe(60)

    const released = run(
      repeated.model,
      Message.ReleasedLifeZone(zone),
      Message.ClickedLifeZone(zone),
    )
    expect(life(released.model, 0)).toBe(60)
    expect(released.model.holds).toHaveLength(0)
    expect(released.model.suppressedClickZones).toHaveLength(0)
  })

  test('a short press is just a tap', () => {
    const { model } = run(
      start(),
      Message.PressedLifeZone(zone),
      ...ticks(HOLD_FIRST_REPEAT_TICKS - 1),
      Message.ReleasedLifeZone(zone),
      Message.ClickedLifeZone(zone),
    )
    expect(life(model, 0)).toBe(41)
  })

  test('two players can hold at the same time', () => {
    const other = { playerId: 'p3', direction: -1 } as const
    const { model } = run(
      start(),
      Message.PressedLifeZone(zone),
      Message.PressedLifeZone(other),
      ...ticks(HOLD_FIRST_REPEAT_TICKS),
    )
    expect(life(model, 0)).toBe(50)
    expect(life(model, 2)).toBe(30)
  })

  test('a stale suppression from a lost click is cleared by the next press', () => {
    const { model } = run(
      start(),
      Message.PressedLifeZone(zone),
      ...ticks(HOLD_FIRST_REPEAT_TICKS),
      Message.ReleasedLifeZone(zone),
      // The click never arrived (finger slid off). The next tap must count.
      Message.PressedLifeZone(zone),
      Message.ReleasedLifeZone(zone),
      Message.ClickedLifeZone(zone),
    )
    expect(life(model, 0)).toBe(51)
  })

  test('leaving the zone or hiding the page cancels holds', () => {
    const left = run(start(), Message.PressedLifeZone(zone), Message.LeftLifeZone(zone))
    expect(left.model.holds).toHaveLength(0)
    const hidden = run(
      start(),
      Message.PressedLifeZone(zone),
      Message.ChangedPageVisibility({ isVisible: false }),
    )
    expect(hidden.model.holds).toHaveLength(0)
  })
})

describe('recent change bubble', () => {
  test('only the latest change clears it', () => {
    story(
      update,
      given(start()),
      message(Message.ClickedLifeZone(zone)),
      Command.resolveAll(
        [ExpireRecentChange, Message.ExpiredRecentChange({ playerId: 'p1', seq: 99 })],
        [Haptic, Message.CompletedHaptic()],
        [SaveGame, Message.SucceededSaveGame()],
      ),
      model(m => expect(m.recentChanges.p1?.amount).toBe(1)),
      message(Message.ExpiredRecentChange({ playerId: 'p1', seq: 0 })),
      model(m => expect(m.recentChanges.p1).toBeUndefined()),
    )
  })
})

describe('commander damage from the player dialog', () => {
  test('lowers life and persists', () => {
    const { model, commands } = run(
      start(),
      Message.ClickedCommanderDamageStep({ targetId: 'p2', sourceId: 'p1', slot: 0, amount: 1 }),
      Message.ClickedCommanderDamageStep({ targetId: 'p2', sourceId: 'p1', slot: 0, amount: 1 }),
    )
    expect(model.game.players[1].commanderDamage['p1:0']).toBe(2)
    expect(life(model, 1)).toBe(38)
    expect(commands.filter(name => name === 'SaveGame')).toHaveLength(2)
  })
})

describe('table settings', () => {
  test('starting life applies immediately to an untouched game', () => {
    const { model } = run(start(), Message.SelectedStartingLife({ life: 20 }))
    expect(life(model, 0)).toBe(20)
  })

  test('starting life waits for New game when a game is in progress', () => {
    const inProgress = { ...start(), game: adjustLife(freshGame(), 'p1', -3) }
    const { model } = run(inProgress, Message.SelectedStartingLife({ life: 20 }))
    expect(life(model, 0)).toBe(37)
    expect(model.game.settings.startingLife).toBe(20)
  })

  test('New game asks for confirmation first', () => {
    const inProgress = { ...start(), game: adjustLife(freshGame(), 'p1', -3) }
    const once = run(inProgress, Message.ClickedNewGame())
    expect(life(once.model, 0)).toBe(37)
    expect(once.model.isConfirmingNewGame).toBe(true)

    const twice = run(once.model, Message.ClickedNewGame())
    expect(life(twice.model, 0)).toBe(40)
    expect(twice.model.isConfirmingNewGame).toBe(false)
  })

  test('turning keep-awake off is saved and reflected in status', () => {
    const { model, commands } = run(start(), Message.ToggledKeepAwake({ isOn: false }))
    expect(model.game.settings.keepAwake).toBe(false)
    expect(model.wakeLockStatus).toBe('Off')
    expect(commands).toContain('SaveGame')
  })

  test('keep-awake is on by default', () => {
    expect(start().game.settings.keepAwake).toBe(true)
  })

  test('a failed wake lock is retried on the next tap', () => {
    const failed = run(start(), Message.ChangedWakeLockStatus({ status: 'Failed' }))
    const tapped = run(failed.model, Message.PressedLifeZone(zone))
    expect(tapped.model.wakeLockAttempt).toBe(failed.model.wakeLockAttempt + 1)
  })
})

describe('player dialog', () => {
  test('opening a player remembers who it is for', () => {
    const { model } = run(start(), Message.ClickedPlayer({ playerId: 'p3' }))
    expect(model.maybeDialogPlayerId).toStrictEqual(Option.some('p3'))
    expect(model.playerDialog.isOpen).toBe(true)
  })

  test('closing does not touch the game', () => {
    const opened = run(start(), Message.ClickedPlayer({ playerId: 'p3' }))
    const closed = run(
      opened.model,
      Message.GotPlayerDialogMessage({ message: Dialog.Message.RequestedClose() }),
    )
    expect(closed.model.game).toBe(opened.model.game)
  })
})

describe('high roll', () => {
  test('shows every roll until it expires', () => {
    const rolls = [
      { playerId: 'p1', roll: 7 },
      { playerId: 'p2', roll: 18 },
    ] as const
    const rolled = run(start(), Message.RolledHighRoll({ rolls, winnerId: 'p2' }))
    const highRoll = Option.getOrThrow(rolled.model.maybeHighRoll)
    expect(highRoll.winnerId).toBe('p2')
    expect(highRoll.rolls).toStrictEqual(rolls)
    const expired = run(rolled.model, Message.ExpiredHighRoll({ seq: highRoll.seq }))
    expect(expired.model.maybeHighRoll).toStrictEqual(Option.none())
  })

  test('a stale expiry leaves a newer roll alone', () => {
    const rolls = [{ playerId: 'p1', roll: 3 }, { playerId: 'p2', roll: 9 }] as const
    const first = run(start(), Message.RolledHighRoll({ rolls, winnerId: 'p2' }))
    const staleSeq = Option.getOrThrow(first.model.maybeHighRoll).seq
    const second = run(first.model, Message.RolledHighRoll({ rolls, winnerId: 'p2' }))
    const after = run(second.model, Message.ExpiredHighRoll({ seq: staleSeq }))
    expect(Option.isSome(after.model.maybeHighRoll)).toBe(true)
  })
})
