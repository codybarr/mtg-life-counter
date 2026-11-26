import { Effect, Option, Schema } from 'effect'
import type { Runtime } from 'foldkit'

import { Dialog } from '@foldkit/ui'

import { Game, freshGame } from '../domain/game'
import { LoadGame } from './command'
import type { Message } from './message'
import type { Model } from './model'

// FLAGS

export const Flags = Schema.Struct({
  maybeGame: Schema.Option(Game),
  isPageVisible: Schema.Boolean,
})
export type Flags = typeof Flags.Type

export const flags: Effect.Effect<Flags> = LoadGame.pipe(
  Effect.map(maybeGame => ({
    maybeGame,
    isPageVisible: document.visibilityState !== 'hidden',
  })),
)

// INIT

export const initialModel = (flags: Flags): Model => {
  const game = Option.getOrElse(flags.maybeGame, () => freshGame())
  return {
    game,
    holds: [],
    suppressedClickZones: [],
    recentChanges: {},
    nextSeq: 0,
    maybeHighRoll: Option.none(),
    isConfirmingNewGame: false,
    menuDialog: Dialog.init({ id: 'table-menu', isAnimated: true }),
    playerDialog: Dialog.init({ id: 'player-details', isAnimated: true }),
    maybeDialogPlayerId: Option.none(),
    isPageVisible: flags.isPageVisible,
    wakeLockStatus: game.settings.keepAwake ? 'Requesting' : 'Off',
    wakeLockAttempt: 0,
  }
}

export const init: Runtime.ApplicationInit<Model, Message, Flags> = flags => ({
  model: initialModel(flags),
})

