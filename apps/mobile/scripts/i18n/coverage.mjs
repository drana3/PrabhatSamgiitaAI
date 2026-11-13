#!/usr/bin/env node
/**
 * Finds hard-coded, user-visible English in app/ and components/ that does not go through t().
 *
 *   node scripts/i18n/coverage.mjs            per-file counts, biggest first
 *   node scripts/i18n/coverage.mjs --lines    also print every finding (file:line  text)
 *   node scripts/i18n/coverage.mjs --json     machine-readable
 *   node scripts/i18n/coverage.mjs app/foo    only paths starting with this
 *
 * What it counts (a heuristic, not a parser; expect a few false positives and a few misses):
 *   - JSX text between tags:               <Text>Save</Text>
 *   - text props with a string literal:    accessibilityLabel / accessibilityHint / placeholder / title / label / meta / value /
 *                                          subtitle / description / eyebrow / first / second / alt / headerTitle
 *   - Alert.alert(...) and toast calls:    Alert.alert("Saved"), showToast("Saved"), setToast("Saved"), toast("Saved")
 * What it skips: app/admin, parity, __tests__, anything that already calls t(...), identifiers and URLs,
 * strings with no letters, single lower-case tokens that look like ids ("auto", "row"), and the lines marked
 * `i18n-ignore` (use that on staff-only or deliberately English text, with a reason).
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..")
const SCAN = ["app", "components"]
const SKIP_DIRS = new Set(["admin", "parity", "node_modules", "__tests__"])
const TEXT_PROPS = [
  "accessibilityLabel",
  "accessibilityHint",
  "placeholder",
  "title",
  "label",
  "subtitle",
  "description",
  "eyebrow",
  "first",
  "second",
  "alt",
  "headerTitle",
  "message",
  "actionLabel",
  "meta",
  "value",
  "hint",
  "caption",
  "text",
]
const TOAST_CALLS = ["Alert.alert", "showToast", "setToast", "toast", "show"]

const args = process.argv.slice(2)
const wantLines = args.includes("--lines")
const wantJson = args.includes("--json")
const filter = args.find((a) => !a.startsWith("--"))

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\./.test(name)) out.push(full)
  }
  return out
}

/** Looks like words for a person, not an id, a path, a colour or a number. */
function visible(text) {
  const s = text.trim()
  if (!/[A-Za-z]{2,}/.test(s)) return false
  if (/^(https?:|\/|#|\.|@|[a-z0-9_.-]+\.(png|jpg|jpeg|webp|mp3|json)$)/i.test(s)) return false
  if (/^[a-z][a-zA-Z0-9_.-]*$/.test(s)) return false // auto, row, space-between, tabs.today
  if (/^[A-Z0-9_]+$/.test(s) && !s.includes(" ") && s.length < 4) return false // PS, MB
  if (/^(PS|MB|KB|GB|px|dp)\b/.test(s) && s.length < 4) return false
  return true
}

const lineOf = (src, index) => src.slice(0, index).split("\n").length

function scan(file) {
  const src = readFileSync(file, "utf8")
  const lines = src.split("\n")
  const hits = []
  const add = (index, text) => {
    const line = lineOf(src, index)
    const row = lines[line - 1] ?? ""
    if (/i18n-ignore/.test(row) || /i18n-ignore/.test(lines[line - 2] ?? "")) return
    if (/\bt\(\s*["'`]/.test(row)) return
    if (/^\s*(\/\/|\*|\/\*)/.test(row)) return
    if (!visible(text)) return
    hits.push({ line, text: text.trim().replace(/\s+/g, " ").slice(0, 80) })
  }

  // 1. JSX text: >words<   (no braces, no tags inside)
  for (const m of src.matchAll(/>([^<>{}=;&|\n][^<>{}=;&|]*?)</g)) {
    const text = m[1]
    if (/^\s*$/.test(text)) continue
    // skip generics and comparisons: Array<string>, a > b < c
    const before = src.slice(Math.max(0, m.index - 40), m.index)
    if (/[A-Za-z0-9_\]]$/.test(before) && !/<[A-Za-z][^>]*$/.test(before)) continue
    if (/^[\s,.:|·•\-–—/()0-9]*$/.test(text)) continue
    add(m.index + 1, text)
  }
  // 1b. JSX text on its own line(s): a line of plain words between a tag end and a tag start
  for (const m of src.matchAll(/>\s*\n\s+([A-Z][^<>{}\n=;]*[a-z.!?…])\s*\n\s*</g)) {
    add(m.index, m[1])
  }

  // 2. text props with a literal
  const props = TEXT_PROPS.join("|")
  for (const m of src.matchAll(new RegExp(`\\b(?:${props})=(?:"([^"]*)"|\\{"([^"]*)"\\}|\\{\`([^\`$]*)\`\\})`, "g"))) {
    add(m.index, m[1] ?? m[2] ?? m[3] ?? "")
  }
  // 2b. the same as object keys in a component's own constants: label: "Save"
  for (const m of src.matchAll(new RegExp(`\\b(?:${props}):\\s*"([^"]*)"`, "g"))) {
    add(m.index, m[1])
  }

  // 3. Alert and toast calls
  for (const call of TOAST_CALLS) {
    const esc = call.replace(".", "\\.")
    for (const m of src.matchAll(new RegExp(`\\b${esc}\\(\\s*(?:"([^"]*)"|'([^']*)'|\`([^\`$]*)\`)`, "g"))) {
      add(m.index, m[1] ?? m[2] ?? m[3] ?? "")
    }
  }

  // dedupe identical line+text
  const seen = new Set()
  return hits.filter((h) => (seen.has(h.line + h.text) ? false : (seen.add(h.line + h.text), true)))
}

const files = SCAN.flatMap((d) => walk(join(root, d)))
  .map((f) => relative(root, f).split(sep).join("/"))
  .filter((f) => !filter || f.startsWith(filter))
  .sort()

const rows = []
let total = 0
let withText = 0
for (const f of files) {
  const hits = scan(join(root, f))
  const usesT = /from "@\/lib\/i18n"/.test(readFileSync(join(root, f), "utf8"))
  if (usesT) withText += 1
  if (hits.length) {
    total += hits.length
    rows.push({ file: f, count: hits.length, translated: usesT, hits })
  }
}
rows.sort((a, b) => b.count - a.count || a.file.localeCompare(b.file))

if (wantJson) {
  console.log(JSON.stringify({ files: files.length, filesUsingI18n: withText, filesWithEnglish: rows.length, findings: total, rows }, null, 2))
} else {
  console.log(`scanned ${files.length} files in ${SCAN.join(", ")} (admin and parity skipped)`)
  console.log(`${withText} import the i18n module; ${rows.length} still hold hard-coded English: ${total} findings\n`)
  const width = Math.max(10, ...rows.map((r) => r.file.length))
  for (const r of rows) {
    console.log(`${String(r.count).padStart(4)}  ${r.file.padEnd(width)}  ${r.translated ? "(partly translated)" : ""}`)
    if (wantLines) for (const h of r.hits) console.log(`        ${h.line}: ${h.text}`)
  }
}
