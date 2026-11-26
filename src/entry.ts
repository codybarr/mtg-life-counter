import { Runtime } from 'foldkit'

import '@awesome.me/webawesome/dist/styles/themes/default.css'
import '@awesome.me/webawesome/dist/components/color-picker/color-picker.js'

import { Flags, Model, flags, init, subscriptions, update, view } from './main'
import { registerServiceWorker } from './pwa'

const LAYOUT_MESSAGES = new Set(['SelectedLayout', 'SelectedPlayerCount'])

const application = Runtime.makeApplication({
  Model,
  Flags,
  init,
  update,
  view,
  subscriptions,
  container: document.getElementById('root'),
  // Seats carry view-transition names, so a layout change morphs each
  // player's panel into its new seat.
  viewTransition: ({ message }) => LAYOUT_MESSAGES.has(message._tag),
})

Runtime.run(application, { flags })

registerServiceWorker()
