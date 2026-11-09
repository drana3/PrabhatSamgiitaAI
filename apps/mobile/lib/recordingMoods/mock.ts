import { decideMood, UPLOADER_MOODS_MAX } from "./rules"
import type { MoodBackend, MoodFailure, MoodState, RecordingMoods, VoteValue } from "./types"
import { MOODS } from "@/lib/kirtan/moods"

/**
 * The in-memory stand-in for the mood API, used ONLY in the web preview (`EXPO_PUBLIC_MOCKUP_DATA=1`). Nothing reaches a
 * server and nothing survives a reload. It follows the real rules in short: the uploader suggests one or two moods, anybody
 * else votes, three "yes" confirm what the uploader suggested, five what only listeners proposed. Every recording starts with
 * one confirmed mood (Devotion) and one waiting for its third "yes" (Joyful), so the page shows both states.
 */
export class MoodMockFailure extends Error {
  readonly failure: MoodFailure
  constructor(failure: MoodFailure) {
    super(failure)
    this.name = "MoodMockFailure"
    this.failure = failure
  }
}

export function moodMockFailure(error: unknown): MoodFailure | null {
  return error instanceof MoodMockFailure ? error.failure : null
}

type Row = { status: MoodState["status"]; source: "uploader" | "listeners"; yes: number; no: number; mine: "yes" | "no" | null }

export function createMoodMock(options: { isMine: (id: string) => boolean; signedIn?: () => boolean }): MoodBackend {
  const rows = new Map<string, Map<string, Row>>()
  const rowsOf = (id: string) => {
    let found = rows.get(id)
    if (!found) {
      found = new Map<string, Row>([
        ["devotion", { status: "confirmed", source: "uploader", yes: 4, no: 0, mine: null }],
        ["joyful", { status: "suggested", source: "uploader", yes: 2, no: 0, mine: null }],
      ])
      rows.set(id, found)
    }
    return found
  }
  const fail = (failure: MoodFailure): never => {
    throw new MoodMockFailure(failure)
  }
  const page = (id: string): RecordingMoods => {
    const mine = options.isMine(id)
    const signedIn = options.signedIn?.() ?? true
    const own = rowsOf(id)
    return {
      recordingId: id,
      moods: MOODS.map((mood): MoodState => {
        const row = own.get(mood)
        return row
          ? { mood, status: row.status, source: row.source, locked: false, yes: row.yes, no: row.no, mine: row.mine }
          : { mood, status: "none", source: null, locked: false, yes: 0, no: 0, mine: null }
      }),
      canVote: signedIn && !mine,
      cannotVoteBecause: !signedIn ? "sign_in" : mine ? "own" : null,
      canSuggest: mine,
      needed: { uploader: 3, listeners: 5 },
    }
  }
  return {
    confirmed: async () => ({}),
    recording: async (id) => page(id),
    suggest: async (id, moods) => {
      if (!options.isMine(id)) fail("not_uploader")
      if (moods.length > UPLOADER_MOODS_MAX) fail("too_many")
      const own = rowsOf(id)
      for (const [mood, row] of [...own]) if (!moods.includes(mood) && row.source === "uploader" && row.status === "suggested") own.delete(mood)
      for (const mood of moods) if (!own.has(mood)) own.set(mood, { status: "suggested", source: "uploader", yes: 0, no: 0, mine: null })
    },
    vote: async (id, mood, value: VoteValue) => {
      if (options.isMine(id)) fail("own_recording")
      const own = rowsOf(id)
      let row = own.get(mood)
      if (!row) {
        if (value !== "yes") return fail("failed")
        row = { status: "suggested", source: "listeners", yes: 0, no: 0, mine: null }
        own.set(mood, row)
      }
      if (row.mine === "yes") row.yes -= 1
      if (row.mine === "no") row.no -= 1
      row.mine = value === "clear" ? null : value
      if (row.mine === "yes") row.yes += 1
      if (row.mine === "no") row.no += 1
      row.status = decideMood(row.source, row.yes, row.no)
      if (row.yes + row.no === 0 && row.source === "listeners") own.delete(mood)
    },
  }
}
