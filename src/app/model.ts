import { Schema } from 'effect'

import { Dialog } from '@foldkit/ui'

import { Game, PlayerId, PlayerRoll } from '../domain/game'

export const Direction = Schema.Literals([1, -1])
export type Direction = typeof Direction.Type

/** A finger (or mouse button) held down on one of a player's life zones.
 *  `ticks` counts hold-clock ticks since the press; `repeats` counts the
 *  repeated steps applied so far. A hold that ends with zero repeats was a
 *  tap. */
export const Hold = Schema.Struct({
  playerId: PlayerId,
  direction: Direction,
  ticks: Schema.Number,
  repeats: Schema.Number,
})
export type Hold = typeof Hold.Type

/** The running total of a player's recent life changes, shown as a bubble
 *  until `seq` stops being the latest change for that player. */
export const RecentChange = Schema.Struct({
  amount: Schema.Number,
  seq: Schema.Number,
})
export type RecentChange = typeof RecentChange.Type

/** A d20 roll-off: every player's roll, and the single highest roller who
 *  goes first. Cleared once `seq` expires. */
export const HighRoll = Schema.Struct({
  rolls: Schema.Array(PlayerRoll),
  winnerId: PlayerId,
  seq: Schema.Number,
})
export type HighRoll = typeof HighRoll.Type

export const WakeLockStatus = Schema.Literals([
  'Off',
  'Requesting',
  'Active',
  'Unsupported',
  'Failed',
])
export type WakeLockStatus = typeof WakeLockStatus.Type

export const Model = Schema.Struct({
  game: Game,
  holds: Schema.Array(Hold),
  /** Zone keys whose next click should be swallowed because a hold on that
   *  zone already applied repeated steps. */
  suppressedClickZones: Schema.Array(Schema.String),
  recentChanges: Schema.Record(Schema.String, RecentChange),
  nextSeq: Schema.Number,
  maybeHighRoll: Schema.Option(HighRoll),
  isConfirmingNewGame: Schema.Boolean,
  menuDialog: Dialog.Model,
  playerDialog: Dialog.Model,
  /** Kept after the dialog closes so its leave animation still has content. */
  maybeDialogPlayerId: Schema.Option(PlayerId),
  isPageVisible: Schema.Boolean,
  wakeLockStatus: WakeLockStatus,
  /** Bumped by a tap after a failed request, so the wake lock is retried
   *  while the browser still counts the page as user-activated. */
  wakeLockAttempt: Schema.Number,
})
export type Model = typeof Model.Type

export const zoneKey = (playerId: PlayerId, direction: Direction): string =>
  `${playerId}:${direction}`

// HOLD TIMING

export const HOLD_TICK_MS = 100
/** Ticks before the first repeat (500ms). */
export const HOLD_FIRST_REPEAT_TICKS = 5
/** Ticks between later repeats (400ms). */
export const HOLD_REPEAT_EVERY_TICKS = 4
export const HOLD_STEP = 10
export const TAP_STEP = 1

export const RECENT_CHANGE_MS = 1800
/** The die tumbles for HIGH_ROLL_REVEAL_MS, then the winner is shown until
 *  HIGH_ROLL_MS. Keep in sync with the high-roll animations in styles.css. */
export const HIGH_ROLL_REVEAL_MS = 1200
export const HIGH_ROLL_MS = 4500
