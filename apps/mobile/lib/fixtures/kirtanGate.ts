import { ARTIST_FIXTURES } from "@/lib/fixtures/artists"
import { KIIRTAN_RESUME_FIXTURES, KIRTAN_FIXTURES, MIX_FIXTURES } from "@/lib/fixtures/kirtan"
import type { Artist } from "@/lib/kirtan/artists"
import type { Mix } from "@/lib/kirtan/mix"
import type { Kirtan } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * The only door to the invented Kiirtan content (sample Kiirtans, sample artists, sample mixes and
 * resume positions). Outside the demo preview (MOCKUP_DATA) every list is empty, so a real build
 * never shows a made-up recording, author or mix. Pure: `demo` is a parameter (default: the build
 * flag) so tests can check both branches.
 */

export function sampleKirtans(demo: boolean = MOCKUP_DATA): readonly Kirtan[] {
  return demo ? KIRTAN_FIXTURES : []
}

export function sampleArtists(demo: boolean = MOCKUP_DATA): readonly Artist[] {
  return demo ? ARTIST_FIXTURES : []
}

export function sampleMixes(demo: boolean = MOCKUP_DATA): readonly Mix[] {
  return demo ? MIX_FIXTURES : []
}

export function sampleResume(demo: boolean = MOCKUP_DATA): readonly { id: string; positionSec: number }[] {
  return demo ? KIIRTAN_RESUME_FIXTURES : []
}

/** The sample titles+authors the duplicate check compares a new submission against (none in a real build). */
export function sampleSubmissionKeys(keyOf: (title: string, author: string) => string, demo: boolean = MOCKUP_DATA): string[] {
  return sampleKirtans(demo).map((k) => keyOf(k.title, k.author))
}
