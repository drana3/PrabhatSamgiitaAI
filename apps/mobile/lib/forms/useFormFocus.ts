import { useMemo, useReducer, useRef } from "react"
import type { ScrollView } from "react-native"

import { createFormFocus } from "@/lib/forms/focusInvalid"

type Measurable = { measureLayout?: (relativeTo: unknown, onSuccess: (x: number, y: number) => void, onFail: () => void) => void }

/**
 * The hook of lib/forms/focusInvalid.ts: `const form = useFormFocus()`, put `form.scrollRef` on the form's ScrollView,
 * spread `form.field("key")` on each field's View, call `form.focusFirst(missingKeys, messages)` when Send is pressed.
 */
export function useFormFocus() {
  const scrollRef = useRef<ScrollView | null>(null)
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const form = useMemo(
    () =>
      createFormFocus({
        scrollTo: (y) => scrollRef.current?.scrollTo({ y, animated: true }),
        // the field's position inside the scroll content, whatever it is nested in (works on the web and on the phone)
        measure: (node) =>
          new Promise<number | null>((resolve) => {
            const inner = (scrollRef.current as unknown as { getInnerViewNode?: () => unknown } | null)?.getInnerViewNode?.()
            const measurable = node as Measurable | null
            if (!inner || !measurable?.measureLayout) return resolve(null)
            try {
              measurable.measureLayout(inner, (_x, y) => resolve(y), () => resolve(null))
            } catch {
              resolve(null)
            }
          }),
        changed: () => bump(),
      }),
    [],
  )
  return useMemo(() => Object.assign(form, { scrollRef }), [form])
}
