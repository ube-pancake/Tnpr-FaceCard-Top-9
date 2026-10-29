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

// "Neither" records a loss to this marker, which removes both characters from the sort. Anyone
// they had beaten is no longer held back by them and can come back into contention.
const NOBODY = '__nobody__'

// Moves the state forward until a real matchup is waiting, or the top list is full. A list can
// end short of TOP_COUNT when "Neither" removes too many characters.
const settle = (state, ids) => {
  let { round, next, index, ranked, lostTo, picks } = state
  const skipped = state.skipped || []
  const finish = (done) => ({ round, next, index, ranked, lostTo, picks, skipped, done })
  const removed = (id) => lostTo[id].includes(NOBODY)
  // Still in contention: unranked, not removed, and beaten only by ranked or removed characters.
  const contenders = () => {
    const rankedSet = new Set(ranked)
    const isContender = (id) => !rankedSet.has(id) && !removed(id) && lostTo[id].every((winner) => rankedSet.has(winner) || removed(winner))
    const winners = next.filter(isContender)
    return [...winners, ...ids.filter((id) => isContender(id) && !winners.includes(id))]
  }
  for (;;) {
    if (ranked.length >= Math.min(TOP_COUNT, ids.length)) return finish(true)
    if (index >= round.length) {
      // Round over. Without "Neither" the contenders are exactly this round's winners.
      let pool = contenders()
      if (pool.length === 1) {
        ranked = [...ranked, pool[0]]
        pool = contenders()
      }
      if (!pool.length) return finish(true)
      round = pool
      next = []
      index = 0
      continue
    }
    if (index + 1 >= round.length) {
      next = [...next, round[index]]
      index += 2
      continue
    }
    return finish(false)
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

// "Neither" removes both characters for good, so it's only allowed while enough are left to fill the
// top list with real picks. Without this, a player who skips a lot ends with just a #1 and #2.
export const canSkip = (state, ids) => {
  const target = Math.min(TOP_COUNT, ids.length)
  const rankedSet = new Set(state.ranked)
  const left = ids.filter((id) => !rankedSet.has(id) && !state.lostTo[id].includes(NOBODY)).length
  return left - 2 >= target - state.ranked.length
}

export const chooseNeither = (state, ids) => {
  const [a, b] = currentPair(state)
  const lostTo = { ...state.lostTo, [a]: [...state.lostTo[a], NOBODY], [b]: [...state.lostTo[b], NOBODY] }
  return settle({ ...state, lostTo, skipped: [...(state.skipped || []), a, b], index: state.index + 2, picks: state.picks + 1 }, ids)
}

// The finished list, topped up to TOP_COUNT (or everyone, for small teams) when "Neither" left it
// short. Characters brought back are ordered by how many matchups they won, then by skip order.
export const fillRanking = (state, ids) => {
  const target = Math.min(TOP_COUNT, ids.length)
  const ranked = state.ranked.slice(0, target)
  if (ranked.length >= target) return ranked
  const wins = Object.fromEntries(ids.map((id) => [id, 0]))
  Object.values(state.lostTo).forEach((winners) => winners.forEach((winner) => { if (winner in wins) wins[winner] += 1 }))
  const rankedSet = new Set(ranked)
  const skipOrder = state.skipped || []
  const rest = ids.filter((id) => !rankedSet.has(id))
  const order = (id) => (skipOrder.includes(id) ? skipOrder.indexOf(id) : -1)
  rest.sort((a, b) => wins[b] - wins[a] || order(a) - order(b))
  return [...ranked, ...rest.slice(0, target - ranked.length)]
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
