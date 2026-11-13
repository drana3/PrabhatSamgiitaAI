// Copies the Prabhat Samgiita collection files into the app:
//   node scripts/syncPsCollections.mjs [folder-with-the-json-files]
// The app reads data/psCollections/*.json (lib/psCollections/data.ts). A fresh file replaces the old one without any
// code change. A source file that is not in the folder yet is skipped: the copy already in the app stays.
// Only what the app uses is copied (id, title, description, songs and the optional reviewed/section flags),
// so the long "song_basis" notes of the source files do not grow the app.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const folder = process.argv[2] ?? "/Users/dada/Documents/Carousel/Для-Дады/коллекции-пс"
const target = resolve(here, "../data/psCollections")

/** source file name -> file in the app */
export const SOURCES = {
  "collections-assignment.json": "assignment.json",
  "collections-languages.json": "languages.json",
  "collections-tala.json": "tala.json",
  "collections-raga.json": "raga.json",
}

mkdirSync(target, { recursive: true })
for (const [from, to] of Object.entries(SOURCES)) {
  const source = join(folder, from)
  if (!existsSync(source)) {
    console.log(`skipped ${from}: not in ${folder}`)
    continue
  }
  const parsed = JSON.parse(readFileSync(source, "utf8"))
  const list = Array.isArray(parsed) ? parsed : parsed.collections
  if (!Array.isArray(list)) throw new Error(`no collection list in ${source}`)
  const slim = list.map((c) => {
    const out = { id: c.id, title: c.title, description: c.description ?? "", songs: c.songs }
    if (typeof c.reviewed === "boolean") out.reviewed = c.reviewed
    if (typeof c.section === "string") out.section = c.section
    return out
  })
  writeFileSync(join(target, to), JSON.stringify({ status: parsed.status ?? "", collections: slim }))
  console.log(`copied ${slim.length} collections (${slim.reduce((n, c) => n + c.songs.length, 0)} song places) to ${join(target, to)}`)
}
