import { Schema } from 'effect'
import { CustomElement } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Message } from '../app/message'
import { icon } from '../ui/icon'
import type { IconName } from '../ui/icons.generated'
import { cn } from '../ui/cn'
import { button, segment } from '../ui/variants'

// STEPPER

export type StepperConfig = Readonly<{
  id: string
  label: string
  value: number
  iconName?: IconName
  /** Text under the value, e.g. "+4 tax". */
  detail?: string
  isWarning?: boolean
  accentColor?: string
  onStep: (amount: number) => Message
}>

/** A labelled −/value/+ control. The value is announced politely so screen
 *  reader users hear each change without losing their place. */
export const stepper = (config: StepperConfig, h: HtmlBuilder<Message>): Html => {
  const labelId = `${config.id}-label`
  const stepButton = (amount: -1 | 1) =>
    h.button(
      [
        h.Type('button'),
        h.AriaLabel(`${amount < 0 ? 'Decrease' : 'Increase'} ${config.label}`),
        h.Class(button({ size: 'icon' })),
        h.OnClick(config.onStep(amount)),
      ],
      [icon(amount < 0 ? 'minus' : 'plus')],
    )
  // The label gets its own row above the buttons, so it never runs under
  // them in a narrow two-column grid.
  return h.div(
    [
      h.Role('group'),
      h.AriaLabelledBy(labelId),
      h.Class(
        cn(
          'flex flex-col gap-1 rounded-2xl bg-white/5 p-1.5 pt-2 ring-1 ring-white/10',
          config.isWarning && 'ring-2 ring-rose-400 bg-rose-500/10',
        ),
      ),
    ],
    [
      h.span(
        [
          h.Id(labelId),
          h.Class(
            'flex min-w-0 items-center justify-center gap-1 px-1 text-xs font-semibold leading-tight text-white/60',
          ),
        ],
        [
          config.accentColor
            ? h.span(
                [
                  h.AriaHidden(true),
                  h.Class('size-2.5 shrink-0 rounded-full ring-1 ring-white/40'),
                  h.Style({ backgroundColor: config.accentColor }),
                ],
                [],
              )
            : h.empty,
          config.iconName ? icon(config.iconName, 'size-3.5 shrink-0') : h.empty,
          h.span([h.Class('truncate')], [config.label]),
        ],
      ),
      h.div(
        [h.Class('flex items-center gap-2')],
        [
          stepButton(-1),
          h.div(
            [h.Class('flex min-w-0 flex-1 flex-col items-center leading-tight')],
            [
              h.output(
                [
                  h.AriaLive('polite'),
                  h.Class('text-2xl font-black tabular-nums text-white'),
                ],
                [String(config.value)],
              ),
              config.detail
                ? h.span(
                    [h.Class('text-[11px] font-semibold text-white/50')],
                    [config.detail],
                  )
                : h.empty,
            ],
          ),
          stepButton(1),
        ],
      ),
    ],
  )
}

// SEGMENTED GROUP

export type SegmentOption = Readonly<{
  label: string
  isSelected: boolean
  message: Message
  content?: ReadonlyArray<Html | string>
  className?: string
}>

export const segmentedGroup = (
  label: string,
  options: ReadonlyArray<SegmentOption>,
  h: HtmlBuilder<Message>,
  className?: string,
): Html =>
  h.div(
    [h.Role('group'), h.AriaLabel(label), h.Class(cn('flex gap-1.5', className))],
    options.map(option =>
      h.button(
        [
          h.Type('button'),
          h.AriaPressed(String(option.isSelected)),
          h.Class(cn(segment({ isSelected: option.isSelected }), option.className)),
          h.OnClick(option.message),
        ],
        option.content ?? [option.label],
      ),
    ),
  )

// WEB AWESOME COLOR PICKER

/** `<wa-color-picker>` from Web Awesome fills the gap @foldkit/ui leaves for
 *  free-form color selection. Its `change` event carries no detail, so the
 *  value is read from the element through the standard `OnChange` handler. */
export const waColorPicker = CustomElement.define({
  tag: 'wa-color-picker',
  properties: {
    value: Schema.String,
    label: Schema.String,
  },
  events: {},
})

export const customColorPicker = (
  config: Readonly<{
    id: string
    value: string
    label: string
    onChange: (value: string) => Message
  }>,
  h: HtmlBuilder<Message>,
): Html => {
  const picker = waColorPicker.withMessage(h)
  return picker([
    h.Id(config.id),
    picker.Value(config.value),
    picker.Label(config.label),
    h.Attribute('format', 'hex'),
    h.Attribute('size', 'l'),
    h.OnChange(config.onChange),
    h.Class('color-picker'),
  ])
}
