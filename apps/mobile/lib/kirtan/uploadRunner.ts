import { sampleKirtans } from "@/lib/fixtures/kirtanGate"
import { canUseServer, remoteConfig } from "@/lib/kirtan/api"
import { submissionKey } from "@/lib/kirtan/submissions"
import { discardSimilar, uploadSubmission, type UploadDeps, type UploadOutcome } from "@/lib/kirtan/upload"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useContentRulesStore } from "@/stores/contentRulesStore"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * Sends one submission of the store to the server and writes the answer back (published / failed). The form and the
 * "Try again" button both call it. In the demo preview (MOCKUP_DATA) there is no server: the recording is published on
 * this device at once and stays here (docs/kiirtan-publishing.md, "Demo content"), after the same duplicate check.
 */

export type RunResult = UploadOutcome | { status: "local" }

export async function runUpload(
  id: string,
  options: { confirmDifferent?: boolean; key?: string } = {},
  deps: UploadDeps = {},
): Promise<RunResult> {
  const store = useKirtanStore.getState()
  const item = store.submissions.find((k) => k.id === id)
  if (!item || !item.audioUrl || !item.fileName) {
    const failure = { code: "gone" as const }
    store.failed(id, failure)
    return { status: "failed", failure }
  }

  if (MOCKUP_DATA) {
    const key = submissionKey(item.title, item.author)
    const same = [...sampleKirtans(), ...store.submissions.filter((k) => k.id !== id && k.status === "published")].find((k) => submissionKey(k.title, k.author) === key)
    if (same) {
      const failure = { code: "duplicate" as const, original: { id: same.id, title: same.title, author: same.author, audioUrl: same.audioUrl ?? "" } }
      store.failed(id, failure)
      return { status: "failed", failure }
    }
    store.publishedLocally(id)
    return { status: "local" }
  }

  if (!canUseServer()) {
    const failure = { code: "signin" as const }
    store.failed(id, failure)
    return { status: "failed", failure }
  }

  const outcome = await uploadSubmission(
    remoteConfig(),
    {
      uri: item.audioUrl,
      fileName: item.fileName,
      fileType: item.fileType ?? null,
      kind: item.kind,
      title: item.title,
      author: item.author,
      byAuthor: Boolean(item.byAuthor),
      mantra: item.mantra,
      year: item.year ?? null,
      termsVersion: useContentRulesStore.getState().version ?? undefined,
      confirmDifferent: options.confirmDifferent,
      key: options.key,
    },
    deps,
  )
  if (outcome.status === "published") store.published(id, outcome.recording)
  else if (outcome.status === "failed") store.failed(id, outcome.failure)
  return outcome
}

/**
 * The author answered "Cancel" to "sounds like a recording already in the library": the file that already reached the
 * server is deleted. Nothing to do in the demo preview, where no file was sent.
 */
export async function cancelSimilar(key: string): Promise<void> {
  if (MOCKUP_DATA || !canUseServer()) return
  await discardSimilar(remoteConfig(), key)
}
