import { cx } from 'class-variance-authority'
import { twMerge } from 'tailwind-merge'

type ClassValue = Parameters<typeof cx>[number]

/** Joins class values and resolves Tailwind conflicts (last one wins). */
export const cn = (...values: ReadonlyArray<ClassValue>): string =>
  twMerge(cx(...values))
