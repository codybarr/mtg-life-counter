import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Dialog, Input, Switch } from '@foldkit/ui'

import { Message } from '../app/message'
import type { Model, WakeLockStatus } from '../app/model'
import { currentLayout } from '../app/update'
import { SWATCHES } from '../domain/color'
import {
  COMMANDER_DAMAGE_LIMIT,
  COUNTER_KINDS,
  type Player,
  POISON_LIMIT,
  commanderDamageFrom,
  commanderSlotsOf,
  commanderTax,
  opponentsOf,
} from '../domain/game'
import { type Layout, type Rotation, isSideways, layoutsFor } from '../domain/layout'
import { cn } from '../ui/cn'
import { icon } from '../ui/icon'
import { button, sectionHeading } from '../ui/variants'
import { customColorPicker, segmentedGroup, stepper } from './controls'
import { COUNTER_META, dialogPlayer, rotationForPlayer } from './table'

// SHELL

const dialogShell = (
  render: Dialog.RenderInfo,
  rotation: Rotation,
  content: () => ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
): Html =>
  h.dialog(
    [
      ...render.dialog,
      h.Class(
        'm-0 h-dvh max-h-none w-dvw max-w-none overflow-hidden bg-transparent p-0 text-white open:flex items-center justify-center',
      ),
    ],
    render.isVisible
      ? [
          h.div([
            ...render.backdrop,
            h.Class(
              'fixed inset-0 bg-black/70 backdrop-blur-sm transition duration-200 ease-out data-[closed]:opacity-0',
            ),
          ]),
          h.div(
            [
              h.Class('relative'),
              h.Style({ transform: `rotate(${rotation}deg)` }),
            ],
            [
              h.div(
                [
                  ...render.panel,
                  h.Class(
                    cn(
                      'flex flex-col gap-5 overflow-y-auto overscroll-contain rounded-[1.75rem] bg-zinc-900/95 p-5 shadow-2xl ring-1 ring-white/10',
                      'transition duration-200 ease-out data-[closed]:translate-y-3 data-[closed]:scale-95 data-[closed]:opacity-0',
                      isSideways(rotation)
                        ? 'w-[min(30rem,92dvh)] max-h-[92dvw]'
                        : 'w-[min(30rem,94dvw)] max-h-[90dvh]',
                    ),
                  ),
                ],
                content(),
              ),
            ],
          ),
        ]
      : [],
  )

const dialogHeader = (
  render: Dialog.RenderInfo,
  title: ReadonlyArray<Html | string>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('flex items-center gap-3')],
    [
      h.h2(
        [...render.title, h.Class('flex min-w-0 flex-1 items-center gap-2 text-xl font-black')],
        title,
      ),
      h.button(
        [
          ...render.closeButton,
          h.AriaLabel('Close'),
          h.Class(button({ tone: 'ghost', size: 'icon' })),
        ],
        [icon('x', 'size-6')],
      ),
    ],
  )

const section = (
  heading: string,
  children: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [h.Class('flex flex-col gap-2.5')],
    [h.h3([h.Class(sectionHeading)], [heading]), ...children],
  )

// MENU DIALOG

const layoutPreview = (layout: Layout, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.AriaHidden(true),
      h.Class('grid h-16 w-10 gap-0.5'),
      h.Style({
        gridTemplateColumns: layout.columns,
        gridTemplateRows: layout.rows,
        gridTemplateAreas: layout.areas.map(row => `"${row}"`).join(' '),
      }),
    ],
    layout.seats.map(seat =>
      h.div(
        [
          h.Class('grid place-items-center rounded-[3px] bg-current/25'),
          h.Style({ gridArea: seat.area }),
        ],
        [
          h.div(
            [
              h.Class('h-0 w-0 border-x-[3px] border-b-[5px] border-x-transparent border-b-current'),
              // The arrow points at the edge the seat faces.
              h.Style({ transform: `rotate(${seat.rotation + 180}deg)` }),
            ],
            [],
          ),
        ],
      ),
    ),
  )

const WAKE_LOCK_TEXT: Readonly<Record<WakeLockStatus, string>> = {
  Off: 'Screen may sleep',
  Requesting: 'Keeping the screen on…',
  Active: 'Screen stays on while the app is open',
  Unsupported: 'Not supported in this browser',
  Failed: 'Tap the table to retry',
}

const menuContent = (
  model: Model,
  render: Dialog.RenderInfo,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const { settings } = model.game
  const layout = currentLayout(model)
  return [
    dialogHeader(render, [icon('users-group', 'size-6'), 'Table'], h),

    section(
      'Players',
      [
        segmentedGroup(
          'Number of players',
          ([2, 3, 4] as const).map(count => ({
            label: String(count),
            isSelected: settings.playerCount === count,
            message: Message.SelectedPlayerCount({ count }),
            className: 'text-lg',
          })),
          h,
        ),
      ],
      h,
    ),

    section(
      'Layout',
      [
        segmentedGroup(
          'Seating layout',
          layoutsFor(settings.playerCount).map(option => ({
            label: option.label,
            isSelected: option.id === layout.id,
            message: Message.SelectedLayout({ layoutId: option.id }),
            className: 'flex flex-col items-center gap-1.5 py-3',
            content: [
              layoutPreview(option, h),
              h.span([], [option.label]),
              h.span([h.Class('text-[11px] font-medium opacity-60')], [option.description]),
            ],
          })),
          h,
        ),
      ],
      h,
    ),

    section(
      'Starting life',
      [
        segmentedGroup(
          'Starting life',
          [20, 25, 30, 40].map(life => ({
            label: String(life),
            isSelected: settings.startingLife === life,
            message: Message.SelectedStartingLife({ life }),
            className: 'text-lg tabular-nums',
          })),
          h,
        ),
        h.p(
          [h.Class('text-xs text-white/50')],
          ['A game in progress keeps its totals; the new value applies on New game.'],
        ),
      ],
      h,
    ),

    Switch.view(
      {
        id: 'keep-awake',
        isChecked: settings.keepAwake,
        hasDescription: true,
        onToggle: isOn => Message.ToggledKeepAwake({ isOn }),
        toView: attributes =>
          h.div(
            [h.Class('flex items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10')],
            [
              icon('bulb', 'size-6 text-amber-300'),
              h.div(
                [h.Class('flex min-w-0 flex-1 flex-col')],
                [
                  h.span([...attributes.label, h.Class('font-semibold')], ['Keep screen awake']),
                  h.span(
                    [...attributes.description, h.Class('text-xs text-white/55')],
                    [WAKE_LOCK_TEXT[model.wakeLockStatus]],
                  ),
                ],
              ),
              switchTrack(attributes.button, settings.keepAwake, h),
            ],
          ),
      },
      h,
    ),

    h.div(
      [h.Class('grid grid-cols-2 gap-2')],
      [
        h.button(
          [
            h.Type('button'),
            h.Class(button({ size: 'md' })),
            h.OnClick(Message.ClickedHighRoll()),
          ],
          [icon('dice-5'), 'High roll'],
        ),
        model.isConfirmingNewGame
          ? h.div(
              [h.Class('flex gap-2')],
              [
                h.button(
                  [
                    h.Type('button'),
                    h.Class(cn(button({ tone: 'danger', size: 'md' }), 'flex-1')),
                    h.OnClick(Message.ClickedNewGame()),
                  ],
                  ['Reset'],
                ),
                h.button(
                  [
                    h.Type('button'),
                    h.AriaLabel('Cancel new game'),
                    h.Class(button({ tone: 'ghost', size: 'icon' })),
                    h.OnClick(Message.ClickedCancelNewGame()),
                  ],
                  [icon('x')],
                ),
              ],
            )
          : h.button(
              [
                h.Type('button'),
                h.Class(button({ tone: 'primary', size: 'md' })),
                h.OnClick(Message.ClickedNewGame()),
              ],
              [icon('refresh'), 'New game'],
            ),
      ],
    ),
  ]
}

const switchTrack = (
  buttonAttributes: Switch.SwitchAttributes<Message>['button'],
  isChecked: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  h.button(
    [
      ...buttonAttributes,
      h.Class(
        cn(
          'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors duration-200',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400',
          isChecked ? 'bg-emerald-500' : 'bg-white/20',
        ),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            cn(
              'size-6 rounded-full bg-white shadow transition-transform duration-200 ease-out',
              isChecked ? 'translate-x-6' : 'translate-x-0',
            ),
          ),
        ],
        [],
      ),
    ],
  )

// PLAYER DIALOG

const commanderDamageSection = (
  model: Model,
  player: Player,
  h: HtmlBuilder<Message>,
): Html => {
  const opponents = opponentsOf(model.game, player.id)
  return section(
    `Commander damage taken (lethal at ${COMMANDER_DAMAGE_LIMIT})`,
    [
      h.p(
        [h.Class('-mt-1 text-xs text-white/50')],
        ['Also subtracts from life. Removing it gives the life back.'],
      ),
      ...Array.flatMap(opponents, source =>
        commanderSlotsOf(source).map(slot => {
          const amount = commanderDamageFrom(player, source.id, slot)
          return stepper(
            {
              id: `cmd-${player.id}-${source.id}-${slot}`,
              label:
                slot === 0
                  ? `From ${source.name}`
                  : `From ${source.name} (partner)`,
              value: amount,
              accentColor: source.color,
              isWarning: amount >= COMMANDER_DAMAGE_LIMIT,
              onStep: step =>
                Message.ClickedCommanderDamageStep({
                  targetId: player.id,
                  sourceId: source.id,
                  slot,
                  amount: step,
                }),
            },
            h,
          )
        }),
      ),
    ],
    h,
  )
}

const playerContent = (
  model: Model,
  player: Player,
  render: Dialog.RenderInfo,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const isMonarch = Option.contains(model.game.maybeMonarchId, player.id)
  const hasInitiative = Option.contains(model.game.maybeInitiativeId, player.id)
  return [
    dialogHeader(
      render,
      [
        h.span(
          [
            h.AriaHidden(true),
            h.Class('size-5 shrink-0 rounded-full ring-2 ring-white/60'),
            h.Style({ backgroundColor: player.color }),
          ],
          [],
        ),
        h.span([h.Class('truncate')], [player.name]),
      ],
      h,
    ),

    Input.view(
      {
        id: `name-${player.id}`,
        value: player.name,
        onInput: name => Message.ChangedPlayerName({ playerId: player.id, name }),
        toView: attributes =>
          h.label(
            [h.Class('flex flex-col gap-1.5')],
            [
              h.span([...attributes.label, h.Class(sectionHeading)], ['Name']),
              h.input([
                ...attributes.input,
                h.Attribute('maxlength', '24'),
                h.Attribute('autocomplete', 'off'),
                h.Attribute('enterkeyhint', 'done'),
                h.Class(
                  'h-12 rounded-xl bg-white/10 px-4 text-lg font-semibold text-white ring-1 ring-white/15 placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400',
                ),
              ]),
            ],
          ),
      },
      h,
    ),

    section(
      'Life',
      [
        h.div(
          [h.Class('flex items-center gap-2')],
          [
            ...[-5, -1].map(amount => lifeStepButton(player, amount, h)),
            h.output(
              [
                h.AriaLive('polite'),
                h.AriaLabel(`${player.life} life`),
                h.Class('flex-1 text-center text-4xl font-black tabular-nums'),
              ],
              [String(player.life)],
            ),
            ...[1, 5].map(amount => lifeStepButton(player, amount, h)),
          ],
        ),
      ],
      h,
    ),

    commanderDamageSection(model, player, h),

    section(
      'Counters',
      [
        h.div(
          [h.Class('grid grid-cols-1 gap-2 min-[380px]:grid-cols-2')],
          COUNTER_KINDS.map(kind =>
            stepper(
              {
                id: `counter-${player.id}-${kind}`,
                label:
                  kind === 'poison'
                    ? `${COUNTER_META[kind].label} (of ${POISON_LIMIT})`
                    : COUNTER_META[kind].label,
                iconName: COUNTER_META[kind].iconName,
                value: player.counters[kind],
                isWarning: kind === 'poison' && player.counters.poison >= POISON_LIMIT,
                onStep: amount =>
                  Message.ClickedCounterStep({ playerId: player.id, kind, amount }),
              },
              h,
            ),
          ),
        ),
      ],
      h,
    ),

    section(
      'Commander tax',
      [
        ...commanderSlotsOf(player).map(slot =>
          stepper(
            {
              id: `tax-${player.id}-${slot}`,
              label: slot === 0 ? 'Casts from command zone' : 'Partner casts',
              iconName: 'coins',
              value: player.commanderCasts[slot],
              detail: `+${commanderTax(player, slot)} mana`,
              onStep: amount =>
                Message.ClickedCommanderCastStep({ playerId: player.id, slot, amount }),
            },
            h,
          ),
        ),
        Switch.view(
          {
            id: `partner-${player.id}`,
            isChecked: player.hasPartner,
            onToggle: isOn => Message.ToggledPartner({ playerId: player.id, isOn }),
            toView: attributes =>
              h.div(
                [h.Class('flex items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10')],
                [
                  h.span(
                    [...attributes.label, h.Class('flex-1 font-semibold')],
                    ['Partner commanders'],
                  ),
                  switchTrack(attributes.button, player.hasPartner, h),
                ],
              ),
          },
          h,
        ),
      ],
      h,
    ),

    section(
      'Designations',
      [
        h.div(
          [h.Class('grid grid-cols-2 gap-2')],
          [
            designationButton(
              'Monarch',
              'crown',
              isMonarch,
              Message.ClickedMonarch({ playerId: player.id }),
              h,
            ),
            designationButton(
              'Initiative',
              'building-castle',
              hasInitiative,
              Message.ClickedInitiative({ playerId: player.id }),
              h,
            ),
          ],
        ),
      ],
      h,
    ),

    section(
      'Color',
      [
        h.div(
          [h.Role('group'), h.AriaLabel('Player color'), h.Class('grid grid-cols-6 gap-2')],
          SWATCHES.map(swatch =>
            h.button(
              [
                h.Type('button'),
                h.AriaLabel(swatch.name),
                h.AriaPressed(String(player.color === swatch.hex)),
                h.Class(
                  cn(
                    'grid aspect-square place-items-center rounded-full ring-2 ring-white/10 transition active:scale-90',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400',
                    player.color === swatch.hex && 'ring-4 ring-white',
                  ),
                ),
                h.Style({ backgroundColor: swatch.hex }),
                h.OnClick(Message.SelectedColor({ playerId: player.id, color: swatch.hex })),
              ],
              [
                player.color === swatch.hex
                  ? icon('check', cn('size-5', swatch.hex === '#e9dcc0' ? 'text-zinc-900' : 'text-white'))
                  : h.empty,
              ],
            ),
          ),
        ),
        h.div(
          [h.Class('flex items-center gap-3')],
          [
            icon('palette', 'size-5 text-white/60'),
            customColorPicker(
              {
                id: `custom-color-${player.id}`,
                value: player.color,
                label: 'Custom color',
                onChange: color => Message.SelectedColor({ playerId: player.id, color }),
              },
              h,
            ),
          ],
        ),
      ],
      h,
    ),
  ]
}

const lifeStepButton = (player: Player, amount: number, h: HtmlBuilder<Message>): Html =>
  h.button(
    [
      h.Type('button'),
      h.AriaLabel(`${amount > 0 ? 'Gain' : 'Lose'} ${Math.abs(amount)} life`),
      h.Class(cn(button({ size: 'icon' }), 'tabular-nums')),
      h.OnClick(Message.ClickedLifeStep({ playerId: player.id, amount })),
    ],
    [amount > 0 ? `+${amount}` : `${amount}`],
  )

const designationButton = (
  label: string,
  iconName: 'crown' | 'building-castle',
  isHeld: boolean,
  message: Message,
  h: HtmlBuilder<Message>,
): Html =>
  h.button(
    [
      h.Type('button'),
      h.AriaPressed(String(isHeld)),
      h.Class(
        cn(
          button({ size: 'md' }),
          isHeld && 'bg-amber-400 text-zinc-950 hover:bg-amber-300',
        ),
      ),
      h.OnClick(message),
    ],
    [icon(iconName), label],
  )

// VIEWS

export const menuDialogView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.submodel({
    slotId: model.menuDialog.id,
    model: model.menuDialog,
    view: Dialog.view,
    viewInputs: {
      toView: (render: Dialog.RenderInfo) =>
        dialogShell(render, 0, () => menuContent(model, render, h), h),
    },
    toParentMessage: message => Message.GotMenuDialogMessage({ message }),
  })

export const playerDialogView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.submodel({
    slotId: model.playerDialog.id,
    model: model.playerDialog,
    view: Dialog.view,
    viewInputs: {
      toView: (render: Dialog.RenderInfo) =>
        Option.match(dialogPlayer(model), {
          onNone: () => dialogShell(render, 0, () => [], h),
          onSome: player =>
            dialogShell(
              render,
              rotationForPlayer(model, player.id),
              () => playerContent(model, player, render, h),
              h,
            ),
        }),
    },
    toParentMessage: message => Message.GotPlayerDialogMessage({ message }),
  })
