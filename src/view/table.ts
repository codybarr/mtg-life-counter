import { Array, Option, pipe } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Message } from '../app/message'
import { type Direction, type Model, zoneKey } from '../app/model'
import { currentLayout } from '../app/update'
import { inkFor } from '../domain/color'
import {
  COMMANDER_DAMAGE_LIMIT,
  type CounterKind,
  type Player,
  POISON_LIMIT,
  activePlayers,
  commanderDamageFrom,
  commanderSlotsOf,
  commanderTax,
  findPlayer,
  lossReason,
} from '../domain/game'
import { type Rotation, isSideways, seatRotation } from '../domain/layout'
import { cn } from '../ui/cn'
import { icon } from '../ui/icon'
import type { IconName } from '../ui/icons.generated'
import { chip } from '../ui/variants'

export const COUNTER_META: Readonly<
  Record<CounterKind, Readonly<{ label: string; iconName: IconName }>>
> = {
  poison: { label: 'Poison', iconName: 'droplet' },
  energy: { label: 'Energy', iconName: 'bolt' },
  experience: { label: 'Experience', iconName: 'star' },
  rad: { label: 'Rad', iconName: 'radioactive' },
  storm: { label: 'Storm', iconName: 'cloud-storm' },
  custom: { label: 'Counter', iconName: 'hash' },
}

const formatChange = (amount: number): string =>
  amount > 0 ? `+${amount}` : `${amount}`

const LOSS_TEXT = {
  Life: 'Out of life',
  Poison: 'Poisoned',
  Commander: 'Commander damage',
} as const

// LIFE ZONE

const lifeZone = (
  model: Model,
  player: Player,
  direction: Direction,
  h: HtmlBuilder<Message>,
): Html => {
  const isPressed = model.holds.some(
    hold => zoneKey(hold.playerId, hold.direction) === zoneKey(player.id, direction),
  )
  const payload = { playerId: player.id, direction }
  return h.button(
    [
      h.Type('button'),
      h.AriaLabel(
        `${direction === 1 ? 'Gain' : 'Lose'} life for ${player.name}. Hold for 10.`,
      ),
      h.DataAttribute('zone', direction === 1 ? 'plus' : 'minus'),
      h.Class(
        cn(
          'life-zone absolute inset-y-0 flex w-1/2 items-center',
          direction === 1 ? 'right-0 justify-end pr-[5cqw]' : 'left-0 justify-start pl-[5cqw]',
          'transition-colors duration-150',
          isPressed ? 'bg-black/15' : 'bg-transparent',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white/70',
        ),
      ),
      h.OnPointerDown((pointerType, mouseButton) =>
        pointerType === 'mouse' && mouseButton !== 0
          ? Option.none()
          : Option.some(Message.PressedLifeZone(payload)),
      ),
      h.OnPointerUp(() => Option.some(Message.ReleasedLifeZone(payload))),
      h.OnPointerLeave(() => Option.some(Message.LeftLifeZone(payload))),
      h.OnClick(Message.ClickedLifeZone(payload)),
      h.OnContextMenu(Message.SuppressedContextMenu()),
    ],
    [
      icon(
        direction === 1 ? 'plus' : 'minus',
        cn(
          'size-[clamp(1.25rem,9cqmin,3rem)] transition duration-150',
          isPressed ? 'scale-125 opacity-90' : 'opacity-45',
        ),
      ),
    ],
  )
}

// STATUS CHIPS

type Child = Html | string

type Chip = Readonly<{
  key: string
  label: string
  content: ReadonlyArray<Child>
  isDanger: boolean
}>

const statusChips = (model: Model, player: Player, h: HtmlBuilder<Message>): ReadonlyArray<Chip> => {
  const counterChips = Array.flatMap(
    ['poison', 'energy', 'experience', 'rad', 'storm', 'custom'] as const,
    (kind): ReadonlyArray<Chip> => {
      const value = player.counters[kind]
      if (value === 0) return []
      const meta = COUNTER_META[kind]
      const isDanger = kind === 'poison' && value >= POISON_LIMIT - 2
      return [{
        key: kind,
        label: `${meta.label} ${value}`,
        isDanger,
        content: [icon(meta.iconName, 'size-[1.1em]'), String(value)],
      }]
    },
  )

  const damageChips = Array.flatMap(activePlayers(model.game), source =>
    Array.flatMap(commanderSlotsOf(source), (slot): ReadonlyArray<Chip> => {
      const amount = commanderDamageFrom(player, source.id, slot)
      if (amount === 0 || source.id === player.id) return []
      return [{
        key: `cmd-${source.id}-${slot}`,
        label: `${amount} commander damage from ${source.name}`,
        isDanger: amount >= COMMANDER_DAMAGE_LIMIT - 5,
        content: [
          h.span(
            [
              h.AriaHidden(true),
              h.Class('size-[0.8em] rounded-full ring-1 ring-white/70'),
              h.Style({ backgroundColor: source.color }),
            ],
            [],
          ),
          icon('sword', 'size-[1.1em]'),
          String(amount),
        ],
      }]
    }),
  )

  const taxChips = Array.flatMap(commanderSlotsOf(player), (slot): ReadonlyArray<Chip> => {
    const tax = commanderTax(player, slot)
    if (tax === 0) return []
    return [{
      key: `tax-${slot}`,
      label: `Commander tax ${tax}`,
      isDanger: false,
      content: [icon('coins', 'size-[1.1em]'), `+${tax}`],
    }]
  })

  return [...damageChips, ...counterChips, ...taxChips]
}

// PANEL

const panelContent = (
  model: Model,
  player: Player,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const ink = inkFor(player.color)
  const maybeChange = Option.fromNullishOr(model.recentChanges[player.id])
  const maybeLoss = lossReason(player)
  const isMonarch = Option.contains(model.game.maybeMonarchId, player.id)
  const hasInitiative = Option.contains(model.game.maybeInitiativeId, player.id)
  const chips = statusChips(model, player, h)
  const trend = Option.match(maybeChange, {
    onNone: () => 'none',
    onSome: change => (change.amount >= 0 ? 'up' : 'down'),
  })

  return [
    lifeZone(model, player, -1, h),
    lifeZone(model, player, 1, h),

    // Life total and recent change
    h.div(
      [
        h.Class(
          'pointer-events-none absolute inset-0 flex flex-col items-center justify-center',
        ),
      ],
      [
        h.span(
          [
            h.AriaHidden(true),
            h.Class(
              cn(
                'text-[clamp(1rem,11cqmin,3.5rem)] font-extrabold tabular-nums leading-none drop-shadow transition duration-300 ease-out',
                Option.isSome(maybeChange)
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-[2cqmin] opacity-0',
              ),
            ),
          ],
          [
            Option.match(maybeChange, {
              onNone: () => ' ',
              onSome: change => formatChange(change.amount),
            }),
          ],
        ),
        h.div(
          [h.AriaLive('polite'), h.Class('flex flex-col items-center')],
          [
            h.keyed('span')(
              `${player.id}-life-${player.life}`,
              [
                h.AriaHidden(true),
                h.DataAttribute('testid', `life-${player.id}`),
                h.DataAttribute('trend', trend),
                h.Class(
                  'life-total font-black tabular-nums leading-[0.85] tracking-tight text-[min(44cqh,30cqw)]',
                ),
              ],
              [String(player.life)],
            ),
            h.span([h.Class('sr-only')], [`${player.name}: ${player.life} life`]),
          ],
        ),
        Option.match(maybeLoss, {
          onNone: () => h.empty,
          onSome: reason =>
            h.span(
              [
                h.Class(
                  'mt-[2cqmin] inline-flex items-center gap-1 rounded-full bg-black/40 px-3 py-1 text-[clamp(0.7rem,5cqmin,1.1rem)] font-bold text-white',
                ),
              ],
              [icon('skull', 'size-[1.2em]'), LOSS_TEXT[reason]],
            ),
        }),
      ],
    ),

    // Name pill
    h.div(
      [
        h.Class(
          'pointer-events-none absolute inset-x-0 top-0 flex justify-center p-[max(0.4rem,2.5cqmin)]',
        ),
      ],
      [
        h.button(
          [
            h.Type('button'),
            h.AriaLabel(`${player.name}: commander damage, counters and color`),
            h.AriaHasPopup('dialog'),
            h.Class(
              cn(
                'pointer-events-auto inline-flex max-w-[80%] items-center gap-1.5 rounded-full px-3 py-1.5',
                'text-[clamp(0.75rem,5cqmin,1.15rem)] font-bold transition active:scale-95',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current',
                ink === 'light' ? 'bg-black/25' : 'bg-white/40',
              ),
            ),
            h.OnClick(Message.ClickedPlayer({ playerId: player.id })),
          ],
          [
            isMonarch ? icon('crown', 'size-[1.2em] drop-shadow') : h.empty,
            hasInitiative ? icon('building-castle', 'size-[1.2em] drop-shadow') : h.empty,
            h.span([h.Class('truncate')], [player.name]),
            icon('pencil', 'size-[1em] opacity-60'),
          ],
        ),
      ],
    ),

    // Status chips
    h.div(
      [
        h.Class(
          'pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-1 p-[max(0.4rem,2.5cqmin)] text-[clamp(0.7rem,4.5cqmin,1rem)]',
        ),
      ],
      [
        h.button(
          [
            h.Type('button'),
            h.AriaLabel(
              chips.length === 0
                ? `Open counters for ${player.name}`
                : `Counters for ${player.name}: ${chips.map(({ label }) => label).join(', ')}`,
            ),
            h.AriaHasPopup('dialog'),
            h.Class(
              'pointer-events-auto flex flex-wrap items-center justify-center gap-1 rounded-full p-0.5 transition active:scale-95 focus-visible:outline-2 focus-visible:outline-current',
            ),
            h.OnClick(Message.ClickedPlayer({ playerId: player.id })),
          ],
          chips.length === 0
            ? [
                h.span(
                  [h.Class(chip({ ink }))],
                  [icon('sword', 'size-[1.1em]'), icon('droplet', 'size-[1.1em]')],
                ),
              ]
            : chips.map(item =>
                h.keyed('span')(
                  item.key,
                  [h.Class(cn(chip({ ink, isDanger: item.isDanger }), 'animate-chip-in'))],
                  item.content,
                ),
              ),
        ),
      ],
    ),
  ]
}

// HIGH ROLL

/** A d20 drawn face-on: a hexagon silhouette around the front triangle,
 *  with the edges that join them. */
const d20 = (h: HtmlBuilder<Message>): Html => {
  const hexagon = '50,3 91,26.5 91,73.5 50,97 9,73.5 9,26.5'
  const face = '50,22 76,68 24,68'
  const edges = [
    [50, 3, 50, 22], [9, 26.5, 50, 22], [91, 26.5, 50, 22],
    [9, 26.5, 24, 68], [91, 26.5, 76, 68], [9, 73.5, 24, 68],
    [91, 73.5, 76, 68], [50, 97, 24, 68], [50, 97, 76, 68],
  ]
  return h.svg(
    [
      h.AriaHidden(true),
      h.Attribute('viewBox', '0 0 100 100'),
      h.Class('absolute inset-0 size-full overflow-visible'),
    ],
    [
      h.polygon([h.Attribute('points', hexagon), h.Class('fill-white/10 stroke-white')], []),
      h.polygon([h.Attribute('points', face), h.Class('fill-black/35 stroke-white')], []),
      ...edges.map(([x1, y1, x2, y2]) =>
        h.line(
          [
            h.Attribute('x1', String(x1)),
            h.Attribute('y1', String(y1)),
            h.Attribute('x2', String(x2)),
            h.Attribute('y2', String(y2)),
            h.Class('stroke-white/70'),
          ],
          [],
        ),
      ),
    ],
  )
}

const highRollOverlay = (
  model: Model,
  player: Player,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(model.maybeHighRoll, {
    onNone: () => h.empty,
    onSome: highRoll => {
      const maybeRoll = Array.findFirst(highRoll.rolls, roll => roll.playerId === player.id)
      if (Option.isNone(maybeRoll)) return h.empty
      const roll = maybeRoll.value.roll
      const isWinner = highRoll.winnerId === player.id
      const seatIndex = activePlayers(model.game).findIndex(({ id }) => id === player.id)
      return h.keyed('div')(
        `high-roll-${highRoll.seq}`,
        [
          h.Role('status'),
          h.DataAttribute('testid', `high-roll-${player.id}`),
          h.DataAttribute('winner', String(isWinner)),
          h.Class(
            cn(
              'high-roll pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-[3cqmin] bg-black/80 text-white backdrop-blur-xl',
              isWinner ? 'is-winner' : 'is-loser',
            ),
          ),
          // Alternate the spin so neighbouring dice tumble in opposite ways.
          h.Style({ '--spin': seatIndex % 2 === 0 ? '1' : '-1' }),
        ],
        [
          h.div(
            [h.Class('high-roll-die relative grid size-[min(46cqmin,60cqh)] place-items-center')],
            [
              d20(h),
              h.span(
                [
                  h.AriaHidden(true),
                  h.Class('high-roll-cycle absolute inset-0 grid place-items-center high-roll-number pt-[16%] text-[min(17cqmin,22cqh)] font-black tabular-nums'),
                ],
                [],
              ),
              h.span(
                [
                  h.AriaHidden(true),
                  h.DataAttribute('testid', `roll-${player.id}`),
                  h.Class('high-roll-final absolute inset-0 grid place-items-center high-roll-number pt-[16%] text-[min(17cqmin,22cqh)] font-black tabular-nums'),
                ],
                [String(roll)],
              ),
            ],
          ),
          h.span(
            [
              h.Class(
                'high-roll-caption px-4 text-center text-[clamp(1rem,9cqmin,2.5rem)] font-black leading-tight drop-shadow',
              ),
            ],
            [isWinner ? `${player.name} goes first` : ' '],
          ),
          h.span(
            [h.Class('sr-only')],
            [`${player.name} rolled ${roll}${isWinner ? ' and goes first' : ''}`],
          ),
        ],
      )
    },
  })

const seatView = (
  model: Model,
  player: Player,
  seatArea: string,
  rotation: Rotation,
  h: HtmlBuilder<Message>,
): Html => {
  const sideways = isSideways(rotation)
  const ink = inkFor(player.color)
  const isOut = Option.isSome(lossReason(player))
  return h.keyed('section')(
    player.id,
    [
      h.AriaLabel(player.name),
      h.DataAttribute('testid', `seat-${player.id}`),
      h.Class('seat relative overflow-hidden rounded-[1.6rem] [container-type:size]'),
      h.Style({
        gridArea: seatArea,
        '--player': player.color,
        viewTransitionName: `seat-${player.id}`,
      }),
    ],
    [
      h.div(
        [
          h.Class(
            cn(
              'player-surface absolute left-1/2 top-1/2 select-none [container-type:size]',
              ink === 'light' ? 'text-white' : 'text-zinc-950',
              isOut && 'is-out',
            ),
          ),
          h.Style({
            width: sideways ? '100cqh' : '100cqw',
            height: sideways ? '100cqw' : '100cqh',
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          }),
        ],
        [...panelContent(model, player, h), highRollOverlay(model, player, h)],
      ),
    ],
  )
}

// TABLE

export const tableView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const layout = currentLayout(model)
  const players = activePlayers(model.game)
  return h.main(
    [
      h.Class('table-grid fixed inset-0 grid gap-1.5 bg-black'),
      h.Style({
        gridTemplateColumns: layout.columns,
        gridTemplateRows: layout.rows,
        gridTemplateAreas: layout.areas.map(row => `"${row}"`).join(' '),
      }),
    ],
    [
      h.h1([h.Class('sr-only')], ['MTG life counter']),
      ...Array.map(players, (player, index) =>
        seatView(
          model,
          player,
          pipe(
            Array.get(layout.seats, index),
            Option.map(seat => seat.area),
            Option.getOrElse(() => 'a'),
          ),
          seatRotation(layout, index),
          h,
        ),
      ),
      h.button(
        [
          h.Type('button'),
          h.AriaLabel('Table menu'),
          h.AriaHasPopup('dialog'),
          h.Class(
            cn(
              'absolute left-1/2 top-1/2 z-20 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full',
              'bg-zinc-950 text-white shadow-xl shadow-black/60 ring-[6px] ring-black transition duration-200',
              'hover:rotate-45 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400',
            ),
          ),
          h.OnClick(Message.ClickedMenu()),
        ],
        [icon('settings', 'size-7')],
      ),
    ],
  )
}

/** The seat rotation of a player in the current layout, used to turn that
 *  player's dialog toward them. */
export const rotationForPlayer = (model: Model, playerId: Player['id']): Rotation => {
  const layout = currentLayout(model)
  const index = activePlayers(model.game).findIndex(player => player.id === playerId)
  return index < 0 ? 0 : seatRotation(layout, index)
}

export const dialogPlayer = (model: Model): Option.Option<Player> =>
  Option.flatMap(model.maybeDialogPlayerId, id => findPlayer(model.game, id))
