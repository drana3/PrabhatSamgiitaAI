// Loads data/pronunciation/index.ts from a plain Node script by bundling it with esbuild (already in node_modules
// through vitest). The data files use extensionless imports like the rest of the app, which Node cannot resolve itself.
import { build } from "esbuild"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

export async function loadPronunciationData() {
  const out = await build({
    entryPoints: [join(root, "data", "pronunciation", "index.ts")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    logLevel: "silent",
  })
  const file = join(mkdtempSync(join(tmpdir(), "pron-")), "data.mjs")
  writeFileSync(file, out.outputFiles[0].text)
  return import(pathToFileURL(file).href)
}

export const appRoot = root
