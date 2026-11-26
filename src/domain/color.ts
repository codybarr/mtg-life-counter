export type Swatch = Readonly<{ name: string; hex: string }>

export const SWATCHES: ReadonlyArray<Swatch> = [
  { name: 'Ember', hex: '#e8590c' },
  { name: 'Crimson', hex: '#c92a2a' },
  { name: 'Rose', hex: '#d6336c' },
  { name: 'Violet', hex: '#9c36b5' },
  { name: 'Indigo', hex: '#4c47d6' },
  { name: 'Azure', hex: '#1c7ed6' },
  { name: 'Teal', hex: '#0c8599' },
  { name: 'Forest', hex: '#2f9e44' },
  { name: 'Olive', hex: '#748e2a' },
  { name: 'Gold', hex: '#e0a000' },
  { name: 'Plains', hex: '#e9dcc0' },
  { name: 'Swamp', hex: '#343a40' },
]

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Normalizes `#abc`, `abc`, `#aabbcc` to lowercase `#aabbcc`. Returns the
 *  fallback for anything that is not a hex color. */
export const normalizeHex = (value: string, fallback: string): string => {
  const match = HEX.exec(value.trim())
  if (!match?.[1]) return fallback
  const digits = match[1].length === 3
    ? [...match[1]].map(digit => digit + digit).join('')
    : match[1]
  return `#${digits.toLowerCase()}`
}

const channel = (hex: string, offset: number): number => {
  const value = parseInt(hex.slice(1 + offset, 3 + offset), 16) / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance of a `#rrggbb` color. */
export const luminance = (hex: string): number =>
  0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 2) + 0.0722 * channel(hex, 4)

/** Panels at or above this luminance get dark ink. Strict WCAG "best
 *  contrast" would put black text on mid-tones like orange and blue, which
 *  reads worse at 100px+ life totals, so white wins until a color is
 *  genuinely light (gold, cream). */
const DARK_INK_LUMINANCE = 0.36

/** Ink that reads best on the given panel color. */
export const inkFor = (hex: string): 'light' | 'dark' =>
  luminance(normalizeHex(hex, '#000000')) >= DARK_INK_LUMINANCE ? 'dark' : 'light'

export const swatchName = (hex: string): string =>
  SWATCHES.find(swatch => swatch.hex === hex)?.name ?? 'Custom'
