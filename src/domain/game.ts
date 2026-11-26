import { Array, Option, Schema, pipe } from 'effect'
import { modifyFields } from 'foldkit/struct'

import { LayoutId, defaultLayoutFor } from './layout'

// PLAYER

export const PlayerId = Schema.Literals(['p1', 'p2', 'p3', 'p4'])
export type PlayerId = typeof PlayerId.Type

export const PLAYER_IDS: ReadonlyArray<PlayerId> = ['p1', 'p2', 'p3', 'p4']

export const CommanderSlot = Schema.Literals([0, 1])
export type CommanderSlot = typeof CommanderSlot.Type

/** Counters a player can accumulate beyond life. Poison is a loss condition;
 *  the rest are informational. */
export const CounterKind = Schema.Literals([
  'poison',
  'energy',
  'experience',
  'rad',
  'storm',
  'custom',
])
export type CounterKind = typeof CounterKind.Type

export const COUNTER_KINDS: ReadonlyArray<CounterKind> = [
  'poison',
  'energy',
  'experience',
  'rad',
  'storm',
  'custom',
]

export const Counters = Schema.Struct({
  poison: Schema.Number,
  energy: Schema.Number,
  experience: Schema.Number,
  rad: Schema.Number,
  storm: Schema.Number,
  custom: Schema.Number,
})
export type Counters = typeof Counters.Type

const ZERO_COUNTERS: Counters = {
  poison: 0,
  energy: 0,
  experience: 0,
  rad: 0,
  storm: 0,
  custom: 0,
}

/** Damage dealt to this player, keyed by `commanderKey(sourceId, slot)`. */
export const CommanderDamage = Schema.Record(Schema.String, Schema.Number)
export type CommanderDamage = typeof CommanderDamage.Type

export const Player = Schema.Struct({
  id: PlayerId,
  name: Schema.String,
  color: Schema.String,
  life: Schema.Number,
  counters: Counters,
  commanderDamage: CommanderDamage,
  /** Times each commander has been cast from the command zone. */
  commanderCasts: Schema.Tuple([Schema.Number, Schema.Number]),
  hasPartner: Schema.Boolean,
})
export type Player = typeof Player.Type

// SETTINGS

export const PlayerCount = Schema.Literals([2, 3, 4])
export type PlayerCount = typeof PlayerCount.Type

export const Settings = Schema.Struct({
  playerCount: PlayerCount,
  layoutId: LayoutId,
  startingLife: Schema.Number,
  keepAwake: Schema.Boolean,
})
export type Settings = typeof Settings.Type

// GAME

export const Game = Schema.Struct({
  settings: Settings,
  /** Always four seats, so names and colors survive a player-count change. */
  players: Schema.Tuple([Player, Player, Player, Player]),
  maybeMonarchId: Schema.Option(PlayerId),
  maybeInitiativeId: Schema.Option(PlayerId),
})
export type Game = typeof Game.Type

export const GameJson = Schema.fromJsonString(Schema.toCodecJson(Game))

// CONSTANTS

export const POISON_LIMIT = 10
export const COMMANDER_DAMAGE_LIMIT = 21
export const COMMANDER_TAX_PER_CAST = 2
export const MAX_LIFE = 999
export const MIN_LIFE = -999

export const DEFAULT_COLORS: Readonly<Record<PlayerId, string>> = {
  p1: '#e8590c',
  p2: '#1c7ed6',
  p3: '#2f9e44',
  p4: '#9c36b5',
}

export const DEFAULT_SETTINGS: Settings = {
  playerCount: 4,
  layoutId: defaultLayoutFor(4),
  startingLife: 40,
  keepAwake: true,
}

// CONSTRUCTORS

const playerNumber = (id: PlayerId): number => PLAYER_IDS.indexOf(id) + 1

export const freshPlayer = (id: PlayerId, startingLife: number): Player => ({
  id,
  name: `Player ${playerNumber(id)}`,
  color: DEFAULT_COLORS[id],
  life: startingLife,
  counters: ZERO_COUNTERS,
  commanderDamage: {},
  commanderCasts: [0, 0],
  hasPartner: false,
})

export const freshGame = (settings: Settings = DEFAULT_SETTINGS): Game => ({
  settings,
  players: [
    freshPlayer('p1', settings.startingLife),
    freshPlayer('p2', settings.startingLife),
    freshPlayer('p3', settings.startingLife),
    freshPlayer('p4', settings.startingLife),
  ],
  maybeMonarchId: Option.none(),
  maybeInitiativeId: Option.none(),
})

/** Starts a new game with the same seats, names, colors and partner setup. */
export const restartGame = (game: Game): Game => ({
  ...game,
  players: mapPlayers(game, player =>
    modifyFields(player, {
      life: () => game.settings.startingLife,
      counters: () => ZERO_COUNTERS,
      commanderDamage: () => ({}),
      commanderCasts: () => [0, 0] as const,
    }),
  ),
  maybeMonarchId: Option.none(),
  maybeInitiativeId: Option.none(),
})

// QUERIES

export const commanderKey = (sourceId: PlayerId, slot: CommanderSlot): string =>
  `${sourceId}:${slot}`

export const activePlayers = (game: Game): ReadonlyArray<Player> =>
  Array.take(game.players, game.settings.playerCount)

export const findPlayer = (game: Game, id: PlayerId): Option.Option<Player> =>
  Array.findFirst(game.players, player => player.id === id)

export const opponentsOf = (
  game: Game,
  id: PlayerId,
): ReadonlyArray<Player> =>
  Array.filter(activePlayers(game), player => player.id !== id)

export const commanderSlotsOf = (
  player: Player,
): ReadonlyArray<CommanderSlot> => (player.hasPartner ? [0, 1] : [0])

export const commanderDamageFrom = (
  player: Player,
  sourceId: PlayerId,
  slot: CommanderSlot,
): number => player.commanderDamage[commanderKey(sourceId, slot)] ?? 0

export const commanderTax = (player: Player, slot: CommanderSlot): number =>
  player.commanderCasts[slot] * COMMANDER_TAX_PER_CAST

export const highestCommanderDamage = (player: Player): number =>
  pipe(
    Object.values(player.commanderDamage),
    Array.reduce(0, (highest, amount) => Math.max(highest, amount)),
  )

export const LossReason = Schema.Literals(['Life', 'Poison', 'Commander'])
export type LossReason = typeof LossReason.Type

/** Why a player has lost, if they have. Checked in rules order: life, then
 *  poison, then commander damage. */
export const lossReason = (player: Player): Option.Option<LossReason> => {
  if (player.life <= 0) return Option.some('Life')
  if (player.counters.poison >= POISON_LIMIT) return Option.some('Poison')
  if (highestCommanderDamage(player) >= COMMANDER_DAMAGE_LIMIT) {
    return Option.some('Commander')
  }
  return Option.none()
}

// TRANSITIONS

const clampLife = (life: number): number =>
  Math.min(MAX_LIFE, Math.max(MIN_LIFE, life))

const clampCounter = (value: number): number => Math.max(0, Math.min(999, value))

const mapPlayers = (
  game: Game,
  f: (player: Player) => Player,
): Game['players'] => [
  f(game.players[0]),
  f(game.players[1]),
  f(game.players[2]),
  f(game.players[3]),
]

export const updatePlayer = (
  game: Game,
  id: PlayerId,
  f: (player: Player) => Player,
): Game => ({
  ...game,
  players: mapPlayers(game, player => (player.id === id ? f(player) : player)),
})

export const adjustLife = (game: Game, id: PlayerId, amount: number): Game =>
  updatePlayer(game, id, player =>
    modifyFields(player, { life: life => clampLife(life + amount) }),
  )

export const adjustCounter = (
  game: Game,
  id: PlayerId,
  kind: CounterKind,
  amount: number,
): Game =>
  updatePlayer(game, id, player =>
    modifyFields(player, {
      counters: counters => ({
        ...counters,
        [kind]: clampCounter(counters[kind] + amount),
      }),
    }),
  )

/** Commander damage is combat damage, so it also costs the target that much
 *  life. Removing commander damage (a misclick fix) gives the life back.
 *  The adjustment is clamped at zero, and life moves by the clamped amount. */
export const adjustCommanderDamage = (
  game: Game,
  targetId: PlayerId,
  sourceId: PlayerId,
  slot: CommanderSlot,
  amount: number,
): Game =>
  updatePlayer(game, targetId, player => {
    const key = commanderKey(sourceId, slot)
    const current = player.commanderDamage[key] ?? 0
    const next = clampCounter(current + amount)
    const applied = next - current
    return modifyFields(player, {
      commanderDamage: damage => ({ ...damage, [key]: next }),
      life: life => clampLife(life - applied),
    })
  })

export const adjustCommanderCasts = (
  game: Game,
  id: PlayerId,
  slot: CommanderSlot,
  amount: number,
): Game =>
  updatePlayer(game, id, player =>
    modifyFields(player, {
      commanderCasts: casts =>
        slot === 0
          ? [clampCounter(casts[0] + amount), casts[1]]
          : [casts[0], clampCounter(casts[1] + amount)],
    }),
  )

/** Turning partner off also clears the second commander's tax and the damage
 *  it dealt, since that commander no longer exists in the game. */
export const togglePartner = (game: Game, id: PlayerId): Game => {
  const toggled = updatePlayer(game, id, player =>
    modifyFields(player, {
      hasPartner: hasPartner => !hasPartner,
      commanderCasts: casts => (player.hasPartner ? [casts[0], 0] : casts),
    }),
  )
  const isNowPartner = Option.exists(
    findPlayer(toggled, id),
    player => player.hasPartner,
  )
  if (isNowPartner) return toggled

  const removedKey = commanderKey(id, 1)
  return {
    ...toggled,
    players: mapPlayers(toggled, player => {
      const { [removedKey]: _removed, ...rest } = player.commanderDamage
      return modifyFields(player, { commanderDamage: () => rest })
    }),
  }
}

export const toggleHolder = (
  maybeHolder: Option.Option<PlayerId>,
  id: PlayerId,
): Option.Option<PlayerId> =>
  Option.contains(maybeHolder, id) ? Option.none() : Option.some(id)

export const changePlayerCount = (game: Game, count: PlayerCount): Game => {
  const isStillSeated = (maybeId: Option.Option<PlayerId>) =>
    Option.filter(maybeId, id => PLAYER_IDS.indexOf(id) < count)
  return {
    ...game,
    settings: modifyFields(game.settings, {
      playerCount: () => count,
      layoutId: () => defaultLayoutFor(count),
    }),
    maybeMonarchId: isStillSeated(game.maybeMonarchId),
    maybeInitiativeId: isStillSeated(game.maybeInitiativeId),
  }
}

// HIGH ROLL

export const D20_SIDES = 20

export const PlayerRoll = Schema.Struct({ playerId: PlayerId, roll: Schema.Number })
export type PlayerRoll = typeof PlayerRoll.Type

/** The player with the single highest roll, or none when the top is tied. */
export const highRoller = (rolls: ReadonlyArray<PlayerRoll>): Option.Option<PlayerId> => {
  const top = Math.max(...rolls.map(({ roll }) => roll))
  const leaders = rolls.filter(({ roll }) => roll === top)
  return leaders.length === 1 && leaders[0]
    ? Option.some(leaders[0].playerId)
    : Option.none()
}
