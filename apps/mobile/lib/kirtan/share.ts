import type { SharePayload } from "@/lib/playerV2/playerShare"
import { kindLabel } from "@/lib/kirtan/kind"
import type { Kirtan } from "@/lib/kirtan/types"
import { webBaseUrl } from "@/lib/webLinks"
import { t } from "@/lib/i18n"

/**
 * What a share of a Kiirtan or Bhajan carries: its title and a link to the app's website.
 * Sent through the same channels as a song (lib/playerV2/playerShare SHARE_TARGETS, runShare).
 * TODO(api): the website has no page per Kiirtan yet; swap the base link for `/kiirtan/{id}` when it does.
 */
export function kirtanSharePayload(k: Pick<Kirtan, "title" | "author"> & { kind?: Kirtan["kind"] }): SharePayload {
  const url = webBaseUrl()
  const label = kindLabel(k.kind)
  const title = k.title.trim() || label
  const author = k.author.trim()
  const line = author ? t("kt.share.lineBy", { title, author, kind: label }) : t("kt.share.line", { title, kind: label })
  return { title: `${label} · ${title}`, message: `${line}\n${url}`, url }
}
