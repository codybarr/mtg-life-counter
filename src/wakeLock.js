// test support
let isSupported = false

if ('wakeLock' in navigator) {
  isSupported = true
}

if (isSupported) {
  // create a reference for the wake lock
  let wakeLock = null

  // create an async function to request a wake lock
  const requestWakeLock = async () => {
    try {
      wakeLock = await navigator.wakeLock.request('screen')
      console.log('WakeLock active!')

      // listen for our release event
      wakeLock.onrelease = function (ev) {
        console.log('WakeLock released!', ev)
      }
    } catch (err) {
      // if wake lock request fails - usually system related, such as battery
      console.log('Unable to request wakeLock', err)
    }
  } // requestWakeLock()

  requestWakeLock()

  const handleVisibilityChange = () => {
    console.log('Tab switched!')
    if (wakeLock !== null && document.visibilityState === 'visible') {
      requestWakeLock()
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
}
