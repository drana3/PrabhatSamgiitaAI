import { authorShareKey, authorShareUrl } from "@/lib/authors/constants"
import type { CardSubject } from "@/lib/share/card"

/**
 * What the author page's share sheet needs of a page: its id and address (for the link) and the few public facts the
 * picture card draws. Never a count of listeners or plays: the card cannot show a statistic the page hides.
 */
export type SharedPage = {
  id?: string | null
  slug: string
  display_name: string
  author_type: "solo" | "group"
  city?: string | null
  country?: string | null
  kinds?: { kind: string; count: number }[]
  photo_url?: string | null
}

/** The link that is shared: by id while the page link is hidden, by address once it is offered (constants.ts). */
export function authorLinkOf(page: Pick<SharedPage, "id" | "slug">): string {
  return authorShareUrl(authorShareKey(page))
}

/** The picture card's subject. `photoUrl` is the author's photo as a whole address (the API's is relative to the API). */
export function authorCardSubject(page: SharedPage, photoUrl: string | null): Extract<CardSubject, { kind: "author" }> {
  return {
    kind: "author",
    // the id picks the photo behind the card, as on the website; a page without one falls back to its address
    id: page.id || page.slug,
    name: page.display_name,
    authorType: page.author_type,
    city: page.city ?? null,
    country: page.country ?? null,
    kinds: page.kinds ?? [],
    photoUrl,
  }
}
