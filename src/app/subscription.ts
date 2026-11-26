import { Duration, Effect, Schema, Stream } from 'effect'
import { Dom, Subscription } from 'foldkit'

import { Message } from './message'
import { HOLD_TICK_MS, type Model, type WakeLockStatus } from './model'

type WakeLockHandle = Readonly<{ release: () => Promise<void> }>

const statusMessage = (status: WakeLockStatus) =>
  Message.ChangedWakeLockStatus({ status })

/** Holds a screen wake lock for as long as the Stream's scope is open. The
 *  browser drops the lock whenever the page is hidden, so the Subscription
 *  keys on page visibility and re-requests the lock each time the app comes
 *  back into focus. */
const wakeLockStream: Stream.Stream<Message> = Stream.unwrap(
  Effect.gen(function* () {
    if (!('wakeLock' in navigator)) {
      return Stream.make(statusMessage('Unsupported'))
    }
    const maybeHandle = yield* Effect.acquireRelease(
      Effect.tryPromise(
        (): Promise<WakeLockHandle> => navigator.wakeLock.request('screen'),
      ).pipe(Effect.option),
      maybe =>
        maybe._tag === 'Some'
          ? Effect.promise(() => maybe.value.release()).pipe(Effect.ignore)
          : Effect.void,
    )
    return maybeHandle._tag === 'Some'
      ? Stream.concat(Stream.make(statusMessage('Active')), Stream.never)
      : Stream.make(statusMessage('Failed'))
  }),
)

export const subscriptions = Subscription.make<Model, Message>()(entry => ({
  holdClock: entry(
    { isHolding: Schema.Boolean },
    {
      modelToDependencies: model => ({ isHolding: model.holds.length > 0 }),
      dependenciesToStream: ({ isHolding }) =>
        isHolding
          ? Stream.tick(Duration.millis(HOLD_TICK_MS)).pipe(
              Stream.drop(1),
              Stream.map(() => Message.TickedHold()),
            )
          : Stream.empty,
    },
  ),

  pageVisibility: Subscription.persistentEntry(
    Dom.streamFromEvent({
      target: document,
      type: 'visibilitychange',
      mapEvent: () =>
        Message.ChangedPageVisibility({
          isVisible: document.visibilityState === 'visible',
        }),
    }),
  ),

  wakeLock: entry(
    { shouldHold: Schema.Boolean, attempt: Schema.Number },
    {
      modelToDependencies: model => ({
        shouldHold: model.game.settings.keepAwake && model.isPageVisible,
        attempt: model.wakeLockAttempt,
      }),
      dependenciesToStream: ({ shouldHold }) =>
        shouldHold ? wakeLockStream : Stream.empty,
    },
  ),
}))
