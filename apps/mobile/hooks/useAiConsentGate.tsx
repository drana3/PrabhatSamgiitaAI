import { useCallback, useRef, useState, type ReactElement } from "react"

import { AiConsentSheet } from "@/components/assistant-v2/AiConsentSheet"
import type { AmTheme } from "@/constants/tokens/amColors"
import { isConsentValid } from "@/lib/aiConsent"
import { aiConsentReady, useAiConsentStore } from "@/stores/aiConsentStore"

type Pending = { run: () => void; declined?: () => void }

/**
 * `guard(run, declined)` runs `run` at once when the person has agreed to send questions to the AI. If not, it
 * shows the consent sheet; Agree stores the consent and runs `run`, Not now calls `declined` (put the question
 * back in the field) and nothing is sent. Render `sheet` once in the screen.
 */
export function useAiConsentGate(theme: AmTheme): {
  guard: (run: () => void, declined?: () => void) => Promise<void>
  sheet: ReactElement | null
} {
  const [open, setOpen] = useState(false)
  const pending = useRef<Pending | null>(null)

  const guard = useCallback(async (run: () => void, declined?: () => void) => {
    // A returning person's yes is still being read from storage right after launch.
    await aiConsentReady()
    if (isConsentValid(useAiConsentStore.getState())) {
      run()
      return
    }
    pending.current = { run, declined }
    setOpen(true)
  }, [])

  const settle = useCallback((agreed: boolean) => {
    const next = pending.current
    pending.current = null
    setOpen(false)
    if (agreed) {
      useAiConsentStore.getState().agree()
      next?.run()
    } else {
      next?.declined?.()
    }
  }, [])

  const sheet = (
    <AiConsentSheet theme={theme} visible={open} onAgree={() => settle(true)} onNotNow={() => settle(false)} />
  )
  return { guard, sheet }
}
