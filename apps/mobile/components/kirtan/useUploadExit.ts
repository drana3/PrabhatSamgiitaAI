import { useMemo } from "react"
import { useRouter } from "expo-router"

import { exitToOrigin, exitToPage, exitToTab, MY_UPLOADS_HREF, runExit } from "@/lib/kirtan/uploadExit"
import { href } from "@/utils/href"

/**
 * The ways out of the upload screens (lib/kirtan/uploadExit.ts): "Done" back to the tab the person came from, the list
 * of my uploads, or a page opened after the upload. None leaves the Upload hub standing under the result.
 */
export function useUploadExit() {
  const router = useRouter()
  return useMemo(() => {
    const can = () => router.canDismiss()
    const run = (steps: Parameters<typeof runExit>[1]) => runExit(router as unknown as Parameters<typeof runExit>[0], steps, (value) => href(value) as never)
    return {
      toOrigin: () => run(exitToOrigin(can())),
      toMine: () => run(exitToTab(MY_UPLOADS_HREF, can())),
      toPage: (path: string) => run(exitToPage(path, can())),
    }
  }, [router])
}
