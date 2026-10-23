// Tournament-style top-N selection: knock out a bracket to find #1, then only
// players who never lost to an unranked player can be next. Needs ~N + (K-1)*log2(N) picks.

export const TOP_COUNT = 9

const shuffle = (items) => {
  const list = [...items]
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

// Moves the state forward until a real matchup is waiting, or the top list is full.
const settle = (state, ids) => {
  let { round, next, index, ranked, lostTo, picks } = state
  for (;;) {
    if (ranked.length >= Math.min(TOP_COUNT, ids.length)) return { round, next, index, ranked, lostTo, picks, done: true }
    if (index >= round.length) {
      if (next.length === 1) {
        ranked = [...ranked, next[0]]
        const rankedSet = new Set(ranked)
        round = ids.filter((id) => !rankedSet.has(id) && lostTo[id].every((winner) => rankedSet.has(winner)))
      } else {
        round = next
      }
      next = []
      index = 0
      if (round.length === 1) {
        next = round
        index = 1
      }
      continue
    }
    if (index + 1 >= round.length) {
      next = [...next, round[index]]
      index += 2
      continue
    }
    return { round, next, index, ranked, lostTo, picks, done: false }
  }
}

export const startSort = (ids) => {
  const lostTo = Object.fromEntries(ids.map((id) => [id, []]))
  return settle({ round: shuffle(ids), next: [], index: 0, ranked: [], lostTo, picks: 0 }, ids)
}

export const currentPair = (state) => (state.done ? null : [state.round[state.index], state.round[state.index + 1]])

export const choose = (state, ids, side) => {
  const [a, b] = currentPair(state)
  const winner = side === 0 ? a : b
  const loser = side === 0 ? b : a
  const lostTo = { ...state.lostTo, [loser]: [...state.lostTo[loser], winner] }
  return settle({ ...state, lostTo, next: [...state.next, winner], index: state.index + 2, picks: state.picks + 1 }, ids)
}

// Picks left to crown the current leader, plus roughly log2(unranked) - 1 picks for each later rank.
const remainingPicks = (state, count) => {
  const alive = state.round.length - state.index + state.next.length
  let remaining = Math.max(0, alive - 1)
  const target = Math.min(TOP_COUNT, count)
  for (let rank = state.ranked.length + 1; rank < target; rank += 1) {
    remaining += Math.max(0, Math.ceil(Math.log2(count - rank)) - 1)
  }
  return remaining
}

export const progress = (state, count) => {
  if (state.done) return 100
  return Math.min(99, Math.round((state.picks / (state.picks + remainingPicks(state, count))) * 100))
}
