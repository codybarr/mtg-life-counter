import { type VariantProps, cva } from 'class-variance-authority'

import { cn } from './cn'

export const button = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold select-none',
    'transition duration-150 ease-out active:scale-95',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400',
    'disabled:opacity-40 disabled:pointer-events-none',
  ],
  {
    variants: {
      tone: {
        neutral: 'bg-white/10 text-white hover:bg-white/15',
        primary: 'bg-sky-700 text-white hover:bg-sky-600',
        danger: 'bg-rose-600 text-white hover:bg-rose-500',
        ghost: 'bg-transparent text-white/80 hover:bg-white/10',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-base',
        icon: 'size-11 p-0',
        iconSm: 'size-9 p-0',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
)
export type ButtonVariants = VariantProps<typeof button>

/** A toggle in a segmented group. Pair with aria-pressed. */
export const segment = cva(
  [
    'flex-1 min-h-11 rounded-xl px-3 py-2 text-sm font-semibold select-none',
    'transition duration-150 ease-out active:scale-95',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400',
  ],
  {
    variants: {
      isSelected: {
        true: 'bg-white text-zinc-950 shadow-lg shadow-black/30',
        false: 'bg-white/8 text-white/80 hover:bg-white/12',
      },
    },
    defaultVariants: { isSelected: false },
  },
)

/** Small status pill on a player panel. */
export const chip = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold tabular-nums leading-none',
  {
    variants: {
      ink: {
        light: 'bg-black/25 text-white',
        dark: 'bg-white/45 text-zinc-950',
      },
      isDanger: {
        true: 'ring-2 ring-current',
        false: '',
      },
    },
    defaultVariants: { ink: 'light', isDanger: false },
  },
)

export const sectionHeading =
  'text-xs font-bold uppercase tracking-[0.14em] text-white/50'

export const surface = (className?: string): string =>
  cn('rounded-2xl bg-white/5 ring-1 ring-white/10', className)
