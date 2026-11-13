import { useEffect, useState } from "react"

import { loadPianoRecordingIds, pianoRecordingIds, subscribePianoRecordingIds } from "@/lib/pianoNotes/shelf"

/** The ids of the recordings that have live piano notes (loaded once, shared, refreshed every two minutes at most). */
export function usePianoRecordingIds(): ReadonlySet<string> {
  const [ids, setIds] = useState(pianoRecordingIds)
  useEffect(() => {
    const off = subscribePianoRecordingIds(setIds)
    void loadPianoRecordingIds()
    return off
  }, [])
  return ids
}
