<template>
  <div
    class="life-counter select-none h-full w-full text-white flex items-center"
  >
    <button
      class="w-full h-full active:bg-gray-800 focus:outline-none focus:ring-0 focus:bg-transparent text-6xl flex items-center justify-center"
      @click="decrement({ id: player.id })"
    >
      -
    </button>
    <!-- <div
      class="life-total w-full fill-current text-white flex items-center justify-center"
    >
      <svg viewBox="0 0 50 50" class="flex justify-center items-center">
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">
          {{ count }}
        </text>
      </svg>
    </div> -->
    <div
      class="life-total text-6xl leadning-none flex items-center justify-center"
    >
      {{ player.health }}
    </div>
    <button
      class="w-full h-full active:bg-gray-800 focus:outline-none focus:ring-0 focus:bg-transparent text-6xl flex items-center justify-center"
      @click="inc"
    >
      +
    </button>
    <audio ref="pop" class="hidden" src="./pop.m4a"></audio>
  </div>
</template>

<script>
import { mapMutations } from 'vuex'

export default {
  props: {
    player: Object,
  },
  methods: {
    ...mapMutations(['increment', 'decrement']),
    inc: function () {
      this.increment({ id: this.player.id })
      this.$refs.pop.currentTime = 0
      this.$refs.pop.play()
    },
  },
}
</script>

<style scoped>
.life-counter {
  display: grid;
  grid-template-columns: 25% 50% 25%;
}

.life-total {
  font-size: 22.5vw;
  touch-action: manipulation;
}
</style>
