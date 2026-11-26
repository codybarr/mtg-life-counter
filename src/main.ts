import type { Document, HtmlBuilder } from 'foldkit/html'

import type { Message } from './app/message'
import type { Model } from './app/model'
import { menuDialogView, playerDialogView } from './view/dialogs'
import { tableView } from './view/table'

export { Model } from './app/model'
export { Message } from './app/message'
export { update } from './app/update'
export { subscriptions } from './app/subscription'
export { Flags, flags, init, initialModel } from './app/init'

// VIEW

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'MTG Life',
  body: h.div(
    [],
    [tableView(model, h), menuDialogView(model, h), playerDialogView(model, h)],
  ),
})
