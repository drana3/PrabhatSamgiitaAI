import { validateName } from "@/lib/profile/validate"

export type ProfileUpdate = {
  /** new display name; leave out to keep it */
  name?: string
  /** new picture (data URI), or `null` to remove it; leave out to keep it */
  photoUri?: string | null
}

export type SaveProfileResult =
  | { ok: true; name: string | undefined; photoUri: string | null | undefined; synced: boolean }
  | { ok: false; field: "name"; error: string }

/** Where a saved profile lands on this phone. The default writes the stores (lib/profile/localSink.ts). */
export type ProfileSink = {
  apply: (input: { name?: string; photoUri?: string | null }) => void | Promise<void>
}

/**
 * The one seam for saving a profile. Validates, writes it on this phone (the sink), and is where the
 * upload goes later.
 * TODO(api): member profile endpoint (PATCH /api/v1/members/profile with name and a JPEG): call it
 * here after the local write, return `synced: true` when it answers, and queue a retry when it does not.
 */
export async function saveProfile(update: ProfileUpdate, sink: ProfileSink): Promise<SaveProfileResult> {
  const input: { name?: string; photoUri?: string | null } = {}
  if (update.name !== undefined) {
    const check = validateName(update.name)
    if (!check.ok) return { ok: false, field: "name", error: check.error }
    input.name = check.value
  }
  if (update.photoUri !== undefined) input.photoUri = update.photoUri
  await sink.apply(input)
  return { ok: true, name: input.name, photoUri: input.photoUri, synced: false }
}
