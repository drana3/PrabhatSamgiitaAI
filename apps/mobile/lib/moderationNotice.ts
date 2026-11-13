/**
 * The moderation warning shown at the very end of every upload form (components/common/ModerationNotice.tsx,
 * docs/kiirtan-publishing.md "Warning in the forms"). Kept here, free of React, so a test can read it.
 *
 * `recording` is a sound recording; `chords` is a chord chart. Both read the same title and promise (a moderator looks at
 * it, and a poor one may be declined or removed); only the examples of "poor" differ, because "heavy noise" means nothing
 * for a chart. The strings are in locales/ugc.ts (en, ru, es).
 */
export type ModerationKind = "recording" | "chords"

export const MODERATION_KEYS = {
  title: "ugc.moderation.title",
  recording: "ugc.moderation.recording",
  chords: "ugc.moderation.chords",
} as const
