import { useEffect, useState } from "react"

import { api } from "@/lib/client"
import { storyFromApi } from "@/lib/stories/fromApi"
import type { Story } from "@/lib/stories/types"

/** One answer per song for the session: `null` is a real "no story", an unfinished request is not stored. */
const answers = new Map<number, Story | null>()

/**
 * The story the catalogue has about this song (the stories API filtered by song number), or null. Real data only:
 * the first story that names the song; while it loads, and when the request fails, there is no story to show.
 */
export function useSongStory(songNumber: number | undefined): Story | null {
  const [story, setStory] = useState<Story | null>(() => (songNumber !== undefined ? (answers.get(songNumber) ?? null) : null))
  useEffect(() => {
    if (songNumber === undefined) {
      setStory(null)
      return
    }
    if (answers.has(songNumber)) {
      setStory(answers.get(songNumber) ?? null)
      return
    }
    let active = true
    setStory(null)
    void api.fetchStories({ songNumber, limit: 5 }).then((rows) => {
      if (!active) return
      const found = rows.map(storyFromApi).find((row) => row.songNumbers.includes(songNumber)) ?? null
      // a failed request comes back as an empty list too, so a miss is not remembered
      if (found) answers.set(songNumber, found)
      setStory(found)
    })
    return () => {
      active = false
    }
  }, [songNumber])
  return story
}
