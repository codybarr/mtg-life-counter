import { type Html, inertHtml as ih } from 'foldkit/html'

import { ICON_NODES, type IconName } from './icons.generated'
import { cn } from './cn'

/** Renders a Tabler outline icon from its node data. Icons are decorative
 *  (aria-hidden); the control that holds one carries the accessible name. */
export const icon = (name: IconName, className = 'size-5'): Html =>
  ih.svg(
    [
      ih.AriaHidden(true),
      ih.Class(cn('shrink-0', className)),
      ih.Xmlns('http://www.w3.org/2000/svg'),
      ih.ViewBox('0 0 24 24'),
      ih.Fill('none'),
      ih.Stroke('currentColor'),
      ih.StrokeWidth('2'),
      ih.StrokeLinecap('round'),
      ih.StrokeLinejoin('round'),
    ],
    ICON_NODES[name].map(([tag, attributes]) =>
      svgChild(tag, attributes),
    ),
  )

const svgChild = (
  tag: string,
  attributes: Readonly<Record<string, string>>,
): Html => {
  const attrs = Object.entries(attributes).map(([key, value]) =>
    ih.Attribute(key, value),
  )
  switch (tag) {
    case 'circle':
      return ih.circle(attrs)
    case 'rect':
      return ih.rect(attrs)
    case 'line':
      return ih.line(attrs)
    case 'polyline':
      return ih.polyline(attrs)
    case 'polygon':
      return ih.polygon(attrs)
    case 'ellipse':
      return ih.ellipse(attrs)
    default:
      return ih.path(attrs)
  }
}
