import { createStore } from 'vuex'

const store = createStore({
  state: {
    players: [
      { id: 1, health: 20 },
      { id: 2, health: 20 },
    ],
  },
  getters: {
    player1: state => state.players.find(player => player.id === 1),
    player2: state => state.players.find(player => player.id === 2),
  },
  mutations: {
    increment(state, payload) {
      const chosenPlayer = state.players.find(
        player => player.id === payload.id
      )
      chosenPlayer.health++
    },
    decrement(state, payload) {
      const chosenPlayer = state.players.find(
        player => player.id === payload.id
      )
      chosenPlayer.health--
    },
    reset(state) {
      state.players = [
        { id: 1, health: 20 },
        { id: 2, health: 20 },
      ]
    },
  },
})

export default store
