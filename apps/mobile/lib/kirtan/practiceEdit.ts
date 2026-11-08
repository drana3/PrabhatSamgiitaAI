import { canUseServer, remoteConfig } from "@/lib/kirtan/api"
import { failureOf as languageFailureOf, type AddLanguageFailure } from "@/lib/kirtan/addLanguage"
import { setRecordingPractice, type RemoteConfig, type RemoteRecording } from "@/lib/kirtan/remote"
import type { Kirtan } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * Marking an existing Kiirtan as an Avarta Kiirtan, or taking the mark off: the uploader or the team, on a published
 * Kiirtan, through `PATCH /recordings/{id}/practice`. Any other member who thinks a recording is (or is not) Avarta
 * Kiirtan uses the existing "wrong information" report; there is no suggestion box of its own (docs/kiirtan-practice.md).
 * The failure codes are the ones of "Add language" (same server answers, same sentences).
 */

export type PracticeFailure = AddLanguageFailure

export type PracticeResult = { ok: true; remote: RemoteRecording | null } | { ok: false; code: PracticeFailure }

export async function savePractice(k: Pick<Kirtan, "serverId">, practice: string | null, cfg?: RemoteConfig): Promise<PracticeResult> {
  // the demo preview has no server: the mark is kept on this device only
  if (MOCKUP_DATA && !cfg) return { ok: true, remote: null }
  if (!k.serverId) return { ok: false, code: "notUp" }
  if (!cfg && !canUseServer()) return { ok: false, code: "signin" }
  try {
    return { ok: true, remote: await setRecordingPractice(cfg ?? remoteConfig(), k.serverId, practice) }
  } catch (error) {
    return { ok: false, code: languageFailureOf(error) }
  }
}
