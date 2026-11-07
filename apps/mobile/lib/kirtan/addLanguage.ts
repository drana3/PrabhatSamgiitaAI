import { canUseServer, remoteConfig } from "@/lib/kirtan/api"
import { kindRequiresLanguage } from "@/lib/kirtan/kind"
import { NetworkError, RemoteError, setRecordingLanguage, type RemoteConfig, type RemoteRecording } from "@/lib/kirtan/remote"
import type { Kirtan } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * "Add language" for an OLD recording stored without one (a Bhajan or a Spiritual song from before the language became
 * required). Pure rules + one call to `PATCH /recordings/{id}/language` (its uploader or the team; it only ADDS).
 * The prompt shows on the recording page and in My uploads (components/kirtan/AddLanguagePrompt.tsx).
 */

/** Why adding the language did not work; each one has a plain sentence (`rec.addLang.error.<code>`). */
export type AddLanguageFailure = "network" | "signin" | "notUp" | "forbidden" | "already" | "removed" | "invalid" | "server"

export type AddLanguageResult = { ok: true; remote: RemoteRecording | null } | { ok: false; code: AddLanguageFailure }

/**
 * Does the prompt show? A published recording of a kind that needs a language and has none, for the person who uploaded
 * it (or the team). Kiirtan has no language; Prabhat Samgiita and Dance music are optional, so no prompt there.
 */
export function needsLanguage(k: Pick<Kirtan, "kind" | "language" | "status">, who: { mine: boolean; team: boolean }): boolean {
  if (!who.mine && !who.team) return false
  return k.status === "published" && kindRequiresLanguage(k.kind) && !k.language
}

export function failureOf(error: unknown): AddLanguageFailure {
  if (error instanceof NetworkError) return "network"
  if (error instanceof RemoteError) {
    if (error.status === 401) return "signin"
    if (error.status === 403) return "forbidden"
    if (error.status === 404) return "notUp"
    if (error.status === 409) return /removed/i.test(error.message) ? "removed" : "already"
    if (error.status === 422) return "invalid"
  }
  return "server"
}

export async function addLanguage(k: Pick<Kirtan, "serverId">, value: { language: string; languageOther?: string }, cfg?: RemoteConfig): Promise<AddLanguageResult> {
  // the demo preview has no server: the language is kept on this device only
  if (MOCKUP_DATA && !cfg) return { ok: true, remote: null }
  if (!k.serverId) return { ok: false, code: "notUp" }
  if (!cfg && !canUseServer()) return { ok: false, code: "signin" }
  try {
    return { ok: true, remote: await setRecordingLanguage(cfg ?? remoteConfig(), k.serverId, value.language, value.languageOther) }
  } catch (error) {
    return { ok: false, code: failureOf(error) }
  }
}
