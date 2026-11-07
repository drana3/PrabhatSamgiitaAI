import { ABOUT_MAX, BIO_MAX, MAX_LINKS, NAME_MAX, NAME_MIN, PLACE_MAX } from "@/lib/authors/constants"
import { localSlugProblem, normalizeSlug, suggestSlug, typingSlug, type SlugProblem } from "@/lib/authors/slug"
import type { AuthorLink, AuthorProfileOwner, AuthorType, CreateInput, IncludeMode, PatchInput } from "@/lib/authors/types"

/**
 * The form of an author page as the person fills it: one plain object, checked here before the server is asked.
 * The server repeats every check (it is the judge); these are for early, kind messages. Pure, no React.
 */
export type Draft = {
  displayName: string
  slug: string
  /** the person typed in the address field, so it no longer follows the name */
  slugTouched: boolean
  authorType: AuthorType
  bio: string
  about: string
  country: string
  city: string
  languages: string[]
  links: AuthorLink[]
  claimedName: string
  includeUploads: IncludeMode
  showStats: boolean
}

export function emptyDraft(): Draft {
  return {
    displayName: "",
    slug: "",
    slugTouched: false,
    authorType: "solo",
    bio: "",
    about: "",
    country: "",
    city: "",
    languages: [],
    links: [],
    claimedName: "",
    includeUploads: "all",
    showStats: true,
  }
}

export function draftFromOwner(p: AuthorProfileOwner): Draft {
  return {
    displayName: p.display_name,
    slug: p.slug,
    slugTouched: true,
    authorType: p.author_type,
    bio: p.bio,
    about: p.about,
    country: p.country ?? "",
    city: p.city ?? "",
    languages: p.languages,
    links: p.links,
    claimedName: p.claimed_name ?? "",
    includeUploads: p.include_uploads,
    showStats: p.show_stats,
  }
}

/** Typing the name fills the address until the person types in the address field themselves. */
export function withName(draft: Draft, displayName: string): Draft {
  return { ...draft, displayName, slug: draft.slugTouched ? draft.slug : suggestSlug(displayName) }
}

/** Typing in the address field: a hyphen at the end is kept (see `typingSlug`). */
export function withSlug(draft: Draft, raw: string): Draft {
  return { ...draft, slug: typingSlug(raw), slugTouched: true }
}

/** On blur: the address as it will be sent (no hyphen at either end). */
export function settleSlug(draft: Draft): Draft {
  const slug = normalizeSlug(draft.slug)
  return slug === draft.slug ? draft : { ...draft, slug }
}

export type DraftErrors = {
  name?: "too_short" | "too_long"
  slug?: SlugProblem
  bio?: "too_long"
  about?: "too_long"
  place?: "too_long"
  links?: "too_many" | "empty_url"
}

const clean = (text: string) => text.trim().replace(/\s+/g, " ")

export function validateDraft(d: Draft): DraftErrors {
  const errors: DraftErrors = {}
  const name = clean(d.displayName)
  if (name.length < NAME_MIN) errors.name = "too_short"
  else if (name.length > NAME_MAX) errors.name = "too_long"
  const slug = localSlugProblem(normalizeSlug(d.slug))
  if (slug) errors.slug = slug
  if (d.bio.trim().length > BIO_MAX) errors.bio = "too_long"
  if (d.about.trim().length > ABOUT_MAX) errors.about = "too_long"
  if (clean(d.country).length > PLACE_MAX || clean(d.city).length > PLACE_MAX) errors.place = "too_long"
  if (d.links.length > MAX_LINKS) errors.links = "too_many"
  else if (d.links.some((l) => !l.url.trim())) errors.links = "empty_url"
  return errors
}

export function hasErrors(errors: DraftErrors): boolean {
  return Object.keys(errors).length > 0
}

function linksOf(d: Draft): AuthorLink[] {
  return d.links.filter((l) => l.url.trim()).map((l) => ({ kind: l.kind, url: l.url.trim() }))
}

export function toCreateInput(d: Draft, publish: boolean): CreateInput {
  return {
    slug: normalizeSlug(d.slug),
    display_name: clean(d.displayName),
    author_type: d.authorType,
    bio: d.bio.trim(),
    about: d.about.trim(),
    country: clean(d.country) || null,
    city: clean(d.city) || null,
    languages: d.languages,
    links: linksOf(d),
    claimed_name: clean(d.claimedName) || null,
    include_uploads: d.includeUploads,
    show_stats: d.showStats,
    publish,
  }
}

/** Only what changed, so an edit never re-sends (or re-checks) what the person did not touch. */
export function toPatch(d: Draft, owner: AuthorProfileOwner): PatchInput {
  const next = toCreateInput(d, false)
  const patch: PatchInput = {}
  if (next.slug !== owner.slug) patch.slug = next.slug
  if (next.display_name !== owner.display_name) patch.display_name = next.display_name
  if (next.author_type !== owner.author_type) patch.author_type = next.author_type
  if (next.bio !== owner.bio) patch.bio = next.bio
  if (next.about !== owner.about) patch.about = next.about
  if (next.country !== owner.country) patch.country = next.country
  if (next.city !== owner.city) patch.city = next.city
  if (JSON.stringify(next.languages) !== JSON.stringify(owner.languages)) patch.languages = next.languages
  if (JSON.stringify(next.links) !== JSON.stringify(owner.links)) patch.links = next.links
  if (next.claimed_name !== owner.claimed_name) patch.claimed_name = next.claimed_name
  if (next.include_uploads !== owner.include_uploads) patch.include_uploads = next.include_uploads
  if (next.show_stats !== owner.show_stats) patch.show_stats = next.show_stats
  return patch
}

export function isDirty(d: Draft, owner: AuthorProfileOwner): boolean {
  return Object.keys(toPatch(d, owner)).length > 0
}
