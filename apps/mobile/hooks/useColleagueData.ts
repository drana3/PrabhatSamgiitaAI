import { useEffect, useMemo, useState } from "react"

import { colleagueChartsOf, type ColleagueChart } from "@/lib/psColleagues/chords"
import { loadColleagueChords, loadColleagueDates, loadColleagueTranslations } from "@/lib/psColleagues/load"
import { colleagueTextsOf, type ColleagueText } from "@/lib/psColleagues/translations"
import type { WireChords, WireDates, WireTranslations } from "@/lib/psColleagues/types"

function useLoaded<T>(load: () => Promise<T>, enabled: boolean): T | null {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    if (!enabled) return
    let active = true
    void load().then(
      (value) => {
        if (active) setData(value)
      },
      () => {
        // a file that cannot be read means "nothing from the colleagues", never an error on the page
      },
    )
    return () => {
      active = false
    }
  }, [load, enabled])
  return data
}

/** The colleagues' translations of a song (empty while the file loads, and for a song they have none for). */
export function useColleagueTexts(songNumber: number | undefined, enabled = true): ColleagueText[] {
  const wire = useLoaded<WireTranslations>(loadColleagueTranslations, enabled && songNumber !== undefined)
  return useMemo(() => colleagueTextsOf(wire, songNumber), [wire, songNumber])
}

/** The colleagues' chord pages of a song that hold chord symbols (empty while the file loads). */
export function useColleagueCharts(songNumber: number | undefined, enabled = true): ColleagueChart[] {
  const wire = useLoaded<WireChords>(loadColleagueChords, enabled && songNumber !== undefined)
  return useMemo(() => colleagueChartsOf(wire, songNumber), [wire, songNumber])
}

/** The date lines the colleagues' documents write for a song, per language (empty while the file loads, and for a song they have none for). */
export function useColleagueDateLines(songNumber: number | undefined, enabled = true): NonNullable<WireDates[string]> {
  const wire = useLoaded<WireDates>(loadColleagueDates, enabled && songNumber !== undefined)
  return useMemo(() => (wire && songNumber !== undefined ? (wire[String(songNumber)] ?? {}) : {}), [wire, songNumber])
}
