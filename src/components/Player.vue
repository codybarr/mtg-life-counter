<template>
  <section
    :class="`${color} ${
      rotate && 'transform rotate-180'
    } flex items-center justify-center`"
  >
    <LifeCounter :player="player" />
  </section>
</template>

<script>
import LifeCounter from './LifeCounter.vue'

export default {
  components: {
    LifeCounter,
  },
  props: {
    color: String,
    rotate: Boolean,
    player: Object,
  },
}
</script>
