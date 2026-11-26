import { describe, expect, test } from 'bun:test'

import { LAYOUTS, type LayoutId, seatEdges } from './layout'

const layout = (id: LayoutId) => {
  const found = LAYOUTS.find(candidate => candidate.id === id)
  if (!found) throw new Error(`no layout ${id}`)
  return found
}

describe('seatEdges', () => {
  test('face-off: the top seat owns the top edge, the bottom seat the bottom', () => {
    // p1 sits at the bottom, p2 at the top.
    expect(seatEdges(layout('duel-faceoff'), 0)).toEqual({
      top: false, right: true, bottom: true, left: true,
    })
    expect(seatEdges(layout('duel-faceoff'), 1)).toEqual({
      top: true, right: true, bottom: false, left: true,
    })
  })

  test('flanks: each seat owns one long side and both ends', () => {
    expect(seatEdges(layout('duel-flanks'), 0)).toEqual({
      top: true, right: false, bottom: true, left: true,
    })
    expect(seatEdges(layout('duel-flanks'), 1)).toEqual({
      top: true, right: true, bottom: true, left: false,
    })
  })

  test('round table: the middle seats touch only their own side', () => {
    // areas: 'b b' / 'a c' / 'd d'
    expect(seatEdges(layout('quad-cross'), 0)).toEqual({
      top: false, right: false, bottom: false, left: true,
    })
    expect(seatEdges(layout('quad-cross'), 1)).toEqual({
      top: true, right: true, bottom: false, left: true,
    })
  })

  test('a seat index past the layout touches nothing', () => {
    expect(seatEdges(layout('duel-faceoff'), 5)).toEqual({
      top: false, right: false, bottom: false, left: false,
    })
  })
})
