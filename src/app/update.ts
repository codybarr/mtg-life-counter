import { Array, Option, pipe } from 'effect'
import { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { Dialog } from '@foldkit/ui'

import {
  type Game,
  type PlayerId,
  activePlayers,
  adjustCommanderCasts,
  adjustCommanderDamage,
  adjustCounter,
  adjustLife,
  changePlayerCount,
  restartGame,
  toggleHolder,
  togglePartner,
  updatePlayer,
} from '../domain/game'
import { normalizeHex } from '../domain/color'
import { resolveLayout } from '../domain/layout'
import {
  DelayedHaptic,
  ExpireHighRoll,
  ExpireRecentChange,
  Haptic,
  RollHighRoll,
  SaveGame,
} from './command'
import { Message } from './message'
import {
  type Direction,
  HIGH_ROLL_REVEAL_MS,
  HOLD_FIRST_REPEAT_TICKS,
  HOLD_REPEAT_EVERY_TICKS,
  HOLD_STEP,
  type Hold,
  type Model,
  TAP_STEP,
  zoneKey,
} from './model'

type UpdateReturn = Update.Return<Model, Message>

// DIALOG FOLDS

const ignoreDialogOutMessage = Dialog.OutMessage.match<
  Update.Step<Model, Message>
>({
  Opened: () => model => ({ model }),
  Closed: () => model => ({ model }),
})

const readMenuDialog = (model: Model) => Option.some(model.menuDialog)
const writeMenuDialog = (model: Model, menuDialog: Dialog.Model): Model =>
  modifyFields(model, {
    menuDialog: () => menuDialog,
    isConfirmingNewGame: () => false,
  })
const toMenuDialogMessage = (message: Dialog.Message): Message =>
  Message.GotMenuDialogMessage({ message })

const readPlayerDialog = (model: Model) => Option.some(model.playerDialog)
const writePlayerDialog = (model: Model, playerDialog: Dialog.Model): Model =>
  modifyFields(model, { playerDialog: () => playerDialog })
const toPlayerDialogMessage = (message: Dialog.Message): Message =>
  Message.GotPlayerDialogMessage({ message })

const foldMenuDialog = Update.foldChild({
  update: Dialog.update,
  read: readMenuDialog,
  write: writeMenuDialog,
  toParentMessage: toMenuDialogMessage,
  foldOutMessage: ignoreDialogOutMessage,
})
const openMenuDialog = Update.foldChildStep({
  update: Dialog.open,
  read: readMenuDialog,
  write: writeMenuDialog,
  toParentMessage: toMenuDialogMessage,
  foldOutMessage: ignoreDialogOutMessage,
})
const closeMenuDialog = Update.foldChildStep({
  update: Dialog.close,
  read: readMenuDialog,
  write: writeMenuDialog,
  toParentMessage: toMenuDialogMessage,
  foldOutMessage: ignoreDialogOutMessage,
})
const foldPlayerDialog = Update.foldChild({
  update: Dialog.update,
  read: readPlayerDialog,
  write: writePlayerDialog,
  toParentMessage: toPlayerDialogMessage,
  foldOutMessage: ignoreDialogOutMessage,
})
const openPlayerDialog = Update.foldChildStep({
  update: Dialog.open,
  read: readPlayerDialog,
  write: writePlayerDialog,
  toParentMessage: toPlayerDialogMessage,
  foldOutMessage: ignoreDialogOutMessage,
})

// LIFE CHANGES

/** Applies a life change and folds it into the player's recent-change
 *  bubble, scheduling the bubble to clear once changes stop. */
const changeLife = (
  model: Model,
  playerId: PlayerId,
  amount: number,
): UpdateReturn => {
  const seq = model.nextSeq
  const previous = model.recentChanges[playerId]?.amount ?? 0
  return {
    model: modifyFields(model, {
      game: game => adjustLife(game, playerId, amount),
      recentChanges: changes => ({
        ...changes,
        [playerId]: { amount: previous + amount, seq },
      }),
      nextSeq: next => next + 1,
    }),
    commands: [
      ExpireRecentChange({ playerId, seq }),
      Haptic({ durationMs: Math.abs(amount) >= HOLD_STEP ? 18 : 8 }),
    ],
  }
}

const isZone =
  (playerId: PlayerId, direction: Direction) =>
  (hold: Hold): boolean =>
    hold.playerId === playerId && hold.direction === direction

const removeHold = (
  model: Model,
  playerId: PlayerId,
  direction: Direction,
): Model =>
  modifyFields(model, {
    holds: holds => Array.filter(holds, hold => !isZone(playerId, direction)(hold)),
  })

const isRepeatTick = (ticks: number): boolean =>
  ticks >= HOLD_FIRST_REPEAT_TICKS &&
  (ticks - HOLD_FIRST_REPEAT_TICKS) % HOLD_REPEAT_EVERY_TICKS === 0

const tickHolds = (model: Model): UpdateReturn => {
  const ticked = Array.map(model.holds, hold =>
    modifyFields(hold, { ticks: ticks => ticks + 1 }),
  )
  const repeating = Array.filter(ticked, hold => isRepeatTick(hold.ticks))
  const withTicks = modifyFields(model, {
    holds: () =>
      Array.map(ticked, hold =>
        isRepeatTick(hold.ticks)
          ? modifyFields(hold, { repeats: repeats => repeats + 1 })
          : hold,
      ),
  })
  return Array.reduce(
    repeating,
    { model: withTicks } as UpdateReturn,
    (result, hold) => {
      const next = changeLife(
        result.model,
        hold.playerId,
        hold.direction * HOLD_STEP,
      )
      return {
        model: next.model,
        commands: [...(result.commands ?? []), ...(next.commands ?? [])],
      }
    },
  )
}

// GAME HELPERS

const isPristine = (game: Game): boolean =>
  Array.every(
    activePlayers(game),
    player =>
      player.life === game.settings.startingLife &&
      Object.values(player.counters).every(value => value === 0) &&
      Object.values(player.commanderDamage).every(value => value === 0) &&
      player.commanderCasts[0] === 0 &&
      player.commanderCasts[1] === 0,
  )

const withGame = (model: Model, f: (game: Game) => Game): UpdateReturn => ({
  model: modifyFields(model, { game: f }),
})

const clearTransient = (model: Model): Model =>
  modifyFields(model, {
    holds: () => [],
    suppressedClickZones: () => [],
    recentChanges: () => ({}),
    maybeHighRoll: () => Option.none(),
    isConfirmingNewGame: () => false,
  })

// UPDATE

const handle = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    PressedLifeZone: ({ playerId, direction }) => ({
      model: modifyFields(model, {
        holds: holds => [
          ...Array.filter(holds, hold => !isZone(playerId, direction)(hold)),
          { playerId, direction, ticks: 0, repeats: 0 },
        ],
        suppressedClickZones: zones =>
          Array.filter(zones, zone => zone !== zoneKey(playerId, direction)),
        wakeLockAttempt: attempt =>
          model.wakeLockStatus === 'Failed' ? attempt + 1 : attempt,
      }),
    }),

    ReleasedLifeZone: ({ playerId, direction }) => {
      const maybeHold = Array.findFirst(model.holds, isZone(playerId, direction))
      const didRepeat = Option.exists(maybeHold, hold => hold.repeats > 0)
      return {
        model: modifyFields(removeHold(model, playerId, direction), {
          suppressedClickZones: zones =>
            didRepeat ? [...zones, zoneKey(playerId, direction)] : zones,
        }),
      }
    },

    LeftLifeZone: ({ playerId, direction }) => ({
      model: removeHold(model, playerId, direction),
    }),

    ClickedLifeZone: ({ playerId, direction }) => {
      const key = zoneKey(playerId, direction)
      if (model.suppressedClickZones.includes(key)) {
        return {
          model: modifyFields(model, {
            suppressedClickZones: zones =>
              Array.filter(zones, zone => zone !== key),
          }),
        }
      }
      return changeLife(model, playerId, direction * TAP_STEP)
    },

    TickedHold: () => tickHolds(model),

    SuppressedContextMenu: () => ({ model }),

    ExpiredRecentChange: ({ playerId, seq }) => {
      const isLatest = model.recentChanges[playerId]?.seq === seq
      if (!isLatest) return { model }
      const { [playerId]: _expired, ...rest } = model.recentChanges
      return { model: modifyFields(model, { recentChanges: () => rest }) }
    },

    ClickedMenu: () => openMenuDialog(model),

    ClickedPlayer: ({ playerId }) =>
      openPlayerDialog(
        modifyFields(model, {
          maybeDialogPlayerId: () => Option.some(playerId),
        }),
      ),

    GotMenuDialogMessage: ({ message }) => foldMenuDialog(model, message),

    GotPlayerDialogMessage: ({ message }) => foldPlayerDialog(model, message),

    SelectedPlayerCount: ({ count }) =>
      withGame(model, game => changePlayerCount(game, count)),

    SelectedLayout: ({ layoutId }) =>
      withGame(model, game => ({
        ...game,
        settings: modifyFields(game.settings, { layoutId: () => layoutId }),
      })),

    SelectedStartingLife: ({ life }) =>
      withGame(model, game => {
        const withLife: Game = {
          ...game,
          settings: modifyFields(game.settings, { startingLife: () => life }),
        }
        return isPristine(game) ? restartGame(withLife) : withLife
      }),

    ToggledKeepAwake: ({ isOn }) => ({
      model: modifyFields(model, {
        game: game => ({
          ...game,
          settings: modifyFields(game.settings, { keepAwake: () => isOn }),
        }),
        wakeLockStatus: () => (isOn ? 'Requesting' : 'Off'),
      }),
    }),

    ClickedNewGame: () => {
      if (!model.isConfirmingNewGame) {
        return {
          model: modifyFields(model, { isConfirmingNewGame: () => true }),
        }
      }
      return closeMenuDialog(
        modifyFields(clearTransient(model), {
          game: restartGame,
        }),
      )
    },

    ClickedCancelNewGame: () => ({
      model: modifyFields(model, { isConfirmingNewGame: () => false }),
    }),

    ClickedHighRoll: () => {
      const closed = closeMenuDialog(model)
      return {
        model: closed.model,
        commands: [
          ...(closed.commands ?? []),
          RollHighRoll({
            playerIds: Array.map(activePlayers(model.game), ({ id }) => id),
          }),
        ],
      }
    },

    RolledHighRoll: ({ rolls, winnerId }) => {
      const seq = model.nextSeq
      return {
        model: modifyFields(model, {
          maybeHighRoll: () => Option.some({ rolls, winnerId, seq }),
          nextSeq: next => next + 1,
        }),
        commands: [
          ExpireHighRoll({ seq }),
          Haptic({ durationMs: 12 }),
          DelayedHaptic({ delayMs: HIGH_ROLL_REVEAL_MS, durationMs: 30 }),
        ],
      }
    },

    ExpiredHighRoll: ({ seq }) => ({
      model: modifyFields(model, {
        maybeHighRoll: maybe =>
          Option.filter(maybe, highRoll => highRoll.seq !== seq),
      }),
    }),

    ClickedCounterStep: ({ playerId, kind, amount }) =>
      withGame(model, game => adjustCounter(game, playerId, kind, amount)),

    ClickedCommanderDamageStep: ({ targetId, sourceId, slot, amount }) =>
      withGame(model, game =>
        adjustCommanderDamage(game, targetId, sourceId, slot, amount),
      ),

    ClickedCommanderCastStep: ({ playerId, slot, amount }) =>
      withGame(model, game => adjustCommanderCasts(game, playerId, slot, amount)),

    ClickedLifeStep: ({ playerId, amount }) =>
      changeLife(model, playerId, amount),

    ToggledPartner: ({ playerId, isOn }) =>
      withGame(model, game => {
        const isPartner = game.players.some(
          player => player.id === playerId && player.hasPartner,
        )
        return isPartner === isOn ? game : togglePartner(game, playerId)
      }),

    ClickedMonarch: ({ playerId }) =>
      withGame(model, game => ({
        ...game,
        maybeMonarchId: toggleHolder(game.maybeMonarchId, playerId),
      })),

    ClickedInitiative: ({ playerId }) =>
      withGame(model, game => ({
        ...game,
        maybeInitiativeId: toggleHolder(game.maybeInitiativeId, playerId),
      })),

    ChangedPlayerName: ({ playerId, name }) =>
      withGame(model, game =>
        updatePlayer(game, playerId, player =>
          modifyFields(player, { name: () => name.slice(0, 24) }),
        ),
      ),

    SelectedColor: ({ playerId, color }) =>
      withGame(model, game =>
        updatePlayer(game, playerId, player =>
          modifyFields(player, {
            color: current => normalizeHex(color, current),
          }),
        ),
      ),

    SucceededSaveGame: () => ({ model }),
    FailedSaveGame: () => ({ model }),
    CompletedHaptic: () => ({ model }),

    ChangedPageVisibility: ({ isVisible }) => ({
      model: modifyFields(model, {
        isPageVisible: () => isVisible,
        holds: holds => (isVisible ? holds : []),
      }),
    }),

    ChangedWakeLockStatus: ({ status }) => ({
      model: modifyFields(model, { wakeLockStatus: () => status }),
    }),
  })

/** Every Message goes through `handle`; any change to the persisted Game is
 *  saved afterwards, so no individual branch has to remember to. */
export const update = (model: Model, message: Message): UpdateReturn => {
  const result = handle(model, message)
  if (result.model.game === model.game) return result
  return {
    model: result.model,
    commands: [...(result.commands ?? []), SaveGame({ game: result.model.game })],
  }
}

/** The layout currently in effect for the Model's settings. */
export const currentLayout = (model: Model) =>
  pipe(model.game.settings, ({ layoutId, playerCount }) =>
    resolveLayout(layoutId, playerCount),
  )
