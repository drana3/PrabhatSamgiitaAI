import { DEMO_AUTHORS, type DemoAuthor } from "@/lib/fixtures/authors"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * The only door to the invented author pages. Outside the demo preview (MOCKUP_DATA) the list is empty, so a real
 * build never shows a made-up author. Pure: `demo` is a parameter (default: the build flag) so tests check both.
 */
export function sampleAuthors(demo: boolean = MOCKUP_DATA): readonly DemoAuthor[] {
  return demo ? DEMO_AUTHORS : []
}
