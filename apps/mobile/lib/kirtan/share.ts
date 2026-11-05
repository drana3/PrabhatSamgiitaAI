import type { SharePayload } from "@/lib/playerV2/playerShare"
import { kindLabel } from "@/lib/kirtan/kind"
import type { Kirtan } from "@/lib/kirtan/types"
import { webBaseUrl } from "@/lib/webLinks"

/**
 * What a share of a Kiirtan or Bhajan carries: its title and a link to the app's website.
 * Sent through the same channels as a song (lib/playerV2/playerShare SHARE_TARGETS, runShare).
 * TODO(api): the website has no page per Kiirtan yet; swap the base link for `/kiirtan/{id}` when it does.
 */
export function kirtanSharePayload(k: Pick<Kirtan, "title" | "author"> & { kind?: Kirtan["kind"] }): SharePayload {
  const url = webBaseUrl()
  const label = kindLabel(k.kind)
  const title = k.title.trim() || label
  const by = k.author.trim() ? ` by ${k.author.trim()}` : ""
  return { title: `${label} · ${title}`, message: `${title}${by}, a ${label} on Prabhat Samgiita.\n${url}`, url }
}
