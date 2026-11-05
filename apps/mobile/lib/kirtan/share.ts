import type { SharePayload } from "@/lib/playerV2/playerShare"
import type { Kirtan } from "@/lib/kirtan/types"
import { webBaseUrl } from "@/lib/webLinks"

/**
 * What a share of a Kiirtan carries: its title and a link to the app's website.
 * Sent through the same channels as a song (lib/playerV2/playerShare SHARE_TARGETS, runShare).
 * TODO(api): the website has no page per Kiirtan yet; swap the base link for `/kiirtan/{id}` when it does.
 */
export function kirtanSharePayload(k: Pick<Kirtan, "title" | "author">): SharePayload {
  const url = webBaseUrl()
  const title = k.title.trim() || "Kiirtan"
  const by = k.author.trim() ? ` by ${k.author.trim()}` : ""
  return { title: `Kiirtan · ${title}`, message: `${title}${by}, a Kiirtan on Prabhat Samgiita.\n${url}`, url }
}
