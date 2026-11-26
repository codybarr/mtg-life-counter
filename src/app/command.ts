import { Duration, Effect, Option, Random, Schema } from 'effect'
import { KeyValueStore } from 'effect/persistence'
import { Command } from 'foldkit'

import { BrowserKeyValueStore } from '@effect/platform-browser'

import {
  D20_SIDES,
  Game,
  GameJson,
  PlayerId,
  type PlayerRoll,
  highRoller,
} from '../domain/game'
import { Message } from './message'
import { HIGH_ROLL_MS, RECENT_CHANGE_MS } from './model'

export const GAME_STORAGE_KEY = 'mtg-life-counter/game/v1'

export const SaveGame = Command.define('SaveGame', {
  args: { game: Game },
  messages: [Message.SucceededSaveGame, Message.FailedSaveGame],
  execute: ({ game }) =>
    Effect.gen(function* () {
      const store = yield* KeyValueStore.KeyValueStore
      const json = yield* Schema.encodeEffect(GameJson)(game)
      yield* store.set(GAME_STORAGE_KEY, json)
      return Message.SucceededSaveGame()
    }).pipe(
      Effect.catch(() => Effect.succeed(Message.FailedSaveGame())),
      Effect.provide(BrowserKeyValueStore.layerLocalStorage),
    ),
})

export const LoadGame: Effect.Effect<Option.Option<Game>> = Effect.gen(
  function* () {
    const store = yield* KeyValueStore.KeyValueStore
    const maybeJson = Option.fromNullishOr(yield* store.get(GAME_STORAGE_KEY))
    if (Option.isNone(maybeJson)) return Option.none()
    const game = yield* Schema.decodeEffect(GameJson)(maybeJson.value)
    return Option.some(game)
  },
).pipe(
  Effect.catch(() => Effect.succeed(Option.none())),
  Effect.provide(BrowserKeyValueStore.layerLocalStorage),
)

export const ExpireRecentChange = Command.define('ExpireRecentChange', {
  args: { playerId: PlayerId, seq: Schema.Number },
  messages: [Message.ExpiredRecentChange],
  execute: ({ playerId, seq }) =>
    Effect.sleep(Duration.millis(RECENT_CHANGE_MS)).pipe(
      Effect.as(Message.ExpiredRecentChange({ playerId, seq })),
    ),
})

export const ExpireHighRoll = Command.define('ExpireHighRoll', {
  args: { seq: Schema.Number },
  messages: [Message.ExpiredHighRoll],
  execute: ({ seq }) =>
    Effect.sleep(Duration.millis(HIGH_ROLL_MS)).pipe(
      Effect.as(Message.ExpiredHighRoll({ seq })),
    ),
})

/** Every player rolls a d20; the whole table rerolls until one roll is
 *  highest. Rerolling everyone is as fair as rerolling only the tied players,
 *  and leaves each panel with a single number to show. */
export const RollHighRoll = Command.define('RollHighRoll', {
  args: { playerIds: Schema.Array(PlayerId) },
  messages: [Message.RolledHighRoll],
  execute: ({ playerIds }) =>
    Effect.gen(function* () {
      while (true) {
        const rolls: Array<PlayerRoll> = []
        for (const playerId of playerIds) {
          rolls.push({ playerId, roll: yield* Random.nextIntBetween(1, D20_SIDES + 1) })
        }
        const maybeWinner = highRoller(rolls)
        if (Option.isSome(maybeWinner)) {
          return Message.RolledHighRoll({ rolls, winnerId: maybeWinner.value })
        }
      }
    }),
})

/** A delayed buzz, timed to a moment in an animation. */
export const DelayedHaptic = Command.define('DelayedHaptic', {
  args: { delayMs: Schema.Number, durationMs: Schema.Number },
  messages: [Message.CompletedHaptic],
  execute: ({ delayMs, durationMs }) =>
    Effect.sleep(Duration.millis(delayMs)).pipe(
      Effect.andThen(
        Effect.sync(() => {
          vibrate(durationMs)
          return Message.CompletedHaptic()
        }),
      ),
    ),
})

// iOS Safari has no Vibration API, but toggling a native switch control
// (`<input type="checkbox" switch>`, iOS 18+) plays the system haptic tick.
// A hidden one is created on first use and clicked through its label.
let maybeSwitchLabel: HTMLLabelElement | undefined

const switchLabel = (): HTMLLabelElement => {
  if (maybeSwitchLabel) return maybeSwitchLabel
  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText =
    'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;clip-path:inset(50%)'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.tabIndex = -1
  label.append(input)
  document.body.append(label)
  maybeSwitchLabel = label
  return label
}

const vibrate = (durationMs: number): void => {
  if (typeof navigator === 'undefined') return
  if ('vibrate' in navigator) {
    navigator.vibrate(durationMs)
  } else if (typeof document !== 'undefined') {
    switchLabel().click()
  }
}

/** A short buzz: the Vibration API where it exists (Android), otherwise the
 *  iOS switch-control haptic. Devices with neither stay silent. */
export const Haptic = Command.define('Haptic', {
  args: { durationMs: Schema.Number },
  messages: [Message.CompletedHaptic],
  execute: ({ durationMs }) =>
    Effect.sync(() => {
      vibrate(durationMs)
      return Message.CompletedHaptic()
    }),
})
