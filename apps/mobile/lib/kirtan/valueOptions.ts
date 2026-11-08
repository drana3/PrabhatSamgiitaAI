import { useEffect, useState } from "react"

import { canUseServer, remoteConfig } from "@/lib/kirtan/api"
import { NEW_WORDS_PER_WEEK } from "@/lib/kirtan/instruments"
import { fetchValueOptions, type ValueOptions } from "@/lib/kirtan/remote"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * The words the team accepted under "Add your own" (docs/kiirtan-recording-info.md). The form offers them as picks after the
 * fixed list. Read once per screen; when the server is not there (offline, preview) the form simply offers the fixed list.
 */
export function useValueOptions(field: "instrument" | "style", enabled = true): ValueOptions {
  const [options, setOptions] = useState<ValueOptions>({ accepted: [], newWordsPerWeek: NEW_WORDS_PER_WEEK })
  useEffect(() => {
    if (!enabled || MOCKUP_DATA || !canUseServer()) return
    let alive = true
    fetchValueOptions(remoteConfig(), field)
      .then((next) => {
        if (alive) setOptions(next)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [field, enabled])
  return options
}
