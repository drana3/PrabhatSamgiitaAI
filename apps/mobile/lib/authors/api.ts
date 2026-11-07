import { remoteConfig } from "@/lib/kirtan/api"
import { createDemoApi, type DemoControl } from "@/lib/authors/demo"
import { createAuthorsApi } from "@/lib/authors/remote"
import type { AuthorsApi } from "@/lib/authors/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * The author API the screens use: the real one, or in the web preview (MOCKUP_DATA) the demo that answers from invented
 * pages and sends nothing. One instance per app run, so the demo keeps the page the person just created.
 */
let instance: AuthorsApi | null = null

export function authorsApi(): AuthorsApi {
  if (!instance) {
    if (MOCKUP_DATA) {
      const demo = createDemoApi()
      // the preview and the screenshot scripts can put the demo into any state: see DemoControl in lib/authors/demo.ts
      ;(globalThis as { __authorsDemo?: unknown }).__authorsDemo = demo.control
      bootDemo(demo.control)
      instance = demo
    } else instance = createAuthorsApi(remoteConfig())
  }
  return instance
}

/** For tests: drop the cached instance. */
export function resetAuthorsApi(): void {
  instance = null
}

/**
 * The screenshot scripts keep a list of control calls in sessionStorage ("authorsDemo": [["setMine", {...}], ...]); the
 * demo replays them when it starts, so a state survives a page load. Empty for a person using the preview.
 */
function bootDemo(control: DemoControl): void {
  try {
    const raw = (globalThis as { sessionStorage?: Storage }).sessionStorage?.getItem("authorsDemo")
    if (!raw) return
    for (const [method, ...args] of JSON.parse(raw) as [keyof DemoControl, ...unknown[]][]) {
      ;(control[method] as (...a: unknown[]) => void)(...args)
    }
  } catch {
    // a broken script state must never stop the preview
  }
}
