import { Array, Option, Schema, pipe } from 'effect'

/** Degrees clockwise a seat's panel is turned so it faces the person sitting
 *  at that edge of a phone lying flat: 0 faces the bottom edge, 90 the left,
 *  180 the top, 270 the right. */
export const Rotation = Schema.Literals([0, 90, 180, 270])
export type Rotation = typeof Rotation.Type

export const LayoutId = Schema.Literals([
  'duel-faceoff',
  'duel-flanks',
  'trio-wedge',
  'trio-tee',
  'quad-sides',
  'quad-cross',
  'quad-rows',
])
export type LayoutId = typeof LayoutId.Type

export type Seat = Readonly<{
  /** CSS grid-area name. */
  area: string
  rotation: Rotation
}>

export type Layout = Readonly<{
  id: LayoutId
  label: string
  description: string
  playerCount: 2 | 3 | 4
  columns: string
  rows: string
  /** grid-template-areas rows, one string per row. */
  areas: ReadonlyArray<string>
  /** Seats in player order: seats[0] is p1, seats[1] is p2, and so on. */
  seats: ReadonlyArray<Seat>
}>

export const LAYOUTS: ReadonlyArray<Layout> = [
  {
    id: 'duel-faceoff',
    label: 'Face-off',
    description: 'Across the table',
    playerCount: 2,
    columns: '1fr',
    rows: '1fr 1fr',
    areas: ['b', 'a'],
    seats: [
      { area: 'a', rotation: 0 },
      { area: 'b', rotation: 180 },
    ],
  },
  {
    id: 'duel-flanks',
    label: 'Flanks',
    description: 'Phone sideways between you',
    playerCount: 2,
    columns: '1fr 1fr',
    rows: '1fr',
    areas: ['a b'],
    seats: [
      { area: 'a', rotation: 90 },
      { area: 'b', rotation: 270 },
    ],
  },
  {
    id: 'trio-wedge',
    label: 'Wedge',
    description: 'Two on the sides, one at the end',
    playerCount: 3,
    columns: '1fr 1fr',
    rows: '1.5fr 1fr',
    areas: ['a b', 'c c'],
    seats: [
      { area: 'a', rotation: 90 },
      { area: 'b', rotation: 270 },
      { area: 'c', rotation: 0 },
    ],
  },
  {
    id: 'trio-tee',
    label: 'Tee',
    description: 'One at the head, two on the sides',
    playerCount: 3,
    columns: '1fr 1fr',
    rows: '1fr 1.5fr',
    areas: ['a a', 'c b'],
    seats: [
      { area: 'a', rotation: 180 },
      { area: 'b', rotation: 270 },
      { area: 'c', rotation: 90 },
    ],
  },
  {
    id: 'quad-sides',
    label: 'Sides',
    description: 'Two down each long side',
    playerCount: 4,
    columns: '1fr 1fr',
    rows: '1fr 1fr',
    areas: ['a b', 'd c'],
    seats: [
      { area: 'a', rotation: 90 },
      { area: 'b', rotation: 270 },
      { area: 'c', rotation: 270 },
      { area: 'd', rotation: 90 },
    ],
  },
  {
    id: 'quad-cross',
    label: 'Round table',
    description: 'One at each edge',
    playerCount: 4,
    columns: '1fr 1fr',
    rows: '1fr 1.4fr 1fr',
    areas: ['b b', 'a c', 'd d'],
    seats: [
      { area: 'a', rotation: 90 },
      { area: 'b', rotation: 180 },
      { area: 'c', rotation: 270 },
      { area: 'd', rotation: 0 },
    ],
  },
  {
    id: 'quad-rows',
    label: 'Two pairs',
    description: 'Two at each short end',
    playerCount: 4,
    columns: '1fr 1fr',
    rows: '1fr 1fr',
    areas: ['b a', 'c d'],
    seats: [
      { area: 'a', rotation: 180 },
      { area: 'b', rotation: 180 },
      { area: 'c', rotation: 0 },
      { area: 'd', rotation: 0 },
    ],
  },
]

const DEFAULT_LAYOUTS: Readonly<Record<2 | 3 | 4, LayoutId>> = {
  2: 'duel-faceoff',
  3: 'trio-wedge',
  4: 'quad-sides',
}

export const defaultLayoutFor = (playerCount: 2 | 3 | 4): LayoutId =>
  DEFAULT_LAYOUTS[playerCount]

export const layoutsFor = (playerCount: 2 | 3 | 4): ReadonlyArray<Layout> =>
  Array.filter(LAYOUTS, layout => layout.playerCount === playerCount)

/** The layout for an id, falling back to the count's default when the id
 *  belongs to a different player count (for example, from stale storage). */
export const resolveLayout = (
  layoutId: LayoutId,
  playerCount: 2 | 3 | 4,
): Layout =>
  pipe(
    LAYOUTS,
    Array.findFirst(
      layout => layout.id === layoutId && layout.playerCount === playerCount,
    ),
    Option.orElse(() =>
      Array.findFirst(
        LAYOUTS,
        layout => layout.id === defaultLayoutFor(playerCount),
      ),
    ),
    Option.getOrThrow,
  )

export const seatRotation = (layout: Layout, seatIndex: number): Rotation =>
  pipe(
    Array.get(layout.seats, seatIndex),
    Option.map(seat => seat.rotation),
    Option.getOrElse((): Rotation => 0),
  )

export const isSideways = (rotation: Rotation): boolean =>
  rotation === 90 || rotation === 270
