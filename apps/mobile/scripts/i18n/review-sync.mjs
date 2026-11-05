#!/usr/bin/env node
/**
 * Keeps locales/review.json in step with locales/ru.ts and locales/es.ts:
 *   - a key that is new in a dictionary is added as `false` (not yet read by a native speaker);
 *   - a key that is gone from the dictionary is dropped;
 *   - existing `true` values are kept.
 * Usage: node scripts/i18n/review-sync.mjs [--list ru]   (--list prints the unreviewed keys of a language)
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const reviewPath = join(root, "locales", "review.json")

/** Keys of the main dictionary plus those of every `<area>Ru` / `<area>Es` block it spreads in from the other locales files. */
function keysOf(language) {
  const suffix = language === "ru" ? "Ru" : "Es"
  const sources = [readFileSync(join(root, "locales", `${language}.ts`), "utf8")]
  for (const file of readdirSync(join(root, "locales"))) {
    if (!file.endsWith(".ts") || ["en.ts", "ru.ts", "es.ts", "index.ts"].includes(file)) continue
    const text = readFileSync(join(root, "locales", file), "utf8")
    for (const block of text.split(/^export const /m).slice(1)) {
      const name = new RegExp(`^(\\w+${suffix})\\b`).exec(block)?.[1]
      // only blocks the main dictionary really spreads in (`...accountRu`)
      if (name && sources[0].includes(`...${name}`)) sources.push(block)
    }
  }
  const keys = []
  for (const source of sources) {
    for (const match of source.matchAll(/^\s*"([^"]+)":\s*(?:"|\n)/gm)) keys.push(match[1])
  }
  return keys
}

const review = JSON.parse(readFileSync(reviewPath, "utf8"))
const next = {}
for (const language of ["ru", "es"]) {
  const old = review[language] ?? {}
  next[language] = {}
  for (const key of keysOf(language)) next[language][key] = old[key] === true
}

const listIndex = process.argv.indexOf("--list")
if (listIndex !== -1) {
  const language = process.argv[listIndex + 1] ?? "ru"
  const open = Object.entries(next[language] ?? {}).filter(([, ok]) => !ok).map(([key]) => key)
  console.log(`${language}: ${open.length} unreviewed of ${Object.keys(next[language] ?? {}).length}`)
  for (const key of open) console.log(key)
} else {
  writeFileSync(reviewPath, `${JSON.stringify(next, null, 2)}\n`)
  for (const language of ["ru", "es"]) {
    const all = Object.values(next[language])
    console.log(`${language}: ${all.length} keys, ${all.filter(Boolean).length} reviewed`)
  }
}
