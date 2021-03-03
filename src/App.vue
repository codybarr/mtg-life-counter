<template>
  <Main>
    <Player color="bg-blue-600" :player="player2" rotate />
    <Player color="bg-red-600" :player="player1" />
  </Main>
  <Controls />
</template>

<script>
import Main from './components/Main.vue'
import Player from './components/Player.vue'
import Controls from './components/Controls.vue'

import { mapGetters } from 'vuex'

export default {
  components: {
    Main,
    Player,
    Controls,
  },
  computed: {
    ...mapGetters(['player1', 'player2']),
  },
}
</script>

<style>
#app {
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
}
</style>
