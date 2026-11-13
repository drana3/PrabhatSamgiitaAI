import type { Dictionary } from "./index"

/**
 * ko: a STUB. It is empty on purpose: every key falls back to English (lib/i18n/core.ts), and the
 * language is listed as "не переведено" in review.json and as `complete: false` in lib/i18n/registry.ts.
 * To translate: copy the keys you need from en.ts (parity lists them), translate, then flip `complete`.
 * Plural forms for this language: see REQUIRED_PLURAL_FORMS in lib/i18n/core.ts.
 */
export const ko: Dictionary = {}
