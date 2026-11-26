import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { Dialog } from '@foldkit/ui'

import {
  CommanderSlot,
  CounterKind,
  PlayerCount,
  PlayerId,
  PlayerRoll,
} from '../domain/game'
import { LayoutId } from '../domain/layout'
import { Direction, WakeLockStatus } from './model'

export const Message = defineMessageUnion({
  // Life zones
  PressedLifeZone: { playerId: PlayerId, direction: Direction },
  ReleasedLifeZone: { playerId: PlayerId, direction: Direction },
  LeftLifeZone: { playerId: PlayerId, direction: Direction },
  ClickedLifeZone: { playerId: PlayerId, direction: Direction },
  TickedHold: {},
  SuppressedContextMenu: {},
  ExpiredRecentChange: { playerId: PlayerId, seq: Schema.Number },

  // Dialogs
  ClickedMenu: {},
  ClickedPlayer: { playerId: PlayerId },
  GotMenuDialogMessage: { message: Dialog.Message },
  GotPlayerDialogMessage: { message: Dialog.Message },

  // Table settings
  SelectedPlayerCount: { count: PlayerCount },
  SelectedLayout: { layoutId: LayoutId },
  SelectedStartingLife: { life: Schema.Number },
  ToggledKeepAwake: { isOn: Schema.Boolean },
  ClickedNewGame: {},
  ClickedCancelNewGame: {},
  ClickedHighRoll: {},
  RolledHighRoll: { rolls: Schema.Array(PlayerRoll), winnerId: PlayerId },
  ExpiredHighRoll: { seq: Schema.Number },

  // Player details
  ClickedCounterStep: {
    playerId: PlayerId,
    kind: CounterKind,
    amount: Schema.Number,
  },
  ClickedCommanderDamageStep: {
    targetId: PlayerId,
    sourceId: PlayerId,
    slot: CommanderSlot,
    amount: Schema.Number,
  },
  ClickedCommanderCastStep: {
    playerId: PlayerId,
    slot: CommanderSlot,
    amount: Schema.Number,
  },
  ClickedLifeStep: { playerId: PlayerId, amount: Schema.Number },
  ToggledPartner: { playerId: PlayerId, isOn: Schema.Boolean },
  ClickedMonarch: { playerId: PlayerId },
  ClickedInitiative: { playerId: PlayerId },
  ChangedPlayerName: { playerId: PlayerId, name: Schema.String },
  SelectedColor: { playerId: PlayerId, color: Schema.String },

  // Effects
  SucceededSaveGame: {},
  FailedSaveGame: {},
  CompletedHaptic: {},
  ChangedPageVisibility: { isVisible: Schema.Boolean },
  ChangedWakeLockStatus: { status: WakeLockStatus },
})
export type Message = typeof Message.Type
