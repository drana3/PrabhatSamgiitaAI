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

  // tab bar, mini player
  "tabs.today": "Today",
  "tabs.songs": "Songs",
  "tabs.kiirtan": "Kiirtan",
  "tabs.learn": "Learn",
  "kind.kiirtan": "Kiirtan",
  "kind.bhajan": "Bhajan",
  "kind.kiirtans": "Kiirtans",
  "kind.bhajans": "Bhajans",
  "kind.kiirtan.tag": "KIIRTAN",
  "kind.bhajan.tag": "BHAJAN",
  "kind.kiirtan.count_one": "{count} kiirtan",
  "kind.kiirtan.count_other": "{count} kiirtans",
  "kind.bhajan.count_one": "{count} bhajan",
  "kind.bhajan.count_other": "{count} bhajans",
  "kind.subtitle.addedBy": "{kind} · added by {name}",
  "kind.spokenLabel": "{kind}, {title}. {subline}",
  "player.mini.progress": "{head} · {position} of {duration}",
  "player.mini.open": "Open the player, {title}",
  "player.mini.pause": "Pause {title}",
  "player.mini.play": "Play {title}",
} as const
