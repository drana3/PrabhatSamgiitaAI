import { demoSignedOut } from "@/lib/authors/demoSession"
import type { AuthorsApi } from "@/lib/authors/types"
import { canUseServer } from "@/lib/kirtan/api"

/**
 * Is the person signed in, for the author screens. In the preview there is no account: the demo says yes, unless a
 * script switched it off (DemoControl.setSignedIn) to show the signed-out screens. Not reactive: the screens read it
 * when they open.
 */
export function isSignedIn(api: AuthorsApi): boolean {
  return api.demo ? !demoSignedOut() : canUseServer()
}
