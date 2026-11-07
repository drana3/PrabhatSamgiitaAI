import { useEffect, useState } from "react"

import { authorsApi } from "@/lib/authors/api"
import { SLUG_CHECK_DELAY_MS } from "@/lib/authors/constants"
import { localSlugProblem, normalizeSlug } from "@/lib/authors/slug"
import { errorKeyOf } from "@/stores/authorStore"

export type SlugState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; held: boolean }
  | { kind: "problem"; problem: string; suggestions: string[] }
  | { kind: "error"; key: string }

/**
 * Asks whether an address is free, a moment after the last keystroke. Problems that need no server (too short, odd
 * characters) are answered at once. `own` is the page's current address: asking about it is never a problem.
 * A late answer of an old address is thrown away.
 */
export function useSlugCheck(typed: string, own: string | null): SlugState {
  const slug = normalizeSlug(typed)
  const [state, setState] = useState<SlugState>({ kind: "idle" })

  useEffect(() => {
    if (!slug) {
      setState({ kind: "idle" })
      return undefined
    }
    if (own && slug === own) {
      setState({ kind: "ok", held: false })
      return undefined
    }
    const local = localSlugProblem(slug)
    if (local) {
      setState({ kind: "problem", problem: local, suggestions: [] })
      return undefined
    }
    let live = true
    setState({ kind: "checking" })
    const timer = setTimeout(() => {
      authorsApi()
        .checkSlug(slug)
        .then(
          (answer) => {
            if (!live) return
            setState(answer.available ? { kind: "ok", held: answer.held_for_review } : { kind: "problem", problem: answer.problem ?? "taken", suggestions: answer.suggestions })
          },
          (failure: unknown) => {
            if (live) setState({ kind: "error", key: errorKeyOf(failure) })
          },
        )
    }, SLUG_CHECK_DELAY_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [slug, own])

  return state
}
