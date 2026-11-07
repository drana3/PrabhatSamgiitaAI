import { useEffect, useRef } from "react"

import { registerSheetBack } from "@/lib/sheetBack"

/**
 * The one hook every bottom sheet and overlay uses: while `open` is true, hardware Back calls `onClose`
 * instead of leaving the screen. The latest `onClose` is used, so callers need not memoise it.
 */
export function useSheetBackHandler(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    return registerSheetBack(() => closeRef.current())
  }, [open])
}
