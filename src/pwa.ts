/** Registers the offline service worker in production builds. Skipped on
 *  localhost so development and tests always load fresh code. */
export const registerServiceWorker = (): void => {
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname)
  if (isLocal || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('Service worker registration failed', error)
    })
  })
}

