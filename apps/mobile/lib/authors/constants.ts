/**
 * Addresses and limits of the author pages, in one place. The two "add" hrefs belong to the upload screens
 * (the buttons on the author's own page open them), so they are written down here once and not typed again.
 */

/** Add a single recording (the upload form). */
export const ADD_RECORDING_HREF = "/add-kirtan"
/** Add a playlist from an event (the set upload). */
export const ADD_PLAYLIST_HREF = "/upload-set"

export const AUTHORS_HREF = "/authors"
export const BECOME_AUTHOR_HREF = "/become-author"
export const MY_AUTHOR_HREF = "/my-author"
export const AUTHOR_EDIT_HREF = "/author-edit"
/** Recordings in the library that may be the person's (suggestions and their own requests). */
export const AUTHOR_CLAIMS_HREF = "/author-claims"
/** The search page "Find my recordings". */
export const AUTHOR_FIND_HREF = "/author-find"
export const CONTENT_RULES_HREF = "/content-rules"

/**
 * TEMPORARY (Dada, 2026-11-08): the page link (the slug) is not offered in the interface: no field to change it, no
 * link line on the author's own page, no word about it in the "become an author" step. The page still has its link (made
 * from the name, kept by the API, used by Share and Copy) and nothing is deleted. Set to true to bring it all back.
 * docs/author-profiles.md, "Page link hidden".
 */
export const SHOW_PAGE_LINK = false

/**
 * TEMPORARY (Dada, 2026-11-13): the directory's "Role" filter (writes / performs) is built on the phone and in the demo,
 * but the server's directory has no `role` parameter yet, so against the real server the filter would do nothing. It stays
 * hidden there until the server answers it; set to true then. The demo always shows it. See the report of the roles work.
 */
export const DIRECTORY_ROLE_FILTER_LIVE = false

/** The public address of a page inside the app and on the web (the same path on both). */
export function authorHref(slug: string): string {
  return `/author/${encodeURIComponent(slug)}`
}

/** The link that is shared: https on the public site. */
export function authorShareUrl(slug: string, origin: string = AUTHOR_SHARE_ORIGIN): string {
  return `${origin.replace(/\/+$/, "")}${authorHref(slug)}`
}

/**
 * What a shared link carries after `/author/`: the page id while the page link is hidden (`SHOW_PAGE_LINK` false), the
 * address (slug) once it is offered. The API and the website open a page by either; an id also survives a change of
 * address. A server too old to send the id leaves the address.
 */
export function authorShareKey(page: { slug: string; id?: string | null }, showLink: boolean = SHOW_PAGE_LINK): string {
  return showLink ? page.slug : page.id || page.slug
}

export const AUTHOR_SHARE_ORIGIN = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://www.prabhatasamgiita.org").trim() || "https://www.prabhatasamgiita.org"

// ---- limits the server also enforces (apps/api/app/services/author_rules.py); the form shows them early
export const SLUG_MIN = 3
export const SLUG_MAX = 30
export const NAME_MIN = 2
export const NAME_MAX = 60
export const BIO_MAX = 280
export const ABOUT_MAX = 4000
export const PLACE_MAX = 80
export const MAX_LINKS = 6

/** Languages a page can list (the server's PROFILE_LANGUAGES). */
export const PROFILE_LANGUAGES = ["bengali", "sanskrit", "hindi", "english", "spanish", "russian", "other"] as const
export type ProfileLanguage = (typeof PROFILE_LANGUAGES)[number]

export const LINK_KINDS = ["youtube", "instagram", "facebook", "telegram", "spotify", "soundcloud", "bandcamp", "apple_music", "x", "website"] as const

/** Wait after the last keystroke before the address is asked about. */
export const SLUG_CHECK_DELAY_MS = 350

/** A recording count a page needs before a search engine is allowed to list it (shown to the owner as a hint). */
export const INDEXABLE_MIN_RECORDINGS = 1

/** Directory page size. */
export const DIRECTORY_PAGE = 20
/** Recordings per page on an author page. */
export const RECORDINGS_PAGE = 50
