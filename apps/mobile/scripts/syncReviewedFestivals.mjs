// Copies the reviewed festival list into the app: node scripts/syncReviewedFestivals.mjs [path-to-festivals.json]
// The app reads data/festivalsReviewed.json (lib/festivals/reviewed.ts); the final file replaces it without code changes.
import { copyFileSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const source = process.argv[2] ?? "/Users/dada/Documents/Carousel/Для-Дады/коллекции-пс/festivals.json"
const target = resolve(here, "../data/festivalsReviewed.json")
const parsed = JSON.parse(readFileSync(source, "utf8"))
const list = Array.isArray(parsed) ? parsed : parsed.festivals
if (!Array.isArray(list) || list.length === 0) throw new Error("no festival list in " + source)
copyFileSync(source, target)
console.log(`copied ${list.length} festivals to ${target}`)
