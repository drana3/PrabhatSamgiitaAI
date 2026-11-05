/**
 * English: the source of truth. Every other language mirrors these keys (the parity test enforces it).
 * Flat keys, `area.screen.element`, camelCase segments. Counted strings use `_one` / `_other`.
 * Variables are written `{name}`. See docs/i18n.md.
 */
export const en = {
  // units
  "unit.kb": "KB",
  "unit.mb": "MB",
  "unit.gb": "GB",

  // shared words
  "common.done": "Done",
  "common.cancel": "Cancel",

  // language sheet
  "language.title": "Language",
  "language.intro": "The language of buttons, menus and messages. Song lyrics and meanings keep their own language settings.",
  "language.auto": "Automatic",
  "language.autoSub": "Follow the language of this device",
  "language.name.en": "English",
  "language.name.ru": "Russian",
  "language.name.es": "Spanish",
  "language.note": "The change applies at once.",
} as const
