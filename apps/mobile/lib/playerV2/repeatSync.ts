import type { RepeatMode } from "@/lib/playerV2/controller"

/**
 * The player screen's repeat setting is the single source of truth. The engine's "loop this track"
 * flag follows it: on only for repeat "one". This runs from the services that live for the whole app,
 * so a song never loops while the screen says "repeat off" (for example after a restart, when the
 * engine's saved flag and the screen's saved mode were stored apart).
 */
export function createRepeatSync(deps: {
  getRepeatMode: () => RepeatMode
  getEngineLoop: () => boolean
  toggleEngineLoop: () => void
}): () => void {
  return () => {
    const wantLoop = deps.getRepeatMode() === "one"
    if (deps.getEngineLoop() !== wantLoop) deps.toggleEngineLoop()
  }
}
