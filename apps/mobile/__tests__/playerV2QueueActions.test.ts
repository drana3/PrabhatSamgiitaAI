import { describe, expect, it, vi } from "vitest"

import { createQueueActions } from "@/lib/playerV2/queueActions"

function setup(numbers: number[], current: number | null = 2, random = false) {
  const state = { numbers, current, random, original: null as number[] | null }
  const replaceQueue = vi.fn((next: number[]) => {
    state.numbers = next
  })
  const actions = createQueueActions({
    getQueue: () => ({ numbers: state.numbers, current: state.current, random: state.random }),
    replaceQueue,
    getShuffleOriginal: () => state.original,
    setShuffleOriginal: (q) => {
      state.original = q
    },
    rng: () => 0.2,
  })
  return { state, actions, replaceQueue }
}

describe("queue actions", () => {
  it("reorders, removes, adds and plays next", () => {
    const { state, actions } = setup([1, 2, 3, 4])
    actions.reorder(0, 3)
    expect(state.numbers).toEqual([2, 3, 4, 1])
    actions.remove(3)
    expect(state.numbers).toEqual([2, 4, 1])
    actions.add(9)
    expect(state.numbers).toEqual([2, 4, 1, 9])
    actions.playNext(9)
    expect(state.numbers).toEqual([2, 9, 4, 1])
    actions.setOrder([1, 2])
    expect(state.numbers).toEqual([1, 2])
  })

  it("clears everything after the current song", () => {
    const { state, actions } = setup([1, 2, 3, 4], 2)
    actions.clearUpcoming()
    expect(state.numbers).toEqual([1, 2])
  })

  it("shuffles the upcoming songs and restores the order when switched off", () => {
    const { state, actions } = setup([1, 2, 3, 4, 5, 6], 2)
    expect(actions.toggleShuffle()).toBe(true)
    expect(state.numbers.slice(0, 2)).toEqual([1, 2])
    expect([...state.numbers].sort()).toEqual([1, 2, 3, 4, 5, 6])
    expect(state.original).toEqual([1, 2, 3, 4, 5, 6])
    expect(actions.toggleShuffle()).toBe(false)
    expect(state.numbers).toEqual([1, 2, 3, 4, 5, 6])
    expect(state.original).toBeNull()
  })

  it("keeps a removal made while shuffled when the order is restored", () => {
    const { state, actions } = setup([1, 2, 3, 4], 1)
    actions.toggleShuffle()
    actions.remove(3)
    actions.toggleShuffle()
    expect(state.numbers).toEqual([1, 2, 4])
  })

  it("does not shuffle a drive random session", () => {
    const { actions, replaceQueue } = setup([1, 2, 3], 1, true)
    expect(actions.toggleShuffle()).toBe(false)
    expect(replaceQueue).not.toHaveBeenCalled()
  })
})
